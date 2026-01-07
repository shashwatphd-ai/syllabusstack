import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface YouTubeSearchResult {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
  viewCount: string;
  publishedAt: string;
}

function parseDuration(duration: string): string {
  return duration; // Return raw ISO 8601 for client-side parsing
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

    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      throw new Error("Query is required");
    }

    console.log(`Manual YouTube search: "${query}"`);

    // Search for videos
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("videoDuration", "medium"); // 4-20 minutes
    searchUrl.searchParams.set("videoEmbeddable", "true");
    searchUrl.searchParams.set("safeSearch", "strict");
    searchUrl.searchParams.set("maxResults", "15");

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("YouTube search error:", errorText);
      throw new Error(`YouTube search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const videoIds = searchData.items
      ?.map((item: any) => item.id?.videoId)
      .filter(Boolean) || [];

    if (videoIds.length === 0) {
      return new Response(
        JSON.stringify({ results: [], total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get video details
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);
    detailsUrl.searchParams.set("id", videoIds.join(","));
    detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");

    const detailsResponse = await fetch(detailsUrl.toString());
    if (!detailsResponse.ok) {
      throw new Error(`YouTube details failed: ${detailsResponse.status}`);
    }

    const detailsData = await detailsResponse.json();

    const results: YouTubeSearchResult[] = (detailsData.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description?.substring(0, 200) || '',
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      duration: item.contentDetails?.duration || '',
      viewCount: item.statistics?.viewCount || '0',
      publishedAt: item.snippet.publishedAt,
    }));

    console.log(`Found ${results.length} videos`);

    return new Response(
      JSON.stringify({ results, total: results.length }),
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
