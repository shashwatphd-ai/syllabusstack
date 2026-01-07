-- Add instructor_course_id column to learning_objectives
ALTER TABLE public.learning_objectives 
ADD COLUMN instructor_course_id UUID REFERENCES public.instructor_courses(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_learning_objectives_instructor_course ON public.learning_objectives(instructor_course_id);

-- Update RLS policy to allow instructors to manage LOs for their courses
DROP POLICY IF EXISTS "Users can manage their own learning objectives" ON public.learning_objectives;
DROP POLICY IF EXISTS "Users can view their own learning objectives" ON public.learning_objectives;

CREATE POLICY "Users can manage their own learning objectives" 
ON public.learning_objectives 
FOR ALL 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM instructor_courses ic 
    WHERE ic.id = learning_objectives.instructor_course_id 
    AND ic.instructor_id = auth.uid()
  )
);

CREATE POLICY "Users can view learning objectives" 
ON public.learning_objectives 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM instructor_courses ic 
    WHERE ic.id = learning_objectives.instructor_course_id 
    AND ic.instructor_id = auth.uid()
  )
);