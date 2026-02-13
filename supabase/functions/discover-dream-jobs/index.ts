import { createClient } from "@supabase/supabase-js";
import { generateText, MODELS, parseJsonResponse } from "../_shared/unified-ai-client.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";
import { createServiceClient } from "../_shared/ai-cache.ts";
import { validateRequest, discoverDreamJobsSchema } from "../_shared/validators/index.ts";

interface DiscoveredJob {
  title: string;
  description: string;
  whyItFits: string;
  salaryRange: string;
  growthOutlook: string;
  keySkills: string[];
  dayInLife: string;
  companyTypes: string[];
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Parse and validate request body with Zod
    const body = await req.json();
    const validation = validateRequest(discoverDreamJobsSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }
    const { interests, skills, major, careerGoals, workStyle } = validation.data;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Authorization required');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Failed to authenticate user');
    }

    // Check rate limits (Task 2.1.3 from MASTER_IMPLEMENTATION_PLAN_V2.md)
    const serviceClient = createServiceClient();
    const userLimits = await getUserLimits(serviceClient, user.id);
    const rateLimitResult = await checkRateLimit(serviceClient, user.id, 'discover-dream-jobs', userLimits);

    if (!rateLimitResult.allowed) {
      logInfo('discover-dream-jobs', 'rate_limit_exceeded', {
        userId: user.id,
        remaining: rateLimitResult.remaining,
      });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    logInfo('discover-dream-jobs', 'rate_limit_passed', { userId: user.id });

    // Get user's existing capabilities
    const { data: capabilities } = await supabase
      .from("capabilities")
      .select("name, category, proficiency_level")
      .eq("user_id", user.id);

    // Get user's courses for context
    const { data: courses } = await supabase
      .from("courses")
      .select("title")
      .eq("user_id", user.id)
      .limit(10);

    console.log("Discovering dream jobs for user with context:", {
      interests,
      skills,
      major,
      capabilitiesCount: capabilities?.length || 0,
      coursesCount: courses?.length || 0,
    });

    const capabilitiesText = capabilities?.map(c => 
      `- ${c.name} (${c.proficiency_level || 'developing'})`
    ).join("\n") || "No capabilities recorded yet";

    const coursesText = courses?.map(c => `- ${c.title}`).join("\n") || "No courses added yet";

    const systemPrompt = `You are a career discovery AI helping students find careers they might not know exist.

Your job is to suggest 5-8 DIVERSE career paths that match the student's profile. Include:
1. Some obvious matches they might already know
2. Some emerging roles they probably haven't heard of
3. Some interdisciplinary roles that combine their interests

Be SPECIFIC with job titles (not just "engineer" but "Machine Learning Engineer at a Health Tech Startup").
Be HONEST about salary ranges and growth outlook.
Focus on roles that are actually HIRING and have good prospects.

Return JSON in this exact format:
{
  "discoveredJobs": [
    {
      "title": "Specific Job Title",
      "description": "2-3 sentence description of what this role does",
      "whyItFits": "Why this matches the student's profile",
      "salaryRange": "$X - $Y (entry level to senior)",
      "growthOutlook": "High/Medium/Low with brief explanation",
      "keySkills": ["skill1", "skill2", "skill3"],
      "dayInLife": "Brief description of typical day",
      "companyTypes": ["startup", "tech", "consulting"]
    }
  ],
  "careerInsights": "Overall insights about the student's career potential and recommendations"
}`;

    const userContent = `Help this student discover career paths they might not know about:

STUDENT INTERESTS: ${interests || "Not specified"}
SKILLS/STRENGTHS: ${skills || "Not specified"}
MAJOR/FIELD: ${major || "Not specified"}
CAREER GOALS: ${careerGoals || "Open to discovering options"}
WORK STYLE PREFERENCE: ${workStyle || "Not specified"}

CURRENT CAPABILITIES:
${capabilitiesText}

COURSES TAKEN:
${coursesText}

Based on this profile, suggest 5-8 diverse career paths including:
- Roles they might already know
- Emerging roles they probably haven't heard of
- Interdisciplinary roles combining their interests
- Both traditional and non-traditional paths`;

    // Use unified AI client for text generation
    const result = await generateText({
      prompt: userContent,
      systemPrompt: systemPrompt,
      model: MODELS.FAST,
      temperature: 0.7,
      fallbacks: [MODELS.GEMINI_FLASH],
      logPrefix: '[discover-dream-jobs]'
    });
    const content = result.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON from response
    let parsed;
    try {
      parsed = parseJsonResponse<{ discoveredJobs: DiscoveredJob[]; careerInsights: string }>(content);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse career suggestions");
    }

    console.log(`Discovered ${parsed.discoveredJobs?.length || 0} career paths`);

    const discoveredJobs = parsed.discoveredJobs || [];

    // Save discovered careers to database for later review
    if (discoveredJobs.length > 0) {
      const discoveryInput = {
        interests,
        skills,
        major,
        careerGoals,
        workStyle,
        timestamp: new Date().toISOString()
      };

      const careersToInsert = discoveredJobs.map((job: DiscoveredJob) => ({
        user_id: user.id,
        title: job.title,
        description: job.description,
        why_it_fits: job.whyItFits,
        salary_range: job.salaryRange,
        growth_outlook: job.growthOutlook,
        key_skills: job.keySkills,
        day_in_life: job.dayInLife,
        company_types: job.companyTypes,
        discovery_input: discoveryInput,
        is_added_to_dream_jobs: false
      }));

      // Delete previous discoveries to avoid duplicates (keep only latest)
      await supabase
        .from('discovered_careers')
        .delete()
        .eq('user_id', user.id);

      const { data: savedCareers, error: saveError } = await supabase
        .from('discovered_careers')
        .insert(careersToInsert)
        .select();

      if (saveError) {
        console.error('Failed to save discovered careers:', saveError);
        // Don't fail the request - just log the error
      } else {
        console.log(`Saved ${savedCareers?.length || 0} discovered careers to database`);
      }

      // Return saved careers with IDs
      return createSuccessResponse({
        success: true,
        jobs: savedCareers || discoveredJobs.map((job: DiscoveredJob, idx: number) => ({
          ...job,
          id: `temp-${idx}` // Temp ID if save failed
        })),
        insights: parsed.careerInsights || "",
        saved: !saveError
      }, corsHeaders);
    }

    return createSuccessResponse({
      success: true,
      jobs: [],
      insights: parsed.careerInsights || "",
      saved: false
    }, corsHeaders);
  } catch (error) {
    logError("discover-dream-jobs", error instanceof Error ? error : new Error(String(error)), { action: "processing" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, error instanceof Error ? error.message : "Unknown error");
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
