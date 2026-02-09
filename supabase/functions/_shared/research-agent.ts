// ============================================================================
// SHARED RESEARCH AGENT - Perplexity via OpenRouter with caching
// ============================================================================
//
// MERGED FROM:
//   - generate-lecture-slides-v3/index.ts (no cache, v3 quality)
//   - process-batch-research/index.ts (with cache support)
//
// Both paths now get the same research quality + caching.
//

import { searchGrounded } from './unified-ai-client.ts';
import type { TeachingUnitContext, DomainConfig, ResearchContext } from './slide-types.ts';

// Research cache configuration
const CACHE_TTL_DAYS = 7;
const ENABLE_RESEARCH_CACHE = Deno.env.get('ENABLE_RESEARCH_CACHE') !== 'false';

// ============================================================================
// RESEARCH CACHE UTILITIES
// ============================================================================

async function computeTopicHash(searchTerms: string, domain: string): Promise<string> {
  const normalized = `${searchTerms.toLowerCase().trim()}:${domain || 'general'}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getCachedResearch(
  supabase: any,
  searchTerms: string,
  domain: string
): Promise<ResearchContext | null> {
  if (!ENABLE_RESEARCH_CACHE) return null;

  try {
    const topicHash = await computeTopicHash(searchTerms, domain);

    const { data, error } = await supabase
      .from('research_cache')
      .select('*')
      .eq('topic_hash', topicHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;

    // Increment hit count (fire and forget)
    supabase
      .from('research_cache')
      .update({ hit_count: (data.hit_count || 0) + 1 })
      .eq('id', data.id)
      .then(() => {})
      .catch(() => {});

    console.log(`[Research Cache] HIT for: ${searchTerms.substring(0, 50)}...`);
    return data.research_content as ResearchContext;
  } catch (e) {
    console.warn('[Research Cache] Error reading cache:', e);
    return null;
  }
}

async function cacheResearch(
  supabase: any,
  searchTerms: string,
  domain: string,
  research: ResearchContext
): Promise<void> {
  if (!ENABLE_RESEARCH_CACHE) return;

  try {
    const topicHash = await computeTopicHash(searchTerms, domain);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await supabase
      .from('research_cache')
      .upsert({
        topic_hash: topicHash,
        search_terms: searchTerms,
        domain: domain || null,
        research_content: research,
        expires_at: expiresAt.toISOString(),
        hit_count: 0,
      }, {
        onConflict: 'topic_hash',
        ignoreDuplicates: false,
      });

    console.log(`[Research Cache] STORED: ${searchTerms.substring(0, 50)}...`);
  } catch (e) {
    console.warn('[Research Cache] Error writing cache:', e);
  }
}

// ============================================================================
// RESEARCH QUERY BUILDER (canonical, from v3)
// ============================================================================

function buildResearchQuery(
  context: TeachingUnitContext,
  domainConfig: DomainConfig | null
): string {
  const trustedSites = domainConfig?.trusted_sites || ['scholar.google.com', '.edu'];
  const coreConcept = context.required_concepts[0] || context.learning_objective.core_concept || context.title;

  return `Research the topic "${context.title}" for a ${domainConfig?.academic_level || 'university'}-level lecture.

DOMAIN: ${domainConfig?.domain || context.domain}
CORE CONCEPT: ${coreConcept}
WHAT TO TEACH: ${context.what_to_teach}

REQUIRED RESEARCH:
1. Find the CORE DEFINITION of "${context.title}" from authoritative sources
2. Find 2-3 SPECIFIC EXAMPLES or case studies with real data, names, dates
3. Find any COMMON MISCONCEPTIONS and their corrections
4. If this involves a framework or model, describe its visual structure exactly
5. Find recommended readings or resources students should explore

PREFERRED SOURCES: ${trustedSites.join(', ')}
AVOID: ${domainConfig?.avoid_sources?.join(', ') || 'blogs, opinion pieces, unreferenced content'}

Return verified, factually grounded content with citations.`;
}

// ============================================================================
// RESEARCH AGENT - Unified entry point with caching
// ============================================================================

export async function runResearchAgent(
  context: TeachingUnitContext,
  domainConfig: DomainConfig | null,
  supabase?: any
): Promise<ResearchContext> {
  console.log('[Research Agent] Starting research via OpenRouter Perplexity:', context.title);

  const searchTerms = `${context.title} ${context.what_to_teach}`;
  const domain = context.domain;

  // Check cache first (now available in both single and batch paths)
  if (supabase) {
    const cached = await getCachedResearch(supabase, searchTerms, domain);
    if (cached) {
      console.log(`[Research Agent] Using cached research for: ${context.title}`);
      return cached;
    }
  }

  const query = buildResearchQuery(context, domainConfig);

  try {
    const result = await searchGrounded({
      query,
      logPrefix: '[Research Agent]',
    });

    const research: ResearchContext = {
      topic: result.topic,
      grounded_content: result.grounded_content,
      recommended_reading: result.recommended_reading,
      visual_descriptions: result.visual_descriptions,
    };

    console.log(`[Research Agent] Complete: ${research.grounded_content.length} claims, ${research.recommended_reading.length} readings`);

    // Cache the successful result
    if (supabase) {
      await cacheResearch(supabase, searchTerms, domain, research);
    }

    return research;
  } catch (error) {
    console.error('[Research Agent] Error:', error);
    return getEmptyResearchContext(context.title);
  }
}

// ============================================================================
// EMPTY CONTEXT FALLBACK
// ============================================================================

export function getEmptyResearchContext(topic: string): ResearchContext {
  return {
    topic,
    grounded_content: [],
    recommended_reading: [],
    visual_descriptions: [],
  };
}
