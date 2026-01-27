-- Migration: Add notifications system
-- Enables in-app notifications for users

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'gap_analysis_ready',
    'recommendation_added',
    'skill_verified',
    'course_completed',
    'assessment_passed',
    'dream_job_match',
    'new_content',
    'system_announcement',
    'instructor_message',
    'achievement_unlocked'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Link to related entities
  related_dream_job_id UUID REFERENCES public.dream_jobs(id) ON DELETE SET NULL,
  related_course_id UUID REFERENCES public.instructor_courses(id) ON DELETE SET NULL,
  related_skill_id UUID REFERENCES public.verified_skills(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications(type);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_related_dream_job_id UUID DEFAULT NULL,
  p_related_course_id UUID DEFAULT NULL,
  p_related_skill_id UUID DEFAULT NULL
) RETURNS public.notifications AS $$
DECLARE
  v_notification public.notifications;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    data,
    related_dream_job_id,
    related_course_id,
    related_skill_id
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_data,
    p_related_dream_job_id,
    p_related_course_id,
    p_related_skill_id
  )
  RETURNING * INTO v_notification;

  RETURN v_notification;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_notification_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = ANY(p_notification_ids)
    AND user_id = auth.uid()
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_notifications_read TO authenticated;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid()
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;

-- Trigger function to auto-create notification on skill verification
CREATE OR REPLACE FUNCTION notify_on_skill_verified()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'skill_verified',
    'Skill Verified!',
    format('You''ve verified: %s at %s level', NEW.skill_name, NEW.proficiency_level),
    jsonb_build_object('skill_name', NEW.skill_name, 'proficiency_level', NEW.proficiency_level),
    NULL,
    NULL,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for skill verification notification
DROP TRIGGER IF EXISTS trigger_notify_skill_verified ON public.verified_skills;
CREATE TRIGGER trigger_notify_skill_verified
  AFTER INSERT ON public.verified_skills
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_skill_verified();

-- Trigger function to auto-create notification on gap analysis completion
CREATE OR REPLACE FUNCTION notify_on_gap_analysis_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_dream_job_title TEXT;
BEGIN
  -- Get dream job title
  SELECT title INTO v_dream_job_title
  FROM public.dream_jobs
  WHERE id = NEW.dream_job_id;

  PERFORM create_notification(
    NEW.user_id,
    'gap_analysis_ready',
    'Gap Analysis Ready',
    format('Your gap analysis for "%s" is complete. Match score: %s%%', v_dream_job_title, NEW.match_score),
    jsonb_build_object('match_score', NEW.match_score, 'readiness_level', NEW.readiness_level),
    NEW.dream_job_id,
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for gap analysis notification
DROP TRIGGER IF EXISTS trigger_notify_gap_analysis ON public.gap_analyses;
CREATE TRIGGER trigger_notify_gap_analysis
  AFTER INSERT OR UPDATE ON public.gap_analyses
  FOR EACH ROW
  WHEN (NEW.match_score IS NOT NULL)
  EXECUTE FUNCTION notify_on_gap_analysis_complete();

-- Comments
COMMENT ON TABLE public.notifications IS 'In-app notifications for users';
COMMENT ON FUNCTION create_notification IS 'Creates a notification for a user';
COMMENT ON FUNCTION mark_notifications_read IS 'Marks specified notifications as read';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marks all user notifications as read';
