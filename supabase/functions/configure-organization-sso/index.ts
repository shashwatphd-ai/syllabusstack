import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

/**
 * Configure Organization SSO
 *
 * Enterprise feature for setting up SAML/OIDC SSO for organizations.
 * This endpoint validates the configuration and stores SSO settings.
 *
 * Note: Full SSO integration requires WorkOS or similar provider.
 * This implementation provides the configuration storage layer.
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
    }

    logInfo('configure-organization-sso', 'starting', { userId: user.id });

    const body = await req.json();
    const { 
      organization_id, 
      provider, 
      config, 
      domain 
    } = body;

    // Validate required fields
    if (!organization_id || !provider || !domain) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Missing required fields: organization_id, provider, domain');
    }

    // Validate provider
    const validProviders = ["saml", "oidc", "google_workspace", "azure_ad"];
    if (!validProviders.includes(provider)) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, `Invalid provider. Must be one of: ${validProviders.join(", ")}`);
    }

    logInfo('configure-organization-sso', 'validating', { organizationId: organization_id, provider });

    // Check if user is admin of this organization
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership || membership.role !== "admin") {
      return createErrorResponse('FORBIDDEN', corsHeaders, 'Only organization admins can configure SSO');
    }

    // Check organization license tier (SSO requires Pro+ or Enterprise)
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("license_tier")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return createErrorResponse('NOT_FOUND', corsHeaders, 'Organization not found');
    }

    if (!["pro", "enterprise"].includes(org.license_tier || "")) {
      return createErrorResponse('FORBIDDEN', corsHeaders, `SSO requires Pro or Enterprise license tier. Current tier: ${org.license_tier || 'free'}`);
    }

    // Validate provider-specific config
    if (provider === "saml") {
      if (!config?.idp_entity_id || !config?.idp_sso_url || !config?.idp_certificate) {
        return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'SAML requires: idp_entity_id, idp_sso_url, idp_certificate');
      }
    } else if (provider === "oidc" || provider === "google_workspace" || provider === "azure_ad") {
      if (!config?.client_id || !config?.client_secret || !config?.issuer_url) {
        return createErrorResponse('VALIDATION_ERROR', corsHeaders, `${provider} requires: client_id, client_secret, issuer_url`);
      }
    }

    // Store SSO configuration (encrypted in production via vault)
    // For now, store in organization settings
    const ssoConfig = {
      provider,
      domain,
      config: {
        // Don't store secrets directly - in production use Supabase Vault
        idp_entity_id: config?.idp_entity_id,
        idp_sso_url: config?.idp_sso_url,
        issuer_url: config?.issuer_url,
        client_id: config?.client_id,
        // client_secret and certificate should go to vault
        has_certificate: !!config?.idp_certificate,
        has_client_secret: !!config?.client_secret,
      },
      enabled: true,
      configured_at: new Date().toISOString(),
      configured_by: user.id,
    };

    const { error: updateError } = await supabaseAdmin
      .from("organizations")
      .update({
        sso_config: ssoConfig,
        sso_domain: domain,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organization_id);

    if (updateError) {
      logError('configure-organization-sso', new Error(`Update error: ${updateError.message}`));
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'Failed to save SSO configuration');
    }

    // Generate SSO URLs
    const appUrl = Deno.env.get("APP_URL") || "https://syllabusstack.lovable.app";
    const ssoLoginUrl = `${appUrl}/auth/sso?domain=${encodeURIComponent(domain)}`;
    const metadataUrl = provider === "saml"
      ? `${appUrl}/auth/saml/metadata/${organization_id}`
      : undefined;

    logInfo('configure-organization-sso', 'complete', { organizationId: organization_id, provider, domain });

    return createSuccessResponse({
      success: true,
      sso_login_url: ssoLoginUrl,
      metadata_url: metadataUrl,
      provider,
      domain,
    }, corsHeaders);

  } catch (error) {
    logError('configure-organization-sso', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Internal server error');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
