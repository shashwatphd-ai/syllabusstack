

## Fix: Image Generation "Failed to Fetch" Toast

### Problem

When you click "Generate Images", the browser calls `process-batch-images` with `{ continue: true }`. This mode processes 3 images synchronously (~60 seconds) before sending a response. The browser's fetch times out before the function finishes, causing a `Failed to fetch` error and a scary toast message. Meanwhile, the images ARE generating successfully in the background via self-continuation -- the toast is misleading.

### Root Cause

The "fast path" (`continue: true` mode) is not actually fast. It fetches 3 pending items, generates images for all of them (~20s each), THEN responds. By the time it responds, the browser has already given up.

### Solution (2 parts)

---

### Part 1: Make the Frontend Trigger Fire-and-Forget

Instead of waiting for `process-batch-images` to finish processing, the frontend should:

1. Call `process-batch-images` but NOT await the full response (fire-and-forget with a catch)
2. Immediately show a success toast: "Image generation started in background"
3. Let the polling hook (`useImageGenerationStatus`) handle progress updates

**File**: `src/hooks/useBatchSlides.ts` (useTriggerImageGeneration)

Changes to `mutationFn`:
- Fire the edge function call without awaiting it (fire-and-forget)
- Return immediately with a success status
- The edge function continues processing and self-continues in the background
- This eliminates the browser timeout entirely

### Part 2: Add Resilient Error Handling in the Toast

**File**: `src/hooks/useBatchSlides.ts` (useTriggerImageGeneration)

Changes to `onError`:
- Detect `FunctionsFetchError` / `Failed to fetch` errors specifically
- Instead of showing "Image Generation Failed", show an amber info toast: "Image generation is running in the background. Check progress below."
- This accounts for cases where the fire-and-forget still fails (e.g., network issues)

---

### Technical Details

**useTriggerImageGeneration mutationFn** (useBatchSlides.ts ~line 537):

Current flow:
```
1. Check for failed items -> reset them (awaited)
2. Call process-batch-images { continue: true } (AWAITED - THIS IS THE PROBLEM)
3. If empty, fire background populate
4. Return response
```

New flow:
```
1. Check for failed items -> reset them (awaited, this is fast)
2. Fire process-batch-images { continue: true } (FIRE AND FORGET)
3. Return immediately with { success: true, message: "started" }
```

**Error handler** (useBatchSlides.ts ~line 605):
- Check if `error.message` includes "Failed to fetch" or "Failed to send"
- If so, show a non-destructive toast since the backend is likely still processing
- Otherwise show the existing destructive toast

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useBatchSlides.ts` | Make image generation trigger fire-and-forget; improve error toast for network timeouts |
