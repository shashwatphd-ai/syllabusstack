

## Problem Analysis

After deep review, I found **two layered issues** causing controls to be inconsistent in Presentation Mode:

### Issue 1: Parent header conflicts with cinema mode
The `StudentSlideViewer` always renders its header bar (lines 429-582) with the X button, progress bar, voice picker, and view mode toggle -- even in presentation mode. This creates a non-immersive experience and duplicates controls (audio toggle, voice picker appear in both the header AND the PresentationPlayer bottom bar).

### Issue 2: Bottom controls can be clipped
The PresentationPlayer sits inside a parent `div` with `overflow-hidden` (line 585). While the absolute positioning with `z-50` should work in theory, the controls can get clipped or overlap with slide content because:
- The slide content area (`flex-1`) and the absolute controls compete for the same bottom space
- No padding-bottom on the slide content means slides render behind the controls
- The gradient overlay (`h-24`) doesn't reserve space -- it overlays

### Plan

**1. Hide parent header in presentation mode**
In `StudentSlideViewer.tsx`, conditionally hide the header bar when `viewMode === 'presentation'`. This gives the cinema mode full viewport height.

**2. Add close button to PresentationPlayer**
Add an `onClose` prop to `PresentationPlayer` and render a persistent X button in the top-right corner (absolute positioned, always visible, white on semi-transparent background).

**3. Add a title overlay**  
Show the lecture title in the top-left of the PresentationPlayer so the user has context.

**4. Add bottom padding to slide content**
Add `pb-28` (or similar) to the slide content area inside PresentationPlayer so slides never render behind the controls bar.

**5. Remove opacity toggling entirely**
Since controls should always be visible, remove the `showControls` state and the conditional opacity class. The controls div becomes a simple `absolute bottom-0` with no opacity transitions.

### Files to modify
- `src/components/slides/PresentationPlayer.tsx` -- add close button, title, bottom padding, remove opacity logic
- `src/components/slides/StudentSlideViewer.tsx` -- hide header when `viewMode === 'presentation'`, pass `onClose` to PresentationPlayer

