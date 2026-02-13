

# Batch Audio Generation: Course-Level "Generate All Audio" Button

## Current State
- 49 teaching units in this course need audio generation
- Audio is generated one teaching unit at a time via "Generate Audio" in the slide viewer
- Each unit takes several minutes (6 voices x ~6 slides = ~36 TTS calls per unit)
- The existing `generate-lecture-audio` edge function handles one `slideId` at a time

## Architecture: Sequential Queue with Self-Continuation

The batch audio system will follow the exact same proven pattern used by `process-batch-images`: a self-continuing edge function that processes one unit at a time, then invokes itself for the next. This avoids gateway timeouts and respects TTS rate limits.

```text
+---------------------+       +---------------------------+       +---------------------------+
| Frontend Button     | ----> | generate-batch-audio      | ----> | generate-lecture-audio    |
| "Generate All Audio"|       | (orchestrator)            |       | (existing, unchanged)     |
| fire-and-forget     |       | picks next pending unit,  |       | processes 1 unit          |
+---------------------+       | invokes audio fn,         |       | (6 voices x N slides)     |
                              | then self-continues       |       +---------------------------+
                              +---------------------------+
                                        |
                                        v
                              polls audio_status on each
                              unit before moving to next
```

## Changes

### 1. New Edge Function: `generate-batch-audio/index.ts`

A lightweight orchestrator that:
- Accepts `{ instructorCourseId }` 
- Queries all `lecture_slides` where `status = 'ready'` and `(has_audio = false OR audio_status IS NULL)` for that course
- Processes them **one at a time sequentially**:
  - Sets `audio_status = 'generating'` on the current unit
  - Calls the existing `generate-lecture-audio` edge function (via internal fetch)
  - Waits/polls for `audio_status` to become `ready` or `failed` (with timeout)
  - Moves to the next unit
- Uses self-continuation (fire-and-forget self-invocation) to bypass the 60s edge function timeout -- processes a small batch (e.g., 2-3 units), then re-invokes itself with a cursor/offset
- Tracks progress in a `batch_jobs` record (type = 'audio') so the frontend can poll

### 2. New Frontend Hook: `useBatchGenerateAudio` (in `src/hooks/lectureSlides/audio.ts`)

- Mutation that fire-and-forgets the `generate-batch-audio` edge function
- Companion polling query that watches `lecture_slides` for the course to track how many have `has_audio = true` vs total
- Returns `{ pendingCount, completedCount, isGenerating }` for the button UI

### 3. UI: "Generate All Audio" Button (in `InstructorCourseDetail.tsx`)

- Placed next to the existing "Generate Images" button
- Shows count of pending units: "Generate Audio (49 pending)"
- While generating: shows progress "Audio 3/49"
- Disabled when already generating or no pending units
- Same visual pattern as the image generation button

### 4. Config: `supabase/config.toml`

- Add `[functions.generate-batch-audio]` with `verify_jwt = false`

## What Does NOT Change

- The existing `generate-lecture-audio` edge function is untouched -- it remains the single-unit workhorse
- The per-slide audio generation button in `LectureSlideViewer.tsx` stays as-is
- The TTS pipeline (Google Cloud Chirp 3 HD, 6 voices, segment mapping) is identical
- The narration generation (CMM persona, epistemic humility rules) is identical
- The audio storage structure (`{slideId}/{voiceId}/slide_{i}.wav`) is unchanged
- The student player, voice picker, and all playback logic remain the same

## Rate Limit Considerations

- Each unit generates ~36 TTS calls (6 voices x 6 slides)
- Google Cloud TTS has generous quotas but we add a 5-second delay between units
- 49 units at ~3-5 minutes each = estimated 2.5-4 hours total
- The self-continuation pattern ensures this runs reliably without browser dependency

## Technical Details

### Edge Function: `generate-batch-audio/index.ts`

```text
Input:  { instructorCourseId, offset?: number }
Output: { success, processed, remaining, total }

Logic:
1. Query lecture_slides WHERE instructor_course_id = X 
   AND status = 'ready' AND (has_audio = false)
   ORDER BY title OFFSET offset LIMIT 2
2. For each slide:
   a. Call generate-lecture-audio with { slideId }
   b. Poll audio_status every 10s (max 10 min timeout)
   c. Log result
3. If more remain, self-invoke with offset + 2
```

### Hook: `useBatchGenerateAudio`

```text
- mutationFn: invoke generate-batch-audio (fire-and-forget)
- Polling query: count lecture_slides by audio status for the course
- Refetch every 10s while any are 'generating'
```

### Button States

```text
Idle:       [Volume2 icon] Generate Audio (49 pending)
Starting:   [Spinner] Starting...
Progress:   [Spinner] Audio 3/49
Complete:   [hidden - no pending units]
```

