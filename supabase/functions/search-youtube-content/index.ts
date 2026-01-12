import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import {
  checkCache,
  saveToCache,
  extractKeywords
} from "../_shared/content-cache.ts";
import { generateSearchQueries } from "../_shared/query-intelligence/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * UNIFIED EDUCATIONAL CONTENT SEARCH FOR INSTRUCTORS
 * 
 * This function provides high-quality content discovery for instructor courses.
 * It uses quota-free APIs (Invidious/Piped) for discovery and AI for evaluation.
 * 
 * Pipeline:
 * 1. Query Intelligence - Generate smart search queries from LO context
 * 2. Multi-Source Discovery - Invidious, Piped, Khan Academy (quota-free)
 * 3. Rule-Based Pre-Filter - Duration fit, keyword matching
 * 4. AI Batch Evaluation - Pedagogy, relevance, quality scoring
 * 5. Save & Auto-Approve - Strict criteria for instructor quality
 */

// Invidious instances (public YouTube API alternatives - NO QUOTA LIMITS)
// Updated Jan 2025 - verified working instances from api.invidious.io
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",        // 97.5% health, 31k users
  "https://invidious.nerdvpn.de",  // 100% uptime
  "https://yewtu.be",              // Long-standing reliable
  "https://invidious.f5.si",       // New Jan 2025
  "https://invidious.protokolla.fi", // Good backup
];

// Piped instances (another YouTube alternative - NO QUOTA LIMITS)
// Updated Jan 2025 - verified from TeamPiped uptime monitor
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",   // Official, most reliable
  "https://pipedapi.leptons.xyz",   // Passes health checks
  "https://pipedapi.adminforge.de", // Well-maintained German instance
  "https://api.piped.yt",           // Works
];

// Shuffle array to distribute load across instances
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

/**
 * Search YouTube using Invidious API (NO QUOTA LIMITS)
 * Falls back through multiple instances if one fails
 */
async function searchInvidious(query: string, maxResults: number = 20): Promise<YouTubeVideo[]> {
  // Shuffle instances to distribute load
  const instances = shuffleArray(INVIDIOUS_INSTANCES);
  
  for (const instance of instances) {
    try {
      const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`;
      const response = await fetch(searchUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000), // Increased timeout to 15s
      });

      if (!response.ok) {
        console.log(`Invidious instance ${instance} returned ${response.status}`);
        continue;
      }

      const data: InvidiousVideo[] = await response.json();
      const videos: YouTubeVideo[] = data.slice(0, maxResults).map(item => ({
        id: item.videoId,
        title: item.title,
        description: item.description || '',
        channelTitle: item.author,
        channelId: item.authorId,
        publishedAt: new Date(item.published * 1000).toISOString(),
        thumbnailUrl: item.videoThumbnails?.find(t => t.quality === 'medium')?.url ||
                      item.videoThumbnails?.[0]?.url || 
                      `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
        duration: item.lengthSeconds,
        viewCount: item.viewCount || 0,
        likeCount: 0,
      }));

      console.log(`Invidious (${instance}) found ${videos.length} videos`);
      return videos;
    } catch (error) {
      console.log(`Invidious instance ${instance} failed:`, error);
      continue;
    }
  }

  console.log('All Invidious instances failed');
  return [];
}

/**
 * Search YouTube using Piped API (NO QUOTA LIMITS)
 */
async function searchPiped(query: string, maxResults: number = 20): Promise<YouTubeVideo[]> {
  // Shuffle instances to distribute load
  const instances = shuffleArray(PIPED_INSTANCES);
  
  for (const instance of instances) {
    try {
      const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;
      const response = await fetch(searchUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000), // Increased timeout to 15s
      });

      if (!response.ok) {
        console.log(`Piped instance ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const items = data.items || [];

      const videos: YouTubeVideo[] = items.slice(0, maxResults).map((item: any) => {
        const videoId = item.url?.split('/watch?v=')[1] || item.url?.split('/').pop() || '';
        return {
          id: videoId,
          title: item.title || '',
          description: item.shortDescription || '',
          channelTitle: item.uploaderName || '',
          channelId: item.uploaderUrl?.split('/channel/')[1] || '',
          publishedAt: new Date(item.uploaded || Date.now()).toISOString(),
          thumbnailUrl: item.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          duration: item.duration || 0,
          viewCount: item.views || 0,
          likeCount: 0,
        };
      });

      console.log(`Piped (${instance}) found ${videos.length} videos`);
      return videos;
    } catch (error) {
      console.log(`Piped instance ${instance} failed:`, error);
      continue;
    }
  }

  console.log('All Piped instances failed');
  return [];
}

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

function calculateSemanticSimilarity(videoText: string, loText: string, keywords: string[], coreConcept: string): number {
  const videoLower = videoText.toLowerCase();
  const loLower = loText.toLowerCase();
  
  let score = 0;
  const maxScore = keywords.length + 5;
  
  for (const keyword of keywords) {
    if (keyword && videoLower.includes(keyword.toLowerCase())) {
      score += 1;
    }
  }
  
  const conceptWords = coreConcept?.toLowerCase().split(/\s+/) || [];
  for (const word of conceptWords) {
    if (word.length > 3 && videoLower.includes(word)) {
      score += 1.5;
    }
  }
  
  const loWords = loLower.split(/\s+/).filter(w => w.length > 4);
  const matchedWords = loWords.filter(word => videoLower.includes(word)).length;
  score += matchedWords * 0.3;
  
  return Math.min(score / maxScore, 1.0);
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { 
      learning_objective_id, 
      core_concept, 
      bloom_level, 
      domain, 
      search_keywords, 
      expected_duration_minutes, 
      lo_text, 
      instructor_course_id,
      use_ai_evaluation = true,
      sources = ['invidious', 'piped', 'khan_academy']
    } = await req.json();
    
    if (!learning_objective_id) {
      throw new Error("learning_objective_id is required");
    }

    console.log(`[UNIFIED SEARCH] LO: ${learning_objective_id}, AI Eval: ${use_ai_evaluation}, Sources: ${sources.join(',')}`);

    // =========================================================================
    // STEP 0: Get existing matches to avoid duplicates
    // =========================================================================
    const existingVideoIds = new Set<string>();
    const { data: existingMatches } = await supabaseClient
      .from("content_matches")
      .select(`content:content_id(source_id)`)
      .eq("learning_objective_id", learning_objective_id);

    existingMatches?.forEach((m: any) => {
      if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
    });

    // =========================================================================
    // STEP 1: Check cache
    // =========================================================================
    const searchConcept = lo_text || core_concept || '';
    const cacheResult = await checkCache(searchConcept, 'youtube');

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
    // =========================================================================
    let moduleContext: { title: string; description?: string } | undefined;
    let courseContext: { title: string; description?: string; code?: string } | undefined;

    const { data: loData } = await supabaseClient
      .from('learning_objectives')
      .select('module_id, instructor_course_id')
      .eq('id', learning_objective_id)
      .single();

    if (loData?.module_id) {
      const { data: module } = await supabaseClient
        .from('modules')
        .select('title, description')
        .eq('id', loData.module_id)
        .single();
      if (module) {
        moduleContext = { title: module.title, description: module.description };
      }
    }

    if (loData?.instructor_course_id || instructor_course_id) {
      const { data: course } = await supabaseClient
        .from('instructor_courses')
        .select('title, description, code')
        .eq('id', loData?.instructor_course_id || instructor_course_id)
        .single();
      if (course) {
        courseContext = { title: course.title, description: course.description, code: course.code };
      }
    }

    let queries: string[] = [];
    try {
      console.log('Generating intelligent search queries...');
      queries = await generateSearchQueries(
        {
          id: learning_objective_id,
          text: lo_text || core_concept || '',
          core_concept: core_concept || '',
          action_verb: search_keywords?.[0],
          bloom_level: bloom_level || 'understand',
          domain: domain || 'other',
          specificity: 'intermediate',
          search_keywords: search_keywords || [],
          expected_duration_minutes: expected_duration_minutes || 15,
        },
        moduleContext,
        courseContext
      );
      console.log(`Query Intelligence generated ${queries.length} queries:`, queries.slice(0, 3));
    } catch (qiError) {
      console.error('Query Intelligence failed, using fallback:', qiError);
      // Fallback to basic queries
      queries = [
        `${core_concept} explained tutorial`,
        `${core_concept} lecture educational`,
        `${core_concept} course introduction`,
      ];
    }

    // =========================================================================
    // STEP 3: Multi-Source Discovery (Quota-Free)
    // =========================================================================
    let allVideos: YouTubeVideo[] = [];
    const seenVideoIds = new Set<string>();

    // Execute searches across all queries
    for (const query of queries.slice(0, 4)) {
      // Try Invidious first
      if (sources.includes('invidious')) {
        const invidiousVideos = await searchInvidious(query, 15);
        for (const video of invidiousVideos) {
          if (!seenVideoIds.has(video.id) && !existingVideoIds.has(video.id)) {
            seenVideoIds.add(video.id);
            allVideos.push(video);
          }
        }
      }

      // Try Piped if we need more
      if (sources.includes('piped') && allVideos.length < 20) {
        const pipedVideos = await searchPiped(query, 15);
        for (const video of pipedVideos) {
          if (!seenVideoIds.has(video.id) && !existingVideoIds.has(video.id)) {
            seenVideoIds.add(video.id);
            allVideos.push(video);
          }
        }
      }

      // Early exit if we have enough
      if (allVideos.length >= 30) break;
    }

    console.log(`Found ${allVideos.length} unique videos from quota-free sources`);

    // =========================================================================
    // STEP 4: Rule-Based Pre-Filter & Scoring
    // =========================================================================
    let scoredVideos: ScoredContent[] = allVideos.map((video) => {
      const durationFit = calculateDurationFitScore(video.duration, expected_duration_minutes || 15);
      const semanticSimilarity = calculateSemanticSimilarity(
        `${video.title} ${video.description}`,
        lo_text || core_concept || '',
        search_keywords || [],
        core_concept || ""
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
    // STEP 5: AI Batch Evaluation
    // =========================================================================
    if (use_ai_evaluation && topCandidatesForAI.length > 0) {
      try {
        console.log(`Calling AI evaluation for ${topCandidatesForAI.length} videos...`);
        
        const evalResponse = await fetch(`${supabaseUrl}/functions/v1/evaluate-content-batch`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            learning_objective: {
              id: learning_objective_id,
              text: lo_text,
              bloom_level,
              core_concept,
              action_verb: search_keywords?.[0] || '',
              expected_duration_minutes,
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

    const finalCandidates = viableCandidates.slice(0, 6);

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
    if (sources.includes('khan_academy') && savedMatches.length < 3) {
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
        query_intelligence_used: queries.length > 0,
        khan_academy_supplement: khanMatches.length,
        sources_searched: sources,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in search-youtube-content:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
