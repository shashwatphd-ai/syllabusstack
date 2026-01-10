-- Migration 2: Content Search Caching System
-- Creates tables and functions for YouTube API quota management

-- Content search cache table
CREATE TABLE IF NOT EXISTS public.content_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_concept TEXT NOT NULL,
  search_keywords TEXT[] NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'youtube',
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  CONSTRAINT valid_source CHECK (source IN ('youtube', 'khan_academy', 'library'))
);

-- API quota tracking table
CREATE TABLE IF NOT EXISTS public.api_quota_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  units_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_quota_unique UNIQUE (api_name, date)
);

-- Enable RLS on new tables
ALTER TABLE public.content_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_quota_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for service role access (edge functions)
CREATE POLICY "Service role full access to cache"
  ON public.content_search_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to quota"
  ON public.api_quota_tracking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cache_source ON public.content_search_cache(source);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON public.content_search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_keywords ON public.content_search_cache USING GIN(search_keywords);
CREATE INDEX IF NOT EXISTS idx_quota_api_date ON public.api_quota_tracking(api_name, date);

-- Function: Find similar cached search
CREATE OR REPLACE FUNCTION public.find_similar_cached_search(
  p_keywords TEXT[],
  p_source TEXT DEFAULT 'youtube',
  p_min_overlap FLOAT DEFAULT 0.6
)
RETURNS TABLE(
  id UUID,
  search_concept TEXT,
  results JSONB,
  overlap_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.search_concept,
    c.results,
    (
      SELECT COUNT(*)::FLOAT / GREATEST(array_length(p_keywords, 1), 1)
      FROM unnest(c.search_keywords) kw
      WHERE kw = ANY(p_keywords)
    ) as overlap
  FROM content_search_cache c
  WHERE c.source = p_source
    AND c.expires_at > now()
    AND c.search_keywords && p_keywords
  ORDER BY overlap DESC
  LIMIT 1;
END;
$$;

-- Function: Get remaining API quota
CREATE OR REPLACE FUNCTION public.get_remaining_quota(
  p_api_name TEXT,
  p_daily_limit INTEGER DEFAULT 10000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  SELECT COALESCE(units_used, 0) INTO v_used
  FROM api_quota_tracking
  WHERE api_name = p_api_name AND date = CURRENT_DATE;
  
  RETURN p_daily_limit - COALESCE(v_used, 0);
END;
$$;

-- Function: Track API usage
CREATE OR REPLACE FUNCTION public.track_api_usage(
  p_api_name TEXT,
  p_units INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total INTEGER;
BEGIN
  INSERT INTO api_quota_tracking (api_name, date, units_used)
  VALUES (p_api_name, CURRENT_DATE, p_units)
  ON CONFLICT (api_name, date)
  DO UPDATE SET 
    units_used = api_quota_tracking.units_used + p_units,
    updated_at = now()
  RETURNING units_used INTO v_new_total;
  
  RETURN v_new_total;
END;
$$;

-- Function: Increment cache hit count
CREATE OR REPLACE FUNCTION public.increment_cache_hit(p_cache_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE content_search_cache
  SET hit_count = hit_count + 1
  WHERE id = p_cache_id;
END;
$$;

-- Function: Cleanup expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM content_search_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;