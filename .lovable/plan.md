

## Plan: Professor Presentation View + Branded Video Download

### Scope

Two features:
1. **Professor Presentation Mode** — Add Cinema mode to the instructor's `LectureSlideViewer` so professors can preview exactly what students see.
2. **Branded Video Download** — Allow professors to download a YouTube-ready MP4 of their lecture, branded with SyllabusStack and built-in viewer attention mechanisms.

---

### Part 1: Professor Presentation View

**File: `src/components/slides/LectureSlideViewer.tsx`**

- Add a `viewMode` state: `'editor' | 'presentation'` (default: `'editor'`, the current view)
- Add a "Preview" button (Play/Clapperboard icon) in the header toolbar that switches to `viewMode === 'presentation'`
- When in presentation mode, render `<PresentationPlayer>` (same component students use) instead of the editor layout
- Wire up the existing audio state (selectedVoice, audioRef, etc.) into PresentationPlayer props
- Pass `onSwitchMode` callback that returns to `'editor'` mode
- No changes to `PresentationPlayer.tsx` — it already supports all needed props including `onSwitchMode`

**File: `src/components/instructor/UnifiedLOCard.tsx`** — No changes needed; it already passes the right props to `LectureSlideViewer`.

---

### Part 2: Branded Video Download

This is a server-side video generation feature using an edge function that orchestrates image+audio compositing.

**Architecture:**

```text
Professor clicks "Download Video"
  → Edge function `render-lecture-video` triggered
  → Fetches slide images (signed URLs from lecture-visuals bucket)
  → Fetches per-slide audio files (signed URLs from lecture-audio bucket)
  → Composites using FFmpeg (via npm:@ffmpeg/ffmpeg WASM build)
  → Adds SyllabusStack branding overlays:
      - Intro slide (3s): Logo + course title + unit title
      - Persistent watermark: Small logo bottom-right corner
      - Outro slide (4s): Logo + "Created with SyllabusStack" + course URL
  → YouTube attention mechanisms baked in:
      - Slide transition animations (cross-fade 0.3s)
      - Chapter markers metadata (timestamps per slide for YouTube chapters)
      - First 5 seconds hook (title card with topic preview)
      - Visual variety via alternating zoom/pan on static slides
  → Uploads MP4 to storage, returns signed download URL
```

**However**, FFmpeg WASM in Deno edge functions has significant memory/time constraints (max 60s execution, ~150MB memory). For a real production pipeline, Cloud Run is the right choice per the existing architecture decision.

**Pragmatic Phase 1 approach** (client-side):
- Use the browser's `MediaRecorder` API + `OffscreenCanvas` to record the PresentationPlayer as it plays through slides
- Add a "Download Video" button in the professor's toolbar
- When clicked, programmatically play through all slides in a hidden canvas, compositing:
  - Each slide image rendered at 1920x1080
  - Audio track from the lecture-audio bucket
  - SyllabusStack branded intro/outro frames
  - Watermark overlay (logo bottom-right, semi-transparent)
- Output as WebM (MediaRecorder's native format), with option to use `mp4-muxer` for MP4

**YouTube Attention Mechanisms (universal, topic-agnostic):**
- **Hook frame** (0-5s): Bold topic title + "What you'll learn" bullet from slide 1 speaker notes
- **Chapter markers**: Generate YouTube-compatible description with timestamps
- **Visual motion**: Ken Burns effect (slow zoom/pan) on each slide to avoid static frames
- **Progress indicator**: Subtle progress bar at bottom of each frame
- **Branded lower-third**: Semi-transparent bar showing current topic/section name
- **End screen**: Call-to-action with logo, course name, and QR code placeholder

**New files:**
- `src/lib/videoExporter.ts` — Client-side video rendering engine
  - `renderLectureVideo(slides, audioUrls, branding)` → returns Blob
  - Handles canvas compositing, audio mixing, MediaRecorder capture
  - Adds intro/outro frames, watermark, Ken Burns motion
  - Generates YouTube chapter description text
- `src/components/slides/VideoExportButton.tsx` — UI component
  - Shows progress during export (slide X of Y)
  - Downloads the video file + copies chapter markers to clipboard
  - Integrated into `LectureSlideViewer` header

**File: `src/components/slides/LectureSlideViewer.tsx`** — Add `VideoExportButton` to the header toolbar, passing slides, audio data, title, and branding info.

---

### Files Changed Summary

| File | Change |
|---|---|
| `src/components/slides/LectureSlideViewer.tsx` | Add presentation mode toggle + VideoExportButton |
| `src/lib/videoExporter.ts` | New — client-side video rendering engine |
| `src/components/slides/VideoExportButton.tsx` | New — download button with progress UI |

No database changes. No edge function changes. No changes to existing components (PresentationPlayer, SlideRenderer, StudentSlideViewer).

