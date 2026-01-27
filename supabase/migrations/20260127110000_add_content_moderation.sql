-- ============================================================================
-- Migration: Add Content Moderation System
-- Purpose: Enable admins to review flagged content
-- Impact: Provides content quality control for the platform
-- ============================================================================

-- Content moderation queue table
CREATE TABLE IF NOT EXISTS public.content_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL, -- 'video', 'slide', 'course', 'lo_content'
  content_id UUID NOT NULL,
  course_id UUID REFERENCES instructor_courses(id) ON DELETE CASCADE,
  flagged_by UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb, -- Additional context (title, url, etc.)
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  action_taken VARCHAR(50), -- 'none', 'content_removed', 'user_warned', 'user_banned'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_content_moderation_status ON content_moderation(status, created_at);
CREATE INDEX IF NOT EXISTS idx_content_moderation_content ON content_moderation(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_moderation_course ON content_moderation(course_id);

-- Enable RLS
ALTER TABLE content_moderation ENABLE ROW LEVEL SECURITY;

-- Users can flag content (create reports)
CREATE POLICY "Authenticated users can flag content"
  ON content_moderation FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own flags
CREATE POLICY "Users can view their own flags"
  ON content_moderation FOR SELECT
  USING (auth.uid() = flagged_by);

-- Admins can view all moderation items
CREATE POLICY "Admins can view all moderation items"
  ON content_moderation FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admins can update moderation items
CREATE POLICY "Admins can update moderation items"
  ON content_moderation FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER content_moderation_updated_at
  BEFORE UPDATE ON content_moderation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Role audit log for tracking role changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_roles TEXT[] DEFAULT '{}',
  new_roles TEXT[] DEFAULT '{}',
  action VARCHAR(20) NOT NULL, -- 'added', 'removed', 'modified'
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_role_audit_user ON role_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_role_audit_changed_by ON role_audit_log(changed_by, created_at);

-- Enable RLS
ALTER TABLE role_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit log
CREATE POLICY "Admins can view role audit log"
  ON role_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can create audit entries
CREATE POLICY "Admins can create audit entries"
  ON role_audit_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE content_moderation IS 'Queue for flagged content requiring admin review';
COMMENT ON TABLE role_audit_log IS 'Audit trail for role assignment changes';
