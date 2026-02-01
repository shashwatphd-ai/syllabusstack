import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { MASTER_SYSTEM_PROMPT, RECOMMENDATIONS_PROMPT, ANTI_RECOMMENDATIONS_PROMPT } from "../_shared/prompts.ts";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";
import { RECOMMENDATIONS_SCHEMA } from "../_shared/schemas.ts";
import { generateStructured, MODELS } from "../_shared/unified-ai-client.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { 
  createErrorResponse, 
  createSuccessResponse, 
  withErrorHandling, 
  logInfo 
} from "../_shared/error-handler.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dreamJobId, gaps, gapAnalysisId } = await req.json();
    
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
    
    // Authenticated flow - always require valid auth header
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = user.id;

    // Check rate limits (Task 2.1.3 from MASTER_IMPLEMENTATION_PLAN_V2.md)
    const serviceClient = createServiceClient();
    const userLimits = await getUserLimits(serviceClient, userId);
    const rateLimitResult = await checkRateLimit(serviceClient, userId, 'generate-recommendations', userLimits);

    if (!rateLimitResult.allowed) {
      logInfo('generate-recommendations', 'rate_limit_exceeded', {
        userId,
        remaining: rateLimitResult.remaining,
      });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    logInfo('generate-recommendations', 'rate_limit_passed', { userId });

    // Get dream job details
    const { data: dreamJob, error: jobError } = await supabase
      .from("dream_jobs")
      .select("*")
      .eq("id", dreamJobId)
      .single();

    if (jobError) {
      throw new Error(`Failed to fetch dream job: ${jobError.message}`);
    }

    // Get existing capabilities for THIS USER (security + performance fix)
    const { data: capabilities } = await supabase
      .from("capabilities")
      .select("name, category, proficiency_level")
      .eq("user_id", userId);

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

    const userContent = `Generate SPECIFIC, ACTIONABLE recommendations for this student:

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

Generate 7-10 DIVERSE recommendations using a MIX of types:
- 2-3 PROJECTS (build demonstrable work)
- 1-2 COURSES (specific learning tracks - suggest providers but NO URLs)
- 1-2 SKILLS (deliberate practice)
- 1-2 ACTIONS (quick wins, networking)
- 1 EXPERIENCE (real-world application)

For each recommendation provide:
1. Clear title and specific type
2. 3-5 concrete steps with time estimates
3. Which gap it addresses (reference the gaps above)
4. What tangible evidence they'll create
5. How to demonstrate this to employers

IMPORTANT:
- DO NOT include URLs - real course URLs will be discovered via Firecrawl search
- Suggest specific course/book names but not links
- Include at least 1 quick win (completable in <1 week)
- Include 3-5 anti-recommendations (what NOT to do)

PRIORITIZE:
- Critical gaps first
- Free or low-cost options
- Evidence-creating activities
- Quick wins alongside longer investments

Return your response using the generate_recommendations function.`;

    // Use unified AI client for structured extraction
    const result = await generateStructured<{
      recommendations: any[];
      anti_recommendations: any[];
      learning_path_summary: string;
    }>({
      prompt: userContent,
      systemPrompt: systemPrompt,
      schema: RECOMMENDATIONS_SCHEMA,
      model: MODELS.FAST,
      fallbacks: [MODELS.GEMINI_FLASH],
      logPrefix: '[generate-recommendations]'
    });
    const parsed = result.data;

    const recommendations = parsed.recommendations || [];
    const antiRecommendations = parsed.anti_recommendations || [];
    const learningPathSummary = parsed.learning_path_summary;

    // Soft delete existing AI-generated recommendations for this dream job
    // (Keep Firecrawl-discovered courses by checking if url contains coursera/udemy/edx)
    await supabase
      .from("recommendations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("dream_job_id", dreamJobId)
      .is("deleted_at", null)
      .or("url.is.null,url.not.ilike.%coursera.org%,url.not.ilike.%udemy.com%,url.not.ilike.%edx.org%");

    // Insert new recommendations with all fields
    const recsToInsert = recommendations.map((rec: any, index: number) => ({
      user_id: userId,
      dream_job_id: dreamJobId,
      gap_analysis_id: gapAnalysis?.id || null,
      title: rec.title,
      type: rec.type || "action",
      description: rec.description,
      why_this_matters: rec.why_this_matters,
      gap_addressed: rec.gap_addressed || null,
      steps: rec.steps || [],
      provider: rec.provider || null,
      url: null, // Don't use AI-generated URLs - Firecrawl provides real ones
      duration: rec.duration || null,
      effort_hours: rec.effort_hours || null,
      cost_usd: rec.cost || 0,
      priority: rec.priority || "medium",
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
    const usageClient = createServiceClient();
    await trackAIUsage(
      usageClient,
      userId,
      "generate-recommendations",
      "openrouter/gpt-4o-mini"
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
