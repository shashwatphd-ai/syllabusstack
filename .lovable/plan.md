

# Fix: Audio Not Updating After Regeneration (Browser Cache Issue)

## Problem

When you regenerate audio, the new `.wav` files are uploaded to the **same path** (`{slideId}/slide_0.wav`, etc.) with `upsert: true`. The browser caches the old audio from the previous signed URL, so even though the storage file is updated, the player serves stale audio.

## Solution

Add a cache-busting timestamp to the signed URL so the browser treats regenerated audio as a new resource.

## Technical Changes

### File: `supabase/functions/generate-lecture-audio/index.ts`

Add an `audio_generated_at` timestamp to the lecture slide record when audio generation completes. This provides a cache key that changes on every regeneration.

- In the final `update` call (around line 312), add `audio_generated_at: new Date().toISOString()` alongside `has_audio` and `audio_status`.

### File: `src/components/slides/StudentSlideViewer.tsx`

Append a cache-busting query parameter to the signed URL using the `audio_generated_at` timestamp (or fallback to `Date.now()`).

- After obtaining the signed URL (around line 174/192), append `&t={timestamp}` to force the browser to fetch fresh audio.

```
signedUrl + '&t=' + (lectureSlide.audio_generated_at || Date.now())
```

### Database Migration

Add the `audio_generated_at` column to the `lecture_slides` table:

```sql
ALTER TABLE public.lecture_slides
ADD COLUMN IF NOT EXISTS audio_generated_at timestamptz;
```

## Why This Works

Signed URLs from storage already contain query parameters (token, expiry). Appending `&t=<timestamp>` makes each regeneration produce a unique URL, bypassing the browser cache entirely. The timestamp only changes when audio is regenerated, so normal playback still benefits from caching.

