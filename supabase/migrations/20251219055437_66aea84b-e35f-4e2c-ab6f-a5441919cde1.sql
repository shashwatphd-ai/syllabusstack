-- Phase 1: Database & Schema Alignment
-- Add pgvector extension and vector columns for semantic search

-- 1.1 Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1.2 Add vector columns to capability_profiles for semantic matching
ALTER TABLE public.capability_profiles 
ADD COLUMN IF NOT EXISTS capability_embedding vector(1536);

-- 1.3 Add vector columns to job_requirements_cache for semantic matching
ALTER TABLE public.job_requirements_cache 
ADD COLUMN IF NOT EXISTS requirements_embedding vector(1536);

-- 1.4 Create indexes for vector similarity search (using cosine distance)
CREATE INDEX IF NOT EXISTS idx_capability_profiles_embedding 
ON public.capability_profiles 
USING ivfflat (capability_embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_job_requirements_cache_embedding 
ON public.job_requirements_cache 
USING ivfflat (requirements_embedding vector_cosine_ops)
WITH (lists = 100);

-- 1.5 Add onboarding_step column to profiles for wizard progress tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

-- 1.6 Add missing fields to gap_analyses if not present
-- (These should already exist but ensuring completeness)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gap_analyses' AND column_name = 'job_success_prediction') THEN
    ALTER TABLE public.gap_analyses ADD COLUMN job_success_prediction text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gap_analyses' AND column_name = 'interview_readiness') THEN
    ALTER TABLE public.gap_analyses ADD COLUMN interview_readiness text;
  END IF;
END $$;