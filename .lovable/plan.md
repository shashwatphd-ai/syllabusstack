

# Multi-Voice Audio Generation with Student Voice Selection

## Current Architecture

Today, the instructor picks ONE voice in the VoicePicker, clicks "Generate Audio", and the edge function generates audio for all slides using only that voice. Files are stored as:

```text
{slideId}/slide_0.wav
{slideId}/slide_1.wav
...
```

Students have no voice choice -- they hear whatever the instructor last generated.

## Proposed Architecture

### Core Idea

When the instructor clicks "Generate Audio", the system generates audio for ALL 6 Chirp 3: HD voices in parallel. Students then pick their preferred voice via a VoicePicker in the student viewer.

### Storage Layout Change

```text
Before: {slideId}/slide_0.wav
After:  {slideId}/Charon/slide_0.wav
        {slideId}/Leda/slide_0.wav
        {slideId}/Fenrir/slide_0.wav
        {slideId}/Kore/slide_0.wav
        {slideId}/Puck/slide_0.wav
        {slideId}/Aoede/slide_0.wav
```

### Slide Data Change

Each slide currently stores a single `audio_url`. This changes to a map:

```text
Before: audio_url: "{slideId}/slide_0.wav"
After:  audio_urls: {
          Charon: "{slideId}/Charon/slide_0.wav",
          Leda:   "{slideId}/Leda/slide_0.wav",
          ...
        }
        audio_url: "{slideId}/Charon/slide_0.wav"   // kept for backward compat
```

The legacy `audio_url` field remains pointing to the default voice (Charon) so existing student viewers and instructor previews continue working without changes until they're updated.

## File Changes

### 1. `supabase/functions/generate-lecture-audio/index.ts`

Major changes:
- Remove the single `voiceId` parameter -- the function now generates ALL voices
- After generating narration text for each slide (Phase 1, unchanged), loop through all 6 voices and call `synthesizeSpeech()` for each
- Upload to voice-specific paths: `{slideId}/{voiceId}/slide_{i}.wav`
- Store `audio_urls` map on each slide alongside legacy `audio_url`
- Duration is identical across voices (same text, same engine), so calculate once from the first voice
- Segment mapping runs once per slide (not per voice) since it's text-based, not audio-based
- Process voices in parallel per slide (Promise.all) to reduce total time
- Audit log records all 6 voices

### 2. `src/components/slides/VoicePicker.tsx`

No changes to voice list. Remove from instructor header (since all voices are now generated). Could optionally keep it for instructor preview selection.

### 3. `src/components/slides/LectureSlideViewer.tsx` (Instructor)

- Remove VoicePicker from the header (all voices are generated automatically)
- Keep the preview play button but add a small voice selector next to it so the instructor can preview any voice
- Update `handleGenerateAudio` to not pass `voiceId` (all voices generated)
- Preview resolves audio path using selected preview voice from `audio_urls` map

### 4. `src/components/slides/StudentSlideViewer.tsx` (Student)

- Add VoicePicker to the student footer controls (next to the volume toggle)
- Store selected voice in `useState` with default `'Charon'`
- When resolving audio URL, use `slide.audio_urls?.[selectedVoice]` instead of `slide.audio_url`
- Persist student voice preference in `localStorage` so it remembers across sessions
- Voice change mid-lecture: stop current audio, re-resolve URL for new voice, resume from same slide

### 5. `src/components/slides/NarratedScrollViewer.tsx` (Student scroll mode)

- Accept `selectedVoice` prop from parent StudentSlideViewer
- Use `audio_urls[selectedVoice]` when resolving audio paths for scroll mode playback

### 6. `src/hooks/lectureSlides/audio.ts`

- Remove `voiceId` from mutation params (no longer needed -- all voices generated)
- Keep `enableSegmentMapping` param

### 7. `supabase/functions/_shared/validators/index.ts`

- Remove `voiceId` from `lectureAudioSchema` (no longer a parameter)

### 8. `src/hooks/lectureSlides/types.ts`

- Add `audio_urls?: Record<string, string>` to `Slide`, `EnhancedSlide`, and `ProfessorSlide` types

## Performance Considerations

- Generating 6 voices x N slides increases TTS API calls by 6x
- Mitigation: process all 6 voices per slide in parallel (`Promise.all`), so wall-clock time per slide only increases marginally (Google TTS responds in ~1-2s per call)
- Total time for a 12-slide lecture: ~15-25 minutes (vs ~3-5 minutes today) -- acceptable since it's fire-and-forget with polling
- Storage increase: 6x per lecture -- acceptable for WAV files (typically 1-3MB each)

## Backward Compatibility

- Existing slides with single `audio_url` continue working -- student viewer falls back to `audio_url` if `audio_urls` map is missing
- Instructor can regenerate at any time to populate all voices
- Legacy voice IDs (onyx, nova, etc.) no longer relevant for generation but the `resolveVoiceId` mapping stays for any edge cases

## User Experience

**Instructor**: Clicks "Generate Audio" (no voice selection needed). Sees progress toast. All 6 voices are generated in the background. Can preview any voice via a small selector next to the play button.

**Student**: Opens lecture. Sees a voice picker in the playback controls. Picks their preferred voice (default: Charon). Preference is saved. Audio plays in their chosen voice. Can switch voices mid-lecture.

