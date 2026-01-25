import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, persona-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.text();
    const webhookSecret = Deno.env.get("PERSONA_WEBHOOK_SECRET");

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.headers.get("persona-signature");
      if (!signature) {
        console.error("Missing Persona signature");
        return new Response("Unauthorized", { status: 401 });
      }

      // In production, verify HMAC signature
      // For now, log and continue
      console.log("[idv-webhook] Received webhook with signature");
    }

    const payload = JSON.parse(body);
    const eventType = payload.data?.attributes?.name;
    const inquiryData = payload.data?.attributes?.payload?.data;
    
    if (!inquiryData) {
      console.log("[idv-webhook] No inquiry data in webhook payload");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inquiryId = inquiryData.id;
    const inquiryAttributes = inquiryData.attributes || {};
    const referenceId = inquiryAttributes["reference-id"]; // This is the user_id
    const status = inquiryAttributes.status;

    console.log(`[idv-webhook] Event: ${eventType}, Inquiry: ${inquiryId}, Status: ${status}`);

    // Find the verification record
    const { data: verification, error: findError } = await supabaseAdmin
      .from("identity_verifications")
      .select("*")
      .eq("provider_inquiry_id", inquiryId)
      .single();

    if (findError || !verification) {
      console.error("[idv-webhook] Verification not found for inquiry:", inquiryId);
      return new Response(JSON.stringify({ error: "Verification not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      console.error("[idv-webhook] Error updating verification:", updateError);
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
        console.error("[idv-webhook] Error updating profile:", profileError);
      }

      console.log(`[idv-webhook] User ${verification.user_id} identity verified`);
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        verification_id: verification.id,
        new_status: newStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[idv-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
