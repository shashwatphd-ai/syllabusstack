/**
 * Video Metadata Enricher
 *
 * Completes missing metadata for videos found via scraping methods.
 * Uses multiple sources to fill in gaps: oEmbed, Invidious, Firecrawl.
 */

import { YouTubeSearchResult } from './types.ts';
import { getVideoMetadataFromInvidious } from './invidious-search.ts';

/**
 * Fetch metadata from YouTube oEmbed (always works, basic info)
 */
async function fetchYouTubeOEmbed(
  videoId: string,
  timeoutMs: number = 5000
): Promise<Partial<YouTubeSearchResult> | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(timeoutMs) }
    );

    if (!response.ok) {
      console.log(`[OEMBED] Failed for ${videoId}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      title: data.title || '',
      channel_name: data.author_name || '',
      thumbnail_url: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`[OEMBED] Error for ${videoId}: ${errorMsg}`);
    return null;
  }
}

/**
 * Fetch metadata via Firecrawl scraping of video page
 */
async function fetchViaFirecrawl(
  videoId: string,
  timeoutMs: number = 15000
): Promise<Partial<YouTubeSearchResult> | null> {
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

  if (!FIRECRAWL_API_KEY) {
    return null;
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: videoUrl,
        formats: ['extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              channel_name: { type: 'string' },
              duration: { type: 'string' },
              views: { type: 'string' },
              description: { type: 'string' },
            },
          },
          prompt: 'Extract the video title, channel name, duration (in format like "12:34"), view count, and first paragraph of description.',
        },
        waitFor: 2000,
        timeout: Math.floor(timeoutMs / 1000) * 1000,
      }),
      signal: AbortSignal.timeout(timeoutMs + 5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.data?.extract) {
      return null;
    }

    const extract = data.data.extract;

    // Parse duration
    let durationSeconds = 0;
    if (extract.duration) {
      const colonMatch = extract.duration.match(/^(\d+):(\d+)(?::(\d+))?$/);
      if (colonMatch) {
        const parts = colonMatch.slice(1).filter(Boolean).map(Number);
        if (parts.length === 2) {
          durationSeconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      }
    }

    // Parse view count
    let viewCount = 0;
    if (extract.views) {
      const cleaned = extract.views.replace(/views?/gi, '').replace(/,/g, '').trim();
      const millionMatch = cleaned.match(/^([\d.]+)\s*[Mm]/);
      if (millionMatch) {
        viewCount = Math.round(parseFloat(millionMatch[1]) * 1_000_000);
      } else {
        const thousandMatch = cleaned.match(/^([\d.]+)\s*[Kk]/);
        if (thousandMatch) {
          viewCount = Math.round(parseFloat(thousandMatch[1]) * 1_000);
        } else {
          const numMatch = cleaned.match(/^(\d+)/);
          if (numMatch) viewCount = parseInt(numMatch[1]);
        }
      }
    }

    return {
      title: extract.title || undefined,
      channel_name: extract.channel_name || undefined,
      duration_seconds: durationSeconds || undefined,
      view_count: viewCount || undefined,
      description: extract.description?.substring(0, 500) || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Enrich a single video's metadata
 */
export async function enrichVideoMetadata(
  video: YouTubeSearchResult,
  options: {
    useOEmbed?: boolean;
    useInvidious?: boolean;
    useFirecrawl?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<YouTubeSearchResult> {
  const {
    useOEmbed = true,
    useInvidious = true,
    useFirecrawl = false, // Expensive, off by default
    timeoutMs = 8000,
  } = options;

  // If metadata is already complete, return as-is
  if (video.metadata_complete) {
    return video;
  }

  const enriched = { ...video };
  let needsMore = !enriched.title || !enriched.duration_seconds || !enriched.channel_name;

  // 1. Try YouTube oEmbed (fastest, most reliable for basic info)
  if (useOEmbed && (!enriched.title || !enriched.channel_name)) {
    const oembed = await fetchYouTubeOEmbed(video.video_id, timeoutMs);
    if (oembed) {
      enriched.title = enriched.title || oembed.title || '';
      enriched.channel_name = enriched.channel_name || oembed.channel_name || '';
      enriched.thumbnail_url = enriched.thumbnail_url || oembed.thumbnail_url || '';
    }
    needsMore = !enriched.title || !enriched.duration_seconds;
  }

  // 2. Try Invidious (good for duration and views)
  if (useInvidious && needsMore) {
    const invidious = await getVideoMetadataFromInvidious(video.video_id, timeoutMs);
    if (invidious) {
      enriched.title = enriched.title || invidious.title || '';
      enriched.description = enriched.description || invidious.description || '';
      enriched.channel_name = enriched.channel_name || invidious.channel_name || '';
      enriched.channel_id = enriched.channel_id || invidious.channel_id || '';
      enriched.duration_seconds = enriched.duration_seconds || invidious.duration_seconds || 0;
      enriched.view_count = enriched.view_count || invidious.view_count || 0;
      enriched.thumbnail_url = enriched.thumbnail_url || invidious.thumbnail_url || '';
      enriched.published_at = enriched.published_at || invidious.published_at;
    }
    needsMore = !enriched.duration_seconds;
  }

  // 3. Try Firecrawl as last resort (expensive)
  if (useFirecrawl && needsMore) {
    const fcMetadata = await fetchViaFirecrawl(video.video_id, timeoutMs + 10000);
    if (fcMetadata) {
      enriched.title = enriched.title || fcMetadata.title || '';
      enriched.channel_name = enriched.channel_name || fcMetadata.channel_name || '';
      enriched.duration_seconds = enriched.duration_seconds || fcMetadata.duration_seconds || 0;
      enriched.view_count = enriched.view_count || fcMetadata.view_count || 0;
      enriched.description = enriched.description || fcMetadata.description || '';
    }
  }

  // Update metadata_complete flag
  enriched.metadata_complete = !!(
    enriched.title &&
    enriched.duration_seconds > 0 &&
    enriched.channel_name
  );

  return enriched;
}

/**
 * Batch enrich multiple videos in parallel
 */
export async function enrichVideosMetadata(
  videos: YouTubeSearchResult[],
  options: {
    useOEmbed?: boolean;
    useInvidious?: boolean;
    useFirecrawl?: boolean;
    timeoutMs?: number;
    concurrency?: number;
  } = {}
): Promise<YouTubeSearchResult[]> {
  const { concurrency = 5, ...enrichOptions } = options;

  // Filter videos that need enrichment
  const needsEnrichment = videos.filter(v => !v.metadata_complete);
  const alreadyComplete = videos.filter(v => v.metadata_complete);

  if (needsEnrichment.length === 0) {
    return videos;
  }

  console.log(`[ENRICHER] Enriching ${needsEnrichment.length} videos (${alreadyComplete.length} already complete)`);

  // Process in batches to limit concurrency
  const enriched: YouTubeSearchResult[] = [...alreadyComplete];
  const batches: YouTubeSearchResult[][] = [];

  for (let i = 0; i < needsEnrichment.length; i += concurrency) {
    batches.push(needsEnrichment.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(v => enrichVideoMetadata(v, enrichOptions))
    );
    enriched.push(...results);
  }

  // Sort to maintain original order
  const orderMap = new Map(videos.map((v, i) => [v.video_id, i]));
  enriched.sort((a, b) => (orderMap.get(a.video_id) || 0) - (orderMap.get(b.video_id) || 0));

  const completeCount = enriched.filter(v => v.metadata_complete).length;
  console.log(`[ENRICHER] Done: ${completeCount}/${enriched.length} have complete metadata`);

  return enriched;
}
