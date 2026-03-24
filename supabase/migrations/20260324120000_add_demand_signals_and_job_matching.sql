-- ============================================================================
-- Migration: Demand Signal Aggregation & Job Matching Engine
--
-- Adds tables for:
-- 1. demand_signals — Aggregated market demand per skill/location pair
-- 2. company_signals — Company-level demand intelligence from multiple sources
-- 3. lightcast_skill_cache — Cached Lightcast taxonomy data
-- 4. job_matches — Embedding-based student-job matches
-- 5. skill_embeddings — Cached vector representations for skill matching
--
-- Also adds Realtime publications for job_matches, capstone_projects,
-- and capstone_generation_runs.
-- ============================================================================

-- ============================================================================
-- TABLE 1: demand_signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.demand_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name TEXT NOT NULL,
  skill_id TEXT,                      -- Lightcast/O*NET skill ID
  location TEXT,                      -- metro area or state
  source TEXT NOT NULL CHECK (source IN ('lightcast', 'adzuna', 'apollo', 'firecrawl', 'aggregated')),
  signal_type TEXT NOT NULL CHECK (signal_type IN ('job_posting_volume', 'salary_data', 'growth_trend', 'company_demand')),
  signal_value JSONB NOT NULL,        -- Flexible: { count, median_salary, yoy_growth, etc. }
  confidence NUMERIC DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  period_start DATE,
  period_end DATE,
  raw_response JSONB,                 -- Cached API response for debugging
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.demand_signals IS 'Aggregated market demand data per skill/location pair from Lightcast, Adzuna, Apollo, Firecrawl';

ALTER TABLE public.demand_signals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read demand signals (reference data)
CREATE POLICY "Authenticated users can view demand signals"
  ON public.demand_signals FOR SELECT
  TO authenticated
  USING (true);

-- Only service role / admin can write (CRON-based aggregation)
CREATE POLICY "Admins can manage demand signals"
  ON public.demand_signals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_demand_signals_skill_location ON public.demand_signals(skill_name, location);
CREATE INDEX idx_demand_signals_source ON public.demand_signals(source);
CREATE INDEX idx_demand_signals_skill_id ON public.demand_signals(skill_id) WHERE skill_id IS NOT NULL;
CREATE INDEX idx_demand_signals_period ON public.demand_signals(period_start, period_end);

CREATE TRIGGER update_demand_signals_updated_at
  BEFORE UPDATE ON public.demand_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE 2: company_signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  signal_source TEXT NOT NULL CHECK (signal_source IN ('lightcast', 'adzuna', 'apollo', 'firecrawl')),
  signal_type TEXT NOT NULL,
  signal_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.company_signals IS 'Company-level demand intelligence from external data sources';

ALTER TABLE public.company_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company signals"
  ON public.company_signals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage company signals"
  ON public.company_signals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_company_signals_company ON public.company_signals(company_profile_id);
CREATE INDEX idx_company_signals_source_type ON public.company_signals(signal_source, signal_type);
CREATE INDEX idx_company_signals_expires ON public.company_signals(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- TABLE 3: lightcast_skill_cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lightcast_skill_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lightcast_skill_id TEXT UNIQUE NOT NULL,
  skill_name TEXT NOT NULL,
  skill_type TEXT,                    -- 'specialized' | 'common' | 'certification'
  related_skills JSONB,              -- Array of { id, name, confidence }
  category TEXT,
  subcategory TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.lightcast_skill_cache IS 'Cached Lightcast skill taxonomy data with related skills graph';

ALTER TABLE public.lightcast_skill_cache ENABLE ROW LEVEL SECURITY;

-- Public read access (reference data)
CREATE POLICY "Anyone can view lightcast skill cache"
  ON public.lightcast_skill_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage lightcast skill cache"
  ON public.lightcast_skill_cache FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_lightcast_skills_name ON public.lightcast_skill_cache(skill_name);
CREATE INDEX idx_lightcast_skills_type ON public.lightcast_skill_cache(skill_type) WHERE skill_type IS NOT NULL;

-- ============================================================================
-- TABLE 4: job_matches
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  company_name TEXT,
  company_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE SET NULL,
  match_score NUMERIC NOT NULL CHECK (match_score >= 0 AND match_score <= 1),
  skill_overlap JSONB,               -- { matched: [...], missing: [...], extra: [...] }
  salary_estimate JSONB,             -- { min, median, max, currency }
  location TEXT,
  source TEXT CHECK (source IN ('demand_signal', 'direct_posting', 'capstone_completion')),
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'applied', 'matched', 'expired')),
  metadata JSONB,                    -- Additional context (job_posting_url, etc.)
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.job_matches IS 'Embedding-based student-job matches with cosine similarity scores';

ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

-- Students can view their own matches
CREATE POLICY "Students can view own job matches"
  ON public.job_matches FOR SELECT
  USING (student_id = auth.uid());

-- Students can update status on their own matches (e.g., mark as applied)
CREATE POLICY "Students can update own job match status"
  ON public.job_matches FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Admins can view all matches
CREATE POLICY "Admins can view all job matches"
  ON public.job_matches FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all matches
CREATE POLICY "Admins can manage all job matches"
  ON public.job_matches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_job_matches_student ON public.job_matches(student_id);
CREATE INDEX idx_job_matches_score ON public.job_matches(match_score DESC);
CREATE INDEX idx_job_matches_student_status ON public.job_matches(student_id, status);
CREATE INDEX idx_job_matches_company ON public.job_matches(company_profile_id) WHERE company_profile_id IS NOT NULL;

CREATE TRIGGER update_job_matches_updated_at
  BEFORE UPDATE ON public.job_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE 5: skill_embeddings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.skill_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('skill', 'job_posting', 'student_profile', 'course')),
  entity_id TEXT NOT NULL,
  embedding_model TEXT DEFAULT 'text-embedding-004' NOT NULL,
  embedding JSONB NOT NULL,           -- Array of floats (768 dim for Gemini)
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(entity_type, entity_id, embedding_model)
);

COMMENT ON TABLE public.skill_embeddings IS 'Cached vector embeddings for skill matching (service role access only)';

-- No RLS policies for direct user access — service role only
ALTER TABLE public.skill_embeddings ENABLE ROW LEVEL SECURITY;

-- Only admins can read embeddings (internal system table)
CREATE POLICY "Admins can manage skill embeddings"
  ON public.skill_embeddings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_skill_embeddings_entity ON public.skill_embeddings(entity_type, entity_id);

-- ============================================================================
-- REALTIME PUBLICATIONS
-- ============================================================================

-- Enable realtime for job matches (student notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_matches;

-- Enable realtime for capstone projects (instructor/student updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.capstone_projects;

-- Enable realtime for generation runs (progress tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.capstone_generation_runs;
