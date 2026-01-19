-- Drop existing constraint if it exists
ALTER TABLE public.batch_jobs
  DROP CONSTRAINT IF EXISTS batch_jobs_job_type_check;

-- Add updated constraint with all job types
ALTER TABLE public.batch_jobs
  ADD CONSTRAINT batch_jobs_job_type_check
  CHECK (job_type IN ('slides', 'audio', 'assessment', 'curriculum', 'evaluation', 'images', 'research'));