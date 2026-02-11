

# Expanded Plan: Switch Audio to OpenAI GPT Audio via OpenRouter

## Current Pipeline (4 Phases per Slide)

```text
Phase 1: AI Narration
  ai-narrator.ts -> simpleCompletion(MODELS.FAST) -> 150-250 word lecture script
  Uses: OPENROUTER_API_KEY (gpt-4o-mini with Gemini Flash fallback)

Phase 2: SSML Transformation
  ssml-transformer.ts -> simpleCompletion(MODELS.FAST) -> SSML-wrapped narration
  Uses: OPENROUTER_API_KEY (separate AI call per slide)
  Purpose: Add <break>, <emphasis>, <prosody> tags for Google TTS

Phase 3: Google Cloud TTS
  texttospeech.googleapis.com/v1/text:synthesize -> base64 MP3
  Uses: GOOGLE_CLOUD_API_KEY
  Voice: en-US-Neural2-D (male, $16/1M chars)
  Problem: Reads URLs letter-by-letter, reads "[Source 1]" literally, robotic

Phase 4: Segment Mapping
  segment-mapper.ts -> simpleCompletion(MODELS.FAST) -> JSON segment map
  Uses: OPENROUTER_API_KEY
  Purpose: Maps narration to content blocks for synchronized highlighting
```

**Cost per slide**: 3 OpenRouter calls (narration + SSML + mapping) + 1 Google TTS call

## New Pipeline (3 Phases per Slide)

```text
Phase 1: AI Narration (UNCHANGED)
  ai-narrator.ts -> simpleCompletion(MODELS.FAST) -> 150-250 word lecture script
  Uses: OPENROUTER_API_KEY (same as before)

Phase 2: REMOVED -- No SSML needed
  GPT Audio handles prosody natively. URLs and citations are read intelligently.

Phase 3: GPT Audio TTS (REPLACES Google Cloud TTS)
  callOpenRouter(MODELS.AUDIO) with modalities: ["text", "audio"]
  Uses: OPENROUTER_API_KEY (same key, different model)
  Voice: Selectable (onyx, nova, echo, alloy, fable, shimmer)
  Response: message.audio.data (base64 WAV) -> convert and upload as MP3/WAV

Phase 4: Segment Mapping (UNCHANGED)
  segment-mapper.ts -> simpleCompletion(MODELS.FAST) -> JSON segment map
```

**Cost per slide**: 2 OpenRouter calls (narration + mapping) + 1 OpenRouter audio call
**Net effect**: Removes 1 AI call (SSML) and replaces Google TTS with OpenRouter audio

## Why Phase 2 (SSML) Is Fully Removed

The SSML transformer exists solely to prepare text for Google Cloud TTS, which is a "dumb" reader -- it needs explicit markup to know where to pause, emphasize, or adjust pitch. GPT Audio is an AI model that:
- Understands sentence structure and adds natural pauses
- Recognizes URLs and abbreviations -- says "the linked resource" or contextualizes them
- Handles emphasis, tone shifts, and pacing based on semantic understanding
- Does not accept or need SSML input

The `ssml-transformer.ts` file is NOT deleted (other functions might reference `isSSML` or `stripSSML`), but its `transformToSSML` function is no longer called from the audio pipeline.

## Risk Assessment: Does OpenRouter Proxy Audio Output?

**Evidence it works:**
- OpenRouter's model page for `openai/gpt-audio-mini` lists it with audio token pricing ($0.60/M)
- OpenRouter docs show audio input support; the model itself supports audio output via `modalities: ["text", "audio"]`
- The OpenAI Chat Completions API format with `modalities` and `audio` parameters is the standard interface
- Multiple open-source projects (open-webui) are requesting/implementing this exact flow

**Mitigation**: Step 0 is a live test call before any code changes. If it fails, we fall back to ElevenLabs (connector already available).

## Detailed File Changes

### File 1: `supabase/functions/_shared/openrouter-client.ts`

**What changes:**
- Add `AUDIO` and `AUDIO_HD` to the `MODELS` constant
- Add `modalities` and `audio` fields to `OpenRouterOptions` interface
- Add `audio` field to `OpenRouterResponse.choices[].message`
- Pass `modalities` and `audio` through in `callOpenRouter`'s request body builder

**Specific additions to MODELS (after line 124):**
```typescript
// AUDIO GENERATION - Text-to-Speech via GPT Audio
AUDIO: 'openai/gpt-audio-mini',          // Cost-efficient, natural voices
AUDIO_HD: 'openai/gpt-audio',            // Higher quality, more expensive
```

**Specific additions to OpenRouterOptions (after line 192):**
```typescript
// Audio output support
modalities?: string[];                    // e.g., ['text', 'audio']
audio?: {
  voice: string;                          // onyx, nova, echo, alloy, fable, shimmer
  format: string;                         // 'wav' or 'pcm16'
};
```

**Specific additions to OpenRouterResponse message (line 217):**
```typescript
audio?: {
  id: string;
  data: string;          // base64-encoded audio
  transcript?: string;   // text transcript of the audio
  expires_at: number;
};
```

**Specific additions to callOpenRouter body builder (after line 333):**
```typescript
if (options.modalities) {
  body.modalities = options.modalities;
}
if (options.audio) {
  body.audio = options.audio;
}
```

### File 2: `supabase/functions/generate-lecture-audio/index.ts`

This is the largest change. The entire Phase 2 (SSML) and Phase 3 (Google TTS) blocks are replaced.

**Imports removed:**
- `import { transformToSSML, isSSML } from "../_shared/ssml-transformer.ts";` (line 4)

**Imports added:**
- `import { callOpenRouter, MODELS } from "../_shared/openrouter-client.ts";`

**Validation change (line 85):**
```typescript
// BEFORE:
const { slideId, voice = 'en-US-Neural2-D', enableSSML, enableSegmentMapping } = validation.data;

// AFTER:
const { slideId, voiceId = 'onyx', enableSegmentMapping } = validation.data;
```

**API key check change (lines 87-90):**
```typescript
// BEFORE: Checks GOOGLE_CLOUD_API_KEY for TTS
// AFTER: Checks OPENROUTER_API_KEY (already validated inside callOpenRouter, 
//        but we check early to fail fast before processing slides)
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
if (!OPENROUTER_API_KEY) {
  return createErrorResponse('CONFIG_ERROR', corsHeaders, 'OPENROUTER_API_KEY not configured');
}
```

**Phase 1 (AI narration, lines 136-162):**
- `GOOGLE_CLOUD_API_KEY` guard replaced with `OPENROUTER_API_KEY` guard
- `generateNarration()` call stays identical (it already uses OpenRouter internally)

**Phase 2 (SSML, lines 170-198):**
- Entire block REMOVED. No SSML transformation needed.

**Phase 3 (TTS, lines 202-257) -- REPLACED with:**
```typescript
// PHASE 3: Generate audio via GPT Audio (OpenRouter)
const audioResponse = await callOpenRouter({
  model: MODELS.AUDIO,
  messages: [
    {
      role: 'system',
      content: 'You are a professional lecturer. Read the following narration naturally and engagingly. Do not add any commentary or changes to the text -- just read it aloud exactly as written.',
    },
    {
      role: 'user',
      content: narrationText,
    },
  ],
  modalities: ['text', 'audio'],
  audio: { voice: voiceId, format: 'wav' },
  fallbacks: [MODELS.AUDIO_HD],
}, '[Audio TTS]');

const audioData = audioResponse.choices[0]?.message?.audio?.data;
if (!audioData) {
  throw new Error('No audio data in GPT Audio response');
}

// Decode base64 WAV to bytes
const binaryString = atob(audioData);
const bytes = new Uint8Array(binaryString.length);
for (let j = 0; j < binaryString.length; j++) {
  bytes[j] = binaryString.charCodeAt(j);
}

// Upload to Supabase Storage (WAV format, browsers natively support it)
const fileName = `${slideId}/slide_${i}.wav`;
const { error: uploadError } = await supabase.storage
  .from('lecture-audio')
  .upload(fileName, bytes, {
    contentType: 'audio/wav',
    upsert: true,
  });
```

**Note on file format**: The file extension changes from `.mp3` to `.wav` since GPT Audio outputs WAV. Browsers natively play WAV files. The student-side `StudentSlideViewer.tsx` creates `new Audio(signedUrl)` which handles both formats transparently.

**Phase 4 (Segment mapping, lines 265-284):**
- Only change: `GOOGLE_CLOUD_API_KEY` guard replaced with `OPENROUTER_API_KEY` guard (though `mapAudioSegments` already uses OpenRouter internally and ignores the API key parameter).

### File 3: `supabase/functions/_shared/validators/index.ts`

**Lines 167-172 -- Update `lectureAudioSchema`:**
```typescript
// BEFORE:
export const lectureAudioSchema = z.object({
  slideId: uuidSchema,
  voice: z.string().optional().default('en-US-Neural2-D'),
  enableSSML: z.boolean().optional().default(true),
  enableSegmentMapping: z.boolean().optional().default(true),
});

// AFTER:
export const lectureAudioSchema = z.object({
  slideId: uuidSchema,
  voiceId: z.enum(['onyx', 'nova', 'echo', 'alloy', 'fable', 'shimmer'])
    .optional()
    .default('onyx'),
  enableSegmentMapping: z.boolean().optional().default(true),
});
```

### File 4: `src/hooks/lectureSlides/audio.ts`

**Update hook parameter (lines 21-27):**
```typescript
// BEFORE:
mutationFn: async ({
  slideId,
  voice = 'en-US-Wavenet-D'
}: {
  slideId: string;
  voice?: string;
}) => {

// AFTER:
mutationFn: async ({
  slideId,
  voiceId = 'onyx'
}: {
  slideId: string;
  voiceId?: string;
}) => {
```

**Update body (line 31):**
```typescript
// BEFORE:
body: { slideId, voice }

// AFTER:
body: { slideId, voiceId }
```

**Update JSDoc (line 14):**
```typescript
// BEFORE:
/** Generate TTS audio for lecture slides using Google Cloud WaveNet */

// AFTER:
/** Generate TTS audio for lecture slides using GPT Audio via OpenRouter */
```

### File 5: `src/components/slides/VoicePicker.tsx` (NEW)

A simple Select component displaying voice options with personality descriptions:

| Voice | Display Name | Description |
|-------|-------------|-------------|
| onyx | Professor Onyx | Deep, authoritative (default) |
| nova | Dr. Nova | Warm, friendly |
| echo | Dr. Echo | Clear, measured |
| alloy | Prof. Alloy | Balanced, neutral |
| fable | Dr. Fable | Expressive, storytelling |
| shimmer | Prof. Shimmer | Calm, reassuring |

The component accepts `value` and `onValueChange` props, rendering a shadcn/ui `Select` dropdown.

### File 6: `src/components/slides/LectureSlideViewer.tsx`

**Add state for selected voice (after line 55):**
```typescript
const [selectedVoice, setSelectedVoice] = useState<string>('onyx');
```

**Update handleGenerateAudio (line 139-141):**
```typescript
// BEFORE:
generateAudio.mutate({ slideId: lectureSlide.id });

// AFTER:
generateAudio.mutate({ slideId: lectureSlide.id, voiceId: selectedVoice });
```

**Add VoicePicker next to Generate Audio button (before the button, around line 190):**
```tsx
{!hasAudio && audioStatus !== 'generating' && (
  <VoicePicker value={selectedVoice} onValueChange={setSelectedVoice} />
)}
```

## What Does NOT Change

| Component | Why unchanged |
|-----------|---------------|
| `ai-narrator.ts` | Phase 1 narration generation -- already uses OpenRouter, untouched |
| `ssml-transformer.ts` | File remains for utility exports (`isSSML`, `stripSSML`), but `transformToSSML` is no longer called |
| `segment-mapper.ts` | Phase 4 mapping -- already uses OpenRouter internally |
| `StudentSlideViewer.tsx` | Audio playback and cleanup chain -- `new Audio(url)` plays WAV as well as MP3 |
| `useSlideSync.ts` | Sync polling -- format-agnostic |
| `NarratedScrollViewer.tsx` | Consumes same audio URLs |
| Storage bucket `lecture-audio` | Same bucket, file extension changes from .mp3 to .wav |
| `GOOGLE_CLOUD_API_KEY` | Still used by other functions (not removed from secrets) |

## Backward Compatibility

Existing slides that already have `.mp3` audio URLs stored in their `audio_url` field will continue to work. The signed URL generation in `StudentSlideViewer.tsx` is path-based and format-agnostic. New slides will get `.wav` files. Both play in all modern browsers via `HTMLAudioElement`.

## Implementation Order

1. Extend `openrouter-client.ts` with audio support (interfaces + body builder)
2. Update `validators/index.ts` schema
3. Rewrite `generate-lecture-audio/index.ts` (remove SSML phase, replace Google TTS with GPT Audio)
4. Update `audio.ts` hook (voiceId parameter)
5. Create `VoicePicker.tsx` component
6. Integrate VoicePicker into `LectureSlideViewer.tsx`
7. Deploy edge function and test end-to-end

