/**
 * Firecrawl-based YouTube Search
 *
 * Scrapes YouTube search results page using Firecrawl's rendering and extraction.
 * Primary search method - most reliable for getting actual YouTube results.
 */

import { YouTubeSearchResult, FirecrawlResponse, FirecrawlVideoExtract } from './types.ts';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

/**
 * Parse duration string to seconds
 * Handles formats: "12:34", "1:23:45", "12 minutes", etc.
 */
function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;

  // Format: "12:34" or "1:23:45"
  const colonMatch = duration.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (colonMatch) {
    const parts = colonMatch.slice(1).filter(Boolean).map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  // Format: "12 minutes", "1 hour 23 minutes"
  let seconds = 0;
  const hourMatch = duration.match(/(\d+)\s*(?:hour|hr)/i);
  const minMatch = duration.match(/(\d+)\s*(?:minute|min)/i);
  const secMatch = duration.match(/(\d+)\s*(?:second|sec)/i);

  if (hourMatch) seconds += parseInt(hourMatch[1]) * 3600;
  if (minMatch) seconds += parseInt(minMatch[1]) * 60;
  if (secMatch) seconds += parseInt(secMatch[1]);

  return seconds;
}

/**
 * Parse view count string to number
 * Handles formats: "1.2M views", "500K views", "1,234 views"
 */
function parseViewCount(views: string): number {
  if (!views) return 0;

  const cleanedViews = views.replace(/views?/gi, '').replace(/,/g, '').trim();

  const billionMatch = cleanedViews.match(/^([\d.]+)\s*[Bb]/);
  if (billionMatch) return Math.round(parseFloat(billionMatch[1]) * 1_000_000_000);

  const millionMatch = cleanedViews.match(/^([\d.]+)\s*[Mm]/);
  if (millionMatch) return Math.round(parseFloat(millionMatch[1]) * 1_000_000);

  const thousandMatch = cleanedViews.match(/^([\d.]+)\s*[Kk]/);
  if (thousandMatch) return Math.round(parseFloat(thousandMatch[1]) * 1_000);

  const numMatch = cleanedViews.match(/^(\d+)/);
  if (numMatch) return parseInt(numMatch[1]);

  return 0;
}

/**
 * Extract video ID from various URL formats
 */
function extractVideoId(text: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  // Direct 11-char ID
  const directMatch = text.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directMatch) return directMatch[0];

  return null;
}

/**
 * Parse video results from Firecrawl's LLM extraction
 */
function parseExtractedVideos(videos: FirecrawlVideoExtract[]): YouTubeSearchResult[] {
  const results: YouTubeSearchResult[] = [];
  const seenIds = new Set<string>();

  for (const video of videos) {
    const videoId = extractVideoId(video.video_id || '');
    if (!videoId || seenIds.has(videoId)) continue;

    seenIds.add(videoId);
    results.push({
      video_id: videoId,
      title: video.title || '',
      description: '',
      channel_name: video.channel_name || '',
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      duration_seconds: parseDurationToSeconds(video.duration || ''),
      view_count: parseViewCount(video.views || ''),
      published_at: video.published || undefined,
      source: 'firecrawl',
      metadata_complete: !!(video.title && video.duration),
    });
  }

  return results;
}

/**
 * Parse video IDs from markdown content (fallback method)
 */
function parseVideoIdsFromMarkdown(markdown: string): YouTubeSearchResult[] {
  const results: YouTubeSearchResult[] = [];
  const seenIds = new Set<string>();

  // Find all YouTube video URLs in the markdown
  const urlPattern = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/g;
  let match;

  while ((match = urlPattern.exec(markdown)) !== null) {
    const videoId = match[1] || match[2];
    if (videoId && !seenIds.has(videoId)) {
      seenIds.add(videoId);
      results.push({
        video_id: videoId,
        title: '', // Will be enriched later
        description: '',
        channel_name: '',
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration_seconds: 0,
        view_count: 0,
        source: 'firecrawl',
        metadata_complete: false,
      });
    }
  }

  return results;
}

/**
 * Search YouTube via Firecrawl scraping
 */
export async function searchViaFirecrawl(
  query: string,
  maxResults: number = 20,
  timeoutMs: number = 30000
): Promise<YouTubeSearchResult[]> {
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

  if (!FIRECRAWL_API_KEY) {
    console.log('[FIRECRAWL] No API key configured');
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  console.log(`[FIRECRAWL] Searching: ${query}`);

  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown', 'extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
              videos: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Video title' },
                    video_id: { type: 'string', description: 'YouTube video ID (11 characters) or full URL' },
                    channel_name: { type: 'string', description: 'Channel name that uploaded the video' },
                    duration: { type: 'string', description: 'Video duration like "12:34" or "1:23:45"' },
                    views: { type: 'string', description: 'View count like "1.2M views" or "500K views"' },
                    published: { type: 'string', description: 'When published like "2 years ago"' },
                  },
                },
                description: 'List of YouTube video search results',
              },
            },
          },
          prompt: 'Extract all YouTube video search results from this page. For each video, get the title, video ID (the 11-character code from the URL), channel name, duration, view count, and publication date. Only include actual video results, not ads or suggested content.',
        },
        waitFor: 3000,
        timeout: Math.floor(timeoutMs / 1000) * 1000,
      }),
      signal: AbortSignal.timeout(timeoutMs + 5000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[FIRECRAWL] API error ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Firecrawl API error: ${response.status}`);
    }

    const data: FirecrawlResponse = await response.json();

    if (!data.success) {
      console.log(`[FIRECRAWL] Scrape failed: ${data.error}`);
      throw new Error(data.error || 'Firecrawl scrape failed');
    }

    let results: YouTubeSearchResult[] = [];

    // Try LLM extraction first (most reliable)
    if (data.data?.extract?.videos && Array.isArray(data.data.extract.videos)) {
      results = parseExtractedVideos(data.data.extract.videos);
      console.log(`[FIRECRAWL] LLM extraction found ${results.length} videos`);
    }

    // Fallback to markdown parsing if extraction failed or returned few results
    if (results.length < 3 && data.data?.markdown) {
      const markdownResults = parseVideoIdsFromMarkdown(data.data.markdown);
      const existingIds = new Set(results.map(r => r.video_id));

      for (const mr of markdownResults) {
        if (!existingIds.has(mr.video_id)) {
          results.push(mr);
          existingIds.add(mr.video_id);
        }
      }
      console.log(`[FIRECRAWL] After markdown parsing: ${results.length} videos`);
    }

    console.log(`[FIRECRAWL] SUCCESS: ${results.length} videos found`);
    return results.slice(0, maxResults);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`[FIRECRAWL] Failed: ${errorMsg}`);
    throw error;
  }
}
