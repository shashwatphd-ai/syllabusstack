# Batch API Implementation Plan: Replace Queue with Google Batch API

## Executive Summary

Replace the current sequential queue-based slide generation system with Google's Batch API to achieve:
- **50% cost reduction** on AI API calls
- **Simplified architecture** (remove complex queue management)
- **Better user experience** (submit once, track single job)
- **Higher throughput** (no artificial concurrency limits)

---

## Current Architecture (To Be Replaced)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT: Sequential Queue Processing                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User clicks "Generate All Slides"                                          │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────┐                                   │
│  │  process-lecture-queue (queue-bulk) │                                   │
│  │  - Creates 85 records status=pending│                                   │
│  │  - Calls processQueue() in background│                                  │
│  └─────────────────────────────────────┘                                   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────┐                                   │
│  │  processQueue()                     │                                   │
│  │  - MAX_CONCURRENT = 2               │  ◄── BOTTLENECK                   │
│  │  - Picks 2 pending items            │                                   │
│  │  - Calls v3 function for each       │                                   │
│  │  - Waits for completion             │                                   │
│  │  - Repeats until queue empty        │                                   │
│  └─────────────────────────────────────┘                                   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────┐                                   │
│  │  generate-lecture-slides-v3         │                                   │
│  │  - ~2 minutes per slide             │                                   │
│  │  - Updates status to ready/failed   │                                   │
│  └─────────────────────────────────────┘                                   │
│                                                                             │
│  PROBLEMS:                                                                  │
│  - 85 slides × 2 min ÷ 2 concurrent = ~85 minutes minimum                  │
│  - 100% API cost (no batch discount)                                       │
│  - Complex error handling and retry logic                                  │
│  - "Stuck" items block entire queue                                        │
│  - Poor user visibility into progress                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## New Architecture (Google Batch API)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEW: Google Batch API Processing                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User clicks "Generate All Slides"                                          │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────┐                                   │
│  │  submit-batch-slides (NEW)          │                                   │
│  │  1. Fetch all teaching unit data    │                                   │
│  │  2. Build JSONL with all prompts    │                                   │
│  │  3. Submit to Google Batch API      │                                   │
│  │  4. Store batch_job_id in DB        │                                   │
│  │  5. Return immediately to user      │                                   │
│  └─────────────────────────────────────┘                                   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────┐                                   │
│  │  Google Batch API                   │                                   │
│  │  - Processes all 85 requests        │                                   │
│  │  - 50% cost discount                │                                   │
│  │  - Higher rate limits               │                                   │
│  │  - Usually completes in <1 hour     │                                   │
│  └─────────────────────────────────────┘                                   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────┐                                   │
│  │  poll-batch-status (NEW)            │                                   │
│  │  - Called by UI every 30 seconds    │                                   │
│  │  - Checks batch job status          │                                   │
│  │  - When complete: process results   │                                   │
│  │  - Updates lecture_slides records   │                                   │
│  └─────────────────────────────────────┘                                   │
│                                                                             │
│  BENEFITS:                                                                  │
│  - 50% cost savings                                                        │
│  - No queue management needed                                              │
│  - Single job status to track                                              │
│  - No "stuck" items                                                        │
│  - Clear progress visibility                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Changes

### New Table: `batch_jobs`

```sql
-- Migration: Create batch_jobs table for tracking Google Batch API jobs
-- PURPOSE: Store batch job metadata to track bulk slide generation progress
-- WHY: Replaces the complex queue system with a simpler batch tracking model

CREATE TABLE IF NOT EXISTS public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job identification
  google_batch_id TEXT NOT NULL,           -- Google's batch job ID (e.g., "batches/xxx")
  instructor_course_id UUID NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,

  -- Job configuration
  job_type TEXT NOT NULL DEFAULT 'slides' CHECK (job_type IN ('slides', 'audio', 'assessment')),
  total_requests INTEGER NOT NULL,          -- Total number of requests in batch

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',    -- Just submitted to Google
    'processing',   -- Google is processing
    'completed',    -- All done, results processed
    'failed',       -- Job failed
    'partial'       -- Some succeeded, some failed
  )),

  -- Progress (updated from Google API polling)
  succeeded_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- Results location
  output_uri TEXT,                          -- GCS URI for results (if using file-based)

  -- Error tracking
  error_message TEXT,
  failed_request_keys JSONB,                -- Array of request keys that failed

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Request mapping (which teaching_unit_id maps to which request key)
  request_mapping JSONB NOT NULL            -- {"slide_1": "tu_uuid_1", "slide_2": "tu_uuid_2", ...}
);

-- Indexes
CREATE INDEX idx_batch_jobs_course ON public.batch_jobs(instructor_course_id);
CREATE INDEX idx_batch_jobs_status ON public.batch_jobs(status);
CREATE INDEX idx_batch_jobs_google_id ON public.batch_jobs(google_batch_id);

-- RLS
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage their batch jobs" ON public.batch_jobs
  FOR ALL USING (
    instructor_course_id IN (
      SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
    )
  );

-- Update trigger
CREATE TRIGGER batch_jobs_updated_at
  BEFORE UPDATE ON public.batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_lecture_slides_updated_at();
```

### Modify `lecture_slides` Table

```sql
-- Migration: Add batch_job_id reference to lecture_slides
-- PURPOSE: Link individual slides to their parent batch job
-- WHY: Enables tracking which batch job generated each slide

ALTER TABLE public.lecture_slides
  ADD COLUMN IF NOT EXISTS batch_job_id UUID REFERENCES public.batch_jobs(id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_lecture_slides_batch_job ON public.lecture_slides(batch_job_id);

-- Update status enum to include 'batch_pending'
-- This distinguishes between:
--   'pending': Old queue system (being phased out)
--   'batch_pending': Waiting in a batch job
ALTER TABLE public.lecture_slides
  DROP CONSTRAINT IF EXISTS lecture_slides_status_check;

ALTER TABLE public.lecture_slides
  ADD CONSTRAINT lecture_slides_status_check
  CHECK (status IN ('pending', 'batch_pending', 'generating', 'ready', 'published', 'failed'));
```

---

## New Edge Functions

### 1. `submit-batch-slides/index.ts` (NEW)

**Purpose**: Submit all teaching units for a course to Google Batch API

**Flow**:
1. Receive `instructor_course_id` and `teaching_unit_ids[]`
2. Fetch all teaching unit context data
3. Build prompts for each unit (reuse existing prompt logic from v3)
4. Create JSONL request body
5. Submit to Google Batch API
6. Create `batch_jobs` record
7. Create `lecture_slides` records with `status='batch_pending'`
8. Return `batch_job_id` to frontend

**Key Code Structure**:
```typescript
// submit-batch-slides/index.ts
//
// ============================================================================
// BATCH SLIDE SUBMISSION - Google Batch API
// ============================================================================
//
// PURPOSE: Replace queue-based generation with Google Batch API for:
//   - 50% cost reduction
//   - Higher throughput (no MAX_CONCURRENT limit)
//   - Simpler architecture (no queue management)
//
// REPLACES: process-lecture-queue's 'queue-bulk' action
//
// FLOW:
//   1. Fetch teaching unit context for all requested units
//   2. Build prompts (same logic as generate-lecture-slides-v3)
//   3. Create inline batch request (for <1000 items) or JSONL file (for >1000)
//   4. Submit to Google Batch API: POST /v1beta/batches
//   5. Store batch job ID and request mapping in database
//   6. Return immediately - processing happens async on Google's side
//
// IMPORTANT: Keep generate-lecture-slides-v3 for single slide generation
//            This function is ONLY for bulk "Generate All" operations
//
```

### 2. `poll-batch-status/index.ts` (NEW)

**Purpose**: Check batch job status and process results when complete

**Flow**:
1. Receive `batch_job_id`
2. Fetch batch job from database
3. Call Google API to check status
4. Update `batch_jobs` record with progress
5. If completed: fetch results and update `lecture_slides` records
6. Return current status to frontend

**Key Code Structure**:
```typescript
// poll-batch-status/index.ts
//
// ============================================================================
// BATCH STATUS POLLING - Google Batch API
// ============================================================================
//
// PURPOSE: Poll batch job status and process results
//
// REPLACES: process-lecture-queue's 'get-status' action
//
// FLOW:
//   1. Receive batch_job_id from frontend
//   2. Fetch batch_jobs record from database
//   3. Call Google API: GET /v1beta/batches/{batch_id}
//   4. Check job.state: PENDING, RUNNING, SUCCEEDED, FAILED
//   5. Update batch_jobs record with progress counts
//   6. If SUCCEEDED:
//      a. Fetch results from job.output_uri or inline responses
//      b. Parse each response and extract generated slides
//      c. Update corresponding lecture_slides records
//      d. Mark batch_job as 'completed'
//   7. Return status to frontend
//
// POLLING STRATEGY:
//   - Frontend polls every 30 seconds (not 5s like current queue)
//   - Reduces API calls significantly
//   - Google recommends conservative polling
//
```

### 3. Deprecate `process-lecture-queue/index.ts`

**NOT deleted** - kept for backwards compatibility but add deprecation notice:

```typescript
// process-lecture-queue/index.ts
//
// ============================================================================
// DEPRECATED: Queue-based slide generation
// ============================================================================
//
// THIS FUNCTION IS DEPRECATED - Use submit-batch-slides instead
//
// Kept for:
//   - Backwards compatibility during migration
//   - Cleanup of any remaining queued items
//   - 'cleanup-stuck' action still useful
//
// MIGRATION PATH:
//   1. Frontend updated to use submit-batch-slides
//   2. This function processes any remaining queue items
//   3. After migration complete, remove queue-bulk and process-next actions
//   4. Keep cleanup-stuck for legacy stuck items
//
```

---

## Frontend Changes

### 1. New Hook: `useBatchSlides.ts`

```typescript
// src/hooks/useBatchSlides.ts
//
// ============================================================================
// BATCH SLIDES HOOKS - Google Batch API Integration
// ============================================================================
//
// PURPOSE: Replace useBulkQueueSlides and useQueueStatus with batch equivalents
//
// HOOKS:
//   - useSubmitBatchSlides(): Submit all teaching units to batch API
//   - useBatchStatus(): Poll batch job status
//   - useCancelBatch(): Cancel a running batch job
//
// UX IMPROVEMENTS:
//   - Single "Generate All" button submits batch
//   - Progress shows: "Processing 45/85 slides..."
//   - No confusing "2 active, 83 queued" state
//   - Clear completion notification
//

export function useSubmitBatchSlides() {
  // Calls submit-batch-slides edge function
  // Returns batch_job_id for tracking
}

export function useBatchStatus(batchJobId?: string) {
  // Polls poll-batch-status every 30 seconds
  // Returns: { status, succeeded, failed, total }
}
```

### 2. Update `InstructorCourseDetail.tsx`

**Changes**:
1. Replace "Generate All Slides" to call `useSubmitBatchSlides`
2. Replace queue status display with batch status
3. Update progress UI to show batch progress

```tsx
// BEFORE (queue-based):
// "Generating (2 active, 83 queued)"

// AFTER (batch-based):
// "Processing slides... 45/85 complete"
// or
// "Batch submitted - estimated completion: ~30 minutes"
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx_batch_jobs.sql` | CREATE | New batch_jobs table |
| `supabase/functions/submit-batch-slides/index.ts` | CREATE | Submit batch to Google API |
| `supabase/functions/poll-batch-status/index.ts` | CREATE | Poll and process results |
| `supabase/functions/process-lecture-queue/index.ts` | MODIFY | Add deprecation notice, keep cleanup-stuck |
| `src/hooks/useBatchSlides.ts` | CREATE | New batch hooks |
| `src/hooks/useLectureSlides.ts` | MODIFY | Deprecate queue hooks |
| `src/pages/instructor/InstructorCourseDetail.tsx` | MODIFY | Use batch instead of queue |
| `supabase/config.toml` | MODIFY | Add new function entries |

---

## Google Batch API Details

### API Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/batches
```

### Request Format (Inline - for <1000 requests)
```json
{
  "model": "models/gemini-2.5-flash",
  "requests": [
    {
      "key": "slide_tu_uuid_1",
      "request": {
        "contents": [...],
        "systemInstruction": {...},
        "generationConfig": {...}
      }
    },
    {
      "key": "slide_tu_uuid_2",
      "request": {...}
    }
  ]
}
```

### Response Format
```json
{
  "name": "batches/abc123",
  "state": "PENDING|RUNNING|SUCCEEDED|FAILED",
  "totalCount": 85,
  "succeededCount": 45,
  "failedCount": 2
}
```

### Polling Response (when SUCCEEDED)
```json
{
  "name": "batches/abc123",
  "state": "SUCCEEDED",
  "responses": [
    {
      "key": "slide_tu_uuid_1",
      "response": {
        "candidates": [...]
      }
    }
  ]
}
```

---

## Migration Strategy

### Phase 1: Add New System (No Breaking Changes)
1. Create `batch_jobs` table
2. Add `batch_job_id` to `lecture_slides`
3. Create new edge functions
4. Create new frontend hooks
5. **Old system continues working**

### Phase 2: Switch Frontend
1. Update "Generate All Slides" to use batch API
2. Add batch status UI
3. Keep queue fallback for any in-progress items

### Phase 3: Deprecate Queue (After Validation)
1. Remove queue-based generation from UI
2. Add deprecation logs to old endpoints
3. Eventually remove queue code (optional)

---

## Rollback Plan

If batch API has issues:
1. Batch hooks can fallback to queue hooks
2. `process-lecture-queue` still works
3. No data loss (both systems write to `lecture_slides`)

---

## Testing Checklist

- [ ] Submit batch with 5 teaching units
- [ ] Poll status until complete
- [ ] Verify all lecture_slides created correctly
- [ ] Test partial failure (some succeed, some fail)
- [ ] Test batch cancellation
- [ ] Verify 50% cost reduction in billing
- [ ] Load test with 100+ teaching units
- [ ] Verify single-slide generation still works (v3 function)

---

## Cost Comparison

| Scenario | Current Queue | Batch API | Savings |
|----------|---------------|-----------|---------|
| 85 slides | $X | $X × 0.5 | **50%** |
| API calls | 85 individual | 1 batch + polls | **~90%** |
| Time | ~85 minutes | ~30 minutes | **65%** |

---

## Notes for Implementation

1. **Keep `generate-lecture-slides-v3` unchanged** - it's still used for single slide generation when user clicks "Generate" on individual teaching unit

2. **Prompts are identical** - batch uses same prompt building logic, just submitted differently

3. **Image generation consideration** - Batch API may not support `responseModalities: ['IMAGE']`. For slides needing visuals:
   - Option A: Submit text-only batch, generate images separately
   - Option B: Use real-time API only for slides with visuals
   - Recommended: Option A (still 50% savings on text, images are separate)

4. **Error handling** - Batch API handles retries internally. Failed requests are reported in results, not during submission.

5. **GCS requirement** - For >1000 requests, need Google Cloud Storage bucket. For most courses (<1000 teaching units), inline requests work fine.
