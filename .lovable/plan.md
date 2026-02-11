

# Comprehensive Fix: Layout, Audio Sync, and Audio Leak

## 4 Issues to Fix

### Issue 1: Layout -- Image consumes half the viewport, pushing text out of view

**Evidence:** The hero image renders at `max-h-[500px]` (line 243). On a typical 900px viewport (after header + footer), that's 55% of the available space consumed by a single image. The student sees half the image and the top of the text below it -- never both together.

**Fix:** Restructure each section to use a **side-by-side layout on desktop** (image floated right at a smaller size) and **compact stacked layout on mobile** (image capped at 250px). This way the student sees the visual AND the narrative text simultaneously, like a textbook page.

In `NarratedScrollViewer.tsx`, change the current stacked layout (image block above title+text) to:

- **Desktop (sm+):** Wrap image + text content in a flex row. Image sits to the right at `max-w-[280px]`, text fills the left. Title stays full-width above both.
- **Mobile:** Image renders above text but capped at `max-h-[250px]` instead of 500px.

```text
Before (stacked, image dominates):
  [---------- Hero Image (500px) ----------]
  [Title                                    ]
  [Main text paragraph                      ]

After (side-by-side on desktop):
  [Title                                    ]
  [Main text paragraph  |  Image (280px)    ]
  [Key points           |                   ]
```

### Issue 2: Arrow buttons don't move narration

**Evidence:** `StudentSlideViewer.tsx` lines 298-306 -- `jumpToSection` calls `scrollIntoView` but never updates `currentSlideIndex`. Audio playback (line 92) depends entirely on `currentSlideIndex`.

**Fix:** Add `setCurrentSlideIndex(targetIndex)` and `audioRef.current.pause()` inside `jumpToSection`.

### Issue 3: Manual scrolling doesn't move narration

**Evidence:** `StudentSlideViewer.tsx` lines 290-295 -- `handleScrollSlideVisible` updates `visibleScrollSlideIndex` but never `currentSlideIndex`.

**Fix:** Add `setCurrentSlideIndex(index)` inside `handleScrollSlideVisible` when `index !== currentSlideIndex`.

### Issue 4: Audio continues after page navigation

**Evidence:** The audio cleanup only runs inside the `currentSlideIndex` effect (line 92). When React Router navigates away, the component unmounts, but the `Audio` object created asynchronously inside `playAudioWithSignedUrl` may resolve after unmount. Setting `isMounted = false` prevents state updates but doesn't stop playback of an already-playing audio.

**Fix:** Add a dedicated top-level unmount `useEffect` that pauses audio and sets `src = ''` to force the browser to release the resource:

```text
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  };
}, []);
```

## Files Modified

| File | Changes |
|------|---------|
| `src/components/slides/NarratedScrollViewer.tsx` | Side-by-side layout for image + text; reduce image max-height on mobile |
| `src/components/slides/StudentSlideViewer.tsx` | `jumpToSection` syncs audio; `handleScrollSlideVisible` syncs audio; unmount cleanup effect |

## What Does NOT Change

- All backend edge functions (generation, audio, images, queue)
- Instructor viewer (`LectureSlideViewer.tsx`)
- Classic slides mode (`SlideRenderer.tsx`)
- `useSlideSync.ts` hook
- Data model, storage buckets, RLS policies
- Composite block IDs and scroll sync effects (already implemented)

