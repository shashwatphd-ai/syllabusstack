import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { validateRequest, addManualContentSchema } from "../_shared/validators/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const YOUTUBE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!YOUTUBE_API_KEY) {
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, 'GOOGLE_CLOUD_API_KEY is not configured');
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
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

    // Validate request body
    const body = await req.json();
    const validation = validateRequest(addManualContentSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }

    // Extract validated data with backward compatibility
    const {
      learning_objective_id,
      video_id,
      video_title,
      title,
      video_description,
      description,
      channel_name,
      thumbnail_url,
      duration_seconds,
      view_count,
      published_at: raw_published_at,
      source_type,
      source_url,
    } = validation.data;

    // Apply naming fallbacks for backward compatibility
    const finalVideoTitle = video_title || title;
    const finalVideoDescription = video_description || description;

    console.log(`Adding manual content (${source_type}): ${video_id} for LO ${learning_objective_id}`);

    // Parse relative dates like "6 years ago" to actual timestamps
    function parsePublishedAt(value: string | null): string | null {
      if (!value) return null;
      
      // If it's already a valid ISO date, return it
      const isoDate = new Date(value);
      if (!isNaN(isoDate.getTime()) && value.includes('-')) {
        return isoDate.toISOString();
      }
      
      // Handle relative dates like "6 years ago", "3 months ago", "2 weeks ago"
      const relativeMatch = value.match(/(\d+)\s*(year|month|week|day|hour|minute)s?\s*ago/i);
      if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2].toLowerCase();
        const now = new Date();
        
        switch (unit) {
          case 'year':
            now.setFullYear(now.getFullYear() - amount);
            break;
          case 'month':
            now.setMonth(now.getMonth() - amount);
            break;
          case 'week':
            now.setDate(now.getDate() - (amount * 7));
            break;
          case 'day':
            now.setDate(now.getDate() - amount);
            break;
          case 'hour':
            now.setHours(now.getHours() - amount);
            break;
          case 'minute':
            now.setMinutes(now.getMinutes() - amount);
            break;
        }
        return now.toISOString();
      }
      
      // If we can't parse it, return null
      console.log(`[MANUAL CONTENT] Could not parse published_at: "${value}", using null`);
      return null;
    }

    // Fetch video details from YouTube if not provided (only for YouTube source)
    let contentTitle = finalVideoTitle;
    let contentDescription = finalVideoDescription;
    let channelName = channel_name;
    let thumbnailUrl = thumbnail_url;
    let durationSeconds = duration_seconds || 0;
    let viewCount = view_count || 0;
    let likeCount = 0;
    let publishedAt = parsePublishedAt(raw_published_at ?? null);

    // If we don't have title and it's a YouTube video, fetch from YouTube API
    if (!contentTitle && source_type === 'youtube') {
      if (YOUTUBE_API_KEY) {
        const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);
        detailsUrl.searchParams.set("id", video_id);
        detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");

        const detailsResponse = await fetch(detailsUrl.toString());
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          const item = detailsData.items?.[0];
          
          if (item) {
            contentTitle = item.snippet.title;
            contentDescription = contentDescription || item.snippet.description;
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
    }

    // For Khan Academy, use defaults if not provided
    if (source_type === 'khan_academy') {
      contentTitle = contentTitle || video_id.replace(/-/g, ' ');
      channelName = channelName || 'Khan Academy';
      durationSeconds = durationSeconds || 600; // Default 10 min estimate
    }

    // Check if content already exists
    let contentId: string;
    const { data: existingContent } = await supabaseClient
      .from("content")
      .select("id")
      .eq("source_id", video_id)
      .eq("source_type", source_type)
      .maybeSingle();

    // Determine the source URL
    const finalSourceUrl = source_url || (source_type === 'youtube' 
      ? `https://www.youtube.com/watch?v=${video_id}`
      : `https://www.khanacademy.org/video/${video_id}`);

    if (existingContent) {
      contentId = existingContent.id;
    } else {
      // Create new content entry
      const { data: newContent, error: contentError } = await supabaseClient
        .from("content")
        .insert({
          source_type: source_type,
          source_id: video_id,
          source_url: finalSourceUrl,
          title: contentTitle || "Unknown Title",
          description: contentDescription || null,
          duration_seconds: durationSeconds || null,
          thumbnail_url: thumbnailUrl || null,
          channel_name: channelName || null,
          view_count: viewCount,
          like_count: likeCount,
          like_ratio: viewCount > 0 ? likeCount / viewCount : 0,
          published_at: publishedAt,
          quality_score: source_type === 'khan_academy' ? 0.8 : 0.6, // Higher default for Khan Academy
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

    // Get LO text for AI evaluation
    const { data: loData } = await supabaseClient
      .from("learning_objectives")
      .select("text, bloom_level, core_concept, instructor_course_id")
      .eq("id", learning_objective_id)
      .single();

    const loText = loData?.text || "";

    // Perform AI evaluation for manual content (same as automated search)
    let aiEvaluation = null;
    try {
      console.log(`[MANUAL CONTENT] Requesting AI evaluation for video: ${contentTitle}`);
      
      const evalResponse = await fetch(`${SUPABASE_URL}/functions/v1/evaluate-content-batch`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          learning_objective: {
            id: learning_objective_id,
            text: loText,
            bloom_level: loData?.bloom_level,
            core_concept: loData?.core_concept,
          },
          videos: [{
            video_id: video_id,
            title: contentTitle || "Unknown Title",
            description: contentDescription || "",
            channel_name: channelName || "",
            duration_seconds: durationSeconds,
          }],
        }),
      });

      if (evalResponse.ok) {
        const evalData = await evalResponse.json();
        if (evalData.evaluations && evalData.evaluations.length > 0) {
          aiEvaluation = evalData.evaluations[0];
          console.log(`[MANUAL CONTENT] AI evaluation: ${aiEvaluation.recommendation}`);
        }
      } else {
        console.log(`[MANUAL CONTENT] AI evaluation failed: ${evalResponse.status}`);
      }
    } catch (evalError) {
      console.log(`[MANUAL CONTENT] AI evaluation error:`, evalError);
    }

    // Create content match with AI evaluation data
    const matchData: Record<string, unknown> = {
      learning_objective_id,
      content_id: contentId,
      match_score: 0.7, // Default score for manually added
      duration_fit_score: 0.7,
      semantic_similarity_score: 0.7,
      engagement_quality_score: 0.5,
      channel_authority_score: 0.5,
      recency_score: 0.5,
      status: "pending", // Manual content needs review
    };

    // Add AI evaluation results if available
    if (aiEvaluation) {
      matchData.ai_reasoning = aiEvaluation.reasoning || null;
      matchData.ai_recommendation = aiEvaluation.recommendation || null;
      matchData.ai_concern = aiEvaluation.concern || null;
      matchData.ai_relevance_score = aiEvaluation.relevance_score ?? null;
      matchData.ai_pedagogy_score = aiEvaluation.pedagogy_score ?? null;
      matchData.ai_quality_score = aiEvaluation.quality_score ?? null;
      
      // Calculate combined score with AI
      if (aiEvaluation.relevance_score != null) {
        const aiScore = (
          (aiEvaluation.relevance_score || 0) * 0.4 +
          (aiEvaluation.pedagogy_score || 0) * 0.35 +
          (aiEvaluation.quality_score || 0) * 0.25
        );
        matchData.match_score = Math.round(aiScore * 100) / 100;
      }
      
      // Auto-approve if AI highly recommends
      if (aiEvaluation.recommendation === 'highly_recommended') {
        matchData.status = 'auto_approved';
        matchData.approved_at = new Date().toISOString();
      }
    }

    const { data: match, error: matchError } = await supabaseClient
      .from("content_matches")
      .insert(matchData)
      .select(`
        *,
        content:content_id(*)
      `)
      .single();

    if (matchError) {
      console.error("Error creating content match:", matchError);
      throw new Error("Failed to create content match");
    }

    console.log(`Manual content added: ${contentId}${aiEvaluation ? ` (AI: ${aiEvaluation.recommendation})` : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        content_match: match,
        content_id: contentId,
        ai_evaluated: !!aiEvaluation,
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
