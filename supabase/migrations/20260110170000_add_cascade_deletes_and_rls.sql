-- Add cascade deletes, unique constraints, and RLS policies
-- Phase 2 from the comprehensive analysis

-- =============================================
-- 1. UNIQUE CONSTRAINT ON ACCESS CODE
-- =============================================
-- Ensure access codes are unique at the database level
ALTER TABLE instructor_courses
ADD CONSTRAINT instructor_courses_access_code_unique UNIQUE (access_code);

-- =============================================
-- 2. CASCADE DELETES
-- =============================================

-- When a module is deleted, reassign LOs to NULL (orphaned) or delete them
-- Using ON DELETE SET NULL to preserve LOs for potential reassignment
ALTER TABLE learning_objectives
DROP CONSTRAINT IF EXISTS learning_objectives_module_id_fkey;

ALTER TABLE learning_objectives
ADD CONSTRAINT learning_objectives_module_id_fkey
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL;

-- When a course is deleted, cascade delete modules
ALTER TABLE modules
DROP CONSTRAINT IF EXISTS modules_instructor_course_id_fkey;

ALTER TABLE modules
ADD CONSTRAINT modules_instructor_course_id_fkey
FOREIGN KEY (instructor_course_id) REFERENCES instructor_courses(id) ON DELETE CASCADE;

-- When a course is deleted, cascade delete enrollments
ALTER TABLE course_enrollments
DROP CONSTRAINT IF EXISTS course_enrollments_instructor_course_id_fkey;

ALTER TABLE course_enrollments
ADD CONSTRAINT course_enrollments_instructor_course_id_fkey
FOREIGN KEY (instructor_course_id) REFERENCES instructor_courses(id) ON DELETE CASCADE;

-- When an LO is deleted, cascade delete content matches
ALTER TABLE content_matches
DROP CONSTRAINT IF EXISTS content_matches_learning_objective_id_fkey;

ALTER TABLE content_matches
ADD CONSTRAINT content_matches_learning_objective_id_fkey
FOREIGN KEY (learning_objective_id) REFERENCES learning_objectives(id) ON DELETE CASCADE;

-- When an LO is deleted, cascade delete consumption records
ALTER TABLE consumption_records
DROP CONSTRAINT IF EXISTS consumption_records_learning_objective_id_fkey;

ALTER TABLE consumption_records
ADD CONSTRAINT consumption_records_learning_objective_id_fkey
FOREIGN KEY (learning_objective_id) REFERENCES learning_objectives(id) ON DELETE CASCADE;

-- =============================================
-- 3. RLS POLICIES FOR STUDENT LO ACCESS
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Students can view LOs from enrolled courses" ON learning_objectives;
DROP POLICY IF EXISTS "Instructors can manage their course LOs" ON learning_objectives;
DROP POLICY IF EXISTS "Students can view modules from enrolled courses" ON modules;
DROP POLICY IF EXISTS "Instructors can manage their course modules" ON modules;
DROP POLICY IF EXISTS "Students can view matched content from enrolled courses" ON content_matches;

-- Enable RLS on tables if not already enabled
ALTER TABLE learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_matches ENABLE ROW LEVEL SECURITY;

-- Students can view LOs from courses they're enrolled in
CREATE POLICY "Students can view LOs from enrolled courses"
ON learning_objectives
FOR SELECT
TO authenticated
USING (
  -- Either the user created this LO (instructor)
  user_id = auth.uid()
  OR
  -- Or the user is enrolled in the course
  instructor_course_id IN (
    SELECT instructor_course_id
    FROM course_enrollments
    WHERE student_id = auth.uid()
  )
);

-- Instructors can fully manage LOs for their courses
CREATE POLICY "Instructors can manage their course LOs"
ON learning_objectives
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR
  instructor_course_id IN (
    SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR
  instructor_course_id IN (
    SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
  )
);

-- Students can view modules from courses they're enrolled in
CREATE POLICY "Students can view modules from enrolled courses"
ON modules
FOR SELECT
TO authenticated
USING (
  instructor_course_id IN (
    SELECT instructor_course_id
    FROM course_enrollments
    WHERE student_id = auth.uid()
  )
  OR
  instructor_course_id IN (
    SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
  )
);

-- Instructors can manage modules for their courses
CREATE POLICY "Instructors can manage their course modules"
ON modules
FOR ALL
TO authenticated
USING (
  instructor_course_id IN (
    SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
  )
)
WITH CHECK (
  instructor_course_id IN (
    SELECT id FROM instructor_courses WHERE instructor_id = auth.uid()
  )
);

-- Students can view content matches for LOs in their enrolled courses
CREATE POLICY "Students can view matched content from enrolled courses"
ON content_matches
FOR SELECT
TO authenticated
USING (
  learning_objective_id IN (
    SELECT lo.id FROM learning_objectives lo
    WHERE lo.instructor_course_id IN (
      SELECT instructor_course_id
      FROM course_enrollments
      WHERE student_id = auth.uid()
    )
  )
  OR
  learning_objective_id IN (
    SELECT lo.id FROM learning_objectives lo
    JOIN instructor_courses ic ON lo.instructor_course_id = ic.id
    WHERE ic.instructor_id = auth.uid()
  )
);

-- =============================================
-- 4. INDEX FOR ENROLLMENT LOOKUPS
-- =============================================
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_course
ON course_enrollments (student_id, instructor_course_id);

-- =============================================
-- 5. COMMENTS
-- =============================================
COMMENT ON CONSTRAINT instructor_courses_access_code_unique ON instructor_courses
IS 'Ensures access codes are unique across all courses';

COMMENT ON POLICY "Students can view LOs from enrolled courses" ON learning_objectives
IS 'Allows students to view learning objectives from courses they are enrolled in';

COMMENT ON POLICY "Students can view modules from enrolled courses" ON modules
IS 'Allows students to view modules from courses they are enrolled in';
