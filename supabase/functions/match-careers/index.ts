import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import {
  validateMatchCareersRequest,
  corsPreflightResponse,
  successResponse,
  validationErrorResponse,
  authErrorResponse,
  internalErrorResponse,
  generateRequestId,
  PipelineLogger,
  authenticateRequest,
  checkRateLimit,
  getUserLimits,
  rateLimitResponse,
  ErrorCodes,
} from "../_shared/skills-pipeline/index.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { logInfo, logError } from "../_shared/error-handler.ts";

// Holland RIASEC adjacency for Iachan's M Index
const HOLLAND_ADJACENCY: Record<string, string[]> = {
  'R': ['I', 'C'],
  'I': ['R', 'A'],
  'A': ['I', 'S'],
  'S': ['A', 'E'],
  'E': ['S', 'C'],
  'C': ['E', 'R'],
};

// Calculate Holland code similarity using Iachan's M Index
function calculateHollandMatch(userCode: string, occupationCode: string): number {
  if (!userCode || !occupationCode || userCode.length < 3 || occupationCode.length < 3) {
    return 0;
  }

  const userTypes = userCode.toUpperCase().split('');
  const occTypes = occupationCode.toUpperCase().split('');
  
  let score = 0;
  const maxScore = 18; // Maximum possible with weighted positions

  // Position-weighted matching (3 points for exact, 2 for adjacent, 0 for opposite)
  for (let i = 0; i < 3; i++) {
    const weight = 3 - i; // Position weight: 3, 2, 1
    
    for (let j = 0; j < 3; j++) {
      if (userTypes[i] === occTypes[j]) {
        // Exact match - full points weighted by both positions
        score += weight * (3 - j);
      } else if (HOLLAND_ADJACENCY[userTypes[i]]?.includes(occTypes[j])) {
        // Adjacent match - partial points
        score += (weight * (3 - j)) * 0.5;
      }
    }
  }

  return Math.round((score / maxScore) * 100);
}

// Calculate skills match based on importance-weighted gap analysis
function calculateSkillsMatch(
  userSkills: Record<string, number>,
  requiredSkills: Record<string, { level: number; importance: string }>
): { score: number; gaps: Array<{ skill: string; gap: number; importance: string }> } {
  if (!userSkills || !requiredSkills || Object.keys(requiredSkills).length === 0) {
    return { score: 0, gaps: [] };
  }

  let totalWeight = 0;
  let weightedScore = 0;
  const gaps: Array<{ skill: string; gap: number; importance: string }> = [];

  const importanceWeights: Record<string, number> = {
    'essential': 3,
    'important': 2,
    'helpful': 1,
  };

  for (const [skill, requirement] of Object.entries(requiredSkills)) {
    const normalizedSkill = skill.toLowerCase().replace(/\s+/g, '_');
    const userLevel = userSkills[normalizedSkill] || 0;
    const requiredLevel = requirement.level;
    const weight = importanceWeights[requirement.importance] || 1;
    
    totalWeight += weight;
    
    // Calculate match (0-100)
    const match = Math.min(100, (userLevel / requiredLevel) * 100);
    weightedScore += match * weight;
    
    // Track gaps (where user is below required)
    if (userLevel < requiredLevel) {
      gaps.push({
        skill,
        gap: requiredLevel - userLevel,
        importance: requirement.importance,
      });
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  
  // Sort gaps by importance then by gap size
  gaps.sort((a, b) => {
    const importanceOrder = { essential: 0, important: 1, helpful: 2 };
    const orderA = importanceOrder[a.importance as keyof typeof importanceOrder] ?? 3;
    const orderB = importanceOrder[b.importance as keyof typeof importanceOrder] ?? 3;
    if (orderA !== orderB) return orderA - orderB;
    return b.gap - a.gap;
  });

  return { score, gaps };
}

// Calculate work values alignment
function calculateValuesMatch(
  userValues: Record<string, number>,
  occupationValues: Record<string, number>
): number {
  if (!userValues || !occupationValues) {
    return 0;
  }

  let totalDiff = 0;
  let count = 0;

  for (const [value, occScore] of Object.entries(occupationValues)) {
    const userScore = userValues[value] || 50; // Default to neutral
    const diff = Math.abs(userScore - occScore);
    totalDiff += diff;
    count++;
  }

  if (count === 0) return 0;
  
  // Convert average difference to match score (0 diff = 100%, 100 diff = 0%)
  const avgDiff = totalDiff / count;
  return Math.round(Math.max(0, 100 - avgDiff));
}

serve(async (req) => {
  const requestId = generateRequestId();
  const logger = new PipelineLogger('match-careers', requestId);
  const startTime = Date.now();

  // Handle CORS preflight with standardized handler
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  logInfo('match-careers', 'starting', { requestId });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validation = validateMatchCareersRequest(body);
    if (!validation.success) {
      logger.warn('Validation failed', { errors: validation.errors });
      return validationErrorResponse(validation.errors!, requestId);
    }

    const { limit = 20, filters } = validation.data!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return authErrorResponse(ErrorCodes.AUTH_MISSING_HEADER, 'Authorization header required', requestId);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const authResult = await authenticateRequest(req, supabase, requestId);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    // Check rate limits
    const userLimits = await getUserLimits(supabase, userId);
    const rateLimitResult = await checkRateLimit(supabase, userId, 'match-careers', userLimits);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { remaining: rateLimitResult.remaining });
      return rateLimitResponse(
        rateLimitResult.reason || 'Rate limit exceeded',
        rateLimitResult.retryAfter || 3600,
        requestId,
        rateLimitResult.remaining
      );
    }

    logger.info('Matching careers for user', { userId, limit });

    // Fetch user's skill profile
    const { data: skillProfile, error: profileError } = await supabase
      .from('skill_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      logger.error('Failed to fetch skill profile', profileError);
    }

    if (!skillProfile) {
      logger.warn('No skill profile found', { userId });
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: ErrorCodes.PROFILE_NOT_FOUND,
          message: 'No skill profile found. Please complete the skills assessment first.',
        },
        meta: { request_id: requestId },
        needs_assessment: true,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('Found skill profile', { hollandCode: skillProfile.holland_code });

    // Fetch all occupations
    let query = supabase
      .from('onet_occupations')
      .select('*');

    // Apply filters if provided
    if (filters?.min_salary) {
      query = query.gte('median_wage', filters.min_salary);
    }
    if (filters?.job_outlook) {
      query = query.eq('job_outlook', filters.job_outlook);
    }

    const { data: occupations, error: occError } = await query;

    if (occError || !occupations || occupations.length === 0) {
      logger.warn('No occupations found', { error: occError });
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: ErrorCodes.RESOURCE_NOT_FOUND,
          message: 'No occupations available for matching',
        },
        meta: { request_id: requestId },
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('Matching against occupations', { count: occupations.length });

    // Calculate matches for each occupation
    const matches = occupations.map(occupation => {
      // 40% Interest Match (Holland RIASEC)
      const interestMatch = calculateHollandMatch(
        skillProfile.holland_code,
        occupation.riasec_code
      );

      // 40% Skills Match
      const skillsResult = calculateSkillsMatch(
        skillProfile.technical_skills as Record<string, number>,
        occupation.skills as Record<string, { level: number; importance: string }>
      );

      // 20% Values Match
      const valuesMatch = calculateValuesMatch(
        skillProfile.work_values as Record<string, number>,
        occupation.work_values as Record<string, number>
      );

      // Weighted overall score
      const overallScore = Math.round(
        (interestMatch * 0.4) + (skillsResult.score * 0.4) + (valuesMatch * 0.2)
      );

      return {
        onet_soc_code: occupation.soc_code,
        occupation_title: occupation.title,
        description: occupation.description,
        overall_match_score: overallScore,
        interest_match_score: interestMatch,
        skill_match_score: skillsResult.score,
        values_match_score: valuesMatch,
        skill_gaps: skillsResult.gaps.slice(0, 5), // Top 5 gaps
        match_breakdown: {
          user_holland: skillProfile.holland_code,
          occupation_holland: occupation.riasec_code,
          interest_weight: 0.4,
          skills_weight: 0.4,
          values_weight: 0.2,
        },
        occupation_details: {
          median_wage: occupation.median_wage,
          job_outlook: occupation.job_outlook,
          education_level: occupation.education_level,
          bright_outlook: occupation.bright_outlook,
        },
      };
    });

    // Sort by overall score descending
    matches.sort((a, b) => b.overall_match_score - a.overall_match_score);

    // Take top N matches
    const topMatches = matches.slice(0, limit);

    // Upsert matches to database for persistence
    const matchRecords = topMatches.map(match => ({
      user_id: userId,
      skill_profile_id: skillProfile.id,
      onet_soc_code: match.onet_soc_code,
      occupation_title: match.occupation_title,
      overall_match_score: match.overall_match_score,
      interest_match_score: match.interest_match_score,
      skill_match_score: match.skill_match_score,
      values_match_score: match.values_match_score,
      skill_gaps: match.skill_gaps,
      match_breakdown: match.match_breakdown,
      updated_at: new Date().toISOString(),
    }));

    // Delete old matches for this user (unlinked ones only)
    await supabase
      .from('career_matches')
      .delete()
      .eq('user_id', userId)
      .is('dream_job_id', null);

    // Insert new matches
    const { error: insertError } = await supabase
      .from('career_matches')
      .upsert(matchRecords, {
        onConflict: 'user_id,onet_soc_code',
      });

    if (insertError) {
      logger.error('Failed to save matches', insertError);
      // Don't fail - still return calculated matches
    }

    logger.complete('success', { 
      matchesReturned: topMatches.length, 
      occupationsAnalyzed: occupations.length 
    });

    return successResponse({
      matches: topMatches,
      total_occupations_analyzed: occupations.length,
      skill_profile_summary: {
        holland_code: skillProfile.holland_code,
        strong_skills_count: (skillProfile.strong_skills as unknown[])?.length || 0,
        development_areas_count: (skillProfile.development_areas as unknown[])?.length || 0,
      },
    }, requestId, startTime);

  } catch (error) {
    logger.error('Unhandled error', error);
    return internalErrorResponse(error, requestId);
  }
});
