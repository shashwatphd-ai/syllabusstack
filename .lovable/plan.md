
# Plan: Batch Pipeline Alignment with Individual v3 Quality

## Executive Summary

This plan addresses the root causes of why batch-generated slides differ from individual v3 slides in terms of missing images, missing citations, and content quality differences.

---

## Technical Analysis: Why Batch Output Differs from v3

### Issue 1: Images Not Generating (CRITICAL)

**Root Cause:** In `poll-batch-status/index.ts` at lines 789-804, when slides are updated to `ready` status, the `batch_job_id` field is NOT included in the update. The update uses `.eq('teaching_unit_id', teachingUnitId)` but doesn't preserve `batch_job_id: batchJob.id`.

**Impact:** After the update, when the image queue population code at lines 862-867 queries for slides with `.eq('batch_job_id', batchJob.id)`, it finds 0 results because all those slides now have `batch_job_id = NULL`.

```text
Current update (line 789-804):
  .update({
    slides: formattedSlides,
    status: 'ready',
    // batch_job_id NOT preserved!
  })
  .eq('teaching_unit_id', teachingUnitId)
```

---

### Issue 2: Research Context Structure Mismatch (CRITICAL)

**v3 Structure (`generate-lecture-slides-v3/index.ts` lines 106-125):**
```text
ResearchContext {
  topic: string;
  grounded_content: {      // Frontend expects THIS
    claim: string;
    source_url: string;
    source_title: string;
    confidence: number;
  }[];
  recommended_reading: {...}[];
  visual_descriptions: {...}[];
}
```

**Batch Structure (`process-batch-research/index.ts` lines 227-238):**
```text
ResearchContext {
  grounding_sources: {...}[];  // Different field name!
  key_facts: string[];
  current_developments: string[];
  expert_perspectives: string[];
  statistics: string[];
  case_studies: string[];
}
```

**Impact:** The frontend LectureSlideViewer extracts citations from `research_context.grounded_content`. Batch slides have `grounding_sources` instead, so citations don't render.

---

### Issue 3: Research Merging Differences

**v3 (`generate-lecture-slides-v3/index.ts` lines 546-577):**
- Uses `grounded_content` array with source attribution
- Includes `[Source N]` citation markers with full URLs
- Adds `recommended_reading` section
- Adds `visual_descriptions` with exact framework structures
- Has explicit "CITATION RULES" enforcement

**Batch (`process-batch-research/index.ts` lines 464-496):**
- Uses simplified `grounding_sources` (title, url, snippet only)
- Uses `key_facts` (plain strings, no source attribution)
- Uses `statistics`, `case_studies` (no URLs)
- Missing `recommended_reading` and `visual_descriptions` entirely

---

### Issue 4: Missing Metadata Fields

| Field | v3 (Line 1176-1180) | Batch (Line 789-804) |
|-------|---------------------|----------------------|
| `quality_score` | Calculated dynamically (70+) | Not set |
| `is_research_grounded` | `researchContext.grounded_content.length > 0` | Not set |
| `citation_count` | `researchContext.grounded_content.length` | Not set |
| `research_context` | Full v3 structure | Not passed through |

---

### Issue 5: Model Configuration

**Current State:**
- v3: Uses `google/gemini-3-flash-preview` via OpenRouter
- Batch: Uses `MODEL_CONFIG.GEMINI_PRO` = `gemini-3-pro-preview` via Vertex

**Requested Change:** Align batch to use `gemini-3-flash-preview` via Vertex.

---

## Implementation Tasks

### Task 1: Preserve batch_job_id in poll-batch-status

**File:** `supabase/functions/poll-batch-status/index.ts`

**Location:** Lines 789-804

**Change:** Add `batch_job_id: batchJob.id` to the update query:

```text
await supabase
  .from('lecture_slides')
  .update({
    slides: formattedSlides,
    total_slides: formattedSlides.length,
    status: 'ready',
    error_message: null,
    batch_job_id: batchJob.id,  // ADD THIS LINE
    // ... rest of fields
  })
  .eq('teaching_unit_id', teachingUnitId);
```

---

### Task 2: Align Research Context Structure

**File:** `supabase/functions/process-batch-research/index.ts`

**Location:** Lines 227-238 (interface) and Lines 380-394 (transformation)

**Changes:**

1. Update the `ResearchContext` interface to match v3:

```text
interface ResearchContext {
  topic: string;
  grounded_content: Array<{
    claim: string;
    source_url: string;
    source_title: string;
    confidence: number;
  }>;
  recommended_reading: Array<{
    title: string;
    url: string;
    type: 'Academic' | 'Industry' | 'Case Study' | 'Documentation';
  }>;
  visual_descriptions: Array<{
    framework_name: string;
    description: string;
    elements: string[];
  }>;
}
```

2. Update the transformation logic at lines 380-394:

```text
// Transform to v3-compatible format (NOT simplified batch format)
const research: ResearchContext = {
  topic: unitData.title,
  grounded_content: result.grounded_content.map(gc => ({
    claim: gc.claim,
    source_url: gc.source_url,
    source_title: gc.source_title,
    confidence: gc.confidence || 0.8,
  })),
  recommended_reading: result.recommended_reading || [],
  visual_descriptions: result.visual_descriptions || [],
};
```

---

### Task 3: Update mergeResearchIntoBrief for Batch

**File:** `supabase/functions/process-batch-research/index.ts`

**Location:** Lines 464-496

**Change:** Replace the simplified merger with v3-style research merging that includes citation markers, recommended reading, and visual descriptions.

---

### Task 4: Add Missing Metadata Fields to Batch

**File:** `supabase/functions/poll-batch-status/index.ts`

**Location:** Lines 789-804

**Changes:** Add v3 parity fields to the update:

```text
// Calculate quality score (same logic as v3)
const avgSpeakerNotesLength = formattedSlides.reduce(
  (sum, s) => sum + (s.speaker_notes?.length || 0), 0
) / formattedSlides.length;

let qualityScore = 70;
if (avgSpeakerNotesLength > 500) qualityScore += 10;
if (formattedSlides.some(s => s.type === 'misconception')) qualityScore += 5;
if (formattedSlides.some(s => s.content?.definition)) qualityScore += 5;

// Get research from teaching unit (passed during batch)
// NOTE: Requires Task 5 to pass research data through

await supabase
  .from('lecture_slides')
  .update({
    // ... existing fields ...
    batch_job_id: batchJob.id,
    quality_score: qualityScore,
    is_research_grounded: hasResearch,
    citation_count: researchContext?.grounded_content?.length || 0,
    research_context: hasResearch ? researchContext : null,
  })
  .eq('teaching_unit_id', teachingUnitId);
```

---

### Task 5: Pass Research Context Through Pipeline

**Problem:** Research is gathered in `process-batch-research` but is NOT available in `poll-batch-status` when slides are saved.

**Solution:** Store research data in the `batch_jobs` table.

**Database Migration Required:**
```sql
ALTER TABLE batch_jobs 
ADD COLUMN IF NOT EXISTS research_data JSONB;

COMMENT ON COLUMN batch_jobs.research_data IS 
  'Research context data keyed by teaching_unit_id for v3 parity';
```

**File:** `supabase/functions/process-batch-research/index.ts`

After running research (around line 931), save research to batch_jobs:

```text
// Save research data to batch_jobs for poll-batch-status
const researchDataMap: Record<string, ResearchContext> = {};
for (const { unitId, research } of researchResults) {
  researchDataMap[unitId] = research;
}

await supabase
  .from('batch_jobs')
  .update({ research_data: researchDataMap })
  .eq('id', batch_job_id);
```

**File:** `supabase/functions/poll-batch-status/index.ts`

Retrieve research when processing completed batch:

```text
// Get research data from batch job
const researchContext = batchJob.research_data?.[teachingUnitId];
const hasResearch = researchContext?.grounded_content?.length > 0;
```

---

### Task 6: Update Model to Gemini 3 Flash

**File:** `supabase/functions/process-batch-research/index.ts`

**Location:** Line 62

**Change:**
```text
// FROM:
const BATCH_MODEL = MODEL_CONFIG.GEMINI_PRO;

// TO:
const BATCH_MODEL = MODEL_CONFIG.GEMINI_3_FLASH;  // gemini-3-flash-preview
```

**Also update poll-batch-status.ts line 796:**
```text
// FROM:
generation_model: MODEL_CONFIG.GEMINI_PRO,

// TO:
generation_model: MODEL_CONFIG.GEMINI_3_FLASH,
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/poll-batch-status/index.ts` | Add batch_job_id preservation, add quality_score/is_research_grounded/citation_count/research_context, update generation_model |
| `supabase/functions/process-batch-research/index.ts` | Update ResearchContext interface to v3 format, update transformation logic, update mergeResearchIntoBrief, save research_data to batch_jobs, change BATCH_MODEL to GEMINI_3_FLASH |

---

## Database Migration

Add `research_data` column to `batch_jobs` table:

```sql
ALTER TABLE batch_jobs 
ADD COLUMN IF NOT EXISTS research_data JSONB;

COMMENT ON COLUMN batch_jobs.research_data IS 
  'Research context data keyed by teaching_unit_id for v3 parity';
```

---

## Testing Checklist

After implementation:
- Verify `batch_job_id` is preserved after `processCompletedBatch()` runs
- Confirm image queue populates correctly (check `image_generation_queue` table)
- Verify images generate for batch slides using `gemini-3-pro-image-preview`
- Confirm `is_research_grounded = true` when research exists
- Verify citation markers `[Source 1]`, `[Source 2]` appear in batch slide content
- Confirm `quality_score` displays in UI
- Verify `research_context` has `grounded_content` array (not `grounding_sources`)
- Test model is `gemini-3-flash-preview` via Vertex AI

---

## Expected Outcome

After these changes, batch-generated slides will have:
- Proper citation markers with hover tooltips showing source URLs
- Images generated via gemini-3-pro-image-preview (same as v3)
- Quality scores calculated dynamically
- Research context in v3-compatible format
- Full feature and quality parity with individual slide generation
