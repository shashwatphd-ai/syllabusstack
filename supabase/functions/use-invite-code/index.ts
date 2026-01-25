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

    const { code } = await req.json();
    if (!code) {
      throw new Error("Invite code is required");
    }

    // Use the database function to process the invite code
    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('use_invite_code', {
        p_code: code.toUpperCase().trim(),
        p_user_id: user.id,
      });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      throw new Error("Failed to process invite code");
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure user has instructor role if approved
    if (result.status === 'approved') {
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

    console.log(`[use-invite-code] User ${user.id} used invite code. Status: ${result.status}`);

    return new Response(
      JSON.stringify({
        verification_id: result.verification_id,
        status: result.status,
        trust_score: result.trust_score,
        message: result.status === 'approved' 
          ? "Congratulations! Your instructor account has been verified."
          : "Your invite code has been accepted and your verification is pending review.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[use-invite-code] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
