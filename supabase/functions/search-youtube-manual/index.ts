import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Invidious instances for quota-free YouTube search
// Updated Jan 2025 - verified working instances
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",        // 97.5% health
  "https://invidious.nerdvpn.de",  // 100% uptime
  "https://yewtu.be",              // Long-standing reliable
  "https://invidious.f5.si",       // New Jan 2025
  "https://invidious.protokolla.fi",
];

// Piped instances for quota-free YouTube search
// Updated Jan 2025 - verified from TeamPiped
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",   // Official
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.adminforge.de",
  "https://api.piped.yt",
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
 */
async function searchViaInvidious(query: string): Promise<VideoResult[]> {
  const instances = shuffleArray(INVIDIOUS_INSTANCES);
  
  for (const instance of instances) {
    try {
      const response = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`,
        {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(15000), // Increased to 15s
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      return data.slice(0, 15).map((item: any) => ({
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
    } catch (e) {
      console.log(`Invidious ${instance} failed:`, e);
      continue;
    }
  }
  return [];
}

/**
 * Search via Piped (YouTube without quota)
 */
async function searchViaPiped(query: string): Promise<VideoResult[]> {
  const instances = shuffleArray(PIPED_INSTANCES);
  
  for (const instance of instances) {
    try {
      const response = await fetch(
        `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
        {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(15000), // Increased to 15s
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      return (data.items || []).slice(0, 15).map((item: any) => {
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
    } catch (e) {
      console.log(`Piped ${instance} failed:`, e);
      continue;
    }
  }
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
    let source = 'youtube_api';

    // If use_alternatives is true, skip YouTube API and go directly to alternatives
    if (!use_alternatives) {
      const YOUTUBE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");

      if (YOUTUBE_API_KEY) {
        try {
          // Search for videos via YouTube API
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

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const videoIds = searchData.items
              ?.map((item: any) => item.id?.videoId)
              .filter(Boolean) || [];

            if (videoIds.length > 0) {
              // Get video details
              const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
              detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);
              detailsUrl.searchParams.set("id", videoIds.join(","));
              detailsUrl.searchParams.set("part", "snippet,contentDetails,statistics");

              const detailsResponse = await fetch(detailsUrl.toString());
              if (detailsResponse.ok) {
                const detailsData = await detailsResponse.json();
                results = (detailsData.items || []).map((item: any) => ({
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
          } else {
            // Check if quota exceeded (403)
            const errorText = await searchResponse.text();
            console.log(`YouTube API failed (${searchResponse.status}): ${errorText}`);
            if (searchResponse.status === 403 || errorText.includes('quotaExceeded')) {
              console.log('Quota exceeded, falling back to alternatives');
            }
          }
        } catch (apiError) {
          console.error('YouTube API error:', apiError);
        }
      }
    }

    // If YouTube API didn't return results, try alternatives
    if (results.length === 0) {
      console.log('Trying Invidious fallback...');
      results = await searchViaInvidious(query);
      if (results.length > 0) {
        source = 'invidious';
      }
    }

    // If Invidious failed, try Piped
    if (results.length === 0) {
      console.log('Trying Piped fallback...');
      results = await searchViaPiped(query);
      if (results.length > 0) {
        source = 'piped';
      }
    }

    console.log(`Found ${results.length} videos via ${source}`);

    return new Response(
      JSON.stringify({
        results,
        total: results.length,
        source, // Tells the client which source was used
      }),
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
