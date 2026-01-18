-- ============================================================================
-- Migration: Add batch evaluation support
-- Description: Adds columns to track video evaluation batch jobs
-- Created: 2026-01-18
-- Rollback: See rollback section at bottom
-- ============================================================================

-- Step 1: Add evaluation_batch_job_id to content_matches
-- This allows tracking which batch job evaluated each content match
ALTER TABLE public.content_matches
ADD COLUMN IF NOT EXISTS evaluation_batch_job_id UUID REFERENCES public.batch_jobs(id);

-- Step 2: Create index for efficient lookup by batch job
CREATE INDEX IF NOT EXISTS idx_content_matches_evaluation_batch
ON public.content_matches(evaluation_batch_job_id)
WHERE evaluation_batch_job_id IS NOT NULL;

-- Step 3: Add 'pending_evaluation' status for batch tracking
-- Drop existing constraint first
ALTER TABLE public.content_matches
DROP CONSTRAINT IF EXISTS content_matches_status_check;

-- Add updated constraint with new status
ALTER TABLE public.content_matches
ADD CONSTRAINT content_matches_status_check
CHECK (status IN ('pending', 'pending_evaluation', 'approved', 'auto_approved', 'rejected'));

-- Step 4: Add AI evaluation detail columns (for storing batch evaluation results)
-- These provide richer feedback than the existing aggregate scores
ALTER TABLE public.content_matches
ADD COLUMN IF NOT EXISTS ai_relevance_score DECIMAL CHECK (ai_relevance_score BETWEEN 0 AND 1);

ALTER TABLE public.content_matches
ADD COLUMN IF NOT EXISTS ai_pedagogy_score DECIMAL CHECK (ai_pedagogy_score BETWEEN 0 AND 1);

ALTER TABLE public.content_matches
ADD COLUMN IF NOT EXISTS ai_quality_score DECIMAL CHECK (ai_quality_score BETWEEN 0 AND 1);

ALTER TABLE public.content_matches
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

ALTER TABLE public.content_matches
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT CHECK (
  ai_recommendation IS NULL OR
  ai_recommendation IN ('highly_recommended', 'recommended', 'acceptable', 'not_recommended')
);

-- Step 5: Add helpful comments
COMMENT ON COLUMN public.content_matches.evaluation_batch_job_id IS
'References the batch job that evaluated this content match via Vertex AI batch prediction';

COMMENT ON COLUMN public.content_matches.ai_relevance_score IS
'AI-assessed relevance to the learning objective (0-1 scale)';

COMMENT ON COLUMN public.content_matches.ai_pedagogy_score IS
'AI-assessed pedagogical fit for the Blooms level (0-1 scale)';

COMMENT ON COLUMN public.content_matches.ai_quality_score IS
'AI-assessed production and presentation quality (0-1 scale)';

COMMENT ON COLUMN public.content_matches.ai_reasoning IS
'AI explanation of the evaluation scores and recommendation';

COMMENT ON COLUMN public.content_matches.ai_recommendation IS
'AI recommendation category based on weighted scores';

-- ============================================================================
-- ROLLBACK SECTION (run manually if needed):
-- ============================================================================
-- ALTER TABLE public.content_matches DROP COLUMN IF EXISTS evaluation_batch_job_id;
-- ALTER TABLE public.content_matches DROP COLUMN IF EXISTS ai_relevance_score;
-- ALTER TABLE public.content_matches DROP COLUMN IF EXISTS ai_pedagogy_score;
-- ALTER TABLE public.content_matches DROP COLUMN IF EXISTS ai_quality_score;
-- ALTER TABLE public.content_matches DROP COLUMN IF EXISTS ai_reasoning;
-- ALTER TABLE public.content_matches DROP COLUMN IF EXISTS ai_recommendation;
-- DROP INDEX IF EXISTS idx_content_matches_evaluation_batch;
--
-- -- Restore original status constraint:
-- ALTER TABLE public.content_matches DROP CONSTRAINT IF EXISTS content_matches_status_check;
-- ALTER TABLE public.content_matches ADD CONSTRAINT content_matches_status_check
--   CHECK (status IN ('pending', 'approved', 'auto_approved', 'rejected'));
-- ============================================================================
