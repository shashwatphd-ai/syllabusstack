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

  // Authenticate user
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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Verify user is an instructor
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isInstructor = roles?.some((r: any) => r.role === "instructor" || r.role === "admin");
  if (!isInstructor) {
    return createErrorResponse("FORBIDDEN", corsHeaders, "Instructor access required");
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return createErrorResponse("VALIDATION_ERROR", corsHeaders, "Valid email is required");
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check quota
  const { data: quota, error: quotaError } = await supabaseAdmin.rpc("get_invite_quota", {
    p_user_id: user.id,
  });

  if (quotaError || !quota || quota.length === 0) {
    logError("send-instructor-invite", quotaError || new Error("No quota data"));
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, "Failed to check invite quota");
  }

  const quotaRow = quota[0];
  if (quotaRow.remaining <= 0) {
    return createErrorResponse("FORBIDDEN", corsHeaders, "You have used all your invitations");
  }

  // Check for existing pending invitation to this email
  const { data: existing } = await supabaseAdmin
    .from("instructor_invitations")
    .select("id, status")
    .eq("inviter_id", user.id)
    .eq("invitee_email", normalizedEmail)
    .eq("status", "pending");

  if (existing && existing.length > 0) {
    return createErrorResponse("BAD_REQUEST", corsHeaders, "An invitation is already pending for this email");
  }

  // Get inviter's depth level
  const { data: inviterInvitation } = await supabaseAdmin
    .from("instructor_invitations")
    .select("depth_level")
    .eq("accepted_by", user.id)
    .eq("status", "accepted")
    .limit(1);

  const inviterDepth = inviterInvitation?.[0]?.depth_level ?? 0;

  // Generate secure token
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  // Insert invitation
  const { data: invitation, error: insertError } = await supabaseAdmin
    .from("instructor_invitations")
    .insert({
      inviter_id: user.id,
      invitee_email: normalizedEmail,
      token,
      status: "pending",
      depth_level: inviterDepth + 1,
      max_invites_granted: 1000,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
    .select()
    .single();

  if (insertError) {
    logError("send-instructor-invite", insertError);
    return createErrorResponse("DATABASE_ERROR", corsHeaders, "Failed to create invitation");
  }

  // Send email via Resend
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const appUrl = Deno.env.get("APP_URL") || "https://syllabusstack.lovable.app";

  if (resendApiKey) {
    try {
      const inviteUrl = `${appUrl}/auth?invite=${token}`;

      // Get inviter's name
      const { data: inviterProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const inviterName = inviterProfile?.full_name || user.email;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "SyllabusStack <noreply@syllabusstack.com>",
          to: [normalizedEmail],
          subject: `${inviterName} invited you to teach on SyllabusStack`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1a1a2e; font-size: 24px;">You're Invited to SyllabusStack</h1>
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to join SyllabusStack as an instructor.
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                SyllabusStack helps instructors transform syllabi into video courses with automated content matching and student assessments.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${inviteUrl}" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #999; font-size: 14px;">
                This invitation expires in 30 days. If you didn't expect this, you can safely ignore it.
              </p>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        logError("send-instructor-invite", new Error(`Resend error: ${emailResponse.status}`));
      }
    } catch (emailErr) {
      logError("send-instructor-invite", emailErr instanceof Error ? emailErr : new Error(String(emailErr)));
      // Don't fail the invitation if email fails — the link still works
    }
  }

  logInfo("send-instructor-invite", "invitation_sent", {
    inviterId: user.id,
    inviteeEmail: normalizedEmail,
    depth: inviterDepth + 1,
  });

  return createSuccessResponse(
    {
      success: true,
      invitation_id: invitation.id,
      invite_url: `${appUrl}/auth?invite=${token}`,
      remaining_invites: quotaRow.remaining - 1,
    },
    corsHeaders
  );
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
