import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";
import { validateRequest, useInviteCodeSchema } from "../_shared/validators/index.ts";

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

    const body = await req.json();
    const validation = validateRequest(useInviteCodeSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }
    const { code } = validation.data;

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
    logError("use-invite-code", error instanceof Error ? error : new Error(String(error)), { action: "using_code" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, error instanceof Error ? error.message : "Unknown error");
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
