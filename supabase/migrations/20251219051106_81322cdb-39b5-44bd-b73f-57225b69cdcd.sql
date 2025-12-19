-- Add job_requirements_cache table for caching common job queries (from spec Part 5)
CREATE TABLE IF NOT EXISTS public.job_requirements_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_query_normalized TEXT UNIQUE NOT NULL,
    requirements_text TEXT NOT NULL,
    day_one_capabilities JSONB DEFAULT '[]'::jsonb,
    differentiators JSONB DEFAULT '[]'::jsonb,
    common_misconceptions JSONB DEFAULT '[]'::jsonb,
    realistic_bar TEXT,
    query_count INTEGER DEFAULT 1,
    last_queried_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_job_requirements_cache_query ON public.job_requirements_cache(job_query_normalized);

-- RLS for job_requirements_cache (read-only for all authenticated users)
ALTER TABLE public.job_requirements_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read job requirements cache"
ON public.job_requirements_cache
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage job requirements cache"
ON public.job_requirements_cache
FOR ALL
TO service_role
USING (true);

-- Add missing columns to courses table (from spec Part 5)
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS capability_text TEXT,
ADD COLUMN IF NOT EXISTS key_capabilities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS evidence_types JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tools_methods JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_model_used TEXT,
ADD COLUMN IF NOT EXISTS ai_cost_usd DECIMAL(10, 6);

-- Add gap_addressed column to recommendations if missing
ALTER TABLE public.recommendations
ADD COLUMN IF NOT EXISTS gap_addressed TEXT;