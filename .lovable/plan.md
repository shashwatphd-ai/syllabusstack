

## Fix: Self-Healing Audio Generation with User Recovery

### Problem

When a worker fails to update a slide's `audio_status` back from `generating`, the orchestrator loop stops because it sees no pending work and no available slots. The stuck slide never gets reset because the stale detection (10-minute threshold) only runs inside the orchestrator loop -- which has already terminated. The UI shows a frozen progress bar (e.g., "53/54") with no explanation and no recovery option.

### Root Cause (3 gaps)

1. **Orchestrator exits too early**: When all remaining slides are `generating` (not pending), the circuit breaker sees `remaining === 0` and stops the loop -- even though workers may still be in-flight and could fail silently.
2. **No external self-healing**: Stale detection only runs inside the orchestrator. If the loop stops, stuck slides stay stuck forever.
3. **No user-facing recovery**: The UI shows a spinner with a count but offers no "retry" or "something went wrong" message when progress stalls.

### Solution (3 layers)

---

### Layer 1: Fix Orchestrator Circuit Breaker

**File**: `supabase/functions/generate-batch-audio/index.ts`

Change the circuit breaker logic so the orchestrator does NOT exit when there are still in-flight workers (`currentlyGenerating > 0`), even if `remaining === 0`. It should self-continue with idle backoff to check if those workers finish or go stale.

Current logic (line 241):
```
else {
  // stops the loop
}
```

New logic:
```
else if (currentlyGenerating > 0) {
  // Workers still in-flight -- keep polling so stale detection can catch them
  self-continue with IDLE_DELAY_MS
} else {
  // Truly nothing to do -- stop
}
```

This ensures the stale detection at the top of each iteration (lines 93-107) gets a chance to reset stuck `generating` slides back to `null`, which then become pending work for the next iteration.

---

### Layer 2: Frontend Stall Detection and Recovery UI

**File**: `src/hooks/lectureSlides/audio.ts` (useBatchGenerateAudio)

Add stall detection: track the last time `completed` count changed. If generating > 0 but completed hasn't changed for 3+ minutes, mark the status as `stalled`.

**File**: `src/pages/instructor/InstructorCourseDetail.tsx`

Update the audio progress UI to:
- Show an amber warning when stalled: "Audio generation appears stuck. Click to retry."
- Change the button to a "Retry Audio" action that re-invokes `generate-batch-audio`, which will trigger stale detection and restart processing.
- Show failed count explicitly when > 0.

---

### Layer 3: Add a "Retry Stuck Audio" Manual Action

**File**: `src/hooks/lectureSlides/audio.ts`

Add a new `useRetryStuckAudio` mutation that:
1. Resets all `audio_status = 'generating'` slides older than 5 minutes back to `null`
2. Re-invokes the batch orchestrator

This gives the user an explicit escape hatch independent of automatic self-healing.

---

### Technical Details

**Orchestrator fix** (generate-batch-audio/index.ts):
- After the existing circuit breaker conditions, add: if `currentlyGenerating > 0` and `remaining === 0` and `dispatched === 0`, self-continue with `IDLE_DELAY_MS` instead of stopping
- Add a max-idle counter (passed via body param `idleLoops`, default 0) that increments each idle continuation and caps at 20 iterations (~10 minutes) to prevent infinite loops. After 20 idle loops, the stale detection will have already reset any stuck slides, so the loop can safely exit.

**Frontend stall detection** (audio.ts - useBatchGenerateAudio):
- Add `lastProgressAt` ref, updated whenever `completed` changes
- Add `isStalled` to `BatchAudioStatus`: true when `generating > 0` and `Date.now() - lastProgressAt > 180_000` (3 min)
- Continue polling even when stalled (don't deactivate)

**Stall UI** (InstructorCourseDetail.tsx):
- When `audioStatus.isStalled`, show amber-colored button text: "Audio stalled -- Retry"
- Clicking re-fires `batchAudio.mutate(id)` which restarts the orchestrator (with its stale detection)
- When `audioStatus.failed > 0` and not running, show: "Retry N failed"

**useRetryStuckAudio hook** (audio.ts):
- Direct DB update: set `audio_status = null` where `audio_status = 'generating'` and `updated_at < 5 min ago`
- Then invoke `generate-batch-audio` to restart the loop
- This is exposed as a secondary action in the UI

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-batch-audio/index.ts` | Fix circuit breaker to keep looping while workers are in-flight; add idle loop counter |
| `src/hooks/lectureSlides/audio.ts` | Add stall detection to `useBatchGenerateAudio`; add `useRetryStuckAudio` hook |
| `src/hooks/lectureSlides/index.ts` | Export new hook |
| `src/hooks/useLectureSlides.ts` | Re-export new hook |
| `src/pages/instructor/InstructorCourseDetail.tsx` | Update audio button UI with stall/retry states |

