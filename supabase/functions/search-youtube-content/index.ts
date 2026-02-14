import { createClient } from "@supabase/supabase-js";
import {
  checkCache,
  saveToCache,
  extractKeywords
} from "../_shared/content-cache.ts";
import { generateSearchQueries, generateSearchQueriesWithBrief } from "../_shared/query-intelligence/index.ts";
import type { ContentBrief, ContentRoleType, GeneratedQuery } from "../_shared/query-intelligence/types.ts";
import {
  searchYouTubeOrchestrated,
  toYouTubeVideoArray,
  YouTubeSearchResult,
} from "../_shared/youtube-search/index.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { validateRequest, searchYoutubeContentSchema } from "../_shared/validators/index.ts";


/**
 * UNIFIED EDUCATIONAL CONTENT SEARCH FOR INSTRUCTORS
 *
 * This function provides high-quality content discovery for instructor courses.
 * Uses multi-source search orchestrator (Firecrawl, Jina, Invidious, YouTube API).
 *
 * Consolidated Pipeline:
 * 1. Context Assembly - Single DB round-trip for LO + module + course
 * 2. Query Intelligence - Generate smart search queries (3 builders)
 * 3. Multi-Query Discovery - Top 3 queries searched in parallel
 * 4. Lightweight Pre-Filter - Duration fit + channel authority
 * 5. AI Evaluation - Single scoring authority (evaluate-content-batch)
 * 6. Save & Auto-Approve - AI recommendation drives approval
 */

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: number;
  viewCount: number;
  likeCount: number;
}

interface ScoredContent {
  video: YouTubeVideo;
  pre_filter: {
    duration_fit: number;
    channel_authority: number;
    passes: boolean;
  };
  ai_score?: number;
  ai_reasoning?: string | null;
  ai_recommendation?: string | null;
  ai_concern?: string | null;
  ai_relevance_score?: number | null;
  ai_pedagogy_score?: number | null;
  ai_quality_score?: number | null;
  match_score: number;
  content_role?: ContentRoleType;
}

// ============================================================================
// PRE-FILTER FUNCTIONS (kept as lightweight filters, not scoring weights)
// ============================================================================

function calculateDurationFitScore(
  actualSeconds: number,
  expectedMinutes: number,
  role?: ContentRoleType
): number {
  // For non-tutorial roles, duration is much less important
  if (role === 'curiosity_spark' || role === 'adjacent_insight') {
    if (actualSeconds === 0) return 0.5; // unknown duration — don't kill it
    if (actualSeconds > 30 && actualSeconds < 600) return 0.9;
    if (actualSeconds >= 600 && actualSeconds < 1800) return 0.8;
    return 0.6;
  }

  if (role === 'real_world_case' || role === 'practitioner_perspective' || role === 'debate_or_analysis') {
    if (actualSeconds === 0) return 0.5; // unknown — benefit of the doubt
    if (actualSeconds > 60 && actualSeconds < 3600) return 0.85;
    return 0.6;
  }

  // For core_explainer or untagged (tutorial), use existing logic but handle 0-duration
  if (actualSeconds === 0) return 0.4; // unknown duration — let AI evaluate

  const expectedSeconds = expectedMinutes * 60;
  const ratio = Math.min(actualSeconds, expectedSeconds) / Math.max(actualSeconds, expectedSeconds);

  if (actualSeconds >= expectedSeconds * 0.7 && actualSeconds <= expectedSeconds * 1.5) {
    return 0.8 + (ratio * 0.2);
  }
  if (actualSeconds < expectedSeconds * 0.5) return ratio * 0.4;
  if (actualSeconds > expectedSeconds * 2) return ratio * 0.5;

  return ratio * 0.7;
}

function calculateChannelQualityScore(video: YouTubeVideo): number {
  let score = 0.5; // neutral baseline

  // View count signal (from metadata enrichment)
  if (video.viewCount) {
    if (video.viewCount > 1_000_000) score += 0.2;
    else if (video.viewCount > 100_000) score += 0.15;
    else if (video.viewCount > 10_000) score += 0.1;
    else if (video.viewCount > 1_000) score += 0.05;
  }

  const channel = (video.channelTitle || '').toLowerCase();

  // Known high-quality creators (expanded beyond universities)
  const highQualityCreators = [
    // Universities & MOOCs
    'university', 'mit', 'stanford', 'yale', 'harvard', 'khan academy',
    'coursera', 'edx', 'professor',
    // Science communicators
    '3blue1brown', 'veritasium', 'kurzgesagt', 'minutephysics',
    'vsauce', 'smarter every day', 'numberphile', 'computerphile',
    'crash course', 'ted-ed', 'ted', 'scishow',
    // Tech/CS educators
    'fireship', 'the coding train', 'traversy media', 'freecodecamp',
    'cs dojo', 'sentdex', 'two minute papers',
    // News/analysis (non-controversial, factual)
    'wendover productions', 'real engineering', 'practical engineering',
    'economics explained', 'polymatter', 'cnbc', 'bloomberg',
    'vox', 'caspian report',
    // Business/industry
    'y combinator', 'a16z', 'harvard business review',
  ];
  if (highQualityCreators.some(c => channel.includes(c))) score += 0.15;

  // General educational signals
  const eduSignals = ['academy', 'edu', 'learn', 'school', 'institute', 'college'];
  if (eduSignals.some(s => channel.includes(s))) score += 0.05;

  return Math.min(score, 1.0);
}

/**
 * Parse ISO 8601 duration (e.g., "PT10M30S") to seconds
 */
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds to ISO 8601 duration for cache compatibility
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  let result = 'PT';
  if (hours > 0) result += `${hours}H`;
  if (minutes > 0) result += `${minutes}M`;
  if (secs > 0 || result === 'PT') result += `${secs}S`;
  return result;
}

// Pre-filter thresholds (lowered from 0.3 — AI evaluation is the real quality gate)
const MIN_DURATION_FIT = 0.2;

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
    }

    // Validate request body
    const body = await req.json();
    const validation = validateRequest(searchYoutubeContentSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }

    const {
      learning_objective_id,
      teaching_unit_id,
      core_concept,
      bloom_level,
      domain,
      search_keywords,
      expected_duration_minutes,
      lo_text,
      instructor_course_id,
      use_ai_evaluation,
      force_sync,
      sources,
    } = validation.data;

    logInfo('search-youtube-content', 'starting', { loId: learning_objective_id });

    // =========================================================================
    // STEP 1: Context Assembly (single DB round-trip)
    // Fetch LO + module + course + decomposition status in ONE joined query
    // =========================================================================
    const { data: contextData, error: contextError } = await supabaseClient
      .from('learning_objectives')
      .select(`
        text, core_concept, bloom_level, domain, search_keywords,
        expected_duration_minutes, instructor_course_id, module_id,
        decomposition_status, curriculum_batch_job_id,
        module:module_id(title, description),
        course:instructor_course_id(title, description, code, detected_domain)
      `)
      .eq('id', learning_objective_id)
      .single();

    if (contextError || !contextData) {
      logError('search-youtube-content', new Error(`Failed to fetch LO context: ${contextError?.message}`));
      return createErrorResponse('NOT_FOUND', corsHeaders, 'Learning objective not found');
    }

    // Derive effective values: request body overrides DB values
    const effectiveLoText = lo_text || contextData.text;
    const effectiveCoreConcept = core_concept || contextData.core_concept;
    const effectiveBloomLevel = bloom_level || contextData.bloom_level;
    const effectiveDomain = domain || contextData.domain;
    const effectiveSearchKeywords = search_keywords || contextData.search_keywords;
    const effectiveDuration = expected_duration_minutes || contextData.expected_duration_minutes;
    const effectiveCourseId = instructor_course_id || contextData.instructor_course_id;

    // Module and course context from joined query
    const moduleContext = contextData.module as { title: string; description?: string } | null;
    const courseContext = contextData.course as { title: string; description?: string; code?: string; detected_domain?: string } | null;

    console.log(`[UNIFIED SEARCH] LO: ${learning_objective_id}, Teaching Unit: ${teaching_unit_id || 'all'}, AI Eval: ${use_ai_evaluation}`);

    // =========================================================================
    // STEP 1.5: Check for Teaching Units
    // If none exist, proceed with LO-level search (no sync decomposition)
    // =========================================================================
    let teachingUnits: any[] = [];

    // Fetch existing teaching units for this LO
    const { data: existingUnits, error: unitsError } = await supabaseClient
      .from('teaching_units')
      .select('*')
      .eq('learning_objective_id', learning_objective_id)
      .order('sequence_order');

    if (!unitsError && existingUnits && existingUnits.length > 0) {
      teachingUnits = existingUnits;
      console.log(`[TEACHING UNITS] Found ${teachingUnits.length} existing teaching units`);
    } else {
      // No teaching units exist - check if batch job is processing
      if (contextData.decomposition_status === 'in_progress' && contextData.curriculum_batch_job_id) {
        console.log(`[TEACHING UNITS] Batch decomposition in progress for LO ${learning_objective_id}`);
        return new Response(
          JSON.stringify({
            success: false,
            retry_later: true,
            batch_job_id: contextData.curriculum_batch_job_id,
            message: 'Teaching unit decomposition in progress, please retry in 30 seconds'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
        );
      }

      // No teaching units and no batch in progress - proceed with LO-level search
      console.log('[TEACHING UNITS] No units found, proceeding with LO-level search');
    }

    // If searching for a specific teaching unit, filter to just that one
    if (teaching_unit_id) {
      teachingUnits = teachingUnits.filter((u: any) => u.id === teaching_unit_id);
      console.log(`[TEACHING UNITS] Filtering to specific unit: ${teaching_unit_id}`);
    }

    // =========================================================================
    // STEP 2: Get existing matches to avoid duplicates (CROSS-LO DEDUPLICATION)
    // =========================================================================
    const existingVideoIds = new Set<string>();
    const courseIdForDedup = effectiveCourseId;

    if (courseIdForDedup) {
      // Get ALL videos already matched to ANY LO in this entire course
      const { data: courseMatches, error: courseMatchError } = await supabaseClient
        .from("content_matches")
        .select(`
          content_id,
          content:content_id(source_id),
          learning_objectives!inner(instructor_course_id)
        `)
        .eq('learning_objectives.instructor_course_id', courseIdForDedup);

      if (courseMatchError) {
        console.log(`[DEDUP] Error fetching course matches, falling back to LO-only:`, courseMatchError.message);
        const { data: loMatches } = await supabaseClient
          .from("content_matches")
          .select(`content:content_id(source_id)`)
          .eq("learning_objective_id", learning_objective_id);

        loMatches?.forEach((m: any) => {
          if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
        });
      } else {
        courseMatches?.forEach((m: any) => {
          if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
        });
        console.log(`[DEDUP] Found ${existingVideoIds.size} videos already matched in course ${courseIdForDedup}`);
      }
    } else {
      const { data: existingMatches } = await supabaseClient
        .from("content_matches")
        .select(`content:content_id(source_id)`)
        .eq("learning_objective_id", learning_objective_id);

      existingMatches?.forEach((m: any) => {
        if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
      });
    }

    // =========================================================================
    // STEP 3: Check cache + Query Intelligence + Multi-Source Discovery
    // =========================================================================
    const searchConcept = effectiveLoText || effectiveCoreConcept || '';
    const cacheResult = await checkCache(searchConcept, 'youtube', effectiveCourseId);

    let allVideos: YouTubeVideo[] = [];
    let skipSearch = false;

    // If cache hit, convert to YouTubeVideo format and skip search
    if (cacheResult.found && cacheResult.results.length > 0) {
      console.log(`Cache HIT for: "${searchConcept.substring(0, 50)}..." (${cacheResult.source})`);

      for (const video of cacheResult.results) {
        if (!existingVideoIds.has(video.id)) {
          allVideos.push({
            id: video.id,
            title: video.title,
            description: video.description,
            channelTitle: video.channel_title || '',
            channelId: '',
            publishedAt: new Date().toISOString(),
            thumbnailUrl: video.thumbnail_url || '',
            duration: parseDurationToSeconds(video.duration || 'PT0S'),
            viewCount: video.view_count || 0,
            likeCount: 0,
          });
        }
      }
      skipSearch = allVideos.length > 0;
      console.log(`[CACHE] Converted ${allVideos.length} cached results to pipeline format`);
    }

    // If no cache hit (or empty), run query intelligence + multi-source discovery
    let contentBrief: ContentBrief | null = null;
    let generatedQueries: GeneratedQuery[] = [];
    // Track which role each video was discovered from (first query wins)
    const videoRoleMap = new Map<string, ContentRoleType>();

    if (!skipSearch) {
      // Query Intelligence with Content Role Reasoning
      let queries: string[] = [];

      // Use teaching unit's specific search_queries if available
      if (teaching_unit_id && teachingUnits.length > 0) {
        const targetUnit = teachingUnits.find((u: any) => u.id === teaching_unit_id);
        if (targetUnit?.search_queries && targetUnit.search_queries.length > 0) {
          queries = targetUnit.search_queries;
          console.log(`[TEACHING UNIT QUERIES] Using ${queries.length} pre-generated queries from teaching unit:`, queries.slice(0, 3));
        }
      }

      // Use full Query Intelligence with role reasoning if no teaching unit queries
      if (queries.length === 0) {
        const targetUnit = teaching_unit_id ? teachingUnits.find((u: any) => u.id === teaching_unit_id) : teachingUnits[0];

        try {
          console.log('[QUERY INTELLIGENCE] Generating search queries with role reasoning...');

          const queryText = targetUnit?.what_to_teach || targetUnit?.title || effectiveLoText;
          const queryConcept = targetUnit?.title || effectiveCoreConcept;
          const queryKeywords = targetUnit?.required_concepts?.length > 0
            ? targetUnit.required_concepts
            : effectiveSearchKeywords || [];

          const qiResult = await generateSearchQueriesWithBrief(
            {
              id: learning_objective_id,
              text: queryText,
              core_concept: queryConcept,
              action_verb: effectiveSearchKeywords?.[0] || '',
              bloom_level: effectiveBloomLevel || 'understand',
              domain: effectiveDomain || 'other',
              specificity: 'intermediate',
              search_keywords: queryKeywords,
              expected_duration_minutes: targetUnit?.target_duration_minutes || effectiveDuration || 15,
            },
            moduleContext ? { title: moduleContext.title, description: moduleContext.description } : undefined,
            courseContext ? { title: courseContext.title, description: courseContext.description, code: courseContext.code } : undefined
          );
          contentBrief = qiResult.contentBrief;
          generatedQueries = qiResult.queries;
          queries = generatedQueries.map(q => q.query);
          console.log(`[QUERY INTELLIGENCE] Generated ${queries.length} queries (brief: ${contentBrief ? contentBrief.roles.map(r => r.role).join(', ') : 'none'}):`, queries.slice(0, 5));
        } catch (qiError) {
          console.error('[QUERY INTELLIGENCE] Failed, using fallback:', qiError);
          const concept = targetUnit?.title || targetUnit?.what_to_teach?.split(' ').slice(0, 6).join(' ') ||
            effectiveCoreConcept || effectiveLoText?.split(' ').slice(0, 5).join(' ') || 'topic';
          const videoType = targetUnit?.target_video_type || 'explainer';
          const extraTerms = targetUnit?.required_concepts?.slice(0, 2).join(' ') || '';

          queries = [
            `${concept} ${videoType} ${extraTerms}`.trim(),
            `${concept} explained tutorial`,
            `${concept} lecture educational`,
          ];
          console.log(`[FALLBACK QUERIES] Using teaching unit context: "${concept.substring(0, 50)}..."`);
        }
      }

      // =========================================================================
      // Multi-Query Multi-Source Discovery
      // Search with top 5 queries in parallel for role diversity coverage
      // =========================================================================
      const topQueries = queries.slice(0, 5);
      const seenVideoIds = new Set<string>();
      let orchestratorSource = 'none';
      let orchestratorFallbacks: string[] = [];

      // Build a map from query string to its content_role for video tagging
      const queryRoleMap = new Map<number, ContentRoleType | undefined>();
      for (let i = 0; i < topQueries.length; i++) {
        const gq = generatedQueries.find(q => q.query === topQueries[i]);
        queryRoleMap.set(i, gq?.content_role);
      }

      if (topQueries.length > 0) {
        console.log(`[ORCHESTRATOR] Searching with ${topQueries.length} queries in parallel`);

        const searchPromises = topQueries.map((query, index) =>
          searchYouTubeOrchestrated({
            query,
            max_results: index === 0 ? 20 : 10,
            min_results: index === 0 ? 3 : 1,
            allow_youtube_api: index === 0,
            priority: 'normal',
            enrich_metadata: true,
            timeout_ms: index === 0 ? 20000 : 12000,
          }).catch(err => {
            console.error(`[ORCHESTRATOR] Query ${index} ("${query.substring(0, 40)}...") failed:`, err);
            return null;
          })
        );

        const searchResults = await Promise.all(searchPromises);

        for (let idx = 0; idx < searchResults.length; idx++) {
          const searchResult = searchResults[idx];
          if (!searchResult) continue;
          if (orchestratorSource === 'none') {
            orchestratorSource = searchResult.source;
          }
          orchestratorFallbacks.push(...searchResult.fallbacks_used);

          const queryRole = queryRoleMap.get(idx);

          for (const result of searchResult.results) {
            if (!existingVideoIds.has(result.video_id) && !seenVideoIds.has(result.video_id)) {
              seenVideoIds.add(result.video_id);
              // Tag video with the role of the query that found it
              if (queryRole) {
                videoRoleMap.set(result.video_id, queryRole);
              }
              allVideos.push({
                id: result.video_id,
                title: result.title,
                description: result.description,
                channelTitle: result.channel_name,
                channelId: result.channel_id || '',
                publishedAt: result.published_at || new Date().toISOString(),
                thumbnailUrl: result.thumbnail_url,
                duration: result.duration_seconds,
                viewCount: result.view_count,
                likeCount: result.like_count || 0,
              });
            }
          }
        }

        console.log(`[ORCHESTRATOR] Found ${allVideos.length} unique videos via ${orchestratorSource}`);
        if (orchestratorFallbacks.length > 0) {
          console.log(`[ORCHESTRATOR] Also used fallbacks: ${[...new Set(orchestratorFallbacks)].join(', ')}`);
        }
      }
    }

    console.log(`Found ${allVideos.length} unique videos total`);

    // =========================================================================
    // STEP 4: Lightweight Pre-Filter (duration fit + channel quality)
    // Role-aware: non-tutorial roles get flexible duration scoring
    // =========================================================================
    let filteredVideos: ScoredContent[] = allVideos.map(video => {
      const videoRole = videoRoleMap.get(video.id);
      const durationFit = calculateDurationFitScore(
        video.duration,
        effectiveDuration || 15,
        videoRole
      );
      const channelQuality = calculateChannelQualityScore(video);

      return {
        video,
        pre_filter: {
          duration_fit: Math.round(durationFit * 100) / 100,
          channel_authority: Math.round(channelQuality * 100) / 100,
          passes: durationFit >= MIN_DURATION_FIT,
        },
        match_score: 0,
        content_role: videoRole,
      };
    }).filter(sv => sv.pre_filter.passes);

    // Sort by channel quality as tiebreaker for AI evaluation ordering
    filteredVideos.sort((a, b) =>
      b.pre_filter.channel_authority - a.pre_filter.channel_authority
    );

    // Take top candidates for AI evaluation
    const topCandidatesForAI = filteredVideos.slice(0, 15);

    // =========================================================================
    // STEP 5: AI Evaluation (single scoring authority)
    // =========================================================================
    if (use_ai_evaluation && topCandidatesForAI.length > 0) {
      try {
        console.log(`[AI EVAL] Calling AI evaluation for ${topCandidatesForAI.length} videos...`);

        const evalResponse = await fetch(`${supabaseUrl}/functions/v1/evaluate-content-batch`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            learning_objective: {
              id: learning_objective_id,
              text: effectiveLoText,
              bloom_level: effectiveBloomLevel,
              core_concept: effectiveCoreConcept,
              action_verb: effectiveSearchKeywords?.[0] || '',
              expected_duration_minutes: effectiveDuration,
            },
            videos: topCandidatesForAI.map(sv => ({
              video_id: sv.video.id,
              title: sv.video.title,
              description: sv.video.description,
              channel_name: sv.video.channelTitle,
              duration_seconds: sv.video.duration,
            })),
            // Pass content roles so AI evaluates each video against its intended purpose
            content_roles: Object.fromEntries(
              topCandidatesForAI
                .filter(sv => sv.content_role)
                .map(sv => [sv.video.id, sv.content_role])
            ),
          }),
        });

        if (evalResponse.ok) {
          const evalData = await evalResponse.json();
          const aiEvaluations = new Map<string, any>(
            (evalData.evaluations || []).map((e: any) => [e.video_id, e])
          );

          // Apply AI scores directly (no blending with rule-based scores)
          filteredVideos = filteredVideos.map(sv => {
            const aiEval = aiEvaluations.get(sv.video.id);
            if (aiEval) {
              const aiScore = (aiEval.total_score || 50) / 100;
              return {
                ...sv,
                ai_score: aiEval.total_score,
                match_score: Math.round(aiScore * 100) / 100,
                ai_reasoning: aiEval.reasoning as string,
                ai_recommendation: aiEval.recommendation as string,
                ai_concern: aiEval.concern as string | null,
                ai_relevance_score: aiEval.relevance_score ?? null,
                ai_pedagogy_score: aiEval.pedagogy_score ?? null,
                ai_quality_score: aiEval.quality_score ?? null,
              };
            }
            return sv;
          });

          console.log(`[AI EVAL] Applied AI evaluations to ${aiEvaluations.size} videos`);
        } else {
          console.error('[AI EVAL] AI evaluation failed, using pre-filter fallback:', await evalResponse.text());
          // Fallback: use pre-filter scores as approximate match_score
          filteredVideos = filteredVideos.map(sv => ({
            ...sv,
            match_score: Math.round((sv.pre_filter.duration_fit * 0.5 + sv.pre_filter.channel_authority * 0.5) * 100) / 100,
          }));
        }
      } catch (evalError) {
        console.error('[AI EVAL] Error in AI evaluation:', evalError);
        // Fallback: use pre-filter scores
        filteredVideos = filteredVideos.map(sv => ({
          ...sv,
          match_score: Math.round((sv.pre_filter.duration_fit * 0.5 + sv.pre_filter.channel_authority * 0.5) * 100) / 100,
        }));
      }
    } else if (topCandidatesForAI.length > 0) {
      // No AI evaluation requested - use pre-filter scores as fallback
      filteredVideos = filteredVideos.map(sv => ({
        ...sv,
        match_score: Math.round((sv.pre_filter.duration_fit * 0.5 + sv.pre_filter.channel_authority * 0.5) * 100) / 100,
      }));
    }

    // Sort by match_score (AI score or fallback)
    filteredVideos.sort((a, b) => b.match_score - a.match_score);

    // =========================================================================
    // STEP 6: Portfolio-Aware Selection
    // Ensures diverse roles (tutorial + curiosity + real-world, etc.)
    // =========================================================================
    const channelCounts = new Map<string, number>();
    let viableCandidates: ScoredContent[];
    let finalCandidates: ScoredContent[];

    if (contentBrief && contentBrief.roles.length > 0) {
      // Portfolio-aware selection: ensure role diversity
      const portfolio: ScoredContent[] = [];
      const filledRoles = new Set<string>();

      // Pass 1: Best video per role (ensure diversity)
      for (const role of contentBrief.roles) {
        const roleVideos = filteredVideos
          .filter(sv =>
            sv.content_role === role.role &&
            sv.match_score >= 0.45 && // slightly lower for non-tutorial roles
            sv.ai_recommendation !== 'not_recommended' &&
            (channelCounts.get(sv.video.channelId) || 0) < 2
          )
          .sort((a, b) => b.match_score - a.match_score);

        if (roleVideos.length > 0) {
          portfolio.push(roleVideos[0]);
          channelCounts.set(roleVideos[0].video.channelId,
            (channelCounts.get(roleVideos[0].video.channelId) || 0) + 1);
          filledRoles.add(role.role);
        }
      }

      // Pass 2: Fill remaining slots with best remaining videos (any role)
      const remaining = filteredVideos
        .filter(sv =>
          !portfolio.includes(sv) &&
          sv.match_score >= 0.50 &&
          sv.ai_recommendation !== 'not_recommended' &&
          (channelCounts.get(sv.video.channelId) || 0) < 2
        )
        .sort((a, b) => b.match_score - a.match_score);

      for (const v of remaining) {
        if (portfolio.length >= 10) break;
        portfolio.push(v);
        channelCounts.set(v.video.channelId,
          (channelCounts.get(v.video.channelId) || 0) + 1);
      }

      viableCandidates = portfolio;
      finalCandidates = portfolio;
      console.log(`[PORTFOLIO] Selected ${portfolio.length} videos covering roles: ${[...filledRoles].join(', ')}`);
    } else {
      // Fallback: original linear selection (no content brief)
      viableCandidates = filteredVideos.filter((sv) => {
        if (sv.match_score < 0.50) return false;
        if (sv.ai_recommendation === 'not_recommended') return false;
        const count = channelCounts.get(sv.video.channelId) || 0;
        if (count >= 2) return false;
        channelCounts.set(sv.video.channelId, count + 1);
        return true;
      });
      finalCandidates = viableCandidates.slice(0, 10);
    }

    // =========================================================================
    // STEP 7: Save Content and Matches to Database
    // =========================================================================
    const savedMatches = [];
    for (const candidate of finalCandidates) {
      const { data: existingContent } = await supabaseClient
        .from("content")
        .select("id")
        .eq("source_id", candidate.video.id)
        .eq("source_type", "youtube")
        .maybeSingle();

      let contentId: string;
      if (existingContent) {
        contentId = existingContent.id;
      } else {
        const { data: newContent, error: contentError } = await supabaseClient
          .from("content")
          .insert({
            source_type: "youtube",
            source_id: candidate.video.id,
            source_url: `https://www.youtube.com/watch?v=${candidate.video.id}`,
            title: candidate.video.title,
            description: candidate.video.description,
            duration_seconds: candidate.video.duration,
            thumbnail_url: candidate.video.thumbnailUrl,
            channel_name: candidate.video.channelTitle,
            channel_id: candidate.video.channelId,
            view_count: candidate.video.viewCount,
            like_count: candidate.video.likeCount,
            quality_score: candidate.match_score,
            is_available: true,
            last_availability_check: new Date().toISOString(),
            created_by: user.id,
          })
          .select()
          .single();

        if (contentError || !newContent) {
          console.error("Error saving content:", contentError);
          continue;
        }
        contentId = newContent.id;
      }

      // Auto-approval: only when AI explicitly recommends highly
      const autoApprove = candidate.ai_recommendation === 'highly_recommended' && candidate.match_score >= 0.75;

      const { data: match, error: matchError } = await supabaseClient
        .from("content_matches")
        .upsert({
          learning_objective_id,
          content_id: contentId,
          teaching_unit_id: teaching_unit_id || null,
          match_score: candidate.match_score,
          duration_fit_score: candidate.pre_filter.duration_fit,
          semantic_similarity_score: null,
          engagement_quality_score: null,
          channel_authority_score: candidate.pre_filter.channel_authority,
          recency_score: null,
          ai_reasoning: candidate.ai_reasoning || null,
          ai_relevance_score: candidate.ai_relevance_score ?? null,
          ai_pedagogy_score: candidate.ai_pedagogy_score ?? null,
          ai_quality_score: candidate.ai_quality_score ?? null,
          ai_recommendation: candidate.ai_recommendation || null,
          ai_concern: candidate.ai_concern || null,
          content_role: candidate.content_role || null,
          status: autoApprove ? "auto_approved" : "pending",
          approved_by: autoApprove ? user.id : null,
          approved_at: autoApprove ? new Date().toISOString() : null,
        }, { onConflict: "learning_objective_id,content_id" })
        .select(`*, content:content_id(*)`)
        .single();

      if (matchError) {
        console.error("Error saving content match:", matchError);
      } else {
        savedMatches.push(match);
      }
    }

    console.log(`Saved ${savedMatches.length} content matches (${savedMatches.filter(m => m.status === "auto_approved").length} auto-approved)`);

    // =========================================================================
    // STEP 8: Cache results for future searches
    // =========================================================================
    if (finalCandidates.length > 0) {
      const cacheableResults = finalCandidates.map(candidate => ({
        id: candidate.video.id,
        title: candidate.video.title,
        description: candidate.video.description,
        url: `https://www.youtube.com/watch?v=${candidate.video.id}`,
        thumbnail_url: candidate.video.thumbnailUrl,
        duration: formatDuration(candidate.video.duration),
        channel_title: candidate.video.channelTitle,
        source: 'youtube' as const,
        view_count: candidate.video.viewCount,
      }));

      try {
        await saveToCache(searchConcept, cacheableResults, 'youtube');
        console.log(`Cached ${cacheableResults.length} results`);
      } catch (cacheError) {
        console.error('Cache save failed (non-blocking):', cacheError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        content_matches: savedMatches,
        total_found: allVideos.length,
        viable_candidates: viableCandidates.length,
        auto_approved_count: savedMatches.filter((m: any) => m.status === "auto_approved").length,
        ai_evaluation_used: use_ai_evaluation,
        query_intelligence_used: true,
        sources_searched: sources,
        cached: skipSearch,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    logError('search-youtube-content', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
