import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MASTER_SYSTEM_PROMPT, RECOMMENDATIONS_PROMPT, ANTI_RECOMMENDATIONS_PROMPT } from "../_shared/prompts.ts";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";
import { RECOMMENDATIONS_SCHEMA, createToolDefinition, createToolChoice } from "../_shared/schemas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dreamJobId, gaps, gapAnalysisId, userId: testUserId } = await req.json();
    
    if (!dreamJobId) {
      return new Response(
        JSON.stringify({ error: "Dream job ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    
    let supabase;
    let userId: string;
    
    if (authHeader) {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Failed to get user");
      }
      userId = user.id;
    } else if (testUserId) {
      console.log("Running in test mode with userId:", testUserId);
      supabase = createServiceClient();
      userId = testUserId;
    } else {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Get latest gap analysis if not provided
    let gapAnalysis = null;
    if (gapAnalysisId) {
      const { data } = await supabase
        .from("gap_analyses")
        .select("*")
        .eq("id", gapAnalysisId)
        .single();
      gapAnalysis = data;
    } else {
      const { data } = await supabase
        .from("gap_analyses")
        .select("*")
        .eq("dream_job_id", dreamJobId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      gapAnalysis = data;
    }

    console.log(`Generating recommendations for ${dreamJob.title}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Format gaps - prefer from gap analysis if available
    const gapsToUse = gapAnalysis?.priority_gaps || gaps || [];
    const gapsText = gapsToUse.map((g: any) => 
      `- ${g.gap || g.requirement} (Priority: ${g.priority || 'unknown'}, ${g.reason || g.time_to_close || ''})`
    ).join("\n") || "No specific gaps identified";

    const capabilitiesText = capabilities?.map((c: any) => 
      `- ${c.name} (${c.proficiency_level})`
    ).join("\n") || "No current capabilities";

    // Include critical gaps from analysis
    const criticalGapsText = gapAnalysis?.critical_gaps?.map((g: any) => 
      `- ${g.job_requirement}: ${g.student_status} → Impact: ${g.impact}`
    ).join("\n") || "";

    const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${RECOMMENDATIONS_PROMPT}

${ANTI_RECOMMENDATIONS_PROMPT}`;

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
            content: systemPrompt
          },
          {
            role: "user",
            content: `Generate SPECIFIC, ACTIONABLE recommendations for this student:

DREAM JOB: ${dreamJob.title}
${dreamJob.company_type ? `Company Type: ${dreamJob.company_type}` : ""}
${dreamJob.realistic_bar ? `Hiring Bar: ${dreamJob.realistic_bar}` : ""}

CURRENT CAPABILITIES:
${capabilitiesText}

PRIORITY GAPS TO ADDRESS (in order):
${gapsText}

${criticalGapsText ? `CRITICAL GAPS (deal-breakers):
${criticalGapsText}` : ""}

${gapAnalysis?.honest_assessment ? `OVERALL ASSESSMENT: ${gapAnalysis.honest_assessment}` : ""}

Generate 5-10 specific recommendations with:
1. Exact resource names (specific Coursera courses, not just "take a course")
2. Clear steps to complete
3. Estimated time and cost
4. What evidence they'll have to show employers
5. How to demonstrate this in interviews

PRIORITIZE:
- Critical gaps first
- Free or low-cost options
- Things that create demonstrable evidence
- Quick wins alongside longer-term investments`
          }
        ],
        tools: [createToolDefinition(RECOMMENDATIONS_SCHEMA)],
        tool_choice: createToolChoice(RECOMMENDATIONS_SCHEMA)
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
    const antiRecommendations = parsed.anti_recommendations || [];
    const learningPathSummary = parsed.learning_path_summary;

    // Delete existing recommendations for this dream job
    await supabase
      .from("recommendations")
      .delete()
      .eq("dream_job_id", dreamJobId);

    // Insert new recommendations with all fields
    const recsToInsert = recommendations.map((rec: any, index: number) => ({
      user_id: userId,
      dream_job_id: dreamJobId,
      gap_analysis_id: gapAnalysis?.id || null,
      title: rec.title,
      type: rec.type,
      description: rec.description,
      why_this_matters: rec.why_this_matters,
      steps: rec.steps || [],
      provider: rec.provider || null,
      url: rec.url || null,
      duration: rec.duration || null,
      effort_hours: rec.effort_hours || null,
      cost_usd: rec.cost || 0,
      priority: rec.priority,
      evidence_created: rec.evidence_created || null,
      how_to_demonstrate: rec.how_to_demonstrate || null,
      status: "pending"
    }));

    const { error: insertError } = await supabase
      .from("recommendations")
      .insert(recsToInsert);

    if (insertError) {
      console.error("Error inserting recommendations:", insertError);
      throw new Error("Failed to save recommendations");
    }

    // Save anti-recommendations
    if (antiRecommendations.length > 0) {
      // First delete existing
      await supabase
        .from("anti_recommendations")
        .delete()
        .eq("dream_job_id", dreamJobId);

      const antiRecsToInsert = antiRecommendations.map((ar: any) => ({
        user_id: userId,
        dream_job_id: dreamJobId,
        action: ar.action,
        reason: ar.reason
      }));

      await supabase
        .from("anti_recommendations")
        .insert(antiRecsToInsert);
    }

    // Track AI usage
    const serviceClient = createServiceClient();
    await trackAIUsage(
      serviceClient,
      userId,
      "generate-recommendations",
      "google/gemini-2.5-flash",
      data.usage?.prompt_tokens,
      data.usage?.completion_tokens
    );

    console.log(`Generated ${recommendations.length} recommendations`);

    return new Response(
      JSON.stringify({ 
        recommendations,
        anti_recommendations: antiRecommendations,
        learning_path_summary: learningPathSummary
      }),
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
