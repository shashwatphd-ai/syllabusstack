import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

interface IssueCertificateRequest {
  enrollment_id: string;
  certificate_type: "completion_badge" | "verified" | "assessed";
  stripe_payment_intent_id?: string;
  mastery_score?: number;
  skill_breakdown?: Record<string, number>;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  logInfo('issue-certificate', 'starting');

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let isServiceCall = false;

    // Check if this is a service call (from webhook) or user call
    if (authHeader?.includes(supabaseServiceKey)) {
      isServiceCall = true;
    } else if (authHeader) {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
      }
      userId = user.id;
    } else {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Authorization required');
    }

    const { 
      enrollment_id, 
      certificate_type, 
      stripe_payment_intent_id,
      mastery_score,
      skill_breakdown
    }: IssueCertificateRequest = await req.json();

    if (!enrollment_id || !certificate_type) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'enrollment_id and certificate_type are required');
    }

    // Fetch enrollment with course details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select(`
        id,
        student_id,
        completed_at,
        overall_progress,
        instructor_course_id,
        instructor_courses (
          id,
          title,
          instructor_id,
          profiles!instructor_courses_instructor_id_fkey (
            full_name
          ),
          instructor_verifications:user_id (
            status
          )
        )
      `)
      .eq("id", enrollment_id)
      .single();

    if (enrollmentError || !enrollment) {
      return createErrorResponse('NOT_FOUND', corsHeaders, 'Enrollment not found');
    }

    // If user call (not service), verify ownership
    if (!isServiceCall && userId !== enrollment.student_id) {
      return createErrorResponse('FORBIDDEN', corsHeaders, 'You can only issue certificates for your own enrollments');
    }

    // Check if certificate already exists for this type
    const { data: existingCert } = await supabase
      .from("certificates")
      .select("id")
      .eq("enrollment_id", enrollment_id)
      .eq("certificate_type", certificate_type)
      .single();

    if (existingCert) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Certificate already exists for this enrollment and type');
    }

    // For paid certificates, verify payment
    if (certificate_type !== "completion_badge" && !stripe_payment_intent_id && !isServiceCall) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Payment required for verified/assessed certificates');
    }

    // For assessed certificates, require mastery score
    if (certificate_type === "assessed" && mastery_score === undefined) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Mastery score required for assessed certificates');
    }

    // Get student profile
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("full_name, is_identity_verified")
      .eq("user_id", enrollment.student_id)
      .single();

    // Generate certificate number and share token
    const { data: certNumber } = await supabase.rpc("generate_certificate_number");
    const { data: shareToken } = await supabase.rpc("generate_share_token");

    const course = enrollment.instructor_courses as any;
    const instructorProfile = course?.profiles;
    
    // Check instructor verification status
    const instructorVerified = false; // Will be populated in Phase 1

    // Calculate amount paid
    const amountPaid = certificate_type === "verified" ? 2500 : 
                       certificate_type === "assessed" ? 4900 : 0;

    // Create certificate record
    const certificateData = {
      user_id: enrollment.student_id,
      instructor_course_id: enrollment.instructor_course_id,
      enrollment_id: enrollment_id,
      certificate_number: certNumber,
      certificate_type,
      mastery_score: mastery_score || null,
      skill_breakdown: skill_breakdown || null,
      identity_verified: studentProfile?.is_identity_verified || false,
      instructor_verified: instructorVerified,
      course_title: course?.title || "Course",
      instructor_name: instructorProfile?.full_name || null,
      institution_name: null, // Will be populated in Phase 3
      completion_date: enrollment.completed_at ? new Date(enrollment.completed_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      share_token: shareToken,
      stripe_payment_intent_id: stripe_payment_intent_id || null,
      amount_paid_cents: amountPaid,
      status: "active",
    };

    const { data: certificate, error: insertError } = await supabase
      .from("certificates")
      .insert(certificateData)
      .select()
      .single();

    if (insertError) {
      logError('issue-certificate', insertError);
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'Failed to create certificate');
    }

    // Update enrollment with certificate reference
    await supabase
      .from("course_enrollments")
      .update({ 
        certificate_id: certificate.id,
        certificate_eligible: true 
      })
      .eq("id", enrollment_id);

    logInfo('issue-certificate', 'complete', {
      certificateType: certificate_type,
      certificateNumber: certNumber,
      enrollmentId: enrollment_id
    });

    // Generate verification URL
    const appUrl = Deno.env.get("APP_URL") || "https://syllabusstack.lovable.app";
    const verificationUrl = `${appUrl}/verify/${shareToken}`;

    return createSuccessResponse({
      certificate: {
        id: certificate.id,
        certificate_number: certificate.certificate_number,
        certificate_type: certificate.certificate_type,
        course_title: certificate.course_title,
        instructor_name: certificate.instructor_name,
        completion_date: certificate.completion_date,
        mastery_score: certificate.mastery_score,
        identity_verified: certificate.identity_verified,
        instructor_verified: certificate.instructor_verified,
        verification_url: verificationUrl,
        share_token: certificate.share_token,
      },
    }, corsHeaders);
  } catch (error) {
    logError('issue-certificate', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'An error occurred');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
