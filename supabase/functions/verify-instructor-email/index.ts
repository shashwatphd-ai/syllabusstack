import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";

// Common .edu domains that should auto-approve
const TRUSTED_EDU_DOMAINS = [
  '.edu',
  '.edu.au',
  '.edu.uk',
  '.ac.uk',
  '.edu.cn',
  '.edu.in',
  '.edu.sg',
  '.edu.hk',
  '.edu.tw',
  '.edu.mx',
  '.edu.br',
  '.edu.co',
];

function isEduDomain(email: string): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  return TRUSTED_EDU_DOMAINS.some(eduDomain => 
    domain.endsWith(eduDomain)
  );
}

function calculateTrustScore(verification: {
  eduDomainVerified: boolean;
  linkedinProvided: boolean;
  institutionProvided: boolean;
  documentsProvided: boolean;
}): number {
  let score = 0;
  
  if (verification.eduDomainVerified) score += 40;
  if (verification.linkedinProvided) score += 20;
  if (verification.institutionProvided) score += 15;
  if (verification.documentsProvided) score += 15;
  
  return Math.min(score, 100);
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

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

    const { email, institution_name, department, title, linkedin_url, document_urls } = await req.json();

    // Check if user already has a verification request
    const { data: existingVerification } = await supabaseAdmin
      .from("instructor_verifications")
      .select("id, status")
      .eq("user_id", user.id)
      .single();

    if (existingVerification) {
      if (existingVerification.status === "approved") {
        return new Response(
          JSON.stringify({ error: "You are already verified as an instructor" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (existingVerification.status === "pending") {
        return new Response(
          JSON.stringify({ error: "You already have a pending verification request" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if email is from .edu domain
    const emailToCheck = email || user.email;
    const eduDomainVerified = isEduDomain(emailToCheck);
    const emailDomain = emailToCheck?.split('@')[1]?.toLowerCase();

    // Calculate trust score
    const trustScore = calculateTrustScore({
      eduDomainVerified,
      linkedinProvided: !!linkedin_url,
      institutionProvided: !!institution_name,
      documentsProvided: document_urls && document_urls.length > 0,
    });

    // Determine verification method
    const verificationMethod = eduDomainVerified ? 'edu_domain' : 
      linkedin_url ? 'linkedin' : 'manual';

    // Auto-approve if trust score >= 80 (typically .edu + institution)
    const autoApprove = trustScore >= 80 || (eduDomainVerified && trustScore >= 55);

    // Create verification record
    const { data: verification, error: verificationError } = await supabaseAdmin
      .from("instructor_verifications")
      .insert({
        user_id: user.id,
        verification_method: verificationMethod,
        email_domain: emailDomain,
        edu_domain_verified: eduDomainVerified,
        institution_name,
        department,
        title,
        linkedin_url,
        document_urls,
        trust_score: trustScore,
        status: autoApprove ? 'approved' : 'pending',
        reviewed_at: autoApprove ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (verificationError) {
      console.error("Error creating verification:", verificationError);
      throw new Error("Failed to create verification request");
    }

    // If auto-approved, update the profile
    if (autoApprove) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_instructor_verified: true,
          instructor_verification_id: verification.id,
          instructor_trust_score: trustScore,
        })
        .eq("user_id", user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }

      // Also ensure user has instructor role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: user.id,
          role: 'instructor',
        }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.error("Error updating role:", roleError);
      }
    }

    console.log(`[verify-instructor-email] User ${user.id} submitted verification request. Method: ${verificationMethod}, Score: ${trustScore}, Status: ${autoApprove ? 'approved' : 'pending'}`);

    return new Response(
      JSON.stringify({
        verification_id: verification.id,
        status: verification.status,
        trust_score: trustScore,
        edu_domain_verified: eduDomainVerified,
        auto_approved: autoApprove,
        message: autoApprove 
          ? "Congratulations! Your instructor account has been verified."
          : "Your verification request has been submitted and is pending review.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("verify-instructor-email", error instanceof Error ? error : new Error(String(error)), { action: "verification" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, error instanceof Error ? error.message : "Unknown error");
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
