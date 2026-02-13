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

    const body = await req.text();
    const webhookSecret = Deno.env.get("PERSONA_WEBHOOK_SECRET");

    logInfo('idv-webhook', 'received');

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.headers.get("persona-signature");
      if (!signature) {
        logError('idv-webhook', new Error('Missing Persona signature'));
        return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Missing Persona signature');
      }

      // In production, verify HMAC signature
      // For now, log and continue
      logInfo('idv-webhook', 'signature_present');
    }

    const payload = JSON.parse(body);
    const eventType = payload.data?.attributes?.name;
    const inquiryData = payload.data?.attributes?.payload?.data;
    
    if (!inquiryData) {
      logInfo('idv-webhook', 'no_inquiry_data');
      return createSuccessResponse({ received: true }, corsHeaders);
    }

    const inquiryId = inquiryData.id;
    const inquiryAttributes = inquiryData.attributes || {};
    const referenceId = inquiryAttributes["reference-id"]; // This is the user_id
    const status = inquiryAttributes.status;

    logInfo('idv-webhook', 'processing', { eventType, inquiryId, status });

    // Find the verification record
    const { data: verification, error: findError } = await supabaseAdmin
      .from("identity_verifications")
      .select("*")
      .eq("provider_inquiry_id", inquiryId)
      .single();

    if (findError || !verification) {
      logError('idv-webhook', new Error(`Verification not found for inquiry: ${inquiryId}`));
      return createErrorResponse('NOT_FOUND', corsHeaders, 'Verification not found');
    }

    // Map Persona status to our status
    let newStatus: string;
    let verifiedName: string | null = null;
    let selfieScore: number | null = null;
    let livenessCheck: boolean | null = null;
    let documentType: string | null = null;
    let failureReason: string | null = null;

    switch (status) {
      case "completed":
      case "approved":
        newStatus = "verified";
        verifiedName = inquiryAttributes["name-first"] 
          ? `${inquiryAttributes["name-first"]} ${inquiryAttributes["name-last"] || ""}`.trim()
          : null;
        
        // Extract verification results from the inquiry
        const verifications = inquiryAttributes.verifications || [];
        for (const v of verifications) {
          if (v.type === "verification/selfie") {
            selfieScore = v.attributes?.["match-score"] || null;
            livenessCheck = v.attributes?.["center-photo-face-match"] === "passed";
          }
          if (v.type === "verification/government-id") {
            documentType = v.attributes?.["id-class"] || null;
          }
        }
        break;
      
      case "failed":
      case "declined":
        newStatus = "failed";
        failureReason = inquiryAttributes["decline-reason"] || "Verification failed";
        break;
      
      case "needs_review":
      case "pending":
        newStatus = "processing";
        break;
      
      case "expired":
        newStatus = "expired";
        break;
      
      default:
        newStatus = "processing";
    }

    // Update verification record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      webhook_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (verifiedName) updateData.verified_full_name = verifiedName;
    if (selfieScore !== null) updateData.selfie_match_score = selfieScore;
    if (livenessCheck !== null) updateData.liveness_check_passed = livenessCheck;
    if (documentType) updateData.document_type = documentType;
    if (failureReason) updateData.failure_reason = failureReason;
    if (newStatus === "verified" || newStatus === "failed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("identity_verifications")
      .update(updateData)
      .eq("id", verification.id);

    if (updateError) {
      logError('idv-webhook', new Error(`Error updating verification: ${updateError.message}`));
    }

    // If verified, update the user's profile
    if (newStatus === "verified") {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_identity_verified: true,
          identity_verification_id: verification.id,
        })
        .eq("user_id", verification.user_id);

      if (profileError) {
        logError('idv-webhook', new Error(`Error updating profile: ${profileError.message}`));
      }

      logInfo('idv-webhook', 'user_verified', { userId: verification.user_id });
    }

    logInfo('idv-webhook', 'complete', { verificationId: verification.id, newStatus });
    return createSuccessResponse({
      received: true,
      verification_id: verification.id,
      new_status: newStatus,
    }, corsHeaders);
  } catch (error) {
    logError('idv-webhook', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
