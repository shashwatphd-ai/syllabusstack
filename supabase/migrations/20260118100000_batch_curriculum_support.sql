-- ============================================================================
-- Migration: Add batch curriculum support
-- Description: Adds columns to track curriculum batch jobs for LO decomposition
-- Created: 2026-01-18
-- Rollback: See rollback section at bottom
-- ============================================================================

-- Step 1: Add curriculum_batch_job_id to learning_objectives
-- This allows tracking which batch job created teaching units for each LO
ALTER TABLE public.learning_objectives
ADD COLUMN IF NOT EXISTS curriculum_batch_job_id UUID REFERENCES public.batch_jobs(id);

-- Step 2: Create index for efficient lookup of LOs by batch job
CREATE INDEX IF NOT EXISTS idx_learning_objectives_curriculum_batch
ON public.learning_objectives(curriculum_batch_job_id)
WHERE curriculum_batch_job_id IS NOT NULL;

-- Step 3: Update batch_jobs job_type constraint to include 'curriculum' and 'evaluation'
-- IMPORTANT: Preserve existing types ('slides', 'audio', 'assessment')
ALTER TABLE public.batch_jobs
DROP CONSTRAINT IF EXISTS batch_jobs_job_type_check;

ALTER TABLE public.batch_jobs
ADD CONSTRAINT batch_jobs_job_type_check
CHECK (job_type IN ('slides', 'audio', 'assessment', 'curriculum', 'evaluation'));

-- Step 4: Add comment explaining the column purpose
COMMENT ON COLUMN public.learning_objectives.curriculum_batch_job_id IS
'References the batch job that created teaching units for this LO via Vertex AI batch prediction';

-- ============================================================================
-- ROLLBACK SECTION (run manually if needed):
-- ============================================================================
-- ALTER TABLE public.learning_objectives DROP COLUMN IF EXISTS curriculum_batch_job_id;
-- DROP INDEX IF EXISTS idx_learning_objectives_curriculum_batch;
--
-- -- Restore original constraint (only if no curriculum/evaluation jobs exist):
-- ALTER TABLE public.batch_jobs DROP CONSTRAINT IF EXISTS batch_jobs_job_type_check;
-- ALTER TABLE public.batch_jobs ADD CONSTRAINT batch_jobs_job_type_check
--   CHECK (job_type IN ('slides', 'audio', 'assessment'));
-- ============================================================================
