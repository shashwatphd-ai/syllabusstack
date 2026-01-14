-- Fix RLS policies that incorrectly use public role instead of service_role
-- These tables are only meant to be accessed by edge functions via service role

-- Fix ai_cache: Change from public to service_role
DROP POLICY IF EXISTS "Service role can manage cache" ON ai_cache;
CREATE POLICY "Service role can manage ai_cache"
ON ai_cache FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix api_usage_tracking: Change from public to service_role
DROP POLICY IF EXISTS "Service role can manage API usage" ON api_usage_tracking;
CREATE POLICY "Service role can manage api_usage_tracking"
ON api_usage_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);