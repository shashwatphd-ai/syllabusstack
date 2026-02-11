

## Fix Image Generation Button Count and Trigger Missing Images

### Problem Summary

1. **Misleading button count**: The "Generate Images (112 missing)" count on course `6cc7d2ae` includes title and recap slides that are intentionally skipped by the backend. The button should show 0 missing for this course since all content slides already have images.

2. **Other courses have genuinely missing images** (415 total across 6 courses), but they must be triggered per-course. The current course (`6cc7d2ae`) is fully complete.

| Course | Missing Content Slides |
|--------|----------------------|
| MGT471 V6 | 282 |
| Business Ethics | 64 |
| MGT471 V5 | 39 |
| MGT471 Online v5 | 22 |
| ENT 5508 | 6 |
| MBA Consulting | 2 |

### Changes

#### 1. Fix the frontend missing-image count (InstructorCourseDetail.tsx)

Update the `publishedMissingImages` memo to skip the same slide types the backend skips (title, recap, conclusion, further_reading, title_slide). This ensures the button label accurately reflects slides that will actually get images generated.

```text
Before: Counts any slide with visual.type !== 'none' and no URL
After:  Also excludes slide types in ['title', 'recap', 'conclusion', 'further_reading', 'title_slide']
```

#### 2. Add "title_slide" to backend skip list (image-prompt-builder.ts)

Update the `slideNeedsImage` function to also skip `title_slide` and `summary` types, preventing wasted LLM prompt-generation calls.

```text
Before: const skipTypes = ['conclusion', 'recap', 'further_reading', 'title'];
After:  const skipTypes = ['conclusion', 'recap', 'further_reading', 'title', 'title_slide', 'summary', 'preview'];
```

#### 3. Trigger image population for the current course properly

The mutation flow already handles this correctly for a single course: button click fires `process-batch-images` with `{ continue: true }`, then falls back to populating the queue with `{ instructor_course_id }`. The issue is that for `6cc7d2ae` there are genuinely no slides needing images (all missing ones are skip types), so no action is needed here.

For the OTHER courses with missing images, there are two paths:

- **Manual**: Visit each course detail page and click "Generate Missing Images"
- **Automated (included in this plan)**: Add a small "Generate All Courses' Images" admin action that loops through all `instructor_course_id` values with missing content slides and calls `process-batch-images` for each one sequentially. This will be a new button visible only when there are cross-course missing images.

### Technical Details

**Files to modify:**

1. `src/pages/instructor/InstructorCourseDetail.tsx` (lines 100-112)
   - Add slide type filtering to `publishedMissingImages` memo to exclude title, recap, conclusion, further_reading, title_slide, summary, preview

2. `supabase/functions/_shared/image-prompt-builder.ts` (line 168)
   - Expand `skipTypes` array to include 'title_slide', 'summary', 'preview'

3. `src/hooks/useBatchSlides.ts` (mutation at line 582-588)
   - When the fast-path returns 0 processed and the background populate also finds nothing, ensure the status transitions cleanly back to idle instead of staying in "queued"

**No new files needed.** The edge function `process-batch-images` already supports per-course population via `{ instructor_course_id }` -- the core fix is making the frontend count accurate so users know which courses actually need attention.
