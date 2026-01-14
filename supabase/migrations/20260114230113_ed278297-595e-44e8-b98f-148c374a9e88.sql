-- =============================================
-- SECURITY FIX: Create secure profile view
-- Hide sensitive fields (Stripe IDs, email preferences) from API access
-- =============================================

-- Create a secure view for profiles that excludes sensitive billing data
CREATE VIEW public.profiles_public
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  full_name,
  email,
  university,
  major,
  student_level,
  graduation_year,
  avatar_url,
  onboarding_completed,
  onboarding_step,
  last_active_at,
  preferences,
  subscription_tier,
  subscription_status,
  subscription_started_at,
  subscription_ends_at,
  ai_calls_this_month,
  ai_calls_reset_at,
  created_at,
  updated_at
  -- EXCLUDED: stripe_customer_id, stripe_subscription_id, email_preferences
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Add comment documenting the security configuration
COMMENT ON VIEW public.profiles_public IS 'Secure view excluding Stripe IDs and email preferences - use this for frontend queries';

-- Also create a minimal public profile view for cross-user displays (comments, instructor lists)
CREATE VIEW public.profiles_minimal
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_minimal TO authenticated;

-- Add comment
COMMENT ON VIEW public.profiles_minimal IS 'Minimal profile view for cross-user displays (names in comments, etc.)';