

## Plan: Add Edit Entry Points and Unpublish-in-Editor

### Problem
The slide content editor works but is unreachable — no "Edit Content" button exists in the UI. Published slides also can't be unpublished from within the editor.

### Changes

**1. Add "Edit Content" button to `LectureSlideViewer.tsx`**
- Add a `Pencil` icon button in the toolbar (between Regenerate and Publish buttons)
- Use `useNavigate` from react-router-dom
- Navigate to `/instructor/courses/${lectureSlide.instructor_course_id}/slides/${lectureSlide.id}/edit`
- Close the dialog before navigating
- Only show when status is `ready` or `failed` (editable states), or always show since the editor itself handles the read-only gate

**2. Add "Unpublish & Edit" button in `SlideContentEditor.tsx`**
- In the read-only banner for `published` status, add an "Unpublish & Edit" button
- Wire to `useUnpublishLectureSlides` mutation
- On success, the status flips to `ready` and the editor becomes editable without navigation (React Query cache invalidation will refetch the slide data)

**3. Verify no breakage**
- `useUpdateLectureSlide` mutation: already invalidates `lecture-slide`, `course-lecture-slides`, and `published-lecture-slides` caches — correct
- RLS policy: "Instructors can manage their slides" with `ALL` command covers UPDATE — correct
- `SlideEditCard` component: properly handles disabled state and all field types — correct
- `LectureSlide.instructor_course_id` is available on the type and fetched in queries — correct
- No changes to backend, types, or database needed

### Files to modify
1. `src/components/slides/LectureSlideViewer.tsx` — add Edit Content button + import `Pencil` icon + `useNavigate`
2. `src/pages/instructor/SlideContentEditor.tsx` — add Unpublish & Edit button in the published banner + import `useUnpublishLectureSlides`

### Risk Assessment
- Low risk. Both changes are additive UI elements wired to existing, tested mutations.
- No schema, RLS, or edge function changes.
- Existing cache invalidation patterns already handle the data flow correctly.

