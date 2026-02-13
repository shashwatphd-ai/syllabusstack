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

    logInfo('identity-verification-status', 'starting', { userId: user.id });

    // Get the most recent verification for this user
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from("identity_verifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      logError('identity-verification-status', new Error(`Error fetching verification: ${fetchError.message}`));
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'Failed to fetch verification status');
    }

    if (!verification) {
      logInfo('identity-verification-status', 'no_verification_found', { userId: user.id });
      return createSuccessResponse({
        status: "none",
        message: "No identity verification found",
      }, corsHeaders);
    }

    // Check if expired
    if (verification.status === "pending" && verification.expires_at) {
      const expiresAt = new Date(verification.expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired
        await supabaseAdmin
          .from("identity_verifications")
          .update({ status: "expired" })
          .eq("id", verification.id);
        
        verification.status = "expired";
      }
    }

    logInfo('identity-verification-status', 'complete', { verificationId: verification.id, status: verification.status });

    return createSuccessResponse({
      verification_id: verification.id,
      status: verification.status,
      provider: verification.provider,
      verified_name: verification.verified_full_name,
      document_type: verification.document_type,
      selfie_match_score: verification.selfie_match_score,
      liveness_passed: verification.liveness_check_passed,
      failure_reason: verification.failure_reason,
      created_at: verification.created_at,
      completed_at: verification.completed_at,
      expires_at: verification.expires_at,
    }, corsHeaders);
  } catch (error) {
    logError('identity-verification-status', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
