-- Migration 3: Cascade Deletes and RLS for Student Access

-- Add unique constraint on access_code if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'instructor_courses_access_code_key'
  ) THEN
    ALTER TABLE public.instructor_courses ADD CONSTRAINT instructor_courses_access_code_key UNIQUE (access_code);
  END IF;
END
$$;

-- Drop and recreate foreign keys with CASCADE for clean data deletion
-- Modules cascade on instructor_course delete
ALTER TABLE public.modules 
DROP CONSTRAINT IF EXISTS modules_instructor_course_id_fkey,
ADD CONSTRAINT modules_instructor_course_id_fkey 
  FOREIGN KEY (instructor_course_id) 
  REFERENCES public.instructor_courses(id) 
  ON DELETE CASCADE;

-- Learning objectives cascade on module delete
ALTER TABLE public.learning_objectives 
DROP CONSTRAINT IF EXISTS learning_objectives_module_id_fkey,
ADD CONSTRAINT learning_objectives_module_id_fkey 
  FOREIGN KEY (module_id) 
  REFERENCES public.modules(id) 
  ON DELETE SET NULL;

-- Course enrollments cascade on course delete
ALTER TABLE public.course_enrollments 
DROP CONSTRAINT IF EXISTS course_enrollments_instructor_course_id_fkey,
ADD CONSTRAINT course_enrollments_instructor_course_id_fkey 
  FOREIGN KEY (instructor_course_id) 
  REFERENCES public.instructor_courses(id) 
  ON DELETE CASCADE;

-- Content matches cascade on LO or content delete
ALTER TABLE public.content_matches 
DROP CONSTRAINT IF EXISTS content_matches_learning_objective_id_fkey,
ADD CONSTRAINT content_matches_learning_objective_id_fkey 
  FOREIGN KEY (learning_objective_id) 
  REFERENCES public.learning_objectives(id) 
  ON DELETE CASCADE;

ALTER TABLE public.content_matches 
DROP CONSTRAINT IF EXISTS content_matches_content_id_fkey,
ADD CONSTRAINT content_matches_content_id_fkey 
  FOREIGN KEY (content_id) 
  REFERENCES public.content(id) 
  ON DELETE CASCADE;

-- Consumption records cascade on content delete
ALTER TABLE public.consumption_records 
DROP CONSTRAINT IF EXISTS consumption_records_content_id_fkey,
ADD CONSTRAINT consumption_records_content_id_fkey 
  FOREIGN KEY (content_id) 
  REFERENCES public.content(id) 
  ON DELETE CASCADE;

-- RLS Policies for student access to course content
-- Students can view learning objectives from courses they're enrolled in
DROP POLICY IF EXISTS "Students can view LOs from enrolled courses" ON public.learning_objectives;
CREATE POLICY "Students can view LOs from enrolled courses"
  ON public.learning_objectives
  FOR SELECT
  USING (
    instructor_course_id IN (
      SELECT ce.instructor_course_id 
      FROM course_enrollments ce 
      WHERE ce.student_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Students can view modules from courses they're enrolled in
DROP POLICY IF EXISTS "Students can view modules from enrolled courses" ON public.modules;
CREATE POLICY "Students can view modules from enrolled courses"
  ON public.modules
  FOR SELECT
  USING (
    instructor_course_id IN (
      SELECT ce.instructor_course_id 
      FROM course_enrollments ce 
      WHERE ce.student_id = auth.uid()
    )
  );

-- Students can view approved content matches for their enrolled courses
DROP POLICY IF EXISTS "Students can view approved content matches" ON public.content_matches;
CREATE POLICY "Students can view approved content matches"
  ON public.content_matches
  FOR SELECT
  USING (
    status = 'approved'
    AND learning_objective_id IN (
      SELECT lo.id FROM learning_objectives lo
      WHERE lo.instructor_course_id IN (
        SELECT ce.instructor_course_id 
        FROM course_enrollments ce 
        WHERE ce.student_id = auth.uid()
      )
    )
  );

-- Students can view content that has been approved for their courses
DROP POLICY IF EXISTS "Students can view approved content" ON public.content;
CREATE POLICY "Students can view approved content"
  ON public.content
  FOR SELECT
  USING (
    id IN (
      SELECT cm.content_id FROM content_matches cm
      WHERE cm.status = 'approved'
        AND cm.learning_objective_id IN (
          SELECT lo.id FROM learning_objectives lo
          WHERE lo.instructor_course_id IN (
            SELECT ce.instructor_course_id 
            FROM course_enrollments ce 
            WHERE ce.student_id = auth.uid()
          )
        )
    )
    OR created_by = auth.uid()
  );