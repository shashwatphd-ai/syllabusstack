-- Phase 4: Employer Access Portal

-- Employer accounts
CREATE TABLE public.employer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  company_domain VARCHAR(255),
  plan VARCHAR(20) DEFAULT 'basic' CHECK (plan IN ('basic', 'api', 'recruiting')),
  primary_contact_email VARCHAR(255),
  primary_contact_user_id UUID REFERENCES auth.users(id),
  stripe_customer_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  monthly_verification_limit INTEGER DEFAULT 100,
  verifications_this_month INTEGER DEFAULT 0,
  verifications_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employer API keys
CREATE TABLE public.employer_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix VARCHAR(10),
  name VARCHAR(100),
  permissions TEXT[] DEFAULT ARRAY['verify'],
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  request_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employer API request audit log
CREATE TABLE public.employer_api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES employer_api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(100),
  request_method VARCHAR(10),
  request_ip INET,
  response_status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employer webhooks configuration
CREATE TABLE public.employer_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] DEFAULT ARRAY['certificate.verified'],
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.employer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policies for employer_accounts
CREATE POLICY "Users can view their employer account"
  ON employer_accounts FOR SELECT
  USING (primary_contact_user_id = auth.uid());

CREATE POLICY "Users can update their employer account"
  ON employer_accounts FOR UPDATE
  USING (primary_contact_user_id = auth.uid());

CREATE POLICY "Authenticated users can create employer accounts"
  ON employer_accounts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS policies for employer_api_keys
CREATE POLICY "Employer owners can manage API keys"
  ON employer_api_keys FOR ALL
  USING (
    employer_account_id IN (
      SELECT id FROM employer_accounts WHERE primary_contact_user_id = auth.uid()
    )
  );

-- RLS policies for employer_api_requests (read-only for account owners)
CREATE POLICY "Employer owners can view request logs"
  ON employer_api_requests FOR SELECT
  USING (
    api_key_id IN (
      SELECT id FROM employer_api_keys WHERE employer_account_id IN (
        SELECT id FROM employer_accounts WHERE primary_contact_user_id = auth.uid()
      )
    )
  );

-- RLS policies for employer_webhooks
CREATE POLICY "Employer owners can manage webhooks"
  ON employer_webhooks FOR ALL
  USING (
    employer_account_id IN (
      SELECT id FROM employer_accounts WHERE primary_contact_user_id = auth.uid()
    )
  );

-- Update trigger
CREATE TRIGGER update_employer_accounts_updated_at
  BEFORE UPDATE ON employer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate API key (returns the key, stores hash)
CREATE OR REPLACE FUNCTION public.generate_employer_api_key(
  p_employer_account_id UUID,
  p_name VARCHAR(100) DEFAULT 'Default Key'
)
RETURNS TABLE(api_key TEXT, key_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_hash TEXT;
  v_prefix VARCHAR(10);
  v_key_id UUID;
BEGIN
  -- Generate random key: ss_live_xxxxxxxxxxxxxxxxxxxxxxxx
  v_key := 'ss_live_' || encode(gen_random_bytes(24), 'hex');
  v_prefix := substring(v_key, 1, 10);
  v_hash := encode(sha256(v_key::bytea), 'hex');
  
  -- Insert key record
  INSERT INTO employer_api_keys (employer_account_id, key_hash, key_prefix, name)
  VALUES (p_employer_account_id, v_hash, v_prefix, p_name)
  RETURNING id INTO v_key_id;
  
  RETURN QUERY SELECT v_key, v_key_id;
END;
$$;