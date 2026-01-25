-- Phase 2: Student Identity Verification (IDV)

-- identity_verifications: Track IDV attempts via external providers
CREATE TABLE public.identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'persona', -- 'persona', 'jumio', 'manual'
  provider_inquiry_id VARCHAR(255),
  provider_session_token TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'verified', 'failed', 'expired'
  verified_full_name VARCHAR(255),
  verified_date_of_birth DATE,
  document_type VARCHAR(50), -- 'passport', 'drivers_license', 'national_id'
  document_country VARCHAR(3),
  selfie_match_score DECIMAL(5,4),
  liveness_check_passed BOOLEAN,
  failure_reason TEXT,
  cost_usd DECIMAL(10,4),
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add IDV fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_identity_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS identity_verification_id UUID REFERENCES identity_verifications(id);

-- Enable RLS
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own IDV records"
ON public.identity_verifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own IDV records"
ON public.identity_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can update (webhooks)
CREATE POLICY "Service role can update IDV records"
ON public.identity_verifications FOR UPDATE
USING (TRUE)
WITH CHECK (TRUE);

-- Create index for faster lookups
CREATE INDEX idx_identity_verifications_user_id ON public.identity_verifications(user_id);
CREATE INDEX idx_identity_verifications_provider_inquiry_id ON public.identity_verifications(provider_inquiry_id);

-- Trigger for updated_at
CREATE TRIGGER update_identity_verifications_updated_at
BEFORE UPDATE ON public.identity_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();