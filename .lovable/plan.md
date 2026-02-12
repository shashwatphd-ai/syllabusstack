
# Fix: Reset Audio Status When Slides Are Regenerated

## The Problem

When you regenerate a slide deck, the `generate-lecture-slides-v3` function creates new slide content but never resets the `has_audio` and `audio_status` fields on the `lecture_slides` database row. The old values (`has_audio: true`, `audio_status: 'ready'`) persist, so:

1. The UI shows "Audio Ready" badge even though the audio files belong to the old slides
2. The "Generate Audio" button is hidden (it only appears when `has_audio` is false)
3. Students could hear narration that doesn't match the new slide content

## The Fix

One file, two fields added to the upsert payload in `supabase/functions/generate-lecture-slides-v3/index.ts`.

When `regenerate` is true, the upsert payload (line 279) currently resets `slides: []`. We extend this to also reset `has_audio: false` and `audio_status: null`:

```typescript
...(regenerate ? { slides: [], has_audio: false, audio_status: null } : {}),
```

This is a single-line change. After regeneration completes, the UI will correctly show the "Generate Audio" button instead of the stale "Audio Ready" badge, letting you generate fresh narration for the new slides.

## What Does NOT Change

- All slide generation logic remains identical
- Audio generation pipeline (`generate-lecture-audio`) is untouched
- Frontend components work correctly already -- they just need accurate data from the database
- Non-regeneration flows (first-time generation) are unaffected since the spread only applies when `regenerate` is true
