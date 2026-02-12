

# Switch Audio from GPT Audio (LLM) to Google Cloud TTS (Chirp 3: HD)

## Why This Is Needed

The current system sends narration text as a chat message to `openai/gpt-audio-mini`, which is a language model that *speaks its own response* rather than reading the input. This is why audio contains "Absolutely!", "That's an excellent point", reads citations aloud, and produces content that doesn't match the transcript. This is not fixable with better prompting -- it's an architectural mismatch.

Google Cloud TTS is a deterministic speech synthesizer. It reads text exactly as written. The `GOOGLE_CLOUD_API_KEY` is already configured and used by 6+ edge functions.

## What Changes

### 1. New file: `supabase/functions/_shared/tts-client.ts`

A focused Google Cloud TTS client that:
- Calls `POST https://texttospeech.googleapis.com/v1/text:synthesize?key={GOOGLE_CLOUD_API_KEY}`
- Uses Chirp 3: HD voices (`en-US-Chirp3-HD-Charon`, etc.) for natural, teaching-quality speech
- Returns `LINEAR16` at 24kHz -- Google includes the WAV header automatically
- Handles text chunking at sentence boundaries for narrations exceeding Google's 5000-byte input limit
- Includes retry logic (2 retries, 1s backoff on 5xx errors)
- Maps short voice IDs (e.g., `Charon`) to full Google voice names

### 2. Update: `supabase/functions/generate-lecture-audio/index.ts`

Replace the GPT Audio chat completion block (lines 187-218) with a call to the new TTS client:

```text
Before (LLM responds to text):
  callOpenRouter({ model: MODELS.AUDIO, messages: [...], modalities: ['text','audio'] })

After (TTS reads text verbatim):
  synthesizeSpeech(narrationText, voiceId, GOOGLE_CLOUD_API_KEY)
```

Additional changes in this file:
- Remove manual WAV header construction (lines 220-247) -- Google returns complete WAV
- Remove `callOpenRouter` and `MODELS` imports (no longer needed for this function)
- Add `GOOGLE_CLOUD_API_KEY` check alongside `OPENROUTER_API_KEY` (still needed for narration generation and segment mapping)
- Simplify audit log: since TTS is deterministic, transcript comparison is replaced with generation metadata (voice, chunk count, model)
- Keep: PCM-based duration calculation (parse WAV header for data size), storage upload, segment mapping, audit summary, all error handling

### 3. Update: `src/components/slides/VoicePicker.tsx`

Replace OpenAI voice IDs with Chirp 3: HD voice short names:

| Old ID | New ID | Label | Description |
|--------|--------|-------|-------------|
| onyx | Charon | Professor Charon | Deep, authoritative |
| nova | Leda | Dr. Leda | Warm, friendly |
| echo | Fenrir | Dr. Fenrir | Clear, measured |
| alloy | Kore | Prof. Kore | Balanced, neutral |
| fable | Puck | Dr. Puck | Expressive, storytelling |
| shimmer | Aoede | Prof. Aoede | Calm, reassuring |

### 4. Update: `supabase/functions/_shared/validators/index.ts`

Update `lectureAudioSchema` to accept the new voice IDs:

```text
Before: z.enum(['onyx', 'nova', 'echo', 'alloy', 'fable', 'shimmer'])
After:  z.enum(['Charon', 'Leda', 'Fenrir', 'Kore', 'Puck', 'Aoede'])
```

### 5. Update: `src/hooks/lectureSlides/audio.ts`

Change default `voiceId` from `'onyx'` to `'Charon'`.

### 6. Update: `src/components/slides/LectureSlideViewer.tsx`

Two changes:

**a) Default voice**: Change `useState('onyx')` to `useState('Charon')` (line 56).

**b) Instructor audio preview**: Add a play/pause button in the navigation footer so instructors can hear what students will hear.

Implementation:
- Add `audioRef` (useRef) and `isPreviewPlaying` (useState) state
- On play: fetch signed URL for `currentSlide.audio_url` from `lecture-audio` bucket, create Audio element, play
- On pause: pause and reset
- Stop audio on slide change, dialog close, component unmount
- Show button only when `hasAudio && currentSlide.audio_url` exists
- Uses the same `supabase.storage.from('lecture-audio').createSignedUrl()` pattern already working in StudentSlideViewer

Footer layout becomes:
```text
[Previous] [Play/Pause] [3 / 12 (~8 min)] [Next]
```

### 7. Update: `supabase/functions/_shared/openrouter-client.ts`

Deprecation comments only on MODELS.AUDIO and MODELS.AUDIO_HD (lines 126-131). No logic changes -- these constants remain for reference but are no longer called.

## Files Summary

| File | Change |
|------|--------|
| `supabase/functions/_shared/tts-client.ts` | New: Google Cloud TTS client with chunking and retry |
| `supabase/functions/generate-lecture-audio/index.ts` | Replace GPT Audio with Google TTS, remove WAV header construction, simplify audit |
| `src/components/slides/VoicePicker.tsx` | Chirp 3: HD voice names |
| `src/components/slides/LectureSlideViewer.tsx` | Default voice + instructor audio preview button |
| `src/hooks/lectureSlides/audio.ts` | Default voice to Charon |
| `supabase/functions/_shared/validators/index.ts` | Accept new voice IDs |
| `supabase/functions/_shared/openrouter-client.ts` | Deprecation comments only |

## What Stays the Same

- AI narration generation (CMM persona via Gemini/OpenRouter) -- working correctly
- Storage upload with upsert -- unchanged
- `audio_audit_log` column (already added in previous migration) -- reused
- Duration calculation from PCM bytes -- same math
- Student playback (StudentSlideViewer.tsx) -- unchanged, reads same WAV files
- Segment mapping -- unchanged, receives duration as parameter
- Cache-busting via `audio_generated_at` -- unchanged

## No New Credentials Required

`GOOGLE_CLOUD_API_KEY` is already configured and actively used by `unified-ai-client.ts`, `process-syllabus`, `parse-syllabus-document`, `fetch-video-metadata`, `add-manual-content`, and `youtube-api-search`.

## Verification

- **Deterministic output**: Generate audio, listen -- spoken words must match speaker_notes exactly
- **Instructor preview**: Click play in footer -- audio plays for current slide, stops on slide change
- **Voice quality**: Test Chirp 3: HD voices -- verify natural, realistic teaching tone
- **Long text chunking**: Slides with >5000 bytes narration produce seamless audio
- **Sync highlighting**: Student viewer highlighting ends precisely when audio ends
- **Regeneration**: Old WAVs overwritten, audit log replaced, timestamps updated

