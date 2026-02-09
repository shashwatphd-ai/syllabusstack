-- Add generation_model column to image_generation_queue
-- Tracks which AI model actually produced each image for quality auditing.
-- Allows correlating quality complaints with fallback model usage.

ALTER TABLE public.image_generation_queue
  ADD COLUMN IF NOT EXISTS generation_model TEXT;

COMMENT ON COLUMN public.image_generation_queue.generation_model IS
  'AI model that generated this image (e.g. google/gemini-3-pro-image-preview). NULL for legacy rows.';
