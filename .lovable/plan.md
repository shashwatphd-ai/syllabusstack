

# Reorganize Learning Objective Page — Remove Empty State Box, Streamline Layout

## Current Problem

The page uses a two-column layout: a large center area (for a video player or an empty "Select Content" placeholder) and a narrow 320px sidebar with Videos, Lecture Slides, and Assessment CTA. When no video is selected, the center shows a big empty card with a play icon saying "Choose a video or lecture slides from the sidebar" -- this wastes most of the screen real estate and feels confusing.

Since both content types open in overlays (slides open in a full-screen `StudentSlideViewer` modal, and the video player renders inline), there's no need for a dedicated center "stage" area that sits empty most of the time.

## New Layout

Replace the two-column layout with a single-column, vertically stacked design:

```text
[Back to Course]
[Learning Objective Title]
[Bloom Level Badge] [State Badge]

[Videos Section - horizontal scrollable cards or vertical list]
[Lecture Slides Section - horizontal scrollable cards or vertical list]
[Assessment CTA - full width when unlocked]
```

### Design Details

1. **Remove the empty "Select Content" placeholder card entirely** -- no more two-column grid layout.

2. **Videos section**: Show as a list of clickable cards (similar to current sidebar but full-width). Each card shows thumbnail, title, duration, match score, and watch status. Clicking opens the `VerifiedVideoPlayer` inline (expands in place above the list, pushing content down) or in a dialog.

3. **Lecture Slides section**: Show as a list of clickable cards, each with slide count and duration. Clicking opens the `StudentSlideViewer` modal (unchanged behavior).

4. **Assessment CTA**: Full-width card at the bottom when the state is `verified` or `assessment_unlocked`.

5. **When a video IS selected**: The video player renders at the top of the page (full width), with the Micro-Check History collapsible below it, then the content lists below that. A close/minimize button lets the student collapse the player back.

6. **Empty states**: If no videos exist, the Videos section shows a subtle inline message instead of a card with an icon. Same for slides.

## Technical Changes

### File: `src/pages/student/LearningObjective.tsx`

- Remove the `grid gap-6 lg:grid-cols-[1fr_320px]` two-column layout (line 207)
- Remove the center "Select Content" empty state card (lines 266-275)
- Restructure to single column:
  - Video player at top (when selected), full width
  - Videos list as full-width cards below
  - Lecture Slides list as full-width cards below that
  - Assessment CTA at bottom
- Keep all existing logic: state recovery, content status, video completion handlers, slide viewer modal, micro-check history
- Keep the `VerifiedVideoPlayer` rendering inline when a video is selected (just make it full-width at the top instead of in the left column)

### Layout Structure (single file change)

```text
<div class="space-y-6">
  <!-- Header (unchanged) -->
  
  <!-- Video Player (only when selected, full width) -->
  <!-- Micro-check history (only when video selected) -->
  
  <!-- Content Sections -->
  <div class="space-y-6">
    <!-- Videos Card (full width, list of clickable items) -->
    <!-- Lecture Slides Card (full width, list of clickable items) -->
    <!-- Assessment CTA (full width) -->
  </div>
</div>
```

## What Stays the Same

- All data fetching hooks and queries
- State recovery logic
- Video completion and verification handlers
- Slide viewer modal (`StudentSlideViewer`)
- Micro-check history collapsible
- Assessment navigation
- All content status tracking

## Outcome

- No more empty placeholder box taking up half the screen
- Content is immediately visible and accessible without scrolling right
- Cleaner, more intuitive single-column flow
- Works better on mobile (no cramped 320px sidebar)
- Both Videos and Lecture Slides remain one click away from their respective viewers

