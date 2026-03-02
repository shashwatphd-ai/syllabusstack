import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return createErrorResponse("VALIDATION_ERROR", corsHeaders, "Invite token is required");
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Validate token
  const { data: invitation, error: lookupError } = await supabaseAdmin
    .from("instructor_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (lookupError || !invitation) {
    return createErrorResponse("NOT_FOUND", corsHeaders, "Invalid invitation token");
  }

  if (invitation.status !== "pending") {
    return createErrorResponse("BAD_REQUEST", corsHeaders, "This invitation has already been used");
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    // Mark as expired
    await supabaseAdmin
      .from("instructor_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);
    return createErrorResponse("BAD_REQUEST", corsHeaders, "This invitation has expired");
  }

  // Return invitation details for the auth page to use
  return createSuccessResponse(
    {
      valid: true,
      email: invitation.invitee_email,
      inviter_id: invitation.inviter_id,
      token: invitation.token,
    },
    corsHeaders
  );
};

// Second endpoint: mark invitation as accepted after signup
const mainHandler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "validate") {
    return handler(req);
  }

  // Accept flow: requires authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return createErrorResponse("UNAUTHORIZED", corsHeaders, "No authorization header");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return createErrorResponse("UNAUTHORIZED", corsHeaders, "Invalid authentication");
  }

  const { token } = await req.json();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Get invitation
  const { data: invitation, error: lookupError } = await supabaseAdmin
    .from("instructor_invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (lookupError || !invitation) {
    return createErrorResponse("NOT_FOUND", corsHeaders, "Invalid or expired invitation");
  }

  // Mark invitation as accepted
  const { error: updateError } = await supabaseAdmin
    .from("instructor_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq("id", invitation.id);

  if (updateError) {
    logError("accept-instructor-invite", updateError);
    return createErrorResponse("DATABASE_ERROR", corsHeaders, "Failed to accept invitation");
  }

  // Add instructor role
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert(
      { user_id: user.id, role: "instructor" },
      { onConflict: "user_id,role" }
    );

  if (roleError) {
    logError("accept-instructor-invite", roleError);
  }

  // Update profile with invited_by
  await supabaseAdmin
    .from("profiles")
    .update({ invited_by: invitation.inviter_id })
    .eq("user_id", user.id);

  logInfo("accept-instructor-invite", "invitation_accepted", {
    userId: user.id,
    inviterId: invitation.inviter_id,
    depth: invitation.depth_level,
  });

  return createSuccessResponse(
    {
      success: true,
      role: "instructor",
    },
    corsHeaders
  );
};

Deno.serve(withErrorHandling(mainHandler, getCorsHeaders));
