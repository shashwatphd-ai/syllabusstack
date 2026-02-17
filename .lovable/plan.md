

## Bring the Teaching Unit Cascade to the Student View

### What Changes

The student Learning Objective page will group videos and lecture slides under their parent teaching units, surfacing student-appropriate context (What to Teach, Why This Matters, Common Misconceptions). All existing functionality -- video playback, micro-checks, slide viewer, assessment CTA, progress pipeline -- remains exactly the same.

### Data Flow Confirmation

The current data flow is:

1. `useLearningObjectiveProgress` fetches the LO, `content_matches` (with `teaching_unit_id` column), and `consumption_records`
2. Lecture slides are fetched separately and already JOIN on `teaching_units` for `sequence_order`
3. The new addition: `useTeachingUnits(loId)` fetches teaching unit metadata (title, what_to_teach, why_this_matters, common_misconceptions)

**Nothing changes** about how data enters or moves through the system. We are only adding one extra read query and reorganizing the JSX layout.

### RLS Fix Required

Currently, `teaching_units` only has a SELECT policy for the **instructor who owns the LO**. Students cannot read teaching units. We need to add an RLS policy:

```sql
CREATE POLICY "Enrolled students can view teaching units"
ON public.teaching_units FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.learning_objectives lo
    JOIN public.course_enrollments ce ON ce.instructor_course_id = lo.instructor_course_id
    WHERE lo.id = teaching_units.learning_objective_id
      AND ce.student_id = auth.uid()
  )
);
```

### Implementation Steps

#### Step 1: Database Migration -- Student RLS on teaching_units

Add the SELECT policy above so enrolled students can read teaching unit data for their courses.

#### Step 2: Modify LearningObjective.tsx

**Add `useTeachingUnits` import and call:**
```typescript
import { useTeachingUnits } from '@/hooks/useTeachingUnits';
// ...
const { data: teachingUnits } = useTeachingUnits(loId);
```

**Group content by teaching unit:**
- Build a map: `teaching_unit_id -> { videos[], slides[] }`
- Videos come from `matchedContent` (which already has `teaching_unit_id`)
- Slides come from `lectureSlides` (which already has `teaching_unit_id`)
- Items with `null` teaching_unit_id go into a "General Resources" fallback section

**Replace flat Videos/Slides sections with teaching-unit cards:**

Each card shows:
- Sequence number + title (e.g., "1. Creativity is a Style, Not Just a Skill")
- Type badge (Explainer, Tutorial, etc.) and estimated duration
- "What to Teach" summary -- always visible
- Collapsible "Why This Matters" section
- Collapsible "Common Misconceptions" section
- Videos grouped under this unit (same card layout, click-to-play behavior)
- Slides grouped under this unit (same click-to-view behavior)

**Not shown to students:**
- Search Queries, Prerequisites/Enables (instructor planning data)
- Status badges (Pending/Searching/Found)
- Any instructor action buttons

**Fallback:** If `teachingUnits` is empty or loading, the page falls back to the current flat layout (videos then slides), so nothing breaks for LOs that haven't been decomposed yet.

#### Step 3: No other files change

- No hook changes
- No backend/edge function changes
- No changes to `StudentCourseDetail.tsx`
- Video player, micro-checks, assessment CTA, slide viewer all work identically

### Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/` | New RLS policy for student SELECT on `teaching_units` |
| `src/pages/student/LearningObjective.tsx` | Import `useTeachingUnits`, group content by TU, render TU cards with collapsible context sections, fallback to flat layout |

### Risk Assessment

- **Zero backend risk** -- no mutations, no edge function changes
- **Low frontend risk** -- fallback to existing layout when no teaching units exist
- **RLS addition is purely additive** -- new SELECT policy, existing instructor policies untouched

