-- ============================================================================
-- PHASE 4: Research Caching Table
-- ============================================================================
-- Purpose: Cache Google Search grounding results to reduce API costs and latency
-- TTL: 7 days (research content stays relevant for course development cycle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_hash TEXT NOT NULL UNIQUE,
  search_terms TEXT NOT NULL,
  domain TEXT,
  research_content JSONB NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0
);

-- Index for fast hash lookups
CREATE INDEX IF NOT EXISTS idx_research_cache_topic_hash ON public.research_cache(topic_hash);

-- Index for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_research_cache_expires_at ON public.research_cache(expires_at);

-- Function to cleanup expired cache entries (can be called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_research_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.research_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users (for manual cleanup if needed)
GRANT EXECUTE ON FUNCTION public.cleanup_expired_research_cache() TO authenticated;

-- RLS: Service role only (cache is internal, not user-facing)
ALTER TABLE public.research_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role full access to research_cache"
  ON public.research_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE public.research_cache IS 'Caches Google Search grounding results for batch slide generation. 7-day TTL.';
COMMENT ON COLUMN public.research_cache.topic_hash IS 'SHA-256 hash of normalized search terms + domain for deduplication';
COMMENT ON COLUMN public.research_cache.hit_count IS 'Number of times this cache entry was used (for analytics)';