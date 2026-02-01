import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
    }

    logInfo('invite-users', 'starting', { userId: user.id });

    // Check if user is admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return createErrorResponse('FORBIDDEN', corsHeaders, 'Admin access required');
    }

    // Get request body
    const { emails } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Emails array is required');
    }

    logInfo('invite-users', 'processing', { emailCount: emails.length });

    // Get admin's organization
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    const organizationId = adminProfile?.organization_id;

    // Send invites
    const results = {
      invited: [] as string[],
      failed: [] as { email: string; reason: string }[],
    };

    for (const email of emails) {
      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("email", email)
          .limit(1);

        if (existingUsers && existingUsers.length > 0) {
          // User exists, just add to organization
          if (organizationId) {
            await supabaseAdmin
              .from("profiles")
              .update({ organization_id: organizationId })
              .eq("email", email);
          }
          results.invited.push(email);
        } else {
          // Create invite using Supabase Auth
          const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
              invited_by: user.id,
              organization_id: organizationId,
            },
          });

          if (inviteError) {
            results.failed.push({ email, reason: inviteError.message });
          } else {
            results.invited.push(email);
          }
        }
      } catch (err: any) {
        results.failed.push({ email, reason: err.message || "Unknown error" });
      }
    }

    logInfo('invite-users', 'complete', { invited: results.invited.length, failed: results.failed.length });

    return createSuccessResponse(results, corsHeaders);
  } catch (error: unknown) {
    logError('invite-users', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
