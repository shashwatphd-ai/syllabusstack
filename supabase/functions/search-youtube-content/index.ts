import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import {
  checkCache,
  saveToCache,
  checkYouTubeQuota,
  trackApiUsage,
  extractKeywords
} from "../_shared/content-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Invidious instances (public YouTube API alternatives - NO QUOTA LIMITS)
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://invidious.private.coffee",
  "https://vid.puffyan.us",
  "https://invidious.projectsegfau.lt",
];

// Piped instances (another YouTube alternative - NO QUOTA LIMITS)
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.tokhmi.xyz",
  "https://api.piped.yt",
];

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

/**
 * Search YouTube using Invidious API (NO QUOTA LIMITS)
 * Falls back through multiple instances if one fails
 */
async function searchInvidious(query: string, maxResults: number = 15): Promise<YouTubeVideo[]> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`;
      const response = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000), // 10s timeout
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
                      item.videoThumbnails?.[0]?.url || '',
        duration: item.lengthSeconds,
        viewCount: item.viewCount || 0,
        likeCount: 0, // Invidious doesn't provide likes
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
async function searchPiped(query: string, maxResults: number = 15): Promise<YouTubeVideo[]> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;
      const response = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.log(`Piped instance ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const items = data.items || [];

      const videos: YouTubeVideo[] = items.slice(0, maxResults).map((item: any) => {
        // Extract video ID from URL
        const videoId = item.url?.split('/watch?v=')[1] || item.url?.split('/').pop() || '';
        return {
          id: videoId,
          title: item.title || '',
          description: item.shortDescription || '',
          channelTitle: item.uploaderName || '',
          channelId: item.uploaderUrl?.split('/channel/')[1] || '',
          publishedAt: new Date(item.uploaded || Date.now()).toISOString(),
          thumbnailUrl: item.thumbnail || '',
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

// Fallback action mapping for Bloom's taxonomy levels (used if AI strategy fails)
const ACTION_MAP: Record<string, string[]> = {
  remember: ["introduction to", "basics of", "what is", "overview"],
  understand: ["explained", "understanding", "how does", "concepts"],
  apply: ["how to", "tutorial", "practical", "implementation"],
  analyze: ["analysis of", "deep dive", "breakdown", "comparison"],
  evaluate: ["comparing", "review", "assessment", "evaluation"],
  create: ["tutorial", "building", "creating", "developing"],
};

// Domain-specific modifiers for better search results
const DOMAIN_MODIFIERS: Record<string, string[]> = {
  business: ["MBA", "business school", "management", "case study"],
  science: ["lecture", "university", "academic", "research"],
  humanities: ["lecture", "analysis", "history", "philosophy"],
  technical: ["tutorial", "programming", "engineering", "tech"],
  arts: ["creative", "design", "visual", "artistic"],
  other: ["educational", "lecture", "course"],
};

// Scoring weights
const WEIGHTS = {
  duration_fit: 0.15,
  semantic_similarity: 0.25,
  engagement_quality: 0.15,
  channel_authority: 0.10,
  recency: 0.05,
  ai_score: 0.30, // New: AI evaluation weight
};

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

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

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
  const highAuthority = ["university", "professor", "mit", "stanford", "yale", "harvard", "khan academy", "coursera", "edx"];
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!YOUTUBE_API_KEY) {
      throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

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
      use_ai_strategy = true,
      use_ai_evaluation = true 
    } = await req.json();
    
    if (!learning_objective_id) {
      throw new Error("learning_objective_id is required");
    }

    console.log(`Searching YouTube content for LO: ${learning_objective_id} (AI Strategy: ${use_ai_strategy}, AI Eval: ${use_ai_evaluation})`);

    // Get existing content IDs to avoid duplicates
    const existingVideoIds = new Set<string>();
    const { data: existingMatches } = await supabaseClient
      .from("content_matches")
      .select(`content:content_id(source_id)`)
      .eq("learning_objective_id", learning_objective_id);

    existingMatches?.forEach((m: any) => {
      if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
    });

    // Step 0: Check cache before making YouTube API calls
    const searchConcept = lo_text || core_concept || '';
    const cacheResult = await checkCache(searchConcept, 'youtube');

    if (cacheResult.found && cacheResult.results.length > 0) {
      console.log(`Cache HIT for: "${searchConcept.substring(0, 50)}..." (source: ${cacheResult.source})`);

      // Use cached results - filter out already matched videos and save to database
      const cachedVideos = cacheResult.results.filter((v: any) => !existingVideoIds.has(v.id));

      if (cachedVideos.length > 0) {
        // Save cached content to database
        const savedMatches = [];
        for (const video of cachedVideos.slice(0, 6)) {
          let contentId: string;
          const { data: existingContent } = await supabaseClient
            .from("content")
            .select("id")
            .eq("source_id", video.id)
            .eq("source_type", video.source || "youtube")
            .maybeSingle();

          if (existingContent) {
            contentId = existingContent.id;
          } else {
            const { data: newContent, error: contentError } = await supabaseClient
              .from("content")
              .insert({
                source_type: video.source || "youtube",
                source_id: video.id,
                source_url: video.url,
                title: video.title,
                description: video.description,
                duration_seconds: parseDuration(video.duration || "PT0S"),
                thumbnail_url: video.thumbnail_url,
                channel_name: video.channel_title,
                quality_score: 0.7, // Default score for cached content
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

          // Create content match
          const { data: match, error: matchError } = await supabaseClient
            .from("content_matches")
            .insert({
              learning_objective_id,
              content_id: contentId,
              match_score: 0.7,
              status: "pending",
              created_by: user.id,
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
            matches_found: savedMatches.length,
            message: `Found ${savedMatches.length} cached results for this learning objective`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check YouTube quota before proceeding
    const quotaStatus = await checkYouTubeQuota();
    const useAlternativeAPIs = !quotaStatus.canSearch || quotaStatus.remaining < 500;

    if (useAlternativeAPIs) {
      console.warn(`YouTube quota low/exhausted: ${quotaStatus.usedToday}/${10000} units - using Invidious/Piped/Khan Academy`);

      // Try Invidious first (quota-free YouTube alternative)
      const searchQuery = `${core_concept} ${(search_keywords || []).slice(0, 2).join(' ')} educational`.trim();
      let altVideos = await searchInvidious(searchQuery, 15);

      // If Invidious fails, try Piped
      if (altVideos.length === 0) {
        console.log('Invidious failed, trying Piped...');
        altVideos = await searchPiped(searchQuery, 15);
      }

      // If we got results from alternative APIs, process them
      if (altVideos.length > 0) {
        console.log(`Alternative API found ${altVideos.length} videos`);

        // Score and filter the videos
        const scoredVideos: ScoredContent[] = altVideos
          .filter(v => !existingVideoIds.has(v.id))
          .map(video => {
            const durationFit = calculateDurationFitScore(video.duration, expected_duration_minutes || 15);
            const semanticSimilarity = calculateSemanticSimilarity(
              `${video.title} ${video.description}`,
              lo_text || core_concept,
              search_keywords || [],
              core_concept || ""
            );
            const engagementQuality = calculateEngagementScore(video.viewCount, video.likeCount);
            const channelAuthority = calculateChannelAuthorityScore(video.channelTitle);
            const recency = calculateRecencyScore(video.publishedAt);
            const total = durationFit * 0.20 + semanticSimilarity * 0.35 + engagementQuality * 0.20 + channelAuthority * 0.15 + recency * 0.10;

            return {
              video,
              scores: {
                duration_fit: Math.round(durationFit * 100) / 100,
                semantic_similarity: Math.round(semanticSimilarity * 100) / 100,
                engagement_quality: Math.round(engagementQuality * 100) / 100,
                channel_authority: Math.round(channelAuthority * 100) / 100,
                recency: Math.round(recency * 100) / 100,
                total: Math.round(total * 100) / 100,
              },
            };
          });

        scoredVideos.sort((a, b) => b.scores.total - a.scores.total);
        const topCandidates = scoredVideos.filter(sv => sv.scores.total >= 0.40).slice(0, 6);

        // Save to database
        const savedMatches = [];
        for (const candidate of topCandidates) {
          let contentId: string;
          const { data: existingContent } = await supabaseClient
            .from("content")
            .select("id")
            .eq("source_id", candidate.video.id)
            .eq("source_type", "youtube")
            .maybeSingle();

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
                quality_score: candidate.scores.total,
                is_available: true,
                last_availability_check: new Date().toISOString(),
                created_by: user.id,
              })
              .select()
              .single();

            if (contentError) {
              console.error("Error saving content:", contentError);
              continue;
            }
            contentId = newContent.id;
          }

          const autoApprove = candidate.scores.total >= 0.60;
          const { data: match, error: matchError } = await supabaseClient
            .from("content_matches")
            .upsert({
              learning_objective_id,
              content_id: contentId,
              match_score: candidate.scores.total,
              semantic_similarity_score: candidate.scores.semantic_similarity,
              channel_authority_score: candidate.scores.channel_authority,
              ai_reasoning: "Found via Invidious/Piped (quota-free search)",
              status: autoApprove ? "auto_approved" : "pending",
              approved_by: autoApprove ? user.id : null,
              approved_at: autoApprove ? new Date().toISOString() : null,
            }, { onConflict: "learning_objective_id,content_id" })
            .select(`*, content:content_id(*)`)
            .single();

          if (!matchError && match) {
            savedMatches.push(match);
          }
        }

        // Also get Khan Academy results to supplement
        let khanMatches: any[] = [];
        try {
          const khanResponse = await fetch(`${supabaseUrl}/functions/v1/search-khan-academy`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ learning_objective_id, core_concept, search_keywords, lo_text, max_results: 3 }),
          });
          if (khanResponse.ok) {
            const khanData = await khanResponse.json();
            khanMatches = khanData.content_matches || [];
          }
        } catch (e) {
          console.log('Khan Academy supplement failed:', e);
        }

        const allMatches = [...savedMatches, ...khanMatches];
        return new Response(
          JSON.stringify({
            success: true,
            content_matches: allMatches,
            total_found: altVideos.length,
            auto_approved_count: allMatches.filter((m) => m.status === "auto_approved").length,
            youtube_quota_exhausted: true,
            fallback_source: 'invidious_piped',
            khan_academy_results: khanMatches.length,
            message: "YouTube quota exhausted. Using Invidious/Piped + Khan Academy."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If alternative APIs also failed, try Khan Academy only
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
            max_results: 6,
          }),
        });

        if (khanResponse.ok) {
          const khanData = await khanResponse.json();
          return new Response(
            JSON.stringify({
              success: true,
              content_matches: khanData.content_matches || [],
              total_found: khanData.total_found || 0,
              auto_approved_count: khanData.auto_approved_count || 0,
              youtube_quota_exhausted: true,
              fallback_source: 'khan_academy',
              cached: khanData.cached || false,
              message: "YouTube quota exhausted. Using Khan Academy as primary source."
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (khanError) {
        console.error('Khan Academy fallback also failed:', khanError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "All content sources unavailable",
          quota_status: quotaStatus,
          message: "YouTube quota exhausted and alternative sources failed. Try again later."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    console.log(`Cache MISS for: "${searchConcept.substring(0, 50)}..." - proceeding with YouTube search`);
    console.log(`YouTube quota remaining: ${quotaStatus.remaining} units`);

    // Step 1: Get AI-generated search strategies or fallback to rule-based
    let queries: string[] = [];
    
    if (use_ai_strategy) {
      try {
        // Call generate-content-strategy function
        const strategyResponse = await fetch(`${supabaseUrl}/functions/v1/generate-content-strategy`, {
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
              domain,
              action_verb: search_keywords?.[0] || '',
              search_keywords,
              expected_duration_minutes,
            }
          }),
        });

        if (strategyResponse.ok) {
          const strategyData = await strategyResponse.json();
          if (strategyData.strategies?.length) {
            queries = strategyData.strategies
              .sort((a: any, b: any) => a.priority - b.priority)
              .slice(0, 6)
              .map((s: any) => s.query);
            console.log('Using AI-generated search strategies:', queries);
          }
        } else {
          console.error('AI strategy generation failed, using fallback');
        }
      } catch (strategyError) {
        console.error('Error calling AI strategy:', strategyError);
      }
    }
    
    // Fallback to rule-based queries
    if (queries.length === 0) {
      const actionModifiers = ACTION_MAP[bloom_level] || ACTION_MAP.understand;
      const domainModifiers = DOMAIN_MODIFIERS[domain] || DOMAIN_MODIFIERS.other;
      
      queries = [
        `${core_concept} ${actionModifiers[0]} ${domainModifiers[0]}`,
        `${core_concept} ${domain} lecture`,
        `${core_concept} tutorial explained`,
        ...(search_keywords?.slice(0, 3).map((kw: string) => `${kw} ${domain} explained`) || []),
        `${core_concept} course`,
        `${core_concept} education`,
      ].slice(0, 6);
      console.log('Using fallback search queries:', queries);
    }

    // Step 2: Execute YouTube searches
    const allVideos: YouTubeVideo[] = [];
    const seenVideoIds = new Set<string>();

    for (const query of queries) {
      try {
        const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
        searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
        searchUrl.searchParams.set("q", query);
        searchUrl.searchParams.set("part", "snippet");
        searchUrl.searchParams.set("type", "video");
        searchUrl.searchParams.set("videoDuration", "medium");
        searchUrl.searchParams.set("videoEmbeddable", "true");
        searchUrl.searchParams.set("videoSyndicated", "true");
        searchUrl.searchParams.set("safeSearch", "strict");
        searchUrl.searchParams.set("maxResults", "15");

        const searchResponse = await fetch(searchUrl.toString());
        if (!searchResponse.ok) {
          console.error(`YouTube search error for query "${query}":`, await searchResponse.text());
          continue;
        }

        const searchData = await searchResponse.json();
        const videoIds = searchData.items
          ?.map((item: any) => item.id?.videoId)
          .filter((id: string) => id && !seenVideoIds.has(id) && !existingVideoIds.has(id)) || [];

        if (videoIds.length === 0) continue;

        videoIds.forEach((id: string) => seenVideoIds.add(id));

        const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);
        detailsUrl.searchParams.set("id", videoIds.join(","));
        detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");

        const detailsResponse = await fetch(detailsUrl.toString());
        if (!detailsResponse.ok) {
          console.error("YouTube details error:", await detailsResponse.text());
          continue;
        }

        const detailsData = await detailsResponse.json();

        for (const item of detailsData.items || []) {
          allVideos.push({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            channelTitle: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            publishedAt: item.snippet.publishedAt,
            thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            duration: parseDuration(item.contentDetails?.duration || ""),
            viewCount: parseInt(item.statistics?.viewCount || "0"),
            likeCount: parseInt(item.statistics?.likeCount || "0"),
          });
        }
      } catch (queryError) {
        console.error(`Error processing query "${query}":`, queryError);
      }
    }

    console.log(`Found ${allVideos.length} unique videos across ${queries.length} queries`);

    // Step 3: Initial scoring (rule-based)
    let scoredVideos: ScoredContent[] = allVideos.map((video) => {
      const durationFit = calculateDurationFitScore(video.duration, expected_duration_minutes || 15);
      const semanticSimilarity = calculateSemanticSimilarity(
        `${video.title} ${video.description}`,
        lo_text || core_concept,
        search_keywords || [],
        core_concept || ""
      );
      const engagementQuality = calculateEngagementScore(video.viewCount, video.likeCount);
      const channelAuthority = calculateChannelAuthorityScore(video.channelTitle);
      const recency = calculateRecencyScore(video.publishedAt);

      // Without AI, use standard weights
      const total = use_ai_evaluation 
        ? 0 // Will be recalculated after AI evaluation
        : (durationFit * 0.20 + semanticSimilarity * 0.35 + engagementQuality * 0.20 + channelAuthority * 0.15 + recency * 0.10);

      return {
        video,
        scores: {
          duration_fit: Math.round(durationFit * 100) / 100,
          semantic_similarity: Math.round(semanticSimilarity * 100) / 100,
          engagement_quality: Math.round(engagementQuality * 100) / 100,
          channel_authority: Math.round(channelAuthority * 100) / 100,
          recency: Math.round(recency * 100) / 100,
          total: Math.round(total * 100) / 100,
        },
      };
    });

    // Pre-sort for AI evaluation (top candidates)
    scoredVideos.sort((a, b) => 
      (b.scores.semantic_similarity + b.scores.engagement_quality) - 
      (a.scores.semantic_similarity + a.scores.engagement_quality)
    );

    // Step 4: AI evaluation for top candidates
    if (use_ai_evaluation && scoredVideos.length > 0) {
      try {
        const topCandidates = scoredVideos.slice(0, 15);
        
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
            videos: topCandidates.map(sv => ({
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

          // Apply AI scores
          scoredVideos = scoredVideos.map(sv => {
            const aiEval = aiEvaluations.get(sv.video.id) as any;
            if (aiEval) {
              const aiScore = (aiEval.total_score || 50) / 100;
              const total = 
                sv.scores.duration_fit * WEIGHTS.duration_fit +
                sv.scores.semantic_similarity * WEIGHTS.semantic_similarity +
                sv.scores.engagement_quality * WEIGHTS.engagement_quality +
                sv.scores.channel_authority * WEIGHTS.channel_authority +
                sv.scores.recency * WEIGHTS.recency +
                aiScore * WEIGHTS.ai_score;

              return {
                ...sv,
                scores: {
                  ...sv.scores,
                  ai_score: Math.round(aiScore * 100) / 100,
                  total: Math.round(total * 100) / 100,
                },
                ai_reasoning: aiEval.reasoning as string,
                ai_recommendation: aiEval.recommendation as string,
                ai_concern: aiEval.concern as string | null,
              };
            }
            // For non-evaluated videos, calculate without AI score
            const total = 
              sv.scores.duration_fit * 0.20 +
              sv.scores.semantic_similarity * 0.35 +
              sv.scores.engagement_quality * 0.20 +
              sv.scores.channel_authority * 0.15 +
              sv.scores.recency * 0.10;
            return {
              ...sv,
              scores: {
                ...sv.scores,
                total: Math.round(total * 100) / 100,
              }
            };
          });

          console.log('Applied AI evaluations to', aiEvaluations.size, 'videos');
        } else {
          console.error('AI evaluation failed, using rule-based scores only');
          // Recalculate totals without AI
          scoredVideos = scoredVideos.map(sv => ({
            ...sv,
            scores: {
              ...sv.scores,
              total: Math.round((
                sv.scores.duration_fit * 0.20 +
                sv.scores.semantic_similarity * 0.35 +
                sv.scores.engagement_quality * 0.20 +
                sv.scores.channel_authority * 0.15 +
                sv.scores.recency * 0.10
              ) * 100) / 100,
            }
          }));
        }
      } catch (evalError) {
        console.error('Error in AI evaluation:', evalError);
        // Recalculate totals without AI
        scoredVideos = scoredVideos.map(sv => ({
          ...sv,
          scores: {
            ...sv.scores,
            total: Math.round((
              sv.scores.duration_fit * 0.20 +
              sv.scores.semantic_similarity * 0.35 +
              sv.scores.engagement_quality * 0.20 +
              sv.scores.channel_authority * 0.15 +
              sv.scores.recency * 0.10
            ) * 100) / 100,
          }
        }));
      }
    }

    // Sort by total score
    scoredVideos.sort((a, b) => b.scores.total - a.scores.total);

    // Filter and deduplicate by channel (max 2 per channel)
    // Phase 3: Raised minimum threshold from 0.30 to 0.45, filter AI-rejected
    const channelCounts = new Map<string, number>();
    const viableCandidates = scoredVideos.filter((sv) => {
      // Minimum quality threshold - raised from 0.30 to 0.45
      if (sv.scores.total < 0.45) return false;
      // Never save videos that AI explicitly rejected
      if (sv.ai_recommendation === 'not_recommended') return false;
      const count = channelCounts.get(sv.video.channelId) || 0;
      if (count >= 2) return false;
      channelCounts.set(sv.video.channelId, count + 1);
      return true;
    });
    
    // Reduced from 12 to 6 to reduce clutter
    const topCandidates = viableCandidates.slice(0, 6);

    // Step 5: Save content and matches to database
    const savedMatches = [];
    for (const candidate of topCandidates) {
      let contentId: string;
      const { data: existingContent } = await supabaseClient
        .from("content")
        .select("id")
        .eq("source_id", candidate.video.id)
        .eq("source_type", "youtube")
        .maybeSingle();

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
            like_ratio: candidate.video.viewCount > 0 ? candidate.video.likeCount / candidate.video.viewCount : 0,
            published_at: candidate.video.publishedAt,
            quality_score: candidate.scores.total,
            is_available: true,
            last_availability_check: new Date().toISOString(),
            created_by: user.id,
          })
          .select()
          .single();

        if (contentError) {
          console.error("Error saving content:", contentError);
          continue;
        }
        contentId = newContent.id;
      }

      // Phase 3: Stricter auto-approval criteria
      // Require BOTH decent score AND good AI recommendation, OR very high score
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
        .select(`
          *,
          content:content_id(*)
        `)
        .single();

      if (matchError) {
        console.error("Error saving content match:", matchError);
      } else {
        savedMatches.push(match);
      }
    }

    console.log(`Saved ${savedMatches.length} content matches (${savedMatches.filter(m => m.status === "auto_approved").length} auto-approved)`);

    // FALLBACK: If YouTube returned too few results, try Khan Academy
    let khanMatches: any[] = [];
    const needsFallback = savedMatches.length < 2 || allVideos.length === 0;
    
    if (needsFallback) {
      console.log('YouTube returned few results, trying Khan Academy fallback...');
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
          console.log(`Khan Academy fallback found ${khanMatches.length} additional videos`);
        } else {
          console.log('Khan Academy fallback failed:', await khanResponse.text());
        }
      } catch (khanError) {
        console.error('Error in Khan Academy fallback:', khanError);
      }
    }

    const allMatches = [...savedMatches, ...khanMatches];

    // Save YouTube results to cache for future searches
    if (topCandidates.length > 0) {
      const cacheableResults = topCandidates.map(candidate => ({
        id: candidate.video.id,
        title: candidate.video.title,
        description: candidate.video.description,
        url: `https://www.youtube.com/watch?v=${candidate.video.id}`,
        thumbnail_url: candidate.video.thumbnailUrl,
        duration: `PT${Math.floor(candidate.video.duration / 60)}M${candidate.video.duration % 60}S`,
        channel_title: candidate.video.channelTitle,
        source: 'youtube' as const,
        view_count: candidate.video.viewCount,
        quality_score: candidate.scores.total,
      }));

      try {
        await saveToCache(searchConcept, cacheableResults, 'youtube');
        console.log(`Cached ${cacheableResults.length} YouTube results for: "${searchConcept.substring(0, 50)}..."`);
      } catch (cacheError) {
        console.error('Error saving to cache:', cacheError);
        // Non-blocking - continue even if cache save fails
      }
    }

    // Track YouTube API quota usage (100 units per search query)
    const queriesUsed = queries.length;
    try {
      await trackApiUsage('youtube', queriesUsed * 100);
      console.log(`Tracked YouTube API usage: ${queriesUsed * 100} units`);
    } catch (quotaError) {
      console.error('Error tracking quota:', quotaError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        content_matches: allMatches,
        total_found: allVideos.length,
        viable_candidates: viableCandidates.length,
        auto_approved_count: allMatches.filter((m) => m.status === "auto_approved").length,
        ai_strategy_used: use_ai_strategy && queries.length > 0,
        ai_evaluation_used: use_ai_evaluation,
        khan_academy_fallback_used: needsFallback && khanMatches.length > 0,
        khan_academy_results: khanMatches.length,
        cached: false,
        queries_used: queriesUsed,
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
