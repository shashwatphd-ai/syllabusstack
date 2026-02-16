DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON public.instructor_courses;

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