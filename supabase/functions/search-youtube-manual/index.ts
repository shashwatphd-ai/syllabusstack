import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Invidious instances for quota-free YouTube search
// Updated Jan 2026 - inv.nadeko.net has multiple backends and is most resilient
// Note: Google actively blocks Invidious instances, so they may go up/down
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",           // Most resilient - multi-backend architecture
  "https://yewtu.be",                 // Long-standing, Germany-based
  "https://invidious.private.coffee", // Good backup
  "https://vid.puffyan.us",           // US-based
  "https://invidious.nerdvpn.de",     // May require auth now
];

// Piped instances for quota-free YouTube search
// Note: Piped instances are also frequently blocked/unreliable
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",   // Official - may have SSL issues
  "https://pipedapi.adminforge.de", // German instance
  "https://pipedapi.r4fo.com",      // Alternative
];

// Shuffle array to distribute load
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

// Parse ISO 8601 duration (e.g., PT4M32S) to seconds
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Search via Invidious (YouTube without quota)
 * Note: Google actively blocks Invidious, so instances may fail frequently
 */
async function searchViaInvidious(query: string): Promise<VideoResult[]> {
  const instances = shuffleArray(INVIDIOUS_INSTANCES);

  for (const instance of instances) {
    try {
      console.log(`Trying Invidious instance: ${instance}`);
      const response = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      // Check response status
      if (!response.ok) {
        console.log(`Invidious ${instance} returned status ${response.status}`);
        continue;
      }

      // Check content-type to avoid parsing HTML as JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.log(`Invidious ${instance} returned non-JSON content-type: ${contentType}`);
        continue;
      }

      const text = await response.text();

      // Double-check it's not HTML (some servers return 200 with HTML error page)
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.log(`Invidious ${instance} returned HTML instead of JSON`);
        continue;
      }

      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        console.log(`Invidious ${instance} returned unexpected data format`);
        continue;
      }

      const results = data.slice(0, 15).map((item: any) => ({
        video_id: item.videoId,
        title: item.title,
        description: item.description?.substring(0, 200) || '',
        channel_name: item.author || '',
        thumbnail_url: item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url ||
                       `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
        duration_seconds: item.lengthSeconds || 0,
        view_count: item.viewCount || 0,
        published_at: item.published ? new Date(item.published * 1000).toISOString() : undefined,
      }));

      console.log(`Invidious ${instance} SUCCESS: found ${results.length} results`);
      return results;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(`Invidious ${instance} failed: ${errorMsg}`);
      continue;
    }
  }
  console.log('All Invidious instances failed');
  return [];
}

/**
 * Search via Piped (YouTube without quota)
 * Note: Piped instances can be unreliable due to SSL/DNS issues
 */
async function searchViaPiped(query: string): Promise<VideoResult[]> {
  const instances = shuffleArray(PIPED_INSTANCES);

  for (const instance of instances) {
    try {
      console.log(`Trying Piped instance: ${instance}`);
      const response = await fetch(
        `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        console.log(`Piped ${instance} returned status ${response.status}`);
        continue;
      }

      // Check content-type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.log(`Piped ${instance} returned non-JSON content-type: ${contentType}`);
        continue;
      }

      const text = await response.text();

      // Check for HTML error pages
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.log(`Piped ${instance} returned HTML instead of JSON`);
        continue;
      }

      const data = JSON.parse(text);
      const items = data.items || [];

      const results = items.slice(0, 15).map((item: any) => {
        const videoId = item.url?.split('/watch?v=')[1] || '';
        return {
          video_id: videoId,
          title: item.title || '',
          description: item.shortDescription?.substring(0, 200) || '',
          channel_name: item.uploaderName || '',
          thumbnail_url: item.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          duration_seconds: item.duration || 0,
          view_count: item.views || 0,
          published_at: item.uploaded ? new Date(item.uploaded).toISOString() : undefined,
        };
      });

      console.log(`Piped ${instance} SUCCESS: found ${results.length} results`);
      return results;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(`Piped ${instance} failed: ${errorMsg}`);
      continue;
    }
  }
  console.log('All Piped instances failed');
  return [];
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

    console.log(`Manual YouTube search: "${query}" (use_alternatives: ${use_alternatives})`);

    let results: VideoResult[] = [];
    let source = 'none';
    const triedSources: string[] = [];
    const failureReasons: Record<string, string> = {};

    const YOUTUBE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");

    // Helper function to try YouTube API
    async function tryYouTubeAPI(): Promise<VideoResult[]> {
      if (!YOUTUBE_API_KEY) {
        failureReasons['youtube_api'] = 'No API key configured';
        return [];
      }

      try {
        triedSources.push('youtube_api');
        const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
        searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
        searchUrl.searchParams.set("q", query);
        searchUrl.searchParams.set("part", "snippet");
        searchUrl.searchParams.set("type", "video");
        searchUrl.searchParams.set("videoDuration", "medium");
        searchUrl.searchParams.set("videoEmbeddable", "true");
        searchUrl.searchParams.set("safeSearch", "strict");
        searchUrl.searchParams.set("maxResults", "15");

        const searchResponse = await fetch(searchUrl.toString());

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const videoIds = searchData.items
            ?.map((item: any) => item.id?.videoId)
            .filter(Boolean) || [];

          if (videoIds.length > 0) {
            const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
            detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);
            detailsUrl.searchParams.set("id", videoIds.join(","));
            detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");

            const detailsResponse = await fetch(detailsUrl.toString());
            if (detailsResponse.ok) {
              const detailsData = await detailsResponse.json();
              return (detailsData.items || []).map((item: any) => ({
                video_id: item.id,
                title: item.snippet.title,
                description: item.snippet.description?.substring(0, 200) || '',
                channel_name: item.snippet.channelTitle,
                thumbnail_url: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
                duration_seconds: parseDurationToSeconds(item.contentDetails?.duration || ''),
                view_count: parseInt(item.statistics?.viewCount || '0'),
                published_at: item.snippet.publishedAt,
              }));
            }
          }
          failureReasons['youtube_api'] = 'No results found';
          return [];
        } else {
          const errorText = await searchResponse.text();
          if (searchResponse.status === 403 || errorText.includes('quotaExceeded')) {
            failureReasons['youtube_api'] = 'Quota exceeded';
          } else {
            failureReasons['youtube_api'] = `HTTP ${searchResponse.status}`;
          }
          console.log(`YouTube API failed (${searchResponse.status}): ${errorText.substring(0, 200)}`);
          return [];
        }
      } catch (apiError) {
        const errorMsg = apiError instanceof Error ? apiError.message : 'Unknown error';
        failureReasons['youtube_api'] = errorMsg;
        console.error('YouTube API error:', apiError);
        return [];
      }
    }

    // Step 1: If not forcing alternatives, try YouTube API first
    if (!use_alternatives) {
      results = await tryYouTubeAPI();
      if (results.length > 0) {
        source = 'youtube_api';
      }
    }

    // Step 2: Try Invidious (quota-free alternative)
    if (results.length === 0) {
      console.log('Trying Invidious instances...');
      triedSources.push('invidious');
      results = await searchViaInvidious(query);
      if (results.length > 0) {
        source = 'invidious';
      } else {
        failureReasons['invidious'] = 'All instances failed (Google may be blocking)';
      }
    }

    // Step 3: Try Piped (another quota-free alternative)
    if (results.length === 0) {
      console.log('Trying Piped instances...');
      triedSources.push('piped');
      results = await searchViaPiped(query);
      if (results.length > 0) {
        source = 'piped';
      } else {
        failureReasons['piped'] = 'All instances failed (SSL/DNS issues likely)';
      }
    }

    // Step 4: Last resort - try YouTube API even if use_alternatives was true
    if (results.length === 0 && use_alternatives && YOUTUBE_API_KEY) {
      console.log('All alternatives failed, trying YouTube API as last resort...');
      results = await tryYouTubeAPI();
      if (results.length > 0) {
        source = 'youtube_api_fallback';
      }
    }

    console.log(`Search complete: ${results.length} videos via ${source}, tried: ${triedSources.join(', ')}`);

    // Build response with diagnostic info
    const response: any = {
      results,
      total: results.length,
      source,
    };

    // Include diagnostic info when no results found
    if (results.length === 0) {
      response.debug = {
        message: 'No results found. This may be due to Google blocking Invidious/Piped instances.',
        tried_sources: triedSources,
        failure_reasons: failureReasons,
        suggestion: YOUTUBE_API_KEY
          ? 'Invidious/Piped instances may be temporarily down. Results will work when instances recover.'
          : 'Consider adding GOOGLE_CLOUD_API_KEY for more reliable search (but has quota limits).',
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
