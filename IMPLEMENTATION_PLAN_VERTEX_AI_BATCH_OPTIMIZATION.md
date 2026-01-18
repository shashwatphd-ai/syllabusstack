# VERTEX AI BATCH OPTIMIZATION IMPLEMENTATION PLAN
## SyllabusStack Instructor Pipeline Cost Optimization

**Document Version**: 1.0
**Created**: 2026-01-18
**Status**: Ready for Implementation
**Estimated Total Effort**: 4-6 weeks

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Target State](#3-target-state)
4. [Critical Rules and Constraints](#4-critical-rules-and-constraints)
5. [Implementation Phases Overview](#5-implementation-phases-overview)
6. [Phase 1: Batch Curriculum Decomposition](#6-phase-1-batch-curriculum-decomposition)
7. [Phase 2: Batch Video Evaluation](#7-phase-2-batch-video-evaluation)
8. [Phase 3: Enhanced Prompts](#8-phase-3-enhanced-prompts)
9. [Phase 4: Research Caching](#9-phase-4-research-caching)
10. [Testing Procedures](#10-testing-procedures)
11. [Rollback Procedures](#11-rollback-procedures)
12. [Monitoring and Alerts](#12-monitoring-and-alerts)
13. [Context Window Management for Agents](#13-context-window-management-for-agents)

---

## 1. EXECUTIVE SUMMARY

### 1.1 Problem Statement
The current instructor pipeline makes individual synchronous API calls for curriculum decomposition and video evaluation, resulting in:
- Higher costs (no batch discount)
- Slower processing (sequential calls)
- Rate limit vulnerability (many small requests)

### 1.2 Solution
Implement Vertex AI Batch Prediction for curriculum decomposition and video evaluation, achieving:
- 50% cost reduction on batched operations
- Faster throughput (parallel processing)
- Better reliability (Vertex AI handles retries)

### 1.3 Cost Impact

| Metric | Current | After Optimization | Savings |
|--------|---------|-------------------|---------|
| Cost per syllabus | $3.71 | $3.13 | $0.58 (15.6%) |
| 100 courses/month | $371 | $313 | $58/month |
| 1000 courses/month | $3,710 | $3,130 | $580/month |

### 1.4 Risk Level
**LOW** - All changes are additive with feature flags and automatic fallback to current behavior.

---

## 2. CURRENT STATE ANALYSIS

### 2.1 Pipeline Flow (Current)

```
STAGE 1: Course Creation
    └── INSERT instructor_courses

STAGE 2: Syllabus Processing (process-syllabus)
    ├── Text extraction (Gemini 2.0 Flash) - $0.008
    ├── Domain analysis (Gemini 2.5 Flash) - $0.003
    ├── Structure analysis (Gemini 2.5 Flash) - $0.015
    └── INSERT modules, learning_objectives

STAGE 3: Curriculum Decomposition (curriculum-reasoning-agent)
    ├── TRIGGERED BY: search-youtube-content (lazy)
    ├── MODEL: gemini-3-pro-preview
    ├── COST: $0.052 per LO × 20 LOs = $1.04
    └── INSERT teaching_units

STAGE 4: Content Discovery & Evaluation (search-youtube-content + evaluate-content-batch)
    ├── Video discovery (no AI cost)
    ├── AI evaluation (Gemini 2.5 Flash) - $0.006 per LO × 20 = $0.12
    └── INSERT content, content_matches

STAGE 5: Slide Generation (submit-batch-slides → process-batch-research → poll-batch-status)
    ├── Research grounding (Gemini 2.5 Flash) - $0.003 per unit × 60 = $0.18
    ├── Slide generation (Gemini 3 Pro via Vertex AI Batch) - $0.039 per unit × 60 = $2.34
    └── UPDATE lecture_slides

STAGE 6: Course Publishing
    └── UPDATE instructor_courses.is_published = true
```

### 2.2 Current File Inventory

| File | Purpose | Will Be Modified |
|------|---------|-----------------|
| `supabase/functions/process-syllabus/index.ts` | Syllabus processing | YES (Phase 1) |
| `supabase/functions/curriculum-reasoning-agent/index.ts` | LO decomposition | YES (Phase 3) |
| `supabase/functions/search-youtube-content/index.ts` | Content discovery | YES (Phase 1, 2) |
| `supabase/functions/evaluate-content-batch/index.ts` | Video evaluation | YES (Phase 3) |
| `supabase/functions/submit-batch-slides/index.ts` | Slide batch submission | NO |
| `supabase/functions/process-batch-research/index.ts` | Research + Vertex submission | NO |
| `supabase/functions/poll-batch-status/index.ts` | Batch result processing | NO |
| `supabase/functions/_shared/vertex-ai-batch.ts` | Vertex AI client | NO |
| `supabase/functions/_shared/gcs-client.ts` | GCS operations | NO |
| `src/pages/instructor/QuickCourseSetup.tsx` | Quick setup UI | YES (Phase 1, 2) |

### 2.3 Current Database Schema (Relevant Tables)

> **Note**: This section shows the CURRENT schema BEFORE any optimization changes.
> New columns added by this plan are documented in Section 3.4.

```sql
-- instructor_courses (CURRENT - no changes needed)
CREATE TABLE instructor_courses (
  id UUID PRIMARY KEY,
  instructor_id UUID REFERENCES auth.users,
  title TEXT NOT NULL,
  code TEXT,
  description TEXT,
  syllabus_text TEXT,
  detected_domain TEXT,
  domain_config JSONB,
  is_published BOOLEAN DEFAULT false,
  access_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- learning_objectives (CURRENT - will add curriculum_batch_job_id in Phase 1)
CREATE TABLE learning_objectives (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  instructor_course_id UUID REFERENCES instructor_courses,
  module_id UUID REFERENCES modules,
  text TEXT NOT NULL,
  core_concept TEXT,
  action_verb TEXT,
  bloom_level TEXT CHECK (bloom_level IN ('remember','understand','apply','analyze','evaluate','create')),
  domain TEXT,
  specificity TEXT,
  search_keywords TEXT[],
  expected_duration_minutes INTEGER,
  verification_state TEXT DEFAULT 'unstarted',
  decomposition_status TEXT DEFAULT 'not_started'
    CHECK (decomposition_status IN ('not_started','in_progress','completed','failed')),
  sequence_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
  -- NOTE: curriculum_batch_job_id will be added in Phase 1 migration
);

-- teaching_units (CURRENT - no changes needed)
CREATE TABLE teaching_units (
  id UUID PRIMARY KEY,
  learning_objective_id UUID REFERENCES learning_objectives,
  sequence_order INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  what_to_teach TEXT,
  why_this_matters TEXT,
  how_to_teach TEXT,
  common_misconceptions TEXT[],
  prerequisites TEXT[],
  enables TEXT[],
  target_video_type TEXT,
  target_duration_minutes INTEGER,
  search_queries TEXT[],
  required_concepts TEXT[],
  avoid_terms TEXT[],
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- batch_jobs (CURRENT - job_type constraint will be updated in Phase 1)
CREATE TABLE batch_jobs (
  id UUID PRIMARY KEY,
  instructor_course_id UUID REFERENCES instructor_courses,
  google_batch_id TEXT,
  job_type TEXT CHECK (job_type IN ('slides', 'audio', 'assessment')),  -- Current types
  total_requests INTEGER,
  succeeded_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('preparing','researching','submitted','pending','processing','completed','partial','failed')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
  -- NOTE: job_type constraint will be expanded to include 'curriculum','evaluation' in Phase 1
);

-- content_matches (CURRENT - will add evaluation_batch_job_id in Phase 2)
CREATE TABLE content_matches (
  id UUID PRIMARY KEY,
  learning_objective_id UUID REFERENCES learning_objectives,
  teaching_unit_id UUID REFERENCES teaching_units,
  content_id UUID REFERENCES content,
  match_score DECIMAL,
  ai_reasoning TEXT,
  ai_relevance_score DECIMAL,
  ai_pedagogy_score DECIMAL,
  ai_quality_score DECIMAL,
  ai_recommendation TEXT,
  status TEXT CHECK (status IN ('pending','approved','auto_approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
  -- NOTE: evaluation_batch_job_id will be added in Phase 2 migration
);
```

### 2.4 Environment Variables (Current)

```bash
# Required for Vertex AI
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
GCP_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GCS_BUCKET_NAME=your-bucket-name

# Required for Google AI
GOOGLE_CLOUD_API_KEY=your-api-key

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```

---

## 3. TARGET STATE

### 3.1 Pipeline Flow (After Optimization)

```
STAGE 1: Course Creation (UNCHANGED)
    └── INSERT instructor_courses

STAGE 2: Syllabus Processing (process-syllabus) (MODIFIED)
    ├── Text extraction (Gemini 2.0 Flash) - $0.008
    ├── Domain analysis (Gemini 2.5 Flash) - $0.003
    ├── Structure analysis (Gemini 2.5 Flash) - $0.015
    ├── INSERT modules, learning_objectives
    └── [NEW] Trigger submit-batch-curriculum (async)

STAGE 3: Curriculum Decomposition (NEW: BATCHED)
    ├── submit-batch-curriculum creates batch job
    ├── Vertex AI processes ALL LOs in single job
    ├── poll-batch-curriculum inserts all teaching_units
    ├── MODEL: gemini-3-pro-preview (BATCH)
    └── COST: $0.026 per LO × 20 LOs = $0.52 (50% savings)

STAGE 4: Content Discovery & Evaluation (MODIFIED)
    ├── search-youtube-content discovers videos (no decomposition call)
    ├── [NEW] submit-batch-evaluation batches ALL videos
    ├── Vertex AI evaluates ALL videos in single job
    ├── poll-batch-evaluation updates content_matches
    └── COST: ~$0.06 total (50% savings)

STAGE 5: Slide Generation (UNCHANGED - already optimized)

STAGE 6: Course Publishing (UNCHANGED)
```

### 3.2 New Files to Create

| File | Purpose | Phase |
|------|---------|-------|
| `supabase/functions/submit-batch-curriculum/index.ts` | Submit curriculum batch job | 1 |
| `supabase/functions/poll-batch-curriculum/index.ts` | Process curriculum batch results | 1 |
| `supabase/functions/submit-batch-evaluation/index.ts` | Submit evaluation batch job | 2 |
| `supabase/functions/poll-batch-evaluation/index.ts` | Process evaluation batch results | 2 |

### 3.3 New Environment Variables

```bash
# Feature flags (add to Supabase secrets)
ENABLE_BATCH_CURRICULUM=true
ENABLE_BATCH_EVALUATION=true
ENABLE_RESEARCH_CACHE=true
```

### 3.4 Database Migrations Required

```sql
-- Migration: Add batch job references
ALTER TABLE learning_objectives
ADD COLUMN curriculum_batch_job_id UUID REFERENCES batch_jobs(id);

ALTER TABLE content_matches
ADD COLUMN evaluation_batch_job_id UUID REFERENCES batch_jobs(id);

-- Migration: Update batch_jobs job_type constraint to include new types
-- IMPORTANT: Preserve existing types ('slides', 'audio', 'assessment')
ALTER TABLE batch_jobs
DROP CONSTRAINT IF EXISTS batch_jobs_job_type_check;

ALTER TABLE batch_jobs
ADD CONSTRAINT batch_jobs_job_type_check
CHECK (job_type IN ('slides', 'audio', 'assessment', 'curriculum', 'evaluation'));
```

---

## 4. CRITICAL RULES AND CONSTRAINTS

### 4.1 DO's

| Rule | Reason |
|------|--------|
| DO preserve all existing function signatures | Prevents breaking dependent code |
| DO add feature flags for all new behavior | Enables instant rollback |
| DO implement fallback to current behavior | Ensures reliability |
| DO test in isolation before integration | Catches issues early |
| DO use existing patterns from slide batch | Proven architecture |
| DO log extensively with `[FunctionName]` prefix | Debugging support |
| DO handle all error codes (429, 403, 500) | Robustness |
| DO update batch_jobs status at each step | Progress tracking |
| DO use transactions for bulk inserts | Data consistency |

### 4.2 DON'Ts

| Rule | Reason |
|------|--------|
| DON'T modify vertex-ai-batch.ts | Shared by slides; risk of regression |
| DON'T remove existing curriculum-reasoning-agent | Still needed as fallback |
| DON'T remove existing evaluate-content-batch | Still needed as fallback |
| DON'T change database column types | Migration complexity |
| DON'T hardcode timeouts or limits | Use environment variables |
| DON'T skip error handling for "unlikely" cases | Production reliability |
| DON'T assume batch jobs complete quickly | They can take minutes |
| DON'T poll more frequently than 30 seconds | API rate limits |
| DON'T create batch jobs with 0 requests | Vertex AI error |

### 4.3 Vertex AI Batch Constraints

| Constraint | Value | Handling |
|------------|-------|----------|
| Max requests per batch | 10,000 | Chunk if exceeded |
| Max job duration | 24 hours | Monitor; alert if >1 hour |
| Min requests per batch | 1 | Validate before submission |
| Request format | JSONL | One JSON object per line |
| Output format | JSONL | Parse line by line |
| Global endpoint required for | Gemini 3 preview models | Use requiresGlobalEndpoint() |

### 4.4 GCS Constraints

| Constraint | Value | Handling |
|------------|-------|----------|
| Object name max length | 1024 chars | Use short paths |
| Bucket must exist | Required | Validate in function |
| Service account needs | Storage Object Admin | Verify permissions |

---

## 5. IMPLEMENTATION PHASES OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Batch Curriculum (Week 1-2)                                       │
│  ├── Task 1.1: Database migration                                           │
│  ├── Task 1.2: Create submit-batch-curriculum                               │
│  ├── Task 1.3: Create poll-batch-curriculum                                 │
│  ├── Task 1.4: Modify process-syllabus                                      │
│  ├── Task 1.5: Modify search-youtube-content                                │
│  ├── Task 1.6: Unit tests                                                   │
│  └── Task 1.7: Integration tests                                            │
│                                                                             │
│  PHASE 2: Batch Evaluation (Week 3-4)                                       │
│  ├── Task 2.1: Create submit-batch-evaluation                               │
│  ├── Task 2.2: Create poll-batch-evaluation                                 │
│  ├── Task 2.3: Modify search-youtube-content                                │
│  ├── Task 2.4: Modify QuickCourseSetup.tsx                                  │
│  ├── Task 2.5: Unit tests                                                   │
│  └── Task 2.6: Integration tests                                            │
│                                                                             │
│  PHASE 3: Enhanced Prompts (Week 5)                                         │
│  ├── Task 3.1: Update curriculum-reasoning-agent prompt                     │
│  ├── Task 3.2: Update evaluate-content-batch prompt                         │
│  ├── Task 3.3: A/B testing setup                                            │
│  └── Task 3.4: Quality validation                                           │
│                                                                             │
│  PHASE 4: Research Caching (Week 6)                                         │
│  ├── Task 4.1: Create research_cache table                                  │
│  ├── Task 4.2: Modify process-batch-research                                │
│  ├── Task 4.3: Cache invalidation logic                                     │
│  └── Task 4.4: Performance testing                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. PHASE 1: BATCH CURRICULUM DECOMPOSITION

### 6.1 Overview

**Goal**: Replace lazy per-LO curriculum decomposition with proactive batch processing.

**Current Flow**:
```
search-youtube-content called
  → Check if teaching_units exist for LO
  → If not: Call curriculum-reasoning-agent (sync, expensive)
  → Continue with content search
```

**New Flow**:
```
process-syllabus completes
  → Call submit-batch-curriculum with all LO IDs
  → Batch job created, returns immediately
  → poll-batch-curriculum runs (triggered by cron or polling)
  → All teaching_units created

search-youtube-content called
  → Check if teaching_units exist for LO
  → If not AND batch job pending: Wait or skip
  → If not AND no batch job: Fallback to sync decomposition
  → Continue with content search
```

### 6.2 Task 1.1: Database Migration

**File**: `supabase/migrations/YYYYMMDDHHMMSS_batch_curriculum_support.sql`

**Content**:
```sql
-- Migration: Add batch curriculum support
-- Description: Adds columns to track curriculum batch jobs
-- Rollback: See rollback section at bottom

-- Step 1: Add curriculum_batch_job_id to learning_objectives
ALTER TABLE public.learning_objectives
ADD COLUMN IF NOT EXISTS curriculum_batch_job_id UUID REFERENCES public.batch_jobs(id);

-- Step 2: Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_learning_objectives_curriculum_batch
ON public.learning_objectives(curriculum_batch_job_id)
WHERE curriculum_batch_job_id IS NOT NULL;

-- Step 3: Update batch_jobs constraint to include 'curriculum' and 'evaluation'
-- IMPORTANT: Preserve existing types ('slides', 'audio', 'assessment')
ALTER TABLE public.batch_jobs
DROP CONSTRAINT IF EXISTS batch_jobs_job_type_check;

ALTER TABLE public.batch_jobs
ADD CONSTRAINT batch_jobs_job_type_check
CHECK (job_type IN ('slides', 'audio', 'assessment', 'curriculum', 'evaluation'));

-- Step 4: Add status for curriculum-specific tracking
COMMENT ON COLUMN public.learning_objectives.curriculum_batch_job_id IS
'References the batch job that created teaching units for this LO';

-- ROLLBACK SECTION (run manually if needed):
-- ALTER TABLE public.learning_objectives DROP COLUMN IF EXISTS curriculum_batch_job_id;
-- DROP INDEX IF EXISTS idx_learning_objectives_curriculum_batch;
```

**Verification Checklist**:
- [ ] Migration file created with correct timestamp format
- [ ] Run `supabase db diff` to verify changes
- [ ] Test migration on local database
- [ ] Test rollback on local database
- [ ] Commit migration file

**DO**:
- Use `IF NOT EXISTS` for idempotency
- Include rollback instructions
- Add comments explaining purpose

**DON'T**:
- Don't drop existing constraints without recreating
- Don't modify existing column types
- Don't add NOT NULL without defaults

---

### 6.3 Task 1.2: Create submit-batch-curriculum Function

**File**: `supabase/functions/submit-batch-curriculum/index.ts`

**Purpose**: Creates a Vertex AI batch job to decompose all LOs for a course into teaching units.

**Input**:
```typescript
interface SubmitBatchCurriculumRequest {
  instructor_course_id: string;
  learning_objective_ids?: string[]; // Optional: specific LOs, defaults to all
}
```

**Output**:
```typescript
interface SubmitBatchCurriculumResponse {
  success: boolean;
  batch_job_id: string | null;  // null when no LOs need decomposition
  total_requests: number;
  message: string;
  error?: string;
}
```

**Complete Implementation**:

```typescript
// supabase/functions/submit-batch-curriculum/index.ts
// ============================================================================
// SUBMIT BATCH CURRICULUM - Batch LO Decomposition via Vertex AI
// ============================================================================
//
// PURPOSE: Submit all learning objectives for a course to Vertex AI batch
// prediction for curriculum decomposition into teaching units.
//
// TRIGGER: Called by process-syllabus after LO creation, or manually
//
// FLOW:
//   1. Validate input and permissions
//   2. Fetch all LOs that need decomposition
//   3. Build JSONL batch request
//   4. Upload to GCS
//   5. Create Vertex AI batch job
//   6. Create batch_jobs record
//   7. Update LOs with batch job reference
//   8. Return batch job ID
//
// FALLBACK: If this fails, search-youtube-content will use sync decomposition
//
// ============================================================================

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
import { GCSClient } from '../_shared/gcs-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const MODEL_CONFIG = {
  // Use same model as current curriculum-reasoning-agent for quality parity
  CURRICULUM_MODEL: 'gemini-3-pro-preview',
  // Vertex AI publisher path
  VERTEX_MODEL_PATH: 'publishers/google/models/gemini-3-pro-preview',
};

const BATCH_CONFIG = {
  // Minimum LOs to justify batch (below this, use sync)
  MIN_BATCH_SIZE: 3,
  // Maximum LOs per batch (Vertex AI limit is 10,000)
  MAX_BATCH_SIZE: 500,
  // GCS path prefix
  GCS_PREFIX: 'curriculum-batch',
};

// ============================================================================
// SYSTEM PROMPT (Identical to curriculum-reasoning-agent for consistency)
// ============================================================================

const CURRICULUM_SYSTEM_PROMPT = `You are an expert curriculum designer with deep expertise in pedagogical sequencing, instructional design, and Bloom's Taxonomy. Your task is to decompose high-level learning objectives into teachable micro-concepts that can be taught through individual videos.

CRITICAL RULES:
1. Each teaching unit should represent ONE focused concept that can be taught in a single 5-15 minute video
2. Units must be ordered by prerequisite dependencies - foundational concepts FIRST
3. Search queries must be HIGHLY SPECIFIC to find the exact teaching content needed
4. Think about what a student ACTUALLY needs to learn to achieve the learning objective
5. Generate 3-8 teaching units per learning objective based on complexity

OUTPUT FORMAT: Return valid JSON only, no markdown code blocks or explanations outside the JSON.`;

// ============================================================================
// TYPES
// ============================================================================

interface LearningObjective {
  id: string;
  text: string;
  core_concept: string | null;
  bloom_level: string | null;
  expected_duration_minutes: number | null;
  module_id: string | null;
  instructor_course_id: string;
}

interface ModuleContext {
  id: string;
  title: string;
  description: string | null;
}

interface CourseContext {
  id: string;
  title: string;
  description: string | null;
  syllabus_text: string | null;
  detected_domain: string | null;
}

interface BatchRequest {
  request: {
    contents: Array<{
      role: string;
      parts: Array<{ text: string }>;
    }>;
    systemInstruction?: {
      parts: Array<{ text: string }>;
    };
    generationConfig: {
      temperature: number;
      maxOutputTokens: number;
      responseMimeType: string;
    };
  };
  // Custom metadata for result mapping
  metadata: {
    learning_objective_id: string;
    request_index: number;
  };
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildUserPrompt(
  lo: LearningObjective,
  module: ModuleContext | null,
  course: CourseContext
): string {
  return `TASK: Decompose this learning objective into 3-8 teachable micro-concepts.

LEARNING OBJECTIVE:
"${lo.text}"
${lo.core_concept ? `Core Concept: ${lo.core_concept}` : ''}
${lo.bloom_level ? `Bloom's Level: ${lo.bloom_level}` : ''}
${lo.expected_duration_minutes ? `Expected Duration: ${lo.expected_duration_minutes} minutes` : ''}

CONTEXT:
Course: ${course.title}
${course.description ? `Course Description: ${course.description}` : ''}
${course.detected_domain ? `Domain: ${course.detected_domain}` : ''}
${module ? `Module: ${module.title}` : ''}
${module?.description ? `Module Description: ${module.description}` : ''}
${course.syllabus_text ? `Syllabus Context (first 3000 chars): ${course.syllabus_text.substring(0, 3000)}` : ''}

REQUIRED OUTPUT FORMAT (JSON):
{
  "reasoning_chain": "Step-by-step explanation of how you decomposed this objective",
  "domain_context": "The specific academic/professional field this belongs to",
  "total_estimated_time_minutes": <number>,
  "teaching_units": [
    {
      "sequence_order": 1,
      "title": "Clear, specific title for this micro-concept",
      "description": "2-3 sentence description of what this unit covers",
      "what_to_teach": "Specific knowledge or skill to convey",
      "why_this_matters": "Connection to the overall learning objective",
      "how_to_teach": "Recommended pedagogical approach",
      "common_misconceptions": ["misconception 1", "misconception 2"],
      "prerequisites": ["concept A", "concept B"],
      "enables": ["concept X", "concept Y"],
      "target_video_type": "explainer|tutorial|case_study|worked_example|lecture|demonstration",
      "target_duration_minutes": <5-15>,
      "search_queries": ["specific query 1", "specific query 2", "specific query 3", "specific query 4", "specific query 5"],
      "required_concepts": ["key term 1", "key term 2"],
      "avoid_terms": ["ambiguous term", "outdated term"]
    }
  ]
}

Generate the teaching units now:`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = '[submit-batch-curriculum]';
  console.log(`${functionName} Starting...`);

  try {
    // ========================================================================
    // STEP 0: Check feature flag
    // ========================================================================
    const enableBatchCurriculum = Deno.env.get('ENABLE_BATCH_CURRICULUM') !== 'false';
    if (!enableBatchCurriculum) {
      console.log(`${functionName} Feature disabled, returning`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Batch curriculum is disabled',
          fallback: 'Use curriculum-reasoning-agent directly'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========================================================================
    // STEP 1: Parse request and authenticate
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { instructor_course_id, learning_objective_ids } = await req.json();

    if (!instructor_course_id) {
      throw new Error('instructor_course_id is required');
    }

    console.log(`${functionName} Processing course: ${instructor_course_id}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid authorization');
    }

    // ========================================================================
    // STEP 2: Verify course ownership
    // ========================================================================
    const { data: course, error: courseError } = await supabase
      .from('instructor_courses')
      .select('id, title, description, syllabus_text, detected_domain, instructor_id')
      .eq('id', instructor_course_id)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found: ${instructor_course_id}`);
    }

    if (course.instructor_id !== user.id) {
      throw new Error('Not authorized to modify this course');
    }

    console.log(`${functionName} Course verified: ${course.title}`);

    // ========================================================================
    // STEP 3: Fetch LOs that need decomposition
    // ========================================================================
    let loQuery = supabase
      .from('learning_objectives')
      .select(`
        id, text, core_concept, bloom_level,
        expected_duration_minutes, module_id, instructor_course_id
      `)
      .eq('instructor_course_id', instructor_course_id)
      .in('decomposition_status', ['not_started', 'failed']);

    // If specific LO IDs provided, filter to those
    if (learning_objective_ids && learning_objective_ids.length > 0) {
      loQuery = loQuery.in('id', learning_objective_ids);
    }

    const { data: learningObjectives, error: loError } = await loQuery;

    if (loError) {
      throw new Error(`Failed to fetch learning objectives: ${loError.message}`);
    }

    if (!learningObjectives || learningObjectives.length === 0) {
      console.log(`${functionName} No LOs need decomposition`);
      return new Response(
        JSON.stringify({
          success: true,
          batch_job_id: null,
          total_requests: 0,
          message: 'No learning objectives need decomposition'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${functionName} Found ${learningObjectives.length} LOs to decompose`);

    // Check minimum batch size
    if (learningObjectives.length < BATCH_CONFIG.MIN_BATCH_SIZE) {
      console.log(`${functionName} Below minimum batch size, use sync decomposition`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Only ${learningObjectives.length} LOs, below minimum ${BATCH_CONFIG.MIN_BATCH_SIZE}`,
          fallback: 'Use curriculum-reasoning-agent directly for small batches'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========================================================================
    // STEP 4: Fetch module context for each LO
    // ========================================================================
    const moduleIds = [...new Set(learningObjectives.map(lo => lo.module_id).filter(Boolean))];

    let modules: Record<string, ModuleContext> = {};
    if (moduleIds.length > 0) {
      const { data: moduleData } = await supabase
        .from('modules')
        .select('id, title, description')
        .in('id', moduleIds);

      if (moduleData) {
        modules = Object.fromEntries(moduleData.map(m => [m.id, m]));
      }
    }

    // ========================================================================
    // STEP 5: Build JSONL batch request
    // ========================================================================
    console.log(`${functionName} Building batch request...`);

    const batchRequests: string[] = [];
    // Note: We use metadata.learning_objective_id in each request for result mapping
    // instead of a separate mapping array, which is more reliable for batch processing

    for (let i = 0; i < learningObjectives.length; i++) {
      const lo = learningObjectives[i];
      const module = lo.module_id ? modules[lo.module_id] : null;

      const userPrompt = buildUserPrompt(lo, module, course as CourseContext);

      const request: BatchRequest = {
        request: {
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }]
            }
          ],
          systemInstruction: {
            parts: [{ text: CURRICULUM_SYSTEM_PROMPT }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
          }
        },
        metadata: {
          learning_objective_id: lo.id,
          request_index: i
        }
      };

      batchRequests.push(JSON.stringify(request));
    }

    const jsonlContent = batchRequests.join('\n');
    console.log(`${functionName} Built ${batchRequests.length} requests, ${jsonlContent.length} bytes`);

    // ========================================================================
    // STEP 6: Create batch_jobs record first (for reference)
    // ========================================================================
    const batchJobId = crypto.randomUUID();

    const { error: insertJobError } = await supabase
      .from('batch_jobs')
      .insert({
        id: batchJobId,
        instructor_course_id,
        job_type: 'curriculum',
        total_requests: learningObjectives.length,
        status: 'preparing',
        created_by: user.id
      });

    if (insertJobError) {
      throw new Error(`Failed to create batch job record: ${insertJobError.message}`);
    }

    console.log(`${functionName} Created batch job: ${batchJobId}`);

    // ========================================================================
    // STEP 7: Upload JSONL to GCS
    // ========================================================================
    const gcsClient = new GCSClient();
    const inputPath = `${BATCH_CONFIG.GCS_PREFIX}/${batchJobId}/input.jsonl`;

    try {
      await gcsClient.uploadFile(inputPath, jsonlContent, 'application/jsonl');
      console.log(`${functionName} Uploaded to GCS: ${inputPath}`);
    } catch (gcsError) {
      // Clean up batch job record on GCS failure
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: `GCS upload failed: ${gcsError}` })
        .eq('id', batchJobId);
      throw gcsError;
    }

    // ========================================================================
    // STEP 8: Create Vertex AI batch job
    // ========================================================================
    const vertexClient = new VertexAIBatchClient();
    const bucketName = Deno.env.get('GCS_BUCKET_NAME')!;

    try {
      const batchJob = await vertexClient.createBatchJob({
        displayName: `curriculum-${instructor_course_id.substring(0, 8)}-${Date.now()}`,
        model: MODEL_CONFIG.VERTEX_MODEL_PATH,
        inputUri: `gs://${bucketName}/${inputPath}`,
        outputUriPrefix: `gs://${bucketName}/${BATCH_CONFIG.GCS_PREFIX}/${batchJobId}/output/`
      });

      console.log(`${functionName} Created Vertex AI job: ${batchJob.name}`);

      // Update batch_jobs with Vertex AI job ID
      await supabase
        .from('batch_jobs')
        .update({
          google_batch_id: batchJob.name,
          status: 'submitted'
        })
        .eq('id', batchJobId);

    } catch (vertexError) {
      // Clean up on Vertex AI failure
      await gcsClient.deleteFile(inputPath);
      await supabase
        .from('batch_jobs')
        .update({
          status: 'failed',
          error_message: `Vertex AI job creation failed: ${vertexError}`
        })
        .eq('id', batchJobId);
      throw vertexError;
    }

    // ========================================================================
    // STEP 9: Update LOs with batch job reference
    // ========================================================================
    const loIds = learningObjectives.map(lo => lo.id);

    await supabase
      .from('learning_objectives')
      .update({
        decomposition_status: 'in_progress',
        curriculum_batch_job_id: batchJobId
      })
      .in('id', loIds);

    console.log(`${functionName} Updated ${loIds.length} LOs with batch job reference`);

    // ========================================================================
    // STEP 10: Return success
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        batch_job_id: batchJobId,
        total_requests: learningObjectives.length,
        message: `Batch curriculum job submitted. Call poll-batch-curriculum to check status.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`${functionName} Error:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

**Verification Checklist for Task 1.2**:
- [ ] File created at correct path
- [ ] All imports resolve (test with `deno check`)
- [ ] CORS headers present
- [ ] Feature flag check at start
- [ ] Authorization validation
- [ ] Course ownership verification
- [ ] Minimum batch size check
- [ ] JSONL format correct (one JSON per line)
- [ ] GCS upload error handling with cleanup
- [ ] Vertex AI error handling with cleanup
- [ ] batch_jobs record created before external calls
- [ ] Status transitions: preparing → submitted
- [ ] LOs updated with batch job reference
- [ ] Comprehensive logging with function name prefix

**DO**:
- Copy patterns from submit-batch-slides
- Use same MODEL_CONFIG structure
- Include metadata for result mapping
- Clean up on partial failures

**DON'T**:
- Don't call synchronous AI APIs
- Don't skip error cleanup
- Don't hardcode GCS bucket name
- Don't forget to update LO status

---

### 6.4 Task 1.3: Create poll-batch-curriculum Function

**File**: `supabase/functions/poll-batch-curriculum/index.ts`

**Purpose**: Poll Vertex AI batch job status, download results, parse teaching units, and insert into database.

**Input**:
```typescript
interface PollBatchCurriculumRequest {
  batch_job_id: string;
}
```

**Output**:
```typescript
interface PollBatchCurriculumResponse {
  success: boolean;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  succeeded_count: number;
  failed_count: number;
  teaching_units_created: number;
  message: string;
  error?: string;
}
```

**Complete Implementation**:

```typescript
// supabase/functions/poll-batch-curriculum/index.ts
// ============================================================================
// POLL BATCH CURRICULUM - Process Vertex AI Batch Results
// ============================================================================
//
// PURPOSE: Check Vertex AI batch job status, download results, parse teaching
// units, and insert them into the database.
//
// TRIGGER: Called periodically (cron) or manually after submit-batch-curriculum
//
// FLOW:
//   1. Fetch batch_jobs record
//   2. Get Vertex AI job status
//   3. If complete: Download output from GCS
//   4. Parse JSONL results
//   5. Insert teaching_units
//   6. Update LO decomposition_status
//   7. Update batch_jobs with final status
//
// ============================================================================

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { VertexAIBatchClient, BatchJobState } from '../_shared/vertex-ai-batch.ts';
import { GCSClient } from '../_shared/gcs-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================

interface TeachingUnitFromAI {
  sequence_order: number;
  title: string;
  description: string;
  what_to_teach: string;
  why_this_matters: string;
  how_to_teach: string;
  common_misconceptions: string[];
  prerequisites: string[];
  enables: string[];
  target_video_type: string;
  target_duration_minutes: number;
  search_queries: string[];
  required_concepts: string[];
  avoid_terms: string[];
}

interface AIResponse {
  reasoning_chain: string;
  domain_context: string;
  total_estimated_time_minutes: number;
  teaching_units: TeachingUnitFromAI[];
}

interface BatchResultLine {
  request: any;
  response?: {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  metadata?: {
    learning_objective_id: string;
    request_index: number;
  };
  status?: string;
  error?: any;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = '[poll-batch-curriculum]';
  console.log(`${functionName} Starting...`);

  try {
    // ========================================================================
    // STEP 1: Parse request
    // ========================================================================
    const { batch_job_id } = await req.json();

    if (!batch_job_id) {
      throw new Error('batch_job_id is required');
    }

    console.log(`${functionName} Polling job: ${batch_job_id}`);

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========================================================================
    // STEP 2: Fetch batch_jobs record
    // ========================================================================
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', batch_job_id)
      .single();

    if (jobError || !batchJob) {
      throw new Error(`Batch job not found: ${batch_job_id}`);
    }

    if (batchJob.job_type !== 'curriculum') {
      throw new Error(`Invalid job type: ${batchJob.job_type}, expected 'curriculum'`);
    }

    // Already completed?
    if (['completed', 'partial', 'failed'].includes(batchJob.status)) {
      console.log(`${functionName} Job already in terminal state: ${batchJob.status}`);
      return new Response(
        JSON.stringify({
          success: true,
          status: batchJob.status,
          succeeded_count: batchJob.succeeded_count,
          failed_count: batchJob.failed_count,
          teaching_units_created: batchJob.succeeded_count * 5, // Estimate
          message: `Job already ${batchJob.status}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STEP 3: Get Vertex AI job status
    // ========================================================================
    const vertexClient = new VertexAIBatchClient();
    const vertexStatus = await vertexClient.getBatchJob(batchJob.google_batch_id);

    console.log(`${functionName} Vertex AI status: ${vertexStatus.state}`);

    // Map Vertex state to our status
    const stateMapping: Record<BatchJobState, string> = {
      'JOB_STATE_QUEUED': 'submitted',
      'JOB_STATE_PENDING': 'pending',
      'JOB_STATE_RUNNING': 'processing',
      'JOB_STATE_SUCCEEDED': 'completed',
      'JOB_STATE_FAILED': 'failed',
      'JOB_STATE_CANCELLING': 'processing',
      'JOB_STATE_CANCELLED': 'failed',
      'JOB_STATE_PAUSED': 'processing',
      'JOB_STATE_EXPIRED': 'failed',
      'JOB_STATE_UPDATING': 'processing',
      'JOB_STATE_PARTIALLY_SUCCEEDED': 'partial',
      'JOB_STATE_UNSPECIFIED': 'pending',
    };

    const newStatus = stateMapping[vertexStatus.state] || 'processing';

    // If still processing, just update status and return
    if (!['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_PARTIALLY_SUCCEEDED'].includes(vertexStatus.state)) {
      await supabase
        .from('batch_jobs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', batch_job_id);

      return new Response(
        JSON.stringify({
          success: true,
          status: newStatus,
          succeeded_count: 0,
          failed_count: 0,
          teaching_units_created: 0,
          message: `Job still ${newStatus}, check again later`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STEP 4: Download output from GCS
    // ========================================================================
    if (!vertexStatus.outputInfo?.gcsOutputDirectory) {
      throw new Error('No output directory in Vertex AI response');
    }

    console.log(`${functionName} Downloading results from: ${vertexStatus.outputInfo.gcsOutputDirectory}`);

    const gcsClient = new GCSClient();
    const outputDir = vertexStatus.outputInfo.gcsOutputDirectory;

    // List files in output directory
    const outputFiles = await gcsClient.listFiles(outputDir.replace('gs://', '').split('/').slice(1).join('/'));
    const jsonlFiles = outputFiles.filter(f => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) {
      throw new Error('No JSONL output files found');
    }

    // Download and concatenate all JSONL files
    let allResults: BatchResultLine[] = [];
    for (const file of jsonlFiles) {
      const content = await gcsClient.downloadFile(file);
      const lines = content.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          allResults.push(JSON.parse(line));
        } catch (e) {
          console.warn(`${functionName} Failed to parse line: ${line.substring(0, 100)}`);
        }
      }
    }

    console.log(`${functionName} Downloaded ${allResults.length} results`);

    // ========================================================================
    // STEP 5: Process results and insert teaching units
    // ========================================================================
    let succeededCount = 0;
    let failedCount = 0;
    let teachingUnitsCreated = 0;

    for (const result of allResults) {
      const loId = result.metadata?.learning_objective_id;

      if (!loId) {
        console.warn(`${functionName} Result missing learning_objective_id`);
        failedCount++;
        continue;
      }

      // Check for error
      if (result.status === 'ERROR' || result.error) {
        console.error(`${functionName} Request failed for LO ${loId}:`, result.error);
        failedCount++;

        // Update LO status to failed
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);

        continue;
      }

      // Extract content from response
      const content = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.warn(`${functionName} No content in response for LO ${loId}`);
        failedCount++;
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);
        continue;
      }

      // Parse JSON response (with markdown stripping)
      let aiResponse: AIResponse;
      try {
        let jsonStr = content.trim();

        // Pattern 1: Standard markdown code blocks
        const codeBlockMatch = content.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/s);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonStr = codeBlockMatch[1].trim();
        } else {
          // Pattern 2: Remove leading/trailing backticks
          jsonStr = jsonStr.replace(/^```(?:json|JSON)?\s*\n?/, '');
          jsonStr = jsonStr.replace(/\n?```\s*$/, '');
        }

        // Pattern 3: Final cleanup
        jsonStr = jsonStr.replace(/^`+/, '').replace(/`+$/, '');

        aiResponse = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error(`${functionName} JSON parse error for LO ${loId}:`, parseError);
        failedCount++;
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);
        continue;
      }

      // Validate response has teaching units
      if (!aiResponse.teaching_units || !Array.isArray(aiResponse.teaching_units) || aiResponse.teaching_units.length === 0) {
        console.warn(`${functionName} No teaching units in response for LO ${loId}`);
        failedCount++;
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);
        continue;
      }

      // Insert teaching units
      const teachingUnitsToInsert = aiResponse.teaching_units.map((unit, index) => ({
        id: crypto.randomUUID(),
        learning_objective_id: loId,
        sequence_order: unit.sequence_order || index + 1,
        title: unit.title,
        description: unit.description,
        what_to_teach: unit.what_to_teach,
        why_this_matters: unit.why_this_matters,
        how_to_teach: unit.how_to_teach,
        common_misconceptions: unit.common_misconceptions || [],
        prerequisites: unit.prerequisites || [],
        enables: unit.enables || [],
        target_video_type: unit.target_video_type || 'explainer',
        target_duration_minutes: unit.target_duration_minutes || 10,
        search_queries: unit.search_queries || [],
        required_concepts: unit.required_concepts || [],
        avoid_terms: unit.avoid_terms || [],
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('teaching_units')
        .insert(teachingUnitsToInsert);

      if (insertError) {
        console.error(`${functionName} Insert error for LO ${loId}:`, insertError);
        failedCount++;
        await supabase
          .from('learning_objectives')
          .update({ decomposition_status: 'failed' })
          .eq('id', loId);
        continue;
      }

      // Success!
      succeededCount++;
      teachingUnitsCreated += teachingUnitsToInsert.length;

      await supabase
        .from('learning_objectives')
        .update({ decomposition_status: 'completed' })
        .eq('id', loId);

      console.log(`${functionName} Created ${teachingUnitsToInsert.length} units for LO ${loId}`);
    }

    // ========================================================================
    // STEP 6: Update batch_jobs with final status
    // ========================================================================
    const finalStatus = failedCount === 0 ? 'completed' :
                       succeededCount === 0 ? 'failed' : 'partial';

    await supabase
      .from('batch_jobs')
      .update({
        status: finalStatus,
        succeeded_count: succeededCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', batch_job_id);

    console.log(`${functionName} Completed: ${succeededCount} succeeded, ${failedCount} failed, ${teachingUnitsCreated} units created`);

    // ========================================================================
    // STEP 7: Return result
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        succeeded_count: succeededCount,
        failed_count: failedCount,
        teaching_units_created: teachingUnitsCreated,
        message: `Processed ${succeededCount + failedCount} LOs, created ${teachingUnitsCreated} teaching units`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`${functionName} Error:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        status: 'failed',
        succeeded_count: 0,
        failed_count: 0,
        teaching_units_created: 0,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

**Verification Checklist for Task 1.3**:
- [ ] File created at correct path
- [ ] All imports resolve
- [ ] Handles all Vertex AI job states
- [ ] Downloads all JSONL files from output directory
- [ ] JSON parsing with 3-pattern fallback (copy from poll-batch-status)
- [ ] Teaching units validated before insert
- [ ] LO status updated (completed/failed) for each result
- [ ] batch_jobs updated with final counts
- [ ] Proper handling of partial success
- [ ] Returns meaningful status for polling clients

**DO**:
- Copy JSON parsing patterns from poll-batch-status exactly
- Handle each LO result independently (don't fail all on one error)
- Update statuses incrementally

**DON'T**:
- Don't assume all results will be in one file
- Don't skip validation of teaching unit structure
- Don't leave LOs in 'in_progress' state on completion

---

### 6.5 Task 1.4: Modify process-syllabus Function

**File**: `supabase/functions/process-syllabus/index.ts`

**Change**: Add call to submit-batch-curriculum after successful LO insertion.

**Location**: After line ~640 (after LO batch insert success)

**Code to Add**:

```typescript
// ========================================================================
// NEW: Trigger batch curriculum decomposition (async)
// ========================================================================
const enableBatchCurriculum = Deno.env.get('ENABLE_BATCH_CURRICULUM') !== 'false';

if (enableBatchCurriculum && insertedLOs && insertedLOs.length >= 3) {
  console.log(`[process-syllabus] Triggering batch curriculum decomposition for ${insertedLOs.length} LOs`);

  // Fire and forget - don't block syllabus processing
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/submit-batch-curriculum`, {
    method: 'POST',
    headers: {
      'Authorization': req.headers.get('Authorization') || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instructor_course_id: instructorCourseId,
      learning_objective_ids: insertedLOs.map((lo: any) => lo.id)
    })
  }).then(res => {
    if (res.ok) {
      console.log('[process-syllabus] Batch curriculum job submitted successfully');
    } else {
      console.warn('[process-syllabus] Batch curriculum submission failed, will use sync fallback');
    }
  }).catch(err => {
    console.warn('[process-syllabus] Batch curriculum submission error:', err);
    // Non-blocking - content search will use sync fallback
  });
} else {
  console.log(`[process-syllabus] Skipping batch curriculum: enabled=${enableBatchCurriculum}, LO count=${insertedLOs?.length || 0}`);
}
```

**Verification Checklist for Task 1.4**:
- [ ] Code added AFTER successful LO insertion
- [ ] Feature flag checked before calling
- [ ] Minimum LO count checked (≥3)
- [ ] Fire-and-forget pattern (don't await)
- [ ] Error handling doesn't block main response
- [ ] Auth header forwarded correctly
- [ ] Logged with function name prefix

**DO**:
- Use fetch with .then/.catch (not await) for non-blocking
- Forward authorization header
- Log success/failure for debugging

**DON'T**:
- Don't await the batch submission
- Don't fail the entire syllabus processing if batch fails
- Don't remove any existing code

---

### 6.6 Task 1.5: Modify search-youtube-content Function

**File**: `supabase/functions/search-youtube-content/index.ts`

**Change**: Check if teaching units exist from batch job before calling sync decomposition.

**Location**: Around line 360-397 (teaching units fetch section)

**Replace This Section**:
```typescript
// Old code that always calls curriculum-reasoning-agent if no units
```

**With**:
```typescript
// ========================================================================
// STEP 0.5: Fetch or wait for teaching units
// ========================================================================
let teachingUnits: any[] = [];

// Fetch existing teaching units for this LO
const { data: existingUnits, error: unitsError } = await supabaseClient
  .from('teaching_units')
  .select('*')
  .eq('learning_objective_id', learning_objective_id)
  .order('sequence_order');

if (!unitsError && existingUnits && existingUnits.length > 0) {
  teachingUnits = existingUnits;
  console.log(`[TEACHING UNITS] Found ${teachingUnits.length} existing teaching units`);
} else {
  // No teaching units exist - check if batch job is processing
  const { data: loData } = await supabaseClient
    .from('learning_objectives')
    .select('decomposition_status, curriculum_batch_job_id')
    .eq('id', learning_objective_id)
    .single();

  if (loData?.decomposition_status === 'in_progress' && loData?.curriculum_batch_job_id) {
    // Batch job is processing - inform caller to retry later
    console.log(`[TEACHING UNITS] Batch decomposition in progress for LO ${learning_objective_id}`);
    return new Response(
      JSON.stringify({
        success: false,
        retry_later: true,
        message: 'Teaching unit decomposition in progress, please retry in 30 seconds'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
    );
  }

  // No batch job or batch failed - use sync fallback
  const enableSyncFallback = Deno.env.get('ENABLE_SYNC_CURRICULUM_FALLBACK') !== 'false';

  if (enableSyncFallback) {
    console.log('[TEACHING UNITS] No units found, triggering sync curriculum decomposition...');

    try {
      const decomposeResponse = await fetch(`${supabaseUrl}/functions/v1/curriculum-reasoning-agent`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ learning_objective_id }),
      });

      if (decomposeResponse.ok) {
        const decomposeData = await decomposeResponse.json();
        if (decomposeData.success && decomposeData.teaching_units) {
          teachingUnits = decomposeData.teaching_units;
          console.log(`[TEACHING UNITS] Sync decomposition created ${teachingUnits.length} units`);
        }
      } else {
        console.log('[TEACHING UNITS] Sync decomposition failed, proceeding with LO-level search');
      }
    } catch (decomposeError) {
      console.error('[TEACHING UNITS] Sync decomposition error:', decomposeError);
    }
  } else {
    console.log('[TEACHING UNITS] Sync fallback disabled, proceeding with LO-level search');
  }
}

// If searching for a specific teaching unit, filter to just that one
if (teaching_unit_id) {
  teachingUnits = teachingUnits.filter((u: any) => u.id === teaching_unit_id);
  console.log(`[TEACHING UNITS] Filtering to specific unit: ${teaching_unit_id}`);
}
```

**Verification Checklist for Task 1.5**:
- [ ] Check for existing units first (unchanged)
- [ ] Check decomposition_status before sync fallback
- [ ] Return 202 with retry_later if batch in progress
- [ ] Sync fallback only if enabled AND (no batch OR batch failed)
- [ ] Feature flag for sync fallback
- [ ] All existing logic preserved as fallback
- [ ] No breaking changes to return format

**DO**:
- Return 202 status for "retry later" (not 4xx or 5xx)
- Include retry_later: true in response
- Keep sync fallback as safety net

**DON'T**:
- Don't remove sync fallback entirely
- Don't change response format for success cases
- Don't block indefinitely waiting for batch

---

### 6.7 Task 1.6: Unit Tests

**File**: `supabase/functions/submit-batch-curriculum/index.test.ts`

**Test Cases**:
```typescript
// Test 1: Feature flag disabled
// Expected: Returns 400 with fallback message

// Test 2: Missing instructor_course_id
// Expected: Returns 500 with error message

// Test 3: Course not found
// Expected: Returns 500 with error message

// Test 4: Not course owner
// Expected: Returns 500 with authorization error

// Test 5: No LOs need decomposition
// Expected: Returns 200 with total_requests: 0

// Test 6: Below minimum batch size
// Expected: Returns 400 with fallback message

// Test 7: Successful batch submission
// Expected: Returns 200 with batch_job_id

// Test 8: GCS upload failure
// Expected: batch_jobs status = 'failed', returns 500

// Test 9: Vertex AI failure
// Expected: batch_jobs status = 'failed', GCS cleaned up, returns 500
```

**File**: `supabase/functions/poll-batch-curriculum/index.test.ts`

**Test Cases**:
```typescript
// Test 1: Job not found
// Expected: Returns 500 with error

// Test 2: Wrong job type
// Expected: Returns 500 with error

// Test 3: Job already completed
// Expected: Returns 200 with cached status

// Test 4: Job still processing
// Expected: Returns 200 with status='processing'

// Test 5: Successful completion
// Expected: teaching_units created, LO status='completed'

// Test 6: Partial success
// Expected: Some units created, some LOs failed

// Test 7: JSON parse error in result
// Expected: That LO marked failed, others processed

// Test 8: Empty teaching units in response
// Expected: That LO marked failed
```

---

### 6.8 Task 1.7: Integration Tests

**Test Scenario**: Complete flow from syllabus upload to teaching units creation.

**Steps**:
1. Create test course
2. Upload test syllabus (use fixture with 5 LOs)
3. Call process-syllabus
4. Verify batch job created (status = 'submitted')
5. Poll batch job until complete (max 5 minutes)
6. Verify teaching units created for all LOs
7. Verify LO decomposition_status = 'completed'
8. Clean up test data

**Test Fixture**: Create `test/fixtures/test-syllabus.pdf` with known structure.

---

## 7. PHASE 2: BATCH VIDEO EVALUATION

### 7.1 Overview

**Goal**: Replace per-LO video evaluation calls with a single batch job that evaluates ALL videos across ALL LOs.

**Current Flow**:
```
For each LO:
  search-youtube-content finds 15 videos
  → Call evaluate-content-batch (sync, gemini-2.5-flash)
  → Wait for response
  → Insert scored content_matches
  → Continue to next LO

Total calls: 20 LOs × 1 call = 20 sync API calls
Cost: 20 × $0.006 = $0.12
```

**New Flow**:
```
For each LO:
  search-youtube-content finds 15 videos
  → Insert content_matches with status='pending_evaluation'
  → Skip AI evaluation (mark for batch)

After ALL content discovery completes:
  → UI triggers submit-batch-evaluation
  → Batch ALL 300 videos into single Vertex AI job
  → poll-batch-evaluation updates scores

Total calls: 1 batch job
Cost: $0.06 (50% batch discount)
Savings: $0.06 per syllabus (50%)
```

### 7.2 Task 2.1: Database Migration

**File**: `supabase/migrations/YYYYMMDDHHMMSS_batch_evaluation_support.sql`

**Content**:
```sql
-- Migration: Add batch evaluation support
-- Description: Adds columns to track video evaluation batch jobs
-- Rollback: See rollback section at bottom

-- Step 1: Add evaluation_batch_job_id to content_matches
ALTER TABLE public.content_matches
ADD COLUMN IF NOT EXISTS evaluation_batch_job_id UUID REFERENCES public.batch_jobs(id);

-- Step 2: Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_content_matches_evaluation_batch
ON public.content_matches(evaluation_batch_job_id)
WHERE evaluation_batch_job_id IS NOT NULL;

-- Step 3: Add 'pending_evaluation' status for batch tracking
ALTER TABLE public.content_matches
DROP CONSTRAINT IF EXISTS content_matches_status_check;

ALTER TABLE public.content_matches
ADD CONSTRAINT content_matches_status_check
CHECK (status IN ('pending', 'pending_evaluation', 'approved', 'auto_approved', 'rejected'));

-- Step 4: Add helpful comment
COMMENT ON COLUMN public.content_matches.evaluation_batch_job_id IS
'References the batch job that scored this content match';

-- ROLLBACK SECTION (run manually if needed):
-- ALTER TABLE public.content_matches DROP COLUMN IF EXISTS evaluation_batch_job_id;
-- DROP INDEX IF EXISTS idx_content_matches_evaluation_batch;
```

**Verification Checklist**:
- [ ] Migration file created with correct timestamp format
- [ ] Run `supabase db diff` to verify changes
- [ ] Test migration on local database
- [ ] Test rollback on local database
- [ ] Commit migration file

---

### 7.3 Task 2.2: Create submit-batch-evaluation Function

**File**: `supabase/functions/submit-batch-evaluation/index.ts`

**Purpose**: Creates a Vertex AI batch job to evaluate all pending videos for a course.

**Input**:
```typescript
interface SubmitBatchEvaluationRequest {
  instructor_course_id: string;
  content_match_ids?: string[]; // Optional: specific matches, defaults to all pending
}
```

**Output**:
```typescript
interface SubmitBatchEvaluationResponse {
  success: boolean;
  batch_job_id: string | null;  // null when no videos need evaluation
  total_requests: number;
  message: string;
  error?: string;
}
```

**Complete Implementation**:

```typescript
// supabase/functions/submit-batch-evaluation/index.ts
// ============================================================================
// SUBMIT BATCH EVALUATION - Batch Video Evaluation via Vertex AI
// ============================================================================
//
// PURPOSE: Submit all pending video evaluations for a course to Vertex AI
// batch prediction for scoring and ranking.
//
// TRIGGER: Called by QuickCourseSetup after content discovery completes
//
// FLOW:
//   1. Validate input and permissions
//   2. Fetch all content_matches with status='pending_evaluation'
//   3. Group by LO/teaching unit for context
//   4. Build JSONL batch request
//   5. Upload to GCS
//   6. Create Vertex AI batch job
//   7. Update content_matches with batch job reference
//   8. Return batch job ID
//
// FALLBACK: If this fails, videos can be evaluated individually
//
// ============================================================================

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
import { GCSClient } from '../_shared/gcs-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const MODEL_CONFIG = {
  // Use gemini-2.5-flash for evaluation (consistent with current evaluate-content-batch)
  EVALUATION_MODEL: 'gemini-2.5-flash',
  VERTEX_MODEL_PATH: 'publishers/google/models/gemini-2.5-flash',
};

const BATCH_CONFIG = {
  // Minimum videos to justify batch (below this, use sync)
  MIN_BATCH_SIZE: 10,
  // Maximum videos per batch
  MAX_BATCH_SIZE: 2000,
  // GCS path prefix
  GCS_PREFIX: 'evaluation-batch',
  // Maximum videos per request (to manage token limits)
  MAX_VIDEOS_PER_REQUEST: 15,
};

// ============================================================================
// BLOOM'S TAXONOMY CRITERIA (from evaluate-content-batch)
// ============================================================================

const BLOOM_EVALUATION_CRITERIA: Record<string, string> = {
  remember: "Does this video clearly introduce and explain key facts, definitions, and concepts?",
  understand: "Does this video help explain WHY things work the way they do?",
  apply: "Does this video show HOW to do something step-by-step?",
  analyze: "Does this video break down complex topics into components?",
  evaluate: "Does this video help learners make judgments or decisions?",
  create: "Does this video show how to build or design something new?"
};

// ============================================================================
// SYSTEM PROMPT (identical to evaluate-content-batch)
// ============================================================================

const EVALUATION_SYSTEM_PROMPT = `You are an expert educational content evaluator. Your job is to assess YouTube videos for their pedagogical fit with specific learning objectives. You understand Bloom's Taxonomy deeply and can identify whether a video's teaching approach matches the required cognitive level.

Be honest and critical - not all videos are good matches. A great video for "understanding" might be poor for "applying" the same concept.

Return ONLY valid JSON. No markdown, no code blocks, no explanations.`;

// ============================================================================
// TYPES
// ============================================================================

interface ContentMatchWithContext {
  id: string;
  learning_objective_id: string;
  teaching_unit_id: string | null;
  content_id: string;
  // Joined data
  video_id: string;
  video_title: string;
  video_description: string;
  video_duration_seconds: number;
  channel_name: string;
  // LO context
  lo_text: string;
  lo_bloom_level: string;
  lo_core_concept: string | null;
  // Teaching unit context (if available)
  tu_title: string | null;
  tu_what_to_teach: string | null;
  tu_target_video_type: string | null;
  tu_target_duration_minutes: number | null;
  tu_required_concepts: string[] | null;
}

interface BatchRequest {
  request: {
    contents: Array<{
      role: string;
      parts: Array<{ text: string }>;
    }>;
    systemInstruction?: {
      parts: Array<{ text: string }>;
    };
    generationConfig: {
      temperature: number;
      maxOutputTokens: number;
      responseMimeType: string;
    };
  };
  metadata: {
    content_match_ids: string[];  // May contain multiple IDs per request
    learning_objective_id: string;
    teaching_unit_id: string | null;
    request_index: number;
  };
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildEvaluationPrompt(
  loText: string,
  bloomLevel: string,
  teachingUnit: {
    title: string | null;
    what_to_teach: string | null;
    target_video_type: string | null;
    required_concepts: string[] | null;
  } | null,
  videos: Array<{
    video_id: string;
    title: string;
    description: string;
    duration_minutes: number;
    channel_name: string;
  }>
): string {
  const bloomCriteria = BLOOM_EVALUATION_CRITERIA[bloomLevel] || BLOOM_EVALUATION_CRITERIA.understand;

  const videoListText = videos.map((v, i) =>
    `${i + 1}. VIDEO_ID: ${v.video_id}
   Title: ${v.title}
   Channel: ${v.channel_name}
   Duration: ${v.duration_minutes} minutes
   Description: ${v.description.substring(0, 300)}...`
  ).join('\n\n');

  if (teachingUnit?.title) {
    // Enhanced prompt with teaching unit context
    return `Evaluate these YouTube videos for THIS SPECIFIC micro-concept:

TEACHING UNIT: "${teachingUnit.title}"
WHAT TO TEACH: ${teachingUnit.what_to_teach || 'the specific concept'}
IDEAL VIDEO TYPE: ${teachingUnit.target_video_type || 'explainer'}
${teachingUnit.required_concepts?.length ? `REQUIRED CONCEPTS: ${teachingUnit.required_concepts.join(', ')}` : ''}

OVERALL LEARNING OBJECTIVE: ${loText}
BLOOM'S LEVEL: ${bloomLevel.toUpperCase()}

VIDEOS TO EVALUATE:
${videoListText}

For each video, return JSON with scores 0-100:
{
  "evaluations": [
    {
      "video_id": "VIDEO_ID",
      "relevance_score": 85,
      "pedagogy_score": 72,
      "quality_score": 80,
      "total_score": 79,
      "reasoning": "2-3 sentences on how well it teaches ${teachingUnit.title}",
      "recommendation": "highly_recommended|recommended|acceptable|not_recommended"
    }
  ]
}

Scoring: total = (relevance*0.4) + (pedagogy*0.35) + (quality*0.25)`;
  } else {
    // Standard LO-level prompt
    return `Evaluate these YouTube videos for this learning objective:

LEARNING OBJECTIVE: "${loText}"
BLOOM'S LEVEL: ${bloomLevel.toUpperCase()}
EVALUATION CRITERIA: ${bloomCriteria}

VIDEOS TO EVALUATE:
${videoListText}

For each video, return JSON with scores 0-100:
{
  "evaluations": [
    {
      "video_id": "VIDEO_ID",
      "relevance_score": 85,
      "pedagogy_score": 72,
      "quality_score": 80,
      "total_score": 79,
      "reasoning": "2-3 sentences explaining the scores",
      "recommendation": "highly_recommended|recommended|acceptable|not_recommended"
    }
  ]
}

Scoring: total = (relevance*0.4) + (pedagogy*0.35) + (quality*0.25)`;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = '[submit-batch-evaluation]';
  console.log(`${functionName} Starting...`);

  try {
    // ========================================================================
    // STEP 0: Check feature flag
    // ========================================================================
    const enableBatchEvaluation = Deno.env.get('ENABLE_BATCH_EVALUATION') !== 'false';
    if (!enableBatchEvaluation) {
      console.log(`${functionName} Feature disabled, returning`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Batch evaluation is disabled',
          fallback: 'Videos will be evaluated individually during content search'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========================================================================
    // STEP 1: Parse request and authenticate
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { instructor_course_id, content_match_ids } = await req.json();

    if (!instructor_course_id) {
      throw new Error('instructor_course_id is required');
    }

    console.log(`${functionName} Processing course: ${instructor_course_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid authorization');
    }

    // ========================================================================
    // STEP 2: Verify course ownership
    // ========================================================================
    const { data: course, error: courseError } = await supabase
      .from('instructor_courses')
      .select('id, title, instructor_id')
      .eq('id', instructor_course_id)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found: ${instructor_course_id}`);
    }

    if (course.instructor_id !== user.id) {
      throw new Error('Not authorized to modify this course');
    }

    // ========================================================================
    // STEP 3: Fetch content_matches with full context
    // ========================================================================
    // Build query for content matches that need evaluation
    let query = supabase
      .from('content_matches')
      .select(`
        id,
        learning_objective_id,
        teaching_unit_id,
        content_id,
        content:content_id (
          source_id,
          title,
          description,
          duration_seconds,
          channel_name
        ),
        learning_objectives:learning_objective_id (
          text,
          bloom_level,
          core_concept
        ),
        teaching_units:teaching_unit_id (
          title,
          what_to_teach,
          target_video_type,
          target_duration_minutes,
          required_concepts
        )
      `)
      .eq('status', 'pending_evaluation');

    // Filter to specific content_match_ids if provided
    if (content_match_ids && content_match_ids.length > 0) {
      query = query.in('id', content_match_ids);
    } else {
      // Filter by course via learning_objectives
      query = query.in('learning_objective_id',
        supabase
          .from('learning_objectives')
          .select('id')
          .eq('instructor_course_id', instructor_course_id)
      );
    }

    const { data: pendingMatches, error: matchError } = await query;

    if (matchError) {
      throw new Error(`Failed to fetch content matches: ${matchError.message}`);
    }

    if (!pendingMatches || pendingMatches.length === 0) {
      console.log(`${functionName} No content matches need evaluation`);
      return new Response(
        JSON.stringify({
          success: true,
          batch_job_id: null,
          total_requests: 0,
          message: 'No videos need evaluation'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${functionName} Found ${pendingMatches.length} videos to evaluate`);

    // Check minimum batch size
    if (pendingMatches.length < BATCH_CONFIG.MIN_BATCH_SIZE) {
      console.log(`${functionName} Below minimum batch size, use sync evaluation`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Only ${pendingMatches.length} videos, below minimum ${BATCH_CONFIG.MIN_BATCH_SIZE}`,
          fallback: 'Use evaluate-content-batch directly for small batches'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========================================================================
    // STEP 4: Group by LO/teaching unit and build batch requests
    // ========================================================================
    console.log(`${functionName} Building batch requests...`);

    // Group matches by LO + teaching unit for efficient prompting
    const groupedMatches = new Map<string, ContentMatchWithContext[]>();

    for (const match of pendingMatches) {
      const key = `${match.learning_objective_id}:${match.teaching_unit_id || 'none'}`;
      if (!groupedMatches.has(key)) {
        groupedMatches.set(key, []);
      }

      groupedMatches.get(key)!.push({
        id: match.id,
        learning_objective_id: match.learning_objective_id,
        teaching_unit_id: match.teaching_unit_id,
        content_id: match.content_id,
        video_id: (match as any).content?.source_id || '',
        video_title: (match as any).content?.title || '',
        video_description: (match as any).content?.description || '',
        video_duration_seconds: (match as any).content?.duration_seconds || 0,
        channel_name: (match as any).content?.channel_name || '',
        lo_text: (match as any).learning_objectives?.text || '',
        lo_bloom_level: (match as any).learning_objectives?.bloom_level || 'understand',
        lo_core_concept: (match as any).learning_objectives?.core_concept,
        tu_title: (match as any).teaching_units?.title,
        tu_what_to_teach: (match as any).teaching_units?.what_to_teach,
        tu_target_video_type: (match as any).teaching_units?.target_video_type,
        tu_target_duration_minutes: (match as any).teaching_units?.target_duration_minutes,
        tu_required_concepts: (match as any).teaching_units?.required_concepts,
      });
    }

    // Build batch requests (max 15 videos per request to match current behavior)
    const batchRequests: string[] = [];
    let requestIndex = 0;

    for (const [key, matches] of groupedMatches) {
      // Split large groups into chunks
      for (let i = 0; i < matches.length; i += BATCH_CONFIG.MAX_VIDEOS_PER_REQUEST) {
        const chunk = matches.slice(i, i + BATCH_CONFIG.MAX_VIDEOS_PER_REQUEST);
        const firstMatch = chunk[0];

        const videos = chunk.map(m => ({
          video_id: m.video_id,
          title: m.video_title,
          description: m.video_description,
          duration_minutes: Math.round(m.video_duration_seconds / 60),
          channel_name: m.channel_name,
        }));

        const teachingUnit = firstMatch.tu_title ? {
          title: firstMatch.tu_title,
          what_to_teach: firstMatch.tu_what_to_teach,
          target_video_type: firstMatch.tu_target_video_type,
          required_concepts: firstMatch.tu_required_concepts,
        } : null;

        const userPrompt = buildEvaluationPrompt(
          firstMatch.lo_text,
          firstMatch.lo_bloom_level,
          teachingUnit,
          videos
        );

        const request: BatchRequest = {
          request: {
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }]
              }
            ],
            systemInstruction: {
              parts: [{ text: EVALUATION_SYSTEM_PROMPT }]
            },
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json'
            }
          },
          metadata: {
            content_match_ids: chunk.map(m => m.id),
            learning_objective_id: firstMatch.learning_objective_id,
            teaching_unit_id: firstMatch.teaching_unit_id,
            request_index: requestIndex
          }
        };

        batchRequests.push(JSON.stringify(request));
        requestIndex++;
      }
    }

    const jsonlContent = batchRequests.join('\n');
    console.log(`${functionName} Built ${batchRequests.length} requests for ${pendingMatches.length} videos`);

    // ========================================================================
    // STEP 5: Create batch_jobs record
    // ========================================================================
    const batchJobId = crypto.randomUUID();

    const { error: insertJobError } = await supabase
      .from('batch_jobs')
      .insert({
        id: batchJobId,
        instructor_course_id,
        job_type: 'evaluation',
        total_requests: batchRequests.length,
        status: 'preparing',
        created_by: user.id
      });

    if (insertJobError) {
      throw new Error(`Failed to create batch job record: ${insertJobError.message}`);
    }

    // ========================================================================
    // STEP 6: Upload JSONL to GCS
    // ========================================================================
    const gcsClient = new GCSClient();
    const inputPath = `${BATCH_CONFIG.GCS_PREFIX}/${batchJobId}/input.jsonl`;

    try {
      await gcsClient.uploadFile(inputPath, jsonlContent, 'application/jsonl');
      console.log(`${functionName} Uploaded to GCS: ${inputPath}`);
    } catch (gcsError) {
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed', error_message: `GCS upload failed: ${gcsError}` })
        .eq('id', batchJobId);
      throw gcsError;
    }

    // ========================================================================
    // STEP 7: Create Vertex AI batch job
    // ========================================================================
    const vertexClient = new VertexAIBatchClient();
    const bucketName = Deno.env.get('GCS_BUCKET_NAME')!;

    try {
      const batchJob = await vertexClient.createBatchJob({
        displayName: `evaluation-${instructor_course_id.substring(0, 8)}-${Date.now()}`,
        model: MODEL_CONFIG.VERTEX_MODEL_PATH,
        inputUri: `gs://${bucketName}/${inputPath}`,
        outputUriPrefix: `gs://${bucketName}/${BATCH_CONFIG.GCS_PREFIX}/${batchJobId}/output/`
      });

      console.log(`${functionName} Created Vertex AI job: ${batchJob.name}`);

      await supabase
        .from('batch_jobs')
        .update({
          google_batch_id: batchJob.name,
          status: 'submitted'
        })
        .eq('id', batchJobId);

    } catch (vertexError) {
      await gcsClient.deleteFile(inputPath);
      await supabase
        .from('batch_jobs')
        .update({
          status: 'failed',
          error_message: `Vertex AI job creation failed: ${vertexError}`
        })
        .eq('id', batchJobId);
      throw vertexError;
    }

    // ========================================================================
    // STEP 8: Update content_matches with batch job reference
    // ========================================================================
    const matchIds = pendingMatches.map(m => m.id);

    await supabase
      .from('content_matches')
      .update({ evaluation_batch_job_id: batchJobId })
      .in('id', matchIds);

    console.log(`${functionName} Updated ${matchIds.length} content matches`);

    // ========================================================================
    // STEP 9: Return success
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        batch_job_id: batchJobId,
        total_requests: batchRequests.length,
        total_videos: pendingMatches.length,
        message: `Batch evaluation job submitted. Call poll-batch-evaluation to check status.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`${functionName} Error:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

**Verification Checklist for Task 2.2**:
- [ ] File created at correct path
- [ ] All imports resolve (test with `deno check`)
- [ ] CORS headers present
- [ ] Feature flag check at start
- [ ] Authorization validation
- [ ] Course ownership verification
- [ ] Minimum batch size check
- [ ] Videos grouped by LO/teaching unit
- [ ] Max 15 videos per request (token management)
- [ ] JSONL format correct
- [ ] GCS upload error handling with cleanup
- [ ] Vertex AI error handling with cleanup
- [ ] batch_jobs record created before external calls
- [ ] content_matches updated with batch job reference
- [ ] Comprehensive logging

---

### 7.4 Task 2.3: Create poll-batch-evaluation Function

**File**: `supabase/functions/poll-batch-evaluation/index.ts`

**Purpose**: Poll Vertex AI batch job, download results, parse scores, and update content_matches.

**Complete Implementation** (abbreviated for context - follows same pattern as poll-batch-curriculum):

```typescript
// supabase/functions/poll-batch-evaluation/index.ts
// Similar structure to poll-batch-curriculum, but:
// 1. Updates content_matches instead of teaching_units
// 2. Parses evaluation scores (relevance, pedagogy, quality)
// 3. Sets recommendation field
// 4. Changes status from 'pending_evaluation' to 'pending' (evaluated but not approved)

serve(async (req) => {
  // ... CORS and setup similar to poll-batch-curriculum

  const functionName = '[poll-batch-evaluation]';

  // ... fetch batch_jobs record
  // ... check Vertex AI status
  // ... if complete, download GCS output

  // For each result in JSONL:
  for (const result of allResults) {
    const matchIds = result.metadata?.content_match_ids;

    // Parse evaluations from AI response
    const content = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    const evaluations = JSON.parse(stripMarkdown(content)).evaluations;

    // Update each content_match with its scores
    for (const evaluation of evaluations) {
      const matchId = findMatchIdByVideoId(matchIds, evaluation.video_id);

      await supabase
        .from('content_matches')
        .update({
          ai_relevance_score: evaluation.relevance_score / 100,
          ai_pedagogy_score: evaluation.pedagogy_score / 100,
          ai_quality_score: evaluation.quality_score / 100,
          match_score: evaluation.total_score / 100,
          ai_reasoning: evaluation.reasoning,
          ai_recommendation: evaluation.recommendation,
          status: evaluation.recommendation === 'highly_recommended' ? 'auto_approved' : 'pending'
        })
        .eq('id', matchId);
    }
  }

  // Update batch_jobs with final counts
  // Return result summary
});
```

**Key Differences from poll-batch-curriculum**:
1. Updates `content_matches` table, not `teaching_units`
2. Parses evaluation scores (4 numeric fields + reasoning)
3. Auto-approves highly recommended videos
4. Maps video_id back to content_match_id

---

### 7.5 Task 2.4: Modify search-youtube-content Function

**File**: `supabase/functions/search-youtube-content/index.ts`

**Change**: Skip inline AI evaluation when batch mode is enabled; mark videos for batch.

**Location**: Around line 750-760 (after video discovery, before evaluation call)

**Replace the evaluation section with**:

```typescript
// ========================================================================
// STEP: Evaluate videos (BATCH or SYNC)
// ========================================================================
const enableBatchEvaluation = Deno.env.get('ENABLE_BATCH_EVALUATION') === 'true';

if (enableBatchEvaluation) {
  // BATCH MODE: Skip inline evaluation, mark for batch processing
  console.log(`[BATCH MODE] Skipping inline evaluation for ${discoveredVideos.length} videos`);

  // Insert content_matches with pending_evaluation status
  const contentMatchInserts = discoveredVideos.map((video: any, index: number) => ({
    learning_objective_id: learning_objective_id,
    teaching_unit_id: teaching_unit_id || null,
    content_id: video.content_id,
    status: 'pending_evaluation',
    match_score: null,  // Will be set by batch evaluation
    ai_relevance_score: null,
    ai_pedagogy_score: null,
    ai_quality_score: null,
    ai_reasoning: null,
    ai_recommendation: null,
  }));

  const { data: insertedMatches, error: insertError } = await supabaseClient
    .from('content_matches')
    .insert(contentMatchInserts)
    .select('id');

  if (insertError) {
    console.error('[BATCH MODE] Failed to insert content_matches:', insertError);
    // Fall through to sync evaluation as fallback
  } else {
    console.log(`[BATCH MODE] Created ${insertedMatches?.length} pending evaluations`);

    return new Response(
      JSON.stringify({
        success: true,
        batch_evaluation_pending: true,
        videos_discovered: discoveredVideos.length,
        message: 'Videos discovered and queued for batch evaluation'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// SYNC MODE (fallback or feature flag disabled): Original inline evaluation
console.log(`[SYNC MODE] Evaluating ${discoveredVideos.length} videos inline`);
const evalResponse = await fetch(`${supabaseUrl}/functions/v1/evaluate-content-batch`, {
  // ... existing evaluation call
});
```

**Verification Checklist for Task 2.4**:
- [ ] Feature flag check added
- [ ] New 'pending_evaluation' status used
- [ ] Graceful fallback to sync on error
- [ ] Response indicates batch mode
- [ ] No breaking changes to existing behavior when flag is false

---

### 7.6 Task 2.5: Modify QuickCourseSetup.tsx

**File**: `src/pages/instructor/QuickCourseSetup.tsx`

**Change**: Add evaluation step between content discovery and slide generation.

**Add new UI state and step**:

```tsx
// Add new state
const [evaluationStatus, setEvaluationStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
const [evaluationProgress, setEvaluationProgress] = useState({ succeeded: 0, total: 0 });

// Add evaluation step after content discovery completes
const handleStartEvaluation = async () => {
  setEvaluationStatus('processing');

  try {
    const { data, error } = await supabase.functions.invoke('submit-batch-evaluation', {
      body: { instructor_course_id: courseId }
    });

    if (error || !data.success) {
      throw new Error(error?.message || data.error);
    }

    if (!data.batch_job_id) {
      // No videos need evaluation
      setEvaluationStatus('completed');
      return;
    }

    // Start polling
    pollEvaluationStatus(data.batch_job_id);
  } catch (err) {
    setEvaluationStatus('failed');
    toast.error('Failed to start video evaluation');
  }
};

const pollEvaluationStatus = async (batchJobId: string) => {
  const poll = async () => {
    const { data, error } = await supabase.functions.invoke('poll-batch-evaluation', {
      body: { batch_job_id: batchJobId }
    });

    if (data?.status === 'completed' || data?.status === 'partial') {
      setEvaluationStatus('completed');
      setEvaluationProgress({
        succeeded: data.succeeded_count,
        total: data.succeeded_count + data.failed_count
      });
    } else if (data?.status === 'failed') {
      setEvaluationStatus('failed');
    } else {
      // Still processing, poll again
      setTimeout(poll, 5000);
    }
  };

  poll();
};

// Render evaluation step in UI
{contentDiscoveryComplete && evaluationStatus === 'idle' && (
  <Card>
    <CardHeader>
      <CardTitle>Step 3: Evaluate Content</CardTitle>
      <CardDescription>
        AI will score and rank all discovered videos for pedagogical fit
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button onClick={handleStartEvaluation}>
        <Sparkles className="mr-2 h-4 w-4" />
        Evaluate {pendingVideosCount} Videos
      </Button>
    </CardContent>
  </Card>
)}

{evaluationStatus === 'processing' && (
  <Card>
    <CardContent className="flex items-center gap-3 py-6">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      <span>Evaluating videos with AI...</span>
    </CardContent>
  </Card>
)}
```

---

### 7.7 Task 2.6: Unit Tests

**Test Cases for submit-batch-evaluation**:
```typescript
// Test 1: Feature flag disabled → returns 400
// Test 2: No pending_evaluation videos → returns success with total_requests: 0
// Test 3: Below minimum batch size → returns fallback message
// Test 4: Successful batch submission → returns batch_job_id
// Test 5: Videos grouped correctly by LO/teaching unit
// Test 6: Max 15 videos per request enforced
```

**Test Cases for poll-batch-evaluation**:
```typescript
// Test 1: Scores parsed correctly from AI response
// Test 2: Highly recommended videos auto-approved
// Test 3: Video IDs mapped back to content_match IDs correctly
// Test 4: Partial success handled (some videos scored, some failed)
```

---

## 8. PHASE 3: ENHANCED PROMPTS

### 8.1 Overview

**Goal**: Improve output quality without changing architecture by enhancing prompts with:
- Domain-specific expertise context
- Understanding by Design (UbD) framework for curriculum
- Mayer's multimedia learning principles for evaluation
- Bloom's taxonomy-weighted scoring

**Risk Level**: LOW - Changes are prompt-only, easy to A/B test and rollback.

### 8.2 Task 3.1: Enhanced Curriculum Decomposition Prompt

**File**: `supabase/functions/curriculum-reasoning-agent/index.ts`

**Current Prompt Issues**:
- Generic "curriculum designer" persona
- No grounding in current educational research
- May generate outdated content structures

**Enhanced System Prompt**:

```typescript
const ENHANCED_CURRICULUM_SYSTEM_PROMPT = `You are an expert curriculum designer with 20+ years of experience in instructional design, specializing in backward design (Understanding by Design framework by Wiggins & McTighe).

EXPERTISE:
- Deep knowledge of Bloom's Taxonomy cognitive levels and how to scaffold learning
- Expert in microlearning principles (5-15 minute focused learning chunks)
- Familiar with 2024-2025 industry best practices for online education
- Skilled at identifying prerequisite dependencies between concepts

YOUR APPROACH:
1. Start with the END GOAL - what should the learner be able to DO after this?
2. Work BACKWARD to identify the essential knowledge and skills needed
3. Sequence from simple → complex, concrete → abstract
4. Ensure each micro-unit can stand alone as a 5-15 minute learning experience

CRITICAL RULES:
1. Each teaching unit = ONE focused concept (microlearning principle)
2. Units MUST be ordered by prerequisite dependencies
3. Search queries must be HIGHLY SPECIFIC (not generic terms)
4. Generate 3-8 units based on complexity, not a fixed number
5. Consider common misconceptions and address them proactively

OUTPUT: Return valid JSON only. No markdown, no code blocks.`;
```

**Enhanced User Prompt Additions**:

```typescript
// Add to user prompt
const enhancedContext = `
PEDAGOGICAL CONTEXT:
- This is for a university-level course
- Students will watch videos asynchronously
- Each unit should be completable in one sitting (5-15 min video)
- Consider mobile learners with limited attention spans

BACKWARD DESIGN QUESTIONS TO CONSIDER:
1. What evidence would show the student achieved this learning objective?
2. What knowledge/skills are prerequisites?
3. What common misconceptions might students have?
4. What real-world applications make this relevant?

QUALITY MARKERS FOR GOOD UNITS:
✓ Clear, specific title (not generic)
✓ Search queries that would find actual YouTube videos
✓ Realistic duration estimates
✓ Explicit prerequisite and enables relationships
✓ Specific misconceptions to address
`;
```

**Verification Checklist for Task 3.1**:
- [ ] System prompt updated with UbD framework
- [ ] User prompt includes backward design questions
- [ ] No functional changes, only prompt text
- [ ] Test with 5 sample LOs and compare quality
- [ ] Document quality metrics for A/B comparison

---

### 8.3 Task 3.2: Enhanced Video Evaluation Prompt

**File**: `supabase/functions/evaluate-content-batch/index.ts`

**Current Prompt Issues**:
- Scoring dimensions not weighted by Bloom's level
- No consideration of Mayer's multimedia principles
- No red flag detection (outdated info, incorrect info)

**Enhanced Evaluation Criteria by Bloom's Level**:

```typescript
const ENHANCED_BLOOM_CRITERIA: Record<string, {
  weights: { relevance: number; pedagogy: number; quality: number };
  idealVideoTypes: string[];
  redFlags: string[];
}> = {
  remember: {
    weights: { relevance: 0.5, pedagogy: 0.3, quality: 0.2 },
    idealVideoTypes: ['explainer', 'lecture', 'summary'],
    redFlags: ['outdated terminology', 'factual errors', 'too complex for introduction']
  },
  understand: {
    weights: { relevance: 0.4, pedagogy: 0.4, quality: 0.2 },
    idealVideoTypes: ['explainer', 'animated', 'analogy-based'],
    redFlags: ['no examples', 'abstract without concrete', 'jargon-heavy']
  },
  apply: {
    weights: { relevance: 0.3, pedagogy: 0.5, quality: 0.2 },
    idealVideoTypes: ['tutorial', 'worked-example', 'demonstration'],
    redFlags: ['theory only', 'no hands-on', 'outdated tools/methods']
  },
  analyze: {
    weights: { relevance: 0.4, pedagogy: 0.4, quality: 0.2 },
    idealVideoTypes: ['case-study', 'comparison', 'deep-dive'],
    redFlags: ['surface level', 'no breakdown', 'opinion without evidence']
  },
  evaluate: {
    weights: { relevance: 0.4, pedagogy: 0.35, quality: 0.25 },
    idealVideoTypes: ['debate', 'critique', 'pros-cons'],
    redFlags: ['one-sided', 'no criteria stated', 'emotional without logic']
  },
  create: {
    weights: { relevance: 0.35, pedagogy: 0.45, quality: 0.2 },
    idealVideoTypes: ['project-walkthrough', 'design-process', 'synthesis'],
    redFlags: ['no creative process shown', 'final result only', 'no iteration']
  }
};
```

**Enhanced System Prompt**:

```typescript
const ENHANCED_EVALUATION_SYSTEM_PROMPT = `You are an expert educational content evaluator with deep knowledge of:

1. BLOOM'S TAXONOMY - You understand the cognitive demands at each level
2. MAYER'S MULTIMEDIA PRINCIPLES - You recognize effective video teaching:
   - Coherence: Exclude extraneous material
   - Signaling: Highlight essential material
   - Segmenting: Present in learner-paced segments
   - Modality: Use narration with graphics, not text
   - Personalization: Conversational style is more engaging

3. RED FLAG DETECTION - You identify problematic content:
   - Outdated information (especially in tech/science)
   - Factual inaccuracies
   - Missing prerequisites assumed without explanation
   - Clickbait titles that don't deliver

SCORING CALIBRATION:
- 90-100: Exceptional - would use as primary resource
- 80-89: Excellent - strong recommendation
- 70-79: Good - solid choice with minor gaps
- 60-69: Acceptable - usable but not ideal
- 50-59: Marginal - only if nothing better available
- Below 50: Not recommended - significant issues

Be honest and critical. A 70 is a good score. Reserve 90+ for truly exceptional content.`;
```

---

### 8.4 Task 3.3: A/B Testing Setup

**Create Feature Flag for Prompt Versions**:

```bash
# Environment variable for prompt version
PROMPT_VERSION=v1  # or v2 for enhanced prompts
```

**Logging for Quality Comparison**:

```typescript
// Log prompt version with each request for analysis
console.log(`[curriculum-reasoning-agent] Using prompt version: ${promptVersion}`);
console.log(`[curriculum-reasoning-agent] Generated ${units.length} teaching units for LO ${loId}`);

// Track in ai_usage table
await supabase.from('ai_usage').insert({
  function_name: 'curriculum-reasoning-agent',
  prompt_version: promptVersion,
  input_tokens: inputTokens,
  output_tokens: outputTokens,
  lo_id: loId,
  units_generated: units.length
});
```

**Quality Metrics to Track**:
1. Average teaching units per LO (should be 3-8)
2. Search query specificity (average word count)
3. Prerequisite chain depth
4. User approval rate (if tracked)

---

## 9. PHASE 4: RESEARCH CACHING

### 9.1 Overview

**Goal**: Cache research results from Google Search grounding to avoid redundant API calls for similar topics.

**Current Problem**:
- Each teaching unit triggers a research call (~$0.003)
- Similar units (same topic, different angles) get duplicate searches
- No reuse across courses for common topics

**Solution**:
- Cache research by topic hash
- 7-day TTL for freshness
- ~20-30% reduction in research calls

### 9.2 Task 4.1: Create research_cache Table

**File**: `supabase/migrations/YYYYMMDDHHMMSS_research_cache.sql`

```sql
-- Migration: Add research caching table
-- Description: Cache Google Search grounding results for reuse
-- TTL: 7 days (research needs to stay fresh)

CREATE TABLE IF NOT EXISTS public.research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cache key: hash of normalized search topic
  topic_hash TEXT NOT NULL UNIQUE,

  -- Original search terms (for debugging)
  search_terms TEXT NOT NULL,

  -- Domain context affects search relevance
  domain TEXT,

  -- Cached research content (JSON with sources)
  research_content JSONB NOT NULL,

  -- Token counts for cost tracking
  input_tokens INTEGER,
  output_tokens INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- How many times this cache entry was used
  hit_count INTEGER DEFAULT 0
);

-- Index for fast cache lookups
CREATE INDEX idx_research_cache_topic ON public.research_cache(topic_hash);

-- Index for cache cleanup (expired entries)
CREATE INDEX idx_research_cache_expiry ON public.research_cache(expires_at);

-- Scheduled cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_research_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.research_cache
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE public.research_cache IS 'Caches Google Search grounding results. 7-day TTL. Reduces redundant API calls.';
```

---

### 9.3 Task 4.2: Modify process-batch-research Function

**File**: `supabase/functions/process-batch-research/index.ts`

**Add cache check before research call**:

```typescript
// ============================================================================
// RESEARCH CACHING LOGIC
// ============================================================================

const CACHE_TTL_DAYS = 7;
const enableResearchCache = Deno.env.get('ENABLE_RESEARCH_CACHE') !== 'false';

async function getCachedResearch(
  supabase: SupabaseClient,
  searchTerms: string,
  domain: string | null
): Promise<{ cached: boolean; content: any | null }> {
  if (!enableResearchCache) {
    return { cached: false, content: null };
  }

  // Normalize and hash the search terms
  const normalized = searchTerms.toLowerCase().trim().replace(/\s+/g, ' ');
  const topicHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${normalized}:${domain || 'general'}`)
  ).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  );

  // Check cache
  const { data: cached, error } = await supabase
    .from('research_cache')
    .select('research_content')
    .eq('topic_hash', topicHash)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached && !error) {
    // Update hit count (async, don't await)
    supabase
      .from('research_cache')
      .update({ hit_count: supabase.raw('hit_count + 1') })
      .eq('topic_hash', topicHash);

    console.log(`[CACHE HIT] Research for: ${searchTerms.substring(0, 50)}...`);
    return { cached: true, content: cached.research_content };
  }

  return { cached: false, content: null };
}

async function cacheResearch(
  supabase: SupabaseClient,
  searchTerms: string,
  domain: string | null,
  content: any,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  if (!enableResearchCache) return;

  const normalized = searchTerms.toLowerCase().trim().replace(/\s+/g, ' ');
  const topicHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${normalized}:${domain || 'general'}`)
  ).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  await supabase
    .from('research_cache')
    .upsert({
      topic_hash: topicHash,
      search_terms: searchTerms,
      domain,
      research_content: content,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      expires_at: expiresAt.toISOString()
    }, { onConflict: 'topic_hash' });

  console.log(`[CACHE SET] Research for: ${searchTerms.substring(0, 50)}...`);
}

// ============================================================================
// INTEGRATION POINT: In runResearchAgent function
// ============================================================================

async function runResearchAgent(briefData: any, domainConfig: any): Promise<any> {
  const searchTerms = briefData.title + ' ' + (briefData.key_concepts || []).join(' ');
  const domain = domainConfig?.detected_domain;

  // Check cache first
  const { cached, content } = await getCachedResearch(supabase, searchTerms, domain);
  if (cached) {
    return content;
  }

  // Cache miss - call research API
  const researchResult = await callGoogleSearchGrounding(searchTerms, domainConfig);

  // Cache the result (async, don't block)
  cacheResearch(
    supabase,
    searchTerms,
    domain,
    researchResult,
    researchResult.inputTokens,
    researchResult.outputTokens
  ).catch(err => console.warn('[CACHE] Failed to cache research:', err));

  return researchResult;
}
```

---

### 9.4 Task 4.3: Cache Invalidation Logic

**Invalidation Triggers**:
1. Manual: Admin can clear cache for a domain
2. TTL: Automatic 7-day expiry
3. Domain config change: Clear domain-specific cache when config updates

**Add to domain config update handler**:

```typescript
// When domain_config is updated, invalidate related cache
async function onDomainConfigUpdate(courseId: string, newDomainConfig: any) {
  const domain = newDomainConfig?.detected_domain;
  if (domain) {
    await supabase
      .from('research_cache')
      .delete()
      .eq('domain', domain);

    console.log(`[CACHE] Invalidated cache for domain: ${domain}`);
  }
}
```

---

### 9.5 Task 4.4: Cache Performance Metrics

**Dashboard Query**:

```sql
-- Cache hit rate (last 7 days)
SELECT
  COUNT(*) FILTER (WHERE hit_count > 0) as entries_with_hits,
  SUM(hit_count) as total_hits,
  COUNT(*) as total_entries,
  ROUND(SUM(hit_count)::numeric / NULLIF(COUNT(*), 0), 2) as avg_hits_per_entry
FROM research_cache
WHERE created_at > now() - interval '7 days';

-- Estimated cost savings
SELECT
  SUM(hit_count) * 0.003 as estimated_savings_usd
FROM research_cache
WHERE created_at > now() - interval '7 days';
```

---

## 10. TESTING PROCEDURES

### 10.1 Pre-Deployment Checklist

```
[ ] All new functions pass deno check
[ ] All unit tests pass
[ ] Integration tests pass on staging
[ ] Feature flags set to false in production
[ ] Rollback procedure documented and tested
[ ] Monitoring alerts configured
[ ] Cost tracking updated
```

### 10.2 Staged Rollout

```
Stage 1: Enable for 1 test course (manual)
Stage 2: Enable for 10% of new courses (random)
Stage 3: Enable for 50% of new courses
Stage 4: Enable for all new courses
Stage 5: Backfill existing courses (optional)
```

### 10.3 Validation Metrics

| Metric | Expected | Alert Threshold |
|--------|----------|-----------------|
| Batch success rate | >95% | <90% |
| Average batch time | <5 min | >10 min |
| Cost per syllabus | <$3.50 | >$4.00 |
| Teaching units per LO | 3-8 | <2 or >10 |

---

## 11. ROLLBACK PROCEDURES

### 11.1 Instant Rollback (Feature Flags)

```bash
# Disable batch curriculum
supabase secrets set ENABLE_BATCH_CURRICULUM=false

# Disable batch evaluation
supabase secrets set ENABLE_BATCH_EVALUATION=false

# Enable sync fallbacks (should already be true)
supabase secrets set ENABLE_SYNC_CURRICULUM_FALLBACK=true
```

### 11.2 Function Rollback

```bash
# Revert to previous version
git checkout HEAD~1 -- supabase/functions/process-syllabus/index.ts
git checkout HEAD~1 -- supabase/functions/search-youtube-content/index.ts

# Redeploy
supabase functions deploy process-syllabus
supabase functions deploy search-youtube-content
```

### 11.3 Database Rollback

```sql
-- Remove batch job references (safe - nullable columns)
UPDATE learning_objectives SET curriculum_batch_job_id = NULL;
UPDATE content_matches SET evaluation_batch_job_id = NULL;

-- Mark in-progress batch jobs as failed
UPDATE batch_jobs
SET status = 'failed', error_message = 'Rollback - feature disabled'
WHERE status IN ('preparing', 'submitted', 'pending', 'processing')
AND job_type IN ('curriculum', 'evaluation');

-- Reset LO decomposition status for failed batch jobs
UPDATE learning_objectives
SET decomposition_status = 'not_started'
WHERE decomposition_status = 'in_progress';
```

---

## 12. MONITORING AND ALERTS

### 12.1 Metrics to Track

| Metric | Source | Alert Condition |
|--------|--------|-----------------|
| Batch job failure rate | batch_jobs table | >10% in 1 hour |
| Average batch duration | batch_jobs timestamps | >10 minutes |
| Cost per course | ai_usage table | >$5 |
| Sync fallback rate | Logs | >20% |
| API error rate (429/403) | Logs | >5 in 5 minutes |

### 12.2 Dashboard Queries

```sql
-- Batch job success rate (last 24 hours)
SELECT
  job_type,
  COUNT(*) FILTER (WHERE status = 'completed') as succeeded,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'partial') as partial,
  ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*) * 100, 2) as success_rate
FROM batch_jobs
WHERE created_at > now() - interval '24 hours'
GROUP BY job_type;

-- Average batch duration by type
SELECT
  job_type,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) / 60 as avg_minutes
FROM batch_jobs
WHERE status IN ('completed', 'partial', 'failed')
AND created_at > now() - interval '7 days'
GROUP BY job_type;
```

---

## 13. CONTEXT WINDOW MANAGEMENT FOR AGENTS

### 13.1 Breaking Down Implementation Sessions

Each implementation session should focus on ONE task to avoid context overflow:

```
Session 1: Task 1.1 (Migration) - ~2000 tokens
Session 2: Task 1.2 (submit-batch-curriculum) - ~8000 tokens
Session 3: Task 1.3 (poll-batch-curriculum) - ~6000 tokens
Session 4: Task 1.4 (Modify process-syllabus) - ~1500 tokens
Session 5: Task 1.5 (Modify search-youtube-content) - ~2000 tokens
Session 6: Task 1.6-1.7 (Tests) - ~4000 tokens
```

### 13.2 Session Start Checklist

At the start of each session, the implementing agent should:

1. Read this document (Section 6 for Phase 1)
2. Read the specific task section
3. Read the target file (if modifying)
4. Read related shared files only if needed
5. Implement the task
6. Run verification checklist
7. Commit with descriptive message

### 13.3 Files to Read Per Task

| Task | Files to Read First |
|------|---------------------|
| 1.1 | This doc (6.2), existing migrations |
| 1.2 | This doc (6.3), submit-batch-slides, vertex-ai-batch.ts, gcs-client.ts |
| 1.3 | This doc (6.4), poll-batch-status, vertex-ai-batch.ts |
| 1.4 | This doc (6.5), process-syllabus (lines 600-700) |
| 1.5 | This doc (6.6), search-youtube-content (lines 350-420) |

### 13.4 Commit Message Format

```
[Phase X.Y] Brief description

- Bullet point of what was done
- Another bullet point

Verification:
- [ ] Checklist item 1
- [ ] Checklist item 2
```

---

## APPENDIX A: ENVIRONMENT VARIABLE REFERENCE

```bash
# Existing (Required)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
GCP_PROJECT_ID=your-project
GCP_REGION=us-central1
GCP_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GCS_BUCKET_NAME=your-bucket
GOOGLE_CLOUD_API_KEY=xxx

# New Feature Flags (Add these)
ENABLE_BATCH_CURRICULUM=true          # Phase 1
ENABLE_BATCH_EVALUATION=true          # Phase 2
ENABLE_SYNC_CURRICULUM_FALLBACK=true  # Always true for safety
ENABLE_RESEARCH_CACHE=true            # Phase 4
```

---

## APPENDIX B: QUICK REFERENCE COMMANDS

```bash
# Deploy single function
supabase functions deploy submit-batch-curriculum

# Deploy all modified functions
supabase functions deploy process-syllabus submit-batch-curriculum poll-batch-curriculum search-youtube-content

# Run migrations
supabase db push

# Set feature flag
supabase secrets set ENABLE_BATCH_CURRICULUM=true

# Check logs
supabase functions logs submit-batch-curriculum --tail

# Run local tests
deno test supabase/functions/submit-batch-curriculum/index.test.ts
```

---

## APPENDIX C: TROUBLESHOOTING

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Batch job stays in 'preparing' | GCS upload failed | Check GCS permissions, bucket exists |
| Batch job stays in 'submitted' | Vertex AI not processing | Check GCP quotas, service account |
| Teaching units not created | poll-batch-curriculum not called | Set up cron or manual poll |
| Sync fallback always used | Feature flag false | Check ENABLE_BATCH_CURRICULUM |
| 403 errors | Service account permissions | Grant Vertex AI User role |
| 429 errors | Rate limit | Implement backoff, reduce batch size |

---

**END OF IMPLEMENTATION PLAN**
