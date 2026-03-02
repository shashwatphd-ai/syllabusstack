
-- Phase 1: Create instructor_invitations table
CREATE TABLE public.instructor_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  depth_level integer NOT NULL DEFAULT 0,
  max_invites_granted integer NOT NULL DEFAULT 1000,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES public.profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- Add invited_by column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.profiles(user_id);

-- Enable RLS
ALTER TABLE public.instructor_invitations ENABLE ROW LEVEL SECURITY;

-- RLS: Instructors can view their own sent invitations
CREATE POLICY "Instructors can view own invitations"
  ON public.instructor_invitations
  FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid());

-- RLS: Service role handles inserts/updates (no user-facing insert policy needed)

-- Index for token lookups
CREATE INDEX idx_instructor_invitations_token ON public.instructor_invitations(token);
CREATE INDEX idx_instructor_invitations_inviter ON public.instructor_invitations(inviter_id);
CREATE INDEX idx_instructor_invitations_email ON public.instructor_invitations(invitee_email);

-- Phase 2: Quota enforcement function
CREATE OR REPLACE FUNCTION public.get_invite_quota(p_user_id uuid)
RETURNS TABLE(total_allowed integer, total_used integer, remaining integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_invites integer;
  v_used integer;
BEGIN
  -- Get max_invites_granted from the invitation that made this user an instructor
  -- Root user (no invitation) gets 1000 by default
  SELECT COALESCE(
    (SELECT ii.max_invites_granted 
     FROM instructor_invitations ii 
     WHERE ii.accepted_by = p_user_id AND ii.status = 'accepted'
     LIMIT 1),
    1000
  ) INTO v_max_invites;

  -- Count invitations sent by this user
  SELECT COUNT(*) INTO v_used
  FROM instructor_invitations
  WHERE inviter_id = p_user_id;

  RETURN QUERY SELECT v_max_invites, v_used, (v_max_invites - v_used);
END;
$$;
