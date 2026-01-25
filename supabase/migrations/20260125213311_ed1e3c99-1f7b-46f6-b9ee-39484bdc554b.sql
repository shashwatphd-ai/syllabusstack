-- Phase 1: Instructor Verification System

-- instructor_verifications: Track verification requests
CREATE TABLE public.instructor_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_method VARCHAR(30) NOT NULL, -- 'edu_domain', 'linkedin', 'manual', 'invite_code'
  email_domain VARCHAR(255),
  edu_domain_verified BOOLEAN DEFAULT FALSE,
  institution_name VARCHAR(255),
  department VARCHAR(255),
  title VARCHAR(100),
  linkedin_url TEXT,
  document_urls TEXT[],
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  trust_score INTEGER DEFAULT 0, -- 0-100
  rejection_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- instructor_invite_codes: Pre-approved codes for partners
CREATE TABLE public.instructor_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  trust_score_bonus INTEGER DEFAULT 40,
  auto_approve BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add instructor verification fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_instructor_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS instructor_verification_id UUID REFERENCES instructor_verifications(id),
ADD COLUMN IF NOT EXISTS instructor_trust_score INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.instructor_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_invite_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instructor_verifications
CREATE POLICY "Users can view their own verification requests"
ON public.instructor_verifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own verification requests"
ON public.instructor_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending requests"
ON public.instructor_verifications FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all verification requests"
ON public.instructor_verifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'instructor'
  )
);

-- RLS Policies for instructor_invite_codes
CREATE POLICY "Anyone can check invite codes"
ON public.instructor_invite_codes FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Admins can manage invite codes"
ON public.instructor_invite_codes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'instructor'
  )
);

-- Function to validate .edu domain
CREATE OR REPLACE FUNCTION public.is_edu_domain(email_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  domain_part TEXT;
BEGIN
  IF email_address IS NULL OR email_address = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Extract domain from email
  domain_part := LOWER(SUBSTRING(email_address FROM '@(.+)$'));
  
  -- Check if domain ends with .edu
  RETURN domain_part LIKE '%.edu' OR domain_part = 'edu';
END;
$$;

-- Function to use invite code
CREATE OR REPLACE FUNCTION public.use_invite_code(
  p_code VARCHAR(50),
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite instructor_invite_codes%ROWTYPE;
  v_verification_id UUID;
BEGIN
  -- Find and lock the invite code
  SELECT * INTO v_invite
  FROM instructor_invite_codes
  WHERE code = UPPER(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND current_uses < max_uses
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite code');
  END IF;
  
  -- Check if user already has a verification
  IF EXISTS (SELECT 1 FROM instructor_verifications WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a verification request');
  END IF;
  
  -- Create verification record
  INSERT INTO instructor_verifications (
    user_id,
    verification_method,
    trust_score,
    status,
    submitted_at,
    reviewed_at
  ) VALUES (
    p_user_id,
    'invite_code',
    v_invite.trust_score_bonus,
    CASE WHEN v_invite.auto_approve THEN 'approved' ELSE 'pending' END,
    NOW(),
    CASE WHEN v_invite.auto_approve THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_verification_id;
  
  -- Increment usage
  UPDATE instructor_invite_codes 
  SET current_uses = current_uses + 1
  WHERE id = v_invite.id;
  
  -- Update profile if auto-approved
  IF v_invite.auto_approve THEN
    UPDATE profiles
    SET 
      is_instructor_verified = true,
      instructor_verification_id = v_verification_id,
      instructor_trust_score = v_invite.trust_score_bonus
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'verification_id', v_verification_id,
    'status', CASE WHEN v_invite.auto_approve THEN 'approved' ELSE 'pending' END,
    'trust_score', v_invite.trust_score_bonus
  );
END;
$$;

-- Create updated_at trigger for instructor_verifications
CREATE TRIGGER update_instructor_verifications_updated_at
BEFORE UPDATE ON public.instructor_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();