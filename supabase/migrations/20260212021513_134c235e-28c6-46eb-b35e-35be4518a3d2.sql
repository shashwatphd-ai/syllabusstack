ALTER TABLE public.lecture_slides
ADD COLUMN IF NOT EXISTS audio_generated_at timestamptz;