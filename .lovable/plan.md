

# Narrated Scroll Mode for Student Lecture Viewer

## Overview

Add a new "Narrated Scroll" viewing mode to the student lecture experience. Instead of showing one cramped slide at a time in a card with tiny text and a 40/60 split, the lecture renders as a single scrolling document with full-width hero images, generous typography, and audio-synced auto-scrolling.

Students can toggle between "Scroll" (default) and "Slides" (classic) modes. All existing content generation, audio playback, completion tracking, and data models remain untouched.

## What Changes for Students

| Aspect | Current (Slides) | New Default (Scroll) |
|--------|------------------|----------------------|
| Layout | One slide card at a time, 40/60 text/image split | All slides as continuous scrolling sections |
| Body text | 14px (text-sm) | 18px (text-lg) |
| Titles | 20px (text-xl) | 30px (text-3xl) |
| Definitions | 12px (text-xs) cramped box | 16px (text-base) full-width card |
| Key points | 16px, may be cut off behind scroll | 20px (text-xl), always visible |
| Images | 60% column, max-h 380px | Full-width hero banner above content |
| Speaker notes | 80px scrollable box, 12px | Replaced by audio-synced highlighting |
| Audio sync | Highlight may be scrolled offscreen | Page auto-scrolls to keep active block centered |
| Navigation | Prev/Next buttons + dot indicators | Free scroll + section jump buttons |

## Files to Create

### `src/components/slides/NarratedScrollViewer.tsx` (New)

The core new component. Renders all slides as a continuous scrollable document inside the existing `StudentSlideViewer` shell.

**Structure per slide section:**
1. Section divider with slide number and type badge
2. Hero image (full-width, if slide has a visual URL) using existing `AuthenticatedImage`
3. Slide title at text-3xl
4. Main text at text-lg, full width
5. Definition card (full-width, blue theme) -- reusing the same markup pattern from `SlideRenderer`
6. Key points with `SlideContentBlock` for adaptive layouts (flow, comparison, equation) -- same components
7. Example card (full-width, green theme)
8. Misconception card (full-width, red theme)
9. Steps list
10. Image lightbox on click (reusing existing `ImageLightbox`)

**Key behaviors:**
- `IntersectionObserver` on each `<section>` to detect which slide is in viewport, updating progress and `currentSlideIndex` in the parent
- When audio is playing and `activeBlockId` changes: smooth-scroll the active `data-block-id` element into view, but only if the user hasn't manually scrolled in the last 3 seconds (prevents fighting)
- Each content block gets a `data-block-id` attribute matching the `useSlideSync` IDs (`main_text`, `key_point_0`, `definition`, `example`, etc.)
- Title slides render centered with agenda items (same as current `SlideRenderer` title handling)

**Props:**
```text
slides: Slide[]
currentAudioSlideIndex: number  -- which slide's audio is playing
activeBlockId: string | null     -- from useSlideSync
citations: Citation[]
onSlideVisible: (index: number) => void  -- IntersectionObserver callback
```

## Files to Modify

### `src/components/slides/StudentSlideViewer.tsx`

Minimal changes to add the toggle and conditionally render the new viewer:

1. Add state: `viewMode: 'scroll' | 'slides'` (default `'scroll'`)
2. Add a toggle button in the header controls (between Audio and Transcript toggles) -- uses two icons: scroll-mode icon vs grid-mode icon
3. In the main content area, conditionally render:
   - `viewMode === 'scroll'`: `<NarratedScrollViewer>` with all slides, passing `activeBlockId`, `citations`, and an `onSlideVisible` callback that updates `highestSlideViewed`
   - `viewMode === 'slides'`: current `<SlideRenderer>` (unchanged)
4. Audio playback logic stays exactly where it is -- the parent still manages audio, `currentSlideIndex`, `useSlideSync`, signed URLs, completion tracking
5. When in scroll mode, the footer navigation changes from Prev/Next + dots to a section indicator ("Section 3 of 7") with Up/Down jump buttons
6. Keyboard nav adapts: in scroll mode, Up/Down arrows jump between sections; Escape still closes

### `src/components/slides/SlideRenderer.tsx`

No structural changes. The existing component continues to work identically for "Slides" mode. The `NarratedScrollViewer` will replicate the content rendering inline (definition boxes, example boxes, key points with `SlideContentBlock`) rather than wrapping `SlideRenderer` -- this avoids the card/border/header overhead and allows full-width layout.

## What Does NOT Change

- All content generation (slides, audio, images) pipelines
- The `lecture_slides` JSONB data model
- The instructor viewer (`LectureSlideViewer.tsx`)
- Audio playback logic, signed URL resolution in `StudentSlideViewer`
- Completion tracking (`onComplete`, `highestSlideViewed`)
- `useSlideSync` hook (reused as-is)
- `AuthenticatedImage`, `CitationText`, `ImageLightbox`, `SlideContentBlock` components
- The `StudentSlidePage.tsx` page component

## Technical Details

### Audio-Scroll Sync Logic

```text
NarratedScrollViewer receives activeBlockId from parent.

When activeBlockId changes AND audio is playing:
  1. Find DOM element: document.querySelector(`[data-block-id="${activeBlockId}"]`)
  2. Call element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  3. BUT skip if user manually scrolled within last 3 seconds
     (tracked via a "wheel" / "touchmove" event listener that sets a timestamp)
```

### IntersectionObserver for Progress

```text
Each slide section has data-slide-index={i}.
IntersectionObserver (threshold: 0.3) fires onSlideVisible(index)
when a section enters the viewport.
Parent updates highestSlideViewed = max(current, index).
When last section becomes visible, progress reaches 100%.
```

### Scroll-Mode Footer

```text
Instead of: [< Previous]  dots  [Next >]
Shows:      Section 3 of 7  |  ~6 min remaining  |  [^] [v]

[^] scrolls to previous section header
[v] scrolls to next section header
```

### Performance

Lectures typically have 5-9 slides. Rendering all at once is negligible. Images use `AuthenticatedImage` which handles signed URLs lazily. For larger decks (15+), native `loading="lazy"` can be added to below-fold images.

### Mobile Responsiveness

The scroll layout naturally works better on mobile than the current card layout:
- Full-width images scale to container
- Text at text-lg is readable without zooming
- No side-by-side split that gets crushed on small screens
- Sections stack vertically (already the natural flow)

## Summary of Deliverables

| Item | Type | Description |
|------|------|-------------|
| `NarratedScrollViewer.tsx` | Create | Continuous-scroll viewer with hero images, generous text, audio-scroll sync |
| `StudentSlideViewer.tsx` | Modify | Add viewMode toggle, conditionally render scroll vs slides mode |
| `SlideRenderer.tsx` | Unchanged | Classic mode continues working as-is |

