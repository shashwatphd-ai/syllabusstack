

## Problem: "Queued" Slides Are Stuck Forever

### What's Happening

The "Queued" badge on teaching unit cards means the slide record exists in the database with `status = 'pending'`. There are currently **27 slides stuck in this state**, some for over 8 days.

The root cause: the old queue worker (`process-lecture-queue`) that picked up pending slides and generated them was deprecated, but **nothing replaced it for processing orphan pending items**. The new batch pipeline only handles slides it creates through `submit-batch-slides`.

### Current State

```text
Pending slides: 27 (oldest: Feb 3, 8+ days ago)
Failed slides:  12
Ready slides:  176
Published:     276

Active cron jobs:
  - poll-active-batches (30s) -- only checks batch_jobs, NOT pending slides
  - trigger-progressive-generation (15m) -- enrollment-based, NOT pending slides

Deprecated: process-lecture-queue -- no longer called by anything
```

### How a User Would Resolve This Today

They can't. There's no button or action in the UI that processes orphan `pending` slides. The "Generate All Slides" button calls `submit-batch-slides`, which may skip units that already have a `lecture_slides` record. The teaching unit card shows "Queued" with no cancel or retry option.

### The Fix (Two Parts)

#### Part 1: Immediate -- Process the 27 stuck pending slides

Option A (simple): Delete the orphan pending records and let the user re-trigger generation fresh:
```sql
DELETE FROM lecture_slides WHERE status = 'pending';
```

Option B (preserve): Reset them to trigger the batch pipeline by routing them through `submit-batch-slides` with a force flag.

**Recommendation: Option A** -- these records have no content, just empty placeholders. Deleting them lets the user click "Create Lecture" or "Generate All" cleanly.

#### Part 2: Structural -- Add a "Cancel" / "Process" action for queued items

**File: `src/components/instructor/TeachingUnitCard.tsx`**

Replace the static "Queued" badge with an actionable button that either:
- Cancels the queued item (deletes the pending record, returns to "Create Lecture" state)
- Triggers individual generation (calls `generate-lecture-slides-v3` directly)

**File: `src/hooks/lectureSlides/mutations.ts`**

Add a `useCancelQueuedSlide` mutation that deletes a `pending` lecture_slides record by teaching_unit_id.

**File: `supabase/functions/submit-batch-slides/index.ts`**

Update to handle slides that already have a `pending` record -- instead of skipping them, include them in the batch job. This makes "Generate All Slides" work correctly even when orphan pending records exist.

#### Part 3: Safety net -- Add pending slide processing to the cron

Add logic to `poll-active-batches` (the 30s cron) to detect slides stuck in `pending` for over 10 minutes and either:
- Auto-route them through the batch pipeline, OR
- Reset them (delete the empty record) so the user can re-trigger

### Files to Modify

| File | Change |
|------|--------|
| Database | Delete 27 orphan pending records |
| `src/components/instructor/TeachingUnitCard.tsx` | Replace static "Queued" badge with Cancel/Generate buttons |
| `src/hooks/lectureSlides/mutations.ts` | Add `useCancelQueuedSlide` hook |
| `supabase/functions/submit-batch-slides/index.ts` | Handle existing pending records instead of skipping |
| `supabase/functions/poll-active-batches/index.ts` | Add orphan pending detection as safety net |

### User Experience After Fix

```text
Before:
  Teaching unit shows "Queued" forever -> no action possible

After:
  Teaching unit shows "Queued" with two options:
    [Cancel] -> deletes pending record, shows "Create Lecture" button again
    [Generate] -> triggers individual slide generation immediately
  
  Safety net: if somehow stuck pending for 10+ min, cron auto-cleans
```
