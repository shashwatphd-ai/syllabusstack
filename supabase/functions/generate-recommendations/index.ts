import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dreamJobId, gaps } = await req.json();
    
    if (!dreamJobId) {
      return new Response(
        JSON.stringify({ error: "Dream job ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Failed to get user");
    }

    // Get dream job details
    const { data: dreamJob, error: jobError } = await supabase
      .from("dream_jobs")
      .select("*")
      .eq("id", dreamJobId)
      .single();

    if (jobError) {
      throw new Error(`Failed to fetch dream job: ${jobError.message}`);
    }

    // Get existing capabilities
    const { data: capabilities } = await supabase
      .from("capabilities")
      .select("name, category, proficiency_level");

    console.log(`Generating recommendations for ${dreamJob.title}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const gapsText = gaps?.map((g: any) => `- ${g.requirement} (${g.importance}, estimated ${g.time_to_close})`).join("\n") || "No gaps provided";
    const capabilitiesText = capabilities?.map((c: any) => `- ${c.name}`).join("\n") || "No current capabilities";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert career advisor generating personalized learning recommendations.

Generate specific, actionable recommendations to help a student close their skill gaps and prepare for their dream job.

For each recommendation, provide:
1. A clear title
2. Type (course, certification, project, experience, skill)
3. Description of what they'll learn
4. Provider/platform (Coursera, edX, LinkedIn Learning, etc.)
5. Estimated duration
6. Priority (high, medium, low)
7. Direct URL if possible

Focus on high-quality, reputable resources. Prioritize free or affordable options when possible.`
          },
          {
            role: "user",
            content: `Generate learning recommendations for this student:

DREAM JOB: ${dreamJob.title}
${dreamJob.company_type ? `Company Type: ${dreamJob.company_type}` : ""}

CURRENT CAPABILITIES:
${capabilitiesText}

SKILL GAPS TO ADDRESS:
${gapsText}

Generate 5-10 specific, actionable recommendations to help close these gaps. Prioritize the most critical gaps first.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_recommendations",
              description: "Generate learning recommendations",
              parameters: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        type: { 
                          type: "string", 
                          enum: ["course", "certification", "project", "experience", "skill"]
                        },
                        description: { type: "string" },
                        provider: { type: "string" },
                        url: { type: "string" },
                        duration: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] }
                      },
                      required: ["title", "type", "description", "priority"]
                    }
                  }
                },
                required: ["recommendations"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_recommendations" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const recommendations = parsed.recommendations || [];

    // Delete existing recommendations for this dream job
    await supabase
      .from("recommendations")
      .delete()
      .eq("dream_job_id", dreamJobId);

    // Insert new recommendations
    const recsToInsert = recommendations.map((rec: any) => ({
      user_id: user.id,
      dream_job_id: dreamJobId,
      title: rec.title,
      type: rec.type,
      description: rec.description,
      provider: rec.provider || null,
      url: rec.url || null,
      duration: rec.duration || null,
      priority: rec.priority,
      status: "pending"
    }));

    const { error: insertError } = await supabase
      .from("recommendations")
      .insert(recsToInsert);

    if (insertError) {
      console.error("Error inserting recommendations:", insertError);
      throw new Error("Failed to save recommendations");
    }

    console.log(`Generated ${recommendations.length} recommendations`);

    return new Response(
      JSON.stringify({ recommendations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-recommendations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
