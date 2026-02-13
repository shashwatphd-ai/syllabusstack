import { createClient } from "@supabase/supabase-js";
import {
  checkCache,
  saveToCache,
  extractKeywords
} from "../_shared/content-cache.ts";
import { generateSearchQueries } from "../_shared/query-intelligence/index.ts";
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
 * Pipeline:
 * 1. Query Intelligence - Generate smart search queries from LO context
 * 2. Multi-Source Discovery - Firecrawl, Jina, Invidious, YouTube API (with fallbacks)
 * 3. Rule-Based Pre-Filter - Duration fit, keyword matching
 * 4. AI Batch Evaluation - Pedagogy, relevance, quality scoring
 * 5. Save & Auto-Approve - Strict criteria for instructor quality
 */

// Note: Search instances are now managed by the orchestrator in _shared/youtube-search/

interface InvidiousVideo {
  videoId: string;
  title: string;
  description: string;
  author: string;
  authorId: string;
  lengthSeconds: number;
  viewCount: number;
  published: number;
  videoThumbnails: Array<{ url: string; quality: string }>;
}

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
  scores: {
    duration_fit: number;
    semantic_similarity: number;
    engagement_quality: number;
    channel_authority: number;
    recency: number;
    ai_score?: number;
    total: number;
  };
  ai_reasoning?: string | null;
  ai_recommendation?: string | null;
  ai_concern?: string | null;
}

// Scoring weights with AI included
const WEIGHTS = {
  duration_fit: 0.15,
  semantic_similarity: 0.20,
  engagement_quality: 0.12,
  channel_authority: 0.08,
  recency: 0.05,
  ai_score: 0.40, // AI evaluation is the primary quality signal
};

// Weights for non-AI scoring (fallback)
const WEIGHTS_NO_AI = {
  duration_fit: 0.20,
  semantic_similarity: 0.35,
  engagement_quality: 0.20,
  channel_authority: 0.15,
  recency: 0.10,
};

// Note: searchInvidious and searchPiped are now handled by the orchestrator

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

function calculateDurationFitScore(actualSeconds: number, expectedMinutes: number): number {
  const expectedSeconds = expectedMinutes * 60;
  const ratio = Math.min(actualSeconds, expectedSeconds) / Math.max(actualSeconds, expectedSeconds);
  
  if (actualSeconds >= expectedSeconds * 0.7 && actualSeconds <= expectedSeconds * 1.5) {
    return 0.8 + (ratio * 0.2);
  }
  if (actualSeconds < expectedSeconds * 0.5) return ratio * 0.4;
  if (actualSeconds > expectedSeconds * 2) return ratio * 0.5;
  
  return ratio * 0.7;
}

function calculateEngagementScore(viewCount: number, likeCount: number): number {
  if (viewCount < 500) return 0.2;
  if (viewCount < 1000) return 0.3;
  
  const likeRatio = likeCount / viewCount;
  const viewScore = Math.min(Math.log10(viewCount) / 7, 1);
  
  return (likeRatio / 0.05 * 0.5 + viewScore * 0.5);
}

function calculateChannelAuthorityScore(channelTitle: string): number {
  const highAuthority = ["university", "professor", "mit", "stanford", "yale", "harvard", "khan academy", "coursera", "edx", "crash course", "ted-ed"];
  const mediumAuthority = ["academy", "edu", "college", "course", "learn", "tutorial", "school", "institute"];
  const lowerTitle = channelTitle.toLowerCase();
  
  for (const indicator of highAuthority) {
    if (lowerTitle.includes(indicator)) return 0.95;
  }
  for (const indicator of mediumAuthority) {
    if (lowerTitle.includes(indicator)) return 0.7;
  }
  return 0.4;
}

function calculateRecencyScore(publishedAt: string): number {
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const daysDiff = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Educational content ages gracefully - 1-3 years is often ideal
  if (daysDiff < 30) return 0.6;
  if (daysDiff <= 365) return 1.0;
  if (daysDiff <= 730) return 0.9;
  if (daysDiff <= 1095) return 0.75;
  if (daysDiff <= 1825) return 0.6;
  return 0.4;
}

/**
 * Domain indicators for validating video relevance
 */
const DOMAIN_INDICATORS: Record<string, string[]> = {
  business: ['company', 'market', 'strategy', 'management', 'competitive', 'industry', 'business', 'corporate', 'enterprise', 'profit', 'revenue', 'stakeholder', 'mba', 'case study'],
  education: ['curriculum', 'teaching', 'classroom', 'pedagogy', 'instruction', 'school', 'k-12', 'elementary', 'secondary'],
  technology: ['software', 'programming', 'code', 'algorithm', 'database', 'api', 'developer', 'tech', 'computer', 'digital'],
  healthcare: ['patient', 'clinical', 'medical', 'health', 'hospital', 'diagnosis', 'treatment', 'physician', 'nurse'],
  engineering: ['design', 'system', 'mechanical', 'electrical', 'civil', 'structural', 'circuit', 'manufacturing'],
  finance: ['investment', 'stock', 'portfolio', 'banking', 'financial', 'asset', 'risk', 'return', 'capital'],
  marketing: ['brand', 'consumer', 'advertising', 'campaign', 'customer', 'product', 'market research', 'promotion'],
  science: ['experiment', 'hypothesis', 'research', 'data', 'analysis', 'study', 'scientific', 'laboratory'],
  law: ['legal', 'court', 'attorney', 'litigation', 'contract', 'statute', 'regulation', 'compliance'],
};

/**
 * Detect domain from course/module context
 */
function detectDomain(courseTitle: string, moduleTitle?: string): string | null {
  const context = `${courseTitle} ${moduleTitle || ''}`.toLowerCase();
  
  for (const [domain, indicators] of Object.entries(DOMAIN_INDICATORS)) {
    const matchCount = indicators.filter(ind => context.includes(ind)).length;
    if (matchCount >= 2) return domain;
  }
  
  // Check for common course patterns
  if (context.includes('strategic') || context.includes('management') || context.includes('mba')) return 'business';
  if (context.includes('computer') || context.includes('software') || context.includes('programming')) return 'technology';
  if (context.includes('medical') || context.includes('health') || context.includes('nursing')) return 'healthcare';
  
  return null;
}

/**
 * Enhanced semantic similarity with domain validation
 * Phase 4: Adds domain mismatch penalty to reduce irrelevant matches
 */
function calculateSemanticSimilarity(
  videoText: string, 
  loText: string, 
  keywords: string[], 
  coreConcept: string,
  courseDomain?: string | null
): number {
  const videoLower = videoText.toLowerCase();
  const loLower = loText.toLowerCase();
  
  let score = 0;
  const maxScore = keywords.length + 5;
  
  // Keyword matching
  for (const keyword of keywords) {
    if (keyword && videoLower.includes(keyword.toLowerCase())) {
      score += 1;
    }
  }
  
  // Core concept matching (higher weight)
  const conceptWords = coreConcept?.toLowerCase().split(/\s+/) || [];
  for (const word of conceptWords) {
    if (word.length > 3 && videoLower.includes(word)) {
      score += 1.5;
    }
  }
  
  // LO word matching
  const loWords = loLower.split(/\s+/).filter(w => w.length > 4);
  const matchedWords = loWords.filter(word => videoLower.includes(word)).length;
  score += matchedWords * 0.3;
  
  let baseScore = Math.min(score / maxScore, 1.0);
  
  // PHASE 4: Domain validation penalty
  // If we know the course domain, check if video content matches that domain
  if (courseDomain && DOMAIN_INDICATORS[courseDomain]) {
    const expectedIndicators = DOMAIN_INDICATORS[courseDomain];
    const hasRelevantDomain = expectedIndicators.some(ind => videoLower.includes(ind));
    
    // Check for domain mismatch (video is clearly about a different domain)
    const otherDomainMatches: string[] = [];
    for (const [domain, indicators] of Object.entries(DOMAIN_INDICATORS)) {
      if (domain !== courseDomain) {
        const matchCount = indicators.filter(ind => videoLower.includes(ind)).length;
        if (matchCount >= 3) {
          otherDomainMatches.push(domain);
        }
      }
    }
    
    // Apply penalty if video doesn't match expected domain but matches another
    if (!hasRelevantDomain && otherDomainMatches.length > 0) {
      console.log(`[SEMANTIC] Domain mismatch detected: expected ${courseDomain}, found ${otherDomainMatches.join(',')}`);
      baseScore = Math.max(0, baseScore - 0.3); // Significant penalty for domain mismatch
    }
  }
  
  return baseScore;
}

function calculateTotalScore(scores: ScoredContent['scores'], hasAI: boolean): number {
  if (hasAI && scores.ai_score !== undefined) {
    return (
      scores.duration_fit * WEIGHTS.duration_fit +
      scores.semantic_similarity * WEIGHTS.semantic_similarity +
      scores.engagement_quality * WEIGHTS.engagement_quality +
      scores.channel_authority * WEIGHTS.channel_authority +
      scores.recency * WEIGHTS.recency +
      scores.ai_score * WEIGHTS.ai_score
    );
  }
  
  return (
    scores.duration_fit * WEIGHTS_NO_AI.duration_fit +
    scores.semantic_similarity * WEIGHTS_NO_AI.semantic_similarity +
    scores.engagement_quality * WEIGHTS_NO_AI.engagement_quality +
    scores.channel_authority * WEIGHTS_NO_AI.channel_authority +
    scores.recency * WEIGHTS_NO_AI.recency
  );
}

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
    // STEP 0.1: Fetch LO data from DB if not provided (CRITICAL for AI evaluation)
    // =========================================================================
    let effectiveLoText = lo_text;
    let effectiveCoreConcept = core_concept;
    let effectiveBloomLevel = bloom_level;
    let effectiveDomain = domain;
    let effectiveSearchKeywords = search_keywords;
    let effectiveDuration = expected_duration_minutes;
    let effectiveCourseId = instructor_course_id;

    if (!effectiveLoText) {
      console.log('[FALLBACK] lo_text not provided, fetching from database...');
      const { data: loData, error: loError } = await supabaseClient
        .from('learning_objectives')
        .select('text, core_concept, bloom_level, domain, search_keywords, expected_duration_minutes, instructor_course_id')
        .eq('id', learning_objective_id)
        .single();
      
      if (loError || !loData) {
        logError('search-youtube-content', new Error(`Failed to fetch LO data: ${loError?.message}`));
        return createErrorResponse('NOT_FOUND', corsHeaders, 'Learning objective not found');
      }
      
      effectiveLoText = loData.text;
      effectiveCoreConcept = effectiveCoreConcept || loData.core_concept;
      effectiveBloomLevel = effectiveBloomLevel || loData.bloom_level;
      effectiveDomain = effectiveDomain || loData.domain;
      effectiveSearchKeywords = effectiveSearchKeywords || loData.search_keywords;
      effectiveDuration = effectiveDuration || loData.expected_duration_minutes;
      effectiveCourseId = effectiveCourseId || loData.instructor_course_id;
      console.log(`[FALLBACK] Loaded LO: "${effectiveLoText?.substring(0, 50)}..."`);
    }

    console.log(`[UNIFIED SEARCH] LO: ${learning_objective_id}, Teaching Unit: ${teaching_unit_id || 'all'}, AI Eval: ${use_ai_evaluation}`);

    // =========================================================================
    // STEP 0.5: Check for Teaching Units (Curriculum Reasoning Agent)
    // If no teaching units exist, trigger decomposition first
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
      const { data: loData } = await supabaseClient
        .from('learning_objectives')
        .select('decomposition_status, curriculum_batch_job_id')
        .eq('id', learning_objective_id)
        .single();

      if (loData?.decomposition_status === 'in_progress' && loData?.curriculum_batch_job_id) {
        // Batch job is processing - inform caller to retry later
        console.log(`[TEACHING UNITS] Batch decomposition in progress for LO ${learning_objective_id}`);
        return new Response(
          JSON.stringify({
            success: false,
            retry_later: true,
            batch_job_id: loData.curriculum_batch_job_id,
            message: 'Teaching unit decomposition in progress, please retry in 30 seconds'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
        );
      }

      // No batch job or batch failed - use sync fallback
      const enableSyncFallback = Deno.env.get('ENABLE_SYNC_CURRICULUM_FALLBACK') !== 'false';

      if (enableSyncFallback) {
        console.log('[TEACHING UNITS] No units found, triggering sync curriculum decomposition...');

        try {
          const decomposeResponse = await fetch(`${supabaseUrl}/functions/v1/curriculum-reasoning-agent`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ learning_objective_id }),
          });

          if (decomposeResponse.ok) {
            const decomposeData = await decomposeResponse.json();
            if (decomposeData.success && decomposeData.teaching_units) {
              teachingUnits = decomposeData.teaching_units;
              console.log(`[TEACHING UNITS] Sync decomposition created ${teachingUnits.length} units`);
            }
          } else {
            console.log('[TEACHING UNITS] Sync decomposition failed, falling back to LO-level search');
          }
        } catch (decomposeError) {
          console.error('[TEACHING UNITS] Sync decomposition error:', decomposeError);
        }
      } else {
        console.log('[TEACHING UNITS] Sync fallback disabled, proceeding with LO-level search');
      }
    }

    // If searching for a specific teaching unit, filter to just that one
    if (teaching_unit_id) {
      teachingUnits = teachingUnits.filter((u: any) => u.id === teaching_unit_id);
      console.log(`[TEACHING UNITS] Filtering to specific unit: ${teaching_unit_id}`);
    }

    

    // =========================================================================
    // STEP 0: Get existing matches to avoid duplicates (CROSS-LO DEDUPLICATION)
    // Phase 1: Now checks ALL videos matched to ANY LO in this course, not just current LO
    // =========================================================================
    const existingVideoIds = new Set<string>();
    
    // First, get the instructor_course_id for this LO
    const { data: loForCourse } = await supabaseClient
      .from('learning_objectives')
      .select('instructor_course_id')
      .eq('id', learning_objective_id)
      .single();
    
    const courseIdForDedup = loForCourse?.instructor_course_id || instructor_course_id;
    
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
        // Fallback to current LO only
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
      // No course context, fall back to current LO only
      const { data: existingMatches } = await supabaseClient
        .from("content_matches")
        .select(`content:content_id(source_id)`)
        .eq("learning_objective_id", learning_objective_id);
      
      existingMatches?.forEach((m: any) => {
        if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
      });
    }

    // =========================================================================
    // STEP 1: Check cache (with course context for dynamic synonym matching)
    // =========================================================================
    const searchConcept = lo_text || core_concept || '';
    const cacheResult = await checkCache(searchConcept, 'youtube', instructor_course_id);

    if (cacheResult.found && cacheResult.results.length > 0) {
      console.log(`Cache HIT for: "${searchConcept.substring(0, 50)}..."`);
      
      const cachedVideos = cacheResult.results.filter((v: any) => !existingVideoIds.has(v.id));
      
      if (cachedVideos.length > 0) {
        const savedMatches = [];
        for (const video of cachedVideos.slice(0, 6)) {
          const { data: existingContent } = await supabaseClient
            .from("content")
            .select("id")
            .eq("source_id", video.id)
            .eq("source_type", video.source || "youtube")
            .maybeSingle();

          let contentId: string;
          if (existingContent) {
            contentId = existingContent.id;
          } else {
            // Parse duration from ISO 8601 format (e.g., "PT10M30S") to seconds
            const parseDurationToSeconds = (duration: string): number => {
              const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              if (!match) return 0;
              const hours = parseInt(match[1] || "0");
              const minutes = parseInt(match[2] || "0");
              const seconds = parseInt(match[3] || "0");
              return hours * 3600 + minutes * 60 + seconds;
            };

            const { data: newContent, error: contentError } = await supabaseClient
              .from("content")
              .insert({
                source_type: video.source || "youtube",
                source_id: video.id,
                source_url: video.url,
                title: video.title,
                description: video.description,
                duration_seconds: parseDurationToSeconds(video.duration || "PT0S"),
                thumbnail_url: video.thumbnail_url,
                channel_name: video.channel_title,
                quality_score: 0.7,
                is_available: true,
                last_availability_check: new Date().toISOString(),
                created_by: user.id,
              })
              .select()
              .single();

            if (contentError) {
              console.error("Error saving cached content:", contentError);
              continue;
            }
            contentId = newContent.id;
          }

          const { data: match, error: matchError } = await supabaseClient
            .from("content_matches")
            .insert({
              learning_objective_id,
              content_id: contentId,
              match_score: 0.7,
              ai_reasoning: `Cached result from ${cacheResult.source}`,
              status: "pending",
            })
            .select()
            .single();

          if (!matchError && match) {
            savedMatches.push(match);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            cache_source: cacheResult.source,
            content_matches: savedMatches,
            total_found: savedMatches.length,
            message: `Found ${savedMatches.length} cached results`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // =========================================================================
    // STEP 2: Query Intelligence - Generate smart search queries
    // Phase 3: Now includes AI-driven pre-search context generation
    // =========================================================================
    let moduleContext: { title: string; description?: string } | undefined;
    let courseContext: { title: string; description?: string; code?: string; detected_domain?: string } | undefined;

    // Note: LO data already fetched in STEP 0.1, use loData from there if available
    // Fetch module and course context for query intelligence
    const { data: loDataForContext } = await supabaseClient
      .from('learning_objectives')
      .select('module_id, instructor_course_id')
      .eq('id', learning_objective_id)
      .single();

    if (loDataForContext?.module_id) {
      const { data: module } = await supabaseClient
        .from('modules')
        .select('title, description')
        .eq('id', loDataForContext.module_id)
        .single();
      if (module) {
        moduleContext = { title: module.title, description: module.description };
      }
    }

    if (loDataForContext?.instructor_course_id || effectiveCourseId) {
      const { data: course } = await supabaseClient
        .from('instructor_courses')
        .select('title, description, code, detected_domain')
        .eq('id', loDataForContext?.instructor_course_id || effectiveCourseId)
        .single();
      if (course) {
        courseContext = { 
          title: course.title, 
          description: course.description, 
          code: course.code,
          detected_domain: course.detected_domain 
        };
      }
    }

    // Detect domain from course context for semantic scoring
    const detectedDomain = courseContext?.detected_domain || 
      detectDomain(courseContext?.title || '', moduleContext?.title);
    
    console.log(`[DOMAIN] Detected domain: ${detectedDomain || 'unknown'}`);

    let queries: string[] = [];
    
    // FIX: Use teaching unit's specific search_queries if available
    // This ensures the AI-generated queries from curriculum decomposition are actually used
    if (teaching_unit_id && teachingUnits.length > 0) {
      const targetUnit = teachingUnits.find((u: any) => u.id === teaching_unit_id);
      if (targetUnit?.search_queries && targetUnit.search_queries.length > 0) {
        queries = targetUnit.search_queries;
        console.log(`[TEACHING UNIT QUERIES] Using ${queries.length} pre-generated queries from teaching unit:`, queries.slice(0, 3));
      }
    }
    
    // Fallback to Query Intelligence if no teaching unit queries available
    if (queries.length === 0) {
      // Check if we have teaching unit context to use for better queries
      const targetUnit = teaching_unit_id ? teachingUnits.find((u: any) => u.id === teaching_unit_id) : teachingUnits[0];

      try {
        console.log('[QUERY INTELLIGENCE] Generating search queries...');

        // Enhanced: Use teaching unit context when available for better query generation
        const queryText = targetUnit?.what_to_teach || targetUnit?.title || effectiveLoText;
        const queryConcept = targetUnit?.title || effectiveCoreConcept;
        const queryKeywords = targetUnit?.required_concepts?.length > 0
          ? targetUnit.required_concepts
          : effectiveSearchKeywords || [];

        queries = await generateSearchQueries(
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
          moduleContext,
          courseContext
        );
        console.log(`[QUERY INTELLIGENCE] Generated ${queries.length} queries:`, queries.slice(0, 3));
      } catch (qiError) {
        console.error('[QUERY INTELLIGENCE] Failed, using fallback:', qiError);
        // Enhanced fallback: Use teaching unit context if available
        const concept = targetUnit?.title || targetUnit?.what_to_teach?.split(' ').slice(0, 6).join(' ') ||
          effectiveCoreConcept || effectiveLoText?.split(' ').slice(0, 5).join(' ') || 'topic';
        const videoType = targetUnit?.target_video_type || 'explainer';

        // Use required_concepts from teaching unit if available
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
    // STEP 3: Multi-Source Discovery (Orchestrated)
    // Uses Firecrawl, Jina, Invidious/Piped, and YouTube API with fallbacks
    // =========================================================================
    let allVideos: YouTubeVideo[] = [];
    let orchestratorSource = 'none';
    let orchestratorFallbacks: string[] = [];

    // Use the first query for the orchestrated search
    const primaryQuery = queries[0] || core_concept || lo_text || '';

    if (primaryQuery) {
      console.log(`[ORCHESTRATOR] Searching with query: "${primaryQuery.substring(0, 50)}..."`);

      try {
        const searchResult = await searchYouTubeOrchestrated({
          query: primaryQuery,
          max_results: 20,
          min_results: 3,
          allow_youtube_api: true,
          priority: 'normal',
          enrich_metadata: true,  // Re-enabled: needed to get proper titles
          timeout_ms: 20000,
        });

        orchestratorSource = searchResult.source;
        orchestratorFallbacks = searchResult.fallbacks_used;

        // Convert orchestrated results to YouTubeVideo format
        // Filter out already existing videos
        for (const result of searchResult.results) {
          if (!existingVideoIds.has(result.video_id)) {
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

        console.log(`[ORCHESTRATOR] Found ${allVideos.length} unique videos via ${orchestratorSource}`);
        if (orchestratorFallbacks.length > 0) {
          console.log(`[ORCHESTRATOR] Also used fallbacks: ${orchestratorFallbacks.join(', ')}`);
        }
        if (searchResult.debug) {
          console.log(`[ORCHESTRATOR] Debug info:`, JSON.stringify(searchResult.debug));
        }
      } catch (orchestratorError) {
        console.error('[ORCHESTRATOR] Search failed:', orchestratorError);
      }
    }

    console.log(`Found ${allVideos.length} unique videos from orchestrated sources`);

    // =========================================================================
    // STEP 4: Rule-Based Pre-Filter & Scoring
    // =========================================================================
    // Phase 4: Now uses detectedDomain for semantic scoring with domain validation
    let scoredVideos: ScoredContent[] = allVideos.map((video) => {
      const durationFit = calculateDurationFitScore(video.duration, expected_duration_minutes || 15);
      const semanticSimilarity = calculateSemanticSimilarity(
        `${video.title} ${video.description}`,
        lo_text || core_concept || '',
        search_keywords || [],
        core_concept || "",
        detectedDomain  // Phase 4: Pass domain for validation
      );
      const engagementQuality = calculateEngagementScore(video.viewCount, video.likeCount);
      const channelAuthority = calculateChannelAuthorityScore(video.channelTitle);
      const recency = calculateRecencyScore(video.publishedAt);

      const scores = {
        duration_fit: Math.round(durationFit * 100) / 100,
        semantic_similarity: Math.round(semanticSimilarity * 100) / 100,
        engagement_quality: Math.round(engagementQuality * 100) / 100,
        channel_authority: Math.round(channelAuthority * 100) / 100,
        recency: Math.round(recency * 100) / 100,
        total: 0,
      };
      scores.total = Math.round(calculateTotalScore(scores, false) * 100) / 100;

      return { video, scores };
    });

    // Pre-sort by semantic similarity + engagement for AI evaluation
    scoredVideos.sort((a, b) => 
      (b.scores.semantic_similarity + b.scores.engagement_quality) - 
      (a.scores.semantic_similarity + a.scores.engagement_quality)
    );

    // Take top candidates for AI evaluation (limit for cost/speed)
    const topCandidatesForAI = scoredVideos.slice(0, 15);

    // =========================================================================
    // STEP 5: AI Batch Evaluation (BATCH or SYNC mode)
    // =========================================================================
    const enableBatchEvaluation = !force_sync && Deno.env.get('ENABLE_BATCH_EVALUATION') !== 'false';

    if (enableBatchEvaluation && topCandidatesForAI.length > 0) {
      // BATCH MODE: Skip inline evaluation, save videos for batch processing
      console.log(`[BATCH MODE] Skipping inline evaluation for ${topCandidatesForAI.length} videos`);

      // Save content and create content_matches with pending_evaluation status
      const batchSavedMatches = [];
      for (const candidate of topCandidatesForAI) {
        // Upsert content record
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
              quality_score: candidate.scores.total,
              is_available: true,
              last_availability_check: new Date().toISOString(),
              created_by: user.id,
            })
            .select()
            .single();

          if (contentError || !newContent) {
            console.error("[BATCH MODE] Error saving content:", contentError);
            continue;
          }
          contentId = newContent.id;
        }

        // Insert content_match with pending_evaluation status
        const { data: match, error: matchError } = await supabaseClient
          .from("content_matches")
          .upsert({
            learning_objective_id,
            content_id: contentId,
            teaching_unit_id: teaching_unit_id || null,
            match_score: 0,  // Neutral score; will be set by batch evaluation
            duration_fit_score: candidate.scores.duration_fit,
            semantic_similarity_score: candidate.scores.semantic_similarity,
            engagement_quality_score: candidate.scores.engagement_quality,
            channel_authority_score: candidate.scores.channel_authority,
            recency_score: candidate.scores.recency,
            ai_relevance_score: null,
            ai_pedagogy_score: null,
            ai_quality_score: null,
            ai_reasoning: null,
            ai_recommendation: null,
            status: 'pending_evaluation',
          }, { onConflict: "learning_objective_id,content_id" })
          .select('id')
          .single();

        if (matchError) {
          console.error("[BATCH MODE] Error saving content match:", matchError);
        } else {
          batchSavedMatches.push(match);
        }
      }

      console.log(`[BATCH MODE] Created ${batchSavedMatches.length} pending evaluation records`);

      return new Response(
        JSON.stringify({
          success: true,
          batch_evaluation_pending: true,
          videos_discovered: batchSavedMatches.length,
          content_match_ids: batchSavedMatches.map(m => m.id),
          message: 'Videos discovered and queued for batch evaluation. Call submit-batch-evaluation after all LOs are processed.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SYNC MODE: Original inline evaluation (when batch mode is disabled)
    if (use_ai_evaluation && topCandidatesForAI.length > 0) {
      try {
        console.log(`[SYNC MODE] Calling AI evaluation for ${topCandidatesForAI.length} videos...`);

        const evalResponse = await fetch(`${supabaseUrl}/functions/v1/evaluate-content-batch`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            learning_objective: {
              id: learning_objective_id,
              text: effectiveLoText,  // Use effective value (DB fallback)
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
          }),
        });

        if (evalResponse.ok) {
          const evalData = await evalResponse.json();
          const aiEvaluations = new Map<string, any>(
            (evalData.evaluations || []).map((e: any) => [e.video_id, e])
          );

          // Apply AI scores to scored videos
          scoredVideos = scoredVideos.map(sv => {
            const aiEval = aiEvaluations.get(sv.video.id);
            if (aiEval) {
              const aiScore = (aiEval.total_score || 50) / 100;
              const newScores = {
                ...sv.scores,
                ai_score: Math.round(aiScore * 100) / 100,
                total: 0,
              };
              newScores.total = Math.round(calculateTotalScore(newScores, true) * 100) / 100;

              return {
                ...sv,
                scores: newScores,
                ai_reasoning: aiEval.reasoning as string,
                ai_recommendation: aiEval.recommendation as string,
                ai_concern: aiEval.concern as string | null,
              };
            }
            return sv;
          });

          console.log(`Applied AI evaluations to ${aiEvaluations.size} videos`);
        } else {
          console.error('AI evaluation failed, using rule-based scores only:', await evalResponse.text());
        }
      } catch (evalError) {
        console.error('Error in AI evaluation:', evalError);
      }
    }

    // Re-sort by total score after AI evaluation
    scoredVideos.sort((a, b) => b.scores.total - a.scores.total);

    // =========================================================================
    // STEP 6: Filter and Select Top Candidates
    // =========================================================================
    const channelCounts = new Map<string, number>();
    const viableCandidates = scoredVideos.filter((sv) => {
      // Minimum quality threshold
      if (sv.scores.total < 0.45) return false;
      // Never save videos that AI explicitly rejected
      if (sv.ai_recommendation === 'not_recommended') return false;
      // Limit per channel to ensure diversity
      const count = channelCounts.get(sv.video.channelId) || 0;
      if (count >= 2) return false;
      channelCounts.set(sv.video.channelId, count + 1);
      return true;
    });

    // Phase 2: Increased from 6 to 10 to give instructors more options
    const finalCandidates = viableCandidates.slice(0, 10);

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
            quality_score: candidate.scores.total,
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

      // Auto-approval criteria for instructors:
      // - AI highly recommends AND decent score, OR
      // - Very high score regardless of AI
      const isAIApproved = candidate.ai_recommendation === 'highly_recommended' && candidate.scores.total >= 0.55;
      const isScoreApproved = candidate.scores.total >= 0.75;
      const autoApprove = isAIApproved || isScoreApproved;

      const { data: match, error: matchError } = await supabaseClient
        .from("content_matches")
        .upsert({
          learning_objective_id,
          content_id: contentId,
          teaching_unit_id: teaching_unit_id || null, // CRITICAL: Link to teaching unit if provided
          match_score: candidate.scores.total,
          duration_fit_score: candidate.scores.duration_fit,
          semantic_similarity_score: candidate.scores.semantic_similarity,
          engagement_quality_score: candidate.scores.engagement_quality,
          channel_authority_score: candidate.scores.channel_authority,
          recency_score: candidate.scores.recency,
          ai_reasoning: candidate.ai_reasoning || null,
          ai_relevance_score: candidate.scores.ai_score ? candidate.scores.ai_score * 40 : null,
          ai_pedagogy_score: candidate.scores.ai_score ? candidate.scores.ai_score * 35 : null,
          ai_quality_score: candidate.scores.ai_score ? candidate.scores.ai_score * 25 : null,
          ai_recommendation: candidate.ai_recommendation || null,
          ai_concern: candidate.ai_concern || null,
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
    // STEP 8: Supplement with Khan Academy if needed
    // =========================================================================
    let khanMatches: any[] = [];
    const sourcesValue = sources ?? ['invidious', 'piped', 'khan_academy'];
    if (sourcesValue.includes('khan_academy') && savedMatches.length < 3) {
      console.log('Supplementing with Khan Academy...');
      try {
        const khanResponse = await fetch(`${supabaseUrl}/functions/v1/search-khan-academy`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            learning_objective_id,
            core_concept,
            search_keywords,
            lo_text,
            max_results: 3,
          }),
        });

        if (khanResponse.ok) {
          const khanData = await khanResponse.json();
          khanMatches = khanData.content_matches || [];
          console.log(`Khan Academy found ${khanMatches.length} additional videos`);
        }
      } catch (khanError) {
        console.error('Khan Academy supplement failed:', khanError);
      }
    }

    const allMatches = [...savedMatches, ...khanMatches];

    // =========================================================================
    // STEP 9: Cache results for future searches
    // =========================================================================
    if (finalCandidates.length > 0) {
      // Convert duration in seconds to ISO 8601 format for cache compatibility
      const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        let result = 'PT';
        if (hours > 0) result += `${hours}H`;
        if (minutes > 0) result += `${minutes}M`;
        if (secs > 0 || result === 'PT') result += `${secs}S`;
        return result;
      };

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
        content_matches: allMatches,
        total_found: allVideos.length,
        viable_candidates: viableCandidates.length,
        auto_approved_count: allMatches.filter((m: any) => m.status === "auto_approved").length,
        ai_evaluation_used: use_ai_evaluation,
        ai_context_used: false,  // Removed AI context generation for performance
        query_intelligence_used: queries.length > 0,
        detected_domain: detectedDomain,  // Phase 4: Report detected domain
        khan_academy_supplement: khanMatches.length,
        sources_searched: sources,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    logError('search-youtube-content', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
