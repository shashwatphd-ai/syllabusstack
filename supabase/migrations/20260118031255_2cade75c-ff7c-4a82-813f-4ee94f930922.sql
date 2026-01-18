-- Add unique constraint on teaching_unit_id to enable proper upsert
-- This ensures only one slide record per teaching unit

-- First, remove any duplicate teaching_unit_id entries (keep the latest)
DELETE FROM public.lecture_slides a
USING public.lecture_slides b
WHERE a.teaching_unit_id = b.teaching_unit_id
  AND a.created_at < b.created_at;

-- Now add the unique constraint
ALTER TABLE public.lecture_slides
  ADD CONSTRAINT lecture_slides_teaching_unit_id_key UNIQUE (teaching_unit_id);