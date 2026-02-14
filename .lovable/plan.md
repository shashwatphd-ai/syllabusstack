

## Diagnosis: Runaway Orchestrator Loop Burning API Costs

### What's Happening Right Now

The batch audio orchestrator (`generate-batch-audio`) is stuck in an **infinite tight loop**, calling itself every ~1 second, doing nothing productive:

```text
Status:  20/53 ready | 4 stuck in "generating" | 29 pending (NULL)

Loop behavior (every ~1 second):
  1. Check in-flight count -> 4 (at MAX_CONCURRENT)
  2. Slots available -> 0
  3. Dispatch 0 new slides
  4. remaining=29, totalInFlight=4 -> self-continue
  5. Repeat forever
```

The 4 slides stuck in "generating" have been that way since 02:15. The workers that were processing them crashed or timed out, but **never updated the status back to "failed"**. The orchestrator has **no staleness detection**, so it keeps looping forever waiting for those 4 zombie workers to finish.

### Cost Waste

Over the ~3 hours this has been running:
- ~10,000+ edge function invocations (orchestrator self-calls)
- Each invocation does 2 database queries + 1 fetch call
- The workers themselves are NOT running (no TTS API costs being wasted), but the orchestrator overhead is significant

### Root Causes (Three Issues)

1. **No stale worker detection**: The orchestrator never checks if "generating" slides have been stuck for too long. It just trusts they'll finish eventually.

2. **No backoff / circuit breaker**: When slots are full and nothing is dispatched, the orchestrator immediately self-continues instead of waiting or stopping. This creates a ~1 call/second infinite loop.

3. **Worker crash doesn't update status**: When `generate-lecture-audio` times out (150s edge function limit), the error handler tries to set `audio_status='failed'`, but this is a last-resort catch block that may not execute if the Deno isolate is forcefully killed.

### Fix Plan

#### Step 1: Stop the current loop immediately

Reset the 4 stuck "generating" slides back to NULL so they can be reprocessed, and let the loop terminate naturally (it will see 0 in-flight + pending items after the reset).

Actually, the 29 pending slides will keep it going, so we need the code fix deployed first.

#### Step 2: Fix the orchestrator (`generate-batch-audio/index.ts`)

Add three safeguards:

**A. Stale worker detection (lines 81-88 area)**
Before counting in-flight workers, reset any slide that has been "generating" for more than 10 minutes back to NULL:

```typescript
// Reset stale workers (stuck > 10 minutes)
const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const { data: staleSlides } = await supabase
  .from('lecture_slides')
  .update({ audio_status: null })
  .eq('instructor_course_id', instructorCourseId)
  .eq('audio_status', 'generating')
  .lt('updated_at', staleThreshold)
  .select('id');

if (staleSlides?.length) {
  console.warn(`Reset ${staleSlides.length} stale workers`);
}
```

**B. Circuit breaker — stop looping when idle (line 178 area)**
If nothing was dispatched AND nothing is making progress, stop the loop instead of spinning endlessly:

```typescript
// Only self-continue if we actually dispatched work or there are available slots
if (dispatched > 0 || (remaining > 0 && slotsAvailable > 0)) {
  // self-continue
} else if (totalInFlight > 0) {
  // Workers are running but no slots — schedule a delayed check (30s)
  // Use a longer delay to avoid tight looping
} else {
  // Nothing to do — stop
}
```

**C. Add a delay between self-continuations**
Instead of instant self-calls, add a minimum 15-second gap by including a `delayMs` parameter that the next invocation will sleep on before doing work.

#### Step 3: Fix the worker (`generate-lecture-audio/index.ts`)

Ensure the worker ALWAYS updates `audio_status` to `failed` on timeout/crash, even if the main catch block fails. This is already partially implemented but may not survive Deno isolate termination.

#### Step 4: Reset stuck slides and redeploy

Reset all 4 stuck slides and 29 pending slides, then redeploy both functions.

### Technical Details

**Files to modify:**
- `supabase/functions/generate-batch-audio/index.ts` — Add stale detection, circuit breaker, and backoff delay
- `supabase/functions/generate-lecture-audio/index.ts` — Minor hardening of error status updates

**Database operations:**
- Reset 4 "generating" slides to NULL
- No schema changes needed

