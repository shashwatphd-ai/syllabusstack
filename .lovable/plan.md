

# Fix: Missing "Regenerate Audio" Button + Staleness Warning

## Problem

The "Generate Audio" button is only visible when `has_audio` is `false` (line 192 of `LectureSlideViewer.tsx`). Once audio is generated, it's replaced by an "Audio Ready" badge with no option to regenerate. This means you can never re-process audio after content changes.

## Changes

### 1. Add "Regenerate Audio" button (when audio exists)

**File: `src/components/slides/LectureSlideViewer.tsx`**

Replace the static "Audio Ready" badge (lines 212-217) with an interactive section that includes:
- The existing "Audio Ready" badge
- A "Regenerate Audio" button (with a `RefreshCw` icon) next to it
- The `VoicePicker` dropdown so users can change voice on regeneration

The button will call the same `handleGenerateAudio` function already wired up.

### 2. Add "Audio out of sync" warning

**File: `src/components/slides/LectureSlideViewer.tsx`**

When `has_audio` is true, compare `updated_at` against `audio_generated_at`. If the slide content was updated after audio was last generated, show a warning badge: "Audio outdated -- regenerate" in amber/yellow, making it obvious that the audio doesn't match the current transcript.

This requires passing `audio_generated_at` and `updated_at` from the lecture slide data into the component (or deriving it from the existing query).

### 3. Immediate data fix for current lecture

The slide `bba37e1a` currently has stale audio. Once the "Regenerate Audio" button is available, you can click it to re-process. No manual database changes needed.

## Summary

| What | Before | After |
|---|---|---|
| Audio exists | Static "Audio Ready" badge, no action | Badge + "Regenerate Audio" button |
| Content changed after audio | No indication | Amber "Audio outdated" warning |
| Generate Audio button | Only when no audio exists | Always available |

