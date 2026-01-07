import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

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

    const body = await req.json();
    
    // Accept both naming conventions for backwards compatibility
    const learning_objective_id = body.learning_objective_id;
    const video_id = body.video_id;
    const video_title = body.video_title || body.title;
    const video_description = body.video_description || body.description;
    const channel_name = body.channel_name;
    const thumbnail_url = body.thumbnail_url;
    const duration_seconds = body.duration_seconds;
    const view_count = body.view_count;
    const published_at = body.published_at;

    if (!learning_objective_id || !video_id) {
      console.error("Missing required fields:", { learning_objective_id, video_id, body });
      throw new Error("learning_objective_id and video_id are required");
    }

    console.log(`Adding manual content: video ${video_id} for LO ${learning_objective_id}`);

    // Fetch video details from YouTube if not provided
    let title = video_title;
    let description = video_description;
    let channelName = channel_name;
    let thumbnailUrl = thumbnail_url;
    let durationSeconds = duration_seconds || 0;
    let viewCount = view_count || 0;
    let likeCount = 0;
    let publishedAt = published_at || null;

    // If we don't have title, fetch from YouTube API
    if (!title) {
      const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);
      detailsUrl.searchParams.set("id", video_id);
      detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");

      const detailsResponse = await fetch(detailsUrl.toString());
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        const item = detailsData.items?.[0];
        
        if (item) {
          title = item.snippet.title;
          description = description || item.snippet.description;
          channelName = channelName || item.snippet.channelTitle;
          thumbnailUrl = thumbnailUrl || item.snippet.thumbnails?.medium?.url;
          publishedAt = item.snippet.publishedAt;
          viewCount = parseInt(item.statistics?.viewCount || "0");
          likeCount = parseInt(item.statistics?.likeCount || "0");
          
          // Parse duration if not provided
          if (!durationSeconds) {
            const duration = item.contentDetails?.duration || "";
            const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (match) {
              const hours = parseInt(match[1] || "0");
              const minutes = parseInt(match[2] || "0");
              const seconds = parseInt(match[3] || "0");
              durationSeconds = hours * 3600 + minutes * 60 + seconds;
            }
          }
        }
      }
    }

    // Check if content already exists
    let contentId: string;
    const { data: existingContent } = await supabaseClient
      .from("content")
      .select("id")
      .eq("source_id", video_id)
      .eq("source_type", "youtube")
      .maybeSingle();

    if (existingContent) {
      contentId = existingContent.id;
    } else {
      // Create new content entry
      const { data: newContent, error: contentError } = await supabaseClient
        .from("content")
        .insert({
          source_type: "youtube",
          source_id: video_id,
          source_url: `https://www.youtube.com/watch?v=${video_id}`,
          title: title || "Unknown Title",
          description: description || null,
          duration_seconds: durationSeconds || null,
          thumbnail_url: thumbnailUrl || null,
          channel_name: channelName || null,
          view_count: viewCount,
          like_count: likeCount,
          like_ratio: viewCount > 0 ? likeCount / viewCount : 0,
          published_at: publishedAt,
          quality_score: 0.6, // Default score for manually added content
          is_available: true,
          last_availability_check: new Date().toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (contentError) {
        console.error("Error creating content:", contentError);
        throw new Error("Failed to create content entry");
      }
      contentId = newContent.id;
    }

    // Check if content match already exists
    const { data: existingMatch } = await supabaseClient
      .from("content_matches")
      .select("id")
      .eq("learning_objective_id", learning_objective_id)
      .eq("content_id", contentId)
      .maybeSingle();

    if (existingMatch) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Content already exists for this learning objective",
          content_match_id: existingMatch.id,
          content_id: contentId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create content match (pending review)
    const { data: match, error: matchError } = await supabaseClient
      .from("content_matches")
      .insert({
        learning_objective_id,
        content_id: contentId,
        match_score: 0.7, // Default score for manually added
        duration_fit_score: 0.7,
        semantic_similarity_score: 0.7,
        engagement_quality_score: 0.5,
        channel_authority_score: 0.5,
        recency_score: 0.5,
        status: "pending", // Manual content needs review
      })
      .select(`
        *,
        content:content_id(*)
      `)
      .single();

    if (matchError) {
      console.error("Error creating content match:", matchError);
      throw new Error("Failed to create content match");
    }

    console.log(`Manual content added: ${contentId}`);

    return new Response(
      JSON.stringify({
        success: true,
        content_match: match,
        content_id: contentId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in add-manual-content:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
