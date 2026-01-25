-- Phase 3: Institutional Licensing (B2B)

-- Organizations table for B2B institutional customers
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'university' CHECK (type IN ('university', 'employer', 'training_provider')),
  license_tier VARCHAR(20) DEFAULT 'basic' CHECK (license_tier IN ('basic', 'pro', 'enterprise')),
  seat_limit INTEGER DEFAULT 50,
  seats_used INTEGER DEFAULT 0,
  sso_enabled BOOLEAN DEFAULT FALSE,
  sso_config JSONB DEFAULT '{}'::jsonb,
  custom_branding JSONB DEFAULT '{}'::jsonb,
  stripe_customer_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  license_start_date DATE,
  license_end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization members linking users to organizations
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'instructor', 'student', 'member')),
  department VARCHAR(255),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(organization_id, user_id)
);

-- Organization invitations for pending invites
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'instructor', 'student', 'member')),
  token VARCHAR(100) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add organization_id to profiles for quick access
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Organizations RLS policies
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org owners and admins can update their organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "System can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- Organization members RLS policies
CREATE POLICY "Members can view their organization's members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage members"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can join organizations"
  ON organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Organization invitations RLS policies
CREATE POLICY "Org admins can view and manage invitations"
  ON organization_invitations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Invitees can view their pending invitations"
  ON organization_invitations FOR SELECT
  USING (
    email = (SELECT email FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending'
  );

-- Update trigger for organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to accept invitation and join organization
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(invitation_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation organization_invitations%ROWTYPE;
  v_user_id UUID;
  v_org organizations%ROWTYPE;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Find valid invitation
  SELECT * INTO v_invitation
  FROM organization_invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > NOW();
  
  IF v_invitation.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check org has available seats
  SELECT * INTO v_org FROM organizations WHERE id = v_invitation.organization_id;
  IF v_org.seats_used >= v_org.seat_limit THEN
    RETURN json_build_object('success', false, 'error', 'Organization has reached seat limit');
  END IF;
  
  -- Add member
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_invitation.organization_id, v_user_id, v_invitation.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  -- Update invitation
  UPDATE organization_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = v_invitation.id;
  
  -- Update seat count
  UPDATE organizations
  SET seats_used = seats_used + 1
  WHERE id = v_invitation.organization_id;
  
  -- Update user profile
  UPDATE profiles
  SET organization_id = v_invitation.organization_id
  WHERE user_id = v_user_id;
  
  RETURN json_build_object('success', true, 'organization_id', v_invitation.organization_id);
END;
$$;