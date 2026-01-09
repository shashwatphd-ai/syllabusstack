-- Subscription System: Freemium tiers and usage tracking
-- Phase 3 Task 3.1 & 3.2

-- Subscription tiers enum
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'university');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add subscription fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Usage tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_calls_this_month INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_calls_reset_at TIMESTAMPTZ DEFAULT now();

-- Create indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- Tier limits configuration table
CREATE TABLE IF NOT EXISTS tier_limits (
  tier subscription_tier PRIMARY KEY,
  max_courses INTEGER NOT NULL,
  max_dream_jobs INTEGER NOT NULL,
  max_ai_calls_per_month INTEGER NOT NULL,
  can_export_pdf BOOLEAN DEFAULT false,
  can_see_all_recommendations BOOLEAN DEFAULT false,
  can_access_advanced_analytics BOOLEAN DEFAULT false,
  can_access_premium_content BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert tier configurations
INSERT INTO tier_limits (tier, max_courses, max_dream_jobs, max_ai_calls_per_month, can_export_pdf, can_see_all_recommendations, can_access_advanced_analytics, can_access_premium_content, priority_support)
VALUES
  ('free', 3, 1, 20, false, false, false, false, false),
  ('pro', 999999, 5, 200, true, true, true, true, false),
  ('university', 999999, 999999, 999999, true, true, true, true, true)
ON CONFLICT (tier) DO UPDATE SET
  max_courses = EXCLUDED.max_courses,
  max_dream_jobs = EXCLUDED.max_dream_jobs,
  max_ai_calls_per_month = EXCLUDED.max_ai_calls_per_month,
  can_export_pdf = EXCLUDED.can_export_pdf,
  can_see_all_recommendations = EXCLUDED.can_see_all_recommendations,
  can_access_advanced_analytics = EXCLUDED.can_access_advanced_analytics,
  can_access_premium_content = EXCLUDED.can_access_premium_content,
  priority_support = EXCLUDED.priority_support;

-- Function to check if user can perform an action based on tier
CREATE OR REPLACE FUNCTION check_tier_limit(
  p_user_id UUID,
  p_limit_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_tier subscription_tier;
  v_current_count INTEGER;
  v_limit INTEGER;
BEGIN
  -- Get user's tier
  SELECT COALESCE(subscription_tier, 'free') INTO v_tier FROM profiles WHERE user_id = p_user_id;

  CASE p_limit_type
    WHEN 'courses' THEN
      SELECT COUNT(*) INTO v_current_count FROM courses WHERE created_by = p_user_id;
      SELECT max_courses INTO v_limit FROM tier_limits WHERE tier = v_tier;
    WHEN 'dream_jobs' THEN
      SELECT COUNT(*) INTO v_current_count FROM user_dream_jobs WHERE user_id = p_user_id;
      SELECT max_dream_jobs INTO v_limit FROM tier_limits WHERE tier = v_tier;
    WHEN 'ai_calls' THEN
      SELECT ai_calls_this_month INTO v_current_count FROM profiles WHERE user_id = p_user_id;
      SELECT max_ai_calls_per_month INTO v_limit FROM tier_limits WHERE tier = v_tier;
    ELSE
      RETURN true; -- Unknown limit type, allow
  END CASE;

  RETURN v_current_count < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment AI call usage
CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, current_usage INTEGER, max_usage INTEGER, tier TEXT) AS $$
DECLARE
  v_tier subscription_tier;
  v_current INTEGER;
  v_max INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Get user's current state
  SELECT
    COALESCE(subscription_tier, 'free'),
    COALESCE(ai_calls_this_month, 0),
    ai_calls_reset_at
  INTO v_tier, v_current, v_reset_at
  FROM profiles
  WHERE user_id = p_user_id;

  -- Check if we need to reset (monthly reset)
  IF v_reset_at IS NULL OR v_reset_at < date_trunc('month', now()) THEN
    UPDATE profiles
    SET ai_calls_this_month = 0, ai_calls_reset_at = now()
    WHERE user_id = p_user_id;
    v_current := 0;
  END IF;

  -- Get limit for tier
  SELECT max_ai_calls_per_month INTO v_max FROM tier_limits WHERE tier = v_tier;

  -- Check if allowed
  IF v_current >= v_max THEN
    RETURN QUERY SELECT false, v_current, v_max, v_tier::TEXT;
    RETURN;
  END IF;

  -- Increment usage
  UPDATE profiles
  SET ai_calls_this_month = ai_calls_this_month + 1
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT true, v_current + 1, v_max, v_tier::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's subscription details
CREATE OR REPLACE FUNCTION get_subscription_details(p_user_id UUID)
RETURNS TABLE(
  tier TEXT,
  status TEXT,
  ai_calls_used INTEGER,
  ai_calls_limit INTEGER,
  courses_used INTEGER,
  courses_limit INTEGER,
  dream_jobs_used INTEGER,
  dream_jobs_limit INTEGER,
  can_export_pdf BOOLEAN,
  can_see_all_recommendations BOOLEAN,
  can_access_advanced_analytics BOOLEAN,
  subscription_ends_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.subscription_tier::TEXT, 'free'),
    COALESCE(p.subscription_status, 'active'),
    COALESCE(p.ai_calls_this_month, 0),
    tl.max_ai_calls_per_month,
    (SELECT COUNT(*)::INTEGER FROM courses WHERE created_by = p_user_id),
    tl.max_courses,
    (SELECT COUNT(*)::INTEGER FROM user_dream_jobs WHERE user_id = p_user_id),
    tl.max_dream_jobs,
    tl.can_export_pdf,
    tl.can_see_all_recommendations,
    tl.can_access_advanced_analytics,
    p.subscription_ends_at
  FROM profiles p
  JOIN tier_limits tl ON tl.tier = COALESCE(p.subscription_tier, 'free')
  WHERE p.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for tier_limits (read-only for all authenticated users)
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tier limits are viewable by all authenticated users"
  ON tier_limits FOR SELECT
  TO authenticated
  USING (true);
