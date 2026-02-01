import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { MASTER_SYSTEM_PROMPT, JOB_REQUIREMENTS_PROMPT, createJobRequirementsCacheKey } from "../_shared/prompts.ts";
import { getCachedResponse, setCachedResponse, trackAIUsage, createServiceClient, CACHE_TTL } from "../_shared/ai-cache.ts";
import { JOB_REQUIREMENTS_SCHEMA } from "../_shared/schemas.ts";
import { generateKeywordVector } from "../_shared/ai-orchestrator.ts";
import { functionCall, MODELS } from "../_shared/openrouter-client.ts";
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
    logInfo('analyze-dream-job', 'starting');
    const { jobTitle, companyType, location, dreamJobId } = await req.json();

    if (!jobTitle) {
      return new Response(
        JSON.stringify({ error: "Job title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing dream job:", jobTitle);

    const serviceClient = createServiceClient();

    // If dreamJobId provided, check if it already has O*NET data (from career match)
    // This skips expensive AI analysis for career-match-derived dream jobs
    if (dreamJobId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: existingJob } = await supabase
          .from("dream_jobs")
          .select("onet_soc_code, onet_data, source_type, requirements_keywords")
          .eq("id", dreamJobId)
          .single();

        // If dream job has O*NET data from career match, skip AI analysis
        if (existingJob?.onet_soc_code && existingJob?.source_type === 'career_match') {
          console.log(`Dream job ${dreamJobId} has O*NET data (${existingJob.onet_soc_code}), skipping AI analysis`);

          const onetData = existingJob.onet_data || {};

          // Extract requirements from O*NET data
          const requirements = (onetData.required_skills || []).map((skill: any) => ({
            skill_name: skill.skill,
            importance: skill.importance === 'high' ? 'critical' : skill.importance === 'medium' ? 'important' : 'nice_to_have',
            category: 'O*NET Skills'
          }));

          // Add knowledge requirements
          const knowledgeReqs = (onetData.required_knowledge || []).map((k: any) => ({
            skill_name: k.name,
            importance: k.level > 70 ? 'critical' : k.level > 50 ? 'important' : 'nice_to_have',
            category: 'O*NET Knowledge'
          }));

          // Extract day-one capabilities from high-importance skills
          const dayOneCapabilities = (onetData.required_skills || [])
            .filter((s: any) => s.importance === 'high')
            .slice(0, 5)
            .map((s: any) => ({
              requirement: s.skill,
              importance: 'critical'
            }));

          // Use existing requirements_keywords or generate from O*NET data
          const requirementsKeywords = existingJob.requirements_keywords ||
            [...new Set([
              ...generateKeywordVector(jobTitle),
              ...generateKeywordVector(onetData.description || ''),
              ...(onetData.required_skills || []).map((s: any) => s.skill?.toLowerCase()),
              ...(onetData.required_knowledge || []).map((k: any) => k.name?.toLowerCase())
            ].filter(Boolean))];

          return new Response(
            JSON.stringify({
              requirements: [...requirements, ...knowledgeReqs],
              description: onetData.description || `O*NET occupation: ${existingJob.onet_soc_code}`,
              salary_range: onetData.median_wage ? `$${(onetData.median_wage / 1000).toFixed(0)}k median` : null,
              day_one_capabilities: dayOneCapabilities,
              differentiators: (onetData.required_abilities || []).slice(0, 3).map((a: any) => ({
                skill: a.name,
                why_matters: 'Key ability identified by O*NET'
              })),
              common_misconceptions: [],
              realistic_bar: onetData.education_level || null,
              keywords_count: requirementsKeywords.length,
              source: 'onet_data',
              onet_soc_code: existingJob.onet_soc_code
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Check cache first (for non-O*NET dream jobs)
    const cacheKey = createJobRequirementsCacheKey(jobTitle, companyType);
    const cachedData = await getCachedResponse(serviceClient, cacheKey);

    let requirements, description, salaryRange, dayOneCapabilities, differentiators, commonMisconceptions, realisticBar;
    let requirementsKeywords: string[] = [];

    if (cachedData) {
      console.log("Using cached job requirements");
      requirements = cachedData.requirements;
      description = cachedData.description;
      salaryRange = cachedData.salary_range;
      dayOneCapabilities = cachedData.day_one_capabilities;
      differentiators = cachedData.differentiators;
      commonMisconceptions = cachedData.common_misconceptions;
      realisticBar = cachedData.realistic_bar;
      requirementsKeywords = cachedData.requirements_keywords || [];
    } else {
      // Check job_requirements_cache table for common queries
      const normalizedQuery = jobTitle.toLowerCase().trim();
      const { data: tableCache } = await serviceClient
        .from("job_requirements_cache")
        .select("*")
        .eq("job_query_normalized", normalizedQuery)
        .single();

      if (tableCache) {
        console.log("Using job_requirements_cache table");
        // Update query count
        await serviceClient
          .from("job_requirements_cache")
          .update({ 
            query_count: (tableCache.query_count || 1) + 1, 
            last_queried_at: new Date().toISOString() 
          })
          .eq("id", tableCache.id);

        requirements = [];
        description = tableCache.requirements_text;
        salaryRange = null;
        dayOneCapabilities = tableCache.day_one_capabilities;
        differentiators = tableCache.differentiators;
        commonMisconceptions = tableCache.common_misconceptions;
        realisticBar = tableCache.realistic_bar;
        requirementsKeywords = tableCache.keywords || [];
      } else {
        // No cache - call AI via OpenRouter
        const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${JOB_REQUIREMENTS_PROMPT}`;

        const userContent = `Analyze this dream job and provide REALISTIC requirements that employers actually look for:

JOB TITLE: ${jobTitle}
${companyType ? `COMPANY TYPE: ${companyType}` : ""}
${location ? `LOCATION: ${location}` : ""}

Provide a comprehensive analysis including:
1. All requirements categorized by importance (critical, important, nice_to_have)
2. Day-one capabilities - what must they do on their FIRST DAY
3. Differentiators - what sets top candidates apart
4. Common misconceptions - what students think matters but doesn't
5. Realistic bar - the minimum viable candidate profile

Be specific to this role and company type. Use real industry knowledge.

Return your response using the generate_job_requirements function.`;

        // Use OpenRouter for AI call
        const parsed = await functionCall<{
          requirements: any[];
          description: string | null;
          salary_range: string | null;
          day_one_capabilities: any[];
          differentiators: any[];
          common_misconceptions: any[];
          realistic_bar: string | null;
        }>(
          MODELS.FAST,
          systemPrompt,
          userContent,
          JOB_REQUIREMENTS_SCHEMA,
          { fallbacks: [MODELS.GEMINI_FLASH] },
          '[analyze-dream-job]'
        );

        requirements = parsed.requirements || [];
        description = parsed.description || null;
        salaryRange = parsed.salary_range || null;
        dayOneCapabilities = parsed.day_one_capabilities || [];
        differentiators = parsed.differentiators || [];
        commonMisconceptions = parsed.common_misconceptions || [];
        realisticBar = parsed.realistic_bar || null;

        // Generate keywords from all job-related text for similarity matching
        const titleKeywords = generateKeywordVector(jobTitle);
        const descKeywords = description ? generateKeywordVector(description) : [];
        const reqKeywords = requirements.flatMap((r: any) => 
          generateKeywordVector(`${r.skill_name} ${r.category || ''}`)
        );
        const dayOneKeywords = dayOneCapabilities.flatMap((d: any) => 
          generateKeywordVector(d.requirement || d)
        );
        const diffKeywords = differentiators.flatMap((d: any) => 
          generateKeywordVector(d.skill || d)
        );
        
        requirementsKeywords = [...new Set([
          ...titleKeywords,
          ...descKeywords,
          ...reqKeywords,
          ...dayOneKeywords,
          ...diffKeywords
        ])];

        console.log(`Generated ${requirementsKeywords.length} keywords for job: ${jobTitle}`);

        // Save to job_requirements_cache table for future queries
        await serviceClient.from("job_requirements_cache").upsert({
          job_query_normalized: normalizedQuery,
          requirements_text: description || `Requirements for ${jobTitle}`,
          day_one_capabilities: dayOneCapabilities,
          differentiators: differentiators,
          common_misconceptions: commonMisconceptions,
          realistic_bar: realisticBar,
          keywords: requirementsKeywords, // Store keywords for similarity matching
          query_count: 1,
          last_queried_at: new Date().toISOString()
        }, { onConflict: "job_query_normalized" });

        // Also cache in ai_cache for faster lookups
        await setCachedResponse(
          serviceClient,
          cacheKey,
          "job_requirements",
          {
            requirements,
            description,
            salary_range: salaryRange,
            day_one_capabilities: dayOneCapabilities,
            differentiators,
            common_misconceptions: commonMisconceptions,
            realistic_bar: realisticBar,
            requirements_keywords: requirementsKeywords
          },
          "openrouter/gpt-4o-mini",
          CACHE_TTL.job_requirements
        );
      }
    }

    // If dreamJobId provided, save requirements to database
    if (dreamJobId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();

        // Update dream job with all new fields including keywords
        const { error: updateError } = await supabase
          .from("dream_jobs")
          .update({ 
            description: description,
            salary_range: salaryRange,
            day_one_capabilities: dayOneCapabilities,
            differentiators: differentiators,
            common_misconceptions: commonMisconceptions,
            realistic_bar: realisticBar,
            requirements_keywords: requirementsKeywords // Store for gap analysis
          })
          .eq("id", dreamJobId);

        if (updateError) {
          console.error("Error updating dream job:", updateError);
        } else {
          console.log(`Updated dream job ${dreamJobId} with ${requirementsKeywords.length} keywords`);
        }

        // Delete existing requirements
        await supabase
          .from("job_requirements")
          .delete()
          .eq("dream_job_id", dreamJobId);

        // Insert new requirements
        const requirementsToInsert = requirements.map((req: any) => ({
          dream_job_id: dreamJobId,
          skill_name: req.skill_name,
          importance: req.importance,
          category: req.category
        }));

        const { error: insertError } = await supabase
          .from("job_requirements")
          .insert(requirementsToInsert);

        if (insertError) {
          console.error("Error inserting requirements:", insertError);
        } else {
          console.log(`Inserted ${requirements.length} requirements for job ${dreamJobId}`);
        }

        // Track AI usage if we made a new AI call
        if (!cachedData && user) {
          await trackAIUsage(
            serviceClient,
            user.id,
            "analyze-dream-job",
            "openrouter/gpt-4o-mini"
          );
        }
      }
    }

    logInfo('analyze-dream-job', 'complete', { keywordsCount: requirementsKeywords.length });
    return createSuccessResponse({
      requirements,
      description,
      salary_range: salaryRange,
      day_one_capabilities: dayOneCapabilities,
      differentiators,
      common_misconceptions: commonMisconceptions,
      realistic_bar: realisticBar,
      keywords_count: requirementsKeywords.length
    }, corsHeaders);
  } catch (error) {
    logError('analyze-dream-job', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
