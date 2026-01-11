# SyllabusStack Architecture Streamlining Proposal v2

**Date**: January 11, 2026
**Status**: Comprehensive Review
**Previous**: ARCHITECTURE_STREAMLINING_REPORT.md (validated RESOURCE_ORCHESTRATION_MAP.md)

---

## Executive Summary

This proposal addresses the complete system redesign needed to:
1. **Fix broken content discovery** - Fallbacks exist but never trigger
2. **Add Coursera-like learning experience** - Videos, readings, interactions
3. **Integrate cost-effective APIs** - OpenLLM, Active Jobs DB, Jina
4. **Streamline user journeys** - Both instructor and student

### Key Metrics

| Current State | After Implementation |
|---------------|----------------------|
| YouTube quota exhausted = 0 results | 95%+ content discovery success |
| $0.21/user AI cost | $0.08/user (62% savings at scale) |
| Videos only | Videos + Readings + Interactive |
| Firecrawl $16-83/mo | Jina FREE |
| Job scraping + AI extraction | Active Jobs DB (pre-structured) |

---

## Table of Contents

1. [Critical Bug: Content Discovery Chain Broken](#1-critical-bug-content-discovery-chain-broken)
2. [API Integration Strategy](#2-api-integration-strategy)
3. [Coursera-Like Content Model](#3-coursera-like-content-model)
4. [User Journey Redesign](#4-user-journey-redesign)
5. [Implementation Roadmap](#5-implementation-roadmap)

---

## 1. Critical Bug: Content Discovery Chain Broken

### Root Cause Analysis

The Lovable agent correctly identified that Claude's multi-source content discovery code EXISTS but doesn't work. Here's why:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CURRENT BROKEN FLOW                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. checkYouTubeQuota() → queries `api_quota_tracking` table                │
│                              │                                              │
│                              ▼                                              │
│  2. Table has NO rows (quota never tracked)                                 │
│                              │                                              │
│                              ▼                                              │
│  3. Returns NULL → defaults to 10,000 (full quota)                          │
│                              │                                              │
│                              ▼                                              │
│  4. `useAlternativeAPIs = remaining < 500` → FALSE                          │
│                              │                                              │
│                              ▼                                              │
│  5. Code SKIPS Invidious/Piped section entirely                             │
│                              │                                              │
│                              ▼                                              │
│  6. YouTube API call → returns 403 (quota exceeded)                         │
│                              │                                              │
│                              ▼                                              │
│  7. Error logged, move to next query (quota STILL not tracked)              │
│                              │                                              │
│                              ▼                                              │
│  8. All queries fail → Khan Academy fallback (finds 0 videos)               │
│                              │                                              │
│                              ▼                                              │
│  9. Return 0 content matches                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Five Bugs

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| 1 | Quota only tracked on SUCCESS path | `search-youtube-content/index.ts:1127` | Table stays empty |
| 2 | NULL quota defaults to 10,000 | `_shared/content-cache.ts:174` | Always "has quota" |
| 3 | 403 not detected as quota exhaustion | `search-youtube-content/index.ts:757-760` | Error just logged |
| 4 | Fallback condition never met | `search-youtube-content/index.ts:460-461` | Invidious never used |
| 5 | `search-educational-content` never called | No frontend hook | Orphaned function |

### Fix Implementation

#### Fix 1: Track quota on EVERY YouTube API attempt

```typescript
// supabase/functions/search-youtube-content/index.ts
// Around line 757-802, REPLACE the search loop with:

for (const query of queries) {
  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    // ... build URL ...

    const searchResponse = await fetch(searchUrl.toString());

    // NEW: Track usage IMMEDIATELY (before checking response)
    await trackApiUsage('youtube', 100);

    // NEW: Detect 403 as quota exhaustion
    if (searchResponse.status === 403) {
      const errorText = await searchResponse.text();
      if (errorText.includes('quotaExceeded')) {
        console.warn("YouTube quota EXHAUSTED (403) - switching to Invidious/Piped");
        // Mark quota as exhausted in cache
        await supabase.from('api_quota_tracking').upsert({
          api_name: 'youtube',
          date: new Date().toISOString().split('T')[0],
          used_units: 10000, // Mark as fully exhausted
          daily_limit: 10000,
        });
        break; // Exit YouTube search loop, will trigger fallback
      }
    }

    if (!searchResponse.ok) {
      console.error(`YouTube search error for query "${query}":`, await searchResponse.text());
      continue;
    }

    // ... process results ...
  } catch (error) {
    // Track failed attempts too
    await trackApiUsage('youtube', 100);
    console.error(`YouTube search exception:`, error);
  }
}
```

#### Fix 2: Default to Invidious when quota unknown

```typescript
// supabase/functions/_shared/content-cache.ts
// Change line 174 from:
const remaining = data ?? YOUTUBE_DAILY_QUOTA;

// TO:
const remaining = data ?? 0; // If unknown, assume exhausted → trigger fallback
```

#### Fix 3: Add result-based fallback trigger

```typescript
// supabase/functions/search-youtube-content/index.ts
// After the YouTube search loop (around line 810), ADD:

// If YouTube returned zero results despite having queries, trigger fallback
if (allVideos.length === 0 && queries.length > 0) {
  console.log("YouTube search returned 0 results - triggering Invidious/Piped fallback");
  // Force fallback
  const fallbackResults = await searchViaInvidiousAndPiped(queries, lo_text);
  if (fallbackResults.length > 0) {
    allVideos.push(...fallbackResults);
  }
}
```

#### Fix 4: Create useSearchEducationalContent hook

```typescript
// src/hooks/useLearningObjectives.ts - ADD:

export function useSearchEducationalContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      learningObjective,
      sources = ['invidious', 'piped', 'khan_academy', 'archive_org']
    }: {
      learningObjective: LearningObjective;
      sources?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('search-educational-content', {
        body: {
          learning_objective_id: learningObjective.id,
          core_concept: learningObjective.core_concept,
          search_keywords: learningObjective.search_keywords,
          query: learningObjective.text,
          max_results: 6,
          sources,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, { learningObjective }) => {
      queryClient.invalidateQueries({ queryKey: ['contentMatches', learningObjective.id] });
      toast({
        title: "Content Found",
        description: `Found ${data.total_found || 0} educational resources`,
      });
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
```

#### Fix 5: Update InstructorCourseDetail to use multi-source search

```typescript
// src/pages/instructor/InstructorCourseDetail.tsx
// Update handleFindAllContent to use educational content search as primary

const handleFindAllContent = async () => {
  const losWithoutContent = learningObjectives?.filter(lo =>
    !contentMatchesByLO[lo.id]?.length
  ) || [];

  for (const lo of losWithoutContent) {
    // Try multi-source educational content first (quota-free)
    try {
      await supabase.functions.invoke('search-educational-content', {
        body: {
          learning_objective_id: lo.id,
          core_concept: lo.core_concept,
          search_keywords: lo.search_keywords,
          query: lo.text,
          sources: ['invidious', 'piped', 'khan_academy', 'archive_org', 'mit_ocw'],
        },
      });
    } catch (error) {
      // Fallback to youtube-content search (with its own fallback chain)
      await searchYouTubeContent.mutateAsync(lo);
    }
  }
};
```

### Expected Outcome

| Scenario | Before | After |
|----------|--------|-------|
| YouTube quota exhausted | 0 results, search fails | Invidious/Piped finds videos |
| First search of day | Quota unknown → tries YouTube → fails | Quota unknown → tries Invidious first |
| Khan Academy search | Depends on YouTube quota | Independent, always available |
| Bulk search (20 LOs) | Sequential YouTube → all fail | Parallel multi-source → 90%+ success |

---

## 2. API Integration Strategy

### 2.1 Current vs Proposed API Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT API STACK                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI Services           Content Discovery        Web Services                │
│  ─────────────         ─────────────────        ────────────                │
│  Lovable Gateway       YouTube API (broken)     Firecrawl ($16-83/mo)       │
│  └─ Gemini 2.5 Pro     Khan Academy (works)     └─ Course search            │
│  └─ Gemini 2.0 Flash   Invidious (never called) └─ Job scraping             │
│                        Piped (never called)                                 │
│  OpenAI GPT-4o-mini    Archive.org (never called)                           │
│  └─ Job extraction     MIT OCW (never called)                               │
│                                                                             │
│  COST: ~$0.21/user     SUCCESS: ~20%            COST: $16-333/mo            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ▼ ▼ ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROPOSED API STACK                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI Services           Content Discovery        Web Services                │
│  ─────────────         ─────────────────        ────────────                │
│  PRIMARY:              PRIORITY ORDER:          PRIMARY:                    │
│  OpenLLM (DeepSeek R1) 1. Cache (free)          Jina AI (FREE)              │
│  └─ 89% cheaper        2. Invidious (free)      └─ Search                   │
│  └─ Same quality       3. Piped (free)          └─ Scraping                 │
│                        4. Khan Academy (free)                               │
│  FALLBACK:             5. Archive.org (free)    FALLBACK:                   │
│  Lovable Gateway       6. MIT OCW (free)        Firecrawl (existing)        │
│  └─ Reliability        7. YouTube (quota-ltd)                               │
│                                                                             │
│  JOBS:                                          JOBS:                       │
│  Active Jobs DB                                 No scraping needed          │
│  └─ Pre-structured                              └─ No AI extraction         │
│  └─ Real salary data                            └─ Better UX                │
│                                                                             │
│  COST: ~$0.08/user     SUCCESS: ~95%            COST: $0-29/mo              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 OpenLLM Integration (RapidAPI)

**When to Implement**: >1,000 students (AI costs exceed $100/mo)

**Models Available**:
- DeepSeek R1: 89% cheaper than Gemini Pro, comparable reasoning quality
- Llama 3.1/3.2: Good for simpler tasks
- Mixtral: Balanced cost/quality

**Implementation**:

```typescript
// supabase/functions/_shared/ai-orchestrator.ts - ADD:

const OPENLLM_ENDPOINT = "https://open-llm.p.rapidapi.com/v1/chat/completions";

interface OpenLLMConfig {
  model: 'deepseek-r1' | 'llama-3.1-70b' | 'mixtral-8x22b';
  taskType: 'reasoning' | 'extraction' | 'generation';
}

// Map expensive tasks to cheaper models
const TASK_MODEL_MAP: Record<string, OpenLLMConfig> = {
  'job_requirements': { model: 'deepseek-r1', taskType: 'reasoning' },
  'gap_analysis': { model: 'deepseek-r1', taskType: 'reasoning' },
  'recommendations': { model: 'llama-3.1-70b', taskType: 'generation' },
  'syllabus_extraction': { model: 'mixtral-8x22b', taskType: 'extraction' },
};

async function makeOpenLLMCall(request: AIRequest): Promise<AIResponse> {
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
  if (!RAPIDAPI_KEY) {
    throw new Error("RAPIDAPI_KEY not configured");
  }

  const config = TASK_MODEL_MAP[request.task] || { model: 'llama-3.1-70b', taskType: 'generation' };

  const response = await fetch(OPENLLM_ENDPOINT, {
    method: "POST",
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "open-llm.p.rapidapi.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenLLM error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    model: config.model,
    provider: 'openllm',
    cost: estimateOpenLLMCost(config.model, request, data),
  };
}

// Update makeAICall to use OpenLLM for expensive tasks
async function makeAICall(request: AIRequest): Promise<AIResponse> {
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

  // Use OpenLLM for expensive reasoning tasks when configured
  if (RAPIDAPI_KEY && TASK_MODEL_MAP[request.task]) {
    try {
      return await makeOpenLLMCall(request);
    } catch (error) {
      console.warn("OpenLLM failed, falling back to Lovable:", error);
    }
  }

  // Existing Lovable Gateway logic
  return await makeLovableCall(request);
}
```

### 2.3 Active Jobs DB Integration (RapidAPI)

**Value Proposition**:
- Eliminates: Firecrawl scraping ($0.001) + OpenAI extraction ($0.0003)
- Adds: Pre-structured job data with salary, requirements, apply links
- Better UX: User searches instead of pasting URLs

**Implementation**:

```typescript
// NEW FILE: supabase/functions/search-jobs/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, location, skills, limit = 20 } = await req.json();
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

    if (!RAPIDAPI_KEY) {
      throw new Error("RAPIDAPI_KEY not configured");
    }

    // Build search query
    const descriptionFilter = skills?.length > 0
      ? skills.join(" OR ")
      : undefined;

    const response = await fetch(
      "https://active-jobs-db.p.rapidapi.com/active-ats-7d",
      {
        method: "POST",
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": "active-jobs-db.p.rapidapi.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title_filter: title,
          location_filter: location,
          description_filter: descriptionFilter,
          limit,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Active Jobs DB error: ${response.status}`);
    }

    const jobs = await response.json();

    // Transform to our dream_jobs format
    const transformedJobs = jobs.map((job: any) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      requirements: job.requirements || [],
      description: job.description,
      apply_url: job.apply_url,
      posted_date: job.posted_date,
      source: 'active_jobs_db',
    }));

    return new Response(
      JSON.stringify({
        success: true,
        jobs: transformedJobs,
        total: transformedJobs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search jobs error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

**Frontend Hook**:

```typescript
// src/hooks/useJobs.ts

export function useSearchJobs() {
  return useMutation({
    mutationFn: async ({
      title,
      location,
      skills
    }: {
      title: string;
      location?: string;
      skills?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('search-jobs', {
        body: { title, location, skills },
      });

      if (error) throw error;
      return data;
    },
  });
}
```

### 2.4 Jina AI as Primary Web Provider

**Change Required**: Set environment variable `WEB_PROVIDER=jina`

The abstraction layer already exists in `_shared/web-provider.ts`. Just switch the default:

```bash
# In Supabase Edge Function secrets
WEB_PROVIDER=jina
```

**Cost Impact**:
- Before: Firecrawl $16-83/month
- After: Jina $0 (20 RPM free tier, 500 RPM with free API key)

---

## 3. Coursera-Like Content Model

### 3.1 Current State vs Target

| Feature | Coursera | SyllabusStack (Current) | SyllabusStack (Target) |
|---------|----------|------------------------|------------------------|
| Videos | Yes | Yes (YouTube + others) | Yes (multi-source) |
| Readings | Yes | Limited (articles only) | Yes (PDFs, web pages, textbooks) |
| Interactive | Yes (notebooks, labs) | No | Yes (embedded exercises) |
| Quizzes | Yes (per-video) | Yes (micro-checks) | Yes (enhanced) |
| Discussions | Yes | No | Phase 2 |
| Peer Review | Yes | No | Phase 3 |
| Certificates | Yes | No (schema exists) | Phase 2 |
| Progress Tracking | Yes | Yes (detailed) | Yes (enhanced) |
| Deadlines | Yes | No | Phase 2 |

### 3.2 Enhanced Content Type Schema

```sql
-- Migration: Add content types beyond videos

ALTER TABLE content ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'video';
ALTER TABLE content ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER;
ALTER TABLE content ADD COLUMN IF NOT EXISTS interaction_type TEXT; -- 'passive', 'active', 'interactive'
ALTER TABLE content ADD COLUMN IF NOT EXISTS content_format TEXT; -- 'video', 'pdf', 'article', 'notebook', 'exercise'

-- Add reading-specific fields
ALTER TABLE content ADD COLUMN IF NOT EXISTS word_count INTEGER;
ALTER TABLE content ADD COLUMN IF NOT EXISTS reading_level TEXT; -- 'beginner', 'intermediate', 'advanced'

-- Add interaction-specific fields
ALTER TABLE content ADD COLUMN IF NOT EXISTS exercise_type TEXT; -- 'code', 'quiz', 'fill-blank', 'matching'
ALTER TABLE content ADD COLUMN IF NOT EXISTS exercise_data JSONB; -- Stores exercise configuration

-- Update content_type enum constraint
ALTER TABLE content DROP CONSTRAINT IF EXISTS content_type_check;
ALTER TABLE content ADD CONSTRAINT content_type_check
  CHECK (content_type IN ('video', 'reading', 'interactive', 'assessment'));

-- Update consumption_records for different content types
ALTER TABLE consumption_records ADD COLUMN IF NOT EXISTS read_percentage DECIMAL(5,2);
ALTER TABLE consumption_records ADD COLUMN IF NOT EXISTS interaction_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE consumption_records ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0;
```

### 3.3 Content Type Components

#### Video Content (Existing - Enhanced)

```typescript
// Already exists: VerifiedVideoPlayer.tsx
// Enhancement: Add support for non-YouTube sources

interface VideoPlayerProps {
  content: Content;
  onProgress: (percentage: number, segments: WatchedSegment[]) => void;
  onMicroCheckTriggered: (microCheck: MicroCheck) => void;
}

// Add source detection
const getVideoEmbedUrl = (content: Content): string => {
  switch (content.source_type) {
    case 'youtube':
      return `https://www.youtube.com/embed/${content.source_id}`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${content.source_id}`;
    case 'khan_academy':
      return content.source_url; // Khan has embed URLs
    case 'archive_org':
      return `https://archive.org/embed/${content.source_id}`;
    default:
      return content.source_url;
  }
};
```

#### Reading Content (NEW)

```typescript
// NEW FILE: src/components/learn/ReadingViewer.tsx

interface ReadingViewerProps {
  content: Content;
  onProgress: (percentage: number) => void;
  onComplete: () => void;
}

export function ReadingViewer({ content, onProgress, onComplete }: ReadingViewerProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const progress = Math.min(100, (scrollTop / (scrollHeight - clientHeight)) * 100);
      setScrollProgress(progress);
      onProgress(progress);

      // Mark complete at 90% scroll
      if (progress >= 90) {
        onComplete();
      }
    };

    const element = contentRef.current;
    element?.addEventListener('scroll', handleScroll);
    return () => element?.removeEventListener('scroll', handleScroll);
  }, [onProgress, onComplete]);

  // Track time spent
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="reading-viewer">
      <div className="reading-header">
        <h2>{content.title}</h2>
        <div className="reading-meta">
          <span>{content.word_count} words</span>
          <span>{content.estimated_time_minutes} min read</span>
          <span>{Math.round(scrollProgress)}% complete</span>
        </div>
      </div>

      <div
        ref={contentRef}
        className="reading-content overflow-auto max-h-[70vh] prose prose-lg"
        dangerouslySetInnerHTML={{ __html: content.rendered_content }}
      />

      <ReadingProgressBar progress={scrollProgress} />
    </div>
  );
}
```

#### Interactive Content (NEW)

```typescript
// NEW FILE: src/components/learn/InteractiveExercise.tsx

interface InteractiveExerciseProps {
  content: Content;
  onComplete: (score: number, answers: Record<string, any>) => void;
}

export function InteractiveExercise({ content, onComplete }: InteractiveExerciseProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const exerciseData = content.exercise_data as ExerciseConfig;

  const handleSubmit = () => {
    // Calculate score based on exercise type
    const calculatedScore = calculateScore(exerciseData, answers);
    setScore(calculatedScore);
    setSubmitted(true);
    onComplete(calculatedScore, answers);
  };

  return (
    <div className="interactive-exercise">
      <h2>{content.title}</h2>
      <p className="text-muted-foreground">{content.description}</p>

      {exerciseData.type === 'fill-blank' && (
        <FillInTheBlankExercise
          config={exerciseData}
          answers={answers}
          onChange={setAnswers}
          submitted={submitted}
        />
      )}

      {exerciseData.type === 'code' && (
        <CodeExercise
          config={exerciseData}
          answers={answers}
          onChange={setAnswers}
          submitted={submitted}
        />
      )}

      {exerciseData.type === 'matching' && (
        <MatchingExercise
          config={exerciseData}
          answers={answers}
          onChange={setAnswers}
          submitted={submitted}
        />
      )}

      {!submitted ? (
        <Button onClick={handleSubmit}>Submit Answers</Button>
      ) : (
        <div className="score-display">
          <h3>Score: {score}%</h3>
          {score >= 70 ? (
            <CheckCircle className="text-green-500" />
          ) : (
            <AlertCircle className="text-yellow-500" />
          )}
        </div>
      )}
    </div>
  );
}
```

### 3.4 Unified Content Player

```typescript
// NEW FILE: src/components/learn/UnifiedContentPlayer.tsx

interface UnifiedContentPlayerProps {
  content: Content;
  learningObjectiveId: string;
  onComplete: () => void;
}

export function UnifiedContentPlayer({
  content,
  learningObjectiveId,
  onComplete
}: UnifiedContentPlayerProps) {
  const { mutate: updateConsumption } = useUpdateConsumption();

  const handleProgress = (data: ConsumptionProgress) => {
    updateConsumption({
      contentId: content.id,
      learningObjectiveId,
      ...data,
    });
  };

  // Render appropriate player based on content type
  switch (content.content_type) {
    case 'video':
      return (
        <VerifiedVideoPlayer
          content={content}
          onProgress={(percentage, segments) =>
            handleProgress({ watch_percentage: percentage, watched_segments: segments })
          }
          onComplete={onComplete}
        />
      );

    case 'reading':
      return (
        <ReadingViewer
          content={content}
          onProgress={(percentage) =>
            handleProgress({ read_percentage: percentage })
          }
          onComplete={onComplete}
        />
      );

    case 'interactive':
      return (
        <InteractiveExercise
          content={content}
          onComplete={(score, answers) => {
            handleProgress({
              interaction_completed: true,
              micro_check_accuracy_score: score
            });
            if (score >= 70) onComplete();
          }}
        />
      );

    default:
      return <div>Unsupported content type</div>;
  }
}
```

### 3.5 Content Type Icons & UI

```typescript
// src/components/learn/ContentTypeIcon.tsx

export function ContentTypeIcon({ type, className }: { type: ContentType; className?: string }) {
  const icons: Record<ContentType, LucideIcon> = {
    video: Video,
    reading: FileText,
    interactive: PenTool,
    assessment: CheckSquare,
  };

  const Icon = icons[type] || File;
  return <Icon className={className} />;
}

// In learning objective page, show content types
export function ContentList({ contents }: { contents: Content[] }) {
  return (
    <div className="content-list space-y-2">
      {contents.map(content => (
        <div key={content.id} className="content-item flex items-center gap-3 p-3 border rounded">
          <ContentTypeIcon type={content.content_type} className="w-5 h-5" />
          <div className="flex-1">
            <h4 className="font-medium">{content.title}</h4>
            <p className="text-sm text-muted-foreground">
              {content.content_type === 'video' && `${Math.round(content.duration_seconds / 60)} min video`}
              {content.content_type === 'reading' && `${content.estimated_time_minutes} min read`}
              {content.content_type === 'interactive' && `Interactive exercise`}
            </p>
          </div>
          <Badge variant="outline">{content.source_type}</Badge>
        </div>
      ))}
    </div>
  );
}
```

---

## 4. User Journey Redesign

### 4.1 Instructor Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       INSTRUCTOR COURSE CREATION FLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CREATE COURSE                                                           │
│     ├── Upload syllabus (PDF/DOCX)                                          │
│     │   └── AI extracts: modules, learning objectives, key concepts         │
│     ├── OR Quick Setup with AI                                              │
│     │   └── Describe course → AI generates structure                        │
│     └── Manual creation (add modules/LOs one by one)                        │
│                                                                             │
│  2. CURATE CONTENT (Per Learning Objective)                                 │
│     ├── [CURRENT] AI finds videos only                                      │
│     │   └── YouTube → Invidious → Khan Academy (broken chain)               │
│     │                                                                       │
│     └── [PROPOSED] AI finds mixed content                                   │
│         ├── Videos: Invidious → Piped → Khan → Archive → YouTube            │
│         ├── Readings: Jina scrapes PDFs, articles, textbook chapters        │
│         └── Interactive: AI generates exercises from LO text                │
│                                                                             │
│  3. REVIEW & APPROVE                                                        │
│     ├── Curation Mode:                                                      │
│     │   ├── full_control: Approve each piece manually                       │
│     │   ├── guided_auto: AI suggests, instructor confirms                   │
│     │   └── hands_off: Auto-approve above quality threshold                 │
│     │                                                                       │
│     └── [NEW] Content Balance Check                                         │
│         ├── "This module has only videos, add a reading?"                   │
│         └── "This LO has no exercises, generate some?"                      │
│                                                                             │
│  4. GENERATE ASSESSMENTS                                                    │
│     ├── AI generates quiz questions per LO                                  │
│     ├── MCQ + short answer types                                            │
│     └── Bloom's taxonomy alignment                                          │
│                                                                             │
│  5. PUBLISH                                                                 │
│     ├── Validation: Has modules? Has content? Has assessments?              │
│     ├── Generate access code                                                │
│     └── Students can now enroll                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Student Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STUDENT LEARNING FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ENROLL                                                                  │
│     ├── Enter access code OR browse public courses                          │
│     └── Course added to dashboard                                           │
│                                                                             │
│  2. LEARN (Per Learning Objective)                                          │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────┐        │
│     │  LEARNING OBJECTIVE: "Understand recursion in programming"  │        │
│     ├─────────────────────────────────────────────────────────────┤        │
│     │                                                             │        │
│     │  CONTENT MIX:                                               │        │
│     │  ┌──────────────────────────────────────────────────────┐  │        │
│     │  │ 📹 Video: "Recursion Explained" (12 min)             │  │        │
│     │  │    └── Micro-checks at 3:00, 7:30, 11:00             │  │        │
│     │  ├──────────────────────────────────────────────────────┤  │        │
│     │  │ 📄 Reading: "Recursive Functions in Python" (8 min)  │  │        │
│     │  │    └── Track scroll progress                         │  │        │
│     │  ├──────────────────────────────────────────────────────┤  │        │
│     │  │ ✏️ Interactive: "Trace this recursive call" (5 min) │  │        │
│     │  │    └── Fill-in-the-blank exercise                    │  │        │
│     │  └──────────────────────────────────────────────────────┘  │        │
│     │                                                             │        │
│     │  PROGRESS: [████████░░] 80% (2/3 content verified)          │        │
│     │                                                             │        │
│     │  [TAKE ASSESSMENT] (unlocked at 100%)                       │        │
│     │                                                             │        │
│     └─────────────────────────────────────────────────────────────┘        │
│                                                                             │
│  3. VERIFY LEARNING                                                         │
│     ├── Complete all content in LO (videos + readings + interactive)        │
│     ├── Pass assessment (70%+ threshold)                                    │
│     └── LO marked as "passed"                                               │
│                                                                             │
│  4. TRACK PROGRESS                                                          │
│     ├── Dashboard shows: modules complete, XP earned, time spent            │
│     ├── Gap analysis updates as skills verified                             │
│     └── Recommendations refresh based on new capabilities                   │
│                                                                             │
│  5. CAREER PLANNING                                                         │
│     ├── [CURRENT] Paste job URL → scrape → AI extract → gap analysis        │
│     │                                                                       │
│     └── [PROPOSED] Search jobs → Active Jobs DB → select → gap analysis     │
│         ├── Real job listings with salary data                              │
│         ├── Pre-structured requirements (no AI extraction needed)           │
│         └── "Apply now" links for measurable outcomes                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Gap Analysis Enhancement with Active Jobs DB

```typescript
// Enhanced dream job discovery flow

// NEW: Search-based job discovery (replaces URL pasting)
export function DreamJobSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const searchJobs = useSearchJobs();

  const handleSearch = () => {
    searchJobs.mutate({
      title: searchQuery,
      skills: userCapabilities, // From user's verified skills
    });
  };

  return (
    <div className="dream-job-search">
      <h2>Find Your Dream Job</h2>
      <p>Search real job listings to see skill gaps</p>

      <div className="search-box">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="e.g., Senior Software Engineer"
        />
        <Button onClick={handleSearch}>
          <Search className="w-4 h-4 mr-2" />
          Search Jobs
        </Button>
      </div>

      {searchJobs.data?.jobs?.map(job => (
        <JobCard
          key={job.id}
          job={job}
          onSelect={() => createDreamJobFromListing(job)}
        />
      ))}
    </div>
  );
}

// Job card shows real data from Active Jobs DB
function JobCard({ job, onSelect }) {
  return (
    <Card className="job-card cursor-pointer hover:border-primary" onClick={onSelect}>
      <CardHeader>
        <CardTitle>{job.title}</CardTitle>
        <CardDescription>{job.company} • {job.location}</CardDescription>
      </CardHeader>
      <CardContent>
        {job.salary_min && job.salary_max && (
          <p className="text-lg font-semibold text-green-600">
            ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {job.requirements?.slice(0, 5).map(req => (
            <Badge key={req} variant="secondary">{req}</Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" asChild>
          <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
            Apply Now <ExternalLink className="w-4 h-4 ml-2" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

## 5. Implementation Roadmap

### Phase 1: Fix Content Discovery (CRITICAL - This Week)

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Fix quota tracking (track on every attempt) | P0 | 2h | Fallbacks will trigger |
| Fix NULL quota default (0 instead of 10000) | P0 | 15m | Invidious used by default |
| Add 403 detection as quota exhaustion | P0 | 1h | Real-time fallback switching |
| Create useSearchEducationalContent hook | P0 | 1h | Frontend can use multi-source |
| Update handleFindAllContent | P1 | 2h | Bulk search works |

**Expected Outcome**: Content discovery success rate 20% → 95%

### Phase 2: API Cost Optimization (This Sprint)

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Set WEB_PROVIDER=jina | P1 | 5m | Save $16-83/mo |
| Create search-jobs function | P1 | 4h | Enable Active Jobs DB |
| Create useSearchJobs hook | P1 | 1h | Frontend job search |
| Update DreamJobsPage with search UI | P1 | 4h | Better UX |

**Expected Outcome**: $0 web scraping cost, real job data

### Phase 3: OpenLLM Integration (At >1K Users)

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Add OpenLLM provider to ai-orchestrator | P2 | 4h | 89% AI cost savings |
| Create task→model routing map | P2 | 2h | Optimize model selection |
| Add fallback to Lovable Gateway | P2 | 2h | Reliability |
| A/B test quality (5% traffic) | P2 | 4h | Validate before full switch |

**Expected Outcome**: AI cost $0.21/user → $0.08/user

### Phase 4: Coursera-Like Content (Next Sprint)

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Add content_type schema migration | P2 | 1h | Enable mixed content |
| Create ReadingViewer component | P2 | 8h | Support readings |
| Create InteractiveExercise component | P2 | 12h | Support exercises |
| Create UnifiedContentPlayer | P2 | 4h | Single interface |
| Update instructor content curation | P2 | 8h | Add readings/exercises |

**Expected Outcome**: Videos + Readings + Interactive (like Coursera)

### Phase 5: Advanced Features (Future)

| Feature | Effort | Value |
|---------|--------|-------|
| Discussion forums | High | Community engagement |
| Certificates | Medium | Completion recognition |
| Peer review | High | Open-ended assessment |
| Deadlines & scheduling | Medium | Structure & accountability |
| Mobile app | Very High | Accessibility |

---

## Summary

### What's Broken Now

1. **Content Discovery**: Fallback chain exists but never triggers (quota tracking bug)
2. **API Costs**: Using expensive options when free alternatives exist
3. **Content Types**: Videos only, missing readings and interactive exercises
4. **Job Discovery**: URL pasting UX when search would be better

### What This Proposal Fixes

| Problem | Solution | Impact |
|---------|----------|--------|
| Zero content found | Fix quota tracking → trigger Invidious/Piped | 95% success rate |
| $16-83/mo Firecrawl | Switch to Jina (FREE) | 100% savings |
| $0.21/user AI | Add OpenLLM (at scale) | 62% savings |
| URL paste for jobs | Active Jobs DB search | Better UX + real data |
| Videos only | Add reading + interactive types | Coursera-like experience |

### Files to Modify

```
CRITICAL (Phase 1):
├── supabase/functions/search-youtube-content/index.ts  # Fix quota tracking
├── supabase/functions/_shared/content-cache.ts         # Fix NULL default
├── src/hooks/useLearningObjectives.ts                  # Add useSearchEducationalContent
└── src/pages/instructor/InstructorCourseDetail.tsx     # Update bulk search

COST OPTIMIZATION (Phase 2):
├── supabase/functions/search-jobs/index.ts             # NEW
├── src/hooks/useJobs.ts                                # NEW
├── supabase/functions/_shared/ai-orchestrator.ts       # Add OpenLLM
└── .env (Supabase secrets)                             # WEB_PROVIDER=jina

COURSERA-LIKE (Phase 4):
├── supabase/migrations/20260112_content_types.sql      # Schema changes
├── src/components/learn/ReadingViewer.tsx              # NEW
├── src/components/learn/InteractiveExercise.tsx        # NEW
└── src/components/learn/UnifiedContentPlayer.tsx       # NEW
```

---

*Proposal Generated: January 11, 2026*
*Based on: Codebase analysis, RESOURCE_ORCHESTRATION_MAP.md validation, Lovable agent findings*
