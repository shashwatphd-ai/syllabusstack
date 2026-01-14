-- Fix subscription tier functions that reference non-existent tables/columns
-- Issue: Functions reference 'user_dream_jobs' (should be 'dream_jobs') and 'courses.created_by' (should be 'courses.user_id')

-- Fix check_tier_limit function
CREATE OR REPLACE FUNCTION public.check_tier_limit(p_user_id uuid, p_limit_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_current_count INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(subscription_tier, 'free') INTO v_tier FROM profiles WHERE user_id = p_user_id;
  CASE p_limit_type
    WHEN 'courses' THEN
      SELECT COUNT(*) INTO v_current_count FROM courses WHERE user_id = p_user_id;
      SELECT max_courses INTO v_limit FROM tier_limits WHERE tier = v_tier;
    WHEN 'dream_jobs' THEN
      SELECT COUNT(*) INTO v_current_count FROM dream_jobs WHERE user_id = p_user_id;
      SELECT max_dream_jobs INTO v_limit FROM tier_limits WHERE tier = v_tier;
    WHEN 'ai_calls' THEN
      SELECT ai_calls_this_month INTO v_current_count FROM profiles WHERE user_id = p_user_id;
      SELECT max_ai_calls_per_month INTO v_limit FROM tier_limits WHERE tier = v_tier;
    ELSE RETURN true;
  END CASE;
  RETURN v_current_count < v_limit;
END;
$function$;

-- Fix get_subscription_details function  
CREATE OR REPLACE FUNCTION public.get_subscription_details(p_user_id uuid)
 RETURNS TABLE(tier text, status text, ai_calls_used integer, ai_calls_limit integer, courses_used integer, courses_limit integer, dream_jobs_used integer, dream_jobs_limit integer, can_export_pdf boolean, can_see_all_recommendations boolean, can_access_advanced_analytics boolean, subscription_ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.subscription_tier, 'free'),
    COALESCE(p.subscription_status, 'active'),
    COALESCE(p.ai_calls_this_month, 0),
    tl.max_ai_calls_per_month,
    (SELECT COUNT(*)::INTEGER FROM courses WHERE user_id = p_user_id),
    tl.max_courses,
    (SELECT COUNT(*)::INTEGER FROM dream_jobs WHERE user_id = p_user_id),
    tl.max_dream_jobs,
    tl.can_export_pdf,
    tl.can_see_all_recommendations,
    tl.can_access_advanced_analytics,
    p.subscription_ends_at
  FROM profiles p
  JOIN tier_limits tl ON tl.tier = COALESCE(p.subscription_tier, 'free')
  WHERE p.user_id = p_user_id;
END;
$function$;

-- Fix check_achievements function
CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id uuid)
 RETURNS TABLE(newly_earned text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_earned TEXT[] := '{}';
  v_result RECORD;
  v_count INTEGER;
BEGIN
  -- Check courses_uploaded achievements
  SELECT COUNT(*) INTO v_count FROM courses WHERE user_id = p_user_id;
  FOR v_result IN SELECT key FROM achievements WHERE requirement_type = 'courses_uploaded' AND requirement_count <= v_count
  LOOP
    SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
    IF v_result.achievement_granted THEN v_earned := array_append(v_earned, v_result.achievement_name); END IF;
  END LOOP;

  -- Check jobs_added achievements (FIXED: use dream_jobs instead of user_dream_jobs)
  SELECT COUNT(*) INTO v_count FROM dream_jobs WHERE user_id = p_user_id;
  FOR v_result IN SELECT key FROM achievements WHERE requirement_type = 'jobs_added' AND requirement_count <= v_count
  LOOP
    SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
    IF v_result.achievement_granted THEN v_earned := array_append(v_earned, v_result.achievement_name); END IF;
  END LOOP;

  -- Check content_rated achievements
  SELECT COUNT(*) INTO v_count FROM content_ratings WHERE user_id = p_user_id;
  FOR v_result IN SELECT key FROM achievements WHERE requirement_type = 'content_rated' AND requirement_count <= v_count
  LOOP
    SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
    IF v_result.achievement_granted THEN v_earned := array_append(v_earned, v_result.achievement_name); END IF;
  END LOOP;

  -- Check suggestions_approved achievements
  SELECT COUNT(*) INTO v_count FROM content_suggestions WHERE user_id = p_user_id AND status = 'approved';
  FOR v_result IN SELECT key FROM achievements WHERE requirement_type = 'suggestions_approved' AND requirement_count <= v_count
  LOOP
    SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
    IF v_result.achievement_granted THEN v_earned := array_append(v_earned, v_result.achievement_name); END IF;
  END LOOP;

  -- Check total_xp achievements
  SELECT total_xp INTO v_count FROM user_xp WHERE user_id = p_user_id;
  IF v_count IS NOT NULL THEN
    FOR v_result IN SELECT key FROM achievements WHERE requirement_type = 'total_xp' AND requirement_count <= v_count
    LOOP
      SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
      IF v_result.achievement_granted THEN v_earned := array_append(v_earned, v_result.achievement_name); END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_earned;
END;
$function$;