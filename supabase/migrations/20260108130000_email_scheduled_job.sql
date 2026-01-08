-- Email Scheduled Jobs
-- Phase 0 Task 0.3: Set up scheduled weekly digest emails

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role for cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule weekly digest email for every Monday at 9:00 AM UTC
-- This calls the send-digest-email edge function
SELECT cron.schedule(
  'send-weekly-digest',
  '0 9 * * 1',  -- Every Monday at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://fapxxswgdfomqtugibgf.supabase.co/functions/v1/send-digest-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Add function to manually trigger digest (for testing)
CREATE OR REPLACE FUNCTION trigger_weekly_digest()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT net.http_post(
    url := 'https://fapxxswgdfomqtugibgf.supabase.co/functions/v1/send-digest-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add last_digest_sent_at to profiles for tracking
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

-- Index for finding users who need digest emails
CREATE INDEX IF NOT EXISTS idx_profiles_digest_eligible
ON profiles (last_active_at)
WHERE (email_preferences->>'weekly_digest')::boolean = true;

-- Comment for documentation
COMMENT ON FUNCTION trigger_weekly_digest() IS 'Manually trigger the weekly digest email function for testing';
