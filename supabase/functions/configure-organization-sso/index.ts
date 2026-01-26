import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Configure Organization SSO
 * 
 * Enterprise feature for setting up SAML/OIDC SSO for organizations.
 * This endpoint validates the configuration and stores SSO settings.
 * 
 * Note: Full SSO integration requires WorkOS or similar provider.
 * This implementation provides the configuration storage layer.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const { 
      organization_id, 
      provider, 
      config, 
      domain 
    } = body;

    // Validate required fields
    if (!organization_id || !provider || !domain) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: organization_id, provider, domain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate provider
    const validProviders = ["saml", "oidc", "google_workspace", "azure_ad"];
    if (!validProviders.includes(provider)) {
      return new Response(
        JSON.stringify({ error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin of this organization
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership || membership.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only organization admins can configure SSO" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check organization license tier (SSO requires Pro+ or Enterprise)
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("license_tier")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["pro", "enterprise"].includes(org.license_tier || "")) {
      return new Response(
        JSON.stringify({ 
          error: "SSO requires Pro or Enterprise license tier",
          current_tier: org.license_tier 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate provider-specific config
    if (provider === "saml") {
      if (!config?.idp_entity_id || !config?.idp_sso_url || !config?.idp_certificate) {
        return new Response(
          JSON.stringify({ 
            error: "SAML requires: idp_entity_id, idp_sso_url, idp_certificate" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (provider === "oidc" || provider === "google_workspace" || provider === "azure_ad") {
      if (!config?.client_id || !config?.client_secret || !config?.issuer_url) {
        return new Response(
          JSON.stringify({ 
            error: `${provider} requires: client_id, client_secret, issuer_url` 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      console.error("[configure-sso] Update error:", updateError);
      throw new Error("Failed to save SSO configuration");
    }

    // Generate SSO URLs
    const appUrl = Deno.env.get("APP_URL") || "https://syllabusstack.lovable.app";
    const ssoLoginUrl = `${appUrl}/auth/sso?domain=${encodeURIComponent(domain)}`;
    const metadataUrl = provider === "saml" 
      ? `${appUrl}/auth/saml/metadata/${organization_id}`
      : undefined;

    console.log(`[configure-sso] SSO configured for org ${organization_id} with ${provider}`);

    return new Response(
      JSON.stringify({
        success: true,
        sso_login_url: ssoLoginUrl,
        metadata_url: metadataUrl,
        provider,
        domain,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[configure-sso] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
