import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'API key required');
    }

    // Hash the key to compare
    const keyHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(apiKey)
    );
    const hashHex = Array.from(new Uint8Array(keyHash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Find the API key
    const { data: keyData, error: keyError } = await adminClient
      .from("employer_api_keys")
      .select(`
        id,
        employer_account_id,
        is_active,
        request_count,
        employer_accounts!inner(
          id,
          company_name,
          is_active,
          monthly_verification_limit,
          verifications_this_month
        )
      `)
      .eq("key_hash", hashHex)
      .single();

    if (keyError || !keyData) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid API key');
    }

    if (!keyData.is_active) {
      return createErrorResponse('FORBIDDEN', corsHeaders, 'API key is disabled');
    }

    const account = keyData.employer_accounts as any;
    if (!account.is_active) {
      return createErrorResponse('FORBIDDEN', corsHeaders, 'Employer account is inactive');
    }

    // Check rate limit
    if (account.verifications_this_month >= account.monthly_verification_limit) {
      return createErrorResponse('RATE_LIMIT_EXCEEDED', corsHeaders, 'Monthly verification limit reached');
    }

    // Get request body
    const { certificate_id, certificate_number, share_token } = await req.json();

    if (!certificate_id && !certificate_number && !share_token) {
      return createErrorResponse('BAD_REQUEST', corsHeaders, 'Provide certificate_id, certificate_number, or share_token');
    }

    // Find certificate
    let query = adminClient.from("certificates").select(`
      id,
      certificate_number,
      certificate_type,
      course_title,
      instructor_name,
      institution_name,
      mastery_score,
      skill_breakdown,
      identity_verified,
      instructor_verified,
      completion_date,
      issued_at,
      status
    `);

    if (certificate_id) query = query.eq("id", certificate_id);
    else if (certificate_number) query = query.eq("certificate_number", certificate_number);
    else if (share_token) query = query.eq("share_token", share_token);

    const { data: cert, error: certError } = await query.single();

    // Log the request
    const startTime = Date.now();
    await adminClient.from("employer_api_requests").insert({
      api_key_id: keyData.id,
      endpoint: "/employer-verify-completion",
      request_method: "POST",
      request_ip: req.headers.get("x-forwarded-for") || "unknown",
      response_status: certError ? 404 : 200,
      response_time_ms: Date.now() - startTime,
    });

    // Update API key usage
    await adminClient
      .from("employer_api_keys")
      .update({ 
        last_used_at: new Date().toISOString(),
        request_count: keyData.request_count + 1 
      })
      .eq("id", keyData.id);

    if (certError || !cert) {
      return createErrorResponse('NOT_FOUND', corsHeaders, 'Certificate not found');
    }

    if (cert.status !== "active") {
      return createSuccessResponse({
        valid: false,
        error: "Certificate is not active",
        status: cert.status
      }, corsHeaders);
    }

    // Increment verification count
    await adminClient
      .from("employer_accounts")
      .update({ 
        verifications_this_month: account.verifications_this_month + 1 
      })
      .eq("id", account.id);

    // Log verification in certificate_verifications
    await adminClient.from("certificate_verifications").insert({
      certificate_id: cert.id,
      verified_via: "api",
      verifier_ip: req.headers.get("x-forwarded-for") || "0.0.0.0",
    });

    return createSuccessResponse({
      valid: true,
      certificate: {
        certificate_number: cert.certificate_number,
        certificate_type: cert.certificate_type,
        course_title: cert.course_title,
        instructor_name: cert.instructor_name,
        institution_name: cert.institution_name,
        mastery_score: cert.certificate_type === "assessed" ? cert.mastery_score : null,
        skill_breakdown: cert.certificate_type === "assessed" ? cert.skill_breakdown : null,
        identity_verified: cert.identity_verified,
        instructor_verified: cert.instructor_verified,
        completion_date: cert.completion_date,
        issued_at: cert.issued_at,
      },
      verified_by: account.company_name,
      verified_at: new Date().toISOString(),
    }, corsHeaders);

  } catch (error) {
    logError("employer-verify-completion", error instanceof Error ? error : new Error(String(error)), { action: "verification" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, "Internal server error");
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
