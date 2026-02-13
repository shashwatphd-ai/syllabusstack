import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

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

    logInfo('initiate-identity-verification', 'starting', { userId: user.id });

    // Check for existing verified IDV
    const { data: existingVerification } = await supabaseAdmin
      .from("identity_verifications")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "verified")
      .single();

    if (existingVerification) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'You are already identity verified');
    }

    // Check for pending verification
    const { data: pendingVerification } = await supabaseAdmin
      .from("identity_verifications")
      .select("id, status, provider_session_token")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .single();

    if (pendingVerification?.provider_session_token) {
      // Return existing session
      logInfo('initiate-identity-verification', 'returning_existing_session', { verificationId: pendingVerification.id });
      return createSuccessResponse({
        verification_id: pendingVerification.id,
        session_token: pendingVerification.provider_session_token,
        status: pendingVerification.status,
        message: "Continuing existing verification session",
      }, corsHeaders);
    }

    // In production, call Persona API to create inquiry
    // For now, create a mock session
    const personaApiKey = Deno.env.get("PERSONA_API_KEY");
    
    let sessionToken: string;
    let inquiryId: string;

    if (personaApiKey) {
      // Real Persona integration
      const personaResponse = await fetch("https://withpersona.com/api/v1/inquiries", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${personaApiKey}`,
          "Content-Type": "application/json",
          "Persona-Version": "2023-01-05",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              "inquiry-template-id": Deno.env.get("PERSONA_TEMPLATE_ID") || "itmpl_default",
              "reference-id": user.id,
              "fields": {
                "email-address": user.email,
              }
            }
          }
        }),
      });

      if (!personaResponse.ok) {
        const errorText = await personaResponse.text();
        logError('initiate-identity-verification', new Error(`Persona API error: ${errorText}`));
        return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'Failed to create identity verification session');
      }

      const personaData = await personaResponse.json();
      sessionToken = personaData.data.attributes["session-token"];
      inquiryId = personaData.data.id;
    } else {
      // Mock for development - generate demo tokens
      logInfo('initiate-identity-verification', 'demo_mode');
      sessionToken = `demo_session_${crypto.randomUUID()}`;
      inquiryId = `inq_demo_${Date.now()}`;
    }

    // Create verification record
    const { data: verification, error: insertError } = await supabaseAdmin
      .from("identity_verifications")
      .insert({
        user_id: user.id,
        provider: "persona",
        provider_inquiry_id: inquiryId,
        provider_session_token: sessionToken,
        status: "pending",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select()
      .single();

    if (insertError) {
      logError('initiate-identity-verification', new Error(`Error creating verification: ${insertError.message}`));
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'Failed to create verification record');
    }

    logInfo('initiate-identity-verification', 'complete', { verificationId: verification.id, userId: user.id });

    return createSuccessResponse({
      verification_id: verification.id,
      session_token: sessionToken,
      inquiry_id: inquiryId,
      status: "pending",
      expires_at: verification.expires_at,
      message: personaApiKey
        ? "Identity verification session created"
        : "Demo mode: IDV session created (no Persona API key configured)",
    }, corsHeaders);
  } catch (error) {
    logError('initiate-identity-verification', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
