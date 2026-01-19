/**
 * Content Search Caching Utilities
 * Enhanced with DYNAMIC semantic matching, synonym support, and query normalization
 *
 * Cache Lookup Order:
 * 1. Exact match in cache
 * 2. Semantic similarity match (dynamic threshold based on query complexity)
 * 3. Dynamic synonym match (learned from syllabus content)
 * 4. Library content match
 * 5. Khan Academy search (free, unlimited)
 * 6. YouTube search (quota-limited fallback)
 *
 * NOTE: All synonyms are now DYNAMICALLY learned from syllabus content.
 * No hardcoded concept lists - the system learns from each syllabus.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import {
  getDynamicSynonyms,
  normalizeQueryDynamic,
  calculateDynamicSimilarity,
  extractDomainTerms,
  detectDomain,
} from './dynamic-terms.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Re-export dynamic term utilities for external use
export {
  extractDomainTerms,
  detectDomain,
  getDynamicSynonyms,
  normalizeQueryDynamic,
  calculateDynamicSimilarity,
} from './dynamic-terms.ts';

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
  source: 'cache' | 'similar' | 'synonym' | 'library' | 'khan_academy' | 'youtube';
  cacheId?: string;
  matchedConcept?: string;
}

// YouTube API quota limits
const YOUTUBE_DAILY_QUOTA = 10000;
const YOUTUBE_SEARCH_COST = 100; // Each search costs 100 quota units

/**
 * Get synonyms for a concept - NOW DYNAMIC
 * Fetches from database instead of hardcoded list
 */
export async function getConceptSynonyms(
  concept: string,
  courseId?: string
): Promise<string[]> {
  return getDynamicSynonyms(concept, courseId);
}

/**
 * Synchronous version for backwards compatibility
 * Returns empty array - use async version for actual synonyms
 * @deprecated Use async getConceptSynonyms instead
 */
export function getConceptSynonymsSync(concept: string): string[] {
  console.warn('[CACHE] getConceptSynonymsSync is deprecated, use async getConceptSynonyms');
  return [];
}

/**
 * Normalize a search query for deduplication - NOW DYNAMIC
 * Uses domain-aware normalization from dynamic-terms
 */
export function normalizeQuery(query: string, domain?: string): string {
  return normalizeQueryDynamic(query, domain);
}

/**
 * Calculate keyword overlap between two sets
 */
export function calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1.map(k => k.toLowerCase()));
  const set2 = new Set(keywords2.map(k => k.toLowerCase()));

  let matches = 0;
  for (const word of set1) {
    if (set2.has(word)) matches++;
  }

  // Calculate Jaccard similarity
  const union = new Set([...set1, ...set2]);
  return matches / union.size;
}

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
 * Check cache for existing search results (enhanced with DYNAMIC synonym matching)
 *
 * @param searchConcept - The concept to search for
 * @param source - Content source type
 * @param courseId - Optional instructor_course_id for course-specific synonyms
 */
export async function checkCache(
  searchConcept: string,
  source: 'youtube' | 'khan_academy' | 'library' = 'youtube',
  courseId?: string
): Promise<CacheSearchResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const keywords = extractKeywords(searchConcept);
  const normalizedConcept = normalizeQuery(searchConcept);

  // Step 1: Try exact match first
  const { data: exactMatch } = await supabase
    .from('content_search_cache')
    .select('id, results, search_concept')
    .eq('search_concept', searchConcept.toLowerCase().trim())
    .eq('source', source)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (exactMatch) {
    try { await supabase.rpc('increment_cache_hit', { cache_id: exactMatch.id }); } catch { /* ignore */ }
    console.log(`[CACHE] Exact match for: "${searchConcept.substring(0, 50)}..."`);
    return {
      found: true,
      results: exactMatch.results as ContentItem[],
      source: 'cache',
      cacheId: exactMatch.id,
      matchedConcept: exactMatch.search_concept,
    };
  }

  // Step 2: Try normalized query match
  const { data: normalizedMatch } = await supabase
    .from('content_search_cache')
    .select('id, results, search_concept')
    .eq('source', source)
    .gt('expires_at', new Date().toISOString());

  if (normalizedMatch) {
    for (const cache of normalizedMatch) {
      const cachedNormalized = normalizeQuery(cache.search_concept);
      if (cachedNormalized === normalizedConcept && cachedNormalized.length > 5) {
        try { await supabase.rpc('increment_cache_hit', { cache_id: cache.id }); } catch { /* ignore */ }
        console.log(`[CACHE] Normalized match: "${cache.search_concept}" for "${searchConcept.substring(0, 30)}..."`);
        return {
          found: true,
          results: cache.results as ContentItem[],
          source: 'similar',
          cacheId: cache.id,
          matchedConcept: cache.search_concept,
        };
      }
    }
  }

  // Step 3: Try DYNAMIC semantic similarity match with adaptive threshold
  // Use database function that incorporates learned synonyms
  const dynamicThreshold = keywords.length <= 3 ? 0.7 : keywords.length <= 6 ? 0.6 : 0.5;

  const { data: similarMatch } = await supabase.rpc('find_similar_cached_search_dynamic', {
    p_keywords: keywords,
    p_source: source,
    p_min_overlap: dynamicThreshold,
    p_course_id: courseId || null,
  });

  if (similarMatch && similarMatch.length > 0) {
    const match = similarMatch[0] as CachedResult;
    try { await supabase.rpc('increment_cache_hit', { cache_id: match.id }); } catch { /* ignore */ }
    console.log(`[CACHE] Dynamic semantic match (${Math.round((match.similarity_score || 0) * 100)}%, threshold: ${Math.round(dynamicThreshold * 100)}%): "${match.search_concept}" for "${searchConcept.substring(0, 30)}..."`);
    return {
      found: true,
      results: match.results,
      source: 'similar',
      cacheId: match.id,
      matchedConcept: match.search_concept,
    };
  }

  // Fallback: Try the non-dynamic version if dynamic function doesn't exist yet
  let fallbackMatch = null;
  try {
    const result = await supabase.rpc('find_similar_cached_search', {
      p_keywords: keywords,
      p_source: source,
      p_min_overlap: dynamicThreshold,
    });
    fallbackMatch = result.data;
  } catch { /* fallback not available */ }

  if (fallbackMatch && fallbackMatch.length > 0) {
    const match = fallbackMatch[0] as CachedResult;
    try { await supabase.rpc('increment_cache_hit', { cache_id: match.id }); } catch { /* ignore */ }
    console.log(`[CACHE] Fallback semantic match (${Math.round((match.similarity_score || 0) * 100)}%): "${match.search_concept}"`);
    return {
      found: true,
      results: match.results,
      source: 'similar',
      cacheId: match.id,
      matchedConcept: match.search_concept,
    };
  }

  // Step 4: Try DYNAMIC synonym match (learned from syllabus)
  const synonyms = await getConceptSynonyms(searchConcept, courseId);
  if (synonyms.length > 0 && normalizedMatch) {
    for (const cache of normalizedMatch) {
      const cacheLower = cache.search_concept.toLowerCase();
      for (const synonym of synonyms) {
        if (cacheLower.includes(synonym.toLowerCase())) {
          try { await supabase.rpc('increment_cache_hit', { cache_id: cache.id }); } catch { /* ignore */ }
          console.log(`[CACHE] Dynamic synonym match: "${cache.search_concept}" (synonym: ${synonym}) for "${searchConcept.substring(0, 30)}..."`);
          return {
            found: true,
            results: cache.results as ContentItem[],
            source: 'synonym',
            cacheId: cache.id,
            matchedConcept: cache.search_concept,
          };
        }
      }
    }
  }

  console.log(`[CACHE] No match found for: "${searchConcept.substring(0, 50)}..."`);
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
