import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  searchYouTubeOrchestrated,
  YouTubeSearchResult,
} from "../_shared/youtube-search/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MANUAL YOUTUBE SEARCH FOR INSTRUCTORS
 *
 * Simple search endpoint for the instructor "Search YouTube" button.
 * Uses the multi-source orchestrator (Firecrawl, Jina, Invidious, YouTube API).
 */

interface VideoResult {
  video_id: string;
  title: string;
  description: string;
  channel_name: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  published_at?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, use_alternatives = false } = await req.json();

    if (!query || typeof query !== 'string') {
      throw new Error("Query is required");
    }

    console.log(`[MANUAL SEARCH] Query: "${query}" (use_alternatives: ${use_alternatives})`);

    // Use the orchestrated search
    const searchResult = await searchYouTubeOrchestrated({
      query,
      max_results: 15,
      min_results: 3,
      // If use_alternatives is true, we still allow YouTube API as a last resort
      // The orchestrator tries Firecrawl/Jina/Invidious first anyway
      allow_youtube_api: true,
      priority: 'normal',
      enrich_metadata: true,
      timeout_ms: 25000,
    });

    // Convert to VideoResult format
    const results: VideoResult[] = searchResult.results.map(r => ({
      video_id: r.video_id,
      title: r.title,
      description: r.description?.substring(0, 200) || '',
      channel_name: r.channel_name,
      thumbnail_url: r.thumbnail_url,
      duration_seconds: r.duration_seconds,
      view_count: r.view_count,
      published_at: r.published_at,
    }));

    console.log(`[MANUAL SEARCH] Found ${results.length} videos via ${searchResult.source}`);
    if (searchResult.fallbacks_used.length > 0) {
      console.log(`[MANUAL SEARCH] Also used: ${searchResult.fallbacks_used.join(', ')}`);
    }

    // Build response with diagnostic info
    const response: any = {
      results,
      total: results.length,
      source: searchResult.source,
      fallbacks_used: searchResult.fallbacks_used,
      cache_hit: searchResult.cache_hit,
      time_ms: searchResult.total_time_ms,
    };

    // Include debug info when no results found
    if (results.length === 0 && searchResult.debug) {
      response.debug = {
        message: 'No results found. This may be due to search service issues.',
        ...searchResult.debug,
        suggestion: 'Try a different search query or wait a few minutes and try again.',
      };
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in search-youtube-manual:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
