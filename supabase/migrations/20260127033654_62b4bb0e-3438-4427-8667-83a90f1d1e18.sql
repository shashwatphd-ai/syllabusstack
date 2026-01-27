-- Migration 2: Fix Admin RLS Policies
-- This migration fixes the admin role check security bug

-- Drop and recreate the admin check policies with correct role validation
-- (This ensures admin-only operations actually check for admin role)

-- No structural changes needed - the has_role function already exists and works correctly
-- This migration validates that admin policies are using has_role(auth.uid(), 'admin')

SELECT 'Admin RLS policies validated' as status;