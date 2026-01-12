/**
 * Invidious/Piped-based YouTube Search
 *
 * Uses public Invidious and Piped instances to search YouTube.
 * Tertiary search method - free but unreliable due to Google blocking.
 */

import { YouTubeSearchResult } from './types.ts';

// Invidious instances (public YouTube API alternatives - NO QUOTA LIMITS)
// Updated Jan 2026 - inv.nadeko.net has multiple backends and is most resilient
// Note: Google actively blocks Invidious instances, so they may go up/down
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',           // Most resilient - multi-backend architecture
  'https://yewtu.be',                 // Long-standing, Germany-based
  'https://invidious.private.coffee', // Good backup
  'https://vid.puffyan.us',           // US-based
  'https://invidious.nerdvpn.de',     // May require auth now
];

// Piped instances (another YouTube alternative - NO QUOTA LIMITS)
// Note: Piped instances are also frequently blocked/unreliable
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',   // Official - may have SSL issues
  'https://pipedapi.adminforge.de', // German instance
  'https://pipedapi.r4fo.com',      // Alternative
];

/**
 * Shuffle array to distribute load across instances
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface InvidiousVideo {
  videoId: string;
  title: string;
  description: string;
  author: string;
  authorId: string;
  lengthSeconds: number;
  viewCount: number;
  published: number;
  videoThumbnails: Array<{ url: string; quality: string }>;
}

/**
 * Search via Invidious instances
 */
async function searchInvidiousInstances(
  query: string,
  maxResults: number,
  timeoutMs: number
): Promise<YouTubeSearchResult[]> {
  const instances = shuffleArray(INVIDIOUS_INSTANCES);

  for (const instance of instances) {
    try {
      console.log(`[INVIDIOUS] Trying instance: ${instance}`);
      const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`;

      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        console.log(`[INVIDIOUS] ${instance} returned status ${response.status}`);
        continue;
      }

      // Check content-type to avoid parsing HTML as JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.log(`[INVIDIOUS] ${instance} returned non-JSON content-type: ${contentType}`);
        continue;
      }

      const text = await response.text();

      // Double-check it's not HTML
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.log(`[INVIDIOUS] ${instance} returned HTML instead of JSON`);
        continue;
      }

      const data: InvidiousVideo[] = JSON.parse(text);

      if (!Array.isArray(data)) {
        console.log(`[INVIDIOUS] ${instance} returned unexpected data format`);
        continue;
      }

      const results: YouTubeSearchResult[] = data.slice(0, maxResults).map(item => ({
        video_id: item.videoId,
        title: item.title,
        description: item.description || '',
        channel_name: item.author,
        channel_id: item.authorId,
        thumbnail_url: item.videoThumbnails?.find(t => t.quality === 'medium')?.url ||
                       item.videoThumbnails?.[0]?.url ||
                       `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
        duration_seconds: item.lengthSeconds,
        view_count: item.viewCount || 0,
        published_at: item.published ? new Date(item.published * 1000).toISOString() : undefined,
        source: 'invidious',
        metadata_complete: !!(item.title && item.lengthSeconds),
      }));

      console.log(`[INVIDIOUS] ${instance} SUCCESS: found ${results.length} videos`);
      return results;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`[INVIDIOUS] ${instance} failed: ${errorMsg}`);
      continue;
    }
  }

  console.log('[INVIDIOUS] All instances failed');
  return [];
}

/**
 * Search via Piped instances
 */
async function searchPipedInstances(
  query: string,
  maxResults: number,
  timeoutMs: number
): Promise<YouTubeSearchResult[]> {
  const instances = shuffleArray(PIPED_INSTANCES);

  for (const instance of instances) {
    try {
      console.log(`[PIPED] Trying instance: ${instance}`);
      const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;

      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        console.log(`[PIPED] ${instance} returned status ${response.status}`);
        continue;
      }

      // Check content-type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.log(`[PIPED] ${instance} returned non-JSON content-type: ${contentType}`);
        continue;
      }

      const text = await response.text();

      // Check for HTML error pages
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.log(`[PIPED] ${instance} returned HTML instead of JSON`);
        continue;
      }

      const data = JSON.parse(text);
      const items = data.items || [];

      const results: YouTubeSearchResult[] = items.slice(0, maxResults).map((item: any) => {
        const videoId = item.url?.split('/watch?v=')[1] || item.url?.split('/').pop() || '';
        return {
          video_id: videoId,
          title: item.title || '',
          description: item.shortDescription || '',
          channel_name: item.uploaderName || '',
          channel_id: item.uploaderUrl?.split('/channel/')[1] || '',
          thumbnail_url: item.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          duration_seconds: item.duration || 0,
          view_count: item.views || 0,
          published_at: item.uploaded ? new Date(item.uploaded).toISOString() : undefined,
          source: 'piped' as const,
          metadata_complete: !!(item.title && item.duration),
        };
      });

      console.log(`[PIPED] ${instance} SUCCESS: found ${results.length} videos`);
      return results;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`[PIPED] ${instance} failed: ${errorMsg}`);
      continue;
    }
  }

  console.log('[PIPED] All instances failed');
  return [];
}

/**
 * Search YouTube via Invidious and Piped (combined)
 * Tries Invidious first, then Piped as fallback
 */
export async function searchViaInvidious(
  query: string,
  maxResults: number = 20,
  timeoutMs: number = 15000
): Promise<YouTubeSearchResult[]> {
  console.log(`[INVIDIOUS/PIPED] Searching: ${query}`);

  // Try Invidious first
  let results = await searchInvidiousInstances(query, maxResults, timeoutMs);

  // If Invidious failed or returned few results, try Piped
  if (results.length < 3) {
    console.log('[INVIDIOUS/PIPED] Trying Piped as supplement...');
    const pipedResults = await searchPipedInstances(query, maxResults, timeoutMs);

    // Merge and dedupe
    const existingIds = new Set(results.map(r => r.video_id));
    for (const pr of pipedResults) {
      if (!existingIds.has(pr.video_id)) {
        results.push(pr);
        existingIds.add(pr.video_id);
      }
    }
  }

  console.log(`[INVIDIOUS/PIPED] Total: ${results.length} videos`);
  return results.slice(0, maxResults);
}

/**
 * Get video metadata from Invidious (for enrichment)
 */
export async function getVideoMetadataFromInvidious(
  videoId: string,
  timeoutMs: number = 8000
): Promise<Partial<YouTubeSearchResult> | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/api/v1/videos/${videoId}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(timeoutMs),
        }
      );

      if (!response.ok) continue;

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;

      const text = await response.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) continue;

      const data = JSON.parse(text);

      return {
        title: data.title || '',
        description: data.description || '',
        channel_name: data.author || '',
        channel_id: data.authorId || '',
        duration_seconds: data.lengthSeconds || 0,
        view_count: data.viewCount || 0,
        thumbnail_url: data.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url ||
                       `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        published_at: data.published ? new Date(data.published * 1000).toISOString() : undefined,
      };
    } catch {
      continue;
    }
  }

  return null;
}
