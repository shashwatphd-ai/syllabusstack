

## Plan: Fix Timing Calculations on Learning Objective Page

### Single file change: `src/pages/student/LearningObjective.tsx`

No other files are affected. All changes are display-only — no database queries, API calls, hooks, or component interfaces change.

---

### Dependency Check

| Concern | Status |
|---|---|
| Database schema | No changes — reading existing `target_duration_minutes`, `estimated_duration_minutes`, `total_slides` fields |
| Hooks (`useLearningObjectiveProgress`, `useStudentCourses`) | Not touched — data fetching unchanged |
| Components (`StudentSlideViewer`, `VerifiedVideoPlayer`, etc.) | Not touched — no prop changes |
| Other pages consuming same data | None — this is the only consumer of this rendering logic |
| Content service / edge functions | Not touched |

All changes are **local to the rendering logic** inside `LearningObjective.tsx`. Zero risk of breaking anything else.

---

### Changes (3 edits in one file)

**A. Add helper function** (new, inserted near top of component before JSX return)

A pure function `getUnitDisplayMinutes(unit, unitVideos, unitSlides)`:
- Computes `videoDuration` = sum of video `duration_seconds / 60` for all unit videos
- Computes `slideDuration` = sum of slide `estimated_duration_minutes` (fallback: `ceil(total_slides * 1.5)`) for all unit slides
- Returns `max(videoDuration, slideDuration)` rounded up, or falls back to `unit.target_duration_minutes` if both are 0

**B. Fix 4 slide duration fallbacks** (lines 647, 719, 812, and the total calc on 483)

Replace `slide.estimated_duration_minutes || 10` with `slide.estimated_duration_minutes || Math.ceil((slide.total_slides || 4) * 1.5)` at three locations (lines 647, 719, 812).

**C. Fix unit and total time displays**

- Line 523: Replace `~{unit.target_duration_minutes} min` with `~{getUnitDisplayMinutes(unit, unitVideos, unitSlides)} min`
- Line 483: Replace the `reduce` summing `target_duration_minutes` with a sum using `getUnitDisplayMinutes` for each unit (requires mapping over `contentByUnit`)

This ensures:
1. A slide's displayed time never exceeds its parent unit's time
2. Unknown slide durations use a reasonable heuristic (~1.5 min/slide) instead of 10 min
3. The total time reflects actual content, not curriculum targets

