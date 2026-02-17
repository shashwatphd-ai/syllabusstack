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