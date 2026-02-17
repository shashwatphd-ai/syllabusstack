

## Add Portrait/Landscape Layout Toggle for Slide Viewer

### Design Thinking: The Problem

When a slide has a diagram or image, the current layout splits the screen 40% text / 60% image side-by-side. This works for some images, but many educational diagrams (flowcharts, architecture charts, process maps) are designed for 16:9 widescreen and lose detail when squeezed into 60% of the viewport width. Students cannot see these images clearly without opening the lightbox, which breaks their reading flow.

### User Need

"I want to see the image large enough to read its details while still having access to the explanatory text -- without leaving the slide."

### Solution: A Layout Toggle

Add a simple toggle button in the slide viewer header that lets the student switch between two layouts:

**Portrait (default, current behavior):**
Text sits beside the image (40/60 split). Good for text-heavy slides where the image is supplementary.

**Landscape:**
The image stretches full-width in a 16:9 container at the top, and the text content scrolls below it. Good for diagram-heavy slides where the visual is the primary content.

The preference is saved to localStorage so it persists across sessions.

### User Flow

```text
Student opens lecture slides
  |
  v
Default: Portrait layout (side-by-side)
  |
  +--> Sees small diagram, wants more detail
  |
  v
Clicks landscape toggle in header (next to Slides/Scroll toggle)
  |
  v
Image expands to full width at 16:9
Text content moves below, scrollable
  |
  +--> Toggle persists via localStorage
  +--> Only visible on slides that have images (no toggle on text-only slides)
  +--> Works in both "Slides" mode and instructor preview
```

### What Changes

| File | Change |
|------|--------|
| `src/components/slides/StudentSlideViewer.tsx` | Add `slideLayout` state (persisted to localStorage), add toggle button next to the Slides/Scroll toggle, pass `layout` prop to `SlideRenderer` |
| `src/components/slides/SlideRenderer.tsx` | Accept optional `layout` prop. When `landscape`: switch from `sm:flex-row` to `flex-col`, image container uses `aspect-video` with `object-contain`, text area below gets `overflow-y-auto` |
| `src/components/slides/LectureSlideViewer.tsx` | Same toggle + prop for instructor preview consistency |

### Technical Detail: SlideRenderer Layout Logic

Currently (line 348-355 of SlideRenderer.tsx):
```
hasVisualUrl ? 'flex flex-col sm:flex-row gap-3' : 'overflow-y-auto'
```

With the landscape prop:
- `portrait` (default): keeps `flex-col sm:flex-row` -- no change
- `landscape`: uses `flex-col` always, image container gets `aspect-video w-full` with `object-contain`, text section below gets `overflow-y-auto` with a constrained max-height

The toggle button uses `RectangleHorizontal` / `RectangleVertical` icons from lucide-react and is only rendered when the current slide has a visual URL (text-only slides show no toggle).

### What Stays the Same

- Scroll (narrated) mode layout is unaffected
- Audio playback, navigation, progress tracking untouched
- Speaker notes panel unchanged
- Lightbox still available for full-zoom on images
- Mobile stacked layout unchanged (already full-width on small screens)

