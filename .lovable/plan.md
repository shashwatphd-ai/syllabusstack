

# Comprehensive Plan: Fix Audio-Scroll Sync in Narrated Scroll Mode

## Context and Scope

This plan addresses **only** the `NarratedScrollViewer.tsx` component. No backend functions, data models, storage buckets, instructor views, or generation pipelines are affected.

### Pipeline Independence Verification

The following systems are completely separate from this change and remain untouched:

| System | Files | Why It's Safe |
|--------|-------|---------------|
| Slide generation | `supabase/functions/generate-lecture-slides-v3/` | Writes JSONB to `lecture_slides` table -- we only read it |
| Audio generation | `supabase/functions/generate-lecture-audio/` | Writes MP3 to `lecture-audio` bucket + `audio_segment_map` to JSONB -- we only read it |
| Image generation | `supabase/functions/generate-slide-media/` | Writes images to `lecture-visuals` bucket -- we only read via `AuthenticatedImage` |
| Queue processing | `supabase/functions/process-lecture-queue/` | Orchestrates generation -- no frontend dependency |
| Instructor viewer | `src/components/slides/LectureSlideViewer.tsx` | Completely separate component, used in `UnifiedLOCard` |
| Classic slides mode | `src/components/slides/SlideRenderer.tsx` | Unchanged -- `viewMode === 'slides'` renders this as before |
| Sync hook | `src/hooks/useSlideSync.ts` | Unchanged -- still returns plain `activeBlockId` like `"main_text"` |
| Audio playback | `StudentSlideViewer.tsx` lines 92-206 | Unchanged -- manages audio lifecycle, signed URLs, auto-advance |
| Completion tracking | `StudentSlideViewer.tsx` lines 264-267 | Unchanged -- `highestSlideViewed` calculation stays |
| Data model | `lecture_slides.slides` JSONB column | Read-only consumer -- no writes |
| Storage buckets | `lecture-audio`, `lecture-visuals`, `syllabi` | Read-only consumer via signed URLs |

### Root Causes of Broken Auto-Scroll

**Bug 1: `data-block-id` only set on current audio slide's elements**

In `NarratedScrollViewer.tsx`, every block uses `data-block-id={isCurrentAudioSlide ? 'main_text' : undefined}`. Since `isCurrentAudioSlide = slideIndex === currentAudioSlideIndex`, only the currently-playing slide's blocks have IDs. This is correct for highlighting, but the auto-scroll effect at line 125 does `querySelector('[data-block-id="main_text"]')` -- which works. However, when audio transitions from slide 0 to slide 1, both may have a `main_text` block. If `activeBlockId` stays `"main_text"` across the transition, the `useEffect` dependency doesn't change, so **no scroll fires**.

**Bug 2: Title block ID mismatch**

The segment map's `target_block` for opening narration is typically `"title"`. But titles render as `data-block-id="title_0"` (line 239: `` data-block-id={`title_${slideIndex}`} ``). The querySelector for `[data-block-id="title"]` finds nothing.

**Bug 3: Long segments never re-scroll**

The auto-scroll effect (line 120-127) only fires when `activeBlockId` changes. Real segment maps often have one block covering 50%+ of the audio. The scroll fires once, then the user reads past it and the view drifts away with no re-scroll.

## Changes

### File: `src/components/slides/NarratedScrollViewer.tsx`

**Change 1: Use composite block IDs**

Replace all `data-block-id` attributes to use `${slideIndex}_${blockId}` format so IDs are globally unique across the entire scroll document:

- `data-block-id={isCurrentAudioSlide ? 'main_text' : undefined}` becomes `data-block-id={isCurrentAudioSlide ? \`${slideIndex}_main_text\` : undefined}`
- `data-block-id={\`title_${slideIndex}\`}` becomes `data-block-id={\`${slideIndex}_title\`}` (matching the composite pattern)
- Same for `definition`, `example`, `misconception`, `step_N`, `key_point_N`

This affects approximately 10 locations in the component where `data-block-id` is set.

**Change 2: Fix auto-scroll effect to use composite selector**

Update the existing `useEffect` at lines 120-127:

```text
Before:
  const el = scrollContainerRef.current?.querySelector(
    `[data-block-id="${activeBlockId}"]`
  );

After:
  const compositeId = `${currentAudioSlideIndex}_${activeBlockId}`;
  const el = scrollContainerRef.current?.querySelector(
    `[data-block-id="${compositeId}"]`
  );
```

Add `currentAudioSlideIndex` to the dependency array so it fires on slide transitions even when `activeBlockId` remains the same (e.g., both slides start with `"main_text"`).

**Change 3: Add periodic re-scroll for long narration segments**

Add a new `useEffect` with a 5-second interval that re-centers the active block while audio is playing and the user hasn't manually scrolled in the last 3 seconds. This handles segments that span 30-60+ seconds where `activeBlockId` never changes.

```text
useEffect(() => {
  if (!activeBlockId || !isAudioPlaying) return;
  const interval = setInterval(() => {
    if (Date.now() - lastManualScrollRef.current < 3000) return;
    const compositeId = `${currentAudioSlideIndex}_${activeBlockId}`;
    const el = scrollContainerRef.current?.querySelector(
      `[data-block-id="${compositeId}"]`
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 5000);
  return () => clearInterval(interval);
}, [activeBlockId, isAudioPlaying, currentAudioSlideIndex]);
```

**Change 4: Scroll to new section on slide audio transition**

Add a new `useEffect` that fires when `currentAudioSlideIndex` changes. It scrolls to the new slide's section header so the student is brought to the right part of the document when a new slide's audio starts:

```text
useEffect(() => {
  if (!isAudioPlaying) return;
  if (Date.now() - lastManualScrollRef.current < 3000) return;
  const section = scrollContainerRef.current?.querySelector(
    `[data-slide-index="${currentAudioSlideIndex}"]`
  );
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, [currentAudioSlideIndex, isAudioPlaying]);
```

## Files Modified

| File | Change Type | Impact |
|------|------------|--------|
| `src/components/slides/NarratedScrollViewer.tsx` | Modify | Composite block IDs, 3 new/updated useEffects |

## Files NOT Modified (Confirmed Safe)

| File | Reason |
|------|--------|
| `src/components/slides/StudentSlideViewer.tsx` | Already passes correct props; no changes needed |
| `src/components/slides/SlideRenderer.tsx` | Classic mode, completely independent |
| `src/components/slides/LectureSlideViewer.tsx` | Instructor viewer, separate component |
| `src/hooks/useSlideSync.ts` | Returns plain `activeBlockId` -- we compose with slide index in the viewer |
| `src/hooks/lectureSlides/*` | Data fetching hooks, read-only consumers |
| `src/pages/student/StudentSlidePage.tsx` | Page shell, no changes needed |
| `supabase/functions/*` | All edge functions (generation, audio, images, queue) are untouched |
| `src/integrations/supabase/*` | Auto-generated client/types, never edited |
| Storage buckets / RLS policies | Read-only access pattern unchanged |

