-- Fix lecture-visuals access: allow signed URL creation for objects named like slide_<lecture_slides_id>_<index>_<ts>.png
-- Existing policies rely on folder prefixes or teaching_unit IDs, which do not match the current file naming scheme.

BEGIN;

-- Replace the overly restrictive SELECT policies for lecture visuals
DROP POLICY IF EXISTS "Enrolled students and instructors can view lecture visuals" ON storage.objects;
DROP POLICY IF EXISTS "Students can read visuals for enrolled courses" ON storage.objects;

CREATE POLICY "Enrolled students and instructors can view lecture visuals"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lecture-visuals'
  AND (
    -- Admin override
    has_role(auth.uid(), 'admin'::app_role)

    -- Pattern A: current naming scheme: slide_<lecture_slides_id>_<index>_<ts>.png
    OR EXISTS (
      SELECT 1
      FROM public.lecture_slides ls
      JOIN public.instructor_courses ic ON ic.id = ls.instructor_course_id
      WHERE ls.id::text = split_part(storage.objects.name, '_', 2)
        AND ic.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.lecture_slides ls
      JOIN public.course_enrollments ce ON ce.instructor_course_id = ls.instructor_course_id
      WHERE ls.id::text = split_part(storage.objects.name, '_', 2)
        AND ce.student_id = auth.uid()
    )

    -- Pattern B: legacy naming scheme: slide_<teaching_unit_id>_...
    OR EXISTS (
      SELECT 1
      FROM public.teaching_units tu
      JOIN public.learning_objectives lo ON lo.id = tu.learning_objective_id
      JOIN public.instructor_courses ic ON ic.id = lo.instructor_course_id
      WHERE storage.objects.name LIKE ('slide_' || tu.id::text || '_%')
        AND ic.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.teaching_units tu
      JOIN public.learning_objectives lo ON lo.id = tu.learning_objective_id
      JOIN public.course_enrollments ce ON ce.instructor_course_id = lo.instructor_course_id
      WHERE storage.objects.name LIKE ('slide_' || tu.id::text || '_%')
        AND ce.student_id = auth.uid()
    )
  )
);

COMMIT;