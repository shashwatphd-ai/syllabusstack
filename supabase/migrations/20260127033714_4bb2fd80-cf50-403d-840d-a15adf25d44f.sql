-- Migration 3: Add Content Moderation System
-- Creates content_moderation and role_audit_log tables

-- Content moderation queue table
CREATE TABLE IF NOT EXISTS public.content_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content_id UUID NOT NULL,
  course_id UUID REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  flagged_by UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  action_taken VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_moderation ENABLE ROW LEVEL SECURITY;

-- Policies for content_moderation
CREATE POLICY "Users can flag content" ON public.content_moderation
  FOR INSERT TO authenticated WITH CHECK (flagged_by = auth.uid());

CREATE POLICY "Admins can view all moderation items" ON public.content_moderation
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update moderation items" ON public.content_moderation
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Role audit log table
CREATE TABLE IF NOT EXISTS public.role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('added', 'removed')),
  role VARCHAR(20) NOT NULL,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for role_audit_log
CREATE POLICY "Admins can view audit log" ON public.role_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit log" ON public.role_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_moderation_status ON public.content_moderation(status);
CREATE INDEX IF NOT EXISTS idx_content_moderation_course ON public.content_moderation(course_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_user ON public.role_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_performed_by ON public.role_audit_log(performed_by);