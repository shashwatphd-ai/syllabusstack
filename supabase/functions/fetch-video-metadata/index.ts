import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const YOUTUBE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!YOUTUBE_API_KEY) {
      return createErrorResponse('CONFIG_ERROR', corsHeaders, 'GOOGLE_CLOUD_API_KEY is not configured');
    }

    const { video_id } = await req.json();

    if (!video_id) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'video_id is required');
    }

    logInfo('fetch-video-metadata', 'fetching', { videoId: video_id });

    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);
    detailsUrl.searchParams.set("id", video_id);
    detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");

    const response = await fetch(detailsUrl.toString());
    if (!response.ok) {
      logError('fetch-video-metadata', new Error(`YouTube API error: ${response.status}`));
      return createErrorResponse('INTERNAL_ERROR', corsHeaders, `YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    const item = data.items?.[0];

    if (!item) {
      return createErrorResponse('NOT_FOUND', corsHeaders, 'Video not found');
    }

    logInfo('fetch-video-metadata', 'complete', { videoId: video_id });

    return createSuccessResponse({
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
    }, corsHeaders);

  } catch (error: unknown) {
    logError('fetch-video-metadata', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
