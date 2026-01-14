-- =========================================
-- SECURITY FIX 1: micro_checks_public
-- Problem: Quiz questions and correct answers are publicly exposed
-- Solution: Replace public read policy with authenticated context-aware policy
-- =========================================

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view micro-checks" ON public.micro_checks;

-- Create a secure policy that only allows:
-- 1. Instructors/admins who created the micro-checks
-- 2. Authenticated users during active video consumption (via edge function)
CREATE POLICY "Creators and admins can view micro-checks"
ON public.micro_checks FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND (
    -- Creator can view their own micro-checks
    created_by = auth.uid()
    -- Or admin role
    OR has_role(auth.uid(), 'admin'::app_role)
    -- Or instructor who owns the content
    OR EXISTS (
      SELECT 1 FROM content c
      JOIN content_matches cm ON cm.content_id = c.id
      JOIN learning_objectives lo ON lo.id = cm.learning_objective_id
      JOIN instructor_courses ic ON ic.id = lo.instructor_course_id
      WHERE c.id = micro_checks.content_id
      AND ic.instructor_id = auth.uid()
    )
  )
);

-- Create a policy for enrolled students to view micro-checks during active consumption
CREATE POLICY "Enrolled students can view micro-checks during consumption"
ON public.micro_checks FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM consumption_records cr
    WHERE cr.user_id = auth.uid()
    AND cr.content_id = micro_checks.content_id
    AND cr.started_at IS NOT NULL
    AND cr.completed_at IS NULL
  )
);

-- =========================================
-- SECURITY FIX 2: lecture_storage_public
-- Problem: Lecture storage buckets are public, bypassing RLS
-- Solution: Make buckets private and add enrollment-based access
-- =========================================

-- Make the lecture-visuals bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'lecture-visuals';

-- Make the lecture-audio bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'lecture-audio';

-- Drop the overly permissive storage policies
DROP POLICY IF EXISTS "Anyone can view lecture visuals" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read lecture audio" ON storage.objects;

-- Create enrollment-based access policy for lecture visuals
CREATE POLICY "Enrolled students and instructors can view lecture visuals"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lecture-visuals'
  AND auth.role() = 'authenticated'
  AND (
    -- Instructor who owns the course
    EXISTS (
      SELECT 1 FROM instructor_courses ic
      WHERE ic.instructor_id = auth.uid()
      AND (storage.foldername(name))[1] = ic.id::text
    )
    -- Or enrolled student
    OR EXISTS (
      SELECT 1 FROM course_enrollments ce
      JOIN instructor_courses ic ON ic.id = ce.instructor_course_id
      WHERE ce.student_id = auth.uid()
      AND (storage.foldername(name))[1] = ic.id::text
    )
    -- Or admin
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Create enrollment-based access policy for lecture audio
CREATE POLICY "Enrolled students and instructors can view lecture audio"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lecture-audio'
  AND auth.role() = 'authenticated'
  AND (
    -- Instructor who owns the course
    EXISTS (
      SELECT 1 FROM instructor_courses ic
      WHERE ic.instructor_id = auth.uid()
      AND (storage.foldername(name))[1] = ic.id::text
    )
    -- Or enrolled student
    OR EXISTS (
      SELECT 1 FROM course_enrollments ce
      JOIN instructor_courses ic ON ic.id = ce.instructor_course_id
      WHERE ce.student_id = auth.uid()
      AND (storage.foldername(name))[1] = ic.id::text
    )
    -- Or admin
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- =========================================
-- SECURITY FIX 3: security_definer_functions
-- Problem: XP/achievement functions can be called for any user
-- Solution: Add auth.uid() validation to prevent abuse
-- =========================================

-- First drop the existing functions to recreate with same signature
DROP FUNCTION IF EXISTS public.award_xp(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.grant_achievement(UUID, TEXT);
DROP FUNCTION IF EXISTS public.check_achievements(UUID);

-- Recreate award_xp with security validation
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id UUID, p_amount INTEGER)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_xp_per_level INTEGER := 500;
BEGIN
  -- Security check: only allow awarding XP to self or by admin
  IF p_user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot award XP to other users';
  END IF;

  -- Get or create user progress
  SELECT xp, level INTO v_current_xp, v_current_level
  FROM user_progress
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_progress (user_id, xp, level)
    VALUES (p_user_id, p_amount, 1)
    RETURNING xp, level INTO v_new_xp, v_new_level;
    
    RETURN QUERY SELECT v_new_xp, v_new_level, false;
    RETURN;
  END IF;
  
  v_new_xp := v_current_xp + p_amount;
  v_new_level := GREATEST(1, (v_new_xp / v_xp_per_level) + 1);
  
  UPDATE user_progress
  SET xp = v_new_xp,
      level = v_new_level,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN QUERY SELECT v_new_xp, v_new_level, v_new_level > v_current_level;
END;
$$;

-- Recreate grant_achievement with security validation
CREATE OR REPLACE FUNCTION public.grant_achievement(p_user_id UUID, p_achievement_key TEXT)
RETURNS TABLE(granted BOOLEAN, achievement_name TEXT, xp_awarded INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_achievement_id UUID;
  v_achievement_name TEXT;
  v_xp_reward INTEGER;
  v_already_has BOOLEAN;
BEGIN
  -- Security check: only allow granting achievements to self or by admin
  IF p_user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot grant achievements to other users';
  END IF;

  -- Get achievement details
  SELECT id, name, xp_reward INTO v_achievement_id, v_achievement_name, v_xp_reward
  FROM achievements
  WHERE key = p_achievement_key;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, 0;
    RETURN;
  END IF;
  
  -- Check if already has achievement
  SELECT EXISTS (
    SELECT 1 FROM user_achievements
    WHERE user_id = p_user_id AND achievement_id = v_achievement_id
  ) INTO v_already_has;
  
  IF v_already_has THEN
    RETURN QUERY SELECT false, v_achievement_name, 0;
    RETURN;
  END IF;
  
  -- Grant achievement
  INSERT INTO user_achievements (user_id, achievement_id)
  VALUES (p_user_id, v_achievement_id);
  
  -- Award XP if applicable
  IF v_xp_reward > 0 THEN
    PERFORM award_xp(p_user_id, v_xp_reward);
  END IF;
  
  RETURN QUERY SELECT true, v_achievement_name, COALESCE(v_xp_reward, 0);
END;
$$;

-- Recreate check_achievements with security validation
CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id UUID)
RETURNS TABLE(newly_granted TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted TEXT[] := '{}';
  v_achievement RECORD;
  v_count INTEGER;
  v_result RECORD;
BEGIN
  -- Security check: only allow checking achievements for self or by admin
  IF p_user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot check achievements for other users';
  END IF;

  -- Check each achievement type
  FOR v_achievement IN 
    SELECT * FROM achievements 
    WHERE id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = p_user_id)
  LOOP
    v_count := 0;
    
    CASE v_achievement.requirement_type
      WHEN 'courses_added' THEN
        SELECT COUNT(*) INTO v_count FROM courses WHERE user_id = p_user_id;
      WHEN 'dream_jobs_added' THEN
        SELECT COUNT(*) INTO v_count FROM dream_jobs WHERE user_id = p_user_id;
      WHEN 'analyses_completed' THEN
        SELECT COUNT(*) INTO v_count FROM gap_analyses WHERE user_id = p_user_id;
      WHEN 'recommendations_completed' THEN
        SELECT COUNT(*) INTO v_count FROM recommendations WHERE user_id = p_user_id AND status = 'completed';
      WHEN 'lo_verified' THEN
        SELECT COUNT(*) INTO v_count FROM learning_objectives WHERE user_id = p_user_id AND verification_state = 'verified';
      WHEN 'content_watched' THEN
        SELECT COUNT(*) INTO v_count FROM consumption_records WHERE user_id = p_user_id AND is_verified = true;
      ELSE
        v_count := 0;
    END CASE;
    
    IF v_count >= COALESCE(v_achievement.requirement_count, 1) THEN
      SELECT * INTO v_result FROM grant_achievement(p_user_id, v_achievement.key);
      IF v_result.granted THEN
        v_granted := array_append(v_granted, v_achievement.key);
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_granted;
END;
$$;