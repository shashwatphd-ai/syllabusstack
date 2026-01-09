/**
 * Content Search Caching Utilities
 * Phase 0 Task 0.1: Multi-tier caching to reduce YouTube API quota usage by 80-96%
 *
 * Cache Lookup Order:
 * 1. Exact match in cache
 * 2. Semantic similarity match (keyword overlap >= 60%)
 * 3. Library content match
 * 4. Khan Academy search (free, unlimited)
 * 5. YouTube search (quota-limited fallback)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CachedResult {
  id: string;
  search_concept: string;
  results: ContentItem[];
  similarity_score?: number;
}

interface ContentItem {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string;
  duration: string;
  channel_title: string;
  source: 'youtube' | 'khan_academy' | 'library';
  view_count?: number;
}

interface CacheSearchResult {
  found: boolean;
  results: ContentItem[];
  source: 'cache' | 'similar' | 'library' | 'khan_academy' | 'youtube';
  cacheId?: string;
}

// YouTube API quota limits
const YOUTUBE_DAILY_QUOTA = 10000;
const YOUTUBE_SEARCH_COST = 100; // Each search costs 100 quota units

/**
 * Extract keywords from a learning objective or search concept
 */
export function extractKeywords(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'were', 'will', 'with', 'the', 'this', 'but', 'they',
    'have', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'can', 'just', 'should', 'now', 'understand',
    'explain', 'describe', 'identify', 'analyze', 'evaluate', 'apply',
    'demonstrate', 'define', 'compare', 'contrast', 'discuss', 'list',
    'ability', 'able', 'students', 'student', 'learn', 'learning'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10); // Limit to top 10 keywords
}

/**
 * Check cache for existing search results
 */
export async function checkCache(
  searchConcept: string,
  source: 'youtube' | 'khan_academy' | 'library' = 'youtube'
): Promise<CacheSearchResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const keywords = extractKeywords(searchConcept);

  // Step 1: Try exact match first
  const { data: exactMatch } = await supabase
    .from('content_search_cache')
    .select('id, results')
    .eq('search_concept', searchConcept.toLowerCase().trim())
    .eq('source', source)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (exactMatch) {
    // Increment hit count
    await supabase.rpc('increment_cache_hit', { cache_id: exactMatch.id });
    return {
      found: true,
      results: exactMatch.results as ContentItem[],
      source: 'cache',
      cacheId: exactMatch.id,
    };
  }

  // Step 2: Try semantic similarity match
  const { data: similarMatch } = await supabase.rpc('find_similar_cached_search', {
    p_keywords: keywords,
    p_source: source,
    p_min_overlap: 0.6,
  });

  if (similarMatch && similarMatch.length > 0) {
    const match = similarMatch[0] as CachedResult;
    // Increment hit count
    await supabase.rpc('increment_cache_hit', { cache_id: match.id });
    return {
      found: true,
      results: match.results,
      source: 'similar',
      cacheId: match.id,
    };
  }

  return {
    found: false,
    results: [],
    source: source,
  };
}

/**
 * Save search results to cache
 */
export async function saveToCache(
  searchConcept: string,
  results: ContentItem[],
  source: 'youtube' | 'khan_academy' | 'library'
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const keywords = extractKeywords(searchConcept);

  // Set expiry based on source (YouTube results expire faster due to potential takedowns)
  const expiryDays = source === 'youtube' ? 14 : 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  await supabase
    .from('content_search_cache')
    .upsert({
      search_concept: searchConcept.toLowerCase().trim(),
      search_keywords: keywords,
      results,
      source,
      expires_at: expiresAt.toISOString(),
    }, {
      onConflict: 'search_concept,source',
    });
}

/**
 * Check remaining YouTube API quota
 */
export async function checkYouTubeQuota(): Promise<{
  remaining: number;
  canSearch: boolean;
  usedToday: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data } = await supabase.rpc('get_remaining_quota', {
    p_api_name: 'youtube',
    p_daily_limit: YOUTUBE_DAILY_QUOTA,
  });

  const remaining = data ?? YOUTUBE_DAILY_QUOTA;

  return {
    remaining,
    canSearch: remaining >= YOUTUBE_SEARCH_COST,
    usedToday: YOUTUBE_DAILY_QUOTA - remaining,
  };
}

/**
 * Track API usage for quota management
 */
export async function trackApiUsage(
  apiName: 'youtube' | 'khan_academy' | 'gemini',
  units: number = 1
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await supabase.rpc('track_api_usage', {
    p_api_name: apiName,
    p_units: units,
  });
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  hitRate: number;
  bySource: Record<string, number>;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: entries } = await supabase
    .from('content_search_cache')
    .select('source, hit_count')
    .gt('expires_at', new Date().toISOString());

  if (!entries || entries.length === 0) {
    return { totalEntries: 0, hitRate: 0, bySource: {} };
  }

  const totalHits = entries.reduce((sum, e) => sum + (e.hit_count || 0), 0);
  const bySource = entries.reduce((acc, e) => {
    acc[e.source] = (acc[e.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalEntries: entries.length,
    hitRate: totalHits / entries.length,
    bySource,
  };
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data } = await supabase.rpc('cleanup_expired_cache');
  return data ?? 0;
}
