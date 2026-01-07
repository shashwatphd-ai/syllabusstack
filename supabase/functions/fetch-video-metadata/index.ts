import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!YOUTUBE_API_KEY) {
      throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
    }

    const { video_id } = await req.json();
    
    if (!video_id) {
      throw new Error("video_id is required");
    }

    console.log(`Fetching metadata for video: ${video_id}`);

    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);
    detailsUrl.searchParams.set("id", video_id);
    detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");

    const response = await fetch(detailsUrl.toString());
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    const item = data.items?.[0];

    if (!item) {
      throw new Error("Video not found");
    }

    return new Response(
      JSON.stringify({
        video_id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        channel_name: item.snippet.channelTitle,
        channel_id: item.snippet.channelId,
        thumbnail_url: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        duration: item.contentDetails?.duration,
        view_count: item.statistics?.viewCount,
        like_count: item.statistics?.likeCount,
        published_at: item.snippet.publishedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in fetch-video-metadata:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
