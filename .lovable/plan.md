

## Fix: Make Per-LO "Find Content" Use Sync Evaluation (Option B)

### Problem Summary

When clicking "Find Content" on individual learning objectives/modules, the edge function enters **batch mode** (because `ENABLE_BATCH_EVALUATION` defaults to `true`). This saves videos as `pending_evaluation` but never triggers the evaluation step. Only `QuickCourseSetup` explicitly calls `submit-batch-evaluation` afterward.

The result: 170 videos are stuck in `pending_evaluation` with no scores and invisible in the instructor UI.

### Solution

Force **sync mode** for per-LO searches by passing `use_ai_evaluation: true` in the request body AND bypassing the batch flag. The cleanest approach: the edge function should use sync evaluation when the request comes from a per-LO search (not from QuickCourseSetup).

### Changes

#### 1. Edge Function: Add a `force_sync` parameter

**File:** `supabase/functions/_shared/validators/index.ts`

Add `force_sync: z.boolean().optional().default(false)` to `searchYoutubeContentSchema`.

#### 2. Edge Function: Respect `force_sync` in the branching logic

**File:** `supabase/functions/search-youtube-content/index.ts` (line ~806)

Change the batch mode condition from:
```
const enableBatchEvaluation = Deno.env.get('ENABLE_BATCH_EVALUATION') !== 'false';
```
to:
```
const enableBatchEvaluation =
  !force_sync && Deno.env.get('ENABLE_BATCH_EVALUATION') !== 'false';
```

When `force_sync` is true, the function skips batch mode entirely and falls through to the existing sync evaluation path (lines 900-966), which calls `evaluate-content-batch` inline, applies AI scores, and saves matches as `pending` or `auto_approved`.

#### 3. Frontend: Pass `force_sync: true` from per-LO hooks

**File:** `src/hooks/useLearningObjectives.ts` (line ~160)

Add `use_ai_evaluation: true` and `force_sync: true` to the request body in `useSearchYouTubeContent`.

**File:** `src/hooks/useTeachingUnits.ts` (line ~175)

Add `force_sync: true` to the existing request body (it already sends `use_ai_evaluation: true`).

#### 4. Fix the 170 stuck videos (one-time migration)

Run a SQL migration to promote the existing `pending_evaluation` records to `pending` so they become visible in the instructor review queue:

```sql
UPDATE content_matches
SET status = 'pending', match_score = 0.5
WHERE status = 'pending_evaluation';
```

### What stays the same

- `QuickCourseSetup` does NOT pass `force_sync`, so it continues using batch mode and calling `submit-batch-evaluation` itself -- no changes needed there.
- The `ENABLE_BATCH_EVALUATION` env var still works as a global kill-switch if set to `false`.
- The sync evaluation path (lines 900-1072) is already fully implemented and tested -- no new logic needed.

### Flow after fix

```text
Per-LO "Find Content" click
  --> search-youtube-content (force_sync=true)
      --> Discovers ~15 videos
      --> Calls evaluate-content-batch INLINE
      --> Saves with status: auto_approved or pending
      --> Returns total_found + auto_approved_count
  --> Toast: "Found 10 videos, 4 auto-approved"
  --> Instructor sees results immediately
```

