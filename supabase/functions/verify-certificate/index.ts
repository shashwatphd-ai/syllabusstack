import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  share_token?: string;
  certificate_number?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // This is a public endpoint - no auth required
    const { share_token, certificate_number }: VerifyRequest = await req.json();

    if (!share_token && !certificate_number) {
      return new Response(
        JSON.stringify({ error: "share_token or certificate_number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Certificate not found" 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check certificate status
    if (certificate.status !== "active") {
      return new Response(
        JSON.stringify({
          valid: false,
          status: certificate.status,
          error: certificate.status === "revoked" 
            ? "This certificate has been revoked" 
            : "This certificate has expired",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    console.log(`[verify-certificate] Verified certificate ${certificate.certificate_number}`);

    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[verify-certificate] Error:", error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: error instanceof Error ? error.message : "Verification failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
