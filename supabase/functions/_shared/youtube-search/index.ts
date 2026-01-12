/**
 * YouTube Search Orchestrator
 *
 * Unified search interface that coordinates multiple sources:
 * 1. Firecrawl (primary) - Scrapes YouTube search page
 * 2. Jina Reader (secondary) - Reads YouTube search page
 * 3. Invidious/Piped (tertiary) - Public API alternatives
 * 4. YouTube API (last resort) - Official API with quota limits
 *
 * Features:
 * - Parallel multi-source search for speed
 * - Automatic deduplication
 * - Metadata enrichment
 * - Quota protection for YouTube API
 */

import {
  YouTubeSearchResult,
  SearchOrchestrationResult,
  SearchOptions,
  toInternalYouTubeVideo,
} from './types.ts';
import { searchViaFirecrawl } from './firecrawl-search.ts';
import { searchViaJina } from './jina-search.ts';
import { searchViaInvidious } from './invidious-search.ts';
import { searchViaYouTubeAPI, canUseYouTubeAPI, getQuotaRemaining } from './youtube-api-search.ts';
import { enrichVideosMetadata } from './metadata-enricher.ts';

// Re-export types
export * from './types.ts';
export { canUseYouTubeAPI, getQuotaRemaining } from './youtube-api-search.ts';

/**
 * Deduplicate results by video_id, keeping the one with more metadata
 */
function deduplicateResults(results: YouTubeSearchResult[]): YouTubeSearchResult[] {
  const seen = new Map<string, YouTubeSearchResult>();

  for (const result of results) {
    const existing = seen.get(result.video_id);
    if (!existing) {
      seen.set(result.video_id, result);
    } else {
      // Keep the one with more complete metadata
      const existingScore = (existing.title ? 1 : 0) +
                           (existing.duration_seconds > 0 ? 1 : 0) +
                           (existing.channel_name ? 1 : 0) +
                           (existing.view_count > 0 ? 1 : 0);
      const newScore = (result.title ? 1 : 0) +
                      (result.duration_seconds > 0 ? 1 : 0) +
                      (result.channel_name ? 1 : 0) +
                      (result.view_count > 0 ? 1 : 0);

      if (newScore > existingScore) {
        seen.set(result.video_id, result);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Main orchestrated YouTube search
 *
 * Runs multiple sources in parallel and merges results.
 */
export async function searchYouTubeOrchestrated(
  options: SearchOptions
): Promise<SearchOrchestrationResult> {
  const {
    query,
    max_results = 20,
    min_results = 3,
    allow_youtube_api = true,
    priority = 'normal',
    enrich_metadata = true,
    timeout_ms = 30000,
  } = options;

  const startTime = Date.now();
  const debug: SearchOrchestrationResult['debug'] = {};
  const fallbacks_used: string[] = [];
  let quota_used = 0;

  console.log(`[ORCHESTRATOR] Starting search: "${query}" (max: ${max_results}, min: ${min_results})`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PARALLEL MULTI-SOURCE SEARCH
  // Run Firecrawl, Jina, and Invidious in parallel for maximum speed
  // ═══════════════════════════════════════════════════════════════════════════

  const searchPromises: Promise<{ source: string; results: YouTubeSearchResult[] }>[] = [];

  // Firecrawl (primary)
  searchPromises.push(
    searchViaFirecrawl(query, max_results, timeout_ms)
      .then(results => ({ source: 'firecrawl', results }))
      .catch(error => {
        debug.firecrawl_error = error instanceof Error ? error.message : String(error);
        return { source: 'firecrawl', results: [] };
      })
  );

  // Jina (secondary)
  searchPromises.push(
    searchViaJina(query, max_results, Math.min(timeout_ms, 20000))
      .then(results => ({ source: 'jina', results }))
      .catch(error => {
        debug.jina_error = error instanceof Error ? error.message : String(error);
        return { source: 'jina', results: [] };
      })
  );

  // Invidious/Piped (tertiary - opportunistic)
  searchPromises.push(
    searchViaInvidious(query, max_results, Math.min(timeout_ms, 15000))
      .then(results => ({ source: 'invidious', results }))
      .catch(error => {
        debug.invidious_error = error instanceof Error ? error.message : String(error);
        return { source: 'invidious', results: [] };
      })
  );

  // Wait for all parallel searches
  const searchResults = await Promise.all(searchPromises);

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE AND DEDUPLICATE RESULTS
  // ═══════════════════════════════════════════════════════════════════════════

  let allResults: YouTubeSearchResult[] = [];
  let primarySource = 'none';

  for (const { source, results } of searchResults) {
    if (results.length > 0) {
      console.log(`[ORCHESTRATOR] ${source} returned ${results.length} results`);
      debug[`${source}_count` as keyof typeof debug] = results.length as any;

      if (primarySource === 'none') {
        primarySource = source;
      } else {
        fallbacks_used.push(source);
      }

      allResults.push(...results);
    }
  }

  // Deduplicate
  allResults = deduplicateResults(allResults);
  console.log(`[ORCHESTRATOR] After deduplication: ${allResults.length} unique videos`);

  // ═══════════════════════════════════════════════════════════════════════════
  // YOUTUBE API FALLBACK (if needed and allowed)
  // ═══════════════════════════════════════════════════════════════════════════

  if (allResults.length < min_results && allow_youtube_api) {
    const canUse = canUseYouTubeAPI(priority);

    if (canUse) {
      console.log(`[ORCHESTRATOR] Results below minimum (${allResults.length}/${min_results}), trying YouTube API...`);
      fallbacks_used.push('youtube_api');

      try {
        const ytResult = await searchViaYouTubeAPI(query, max_results, timeout_ms);

        if (ytResult.results.length > 0) {
          debug.youtube_api_count = ytResult.results.length;
          quota_used = ytResult.quota_used;

          // Add YouTube API results (they have complete metadata)
          const existingIds = new Set(allResults.map(r => r.video_id));
          for (const result of ytResult.results) {
            if (!existingIds.has(result.video_id)) {
              allResults.push(result);
              existingIds.add(result.video_id);
            }
          }

          if (primarySource === 'none') {
            primarySource = 'youtube_api';
          }
        }
      } catch (error) {
        debug.youtube_api_error = error instanceof Error ? error.message : String(error);
      }
    } else {
      const remaining = getQuotaRemaining();
      debug.youtube_api_error = `Quota guard: ${remaining} units remaining, skipping`;
      console.log(`[ORCHESTRATOR] YouTube API skipped: ${remaining} quota remaining`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // METADATA ENRICHMENT
  // ═══════════════════════════════════════════════════════════════════════════

  if (enrich_metadata && allResults.length > 0) {
    const incompleteCount = allResults.filter(r => !r.metadata_complete).length;

    if (incompleteCount > 0) {
      console.log(`[ORCHESTRATOR] Enriching metadata for ${incompleteCount} videos...`);
      allResults = await enrichVideosMetadata(allResults.slice(0, max_results), {
        useOEmbed: true,
        useInvidious: true,
        useFirecrawl: false, // Too expensive for batch
        concurrency: 5,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL RESULT
  // ═══════════════════════════════════════════════════════════════════════════

  const finalResults = allResults.slice(0, max_results);
  const totalTime = Date.now() - startTime;

  console.log(`[ORCHESTRATOR] Complete: ${finalResults.length} videos via ${primarySource} in ${totalTime}ms`);
  if (fallbacks_used.length > 0) {
    console.log(`[ORCHESTRATOR] Also used: ${fallbacks_used.join(', ')}`);
  }

  return {
    results: finalResults,
    source: primarySource,
    fallbacks_used,
    cache_hit: false, // Cache is handled at a higher level
    quota_used,
    total_time_ms: totalTime,
    debug: Object.keys(debug).length > 0 ? debug : undefined,
  };
}

/**
 * Convert orchestrated results to internal YouTubeVideo format
 * (for compatibility with existing code)
 */
export function toYouTubeVideoArray(results: YouTubeSearchResult[]): any[] {
  return results.map(toInternalYouTubeVideo);
}
