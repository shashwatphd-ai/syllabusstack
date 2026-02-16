

## Fix: Students Can't See Enrolled Courses

### Root Cause
The RLS policy **"Students can view courses they are enrolled in"** on the `instructor_courses` table has a bug:

```sql
-- BUGGY (current):
WHERE ce.instructor_course_id = ce.id  -- compares two columns in course_enrollments (always false)

-- CORRECT:
WHERE ce.instructor_course_id = instructor_courses.id  -- joins against the target table
```

This means when a student's browser fetches their enrolled course details, the `instructor_course` join returns `null`, so the course card appears empty or missing -- even though the enrollment itself was created successfully.

### Fix (single migration)

1. **Drop** the broken policy
2. **Re-create** it with the correct join condition (`ce.instructor_course_id = instructor_courses.id`)

No code changes needed. No other tables are affected -- `modules`, `learning_objectives`, `lecture_slides`, and `consumption_records` already have correct student-facing policies.

### Technical Detail

```sql
DROP POLICY "Students can view courses they are enrolled in" ON public.instructor_courses;

CREATE POLICY "Students can view courses they are enrolled in"
ON public.instructor_courses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.instructor_course_id = instructor_courses.id
      AND ce.student_id = auth.uid()
  )
);
```

Once applied, this will be live immediately -- the student can refresh and see their course without re-enrolling.

