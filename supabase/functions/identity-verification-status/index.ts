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

    // Get the most recent verification for this user
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from("identity_verifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching verification:", fetchError);
      throw new Error("Failed to fetch verification status");
    }

    if (!verification) {
      return new Response(
        JSON.stringify({
          status: "none",
          message: "No identity verification found",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[identity-verification-status] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
