-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Instructors can create courses" ON instructor_courses;

-- Create a new INSERT policy that allows any authenticated user to create courses
-- This effectively makes them an instructor when they create their first course
CREATE POLICY "Authenticated users can create courses" 
ON instructor_courses 
FOR INSERT 
WITH CHECK (auth.uid() = instructor_id);

-- Also update SELECT to allow users to see courses they created
DROP POLICY IF EXISTS "Instructors can view their own courses" ON instructor_courses;
CREATE POLICY "Users can view their own courses or as admin" 
ON instructor_courses 
FOR SELECT 
USING (auth.uid() = instructor_id OR has_role(auth.uid(), 'admin'::app_role));

-- Also create a trigger to auto-assign instructor role when someone creates a course
CREATE OR REPLACE FUNCTION public.auto_assign_instructor_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has instructor role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.instructor_id AND role = 'instructor'
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.instructor_id, 'instructor');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS on_instructor_course_created ON instructor_courses;
CREATE TRIGGER on_instructor_course_created
  AFTER INSERT ON instructor_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_instructor_role();