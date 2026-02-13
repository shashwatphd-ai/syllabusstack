import { createClient } from "@supabase/supabase-js";
import { MASTER_SYSTEM_PROMPT, GAP_ANALYSIS_PROMPT } from "../_shared/prompts.ts";
import { trackAIUsage, createServiceClient } from "../_shared/ai-cache.ts";
import { GAP_ANALYSIS_SCHEMA } from "../_shared/schemas.ts";
import { analyzeRequirementCoverage, buildUserCapabilityKeywords } from "../_shared/similarity.ts";
import { generateKeywordVector, calculateSimilarity } from "../_shared/ai-orchestrator.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";
import { createErrorResponse, createSuccessResponse, withErrorHandling, logInfo, logError } from "../_shared/error-handler.ts";
import { generateStructured, MODELS } from "../_shared/unified-ai-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { applyDecayToSkills, generateDecaySummary, getSkillsNeedingRetest, type RawSkill } from "../_shared/skill-decay.ts";
import { validateRequest, gapAnalysisSchema } from "../_shared/validators/index.ts";

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  // Validate request body with Zod schema
  const body = await req.json();
  const validation = validateRequest(gapAnalysisSchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }
  const { dreamJobId } = validation.data;

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Authorization required');
  }

  try {
    
    // Authenticated flow - always require valid auth header
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Failed to authenticate user');
    }
    const userId = user.id;

    // Create service client for rate limiting
    const serviceClient = createServiceClient();

    // Check rate limits for authenticated users
    if (authHeader) {
      const limits = await getUserLimits(serviceClient, userId);
      const rateLimitResult = await checkRateLimit(serviceClient, userId, 'gap-analysis', limits);
      
      if (!rateLimitResult.allowed) {
        return createRateLimitResponse(rateLimitResult, corsHeaders);
      }
      
      logInfo('gap-analysis', 'rate_limit_check', { userId, remaining: rateLimitResult.remaining });
    }

    // Get user's capabilities (self-reported)
    const { data: capabilities, error: capError } = await supabase
      .from("capabilities")
      .select("*");

    if (capError) {
      logError('gap-analysis', new Error(`Failed to fetch capabilities: ${capError.message}`));
      return createErrorResponse('DATABASE_ERROR', corsHeaders, 'Failed to fetch capabilities');
    }

    // Get user's VERIFIED skills (from assessments - higher weight than capabilities)
    const { data: verifiedSkills, error: vsError } = await supabase
      .from("verified_skills")
      .select("*")
      .eq("user_id", userId);

    if (vsError) {
      logError('gap-analysis', new Error(`Failed to fetch verified skills: ${vsError.message}`));
      // Don't fail - verified skills are optional
    }

    logInfo('gap-analysis', 'verified_skills_fetched', {
      count: verifiedSkills?.length || 0,
      skills: (verifiedSkills || []).map((vs: any) => vs.skill_name).slice(0, 10)
    });

    // Apply Weibull decay to verified skills
    const rawSkillsForDecay: RawSkill[] = (verifiedSkills || []).map((vs: any) => ({
      skill_name: vs.skill_name,
      proficiency_level: vs.proficiency_level || 'intermediate',
      verified_at: vs.verified_at || vs.created_at,
      source_type: vs.source_type || 'assessment',
    }));
    const decayedSkills = applyDecayToSkills(rawSkillsForDecay);
    const skillsNeedingRetest = getSkillsNeedingRetest(decayedSkills);
    const decaySummary = generateDecaySummary(decayedSkills);

    logInfo('gap-analysis', 'decay_applied', {
      totalSkills: decayedSkills.length,
      needingRetest: skillsNeedingRetest.length,
      downgradedCount: decayedSkills.filter(s => s.effective_level !== s.base_level).length,
    });

    // Get job requirements
    const { data: requirements, error: reqError } = await supabase
      .from("job_requirements")
      .select("*")
      .eq("dream_job_id", dreamJobId);

    if (reqError) {
      logError('gap-analysis', new Error(`Failed to fetch requirements: ${reqError.message}`));
      return createErrorResponse('DATABASE_ERROR', corsHeaders, 'Failed to fetch requirements');
    }

    // Get dream job details
    const { data: dreamJob, error: jobError } = await supabase
      .from("dream_jobs")
      .select("*")
      .eq("id", dreamJobId)
      .single();

    if (jobError) {
      logError('gap-analysis', new Error(`Failed to fetch dream job: ${jobError.message}`));
      return createErrorResponse('DATABASE_ERROR', corsHeaders, 'Failed to fetch dream job');
    }

    logInfo('gap-analysis', 'data_fetched', {
      capabilities: capabilities?.length || 0,
      verifiedSkills: verifiedSkills?.length || 0,
      requirements: requirements?.length || 0
    });


    // Build user's capability keywords
    const userKeywords = await buildUserCapabilityKeywords(supabase, userId);
    console.log(`User has ${userKeywords.length} aggregated capability keywords`);

    // Analyze requirement coverage using similarity functions
    const coverageAnalysis = await analyzeRequirementCoverage(supabase, dreamJobId, userId);
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

    // Format VERIFIED skills with decay information (highest confidence - passed assessments)
    const verifiedSkillsList = decayedSkills.map((ds) => {
      const decayStatus = ds.effective_level !== ds.base_level
        ? ` [DECAYED: ${ds.base_level} → ${ds.effective_level}]`
        : '';
      const retestNote = ds.needs_retest ? ' [NEEDS RETEST]' : '';
      return `- ${ds.skill_name} [VERIFIED] (${ds.effective_level} level, ${Math.round(ds.survival_probability * 100)}% fresh, ${ds.days_since_verification} days ago)${decayStatus}${retestNote}`;
    }).join("\n");

    // Format self-reported capabilities (lower confidence than verified)
    const capabilitiesList = (capabilities || []).map((c: any) =>
      `- ${c.name} [SELF-REPORTED] (${c.proficiency_level || 'unknown'} level, category: ${c.category || 'general'})`
    ).join("\n");

    // Calculate verified skill names for gap identification
    const verifiedSkillNames = (verifiedSkills || []).map((vs: any) => vs.skill_name.toLowerCase());

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
- VERIFIED Skills Count: ${verifiedSkills?.length || 0} (these are PROVEN competencies)
- Self-Reported Capabilities Count: ${capabilities?.length || 0} (these are UNPROVEN claims)
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

SKILL FRESHNESS (Weibull Decay Model):
${decaySummary || '- All skills are fresh and current'}
${skillsNeedingRetest.length > 0 ? `\nSKILLS NEEDING RETEST (${skillsNeedingRetest.length}):
${skillsNeedingRetest.slice(0, 5).map(s => `- ${s.skill_name}: ${Math.round(s.survival_probability * 100)}% retained`).join('\n')}` : ''}

Note: This is keyword-based analysis with skill decay applied. Use your judgment to refine. Give VERIFIED skills higher confidence than self-reported capabilities. Skills marked DECAYED or NEEDS RETEST should be weighted lower as they may be outdated.`;

    const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${GAP_ANALYSIS_PROMPT}`;

    const userContent = `Perform a BRUTALLY HONEST gap analysis for this student:

DREAM JOB: ${dreamJob.title}
${dreamJob.company_type ? `Company Type: ${dreamJob.company_type}` : ""}
${dreamJob.description ? `Role Description: ${dreamJob.description}` : ""}

STUDENT'S VERIFIED SKILLS (HIGH CONFIDENCE - proven through assessments):
${verifiedSkillsList || "No verified skills yet - student has not passed any assessments"}

STUDENT'S SELF-REPORTED CAPABILITIES (LOWER CONFIDENCE - not yet verified):
${capabilitiesList || "No capabilities recorded yet"}

IMPORTANT: Verified skills should be weighted MORE heavily than self-reported capabilities.
- VERIFIED skills = student has PROVEN this competency by passing an assessment
- SELF-REPORTED = student claims to have this skill but it's unproven
- When a skill appears in both lists, use the VERIFIED status as the authoritative one
- If a job requirement matches a VERIFIED skill, count it as a STRONG overlap
- If a job requirement only matches a SELF-REPORTED capability, count it as a PARTIAL overlap

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
5. Specific priority gaps to address first

Return your response using the generate_gap_analysis function.`;

    // Use unified AI client for structured extraction
    const result = await generateStructured<{
      match_score: number;
      strong_overlaps: any[];
      critical_gaps: any[];
      partial_overlaps: any[];
      honest_assessment: string;
      readiness_level: string;
      interview_readiness: string;
      job_success_prediction: string;
      priority_gaps: any[];
      anti_recommendations: string[];
    }>({
      prompt: userContent,
      systemPrompt: systemPrompt,
      schema: GAP_ANALYSIS_SCHEMA,
      model: MODELS.FAST,
      fallbacks: [MODELS.GEMINI_FLASH],
      logPrefix: '[gap-analysis]'
    });
    const analysis = result.data;

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

    // Persist gap analysis to database using UPSERT (update if exists, insert if not)
    const { data: gapAnalysisRecord, error: upsertError } = await supabase
      .from("gap_analyses")
      .upsert({
        user_id: userId,
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
        ai_model_used: "openrouter/gpt-4o-mini",
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,dream_job_id'
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Error saving gap analysis:", upsertError);
    } else {
      console.log("Saved gap analysis with ID:", gapAnalysisRecord?.id);
    }

    // Save anti-recommendations if any
    if (analysis.anti_recommendations?.length > 0) {
      const antiRecsToInsert = analysis.anti_recommendations.map((ar: string) => ({
        user_id: userId,
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
      userId,
      "gap-analysis",
      "openrouter/gpt-4o-mini"
    );

    logInfo('gap-analysis', 'complete', {
      matchScore: analysis.match_score,
      gapAnalysisId: gapAnalysisRecord?.id,
      skillsNeedingRetest: skillsNeedingRetest.length,
    });

    return createSuccessResponse({
      ...analysis,
      gap_analysis_id: gapAnalysisRecord?.id,
      keyword_analysis: preAnalysisContext, // Include for transparency
      verified_skills_used: verifiedSkills?.length || 0,
      self_reported_used: capabilities?.length || 0,
      // Include decay analysis in response
      skill_decay: {
        skills_needing_retest: skillsNeedingRetest.map(s => ({
          skill_name: s.skill_name,
          survival_probability: Math.round(s.survival_probability * 100),
          days_since_verification: s.days_since_verification,
          effective_level: s.effective_level,
          base_level: s.base_level,
        })),
        total_decayed: decayedSkills.filter(s => s.effective_level !== s.base_level).length,
      },
    }, corsHeaders);
  } catch (error) {
    logError('gap-analysis', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
