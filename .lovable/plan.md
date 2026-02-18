
## Fix: Re-queue Missing Images for Two Published Lectures

### What the Logs Confirmed

The database and logs establish exactly what happened:

**The two broken lectures:**
- "Strategy C: The AI Sandwich" (id: `2fcf99ab`)
- "The Prediction Engine: Tokens & Probabilities" (id: `91ed5a59`)

Both have `queue_entries: 0`, `slides_with_image_url: 0`, `visual.type` populated on all 6 slides, `visual_directive: null` on all slides, and `status: published`.

**The timeline:**
- `2026-02-15 05:54:16` — Both lectures got their slides generated (`slides_updated_at`)
- `2026-02-15 06:04:18` — Image queue was populated for all OTHER lectures
- `2026-02-16 06:40` — Audio was generated for both (confirming they were published by then)

**Why they were skipped:** During the original populate scan, `buildImagePrompt()` called `slideNeedsImage()`. At that time, these slides had `visual_directive: null` — so only line 167 (`slide.visual?.type !== 'none'`) could save them. The `visual` object was being constructed inline during generation and may not have been persisted in the same shape at population time, or the populate call simply errored silently for these two specific lectures.

**Why no queue entries were ever created:** `populateQueueFromLecture` logged "No slides need images" for these two and returned 0. Since 0 items were inserted, `triggerContinuation` was never called for them. They've been invisible to the image pipeline ever since.

**Why the "Generate Images" button shows no count:** `poll-batch-status` reports `pending: 0, failed: 0` because the queue has 243 completed entries and 0 for these lectures. So `publishedMissingImages = 0 + 0 = 0`. The dashboard has no way to know there are 12 slides (6 per lecture) missing images that were never queued.

**Why clicking "Generate Images" today also won't fix them:** The current course-mode trigger sends `{ instructor_course_id }` → MODE 4. This calls `populateQueueFromLecture` for each lecture including the two broken ones. Since `visual_directive` is still null, it relies on line 167 (`slide.visual?.type !== 'none'`). This SHOULD work — but only if the populate call actually runs for those specific lectures this time without timing out.

### Two-Part Fix

**Part 1 — Frontend: Add a per-lecture "Re-queue Images" button**

Add a targeted "Re-queue Images" button directly on the lecture row in the slide management panel for any published lecture that has slides with `visual.type` but `visual.url = null`. This calls `process-batch-images` with `{ lecture_slides_ids: [id] }` (MODE 2), which runs `populateQueueFromLecture` directly for just those two lectures and then triggers continuation.

This also gives instructors a general self-service recovery tool for any future similar situations.

**Part 2 — Backend: Fix the "Generate Images" button to also catch published lectures with unqueued missing images**

The current `publishedMissingImages` count only reads from the `image_generation_queue`. It completely misses lectures that were never queued at all. Update `poll-batch-status` to also count slides that have `visual.type` set but `visual.url` null AND have 0 queue entries — surfacing these as a true missing count.

### Files to Change

1. **`supabase/functions/poll-batch-status/index.ts`** — Add a query that counts slides with `visual` objects but `url: null` and no corresponding queue entry, and include this in the response as `unqueued_missing`. This gives the frontend an accurate true count.

2. **`src/pages/instructor/InstructorCourseDetail.tsx`** — Update `publishedMissingImages` to also include `unqueued_missing` from the poll-batch-status response so the "Generate Images" button shows the correct count and stays visible.

3. **`src/hooks/lectureSlides/mutations.ts` or the lecture row component** — Add a per-lecture "Re-queue Images" action button that appears when `slides_with_image_url < slide_count`. This calls `process-batch-images` with `{ lecture_slides_ids: [lectureId] }`.

4. **`src/pages/instructor/InstructorCourseDetail.tsx`** (lecture row render) — Show a small warning icon + "Re-queue" button on the lecture card row when slides have visual types but missing URLs, making the broken state visible rather than silent.

### Technical Detail: Why MODE 2 Will Work Now

When `populateQueueFromLecture` is called for `2fcf99ab` and `91ed5a59` today:

```
slide.visual?.url → null → pass (don't skip)
slide.visual_directive?.type → null → skip override
slide.visual_directive?.description → null → skip override  
slide.visual?.type = "infographic" → !== 'none' → return true ✓
```

Line 167 catches them. All 6 slides per lecture will be queued (12 total). Then `triggerContinuation` fires and they get generated. The `updateLectureSlides` write-back will populate `visual.url` on each slide as images complete.

### Immediate Recovery (No Code Change Needed Today)

The quickest path to fix the two broken lectures right now is to call the edge function directly with their IDs. The plan will implement the UI button so this is self-service in future. After the code change is applied, clicking the new per-lecture button will trigger the same call.
