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
    const { dreamJobId } = await req.json();
    
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

    // Get user's capabilities
    const { data: capabilities, error: capError } = await supabase
      .from("capabilities")
      .select("*");

    if (capError) {
      throw new Error(`Failed to fetch capabilities: ${capError.message}`);
    }

    // Get job requirements
    const { data: requirements, error: reqError } = await supabase
      .from("job_requirements")
      .select("*")
      .eq("dream_job_id", dreamJobId);

    if (reqError) {
      throw new Error(`Failed to fetch requirements: ${reqError.message}`);
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

    console.log(`Gap analysis: ${capabilities?.length || 0} capabilities vs ${requirements?.length || 0} requirements`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const capabilitiesList = (capabilities || []).map(c => `- ${c.name} (${c.proficiency_level}, ${c.category})`).join("\n");
    const requirementsList = (requirements || []).map(r => `- ${r.skill_name} (${r.importance}, ${r.category})`).join("\n");

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
            content: `You are an expert career advisor performing a gap analysis between a student's capabilities and job requirements.

Your job is to:
1. Identify overlaps where the student's skills match job requirements
2. Identify gaps where the student lacks required skills
3. Calculate a match score (0-100)
4. Provide an honest, constructive assessment
5. Highlight anti-recommendations (things the student should NOT do)

Be honest but encouraging. Focus on actionable insights.`
          },
          {
            role: "user",
            content: `Perform a gap analysis for this dream job:

DREAM JOB: ${dreamJob.title}
${dreamJob.description ? `Description: ${dreamJob.description}` : ""}

STUDENT'S CURRENT CAPABILITIES:
${capabilitiesList || "No capabilities recorded yet"}

JOB REQUIREMENTS:
${requirementsList || "No requirements analyzed yet"}

Analyze the match and provide detailed feedback.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "gap_analysis_result",
              description: "Return the gap analysis results",
              parameters: {
                type: "object",
                properties: {
                  match_score: { type: "number", description: "Overall match percentage 0-100" },
                  overlaps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        capability: { type: "string" },
                        requirement: { type: "string" },
                        strength: { type: "string", enum: ["strong", "moderate", "partial"] },
                        notes: { type: "string" }
                      },
                      required: ["capability", "requirement", "strength"]
                    }
                  },
                  gaps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        requirement: { type: "string" },
                        importance: { type: "string", enum: ["critical", "important", "nice_to_have"] },
                        difficulty: { type: "string", enum: ["easy", "moderate", "challenging"] },
                        time_to_close: { type: "string" },
                        suggested_action: { type: "string" }
                      },
                      required: ["requirement", "importance", "difficulty", "time_to_close"]
                    }
                  },
                  honest_assessment: { type: "string", description: "Candid feedback on readiness" },
                  top_strengths: { type: "array", items: { type: "string" } },
                  critical_gaps: { type: "array", items: { type: "string" } },
                  anti_recommendations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Things the student should NOT pursue or avoid" 
                  }
                },
                required: ["match_score", "overlaps", "gaps", "honest_assessment"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "gap_analysis_result" } }
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

    const analysis = JSON.parse(toolCall.function.arguments);

    // Update dream job with match score
    await supabase
      .from("dream_jobs")
      .update({ match_score: analysis.match_score })
      .eq("id", dreamJobId);

    console.log(`Gap analysis complete. Match score: ${analysis.match_score}%`);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in gap-analysis:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
