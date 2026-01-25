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

    // Check for existing verified IDV
    const { data: existingVerification } = await supabaseAdmin
      .from("identity_verifications")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "verified")
      .single();

    if (existingVerification) {
      return new Response(
        JSON.stringify({ 
          error: "You are already identity verified",
          verification_id: existingVerification.id
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for pending verification
    const { data: pendingVerification } = await supabaseAdmin
      .from("identity_verifications")
      .select("id, status, provider_session_token")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .single();

    if (pendingVerification?.provider_session_token) {
      // Return existing session
      return new Response(
        JSON.stringify({
          verification_id: pendingVerification.id,
          session_token: pendingVerification.provider_session_token,
          status: pendingVerification.status,
          message: "Continuing existing verification session",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // In production, call Persona API to create inquiry
    // For now, create a mock session
    const personaApiKey = Deno.env.get("PERSONA_API_KEY");
    
    let sessionToken: string;
    let inquiryId: string;

    if (personaApiKey) {
      // Real Persona integration
      const personaResponse = await fetch("https://withpersona.com/api/v1/inquiries", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${personaApiKey}`,
          "Content-Type": "application/json",
          "Persona-Version": "2023-01-05",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              "inquiry-template-id": Deno.env.get("PERSONA_TEMPLATE_ID") || "itmpl_default",
              "reference-id": user.id,
              "fields": {
                "email-address": user.email,
              }
            }
          }
        }),
      });

      if (!personaResponse.ok) {
        const errorText = await personaResponse.text();
        console.error("Persona API error:", errorText);
        throw new Error("Failed to create identity verification session");
      }

      const personaData = await personaResponse.json();
      sessionToken = personaData.data.attributes["session-token"];
      inquiryId = personaData.data.id;
    } else {
      // Mock for development - generate demo tokens
      console.log("[initiate-identity-verification] Running in demo mode without Persona API key");
      sessionToken = `demo_session_${crypto.randomUUID()}`;
      inquiryId = `inq_demo_${Date.now()}`;
    }

    // Create verification record
    const { data: verification, error: insertError } = await supabaseAdmin
      .from("identity_verifications")
      .insert({
        user_id: user.id,
        provider: "persona",
        provider_inquiry_id: inquiryId,
        provider_session_token: sessionToken,
        status: "pending",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating verification:", insertError);
      throw new Error("Failed to create verification record");
    }

    console.log(`[initiate-identity-verification] Created IDV session ${verification.id} for user ${user.id}`);

    return new Response(
      JSON.stringify({
        verification_id: verification.id,
        session_token: sessionToken,
        inquiry_id: inquiryId,
        status: "pending",
        expires_at: verification.expires_at,
        message: personaApiKey 
          ? "Identity verification session created"
          : "Demo mode: IDV session created (no Persona API key configured)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[initiate-identity-verification] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
