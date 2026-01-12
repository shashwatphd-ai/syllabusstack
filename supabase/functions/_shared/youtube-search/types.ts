/**
 * Shared types for YouTube search orchestration
 */

export interface YouTubeSearchResult {
  video_id: string;
  title: string;
  description: string;
  channel_name: string;
  channel_id?: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  like_count?: number;
  published_at?: string;
  source: 'firecrawl' | 'jina' | 'invidious' | 'piped' | 'youtube_api' | 'cache';
  metadata_complete: boolean;
}

export interface SearchOrchestrationResult {
  results: YouTubeSearchResult[];
  source: string;
  fallbacks_used: string[];
  cache_hit: boolean;
  quota_used: number;
  total_time_ms: number;
  debug?: {
    firecrawl_error?: string;
    firecrawl_count?: number;
    jina_error?: string;
    jina_count?: number;
    invidious_error?: string;
    invidious_count?: number;
    youtube_api_error?: string;
    youtube_api_count?: number;
  };
}

export interface SearchOptions {
  query: string;
  max_results?: number;           // Default: 20
  min_results?: number;           // Default: 3 (triggers additional sources if below)
  allow_youtube_api?: boolean;    // Default: true
  priority?: 'normal' | 'high';   // High = allow more quota usage
  enrich_metadata?: boolean;      // Default: true
  timeout_ms?: number;            // Default: 30000
}

export interface FirecrawlVideoExtract {
  title: string;
  video_id: string;
  channel_name: string;
  duration: string;
  views: string;
  published: string;
}

export interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    extract?: {
      videos?: FirecrawlVideoExtract[];
    };
  };
  error?: string;
}

export interface JinaResponse {
  content: string;
  title?: string;
  url?: string;
}

// For internal use - maps to existing YouTubeVideo interface
export interface InternalYouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: number;
  viewCount: number;
  likeCount: number;
}

// Conversion helper
export function toYouTubeSearchResult(
  video: InternalYouTubeVideo,
  source: YouTubeSearchResult['source']
): YouTubeSearchResult {
  return {
    video_id: video.id,
    title: video.title,
    description: video.description,
    channel_name: video.channelTitle,
    channel_id: video.channelId,
    thumbnail_url: video.thumbnailUrl,
    duration_seconds: video.duration,
    view_count: video.viewCount,
    like_count: video.likeCount,
    published_at: video.publishedAt,
    source,
    metadata_complete: !!(video.title && video.duration && video.channelTitle),
  };
}

export function toInternalYouTubeVideo(result: YouTubeSearchResult): InternalYouTubeVideo {
  return {
    id: result.video_id,
    title: result.title,
    description: result.description,
    channelTitle: result.channel_name,
    channelId: result.channel_id || '',
    publishedAt: result.published_at || new Date().toISOString(),
    thumbnailUrl: result.thumbnail_url,
    duration: result.duration_seconds,
    viewCount: result.view_count,
    likeCount: result.like_count || 0,
  };
}
