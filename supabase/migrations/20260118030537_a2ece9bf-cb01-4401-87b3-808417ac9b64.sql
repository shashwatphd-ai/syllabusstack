-- Add new statuses to batch_jobs constraint for two-function pattern
ALTER TABLE public.batch_jobs
  DROP CONSTRAINT IF EXISTS batch_jobs_status_check;

ALTER TABLE public.batch_jobs
  ADD CONSTRAINT batch_jobs_status_check
  CHECK (status IN (
    'preparing',     -- Placeholders created, waiting for research
    'researching',   -- Research in progress
    'submitted',     -- Submitted to Vertex AI
    'pending',       -- Vertex AI job queued
    'processing',    -- Vertex AI job running
    'completed',     -- All done successfully
    'failed',        -- Job failed
    'partial'        -- Some succeeded, some failed
  ));

-- Add 'preparing' to lecture_slides constraint
ALTER TABLE public.lecture_slides
  DROP CONSTRAINT IF EXISTS lecture_slides_status_check;

ALTER TABLE public.lecture_slides
  ADD CONSTRAINT lecture_slides_status_check
  CHECK (status IN (
    'pending',
    'preparing',      -- Waiting for research
    'batch_pending',
    'generating',
    'ready',
    'published',
    'failed'
  ));