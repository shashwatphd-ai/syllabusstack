import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get request body
    const { emails } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "Emails array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log(`Admin ${user.id} invited users:`, results);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error inviting users:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
