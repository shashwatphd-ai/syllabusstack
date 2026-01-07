import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Expanded action mapping for Bloom's taxonomy levels
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
  duration_fit: 0.20,
  semantic_similarity: 0.35,
  engagement_quality: 0.20,
  channel_authority: 0.15,
  recency: 0.10,
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
    total: number;
  };
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
  
  // Ideal range: 0.7x to 1.5x of expected duration
  if (actualSeconds >= expectedSeconds * 0.7 && actualSeconds <= expectedSeconds * 1.5) {
    return 0.8 + (ratio * 0.2);
  }
  if (actualSeconds < expectedSeconds * 0.5) return ratio * 0.4;
  if (actualSeconds > expectedSeconds * 2) return ratio * 0.5;
  
  return ratio * 0.7;
}

function calculateEngagementScore(viewCount: number, likeCount: number): number {
  if (viewCount < 500) return 0.2; // Very low confidence
  if (viewCount < 1000) return 0.3;
  
  const likeRatio = likeCount / viewCount;
  const viewScore = Math.min(Math.log10(viewCount) / 7, 1); // Log scale, max at 10M views
  
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
  
  if (daysDiff < 30) return 0.6; // Too new, may not be established
  if (daysDiff <= 365) return 1.0; // Sweet spot - recent and established
  if (daysDiff <= 730) return 0.9; // 1-2 years
  if (daysDiff <= 1095) return 0.75; // 2-3 years
  if (daysDiff <= 1825) return 0.6; // 3-5 years
  return 0.4; // Older than 5 years
}

function calculateSemanticSimilarity(videoText: string, loText: string, keywords: string[], coreConcept: string): number {
  const videoLower = videoText.toLowerCase();
  const loLower = loText.toLowerCase();
  
  let score = 0;
  const maxScore = keywords.length + 5; // keywords + core concept parts
  
  // Check keywords
  for (const keyword of keywords) {
    if (keyword && videoLower.includes(keyword.toLowerCase())) {
      score += 1;
    }
  }
  
  // Check core concept words (weighted higher)
  const conceptWords = coreConcept?.toLowerCase().split(/\s+/) || [];
  for (const word of conceptWords) {
    if (word.length > 3 && videoLower.includes(word)) {
      score += 1.5;
    }
  }
  
  // Check LO text words (less weight)
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { learning_objective_id, core_concept, bloom_level, domain, search_keywords, expected_duration_minutes, lo_text, instructor_course_id } = await req.json();
    
    if (!learning_objective_id) {
      throw new Error("learning_objective_id is required");
    }

    console.log(`Searching YouTube content for LO: ${learning_objective_id}`);

    // Get existing content IDs for this course to avoid duplicates
    const existingVideoIds = new Set<string>();
    if (instructor_course_id) {
      const { data: existingMatches } = await supabaseClient
        .from("content_matches")
        .select(`
          content:content_id(source_id)
        `)
        .eq("learning_objective_id", learning_objective_id);
      
      existingMatches?.forEach((m: any) => {
        if (m.content?.source_id) existingVideoIds.add(m.content.source_id);
      });
    }

    // Build diverse search queries
    const actionModifiers = ACTION_MAP[bloom_level] || ACTION_MAP.understand;
    const domainModifiers = DOMAIN_MODIFIERS[domain] || DOMAIN_MODIFIERS.other;
    
    const queries = [
      // Primary queries
      `${core_concept} ${actionModifiers[0]} ${domainModifiers[0]}`,
      `${core_concept} ${domain} lecture`,
      `${core_concept} tutorial explained`,
      // Keyword-based queries
      ...(search_keywords?.slice(0, 3).map((kw: string) => `${kw} ${domain} explained`) || []),
      // Fallback queries
      `${core_concept} course`,
      `${core_concept} education`,
    ].slice(0, 6); // Max 6 queries

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
        searchUrl.searchParams.set("maxResults", "15"); // Increased from 10

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

        // Mark as seen to avoid duplicates across queries
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

    // Score all videos
    const scoredVideos: ScoredContent[] = allVideos.map((video) => {
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

      const total =
        durationFit * WEIGHTS.duration_fit +
        semanticSimilarity * WEIGHTS.semantic_similarity +
        engagementQuality * WEIGHTS.engagement_quality +
        channelAuthority * WEIGHTS.channel_authority +
        recency * WEIGHTS.recency;

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

    // Sort by total score descending
    scoredVideos.sort((a, b) => b.scores.total - a.scores.total);

    // Filter and deduplicate by channel (max 2 per channel)
    const channelCounts = new Map<string, number>();
    const viableCandidates = scoredVideos.filter((sv) => {
      if (sv.scores.total < 0.35) return false; // Lowered threshold
      const count = channelCounts.get(sv.video.channelId) || 0;
      if (count >= 2) return false;
      channelCounts.set(sv.video.channelId, count + 1);
      return true;
    });
    
    const topCandidates = viableCandidates.slice(0, 12); // Save top 12 instead of 10

    // Save content and content_matches to database
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

      // Auto-approve high-scoring content
      const autoApprove = candidate.scores.total >= 0.70;
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

    return new Response(
      JSON.stringify({
        success: true,
        content_matches: savedMatches,
        total_found: allVideos.length,
        viable_candidates: viableCandidates.length,
        auto_approved_count: savedMatches.filter((m) => m.status === "auto_approved").length,
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
