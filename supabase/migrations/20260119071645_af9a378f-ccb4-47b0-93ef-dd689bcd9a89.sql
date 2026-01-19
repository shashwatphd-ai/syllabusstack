-- Drop existing constraint
ALTER TABLE public.batch_jobs DROP CONSTRAINT IF EXISTS batch_jobs_job_type_check;

-- Add constraint with all job types used in the codebase
ALTER TABLE public.batch_jobs ADD CONSTRAINT batch_jobs_job_type_check
  CHECK (job_type IN ('slides', 'audio', 'assessment', 'curriculum', 'evaluation', 'images', 'research'));