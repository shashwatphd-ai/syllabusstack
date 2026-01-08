-- Content Search Caching System
-- Phase 0 Task 0.1: Reduce YouTube API quota usage by 80-96%

-- Table to cache content search results
CREATE TABLE IF NOT EXISTS content_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_concept TEXT NOT NULL,
  search_keywords TEXT[] DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL CHECK (source IN ('youtube', 'khan_academy', 'library')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '30 days',
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,

  -- Unique constraint to prevent duplicate entries
  CONSTRAINT content_search_cache_unique UNIQUE (search_concept, source)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_content_search_cache_concept
  ON content_search_cache USING gin (to_tsvector('english', search_concept));

CREATE INDEX IF NOT EXISTS idx_content_search_cache_keywords
  ON content_search_cache USING gin (search_keywords);

CREATE INDEX IF NOT EXISTS idx_content_search_cache_expires
  ON content_search_cache (expires_at);

CREATE INDEX IF NOT EXISTS idx_content_search_cache_source
  ON content_search_cache (source);

-- Table to track API quota usage
CREATE TABLE IF NOT EXISTS api_quota_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL CHECK (api_name IN ('youtube', 'khan_academy', 'gemini')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  units_used INTEGER DEFAULT 0,
  requests_count INTEGER DEFAULT 0,

  -- Track quota per API per day
  CONSTRAINT api_quota_tracking_unique UNIQUE (api_name, date)
);

-- Index for efficient date lookups
CREATE INDEX IF NOT EXISTS idx_api_quota_tracking_date
  ON api_quota_tracking (api_name, date DESC);

-- Function to increment cache hit count
CREATE OR REPLACE FUNCTION increment_cache_hit(cache_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE content_search_cache
  SET
    hit_count = hit_count + 1,
    last_hit_at = now()
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- Function to track API usage
CREATE OR REPLACE FUNCTION track_api_usage(
  p_api_name TEXT,
  p_units INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO api_quota_tracking (api_name, date, units_used, requests_count)
  VALUES (p_api_name, CURRENT_DATE, p_units, 1)
  ON CONFLICT (api_name, date)
  DO UPDATE SET
    units_used = api_quota_tracking.units_used + p_units,
    requests_count = api_quota_tracking.requests_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get remaining quota for an API
CREATE OR REPLACE FUNCTION get_remaining_quota(
  p_api_name TEXT,
  p_daily_limit INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  used INTEGER;
BEGIN
  SELECT COALESCE(units_used, 0) INTO used
  FROM api_quota_tracking
  WHERE api_name = p_api_name AND date = CURRENT_DATE;

  RETURN GREATEST(0, p_daily_limit - COALESCE(used, 0));
END;
$$ LANGUAGE plpgsql;

-- Function to find similar cached searches using keyword overlap
CREATE OR REPLACE FUNCTION find_similar_cached_search(
  p_keywords TEXT[],
  p_source TEXT,
  p_min_overlap FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  search_concept TEXT,
  results JSONB,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.search_concept,
    c.results,
    (
      SELECT COUNT(*)::FLOAT / GREATEST(array_length(p_keywords, 1), array_length(c.search_keywords, 1))
      FROM unnest(p_keywords) k
      WHERE k = ANY(c.search_keywords)
    ) as similarity_score
  FROM content_search_cache c
  WHERE c.source = p_source
    AND c.expires_at > now()
    AND c.search_keywords && p_keywords  -- Array overlap operator
  HAVING (
    SELECT COUNT(*)::FLOAT / GREATEST(array_length(p_keywords, 1), array_length(c.search_keywords, 1))
    FROM unnest(p_keywords) k
    WHERE k = ANY(c.search_keywords)
  ) >= p_min_overlap
  ORDER BY similarity_score DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM content_search_cache
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on new tables
ALTER TABLE content_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_quota_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow service role full access (edge functions)
CREATE POLICY "Service role can manage content cache"
  ON content_search_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage API quota"
  ON api_quota_tracking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE content_search_cache IS 'Caches content search results to reduce API quota usage. Part of Phase 0 optimization.';
COMMENT ON TABLE api_quota_tracking IS 'Tracks daily API usage for quota management. Helps prevent quota exhaustion.';
