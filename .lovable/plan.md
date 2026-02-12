
# Make Audio Generation Pipeline Robust and Coherent

## Anomalies Found

Tracing the full audio pipeline (UI trigger -> hook -> edge function -> TTS -> storage -> student playback) reveals these issues that need systematic fixes:

### 1. Client-side timeout causes stuck "generating" status
The `useGenerateLectureAudio` hook synchronously awaits the edge function. For lectures with 6+ slides, processing exceeds the ~60s gateway timeout, causing "Failed to fetch" on the client. The backend completes successfully, but the UI never learns this -- `audio_status` stays `generating` and the instructor sees a perpetual spinner.

### 2. No polling for audio status
Unlike slide generation (which has `refetchInterval` in `queue.ts`), audio generation has zero polling. If the client times out or the user navigates away, they never see the result without a manual page refresh.

### 3. Signed URL expiry mismatch
Instructor preview uses 300s (5 min) expiry, student playback uses 3600s (1 hour). An instructor previewing a long lecture could hit expired URLs mid-session.

### 4. No backward compatibility for old voice IDs
The validator only accepts `['Charon', 'Leda', 'Fenrir', 'Kore', 'Puck', 'Aoede']`. Any existing lecture_slides rows with old OpenAI voice IDs (e.g., `onyx`) stored in metadata or re-triggered from old UI state will fail validation.

### 5. `enableSegmentMapping` adds latency without control
It defaults to `true` in the validator but the hook never sends it. Each slide makes an extra AI call for segment mapping, adding ~3-5s per slide. Instructors can't disable it.

## Fixes

### Fix 1: Fire-and-forget + status polling (core robustness fix)

**File: `src/hooks/lectureSlides/audio.ts`**

Change the hook from synchronous await to fire-and-forget with polling:

- The `mutationFn` fires `supabase.functions.invoke(...)` but does NOT await the full response. Instead, it immediately returns after confirming the request was accepted (or catches only immediate validation errors).
- Add a new `useEffect` in the hook (or a companion query) that polls `lecture_slides.audio_status` every 5 seconds while status is `generating`.
- When status flips to `ready` or `failed`, stop polling, invalidate queries, show toast.
- This completely eliminates the timeout problem -- the client doesn't care how long the backend takes.

**File: `supabase/functions/generate-lecture-audio/index.ts`**

Add a self-healing guard at the top: if `audio_status` is already `generating` and was set more than 10 minutes ago, reset it to allow retry. This prevents permanent stuck states.

### Fix 2: Backward-compatible voice validation

**File: `supabase/functions/_shared/validators/index.ts`**

Expand the voice enum to accept both old and new IDs:
```text
z.enum(['Charon', 'Leda', 'Fenrir', 'Kore', 'Puck', 'Aoede',
        'onyx', 'nova', 'echo', 'alloy', 'fable', 'shimmer'])
```

**File: `supabase/functions/_shared/tts-client.ts`**

Add legacy voice mapping:
```text
onyx -> Charon, nova -> Leda, echo -> Fenrir, alloy -> Kore, fable -> Puck, shimmer -> Aoede
```

### Fix 3: Consistent signed URL expiry

**File: `src/components/slides/LectureSlideViewer.tsx`**

Change instructor preview signed URL from 300s to 3600s (matching student playback).

### Fix 4: Explicit segment mapping control

**File: `src/hooks/lectureSlides/audio.ts`**

Explicitly pass `enableSegmentMapping: true` (or `false`) in the mutation body so the behavior is intentional, not accidental via default.

### Fix 5: Stuck status self-healing in the edge function

**File: `supabase/functions/generate-lecture-audio/index.ts`**

Before setting `audio_status = 'generating'`, check if it's already `generating` with a timestamp older than 10 minutes. If so, log a warning and proceed (overwrite). This prevents a race where a timed-out first request blocks retries.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/lectureSlides/audio.ts` | Fire-and-forget + polling pattern, explicit `enableSegmentMapping` |
| `supabase/functions/generate-lecture-audio/index.ts` | Self-healing stuck status guard |
| `supabase/functions/_shared/validators/index.ts` | Accept legacy voice IDs |
| `supabase/functions/_shared/tts-client.ts` | Legacy voice ID mapping |
| `src/components/slides/LectureSlideViewer.tsx` | Fix signed URL expiry to 3600s |

## What Stays the Same

- TTS engine (Google Cloud Chirp 3: HD) -- correct and deterministic
- AI narration generation (CMM persona) -- working
- WAV construction and storage upload -- working
- Student playback and sync highlighting -- working
- Audit logging -- working
- Cache-busting via `audio_generated_at` -- working

## Expected Outcome

- Instructors click "Generate Audio" and see a toast confirming the job started. The UI polls every 5s and automatically updates when audio is ready (or shows failure).
- No more "Failed to fetch" errors from gateway timeouts.
- No more stuck "generating" spinners -- self-healing resets after 10 minutes.
- Old lectures with OpenAI voice IDs can still regenerate audio without errors.
- Instructor preview uses consistent 1-hour signed URLs.
