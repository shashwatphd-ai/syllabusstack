import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Check if reviewer is an admin
    const { data: reviewerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = reviewerRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const { verification_id, action, rejection_reason, trust_score_adjustment } = await req.json();

    if (!verification_id || !action) {
      throw new Error("verification_id and action are required");
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new Error("action must be 'approve' or 'reject'");
    }

    // Get the verification request
    const { data: verification, error: verificationError } = await supabaseAdmin
      .from("instructor_verifications")
      .select("*")
      .eq("id", verification_id)
      .single();

    if (verificationError || !verification) {
      throw new Error("Verification request not found");
    }

    if (verification.status !== 'pending') {
      throw new Error("This verification request has already been reviewed");
    }

    const newTrustScore = trust_score_adjustment 
      ? Math.min(100, Math.max(0, verification.trust_score + trust_score_adjustment))
      : verification.trust_score + (action === 'approve' ? 20 : 0);

    // Update verification
    const { error: updateError } = await supabaseAdmin
      .from("instructor_verifications")
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        trust_score: newTrustScore,
        rejection_reason: action === 'reject' ? rejection_reason : null,
        reviewed_at: new Date().toISOString(),
        reviewer_id: user.id,
      })
      .eq("id", verification_id);

    if (updateError) {
      console.error("Error updating verification:", updateError);
      throw new Error("Failed to update verification");
    }

    // If approved, update the user's profile
    if (action === 'approve') {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_instructor_verified: true,
          instructor_verification_id: verification_id,
          instructor_trust_score: newTrustScore,
        })
        .eq("user_id", verification.user_id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }

      // Ensure user has instructor role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: verification.user_id,
          role: 'instructor',
        }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.error("Error updating role:", roleError);
      }
    }

    console.log(`[review-instructor-verification] Reviewer ${user.id} ${action}ed verification ${verification_id} for user ${verification.user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        verification_id,
        new_status: action === 'approve' ? 'approved' : 'rejected',
        trust_score: newTrustScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[review-instructor-verification] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
