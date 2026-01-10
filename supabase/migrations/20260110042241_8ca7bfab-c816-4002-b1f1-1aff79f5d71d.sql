-- Migration 1: Fix Orphaned Learning Objectives
-- Creates default modules for courses with orphaned LOs and assigns them

-- Step 1: Create "Syllabus Objectives" modules for instructor_courses that have LOs but no modules
INSERT INTO modules (instructor_course_id, title, description, sequence_order)
SELECT DISTINCT 
  lo.instructor_course_id,
  'Syllabus Objectives',
  'Learning objectives extracted from course syllabus',
  1
FROM learning_objectives lo
WHERE lo.module_id IS NULL
  AND lo.instructor_course_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM modules m 
    WHERE m.instructor_course_id = lo.instructor_course_id
  );

-- Step 2: Assign orphaned LOs to their course's first module (by sequence_order)
UPDATE learning_objectives lo
SET module_id = (
  SELECT m.id 
  FROM modules m 
  WHERE m.instructor_course_id = lo.instructor_course_id
  ORDER BY m.sequence_order ASC
  LIMIT 1
)
WHERE lo.module_id IS NULL
  AND lo.instructor_course_id IS NOT NULL;