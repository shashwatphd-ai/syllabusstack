import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import {
  searchYouTubeOrchestrated,
  YouTubeSearchResult,
} from "../_shared/youtube-search/index.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
} from "../_shared/error-handler.ts";

/**
 * MANUAL YOUTUBE SEARCH FOR INSTRUCTORS
 *
 * Simple search endpoint for the instructor "Search YouTube" button.
 * Uses the multi-source orchestrator (Firecrawl, Jina, Invidious, YouTube API).
 * 
 * SECURITY: Requires authenticated user to prevent API quota abuse.
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

const handler = async (req: Request): Promise<Response> => {
  // CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  // SECURITY: Validate user authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error("[MANUAL SEARCH] Missing Authorization header");
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Missing authentication');
  }

  // Create Supabase client and validate user
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("[MANUAL SEARCH] Authentication failed:", authError?.message);
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
  }

  logInfo('search-youtube-manual', 'authenticated', { userId: user.id });

  const { query, use_alternatives = false } = await req.json();

  if (!query || typeof query !== 'string') {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'Query is required');
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

  logInfo('search-youtube-manual', 'complete', { 
    userId: user.id, 
    resultCount: results.length, 
    source: searchResult.source 
  });

  if (searchResult.fallbacks_used.length > 0) {
    console.log(`[MANUAL SEARCH] Also used: ${searchResult.fallbacks_used.join(', ')}`);
  }

  // Build response with diagnostic info
  const response: Record<string, unknown> = {
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

  return createSuccessResponse(response, corsHeaders);
};

serve(withErrorHandling(handler, getCorsHeaders));
