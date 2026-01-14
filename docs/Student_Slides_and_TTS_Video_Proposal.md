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
   - Already queries `lecture_slides` WHERE `status = 'published'`
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

### What's Missing for TTS Video
- ❌ Audio generation from speaker_notes
- ❌ Audio playback synchronized with slides
- ❌ Video export combining slides + audio
- ❌ Storage bucket for audio files

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

### Phase 1: TTS Audio Generation (Professor Voice)

**Goal**: Generate audio narration for each slide from speaker_notes

**Approach**: Use ElevenLabs TTS (higher quality, professor-like voice)

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
│  │     a. Call ElevenLabs TTS API                           │    │
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
| `ELEVENLABS_API_KEY` | Secret | TTS API key |
| `generate-lecture-audio` | Edge Function | Process slides, generate audio |
| `lecture-audio` | Storage Bucket | Store generated MP3 files |
| `useGenerateLectureAudio` | Hook | Trigger audio generation |
| `LectureSlideViewer` update | UI | Add "Generate Audio" button |
| `StudentSlideViewer` update | UI | Audio playback controls |

**Cost Estimate:**
- ElevenLabs: ~$0.30/1000 chars (11 Labs Starter)
- Average slide: 250 words × 5 chars = 1,250 chars
- 10 slides ≈ 12,500 chars ≈ $3.75 per lecture

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
ELEVENLABS_API_KEY
```

#### 2. New Storage Bucket
```sql
-- Migration
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lecture-audio', 'lecture-audio', true);

CREATE POLICY "Authenticated users can read audio"
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
4. Call ElevenLabs streaming TTS for each
5. Upload to `lecture-audio/{slideId}/{order}.mp3`
6. Update slide JSON with `audio_url` and duration
7. Set `has_audio = true`, `audio_status = 'ready'`

#### 4. New Hook: `useGenerateLectureAudio`
```typescript
// src/hooks/useLectureSlides.ts (add to existing file)
export function useGenerateLectureAudio() {
  return useMutation({
    mutationFn: async (slideId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-lecture-audio', {
        body: { slideId }
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
  <Button onClick={() => generateAudio.mutate(lectureSlide.id)}>
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
  if (lectureSlide.has_audio && hasAudio) {
    const slide = slides[currentSlideIndex];
    if (slide.audio_url) {
      const audio = new Audio(slide.audio_url);
      audio.play();
      setCurrentAudio(audio);
      return () => audio.pause();
    }
  }
}, [currentSlideIndex, hasAudio, lectureSlide.has_audio]);
```

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
│  │ 1. ELEVENLABS_API_KEY secret                                 │   │
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
│  │    └─ Depends on: ELEVENLABS_API_KEY                        │   │
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
│  │    └─ Syncs: Auto-advance based on audio duration           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ElevenLabs API rate limits | Audio generation fails | Queue slides, retry logic |
| Large audio files | Slow playback | Use MP3 128kbps, streaming |
| Cost per lecture | Unexpected bills | Show cost estimate before generating |
| Broken existing slides | Students can't view | All changes additive, existing flows untouched |
| Audio out of sync | Poor UX | Use audio_duration_seconds for timing |

---

## Implementation Order

1. **Verify existing flow** - Confirm students see published slides ✅
2. **Add ELEVENLABS_API_KEY** - Collect from instructor
3. **Create storage bucket** - Migration + policies
4. **Build edge function** - TTS generation
5. **Add hook** - Frontend integration
6. **Update instructor UI** - Generate Audio button
7. **Update student UI** - Audio playback
8. **Test end-to-end** - Full flow verification

---

## Questions Before Implementation

1. **Voice Selection**: Should instructors choose a voice, or use a single "professor" voice?
2. **Cost Model**: Should audio generation be included in subscription, or usage-based?
3. **Video Export**: Is Phase 2 (video export) a priority, or should we focus on audio-only first?
4. **Multiple Languages**: Any need for multilingual TTS?

---

## Summary

The infrastructure for student slide access is **already complete**. The TTS enhancement requires:
- 1 secret (ELEVENLABS_API_KEY)
- 1 storage bucket (lecture-audio)
- 1 new edge function (generate-lecture-audio)
- 1 new hook (useGenerateLectureAudio)
- 2 component updates (add audio button + playback)

**No breaking changes** to existing functionality. All additions are opt-in (instructor triggers audio generation).
