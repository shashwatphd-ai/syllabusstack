import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Action mapping for Bloom's taxonomy levels
const ACTION_MAP: Record<string, string> = {
  remember: "introduction to",
  understand: "explained",
  apply: "how to",
  analyze: "analysis of",
  evaluate: "comparing",
  create: "tutorial",
};

// Scoring weights
const WEIGHTS = {
  duration_fit: 0.25,
  semantic_similarity: 0.35,
  engagement_quality: 0.20,
  channel_authority: 0.10,
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
  // Parse ISO 8601 duration (e.g., PT4M13S)
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
  
  // Penalties for extreme mismatches
  if (actualSeconds < expectedSeconds * 0.5) return ratio * 0.5;
  if (actualSeconds > expectedSeconds * 2) return ratio * 0.7;
  
  return ratio;
}

function calculateEngagementScore(viewCount: number, likeCount: number): number {
  if (viewCount < 1000) return 0.3; // Low confidence for low views
  const likeRatio = likeCount / viewCount;
  return Math.min(likeRatio / 0.05, 1.0);
}

function calculateChannelAuthorityScore(channelTitle: string): number {
  const eduIndicators = ["university", "academy", "professor", "edu", "college", "course", "khan", "mit", "stanford", "yale", "harvard"];
  const lowerTitle = channelTitle.toLowerCase();
  for (const indicator of eduIndicators) {
    if (lowerTitle.includes(indicator)) return 0.8;
  }
  return 0.5;
}

function calculateRecencyScore(publishedAt: string): number {
  const publishDate = new Date(publishedAt);
  const now = new Date();
  const daysDiff = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff < 30) return 0.5; // Too new, may not be established
  if (daysDiff <= 365) return 1.0; // Sweet spot
  if (daysDiff <= 1095) return 0.8; // 1-3 years
  return 0.6; // Older than 3 years
}

function calculateSemanticSimilarity(videoText: string, loText: string, keywords: string[]): number {
  const videoLower = videoText.toLowerCase();
  const loLower = loText.toLowerCase();
  
  // Simple keyword matching (would use embeddings in production)
  let matchCount = 0;
  for (const keyword of keywords) {
    if (videoLower.includes(keyword.toLowerCase())) matchCount++;
  }
  
  // Also check core concept presence
  const loWords = loLower.split(/\s+/);
  for (const word of loWords) {
    if (word.length > 4 && videoLower.includes(word)) matchCount++;
  }
  
  return Math.min(matchCount / (keywords.length + 3), 1.0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use GOOGLE_CLOUD_API_KEY for YouTube Data API (consolidates keys)
    const YOUTUBE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!YOUTUBE_API_KEY) {
      throw new Error("GOOGLE_CLOUD_API_KEY is not configured (includes YouTube Data API access)");
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

    const { learning_objective_id, core_concept, bloom_level, domain, search_keywords, expected_duration_minutes, lo_text } = await req.json();
    
    if (!learning_objective_id) {
      throw new Error("learning_objective_id is required");
    }

    console.log(`Searching YouTube content for LO: ${learning_objective_id}`);

    // Build search queries
    const actionModifier = ACTION_MAP[bloom_level] || "explained";
    const queries = [
      `${core_concept} ${domain} explained`,
      `${actionModifier} ${core_concept}`,
      search_keywords?.slice(0, 3).join(" ") || core_concept,
    ];

    const allVideos: YouTubeVideo[] = [];
    const seenVideoIds = new Set<string>();

    for (const query of queries) {
      try {
        // Search for videos
        const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
        searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
        searchUrl.searchParams.set("q", query);
        searchUrl.searchParams.set("part", "snippet");
        searchUrl.searchParams.set("type", "video");
        searchUrl.searchParams.set("videoDuration", "medium"); // 4-20 minutes
        searchUrl.searchParams.set("videoEmbeddable", "true");
        searchUrl.searchParams.set("videoSyndicated", "true");
        searchUrl.searchParams.set("safeSearch", "strict");
        searchUrl.searchParams.set("maxResults", "10");

        const searchResponse = await fetch(searchUrl.toString());
        if (!searchResponse.ok) {
          console.error(`YouTube search error for query "${query}":`, await searchResponse.text());
          continue;
        }

        const searchData = await searchResponse.json();
        const videoIds = searchData.items
          ?.map((item: any) => item.id?.videoId)
          .filter((id: string) => id && !seenVideoIds.has(id)) || [];

        if (videoIds.length === 0) continue;

        // Get video details (duration, stats)
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
          if (seenVideoIds.has(item.id)) continue;
          seenVideoIds.add(item.id);

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

    console.log(`Found ${allVideos.length} unique videos`);

    // Score all videos
    const scoredVideos: ScoredContent[] = allVideos.map((video) => {
      const durationFit = calculateDurationFitScore(video.duration, expected_duration_minutes || 15);
      const semanticSimilarity = calculateSemanticSimilarity(
        `${video.title} ${video.description}`,
        lo_text || core_concept,
        search_keywords || []
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
          duration_fit: durationFit,
          semantic_similarity: semanticSimilarity,
          engagement_quality: engagementQuality,
          channel_authority: channelAuthority,
          recency: recency,
          total: total,
        },
      };
    });

    // Sort by total score descending
    scoredVideos.sort((a, b) => b.scores.total - a.scores.total);

    // Filter out auto-rejects (score < 0.40) and take top candidates
    const viableCandidates = scoredVideos.filter((sv) => sv.scores.total >= 0.40);
    const topCandidates = viableCandidates.slice(0, 5);

    // Save content and content_matches to database
    const savedMatches = [];
    for (const candidate of topCandidates) {
      // Check if content already exists
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
        // Insert new content
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

      // Create content match
      const autoApprove = candidate.scores.total >= 0.75;
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

    console.log(`Saved ${savedMatches.length} content matches`);

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
