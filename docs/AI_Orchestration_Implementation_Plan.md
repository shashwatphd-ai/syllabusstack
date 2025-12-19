# EduThree AI Orchestration - Implementation Plan

## Executive Summary

This document outlines the implementation plan to bridge the gap between the EduThree Technical Specification v3.0 and the current implementation. The current system uses Lovable AI Gateway as a single provider, while the spec envisions a multi-model orchestration layer with embeddings, fallback logic, and structured output schemas.

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Centralized Schema Definitions | ✅ Complete |
| Phase 2 | Enhanced AI Orchestrator with Fallback | ✅ Complete |
| Phase 3 | Keyword-Based Similarity Search | ✅ Complete |
| Phase 4 | Usage & Cost Tracking Enhancement | ⏳ Pending |
| Phase 5 | Semantic Search Integration | ⏳ Pending |

---

## Current State Analysis

### What's Working ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Edge Functions | ✅ Complete | All 4 functions deployed and functional |
| Lovable AI Integration | ✅ Complete | Using `google/gemini-2.5-flash` via gateway |
| Caching Layer | ✅ Complete | `ai_cache` + `job_requirements_cache` tables |
| Usage Tracking | ✅ Complete | `ai_usage` table with cost estimation |
| Function Calling | ✅ Complete | Structured output via OpenAI-compatible tools |
| Prompts Library | ✅ Complete | Comprehensive prompts in `prompts.ts` |
| Error Handling | ✅ Complete | 429/402 rate limit handling |

### What's Missing ❌

| Component | Gap | Impact |
|-----------|-----|--------|
| Embeddings | `generateEmbedding()` returns `null` | No semantic search capabilities |
| Multi-Model Routing | Single model only | No task-optimized model selection |
| Fallback Logic | No primary/fallback pattern | Single point of failure |
| Vector Search | pgvector tables exist but unused | No similarity matching |
| Structured Schemas | Inline in each function | No centralized schema definitions |

---

## Implementation Phases

### Phase 1: Centralized Schema Definitions (Priority: High)
**Estimated Effort: 4 hours**

#### 1.1 Create Schema Library File

Create `supabase/functions/_shared/schemas.ts` with all structured output schemas:

```typescript
// supabase/functions/_shared/schemas.ts

export const SCHEMAS = {
  // Syllabus Extraction Schema
  SYLLABUS_EXTRACTION: {
    name: "extract_capabilities",
    description: "Extract capabilities from a course syllabus",
    parameters: {
      type: "object",
      properties: {
        capabilities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Capability using 'Can do X' format" },
              category: { 
                type: "string", 
                enum: ["technical", "analytical", "communication", "leadership", "creative", "research", "interpersonal"]
              },
              proficiency_level: { 
                type: "string", 
                enum: ["beginner", "intermediate", "advanced", "expert"]
              },
              evidence_type: { type: "string" }
            },
            required: ["name", "category", "proficiency_level"]
          }
        },
        course_themes: { type: "array", items: { type: "string" } },
        tools_learned: { type: "array", items: { type: "string" } }
      },
      required: ["capabilities"]
    }
  },

  // Job Requirements Schema
  JOB_REQUIREMENTS: {
    name: "extract_requirements",
    description: "Extract comprehensive job requirements",
    parameters: {
      type: "object",
      properties: {
        requirements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              skill_name: { type: "string" },
              importance: { type: "string", enum: ["critical", "important", "nice_to_have"] },
              category: { type: "string", enum: ["technical", "analytical", "communication", "leadership", "creative", "research", "interpersonal", "certification", "education"] }
            },
            required: ["skill_name", "importance", "category"]
          }
        },
        description: { type: "string" },
        salary_range: { type: "string" },
        day_one_capabilities: { type: "array", items: { type: "object" } },
        differentiators: { type: "array", items: { type: "string" } },
        common_misconceptions: { type: "array", items: { type: "string" } },
        realistic_bar: { type: "string" }
      },
      required: ["requirements", "day_one_capabilities"]
    }
  },

  // Gap Analysis Schema
  GAP_ANALYSIS: {
    name: "gap_analysis_result",
    description: "Return the comprehensive gap analysis results",
    parameters: {
      type: "object",
      properties: {
        match_score: { type: "number" },
        strong_overlaps: { type: "array", items: { type: "object" } },
        critical_gaps: { type: "array", items: { type: "object" } },
        partial_overlaps: { type: "array", items: { type: "object" } },
        honest_assessment: { type: "string" },
        readiness_level: { 
          type: "string", 
          enum: ["ready_to_apply", "3_months_away", "6_months_away", "1_year_away", "needs_significant_development"] 
        },
        interview_readiness: { type: "string" },
        job_success_prediction: { type: "string" },
        priority_gaps: { type: "array", items: { type: "object" } },
        anti_recommendations: { type: "array", items: { type: "string" } }
      },
      required: ["match_score", "strong_overlaps", "critical_gaps", "honest_assessment", "readiness_level", "priority_gaps"]
    }
  },

  // Recommendations Schema
  RECOMMENDATIONS: {
    name: "generate_recommendations",
    description: "Generate comprehensive, actionable learning recommendations",
    parameters: {
      type: "object",
      properties: {
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              type: { type: "string", enum: ["project", "course", "certification", "action", "reading"] },
              description: { type: "string" },
              why_this_matters: { type: "string" },
              gap_addressed: { type: "string" },
              steps: { type: "array", items: { type: "object" } },
              provider: { type: "string" },
              url: { type: "string" },
              duration: { type: "string" },
              effort_hours: { type: "number" },
              cost: { type: "number" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              evidence_created: { type: "string" },
              how_to_demonstrate: { type: "string" }
            },
            required: ["title", "type", "description", "why_this_matters", "priority"]
          }
        },
        anti_recommendations: { type: "array", items: { type: "object" } },
        learning_path_summary: { type: "string" }
      },
      required: ["recommendations"]
    }
  }
};
```

#### 1.2 Verification Criteria
- [ ] All schemas extracted and centralized
- [ ] Edge functions updated to import from schemas.ts
- [ ] No duplicate schema definitions
- [ ] TypeScript types generated from schemas

---

### Phase 2: Enhanced AI Orchestrator (Priority: High)
**Estimated Effort: 8 hours**

#### 2.1 Model Configuration

Update `ai-orchestrator.ts` with proper model routing:

```typescript
// Model configuration for different tasks
export const MODEL_CONFIG = {
  // Lovable AI Gateway models
  GEMINI_FLASH: 'google/gemini-2.5-flash',      // Fast, cost-effective
  GEMINI_FLASH_LITE: 'google/gemini-2.5-flash-lite', // Fastest
  GEMINI_PRO: 'google/gemini-2.5-pro',          // Complex reasoning
  GPT5: 'openai/gpt-5',                         // Premium quality
  GPT5_MINI: 'openai/gpt-5-mini',               // Balanced
};

// Task-to-model mapping with fallbacks
export const TASK_MODEL_MAP: Record<AITaskType, { primary: string; fallback: string }> = {
  syllabus_extraction: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GEMINI_PRO 
  },
  capability_analysis: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GPT5_MINI 
  },
  job_requirements: { 
    primary: MODEL_CONFIG.GEMINI_PRO,   // Needs reasoning
    fallback: MODEL_CONFIG.GPT5 
  },
  gap_analysis: { 
    primary: MODEL_CONFIG.GEMINI_PRO,   // Complex comparison
    fallback: MODEL_CONFIG.GPT5 
  },
  recommendations: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GPT5_MINI 
  },
  embedding: { 
    primary: MODEL_CONFIG.GEMINI_FLASH_LITE, 
    fallback: MODEL_CONFIG.GEMINI_FLASH 
  }
};
```

#### 2.2 Implement Fallback Logic

```typescript
export async function callAIWithFallback(
  request: AIRequest,
  supabase?: SupabaseClient,
  userId?: string
): Promise<AIResponse> {
  const { primary, fallback } = TASK_MODEL_MAP[request.task];
  
  try {
    // Try primary model
    return await callAI({ ...request, model: primary }, supabase, userId);
  } catch (error) {
    console.error(`Primary model ${primary} failed, trying fallback ${fallback}:`, error);
    
    // Try fallback model
    return await callAI({ ...request, model: fallback }, supabase, userId);
  }
}
```

#### 2.3 Verification Criteria
- [ ] Fallback logic implemented and tested
- [ ] Cost tracking per model
- [ ] Latency monitoring per model
- [ ] Error rates tracked per model

---

### Phase 3: Embeddings Implementation (Priority: Medium)
**Estimated Effort: 6 hours**

#### 3.1 Implement Text Embeddings

The Lovable AI Gateway doesn't provide a direct embeddings endpoint, so we'll use a text-based similarity approach or implement embeddings via model output:

```typescript
// Option A: Use model to generate embedding-like representation
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    // Use Gemini to create a semantic fingerprint
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Extract key semantic concepts from the text. Output as JSON array of 50 weighted terms: [{term, weight}]. Weight 0-1."
          },
          { role: "user", content: text.slice(0, 2000) } // Limit input
        ],
        tools: [{
          type: "function",
          function: {
            name: "semantic_extraction",
            parameters: {
              type: "object",
              properties: {
                concepts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      term: { type: "string" },
                      weight: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "semantic_extraction" } }
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;

    const parsed = JSON.parse(toolCall.function.arguments);
    // Convert to pseudo-embedding (normalized weights)
    return parsed.concepts?.map((c: any) => c.weight) || null;
  } catch (e) {
    console.error('Embedding generation failed:', e);
    return null;
  }
}

// Option B: Keyword-based similarity (simpler, no AI cost)
export function generateKeywordVector(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just']);
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 100);
}

export function calculateSimilarity(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;
  return union > 0 ? intersection / union : 0; // Jaccard similarity
}
```

#### 3.2 Database Updates

```sql
-- Add keyword arrays for text-based similarity (alternative to pgvector)
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS capability_keywords TEXT[] DEFAULT '{}';

ALTER TABLE public.dream_jobs 
ADD COLUMN IF NOT EXISTS requirements_keywords TEXT[] DEFAULT '{}';

-- Create function for keyword similarity
CREATE OR REPLACE FUNCTION keyword_similarity(arr1 TEXT[], arr2 TEXT[])
RETURNS FLOAT AS $$
DECLARE
  intersection_count INTEGER;
  union_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO intersection_count FROM unnest(arr1) a WHERE a = ANY(arr2);
  SELECT COUNT(DISTINCT elem) INTO union_count FROM (SELECT unnest(arr1) AS elem UNION SELECT unnest(arr2)) sub;
  IF union_count = 0 THEN RETURN 0; END IF;
  RETURN intersection_count::FLOAT / union_count::FLOAT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### 3.3 Verification Criteria
- [ ] Embedding/similarity function returns valid results
- [ ] Database columns added
- [ ] Similarity search working
- [ ] Performance acceptable (< 500ms for similarity queries)

---

### Phase 4: Usage & Cost Tracking Enhancement (Priority: Medium)
**Estimated Effort: 4 hours**

#### 4.1 Enhanced Cost Tracking

```typescript
// Accurate cost per 1M tokens for Lovable AI Gateway models
export const MODEL_COSTS = {
  'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-flash-lite': { input: 0.0375, output: 0.15 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'openai/gpt-5': { input: 5.00, output: 15.00 },
  'openai/gpt-5-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-5-nano': { input: 0.10, output: 0.40 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['google/gemini-2.5-flash'];
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
}
```

#### 4.2 Usage Dashboard Data

```typescript
// Add to ai-cache.ts
export async function getUserUsageStats(
  supabase: SupabaseClient, 
  userId: string,
  days: number = 30
): Promise<{
  total_cost: number;
  total_requests: number;
  by_function: Record<string, { count: number; cost: number }>;
  by_model: Record<string, { count: number; cost: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since);

  const stats = {
    total_cost: 0,
    total_requests: 0,
    by_function: {} as Record<string, { count: number; cost: number }>,
    by_model: {} as Record<string, { count: number; cost: number }>,
  };

  (data || []).forEach(row => {
    stats.total_cost += row.cost_usd || 0;
    stats.total_requests += 1;

    if (!stats.by_function[row.function_name]) {
      stats.by_function[row.function_name] = { count: 0, cost: 0 };
    }
    stats.by_function[row.function_name].count += 1;
    stats.by_function[row.function_name].cost += row.cost_usd || 0;

    if (!stats.by_model[row.model_used]) {
      stats.by_model[row.model_used] = { count: 0, cost: 0 };
    }
    stats.by_model[row.model_used].count += 1;
    stats.by_model[row.model_used].cost += row.cost_usd || 0;
  });

  return stats;
}
```

#### 4.3 Verification Criteria
- [ ] Cost calculations accurate
- [ ] Usage stats endpoint working
- [ ] Frontend displays usage data
- [ ] Alerts for high usage

---

### Phase 5: Semantic Search Integration (Priority: Low)
**Estimated Effort: 8 hours**

#### 5.1 Implement Capability Matching

```typescript
// supabase/functions/_shared/similarity.ts

export async function findSimilarCapabilities(
  supabase: SupabaseClient,
  targetKeywords: string[],
  userId: string,
  limit: number = 10
): Promise<Array<{ capability: any; similarity: number }>> {
  // Get user's capabilities with keywords
  const { data: capabilities } = await supabase
    .from('capabilities')
    .select('*, courses(title)')
    .eq('user_id', userId);

  if (!capabilities) return [];

  // Calculate similarity scores
  const scored = capabilities.map(cap => {
    const capKeywords = generateKeywordVector(cap.name + ' ' + (cap.category || ''));
    const similarity = calculateSimilarity(targetKeywords, capKeywords);
    return { capability: cap, similarity };
  });

  // Sort by similarity and return top matches
  return scored
    .filter(s => s.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

export async function findJobMatches(
  supabase: SupabaseClient,
  userCapabilityKeywords: string[],
  limit: number = 5
): Promise<Array<{ job: any; matchScore: number }>> {
  // Get all jobs from cache
  const { data: jobs } = await supabase
    .from('job_requirements_cache')
    .select('*')
    .order('query_count', { ascending: false })
    .limit(50);

  if (!jobs) return [];

  const scored = jobs.map(job => {
    const jobKeywords = generateKeywordVector(
      job.job_query_normalized + ' ' + job.requirements_text
    );
    const matchScore = calculateSimilarity(userCapabilityKeywords, jobKeywords) * 100;
    return { job, matchScore };
  });

  return scored
    .filter(s => s.matchScore > 10)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
```

#### 5.2 Verification Criteria
- [ ] Similar capability search returns relevant results
- [ ] Job matching provides reasonable scores
- [ ] Performance within acceptable limits
- [ ] Results improve gap analysis quality

---

## Implementation Timeline

```
Week 1: Phases 1 & 2 (Foundation)
├── Day 1-2: Centralize schemas (Phase 1)
├── Day 3-4: Enhanced orchestrator (Phase 2.1-2.2)
└── Day 5: Testing & validation

Week 2: Phase 3 (Embeddings Alternative)
├── Day 1-2: Implement keyword-based similarity
├── Day 3: Database updates
└── Day 4-5: Integration & testing

Week 3: Phases 4 & 5 (Enhancement)
├── Day 1-2: Enhanced cost tracking (Phase 4)
├── Day 3-4: Semantic search (Phase 5)
└── Day 5: End-to-end testing
```

---

## Technical Decisions

### Decision 1: Lovable AI vs Multi-Provider

**Recommendation: Stay with Lovable AI Gateway**

Rationale:
- ✅ Pre-configured API key (no user secrets needed)
- ✅ Access to Gemini Pro for complex reasoning
- ✅ Access to GPT-5 family if needed
- ✅ Unified error handling and rate limiting
- ❌ No direct embedding endpoint (workaround needed)

### Decision 2: Vector Embeddings vs Keyword Similarity

**Recommendation: Implement keyword-based similarity first**

Rationale:
- ✅ No additional AI calls needed
- ✅ Simpler to debug and understand
- ✅ Works with existing database
- ✅ Can upgrade to true embeddings later
- ❌ Less semantic understanding

### Decision 3: Fallback Strategy

**Recommendation: Implement model fallback within Lovable AI**

```
Primary: gemini-2.5-flash → Fallback: gemini-2.5-pro → Final: gpt-5-mini
```

Rationale:
- ✅ Cost-optimized (cheapest first)
- ✅ All models available via same gateway
- ✅ No additional API keys needed

---

## Testing Strategy

### Unit Tests
- [ ] Schema validation
- [ ] Cost calculation accuracy
- [ ] Keyword extraction
- [ ] Similarity scoring

### Integration Tests
- [ ] Full syllabus → capabilities flow
- [ ] Full job → requirements flow
- [ ] Gap analysis with real data
- [ ] Recommendations generation

### Performance Tests
- [ ] Response time < 5s for all AI calls
- [ ] Similarity search < 500ms
- [ ] Cache hit rate > 50% for job requirements

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| AI call success rate | > 99% | ~95% |
| Average response time | < 3s | ~4s |
| Cache hit rate | > 40% | ~20% |
| Cost per user/month | < $0.10 | ~$0.15 |
| Fallback activation rate | < 5% | N/A |

---

## Files to Create/Modify

### New Files
1. `supabase/functions/_shared/schemas.ts` - Centralized schemas
2. `supabase/functions/_shared/similarity.ts` - Similarity functions
3. `supabase/functions/get-usage-stats/index.ts` - Usage stats endpoint

### Modified Files
1. `supabase/functions/_shared/ai-orchestrator.ts` - Add fallback logic
2. `supabase/functions/_shared/ai-cache.ts` - Enhanced tracking
3. `supabase/functions/analyze-syllabus/index.ts` - Use centralized schema
4. `supabase/functions/analyze-dream-job/index.ts` - Use centralized schema
5. `supabase/functions/gap-analysis/index.ts` - Use centralized schema
6. `supabase/functions/generate-recommendations/index.ts` - Use centralized schema

### Database Migrations
1. Add `capability_keywords` column to courses
2. Add `requirements_keywords` column to dream_jobs
3. Create `keyword_similarity` function

---

## Next Steps

1. **Review this plan** - Confirm approach and priorities
2. **Phase 1 Implementation** - Centralize schemas
3. **Phase 2 Implementation** - Enhanced orchestrator with fallbacks
4. **Iterative Testing** - Validate each phase before proceeding
