import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { validateRequest, recordProctorEventSchema } from "../_shared/validators/index.ts";

/**
 * Record Proctor Event
 * 
 * Records proctoring violations during assessed certificate assessments.
 * Updates the proctored_sessions table with violation counts.
 */
Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

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
    const validation = validateRequest(recordProctorEventSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }
    const { assessment_session_id, event_type, details } = validation.data;

    // Get or create proctored session record
    let { data: proctoredSession, error: fetchError } = await supabaseAdmin
      .from("proctored_sessions")
      .select("*")
      .eq("assessment_session_id", assessment_session_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") { // PGRST116 = no rows
      throw fetchError;
    }

    // If no session exists, create one
    if (!proctoredSession) {
      const { data: newSession, error: createError } = await supabaseAdmin
        .from("proctored_sessions")
        .insert({
          assessment_session_id,
          user_id: user.id,
          fullscreen_exits: 0,
          tab_switches: 0,
          copy_paste_attempts: 0,
          browser_focus_losses: 0,
          violation_threshold: 3,
        })
        .select()
        .single();

      if (createError) throw createError;
      proctoredSession = newSession;
    }

    // Determine which column to increment
    const updateData: Record<string, number> = {};
    switch (event_type) {
      case "fullscreen_exit":
        updateData.fullscreen_exits = (proctoredSession.fullscreen_exits || 0) + 1;
        break;
      case "tab_switch":
        updateData.tab_switches = (proctoredSession.tab_switches || 0) + 1;
        break;
      case "copy_paste":
      case "keyboard_shortcut":
        updateData.copy_paste_attempts = (proctoredSession.copy_paste_attempts || 0) + 1;
        break;
      case "focus_loss":
        updateData.browser_focus_losses = (proctoredSession.browser_focus_losses || 0) + 1;
        break;
    }

    // Update the session
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("proctored_sessions")
      .update(updateData)
      .eq("id", proctoredSession.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Calculate total violations
    const totalViolations = 
      (updated.fullscreen_exits || 0) +
      (updated.tab_switches || 0) +
      (updated.copy_paste_attempts || 0) +
      (updated.browser_focus_losses || 0);

    // Check if exceeded threshold
    const exceeded = totalViolations >= (updated.violation_threshold || 3);

    console.log(`[proctor-event] User ${user.id} - ${event_type} - Total: ${totalViolations}/${updated.violation_threshold}`);

    return new Response(
      JSON.stringify({
        success: true,
        event_type,
        total_violations: totalViolations,
        threshold: updated.violation_threshold,
        threshold_exceeded: exceeded,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[proctor-event] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
