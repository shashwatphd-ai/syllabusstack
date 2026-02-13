

# Fix Single Slide Generation Timeout: Fire-and-Forget + Poll

## Problem

`generate-lecture-slides-v3` takes ~150 seconds (research + Professor AI + CMM notes + image queuing). The edge function gateway has a ~60s timeout. The function completes successfully server-side (slides saved, images queued), but the HTTP connection is killed before the response reaches the browser, causing a `FunctionsFetchError: Failed to fetch` on the frontend.

**The slides actually generate fine** -- the error is purely a client-side timeout. The user sees "Generation Failed" even though the slides are sitting in the database ready to view.

## Solution

Apply the same fire-and-forget + polling pattern already proven by audio generation (`useGenerateLectureAudio`). No new edge functions, no schema changes.

## Changes

### File 1: `src/hooks/lectureSlides/mutations.ts` (useGenerateLectureSlides)

**Current behavior:**
```
await supabase.functions.invoke('generate-lecture-slides-v3', { body })
// Waits for full response --> times out after 60s --> error
```

**New behavior:**
1. Fire the edge function call without awaiting the response (fire-and-forget)
2. Poll `lecture_slides` table every 5 seconds checking for `status` change
3. Resolve when status becomes `'ready'` or `'failed'`
4. Use real `generation_phases` data from the DB for progress instead of simulated timers

Specifically:
- Replace the `await supabase.functions.invoke(...)` with a fire-and-forget call (`.then().catch()` or just don't await)
- Add a polling loop that queries `lecture_slides` by `teaching_unit_id` every 5 seconds
- Read `status`, `generation_phases`, and `total_slides` from the DB row
- If `status === 'ready'`: resolve the mutation with slide data
- If `status === 'failed'`: reject with `error_message` from the DB row
- Timeout safety: if no status change after 5 minutes, reject with a timeout error
- Replace the simulated progress `useEffect` (lines 73-94) with real progress from `generation_phases.current_phase` and `generation_phases.progress_percent`

### File 2: No other files change

The edge function (`generate-lecture-slides-v3`) already:
- Creates the `lecture_slides` record with `status: 'generating'` before doing any work
- Updates `generation_phases` at each step (research, professor, narration, finalize)
- Sets `status: 'ready'` when slides are saved
- Sets `status: 'failed'` with `error_message` on any error
- Queues images and triggers `process-batch-images` independently

All the server-side infrastructure is already correct. Only the frontend hook needs to stop waiting for the HTTP response.

## What Does NOT Change

| Component | Status |
|-----------|--------|
| `generate-lecture-slides-v3` edge function | Unchanged |
| `process-batch-images` worker | Unchanged |
| `image_generation_queue` | Unchanged |
| Database schema | Unchanged |
| Image generation pipeline | Unchanged |
| Batch generation pipeline | Unchanged |
| Audio generation | Unchanged |
| All other hooks | Unchanged |

## Risk Assessment

- **Zero backend risk**: No edge function changes
- **Proven pattern**: Identical to `useGenerateLectureAudio` which already works reliably
- **Better UX**: Real progress data from DB instead of fake simulated timers
- **Safety net**: 5-minute client-side timeout prevents infinite polling; server-side self-healing (existing) resets stale records after 30 minutes

