

## Fix: Systematic Image Generation Recovery

### What Happened (Evidence)

The image generation system **worked correctly** for 1,343 images, then the OpenRouter API credits ran out:
- 43 items failed with **HTTP 402 (Payment Required)** on Feb 10, 02:36-03:42
- 50 items failed with **HTTP 403 (Forbidden)** on Feb 10, 23:42-23:51

Once items hit 3 failed attempts, the system correctly stops retrying (to avoid wasting credits on a billing error). But it provides **no recovery path** -- no error message in the UI, no retry button, and clicking "Generate Images" does nothing because it only processes `pending` items, not `failed` ones.

### The Systematic Fix (4 Changes)

#### 1. Database Reset: Unblock the 93 Stuck Items
Reset the 93 failed queue items to `pending` with `attempts = 0` so they can be retried now that credits are available.

```sql
UPDATE image_generation_queue
SET status = 'pending', attempts = 0, error_message = NULL
WHERE status = 'failed';
```

#### 2. "Retry Failed Images" Button with Error Visibility
Add a retry mechanism to the course detail page that:
- Shows the count of failed images AND the reason (e.g., "12 failed: Payment Required")
- Resets failed queue items to `pending` via a backend function call
- Auto-triggers processing after reset

This ensures you never need to chat with me to recover from transient failures.

**File:** `src/pages/instructor/InstructorCourseDetail.tsx`
- Add a "Retry Failed" button next to "Generate Images" when `imageStatus.failed > 0`
- Display the error reason from `image_generation_queue.error_message`

**File:** `src/hooks/useBatchSlides.ts`
- Add a `useRetryFailedImages()` hook that:
  1. Calls a new edge function or uses direct Supabase query to reset failed items
  2. Then triggers `process-batch-images` with `{ continue: true }`

#### 3. Backend: Add Image Queue Reset Endpoint
**File:** `supabase/functions/process-batch-images/index.ts`
- Add a new MODE: `{ reset_failed: true, instructor_course_id }` that resets all `failed` items for a course back to `pending` and then starts processing

This keeps the reset logic server-side (respects RLS, validates ownership) rather than doing raw updates from the frontend.

#### 4. Fix Queue Population for Published Slides
**File:** `supabase/functions/process-batch-images/index.ts`
- In the queue population query (MODE 4), change the filter from `status = 'ready'` to `status IN ('ready', 'published')` so that published slides missing images also get queued

This ensures that if you publish slides before images are done, they don't fall through the cracks.

### What This Gives You as a User

```text
Current Flow (broken):
  Click "Generate Images" --> Nothing happens --> No feedback --> Stuck

Fixed Flow:
  Click "Generate Images" --> Processes pending items
  If items failed --> UI shows "12 failed (Payment Required)"
                  --> "Retry Failed" button appears
                  --> Click retry --> Items reset + processing resumes
  If no items queued --> Auto-populates queue for published slides too
                     --> Processing starts automatically
```

### Risk Assessment

| Change | Risk | Why Safe |
|--------|------|----------|
| DB reset of 93 items | None | Just changes status back to pending |
| Retry button + hook | None | New UI, no existing code modified |
| Reset MODE in edge function | None | Additive -- new request body pattern |
| Published slide query fix | None | Additive -- expands existing filter |

### Files Modified

- `src/pages/instructor/InstructorCourseDetail.tsx` -- add retry button + error display
- `src/hooks/useBatchSlides.ts` -- add `useRetryFailedImages()` hook, update `useImageGenerationStatus` to include error reasons
- `supabase/functions/process-batch-images/index.ts` -- add `reset_failed` MODE, fix published slide query
- Database migration: reset 93 stuck items

