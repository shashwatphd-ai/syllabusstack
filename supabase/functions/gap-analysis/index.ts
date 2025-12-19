import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MASTER_SYSTEM_PROMPT, GAP_ANALYSIS_PROMPT } from "../_shared/prompts.ts";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";
import { GAP_ANALYSIS_SCHEMA, createToolDefinition, createToolChoice } from "../_shared/schemas.ts";
import { analyzeRequirementCoverage, buildUserCapabilityKeywords } from "../_shared/similarity.ts";
import { generateKeywordVector, calculateSimilarity } from "../_shared/ai-orchestrator.ts";

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

    // --- PHASE 5: Pre-compute keyword-based similarity analysis ---
    const serviceClient = createServiceClient();
    
    // Build user's capability keywords
    const userKeywords = await buildUserCapabilityKeywords(supabase, user.id);
    console.log(`User has ${userKeywords.length} aggregated capability keywords`);

    // Analyze requirement coverage using similarity functions
    const coverageAnalysis = await analyzeRequirementCoverage(supabase, dreamJobId, user.id);
    console.log(`Keyword coverage: ${coverageAnalysis.coverage_percentage}% (${coverageAnalysis.covered_requirements.length} covered, ${coverageAnalysis.uncovered_requirements.length} uncovered)`);

    // Calculate keyword-based match score
    const jobKeywords = dreamJob.requirements_keywords || generateKeywordVector(
      `${dreamJob.title} ${dreamJob.description || ''} ${(requirements || []).map((r: any) => r.skill_name).join(' ')}`
    );
    const keywordMatchScore = calculateSimilarity(userKeywords, jobKeywords) * 100;
    console.log(`Keyword-based match score: ${Math.round(keywordMatchScore)}%`);

    // Build pre-analysis context from similarity matching
    const preAnalysisContext = {
      keywordMatchScore: Math.round(keywordMatchScore),
      coveragePercentage: coverageAnalysis.coverage_percentage,
      strongMatches: coverageAnalysis.covered_requirements
        .filter(r => r.coverage_score > 50)
        .map(r => ({
          requirement: r.skill_name,
          matchedCapabilities: r.matched_capabilities,
          score: Math.round(r.coverage_score)
        })),
      partialMatches: coverageAnalysis.covered_requirements
        .filter(r => r.coverage_score >= 20 && r.coverage_score <= 50)
        .map(r => ({
          requirement: r.skill_name,
          matchedCapabilities: r.matched_capabilities,
          score: Math.round(r.coverage_score)
        })),
      uncoveredCritical: coverageAnalysis.uncovered_requirements
        .filter(r => r.importance === 'critical')
        .map(r => r.skill_name),
      uncoveredImportant: coverageAnalysis.uncovered_requirements
        .filter(r => r.importance === 'important')
        .map(r => r.skill_name)
    };
    // --- END PHASE 5 PRE-ANALYSIS ---

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

    // Build pre-analysis summary for AI prompt
    const preAnalysisSummary = `
PRE-COMPUTED KEYWORD ANALYSIS (use as baseline, adjust based on deeper understanding):
- Keyword Match Score: ${preAnalysisContext.keywordMatchScore}%
- Requirement Coverage: ${preAnalysisContext.coveragePercentage}%
- Strong Matches (>50% similarity): ${preAnalysisContext.strongMatches.length > 0 
    ? preAnalysisContext.strongMatches.map(m => `${m.requirement} (matched by: ${m.matchedCapabilities.join(', ')})`).join('; ')
    : 'None'}
- Partial Matches (20-50% similarity): ${preAnalysisContext.partialMatches.length > 0
    ? preAnalysisContext.partialMatches.map(m => `${m.requirement} (partial match with: ${m.matchedCapabilities.join(', ')})`).join('; ')
    : 'None'}
- Critical Gaps (no keyword match): ${preAnalysisContext.uncoveredCritical.length > 0 
    ? preAnalysisContext.uncoveredCritical.join(', ')
    : 'None detected'}
- Important Gaps: ${preAnalysisContext.uncoveredImportant.length > 0 
    ? preAnalysisContext.uncoveredImportant.join(', ')
    : 'None detected'}

Note: This is keyword-based analysis. Use your judgment to refine - some capabilities may transfer even without exact keyword matches.`;

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

${preAnalysisSummary}

Provide an honest assessment. The keyword analysis gives you a starting point - refine it based on your understanding of:
1. Transferable skills that may not match keywords exactly
2. The actual depth of capability vs surface-level keyword matches
3. Whether partial matches truly demonstrate competence

Focus on:
1. What they CAN do that matches requirements (strong overlaps)
2. What they CANNOT yet do (critical gaps)
3. Where they have partial foundations to build on
4. A brutally honest overall assessment
5. Specific priority gaps to address first`
          }
        ],
        tools: [createToolDefinition(GAP_ANALYSIS_SCHEMA)],
        tool_choice: createToolChoice(GAP_ANALYSIS_SCHEMA)
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

    // Blend keyword-based score with AI analysis for final score
    // Weight: 30% keyword, 70% AI assessment
    const blendedMatchScore = Math.round(
      (preAnalysisContext.keywordMatchScore * 0.3) + (analysis.match_score * 0.7)
    );
    analysis.match_score = blendedMatchScore;
    console.log(`Final blended match score: ${blendedMatchScore}% (keyword: ${preAnalysisContext.keywordMatchScore}%, AI: ${analysis.match_score}%)`);

    // Update dream job with match score
    await supabase
      .from("dream_jobs")
      .update({ match_score: analysis.match_score })
      .eq("id", dreamJobId);

    // Persist gap analysis to database with keyword analysis metadata
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
        gap_analysis_id: gapAnalysisRecord?.id,
        keyword_analysis: preAnalysisContext // Include for transparency
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
