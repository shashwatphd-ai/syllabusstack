import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

interface VerifyRequest {
  share_token?: string;
  certificate_number?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  logInfo('verify-certificate', 'starting');

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // This is a public endpoint - no auth required
    const { share_token, certificate_number }: VerifyRequest = await req.json();

    if (!share_token && !certificate_number) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'share_token or certificate_number is required');
    }

    // Build query based on provided identifier
    let query = supabase
      .from("certificates")
      .select(`
        id,
        certificate_number,
        certificate_type,
        course_title,
        instructor_name,
        institution_name,
        completion_date,
        mastery_score,
        skill_breakdown,
        identity_verified,
        instructor_verified,
        status,
        issued_at,
        user_id
      `);

    if (share_token) {
      query = query.eq("share_token", share_token);
    } else {
      query = query.eq("certificate_number", certificate_number);
    }

    const { data: certificate, error } = await query.single();

    if (error || !certificate) {
      return createErrorResponse('NOT_FOUND', corsHeaders, 'Certificate not found');
    }

    // Check certificate status
    if (certificate.status !== "active") {
      const errorMessage = certificate.status === "revoked"
        ? "This certificate has been revoked"
        : "This certificate has expired";
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, errorMessage);
    }

    // Get holder name (first name + last initial for privacy)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", certificate.user_id)
      .single();

    let holderName = "Certificate Holder";
    if (profile?.full_name) {
      const nameParts = profile.full_name.trim().split(" ");
      if (nameParts.length >= 2) {
        holderName = `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`;
      } else {
        holderName = nameParts[0];
      }
    }

    // Log verification (for audit trail)
    const verifierIp = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                       req.headers.get("x-real-ip") || 
                       null;
    const verifierUserAgent = req.headers.get("user-agent");

    await supabase.from("certificate_verifications").insert({
      certificate_id: certificate.id,
      verified_via: share_token ? "public_page" : "qr_code",
      verifier_ip: verifierIp,
      verifier_user_agent: verifierUserAgent,
    });

    // Build trust indicators
    const trustIndicators = [];
    if (certificate.identity_verified) {
      trustIndicators.push({
        type: "identity_verified",
        label: "Identity Verified",
        description: "Holder's identity was verified via government ID",
      });
    }
    if (certificate.instructor_verified) {
      trustIndicators.push({
        type: "instructor_verified",
        label: "Verified Instructor",
        description: "Course was created by a verified educational professional",
      });
    }
    if (certificate.certificate_type === "assessed") {
      trustIndicators.push({
        type: "proctored_assessment",
        label: "Proctored Assessment",
        description: "Competency verified through proctored examination",
      });
    }

    // Calculate tier level for display
    const tierLabels = {
      completion_badge: "Course Completion",
      verified: "Verified Completion",
      assessed: "Assessed Mastery",
    };

    logInfo('verify-certificate', 'complete', { certificateNumber: certificate.certificate_number });

    return createSuccessResponse({
      valid: true,
      certificate: {
        certificate_number: certificate.certificate_number,
        certificate_type: certificate.certificate_type,
        tier_label: tierLabels[certificate.certificate_type as keyof typeof tierLabels],
        holder_name: holderName,
        course_title: certificate.course_title,
        instructor_name: certificate.instructor_name,
        institution_name: certificate.institution_name,
        completion_date: certificate.completion_date,
        mastery_score: certificate.mastery_score,
        skill_breakdown: certificate.skill_breakdown,
        issued_at: certificate.issued_at,
      },
      trust_indicators: trustIndicators,
      verification_timestamp: new Date().toISOString(),
    }, corsHeaders);
  } catch (error) {
    logError('verify-certificate', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Verification failed');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
