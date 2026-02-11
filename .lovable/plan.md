
# Fix: Transcript Display, Completion State Updates, and Post-Completion UX

## 3 Issues Found

### Issue 1: Transcript toggle does nothing in scroll mode

**Root cause**: `showSpeakerNotes` state lives in `StudentSlideViewer.tsx` but is never passed to `NarratedScrollViewer`. The scroll viewer component has no prop for it and never renders `speaker_notes` from the slide data.

**Fix**: 
- Add `showSpeakerNotes: boolean` prop to `NarratedScrollViewer`
- Render `slide.speaker_notes` below each section's content when the toggle is on, styled as a collapsible transcript panel (subtle background, smaller text, speech-bubble icon)

### Issue 2: Clicking "Complete" does not update the learning objective state

**Root cause**: The `onComplete` callback in `LearningObjective.tsx` (line 407-428) upserts a row into `slide_completions` but never touches the `verification_state` column on the `learning_objectives` table. The state machine defines transitions (`unstarted` to `in_progress` on first interaction, `in_progress` to `verified` on completing content), but slide-based learning never triggers these transitions. Only the video `track-consumption` edge function updates `verification_state`.

**Fix**: After upserting `slide_completions`, the `onComplete` handler should also update `verification_state` on the `learning_objectives` table:
- If current state is `unstarted` and `watchPercentage > 0`: transition to `in_progress`
- If current state is `unstarted` or `in_progress` and `watchPercentage >= 80`: transition to `verified` (content completed)
- After the update, invalidate the `lo-progress` query so the page re-renders with the new badge

This follows the same logic as `track-consumption/index.ts` (line 286-290) but applied to slide completions.

```text
State transitions on slide completion:

  watchPercentage > 0, state == unstarted     -->  in_progress
  watchPercentage >= 80, state == in_progress  -->  verified
  watchPercentage >= 80, state == unstarted    -->  verified (skip in_progress)
```

### Issue 3: Page doesn't reflect completion after closing viewer

**Root cause**: After `onComplete` fires and `setViewingSlide(null)` closes the modal, the page shows the same "unstarted" badge because:
1. `verification_state` was never updated (Issue 2)
2. The query cache is never invalidated -- `queryClient.invalidateQueries` is not called

**Fix**: After the upsert and state update, call `queryClient.invalidateQueries` for:
- `['lo-progress', loId]` -- refreshes the badge, assessment CTA, and sidebar status
- `['lo-published-slides', loId]` -- optional, for any completion indicators on slide items

This will cause the page to show the updated badge (e.g., "In Progress" or "Content Verified") and, when all slides are completed at 80%+, show the "Start Assessment" CTA.

## Technical Changes

### File 1: `src/components/slides/NarratedScrollViewer.tsx`

**Add `showSpeakerNotes` prop** to the interface and render transcript below each section:

```typescript
interface NarratedScrollViewerProps {
  // ... existing props
  showSpeakerNotes: boolean;  // NEW
}
```

After each section's content blocks (after the key points, main text, etc.), render:

```typescript
{showSpeakerNotes && slide.speaker_notes && (
  <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border/50">
    <div className="flex items-center gap-2 mb-2">
      <MessageSquare className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground">Transcript</span>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">
      {slide.speaker_notes}
    </p>
  </div>
)}
```

### File 2: `src/components/slides/StudentSlideViewer.tsx`

**Pass `showSpeakerNotes`** to `NarratedScrollViewer`:

```typescript
<NarratedScrollViewer
  slides={slides}
  currentAudioSlideIndex={currentSlideIndex}
  activeBlockId={activeBlockId}
  isAudioPlaying={isAudioPlaying}
  citations={citations}
  onSlideVisible={handleScrollSlideVisible}
  programmaticScrollRef={programmaticScrollRef}
  showSpeakerNotes={showSpeakerNotes}  // NEW
/>
```

Also remove the `{viewMode === 'slides' && ...}` guard from the header transcript toggle so it shows in both modes.

### File 3: `src/pages/student/LearningObjective.tsx`

**Update `onComplete` handler** to transition `verification_state` and invalidate queries:

```typescript
onComplete={async (watchPercentage) => {
  if (user && viewingSlide) {
    try {
      // 1. Upsert slide completion (existing)
      await supabase
        .from('slide_completions')
        .upsert({ ... }, { onConflict: 'user_id,lecture_slides_id' });

      // 2. Update verification_state based on progress
      const currentState = learningObjective.verification_state || 'unstarted';
      let newState: string | null = null;

      if (watchPercentage >= 80 && (currentState === 'unstarted' || currentState === 'in_progress')) {
        newState = 'verified';
      } else if (watchPercentage > 0 && currentState === 'unstarted') {
        newState = 'in_progress';
      }

      if (newState) {
        await supabase
          .from('learning_objectives')
          .update({ verification_state: newState, updated_at: new Date().toISOString() })
          .eq('id', loId);
      }

      // 3. Invalidate queries to refresh UI
      await queryClient.invalidateQueries({ queryKey: ['lo-progress', loId] });

    } catch (err) {
      console.error('Error persisting slide completion:', err);
    }
  }
  setViewingSlide(null);
}}
```

## Post-Completion User Experience

After this fix, the student's journey becomes:

| Action | What changes on page |
|--------|---------------------|
| Open first slide deck, view 1-2 slides, close | Badge changes from "unstarted" to "in progress" |
| Complete a slide deck (80%+ viewed) | Badge changes to "Content Verified"; "Start Assessment" CTA appears in sidebar |
| Complete all slide decks | Same -- assessment is unlocked after first deck hits 80% |

## What Does NOT Change

- State machine logic (`verification-state-machine.ts`)
- Video consumption tracking (`track-consumption` edge function)
- Classic slides mode behavior
- Backend edge functions
- Database schema (no migration needed)
- Audio sync or scroll behavior (previous fixes preserved)

## Files Modified

| File | Changes |
|------|---------|
| `src/components/slides/NarratedScrollViewer.tsx` | Accept `showSpeakerNotes` prop, render transcript panel per section |
| `src/components/slides/StudentSlideViewer.tsx` | Pass `showSpeakerNotes` to scroll viewer, show toggle in both modes |
| `src/pages/student/LearningObjective.tsx` | Update `verification_state` on completion, invalidate queries |
