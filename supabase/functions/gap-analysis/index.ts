import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MASTER_SYSTEM_PROMPT, GAP_ANALYSIS_PROMPT } from "../_shared/prompts.ts";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";

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

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Failed to get user");
    }

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

    // Format capabilities with proficiency info
    const capabilitiesList = (capabilities || []).map(c => 
      `- ${c.name} (${c.proficiency_level || 'unknown'} level, category: ${c.category || 'general'})`
    ).join("\n");

    // Format requirements with importance
    const requirementsList = (requirements || []).map(r => 
      `- ${r.skill_name} [${r.importance?.toUpperCase() || 'UNKNOWN'}] (${r.category || 'general'})`
    ).join("\n");

    // Include day-one capabilities if available
    const dayOneList = (dreamJob.day_one_capabilities || []).map((d: any) => 
      `- ${d.requirement} [${d.importance?.toUpperCase()}]`
    ).join("\n");

    const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${GAP_ANALYSIS_PROMPT}`;

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
            content: `Perform a BRUTALLY HONEST gap analysis for this student:

DREAM JOB: ${dreamJob.title}
${dreamJob.company_type ? `Company Type: ${dreamJob.company_type}` : ""}
${dreamJob.description ? `Role Description: ${dreamJob.description}` : ""}

STUDENT'S CURRENT CAPABILITIES:
${capabilitiesList || "No capabilities recorded yet - student has NOT demonstrated any relevant skills"}

JOB REQUIREMENTS:
${requirementsList || "No requirements analyzed yet"}

${dayOneList ? `DAY-ONE REQUIREMENTS (must have on first day):
${dayOneList}` : ""}

${dreamJob.realistic_bar ? `REALISTIC HIRING BAR: ${dreamJob.realistic_bar}` : ""}

Provide an honest assessment. If the student is far from ready, say so clearly. False hope is cruel.
Focus on:
1. What they CAN do that matches requirements (strong overlaps)
2. What they CANNOT yet do (critical gaps)
3. Where they have partial foundations to build on
4. A brutally honest overall assessment
5. Specific priority gaps to address first`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "gap_analysis_result",
              description: "Return the comprehensive gap analysis results",
              parameters: {
                type: "object",
                properties: {
                  match_score: { 
                    type: "number", 
                    description: "Overall match percentage 0-100. Be realistic - most students are 30-60%" 
                  },
                  strong_overlaps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        student_capability: { type: "string", description: "What the student can do" },
                        job_requirement: { type: "string", description: "The requirement it matches" },
                        assessment: { type: "string", description: "How well it matches" }
                      },
                      required: ["student_capability", "job_requirement", "assessment"]
                    },
                    description: "Clear matches between capabilities and requirements"
                  },
                  critical_gaps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        job_requirement: { type: "string", description: "The missing requirement" },
                        student_status: { type: "string", description: "What the student currently has (or lacks)" },
                        impact: { type: "string", description: "Why this gap matters" }
                      },
                      required: ["job_requirement", "student_status", "impact"]
                    },
                    description: "Requirements the student is missing - especially CRITICAL ones"
                  },
                  partial_overlaps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        area: { type: "string", description: "The skill area" },
                        foundation: { type: "string", description: "What foundation the student has" },
                        missing: { type: "string", description: "What's still needed" }
                      },
                      required: ["area", "foundation", "missing"]
                    },
                    description: "Areas where student has related but incomplete experience"
                  },
                  honest_assessment: { 
                    type: "string", 
                    description: "Candid, direct feedback on their readiness. Be honest but constructive." 
                  },
                  readiness_level: {
                    type: "string",
                    enum: ["ready_to_apply", "3_months_away", "6_months_away", "1_year_away", "needs_significant_development"],
                    description: "How ready are they to apply for this role?"
                  },
                  interview_readiness: {
                    type: "string",
                    description: "Would they pass a typical interview loop? What would trip them up?"
                  },
                  job_success_prediction: {
                    type: "string",
                    description: "If hired today, would they succeed? What would be hardest?"
                  },
                  priority_gaps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        gap: { type: "string" },
                        priority: { type: "number", description: "1 = highest priority" },
                        reason: { type: "string", description: "Why this should be addressed first" }
                      },
                      required: ["gap", "priority", "reason"]
                    },
                    description: "Top 3-5 gaps ranked by impact if closed"
                  },
                  anti_recommendations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Things the student should NOT pursue or avoid" 
                  }
                },
                required: ["match_score", "strong_overlaps", "critical_gaps", "honest_assessment", "readiness_level", "priority_gaps"]
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

    // Persist gap analysis to database
    const { data: gapAnalysisRecord, error: insertError } = await supabase
      .from("gap_analyses")
      .insert({
        user_id: user.id,
        dream_job_id: dreamJobId,
        analysis_text: analysis.honest_assessment,
        strong_overlaps: analysis.strong_overlaps,
        critical_gaps: analysis.critical_gaps,
        partial_overlaps: analysis.partial_overlaps || [],
        honest_assessment: analysis.honest_assessment,
        readiness_level: analysis.readiness_level,
        interview_readiness: analysis.interview_readiness,
        job_success_prediction: analysis.job_success_prediction,
        priority_gaps: analysis.priority_gaps,
        match_score: analysis.match_score,
        ai_model_used: "google/gemini-2.5-flash"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving gap analysis:", insertError);
    } else {
      console.log("Saved gap analysis with ID:", gapAnalysisRecord?.id);
    }

    // Save anti-recommendations if any
    if (analysis.anti_recommendations?.length > 0) {
      const antiRecsToInsert = analysis.anti_recommendations.map((ar: string) => ({
        user_id: user.id,
        dream_job_id: dreamJobId,
        action: ar,
        reason: "Identified during gap analysis"
      }));

      await supabase
        .from("anti_recommendations")
        .delete()
        .eq("dream_job_id", dreamJobId);

      await supabase
        .from("anti_recommendations")
        .insert(antiRecsToInsert);
    }

    // Track AI usage
    const serviceClient = createServiceClient();
    await trackAIUsage(
      serviceClient,
      user.id,
      "gap-analysis",
      "google/gemini-2.5-flash",
      data.usage?.prompt_tokens,
      data.usage?.completion_tokens
    );

    console.log(`Gap analysis complete. Match score: ${analysis.match_score}%`);

    return new Response(
      JSON.stringify({
        ...analysis,
        gap_analysis_id: gapAnalysisRecord?.id
      }),
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
