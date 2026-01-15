-- Fix lecture-audio RLS: folder name is lecture_slide_id, not instructor_course_id
-- Need to join through lecture_slides to verify enrollment

DROP POLICY IF EXISTS "Students can read audio for enrolled courses" ON storage.objects;

CREATE POLICY "Students can read audio for enrolled courses"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lecture-audio'
  AND EXISTS (
    SELECT 1 
    FROM lecture_slides ls
    JOIN course_enrollments ce ON ce.instructor_course_id = ls.instructor_course_id
    WHERE ls.id::text = (storage.foldername(name))[1]
      AND ce.student_id = auth.uid()
  )
);

-- Fix lecture-visuals RLS: files are flat with pattern slide_{teaching_unit_id}_{order}_{timestamp}.png
-- Extract teaching_unit_id from filename and verify enrollment through teaching_units -> learning_objectives

DROP POLICY IF EXISTS "Students can read visuals for enrolled courses" ON storage.objects;

CREATE POLICY "Students can read visuals for enrolled courses"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lecture-visuals'
  AND EXISTS (
    SELECT 1 
    FROM teaching_units tu
    JOIN learning_objectives lo ON lo.id = tu.learning_objective_id
    JOIN course_enrollments ce ON ce.instructor_course_id = lo.instructor_course_id
    WHERE 
      -- Extract teaching_unit_id from filename: slide_{teaching_unit_id}_{order}_{timestamp}.png
      name LIKE 'slide_' || tu.id::text || '_%'
      AND ce.student_id = auth.uid()
  )
);

-- Also add instructor access policies
DROP POLICY IF EXISTS "Instructors can manage audio for their courses" ON storage.objects;

CREATE POLICY "Instructors can manage audio for their courses"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'lecture-audio'
  AND EXISTS (
    SELECT 1 
    FROM lecture_slides ls
    JOIN instructor_courses ic ON ic.id = ls.instructor_course_id
    WHERE ls.id::text = (storage.foldername(name))[1]
      AND ic.instructor_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'lecture-audio'
  AND EXISTS (
    SELECT 1 
    FROM lecture_slides ls
    JOIN instructor_courses ic ON ic.id = ls.instructor_course_id
    WHERE ls.id::text = (storage.foldername(name))[1]
      AND ic.instructor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Instructors can manage visuals for their courses" ON storage.objects;

CREATE POLICY "Instructors can manage visuals for their courses"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'lecture-visuals'
  AND EXISTS (
    SELECT 1 
    FROM teaching_units tu
    JOIN learning_objectives lo ON lo.id = tu.learning_objective_id
    JOIN instructor_courses ic ON ic.id = lo.instructor_course_id
    WHERE name LIKE 'slide_' || tu.id::text || '_%'
      AND ic.instructor_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'lecture-visuals'
  AND EXISTS (
    SELECT 1 
    FROM teaching_units tu
    JOIN learning_objectives lo ON lo.id = tu.learning_objective_id
    JOIN instructor_courses ic ON ic.id = lo.instructor_course_id
    WHERE name LIKE 'slide_' || tu.id::text || '_%'
      AND ic.instructor_id = auth.uid()
  )
);