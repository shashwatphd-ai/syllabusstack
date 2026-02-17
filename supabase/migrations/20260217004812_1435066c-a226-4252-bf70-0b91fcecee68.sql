-- Allow instructors to view profiles of students enrolled in their courses
CREATE POLICY "Instructors can view enrolled student profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    JOIN public.instructor_courses ic ON ic.id = ce.instructor_course_id
    WHERE ce.student_id = profiles.user_id
      AND ic.instructor_id = auth.uid()
  )
);