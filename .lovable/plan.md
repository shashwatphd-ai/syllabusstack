

## Fix: Image Generation 504 Timeout and Auto-Trigger

### Problem Summary

Two issues need fixing:

1. **504 Timeout**: When you click "Generate Images" on the frontend, it calls `process-batch-images` with `instructor_course_id` (MODE 4). This tries to populate the image queue by calling an LLM to generate prompts for every slide -- 40+ LLM calls that take far longer than the edge function timeout. The 504 causes the CORS error you saw.

2. **Manual Step Required**: After "Generate All Slides" completes, images are queued by `poll-active-batches` (cron worker) correctly, but processing doesn't always start automatically.

### Root Cause

The `poll-active-batches` cron worker already:
- Populates the image queue (line 474-584)
- Triggers `process-batch-images` with service role key (line 571)

So the queue is already populated when you click the button. The frontend is redundantly re-populating it (40+ LLM calls) and timing out.

### Fix 1: Make the frontend "Generate Images" button fast

**File:** `src/hooks/useBatchSlides.ts` (lines 536-539)

Change the frontend trigger to send `{ continue: true }` instead of `{ instructor_course_id }`. This tells `process-batch-images` to go straight to MODE 1 (process from existing queue) -- no LLM prompt generation, just pick up pending items and start generating images. Returns in under 2 seconds.

```typescript
// Before (MODE 4 — re-populates queue, 40+ LLM calls, times out)
const { data, error } = await supabase.functions.invoke('process-batch-images', {
  body: { instructor_course_id: instructorCourseId },
});

// After (MODE 1 — process from existing queue, returns immediately)
const { data, error } = await supabase.functions.invoke('process-batch-images', {
  body: { continue: true },
});
```

**Why this is safe:**
- The queue is already populated by `poll-active-batches` (confirmed by your 40 pending items)
- MODE 1 already handles self-continuation (processes batch of 3, then self-invokes for next batch)
- If the queue is empty, it returns `{ success: true, message: 'No pending items' }` -- no crash

**What if queue isn't populated yet?** Add a fallback: if MODE 1 returns 0 pending items, THEN fall back to `instructor_course_id` mode but via server-side self-invocation (not blocking the frontend).

### Fix 2: Ensure `poll-active-batches` always triggers image processing

**File:** `supabase/functions/poll-active-batches/index.ts` (lines 566-584)

The trigger at line 571 already exists and uses service role key (server-to-server, no CORS, no browser timeout). Verify it uses `{ continue: true }` instead of `{ instructor_course_id }` to avoid the same timeout issue server-side.

Current code sends `{ instructor_course_id }` (line 577) which hits MODE 4 and could also timeout. Change to `{ continue: true }`:

```typescript
// Before (line 577)
body: JSON.stringify({ instructor_course_id: batchJob.instructor_course_id }),

// After
body: JSON.stringify({ continue: true }),
```

**Why this is safe:** The queue is populated by the lines immediately above (482-561). Sending `{ continue: true }` tells the worker to process what's already in the queue.

### Fix 3: Smarter frontend trigger with fallback

**File:** `src/hooks/useBatchSlides.ts`

Update `useTriggerImageGeneration` to:
1. First try `{ continue: true }` (fast, processes existing queue)
2. If result shows 0 pending AND 0 processed, fall back to `{ instructor_course_id }` as a background fire-and-forget (for cases where queue hasn't been populated yet, e.g., individual slide generation)

```typescript
mutationFn: async ({ instructorCourseId }: { instructorCourseId: string }) => {
  // Try processing existing queue first (fast path)
  const { data, error } = await supabase.functions.invoke('process-batch-images', {
    body: { continue: true },
  });

  if (error) throw error;

  // If nothing was in the queue, populate it in the background
  if (data?.processed === 0 && data?.remaining === undefined) {
    // Fire-and-forget: populate queue then process
    supabase.functions.invoke('process-batch-images', {
      body: { instructor_course_id: instructorCourseId },
    }).catch(err => console.warn('[ImageGen] Background populate failed:', err));
    
    return { ...data, message: 'Image generation queued and starting...' };
  }

  return data;
},
```

### What this does NOT change

- The image generation model/provider (`google/gemini-3-pro-image-preview` via OpenRouter) -- unchanged
- The `buildImagePrompt` LLM prompt writer logic -- unchanged
- The `processQueueItem` image generation logic -- unchanged
- Self-continuation loop -- unchanged
- `poll-active-batches` cron schedule -- unchanged
- Individual slide image generation (v3 pipeline) -- unchanged

### Summary

| Change | File | What | Risk |
|--------|------|------|------|
| Frontend trigger | `useBatchSlides.ts` | Send `continue:true` first, fallback to `instructor_course_id` | None -- queue already populated by cron |
| Cron trigger | `poll-active-batches/index.ts` | Send `continue:true` instead of `instructor_course_id` | None -- queue populated 5 lines above |

Both changes make the same worker (`process-batch-images`) process the same queue with the same model. The only difference is they skip redundant queue population that causes timeouts.

### About the DialogContent warnings

Those are cosmetic accessibility warnings from Radix UI (missing `aria-describedby`). They don't affect functionality and are unrelated to image generation. Can be fixed separately by adding `DialogDescription` to Dialog components.

