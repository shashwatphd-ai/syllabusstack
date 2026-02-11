

# Comprehensive Fix: Audio Sync, Missing Controls, and Image Generation Clarity

## 5 Issues to Fix

### Issue 1: IntersectionObserver feedback loop prevents navigation from changing narration

**Root Cause:** The IntersectionObserver in `NarratedScrollViewer.tsx` (line 102) fires `onSlideVisible` for every section crossing 30% visibility. When `jumpToSection` calls `scrollIntoView({ behavior: 'smooth' })`, the smooth animation causes intermediate sections to cross the threshold, firing `onSlideVisible` for the wrong section. This sets `currentSlideIndex` back to the old section, which restarts that section's audio, and the auto-scroll effects (lines 119-150) then pull the viewport back to match.

The `lastManualScrollRef` guard (line 84) only listens for `wheel` and `touchmove` events. Arrow button clicks trigger `scrollIntoView` which is a programmatic scroll -- it does NOT fire `wheel` or `touchmove`, so the guard never activates.

**Fix:** Introduce a `programmaticScrollRef` flag in `StudentSlideViewer.tsx`. Set it to `true` before any programmatic scroll and clear it after 1500ms. Pass it to `NarratedScrollViewer` as a prop. In `handleScrollSlideVisible`, skip audio changes when this flag is `true`. Add a debounced effect (800ms) that syncs audio to the visible section only after the user stops scrolling naturally.

### Issue 2: Scroll mode footer is missing student controls

**Evidence:** The scroll mode footer (lines 541-569 in `StudentSlideViewer.tsx`) only renders:
- Section indicator ("section 2 of 8")
- Time remaining
- Up/Down arrows

Missing compared to slides mode:
- **Complete button** -- students cannot mark the lecture as complete
- **Transcript toggle** -- students cannot read the narration text
- **Audio play/pause** -- no way to pause narration without toggling audio off entirely

**Fix:** Add a "Complete" button to the scroll mode footer that appears when the student has reached the last section. Add a Transcript toggle and a play/pause button to the scroll footer controls.

### Issue 3: Audio persists after page navigation

**Evidence:** The unmount cleanup effect (line 57-66) exists but there is a race condition: the async `playAudioWithSignedUrl` function (line 140) may resolve and call `audio.play()` after the component unmounts. The `isMounted` flag prevents state updates but does NOT prevent `audio.play()` from executing if the `Audio` object was created before unmount but plays after.

**Fix:** Store the `isMounted` flag as a ref accessible to the unmount cleanup. In the unmount effect, also check for any audio element that may have been created but not yet assigned to `audioRef.current`. The existing unmount effect already handles `audioRef.current`, so the primary fix is ensuring the async function checks `isMounted` AFTER creating the Audio object and BEFORE calling `.play()` (this is already done at line 182/197, so this is actually working correctly). The real fix is ensuring `audioRef.current.src = ''` is set in the effect cleanup at line 205-216 (currently it only pauses but doesn't release the resource).

### Issue 4: Recap slide shows visual directive text instead of image

**Evidence:** The backend `image-prompt-builder.ts` (line 168) explicitly skips image generation for these slide types: `'conclusion', 'recap', 'further_reading', 'title', 'title_slide', 'summary', 'preview'`. This is intentional -- these types don't benefit from unique visuals and skipping them saves API costs.

The yellow "Visual: ..." fallback text (line 489-494 in `NarratedScrollViewer.tsx`) renders when a slide has a `visual` object with a `fallback_description` but no generated image URL. This is correct behavior for excluded types, but the fallback text is confusing to students -- they see what looks like an instruction to an AI rather than useful content.

**Fix:** Two changes:
1. **Frontend:** Hide the visual fallback text for excluded slide types in `NarratedScrollViewer.tsx`. Students should not see "Visual: A top-down flowchart..." -- that's a generation directive, not student content.
2. **Instructor awareness:** The instructor's "Generate Images" button already shows the count of missing images excluding these types. The `IMAGE_SKIP_TYPES` list in `InstructorCourseDetail.tsx` (line 101) matches the backend list. So the instructor correctly sees "0 missing" even when recap slides have no image. No backend change needed.

### Issue 5: Auto-scroll effects in NarratedScrollViewer fight user navigation

**Evidence:** Three `useEffect` blocks in `NarratedScrollViewer.tsx` call `scrollIntoView`:
- Line 120-128: Scrolls to active block during audio
- Line 131-140: Periodic re-scroll every 5 seconds
- Line 143-150: Scrolls to new section on audio slide transition

All three only check `lastManualScrollRef` (wheel/touch). None check for programmatic scrolls from arrow buttons.

**Fix:** All three effects should also check `programmaticScrollRef.current` before scrolling.

## Technical Changes

### File 1: `src/components/slides/StudentSlideViewer.tsx`

1. **Add `programmaticScrollRef`** -- a `useRef<boolean>(false)` to signal programmatic scrolls
2. **Rewrite `handleScrollSlideVisible`** -- only update `visibleScrollSlideIndex` and `highestSlideViewed`; remove direct `setCurrentSlideIndex` call
3. **Add debounced audio sync effect** -- new `useEffect` watching `visibleScrollSlideIndex` that syncs audio after 800ms of stability, skipping when `programmaticScrollRef` is true
4. **Guard `jumpToSection`** -- set `programmaticScrollRef.current = true` before scroll, clear after 1500ms
5. **Fix audio cleanup** -- add `audioRef.current.src = ''` in the per-slide effect cleanup (line 205-216), not just in the unmount effect
6. **Add scroll footer controls:**
   - Complete button (visible when `visibleScrollSlideIndex === slides.length - 1`)
   - Transcript toggle (Switch + Label, same as slides mode)
   - Audio play/pause button
7. **Pass `programmaticScrollRef`** to `NarratedScrollViewer` as a new prop

### File 2: `src/components/slides/NarratedScrollViewer.tsx`

1. **Accept `programmaticScrollRef` prop** -- add to interface
2. **Guard all 3 auto-scroll effects** -- check `programmaticScrollRef.current` before any `scrollIntoView`
3. **Set flag before auto-scrolls** -- when auto-scroll effects DO scroll, set `programmaticScrollRef.current = true` with 1500ms timeout to prevent the observer from fighting
4. **Hide visual fallback for excluded types** -- add condition to suppress "Visual: ..." text for `recap`, `title`, `summary`, `preview`, `conclusion`, `further_reading` slide types

## User Interaction Scenarios After Fix

| Scenario | Before (broken) | After (fixed) |
|----------|-----------------|---------------|
| Click down arrow | Observer reverts to old section; audio stays | Flag suppresses observer; audio follows target |
| Manual scroll to section 5 | Observer fires for sections 2,3,4,5; audio flickers | Observer updates footer only; after 800ms settled, audio syncs |
| Audio auto-scrolls during playback | Observer may fire for passed sections | Flag suppresses observer during auto-scroll |
| Student reaches end in scroll mode | No way to complete | "Complete" button appears in footer |
| Recap slide | Shows "Visual: A top-down flowchart..." directive text | Hides directive; shows clean content only |
| Page navigation while audio plays | Audio may continue | Unmount releases audio resource with `src = ''` |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/slides/StudentSlideViewer.tsx` | programmaticScrollRef, debounced sync, guarded jumpToSection, scroll footer controls, audio cleanup |
| `src/components/slides/NarratedScrollViewer.tsx` | Accept programmaticScrollRef prop, guard auto-scrolls, hide visual fallback for excluded types |

## What Does NOT Change

- All backend edge functions and image generation pipeline
- Instructor views and "Generate Images" button logic
- Classic slides mode (Previous/Next/Complete already works)
- SlideRenderer, useSlideSync, audio playback lifecycle
- Database schema, RLS policies, storage buckets

