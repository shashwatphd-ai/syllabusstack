-- ============================================================================
-- Migration: Add Instructor Role Requests Table
-- Purpose: Enable self-service instructor signup with .edu auto-approval
-- Impact: Allows users to request instructor role without admin intervention
-- ============================================================================

-- Create instructor_role_requests table
CREATE TABLE IF NOT EXISTS instructor_role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email TEXT NOT NULL,
  institution_name TEXT,
  department TEXT,
  title TEXT,
  linkedin_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_instructor_requests_status
  ON instructor_role_requests(status, created_at);

CREATE INDEX IF NOT EXISTS idx_instructor_requests_user
  ON instructor_role_requests(user_id);

-- Enable RLS
ALTER TABLE instructor_role_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own instructor requests"
  ON instructor_role_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own requests
CREATE POLICY "Users can create own instructor requests"
  ON instructor_role_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own pending requests (to add more info)
CREATE POLICY "Users can update own pending requests"
  ON instructor_role_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all requests
CREATE POLICY "Admins can view all instructor requests"
  ON instructor_role_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: Admins can update requests (approve/reject)
CREATE POLICY "Admins can update instructor requests"
  ON instructor_role_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_instructor_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instructor_request_updated_at
  BEFORE UPDATE ON instructor_role_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_instructor_request_updated_at();

-- Add comment for documentation
COMMENT ON TABLE instructor_role_requests IS 'Tracks instructor role requests for self-service signup flow. Auto-approves .edu emails, others require admin review.';
COMMENT ON COLUMN instructor_role_requests.status IS 'pending: awaiting review, approved: manually approved, rejected: denied, auto_approved: .edu email auto-verified';