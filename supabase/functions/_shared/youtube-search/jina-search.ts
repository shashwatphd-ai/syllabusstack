/**
 * Jina Reader-based YouTube Search
 *
 * Uses Jina's Reader API to fetch and parse YouTube search results.
 * Secondary search method - fast and good at extracting structured content.
 */

import { YouTubeSearchResult } from './types.ts';

const JINA_READER_URL = 'https://r.jina.ai';

/**
 * Parse duration string to seconds
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

  return 0;
}

/**
 * Parse view count from various formats
 */
function parseViewCount(views: string): number {
  if (!views) return 0;

  const cleaned = views.replace(/views?/gi, '').replace(/,/g, '').trim();

  const billionMatch = cleaned.match(/^([\d.]+)\s*[Bb]/);
  if (billionMatch) return Math.round(parseFloat(billionMatch[1]) * 1_000_000_000);

  const millionMatch = cleaned.match(/^([\d.]+)\s*[Mm]/);
  if (millionMatch) return Math.round(parseFloat(millionMatch[1]) * 1_000_000);

  const thousandMatch = cleaned.match(/^([\d.]+)\s*[Kk]/);
  if (thousandMatch) return Math.round(parseFloat(thousandMatch[1]) * 1_000);

  const numMatch = cleaned.match(/^(\d+)/);
  if (numMatch) return parseInt(numMatch[1]);

  return 0;
}

/**
 * Extract video IDs and metadata from Jina markdown response
 *
 * Jina typically returns content like:
 * ## Video Title
 * [Watch](https://www.youtube.com/watch?v=VIDEO_ID)
 * Channel Name • 10K views • 2 years ago
 * Duration: 12:34
 */
function parseJinaMarkdown(markdown: string): YouTubeSearchResult[] {
  const results: YouTubeSearchResult[] = [];
  const seenIds = new Set<string>();

  // Pattern to find YouTube video URLs
  const videoUrlPattern = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/g;

  // Split by video URLs to process each video section
  const sections = markdown.split(/(?=\[.*?\]\(https?:\/\/(?:www\.)?youtube\.com\/watch)/);

  for (const section of sections) {
    // Find video ID in this section
    const urlMatch = section.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (!urlMatch) continue;

    const videoId = urlMatch[1];
    if (seenIds.has(videoId)) continue;
    seenIds.add(videoId);

    // Try to extract title (usually in markdown header or link text)
    let title = '';
    const titleMatch = section.match(/^##?\s*(.+?)$/m) ||
                       section.match(/\[([^\]]+)\]\(https?:\/\/(?:www\.)?youtube\.com\/watch/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Try to extract channel name (usually before "•" or "views")
    let channelName = '';
    const channelMatch = section.match(/^([^•\n]+?)(?:\s*•|\s+\d)/m);
    if (channelMatch && !channelMatch[1].includes('youtube.com')) {
      channelName = channelMatch[1].trim();
    }

    // Try to extract duration
    let durationSeconds = 0;
    const durationMatch = section.match(/(?:Duration|Length):\s*(\d+:\d+(?::\d+)?)/i) ||
                          section.match(/(\d+:\d+(?::\d+)?)/);
    if (durationMatch) {
      durationSeconds = parseDurationToSeconds(durationMatch[1]);
    }

    // Try to extract view count
    let viewCount = 0;
    const viewsMatch = section.match(/([\d,.]+[KMB]?)\s*views/i);
    if (viewsMatch) {
      viewCount = parseViewCount(viewsMatch[1]);
    }

    // Try to extract published date
    let publishedAt: string | undefined;
    const publishedMatch = section.match(/(\d+\s+(?:year|month|week|day|hour)s?\s+ago)/i);
    if (publishedMatch) {
      publishedAt = publishedMatch[1];
    }

    results.push({
      video_id: videoId,
      title,
      description: '',
      channel_name: channelName,
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      duration_seconds: durationSeconds,
      view_count: viewCount,
      published_at: publishedAt,
      source: 'jina',
      metadata_complete: !!(title && durationSeconds > 0),
    });
  }

  // Fallback: just extract all video IDs if structured parsing failed
  if (results.length < 3) {
    let match;
    while ((match = videoUrlPattern.exec(markdown)) !== null) {
      const videoId = match[1] || match[2];
      if (videoId && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        results.push({
          video_id: videoId,
          title: '',
          description: '',
          channel_name: '',
          thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          duration_seconds: 0,
          view_count: 0,
          source: 'jina',
          metadata_complete: false,
        });
      }
    }
  }

  return results;
}

/**
 * Search YouTube via Jina Reader
 */
export async function searchViaJina(
  query: string,
  maxResults: number = 20,
  timeoutMs: number = 20000
): Promise<YouTubeSearchResult[]> {
  const JINA_API_KEY = Deno.env.get('JINA_API_KEY');

  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const jinaUrl = `${JINA_READER_URL}/${youtubeSearchUrl}`;

  console.log(`[JINA] Searching: ${query}`);

  try {
    const headers: Record<string, string> = {
      'Accept': 'text/markdown',
      'X-Return-Format': 'markdown',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    // Add API key if available (increases rate limits)
    if (JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
    }

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[JINA] API error ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Jina API error: ${response.status}`);
    }

    const markdown = await response.text();

    if (!markdown || markdown.length < 100) {
      console.log('[JINA] Empty or too short response');
      throw new Error('Jina returned empty response');
    }

    const results = parseJinaMarkdown(markdown);
    console.log(`[JINA] SUCCESS: ${results.length} videos found`);

    return results.slice(0, maxResults);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`[JINA] Failed: ${errorMsg}`);
    throw error;
  }
}
