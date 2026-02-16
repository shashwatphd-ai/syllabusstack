
-- Allow students to view courses they are enrolled in
CREATE POLICY "Students can view courses they are enrolled in"
ON public.instructor_courses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.instructor_course_id = id
      AND ce.student_id = auth.uid()
  )
);

-- Allow authenticated users to find published courses by access code (for enrollment)
CREATE POLICY "Authenticated users can view published courses for enrollment"
ON public.instructor_courses
FOR SELECT
USING (
  is_published = true
  AND auth.uid() IS NOT NULL
);
