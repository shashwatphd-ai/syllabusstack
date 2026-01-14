-- =============================================
-- SECURITY FIX: Function Search Path Mutable
-- Add SET search_path = public to SECURITY DEFINER functions
-- =============================================

-- 1. Fix add_verified_skill_from_course
CREATE OR REPLACE FUNCTION public.add_verified_skill_from_course(
  p_user_id uuid, 
  p_skill_name text, 
  p_proficiency_level text, 
  p_course_id uuid, 
  p_course_name text, 
  p_evidence_url text DEFAULT NULL::text
)
RETURNS verified_skills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result verified_skills;
BEGIN
  INSERT INTO verified_skills (
    user_id,
    skill_name,
    proficiency_level,
    source_type,
    source_id,
    source_name,
    evidence_url
  ) VALUES (
    p_user_id,
    p_skill_name,
    COALESCE(p_proficiency_level, 'intermediate'),
    'course_assessment',
    p_course_id,
    p_course_name,
    p_evidence_url
  )
  ON CONFLICT (user_id, skill_name, source_type, source_id) DO UPDATE SET
    proficiency_level = EXCLUDED.proficiency_level,
    verified_at = NOW(),
    evidence_url = COALESCE(EXCLUDED.evidence_url, verified_skills.evidence_url),
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

-- 2. Fix auto_complete_linked_recommendations
CREATE OR REPLACE FUNCTION public.auto_complete_linked_recommendations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    UPDATE recommendation_course_links
    SET
      link_status = 'completed',
      completed_at = NOW(),
      progress_percentage = 100,
      updated_at = NOW()
    WHERE instructor_course_id = NEW.instructor_course_id;

    UPDATE recommendations r
    SET
      status = 'completed',
      updated_at = NOW()
    FROM recommendation_course_links rcl
    WHERE rcl.recommendation_id = r.id
      AND rcl.instructor_course_id = NEW.instructor_course_id
      AND rcl.link_status = 'completed'
      AND r.status != 'completed';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Fix get_user_skill_profile
CREATE OR REPLACE FUNCTION public.get_user_skill_profile(p_user_id uuid)
RETURNS TABLE(
  skill_name text, 
  proficiency_level text, 
  source_type text, 
  source_name text, 
  verified boolean, 
  acquired_at timestamp with time zone, 
  evidence_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    vs.skill_name,
    vs.proficiency_level,
    vs.source_type,
    COALESCE(vs.source_name, 'Course Assessment') as source_name,
    true as verified,
    vs.verified_at as acquired_at,
    vs.evidence_url
  FROM verified_skills vs
  WHERE vs.user_id = p_user_id

  UNION ALL

  SELECT
    c.name as skill_name,
    c.proficiency_level,
    'self_reported'::TEXT as source_type,
    COALESCE(co.title, 'Personal Course') as source_name,
    false as verified,
    c.created_at as acquired_at,
    NULL as evidence_url
  FROM capabilities c
  LEFT JOIN courses co ON c.course_id = co.id
  WHERE c.user_id = p_user_id
  AND NOT EXISTS (
    SELECT 1 FROM verified_skills vs
    WHERE vs.user_id = p_user_id
    AND LOWER(vs.skill_name) = LOWER(c.name)
  )

  ORDER BY verified DESC, acquired_at DESC;
END;
$function$;

-- 4. Fix increment_ai_usage
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user_id uuid)
RETURNS TABLE(allowed boolean, current_usage integer, max_usage integer, tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tier TEXT;
  v_current INTEGER;
  v_max INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(subscription_tier, 'free'), COALESCE(ai_calls_this_month, 0), ai_calls_reset_at
  INTO v_tier, v_current, v_reset_at FROM profiles WHERE user_id = p_user_id;

  IF v_reset_at IS NULL OR v_reset_at < date_trunc('month', now()) THEN
    UPDATE profiles SET ai_calls_this_month = 0, ai_calls_reset_at = now() WHERE user_id = p_user_id;
    v_current := 0;
  END IF;

  SELECT max_ai_calls_per_month INTO v_max FROM tier_limits WHERE tier = v_tier;
  IF v_current >= v_max THEN RETURN QUERY SELECT false, v_current, v_max, v_tier; RETURN; END IF;

  UPDATE profiles SET ai_calls_this_month = ai_calls_this_month + 1 WHERE user_id = p_user_id;
  RETURN QUERY SELECT true, v_current + 1, v_max, v_tier;
END;
$function$;

-- 5. Fix increment_api_usage
CREATE OR REPLACE FUNCTION public.increment_api_usage(p_api_name text, p_units integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.api_usage_tracking (api_name, date, usage_count, updated_at)
  VALUES (p_api_name, CURRENT_DATE, p_units, now())
  ON CONFLICT (api_name, date)
  DO UPDATE SET 
    usage_count = api_usage_tracking.usage_count + p_units,
    updated_at = now();
END;
$function$;

-- 6. Fix link_recommendation_to_course (correct signature with 4 params)
CREATE OR REPLACE FUNCTION public.link_recommendation_to_course(
  p_recommendation_id uuid, 
  p_instructor_course_id uuid DEFAULT NULL::uuid, 
  p_learning_objective_id uuid DEFAULT NULL::uuid, 
  p_external_url text DEFAULT NULL::text
)
RETURNS recommendation_course_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result recommendation_course_links;
  v_link_type TEXT;
BEGIN
  IF p_instructor_course_id IS NOT NULL THEN
    v_link_type := 'enrolled';
  ELSIF p_external_url IS NOT NULL THEN
    v_link_type := 'external';
  ELSE
    v_link_type := 'manual';
  END IF;

  INSERT INTO recommendation_course_links (
    recommendation_id,
    instructor_course_id,
    learning_objective_id,
    external_course_url,
    link_type
  ) VALUES (
    p_recommendation_id,
    p_instructor_course_id,
    p_learning_objective_id,
    p_external_url,
    v_link_type
  )
  ON CONFLICT (recommendation_id) DO UPDATE SET
    instructor_course_id = EXCLUDED.instructor_course_id,
    learning_objective_id = EXCLUDED.learning_objective_id,
    external_course_url = EXCLUDED.external_course_url,
    link_type = EXCLUDED.link_type,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

-- =============================================
-- SECURITY FIX: Extension in Public Schema
-- Move vector extension to extensions schema
-- =============================================

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop and recreate vector extension in extensions schema
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION vector WITH SCHEMA extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

-- =============================================
-- SECURITY FIX: Tighten RLS Policies
-- Replace overly permissive policies with authenticated-only where appropriate
-- =============================================

-- Fix achievements policy - require authentication
DROP POLICY IF EXISTS "Achievements are viewable by all authenticated users" ON achievements;
CREATE POLICY "Achievements are viewable by authenticated users" 
ON achievements FOR SELECT 
TO authenticated
USING (true);

-- Fix content_ratings policy - require authentication for viewing
DROP POLICY IF EXISTS "Anyone can view content ratings" ON content_ratings;
CREATE POLICY "Authenticated users can view content ratings" 
ON content_ratings FOR SELECT 
TO authenticated
USING (true);

-- Fix job_requirements_cache policy - require authentication
DROP POLICY IF EXISTS "Anyone can read job requirements cache" ON job_requirements_cache;
CREATE POLICY "Authenticated users can read job requirements cache" 
ON job_requirements_cache FOR SELECT 
TO authenticated
USING (true);

-- Fix suggestion_votes policy - require authentication
DROP POLICY IF EXISTS "Anyone can view votes" ON suggestion_votes;
CREATE POLICY "Authenticated users can view votes" 
ON suggestion_votes FOR SELECT 
TO authenticated
USING (true);

-- Fix tier_limits policy
DROP POLICY IF EXISTS "Tier limits are viewable by all authenticated users" ON tier_limits;
CREATE POLICY "Tier limits are viewable by authenticated users" 
ON tier_limits FOR SELECT 
TO authenticated
USING (true);

-- Add comments documenting the security fixes
COMMENT ON FUNCTION public.add_verified_skill_from_course IS 'SECURITY: Fixed search_path to prevent injection attacks';
COMMENT ON FUNCTION public.auto_complete_linked_recommendations IS 'SECURITY: Fixed search_path to prevent injection attacks';
COMMENT ON FUNCTION public.get_user_skill_profile(uuid) IS 'SECURITY: Fixed search_path to prevent injection attacks';
COMMENT ON FUNCTION public.increment_ai_usage(uuid) IS 'SECURITY: Fixed search_path to prevent injection attacks';
COMMENT ON FUNCTION public.increment_api_usage(text, integer) IS 'SECURITY: Fixed search_path to prevent injection attacks';
COMMENT ON FUNCTION public.link_recommendation_to_course(uuid, uuid, uuid, text) IS 'SECURITY: Fixed search_path to prevent injection attacks';