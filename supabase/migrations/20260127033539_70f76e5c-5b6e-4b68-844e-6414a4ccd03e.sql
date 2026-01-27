-- Migration 1: Add instructor role requests table
-- This migration adds the instructor_role_requests table for instructor onboarding

CREATE TABLE IF NOT EXISTS public.instructor_role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  institution_name TEXT,
  institution_email TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT
);

-- Enable RLS
ALTER TABLE public.instructor_role_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own requests
CREATE POLICY "Users can view own requests" ON public.instructor_role_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own requests" ON public.instructor_role_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Admins can view and update all requests
CREATE POLICY "Admins can view all requests" ON public.instructor_role_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update requests" ON public.instructor_role_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_instructor_role_requests_updated_at
  BEFORE UPDATE ON public.instructor_role_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();