-- ============================================================================
-- Migration: Fix Admin RLS Policy Security Bug
-- Purpose: Correct RLS policies that incorrectly check for 'instructor' role
--          instead of 'admin' role for admin-only operations
-- Impact: SECURITY FIX - Prevents instructors from viewing all verification
--         requests and managing invite codes (admin-only operations)
-- ============================================================================

-- Drop the incorrect policies
DROP POLICY IF EXISTS "Admins can view all verification requests" ON public.instructor_verifications;
DROP POLICY IF EXISTS "Admins can manage invite codes" ON public.instructor_invite_codes;

-- Recreate with correct admin role check
CREATE POLICY "Admins can view all verification requests"
ON public.instructor_verifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admin policy for updating verification requests (approve/reject)
CREATE POLICY "Admins can update verification requests"
ON public.instructor_verifications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Recreate invite codes policy with correct admin check
CREATE POLICY "Admins can manage invite codes"
ON public.instructor_invite_codes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- ============================================================================
-- Add comment for documentation
-- ============================================================================
COMMENT ON POLICY "Admins can view all verification requests" ON public.instructor_verifications IS
  'Security fix: Only users with admin role can view all verification requests';
COMMENT ON POLICY "Admins can update verification requests" ON public.instructor_verifications IS
  'Security fix: Only admins can approve/reject verification requests';
COMMENT ON POLICY "Admins can manage invite codes" ON public.instructor_invite_codes IS
  'Security fix: Only users with admin role can create/modify invite codes';
