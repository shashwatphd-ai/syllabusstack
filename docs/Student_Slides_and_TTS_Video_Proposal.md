# Student Slides Access & TTS Video Lecture Proposal

## Current State Analysis

### How Slides Currently Reach Students

**The flow is already implemented:**

1. **Instructor Creates Slides** (`generate-lecture-slides-v3`)
   - Generates ProfessorSlide[] with speaker_notes (200-300 word narration scripts)
   - AI creates custom visuals via Lovable AI image generation
   - Status: `generating` → `ready`

2. **Instructor Publishes Slides** (`usePublishLectureSlides`)
   - Changes status from `ready` → `published`
   - `LectureSlideViewer.tsx` has a publish button in the header

3. **Student Access** (`LearningObjective.tsx`)
   - Queries `lecture_slides` WHERE `status = 'published'`
   - Displays published slides in a "Lecture Slides" card section
   - Opens `StudentSlideViewer` on click

4. **Student Viewing** (`StudentSlideViewer.tsx`)
   - Full-screen slide navigation
   - Optional "Transcript" toggle to show speaker_notes
   - Auto-play mode with timer-based advance
   - Progress tracking via `highestSlideViewed`

### What's Working Now
- ✅ Slide generation (v3 Professor AI + Visual AI)
- ✅ Publishing workflow (instructor control)
- ✅ Student access to published slides
- ✅ Manual slide navigation
- ✅ Speaker notes/transcript display
- ✅ YouTube video content alongside slides

### ⚠️ Important: Slides Must Be Published
**Students can only see slides with `status = 'published'`**. 
Currently generated slides have `status = 'ready'` until the instructor clicks "Publish".

### What's Missing for TTS Video
- ❌ Audio generation from speaker_notes
- ❌ Audio playback synchronized with slides
- ❌ Video export combining slides + audio
- ❌ Storage bucket for audio files

---

## TTS Provider Comparison

| Feature | ElevenLabs | **Google Cloud WaveNet** |
|---------|------------|--------------------------|
| **Free Tier** | 10,000 chars/month | **4,000,000 chars/month** |
| **Paid Rate** | ~$0.30/1K chars | **$0.004/1K chars** |
| **10-slide lecture (~15K chars)** | ~$3.75 | **~$0.06** |
| **Voice Quality** | Excellent | Very Good |
| **Cost Reduction** | - | **98%** |

**Recommendation**: Use **Google Cloud WaveNet** for massive cost savings.

---

## Database Schema (Already Prepared)

The schema **already supports** TTS audio:

```sql
-- lecture_slides table
has_audio BOOLEAN DEFAULT false,
audio_status TEXT CHECK (audio_status IS NULL OR audio_status IN ('pending', 'generating', 'ready', 'failed')),

-- Within slides JSONB array (per-slide):
audio_url?: string;
audio_duration_seconds?: number;
```

The `Slide` TypeScript interface already includes:
```typescript
interface Slide {
  // ... other fields
  speaker_notes: string;           // ← TTS input (already generated!)
  audio_url?: string;              // ← TTS output URL
  audio_duration_seconds?: number; // ← For sync
}
```

---

## Proposal: Two-Phase Implementation

### Phase 1: TTS Audio Generation (Google Cloud WaveNet)

**Goal**: Generate audio narration for each slide from speaker_notes

**Approach**: Use Google Cloud Text-to-Speech WaveNet (higher quality neural voices)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Audio Generation Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Instructor clicks "Generate Audio" on ready slides             │
│                         │                                        │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Edge Function: generate-lecture-audio                   │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  1. Fetch lecture_slides record                          │    │
│  │  2. For each slide with speaker_notes:                   │    │
│  │     a. Call Google Cloud TTS WaveNet API                 │    │
│  │     b. Upload audio to Supabase Storage                  │    │
│  │     c. Update slide.audio_url and audio_duration_seconds │    │
│  │  3. Update has_audio = true, audio_status = 'ready'      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                         │                                        │
│                         ▼                                        │
│  Student hears professor narration synced with each slide       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Components Needed:**

| Component | Type | Description |
|-----------|------|-------------|
| `GOOGLE_CLOUD_API_KEY` | Secret | TTS API key |
| `generate-lecture-audio` | Edge Function | Process slides, generate audio |
| `lecture-audio` | Storage Bucket | Store generated MP3 files |
| `useGenerateLectureAudio` | Hook | Trigger audio generation |
| `LectureSlideViewer` update | UI | Add "Generate Audio" button |
| `StudentSlideViewer` update | UI | Audio playback controls |

**Cost Estimate:**
- Google Cloud WaveNet: $4.00/1,000,000 chars
- Average slide: 250 words × 5 chars = 1,250 chars
- 10 slides ≈ 12,500 chars ≈ **$0.05 per lecture**
- **FREE for first 4 million characters/month** (~320 lectures)

---

### Phase 2: Video Export (Optional Enhancement)

**Goal**: Export lecture as downloadable MP4 video

**Two Approaches:**

#### Option A: Client-Side Capture (Simpler)
- Use MediaRecorder API in browser
- Instructor "records" the auto-play presentation
- No server-side video processing needed
- Works with existing slide renderer

#### Option B: Server-Side FFmpeg (More Complex)
- Generate static images for each slide
- Stitch with audio using FFmpeg in containerized function
- Requires more infrastructure (larger edge function, ffmpeg binary)
- Better for batch processing

**Recommendation**: Start with Option A (client-side), upgrade later if needed.

---

## Detailed File Changes

### Phase 1: TTS Audio

#### 1. New Secret
```
GOOGLE_CLOUD_API_KEY
```

#### 2. New Storage Bucket
```sql
-- Migration
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lecture-audio', 'lecture-audio', true);

CREATE POLICY "Anyone can read lecture audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'lecture-audio');

CREATE POLICY "Service role can insert audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lecture-audio');
```

#### 3. New Edge Function: `generate-lecture-audio`
```
supabase/functions/generate-lecture-audio/index.ts
```

**Logic:**
1. Receive `slideId` 
2. Update `audio_status = 'generating'`
3. Loop through slides with speaker_notes
4. Call Google Cloud TTS for each slide:
   ```typescript
   const response = await fetch(
     `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_API_KEY}`,
     {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         input: { text: speakerNotes },
         voice: {
           languageCode: 'en-US',
           name: 'en-US-Wavenet-D',  // Deep male professor voice
           ssmlGender: 'MALE'
         },
         audioConfig: {
           audioEncoding: 'MP3',
           pitch: -2.0,           // Slightly lower for authority
           speakingRate: 0.95     // Slightly slower for clarity
         }
       })
     }
   );
   
   const data = await response.json();
   // data.audioContent is Base64-encoded MP3
   ```
5. Upload to `lecture-audio/{slideId}/{order}.mp3`
6. Update slide JSON with `audio_url` and duration
7. Set `has_audio = true`, `audio_status = 'ready'`

#### 4. New Hook: `useGenerateLectureAudio`
```typescript
// src/hooks/useLectureSlides.ts (add to existing file)
export function useGenerateLectureAudio() {
  return useMutation({
    mutationFn: async ({ slideId, voice }: { slideId: string; voice?: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-lecture-audio', {
        body: { slideId, voice }
      });
      if (error) throw error;
      return data;
    },
    // ...invalidation and toast
  });
}
```

#### 5. Update `LectureSlideViewer.tsx`
Add button in header controls:
```tsx
{lectureSlide.status === 'ready' && !lectureSlide.has_audio && (
  <Button onClick={() => generateAudio.mutate({ slideId: lectureSlide.id })}>
    <Volume2 className="h-4 w-4 mr-1" />
    Generate Audio
  </Button>
)}
```

#### 6. Update `StudentSlideViewer.tsx`
Add audio playback:
```tsx
const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

useEffect(() => {
  if (lectureSlide.has_audio) {
    const slide = slides[currentSlideIndex];
    if (slide.audio_url) {
      const audio = new Audio(slide.audio_url);
      audio.play();
      audio.onended = () => goToNextSlide();
      setCurrentAudio(audio);
      return () => audio.pause();
    }
  }
}, [currentSlideIndex, lectureSlide.has_audio]);
```

---

## Voice Options (Google Cloud WaveNet)

| Voice Name | Description | Use Case |
|------------|-------------|----------|
| `en-US-Wavenet-D` | Deep male | **Default professor voice** |
| `en-US-Wavenet-F` | Female | Alternative professional |
| `en-US-Wavenet-J` | Male, casual | Informal lectures |
| `en-GB-Wavenet-B` | British male | Academic/formal |

---

## Dependencies Map

```
┌────────────────────────────────────────────────────────────────────┐
│                     DEPENDENCY CHAIN                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  EXISTING (No Changes Needed):                                      │
│  ├─ lecture_slides table schema ✓                                   │
│  ├─ Slide interface with audio_url ✓                                │
│  ├─ StudentSlideViewer with hasAudio state ✓                        │
│  └─ Speaker notes already generated by v3 ✓                         │
│                                                                     │
│  PHASE 1 ADDITIONS:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. GOOGLE_CLOUD_API_KEY secret                              │   │
│  │    └─ Required by: generate-lecture-audio                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              │                                                      │
│              ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 2. Storage bucket: lecture-audio                             │   │
│  │    └─ Required by: generate-lecture-audio (upload)          │   │
│  │    └─ Required by: StudentSlideViewer (playback)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              │                                                      │
│              ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 3. Edge function: generate-lecture-audio                     │   │
│  │    └─ Depends on: GOOGLE_CLOUD_API_KEY                      │   │
│  │    └─ Depends on: lecture-audio bucket                      │   │
│  │    └─ Updates: lecture_slides.slides[].audio_url            │   │
│  │    └─ Updates: lecture_slides.has_audio, audio_status       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              │                                                      │
│              ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 4. Hook: useGenerateLectureAudio                             │   │
│  │    └─ Calls: generate-lecture-audio                         │   │
│  │    └─ Invalidates: lecture-slides queries                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              │                                                      │
│              ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 5. LectureSlideViewer.tsx update                             │   │
│  │    └─ Uses: useGenerateLectureAudio hook                    │   │
│  │    └─ Shows: "Generate Audio" button                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              │                                                      │
│              ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 6. StudentSlideViewer.tsx update                             │   │
│  │    └─ Reads: slide.audio_url                                │   │
│  │    └─ Plays: Audio per slide                                │   │
│  │    └─ Syncs: Auto-advance when audio ends                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Cost Comparison

| Usage Level | Characters/Month | ElevenLabs | Google Cloud |
|-------------|------------------|------------|--------------|
| Light (10 lectures) | 150,000 | $45 | **FREE** |
| Medium (100 lectures) | 1,500,000 | $450 | **FREE** |
| Heavy (500 lectures) | 7,500,000 | $2,250 | **~$14** |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google Cloud API rate limits | Audio generation fails | Batch with delays, retry logic |
| Large audio files | Slow playback | Use MP3 128kbps, streaming |
| Cost overrun | Unexpected bills | 4M chars free, show estimate |
| Broken existing slides | Students can't view | All changes additive |
| Audio out of sync | Poor UX | Use audio_duration_seconds |

---

## Implementation Order

1. **Verify existing flow** - Confirm students see published slides ✅
2. **Add GOOGLE_CLOUD_API_KEY** - Get from Google Cloud Console
3. **Create storage bucket** - Migration + policies
4. **Build edge function** - TTS generation
5. **Add hook** - Frontend integration
6. **Update instructor UI** - Generate Audio button
7. **Update student UI** - Audio playback
8. **Test end-to-end** - Full flow verification

---

## Questions Before Implementation

1. **Voice Selection**: Should instructors choose a voice, or use single "professor" voice?
2. **Regeneration**: Allow regenerating audio for individual slides?
3. **Bulk Generation**: Generate audio for all slides in a course at once?

---

## Summary

The infrastructure for student slide access is **already complete**. The TTS enhancement requires:
- 1 secret (GOOGLE_CLOUD_API_KEY)
- 1 storage bucket (lecture-audio)
- 1 new edge function (generate-lecture-audio)
- 1 new hook (useGenerateLectureAudio)
- 2 component updates (add audio button + playback)

**No breaking changes** to existing functionality. All additions are opt-in.

**Cost**: Essentially **FREE** for most use cases (4M chars/month free tier = ~320 lectures).