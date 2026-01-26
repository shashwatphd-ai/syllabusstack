-- Add SSO configuration columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS sso_config JSONB,
ADD COLUMN IF NOT EXISTS sso_domain VARCHAR(255);

-- Create index for SSO domain lookup
CREATE INDEX IF NOT EXISTS idx_organizations_sso_domain 
ON public.organizations(sso_domain) 
WHERE sso_domain IS NOT NULL;

-- Add comment explaining the SSO config structure
COMMENT ON COLUMN public.organizations.sso_config IS 'SSO configuration: {provider, domain, config: {idp_entity_id, idp_sso_url, issuer_url, client_id}, enabled, configured_at, configured_by}';