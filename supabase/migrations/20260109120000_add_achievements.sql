-- Achievement System: Gamification tables
-- Phase 2 Task 2.3

-- Achievements definitions table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  requirement_type TEXT NOT NULL,
  requirement_count INTEGER DEFAULT 1,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User earned achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  notified BOOLEAN DEFAULT false,
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

-- User XP and leveling
CREATE TABLE IF NOT EXISTS user_xp (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_key ON achievements(key);
CREATE INDEX IF NOT EXISTS idx_achievements_tier ON achievements(tier);

-- RLS Policies for achievements (read-only for all users)
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements are viewable by all authenticated users"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_achievements
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert user achievements"
  ON user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update notification status"
  ON user_achievements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_xp
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own XP"
  ON user_xp FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own XP record"
  ON user_xp FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own XP"
  ON user_xp FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Level formula: Level = floor(sqrt(xp / 100)) + 1
  -- Level 1: 0-99 XP
  -- Level 2: 100-399 XP
  -- Level 3: 400-899 XP
  -- Level 4: 900-1599 XP
  -- etc.
  RETURN GREATEST(1, floor(sqrt(xp::float / 100)) + 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to award XP and update level
CREATE OR REPLACE FUNCTION award_xp(p_user_id UUID, p_amount INTEGER)
RETURNS TABLE(new_total_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN) AS $$
DECLARE
  v_old_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Get or create user_xp record
  INSERT INTO user_xp (user_id, total_xp, level)
  VALUES (p_user_id, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get old level
  SELECT level INTO v_old_level FROM user_xp WHERE user_id = p_user_id;

  -- Update XP
  UPDATE user_xp
  SET
    total_xp = total_xp + p_amount,
    level = calculate_level(total_xp + p_amount),
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING total_xp, level INTO v_new_xp, v_new_level;

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant achievement (idempotent)
CREATE OR REPLACE FUNCTION grant_achievement(p_user_id UUID, p_achievement_key TEXT)
RETURNS TABLE(achievement_granted BOOLEAN, achievement_name TEXT, xp_awarded INTEGER) AS $$
DECLARE
  v_achievement achievements%ROWTYPE;
  v_already_has BOOLEAN;
BEGIN
  -- Get achievement by key
  SELECT * INTO v_achievement FROM achievements WHERE key = p_achievement_key;

  IF v_achievement IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 0;
    RETURN;
  END IF;

  -- Check if user already has it
  SELECT EXISTS(
    SELECT 1 FROM user_achievements
    WHERE user_id = p_user_id AND achievement_id = v_achievement.id
  ) INTO v_already_has;

  IF v_already_has THEN
    RETURN QUERY SELECT false, v_achievement.name, 0;
    RETURN;
  END IF;

  -- Grant achievement
  INSERT INTO user_achievements (user_id, achievement_id)
  VALUES (p_user_id, v_achievement.id);

  -- Award XP
  IF v_achievement.xp_reward > 0 THEN
    PERFORM award_xp(p_user_id, v_achievement.xp_reward);
  END IF;

  RETURN QUERY SELECT true, v_achievement.name, v_achievement.xp_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial achievements
INSERT INTO achievements (key, name, description, icon, xp_reward, requirement_type, requirement_count, tier) VALUES
  -- Bronze Tier (Getting Started)
  ('first_course', 'First Step', 'Upload your first course syllabus', 'book-open', 25, 'courses_uploaded', 1, 'bronze'),
  ('first_job', 'Dream Big', 'Add your first dream job', 'briefcase', 25, 'jobs_added', 1, 'bronze'),
  ('first_analysis', 'Gap Hunter', 'Complete your first gap analysis', 'target', 50, 'analyses_completed', 1, 'bronze'),
  ('first_content', 'Content Explorer', 'Watch your first learning video', 'play', 25, 'content_watched', 1, 'bronze'),
  ('first_quiz', 'Quiz Taker', 'Complete your first assessment', 'file-question', 50, 'quizzes_completed', 1, 'bronze'),

  -- Silver Tier (Building Momentum)
  ('course_collector', 'Course Collector', 'Upload 5 course syllabi', 'library', 100, 'courses_uploaded', 5, 'silver'),
  ('job_explorer', 'Career Explorer', 'Add 3 different dream jobs', 'compass', 75, 'jobs_added', 3, 'silver'),
  ('gap_slayer', 'Gap Slayer', 'Close 3 skill gaps with learning progress', 'zap', 200, 'gaps_closed', 3, 'silver'),
  ('verified_learner', 'Verified Learner', 'Pass 10 assessments with 80%+ score', 'award', 250, 'quizzes_passed', 10, 'silver'),
  ('streak_week', 'Weekly Warrior', 'Maintain a 7-day learning streak', 'flame', 100, 'streak_days', 7, 'silver'),

  -- Gold Tier (Mastery)
  ('content_curator', 'Content Curator', 'Have 5 resource suggestions approved', 'star', 150, 'suggestions_approved', 5, 'gold'),
  ('rater', 'Quality Advocate', 'Rate 20 pieces of content', 'message-square', 100, 'content_rated', 20, 'gold'),
  ('course_master', 'Course Master', 'Complete all content in a course', 'graduation-cap', 300, 'courses_completed', 1, 'gold'),
  ('streak_month', 'Monthly Champion', 'Maintain a 30-day learning streak', 'crown', 500, 'streak_days', 30, 'gold'),

  -- Platinum Tier (Excellence)
  ('gap_destroyer', 'Gap Destroyer', 'Close 10 skill gaps', 'shield', 500, 'gaps_closed', 10, 'platinum'),
  ('knowledge_master', 'Knowledge Master', 'Earn 5000 total XP', 'trophy', 1000, 'total_xp', 5000, 'platinum'),
  ('community_hero', 'Community Hero', 'Have 25 resource suggestions approved', 'heart', 750, 'suggestions_approved', 25, 'platinum')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  xp_reward = EXCLUDED.xp_reward,
  requirement_type = EXCLUDED.requirement_type,
  requirement_count = EXCLUDED.requirement_count,
  tier = EXCLUDED.tier;

-- Function to check and grant achievements based on user activity
CREATE OR REPLACE FUNCTION check_achievements(p_user_id UUID)
RETURNS TABLE(newly_earned TEXT[]) AS $$
DECLARE
  v_earned TEXT[] := '{}';
  v_result RECORD;
  v_count INTEGER;
BEGIN
  -- Check courses_uploaded achievements
  SELECT COUNT(*) INTO v_count FROM courses WHERE created_by = p_user_id;
  FOR v_result IN
    SELECT key FROM achievements
    WHERE requirement_type = 'courses_uploaded' AND requirement_count <= v_count
  LOOP
    SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
    IF v_result.achievement_granted THEN
      v_earned := array_append(v_earned, v_result.achievement_name);
    END IF;
  END LOOP;

  -- Check jobs_added achievements
  SELECT COUNT(*) INTO v_count FROM user_dream_jobs WHERE user_id = p_user_id;
  FOR v_result IN
    SELECT key FROM achievements
    WHERE requirement_type = 'jobs_added' AND requirement_count <= v_count
  LOOP
    SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
    IF v_result.achievement_granted THEN
      v_earned := array_append(v_earned, v_result.achievement_name);
    END IF;
  END LOOP;

  -- Check content_rated achievements
  SELECT COUNT(*) INTO v_count FROM content_ratings WHERE user_id = p_user_id;
  FOR v_result IN
    SELECT key FROM achievements
    WHERE requirement_type = 'content_rated' AND requirement_count <= v_count
  LOOP
    SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
    IF v_result.achievement_granted THEN
      v_earned := array_append(v_earned, v_result.achievement_name);
    END IF;
  END LOOP;

  -- Check suggestions_approved achievements
  SELECT COUNT(*) INTO v_count FROM content_suggestions
  WHERE user_id = p_user_id AND status = 'approved';
  FOR v_result IN
    SELECT key FROM achievements
    WHERE requirement_type = 'suggestions_approved' AND requirement_count <= v_count
  LOOP
    SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
    IF v_result.achievement_granted THEN
      v_earned := array_append(v_earned, v_result.achievement_name);
    END IF;
  END LOOP;

  -- Check total_xp achievements
  SELECT total_xp INTO v_count FROM user_xp WHERE user_id = p_user_id;
  IF v_count IS NOT NULL THEN
    FOR v_result IN
      SELECT key FROM achievements
      WHERE requirement_type = 'total_xp' AND requirement_count <= v_count
    LOOP
      SELECT * INTO v_result FROM grant_achievement(p_user_id, v_result.key);
      IF v_result.achievement_granted THEN
        v_earned := array_append(v_earned, v_result.achievement_name);
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
