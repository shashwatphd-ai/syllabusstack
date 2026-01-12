/**
 * YouTube Data API v3 Search (Quota-Guarded)
 *
 * Last resort search method - uses official YouTube API.
 * Quota: 10,000 units/day, search costs 100 units, video details costs 1 unit per video.
 */

import { YouTubeSearchResult } from './types.ts';

// Daily quota limit
const DAILY_QUOTA_LIMIT = 10000;
// Reserve quota for high-priority requests
const RESERVED_QUOTA = 2000;
// Cost per operation
const SEARCH_COST = 100;
const VIDEO_DETAILS_COST = 1;

// In-memory quota tracking (resets with function cold start)
// For production, use database tracking
let quotaUsedToday = 0;
let quotaResetDate = new Date().toISOString().split('T')[0];

/**
 * Check if we can use YouTube API based on quota
 */
export function canUseYouTubeAPI(priority: 'normal' | 'high' = 'normal'): boolean {
  const today = new Date().toISOString().split('T')[0];

  // Reset quota counter if new day
  if (today !== quotaResetDate) {
    quotaUsedToday = 0;
    quotaResetDate = today;
  }

  const remaining = DAILY_QUOTA_LIMIT - quotaUsedToday;

  if (priority === 'normal') {
    // Normal priority: leave some quota reserved
    return remaining > RESERVED_QUOTA;
  }

  // High priority: use all available quota
  return remaining > SEARCH_COST;
}

/**
 * Get remaining quota
 */
export function getQuotaRemaining(): number {
  const today = new Date().toISOString().split('T')[0];
  if (today !== quotaResetDate) {
    return DAILY_QUOTA_LIMIT;
  }
  return DAILY_QUOTA_LIMIT - quotaUsedToday;
}

/**
 * Record quota usage
 */
function recordQuotaUsage(units: number): void {
  const today = new Date().toISOString().split('T')[0];
  if (today !== quotaResetDate) {
    quotaUsedToday = 0;
    quotaResetDate = today;
  }
  quotaUsedToday += units;
  console.log(`[YOUTUBE_API] Quota used: ${units} units, total today: ${quotaUsedToday}/${DAILY_QUOTA_LIMIT}`);
}

/**
 * Parse ISO 8601 duration to seconds
 * Format: PT1H23M45S, PT10M30S, PT45S
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
}

export interface YouTubeAPISearchResult {
  results: YouTubeSearchResult[];
  quota_used: number;
}

/**
 * Search YouTube via official Data API v3
 */
export async function searchViaYouTubeAPI(
  query: string,
  maxResults: number = 20,
  timeoutMs: number = 15000
): Promise<YouTubeAPISearchResult> {
  const YOUTUBE_API_KEY = Deno.env.get('GOOGLE_CLOUD_API_KEY');

  if (!YOUTUBE_API_KEY) {
    console.log('[YOUTUBE_API] No API key configured');
    throw new Error('GOOGLE_CLOUD_API_KEY not configured');
  }

  console.log(`[YOUTUBE_API] Searching: ${query}`);

  let quotaUsed = 0;

  try {
    // Step 1: Search for videos (100 units)
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('videoDuration', 'medium'); // 4-20 minutes
    searchUrl.searchParams.set('videoEmbeddable', 'true');
    searchUrl.searchParams.set('safeSearch', 'strict');
    searchUrl.searchParams.set('maxResults', String(Math.min(maxResults, 25)));

    const searchResponse = await fetch(searchUrl.toString(), {
      signal: AbortSignal.timeout(timeoutMs),
    });

    quotaUsed += SEARCH_COST;

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.log(`[YOUTUBE_API] Search failed ${searchResponse.status}: ${errorText.substring(0, 200)}`);

      // Check for quota exceeded
      if (searchResponse.status === 403 || errorText.includes('quotaExceeded')) {
        // Mark quota as exhausted
        quotaUsedToday = DAILY_QUOTA_LIMIT;
        throw new Error('YouTube API quota exceeded');
      }

      throw new Error(`YouTube API search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const videoIds = searchData.items
      ?.map((item: any) => item.id?.videoId)
      .filter(Boolean) || [];

    if (videoIds.length === 0) {
      console.log('[YOUTUBE_API] No results found');
      recordQuotaUsage(quotaUsed);
      return { results: [], quota_used: quotaUsed };
    }

    // Step 2: Get video details (1 unit per video)
    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.searchParams.set('key', YOUTUBE_API_KEY);
    detailsUrl.searchParams.set('id', videoIds.join(','));
    detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');

    const detailsResponse = await fetch(detailsUrl.toString(), {
      signal: AbortSignal.timeout(timeoutMs),
    });

    quotaUsed += videoIds.length * VIDEO_DETAILS_COST;

    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text();
      console.log(`[YOUTUBE_API] Details failed ${detailsResponse.status}: ${errorText.substring(0, 200)}`);

      // Return partial results from search (no details)
      recordQuotaUsage(quotaUsed);
      const partialResults: YouTubeSearchResult[] = searchData.items.map((item: any) => ({
        video_id: item.id.videoId,
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        channel_name: item.snippet?.channelTitle || '',
        channel_id: item.snippet?.channelId || '',
        thumbnail_url: item.snippet?.thumbnails?.medium?.url ||
                       item.snippet?.thumbnails?.default?.url ||
                       `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
        duration_seconds: 0, // No details
        view_count: 0,
        published_at: item.snippet?.publishedAt,
        source: 'youtube_api' as const,
        metadata_complete: false,
      }));

      return { results: partialResults, quota_used: quotaUsed };
    }

    const detailsData = await detailsResponse.json();

    const results: YouTubeSearchResult[] = (detailsData.items || []).map((item: any) => ({
      video_id: item.id,
      title: item.snippet?.title || '',
      description: item.snippet?.description?.substring(0, 500) || '',
      channel_name: item.snippet?.channelTitle || '',
      channel_id: item.snippet?.channelId || '',
      thumbnail_url: item.snippet?.thumbnails?.medium?.url ||
                     item.snippet?.thumbnails?.default?.url ||
                     `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
      duration_seconds: parseDuration(item.contentDetails?.duration || ''),
      view_count: parseInt(item.statistics?.viewCount || '0'),
      like_count: parseInt(item.statistics?.likeCount || '0'),
      published_at: item.snippet?.publishedAt,
      source: 'youtube_api' as const,
      metadata_complete: true,
    }));

    recordQuotaUsage(quotaUsed);
    console.log(`[YOUTUBE_API] SUCCESS: ${results.length} videos, quota used: ${quotaUsed}`);

    return { results, quota_used: quotaUsed };

  } catch (error) {
    recordQuotaUsage(quotaUsed);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`[YOUTUBE_API] Failed: ${errorMsg}`);
    throw error;
  }
}
