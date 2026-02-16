-- Security definer functions to break RLS recursion between instructor_courses ↔ course_enrollments

-- 1. Check if user is enrolled in a course (bypasses RLS on course_enrollments)
CREATE OR REPLACE FUNCTION public.is_enrolled_student(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE student_id = _user_id
      AND instructor_course_id = _course_id
  )
$$;

-- 2. Check if user is the instructor of a course (bypasses RLS on instructor_courses)
CREATE OR REPLACE FUNCTION public.is_course_instructor(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.instructor_courses
    WHERE instructor_id = _user_id
      AND id = _course_id
  )
$$;

-- 3. Fix the student policy on instructor_courses (was causing recursion)
DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON public.instructor_courses;
CREATE POLICY "Students can view courses they are enrolled in"
ON public.instructor_courses
FOR SELECT
USING (public.is_enrolled_student(auth.uid(), id));

-- 4. Fix the instructor policy on course_enrollments (was causing recursion)
DROP POLICY IF EXISTS "Instructors can view enrollments for their courses" ON public.course_enrollments;
CREATE POLICY "Instructors can view enrollments for their courses"
ON public.course_enrollments
FOR SELECT
USING (public.is_course_instructor(auth.uid(), instructor_course_id));