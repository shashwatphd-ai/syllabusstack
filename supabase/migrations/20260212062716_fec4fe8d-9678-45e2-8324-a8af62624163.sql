
-- ERROR 1: Restrict content table to authenticated users only
DROP POLICY IF EXISTS "Anyone can view available content" ON public.content;

CREATE POLICY "Authenticated users can view available content"
  ON public.content
  FOR SELECT
  TO authenticated
  USING (is_available = true);

-- ERROR 2: Remove anon certificate enumeration policy
DROP POLICY IF EXISTS "Public certificate verification via share token" ON public.certificates;

-- WARNING: Create profiles_safe view excluding Stripe IDs
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker=on) AS
  SELECT
    id, user_id, full_name, email, university, major,
    student_level, graduation_year, avatar_url,
    onboarding_completed, onboarding_step,
    last_active_at, preferences, email_preferences,
    subscription_tier, subscription_status,
    subscription_started_at, subscription_ends_at,
    ai_calls_this_month, ai_calls_reset_at,
    is_instructor_verified, instructor_verification_id, instructor_trust_score,
    is_identity_verified, identity_verification_id,
    organization_id, created_at, updated_at
  FROM public.profiles;

-- WARNING: Explicit deny policy for image_generation_queue
COMMENT ON TABLE public.image_generation_queue IS 
  'Service-role only queue for image generation. No user access intended.';

CREATE POLICY "Service role only - no direct user access"
  ON public.image_generation_queue
  FOR ALL
  TO authenticated
  USING (false);
