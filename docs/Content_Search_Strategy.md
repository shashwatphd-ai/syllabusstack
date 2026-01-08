# Content Search Strategy: Optimized for Cost & Quality

> **Version:** 1.0
> **Date:** 2026-01-08
> **Purpose:** Address YouTube API quota limits (10K units/day) with smart caching and multi-source approach

---

## Problem Statement

### YouTube API Quota Crisis

```
YouTube API Quota: 10,000 units/day

Search request: ~100 units
Video details: ~3 units per video
Per search (with details): ~100 + (5 videos × 3) = ~115 units

Reality check:
- 1 syllabus with 20 LOs × 6 search variations = 120 searches
- 120 searches × 115 units = 13,800 units
- Result: QUOTA EXCEEDED after 1 syllabus!
```

### Impact Analysis

| Scenario | Searches Needed | YouTube Units | Quota Status |
|----------|-----------------|---------------|--------------|
| 1 syllabus (20 LOs) | 120 | 13,800 | EXCEEDED |
| 5 users/day | 600 | 69,000 | 7x OVER |
| 50 users/day | 6,000 | 690,000 | 69x OVER |

**Conclusion:** YouTube API as primary source is unsustainable at any scale.

---

## Solution: Multi-Tier Content Search Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTENT SEARCH DECISION TREE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Search Query: "Introduction to Machine Learning Basics"                 │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TIER 1: CONCEPT CACHE (Semantic Similarity)                     │   │
│  │  ──────────────────────────────────────────                      │   │
│  │  Check: content_search_cache WHERE similarity > 0.85             │   │
│  │  Cost: $0 (database query only)                                  │   │
│  │  Expected Hit Rate: 60-80% for common topics                     │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                      │
│                          Cache Miss │                                    │
│                                   ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TIER 2: LOCAL CONTENT LIBRARY                                   │   │
│  │  ──────────────────────────────                                  │   │
│  │  Check: content table WHERE is_available = true                  │   │
│  │  Match: semantic similarity to search query                      │   │
│  │  Cost: $0 (database query only)                                  │   │
│  │  Expected Hit Rate: 40-60% for established courses               │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                      │
│                       Insufficient │ Results                             │
│                                   ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TIER 3: KHAN ACADEMY (GraphQL)                                  │   │
│  │  ─────────────────────────────                                   │   │
│  │  Access: Server-side GraphQL (bypasses CORS)                     │   │
│  │  Endpoint: https://www.khanacademy.org/api/internal/graphql      │   │
│  │  Cost: $0 (free, no API key required)                            │   │
│  │  Quality: High (curated educational content)                     │   │
│  │  Auto-approve threshold: 0.75 (vs 0.85 for YouTube)              │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                      │
│                       Still Need More │                                  │
│                                   ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TIER 4: YOUTUBE API (Quota-Limited)                             │   │
│  │  ─────────────────────────────────                               │   │
│  │  Access: Official API with quota management                      │   │
│  │  Cost: 100-115 units per search (10K/day limit)                  │   │
│  │  Strategy: Use sparingly, cache aggressively                     │   │
│  │  Cache TTL: 30 days                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  All results → Cache to Tier 1 for future queries                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tier 1: Concept-Level Caching

### Database Schema

```sql
-- Create content search cache table
CREATE TABLE content_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Search identification
  search_concept TEXT NOT NULL,              -- Normalized search term
  search_embedding VECTOR(768),              -- For semantic similarity

  -- Results storage
  results JSONB NOT NULL,                    -- Cached search results
  result_count INTEGER DEFAULT 0,

  -- Source tracking
  source TEXT NOT NULL,                      -- 'youtube', 'khan_academy', 'library'

  -- Cache management
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '30 days',
  hit_count INTEGER DEFAULT 0,               -- Track cache hits
  last_hit_at TIMESTAMPTZ,

  -- Indexing
  CONSTRAINT unique_concept_source UNIQUE (search_concept, source)
);

-- Index for similarity search
CREATE INDEX idx_cache_embedding ON content_search_cache
USING ivfflat (search_embedding vector_cosine_ops);

-- Index for expiration
CREATE INDEX idx_cache_expires ON content_search_cache (expires_at);

-- RLS Policies
ALTER TABLE content_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cache is readable by all authenticated users"
  ON content_search_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert cache entries"
  ON content_search_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update cache hits"
  ON content_search_cache FOR UPDATE
  USING (true);
```

### Concept Normalization

```typescript
// supabase/functions/_shared/concept-normalizer.ts

export function normalizeSearchConcept(query: string): string {
  return query
    .toLowerCase()
    .trim()
    // Remove common filler words
    .replace(/\b(introduction|intro|to|basic|basics|fundamentals|of|the|a|an)\b/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Examples:
// "Introduction to Machine Learning Basics" → "machine learning"
// "The Fundamentals of Python Programming" → "python programming"
// "Basic Linear Algebra for Data Science" → "linear algebra data science"
```

### Cache Lookup Algorithm

```typescript
// supabase/functions/_shared/cache-lookup.ts

interface CacheLookupResult {
  hit: boolean;
  results: ContentResult[];
  source: 'cache' | 'fresh';
  similarity?: number;
}

export async function lookupCache(
  supabase: SupabaseClient,
  searchQuery: string,
  embedding: number[]
): Promise<CacheLookupResult> {
  // First: Try exact concept match
  const normalized = normalizeSearchConcept(searchQuery);

  const { data: exactMatch } = await supabase
    .from('content_search_cache')
    .select('*')
    .eq('search_concept', normalized)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (exactMatch) {
    // Update hit count
    await supabase
      .from('content_search_cache')
      .update({
        hit_count: exactMatch.hit_count + 1,
        last_hit_at: new Date().toISOString()
      })
      .eq('id', exactMatch.id);

    return {
      hit: true,
      results: exactMatch.results,
      source: 'cache',
      similarity: 1.0
    };
  }

  // Second: Try semantic similarity match (if embeddings available)
  if (embedding && embedding.length > 0) {
    const { data: semanticMatch } = await supabase.rpc(
      'match_search_cache',
      {
        query_embedding: embedding,
        similarity_threshold: 0.85,
        match_count: 1
      }
    );

    if (semanticMatch && semanticMatch.length > 0) {
      const match = semanticMatch[0];

      // Update hit count
      await supabase
        .from('content_search_cache')
        .update({
          hit_count: match.hit_count + 1,
          last_hit_at: new Date().toISOString()
        })
        .eq('id', match.id);

      return {
        hit: true,
        results: match.results,
        source: 'cache',
        similarity: match.similarity
      };
    }
  }

  return { hit: false, results: [], source: 'fresh' };
}

// Database function for semantic similarity search
// Run this SQL:
/*
CREATE OR REPLACE FUNCTION match_search_cache(
  query_embedding VECTOR(768),
  similarity_threshold FLOAT DEFAULT 0.85,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  search_concept TEXT,
  results JSONB,
  source TEXT,
  hit_count INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.search_concept,
    c.results,
    c.source,
    c.hit_count,
    1 - (c.search_embedding <=> query_embedding) AS similarity
  FROM content_search_cache c
  WHERE c.expires_at > now()
    AND c.search_embedding IS NOT NULL
    AND 1 - (c.search_embedding <=> query_embedding) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
*/
```

---

## Tier 2: Local Content Library

### Existing Content Search

```typescript
// supabase/functions/_shared/library-search.ts

export async function searchLocalLibrary(
  supabase: SupabaseClient,
  query: string,
  embedding: number[],
  limit: number = 10
): Promise<ContentResult[]> {
  // Search existing content that's available and not rejected
  const { data: matches } = await supabase.rpc(
    'search_content_library',
    {
      query_embedding: embedding,
      similarity_threshold: 0.7,
      match_count: limit
    }
  );

  return matches?.map(m => ({
    id: m.id,
    title: m.title,
    url: m.source_url,
    source_type: m.source_type,
    duration_seconds: m.duration_seconds,
    thumbnail_url: m.thumbnail_url,
    channel_name: m.channel_name,
    quality_score: m.quality_score,
    similarity: m.similarity,
    source: 'library'
  })) || [];
}

// Database function:
/*
CREATE OR REPLACE FUNCTION search_content_library(
  query_embedding VECTOR(768),
  similarity_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  source_url TEXT,
  source_type TEXT,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  channel_name TEXT,
  quality_score NUMERIC,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.source_url,
    c.source_type,
    c.duration_seconds,
    c.thumbnail_url,
    c.channel_name,
    c.quality_score,
    1 - (c.content_embedding <=> query_embedding) AS similarity
  FROM content c
  WHERE c.is_available = true
    AND c.content_embedding IS NOT NULL
    AND 1 - (c.content_embedding <=> query_embedding) > similarity_threshold
  ORDER BY
    similarity DESC,
    c.quality_score DESC NULLS LAST
  LIMIT match_count;
END;
$$;
*/
```

---

## Tier 3: Khan Academy Integration

### GraphQL Access (Server-Side)

```typescript
// supabase/functions/search-khan-academy-graphql/index.ts

const KHAN_GRAPHQL_URL = 'https://www.khanacademy.org/api/internal/graphql';

interface KhanVideo {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration: number;
  thumbnailUrl: string;
  nodeUrl: string;
}

const SEARCH_QUERY = `
  query SearchContent($query: String!, $limit: Int!) {
    searchAutocomplete(
      query: $query
      limit: $limit
      contentKinds: [VIDEO, ARTICLE]
    ) {
      contentItems {
        ... on Video {
          id
          title
          slug
          description: descriptionHtml
          duration: durationSeconds
          thumbnailUrl: imageUrl
          nodeUrl: relativeUrl
        }
        ... on Article {
          id
          title
          slug
          description: descriptionHtml
          nodeUrl: relativeUrl
        }
      }
    }
  }
`;

export async function searchKhanAcademy(
  query: string,
  limit: number = 10
): Promise<KhanVideo[]> {
  const response = await fetch(KHAN_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // No API key required for server-side access
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { query, limit }
    })
  });

  if (!response.ok) {
    throw new Error(`Khan Academy API error: ${response.status}`);
  }

  const data = await response.json();

  return data.data?.searchAutocomplete?.contentItems
    ?.filter((item: any) => item.duration) // Filter for videos only
    ?.map((video: any) => ({
      id: video.id,
      title: video.title,
      slug: video.slug,
      description: video.description,
      duration: video.duration,
      thumbnailUrl: video.thumbnailUrl ||
        `https://img.youtube.com/vi/${extractKhanVideoId(video.nodeUrl)}/hqdefault.jpg`,
      nodeUrl: `https://www.khanacademy.org${video.nodeUrl}`
    })) || [];
}

function extractKhanVideoId(url: string): string | null {
  // Khan Academy uses YouTube for many videos
  // Try to extract YouTube ID from internal data if available
  return null;
}
```

### Khan Academy Quality Scoring

```typescript
// Khan Academy content is curated, so we use lower auto-approval threshold

const KHAN_AUTO_APPROVE_THRESHOLD = 0.75; // vs 0.85 for YouTube

export function scoreKhanContent(
  video: KhanVideo,
  loText: string,
  embedding: number[]
): ContentScore {
  // Khan Academy content is pre-vetted for educational quality
  const baseQualityBonus = 0.15; // 15% quality bonus

  const titleSimilarity = calculateSimilarity(video.title, loText);
  const durationFit = calculateDurationFit(video.duration, expectedDuration);

  const totalScore = (
    titleSimilarity * 0.5 +
    durationFit * 0.2 +
    baseQualityBonus +
    0.15 // Authority bonus for Khan Academy
  );

  return {
    totalScore,
    autoApprove: totalScore >= KHAN_AUTO_APPROVE_THRESHOLD,
    source: 'khan_academy',
    reasoning: `Khan Academy curated content. Title match: ${(titleSimilarity * 100).toFixed(0)}%`
  };
}
```

---

## Tier 4: YouTube API (Fallback)

### Quota Management

```typescript
// supabase/functions/_shared/youtube-quota.ts

const DAILY_QUOTA_LIMIT = 10000;
const SEARCH_COST = 100;
const VIDEO_DETAILS_COST = 3;

interface QuotaStatus {
  used: number;
  remaining: number;
  resetAt: Date;
  canSearch: boolean;
}

export async function checkYouTubeQuota(
  supabase: SupabaseClient
): Promise<QuotaStatus> {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('api_quota_tracking')
    .select('*')
    .eq('api_name', 'youtube')
    .eq('date', today)
    .single();

  const used = data?.units_used || 0;
  const remaining = DAILY_QUOTA_LIMIT - used;
  const resetAt = new Date(today + 'T00:00:00Z');
  resetAt.setDate(resetAt.getDate() + 1);

  return {
    used,
    remaining,
    resetAt,
    canSearch: remaining >= (SEARCH_COST + SEARCH_COST * 0.2) // Buffer
  };
}

export async function trackYouTubeQuota(
  supabase: SupabaseClient,
  unitsUsed: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await supabase.rpc('increment_api_quota', {
    p_api_name: 'youtube',
    p_date: today,
    p_units: unitsUsed
  });
}

// Database table and function:
/*
CREATE TABLE api_quota_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  date DATE NOT NULL,
  units_used INTEGER DEFAULT 0,
  UNIQUE(api_name, date)
);

CREATE OR REPLACE FUNCTION increment_api_quota(
  p_api_name TEXT,
  p_date DATE,
  p_units INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO api_quota_tracking (api_name, date, units_used)
  VALUES (p_api_name, p_date, p_units)
  ON CONFLICT (api_name, date)
  DO UPDATE SET units_used = api_quota_tracking.units_used + p_units;
END;
$$;
*/
```

---

## Updated Search Flow

### Complete Implementation

```typescript
// supabase/functions/search-content-unified/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const {
    learning_objective_id,
    lo_text,
    core_concept,
    expected_duration_minutes,
    min_results = 3
  } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const results: ContentResult[] = [];
  const searchSources: string[] = [];

  // Generate embedding for semantic search
  const embedding = await generateEmbedding(lo_text);

  // TIER 1: Check concept cache
  const cacheResult = await lookupCache(supabase, core_concept || lo_text, embedding);
  if (cacheResult.hit) {
    results.push(...cacheResult.results);
    searchSources.push(`cache (similarity: ${cacheResult.similarity?.toFixed(2)})`);
  }

  // TIER 2: Search local library (if need more)
  if (results.length < min_results) {
    const libraryResults = await searchLocalLibrary(
      supabase,
      lo_text,
      embedding,
      min_results - results.length
    );

    if (libraryResults.length > 0) {
      results.push(...libraryResults);
      searchSources.push('library');
    }
  }

  // TIER 3: Search Khan Academy (if need more)
  if (results.length < min_results) {
    try {
      const khanResults = await searchKhanAcademy(core_concept || lo_text, 5);
      const scoredKhan = khanResults.map(video => ({
        ...video,
        ...scoreKhanContent(video, lo_text, embedding)
      }));

      results.push(...scoredKhan);
      searchSources.push('khan_academy');

      // Cache Khan results
      await cacheSearchResults(supabase, core_concept || lo_text, embedding, scoredKhan, 'khan_academy');
    } catch (error) {
      console.error('Khan Academy search failed:', error);
    }
  }

  // TIER 4: Search YouTube (only if still need more AND quota available)
  if (results.length < min_results) {
    const quotaStatus = await checkYouTubeQuota(supabase);

    if (quotaStatus.canSearch) {
      try {
        const youtubeResults = await searchYouTube(core_concept || lo_text, 5);
        const scoredYoutube = await scoreYouTubeResults(youtubeResults, lo_text, embedding);

        results.push(...scoredYoutube);
        searchSources.push('youtube');

        // Track quota usage
        await trackYouTubeQuota(supabase, SEARCH_COST + youtubeResults.length * VIDEO_DETAILS_COST);

        // Cache YouTube results
        await cacheSearchResults(supabase, core_concept || lo_text, embedding, scoredYoutube, 'youtube');
      } catch (error) {
        console.error('YouTube search failed:', error);
      }
    } else {
      console.log('YouTube quota exhausted, skipping');
    }
  }

  // Deduplicate and sort by score
  const uniqueResults = deduplicateResults(results);
  const sortedResults = uniqueResults.sort((a, b) => b.totalScore - a.totalScore);

  // Auto-approve high-scoring results
  const processed = sortedResults.map(result => ({
    ...result,
    status: result.autoApprove ? 'auto_approved' : 'pending'
  }));

  // Save to content_matches
  await saveContentMatches(supabase, learning_objective_id, processed);

  return new Response(
    JSON.stringify({
      success: true,
      total_found: processed.length,
      auto_approved_count: processed.filter(r => r.status === 'auto_approved').length,
      sources_used: searchSources,
      quota_remaining: (await checkYouTubeQuota(supabase)).remaining
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

---

## Expected Savings Analysis

### Before Optimization

| Scenario | Searches | YouTube Units | Days Until Quota |
|----------|----------|---------------|------------------|
| 1 syllabus (20 LOs) | 120 | 13,800 | <1 day |
| 10 syllabi | 1,200 | 138,000 | N/A (exceeded) |

### After Optimization

| Scenario | Cache Hits | Khan Hits | YouTube Calls | YouTube Units | Savings |
|----------|------------|-----------|---------------|---------------|---------|
| 1st syllabus | 0% | 60% | 8 | 920 | 93% |
| 2nd similar | 70% | 20% | 2 | 230 | 98% |
| 10 syllabi (mixed) | 50% | 35% | 30 | 3,450 | 97% |
| 50 users/week | 60% | 30% | 100 | 11,500 | 98% |

### Cache Hit Rate Projections

```
Week 1:  20% cache hit rate (building library)
Week 2:  40% cache hit rate
Week 4:  60% cache hit rate
Week 8:  75% cache hit rate (plateau for common subjects)
Week 12: 80%+ cache hit rate (mature cache)
```

---

## Implementation Checklist

### Database Setup (2 hours)

- [ ] Create `content_search_cache` table
- [ ] Create `api_quota_tracking` table
- [ ] Create `match_search_cache` function
- [ ] Create `search_content_library` function
- [ ] Create `increment_api_quota` function
- [ ] Add indexes for performance

### Edge Functions (8 hours)

- [ ] Create `search-content-unified/index.ts`
- [ ] Create `_shared/concept-normalizer.ts`
- [ ] Create `_shared/cache-lookup.ts`
- [ ] Create `_shared/library-search.ts`
- [ ] Create `_shared/youtube-quota.ts`
- [ ] Update `search-khan-academy/index.ts` to use GraphQL
- [ ] Update `search-youtube-content/index.ts` to check quota

### Testing (2 hours)

- [ ] Test cache hit scenarios
- [ ] Test Khan Academy GraphQL access
- [ ] Test YouTube quota tracking
- [ ] Test result deduplication
- [ ] Load test with 50+ searches

---

## Monitoring & Alerts

### Metrics to Track

```typescript
// Daily metrics to monitor:
const METRICS = {
  cacheHitRate: 'target: > 60%',
  khanSuccessRate: 'target: > 90%',
  youtubeQuotaUsed: 'alert if > 8000',
  avgSearchLatency: 'target: < 2s',
  autoApprovalRate: 'track for quality'
};
```

### Alert Conditions

| Condition | Action |
|-----------|--------|
| YouTube quota > 80% | Email warning to admin |
| Khan Academy API failing | Fallback to YouTube immediately |
| Cache hit rate < 40% | Review normalization algorithm |
| Average latency > 5s | Review database indexes |

---

## Migration Path

### Phase 1: Add Caching (Week 1)

1. Deploy database tables and functions
2. Deploy updated edge functions
3. All searches automatically cached

### Phase 2: Enable Khan Academy (Week 2)

1. Test GraphQL access in production
2. Enable Khan as primary source
3. Monitor quality of results

### Phase 3: Optimize (Week 3-4)

1. Analyze cache hit rates
2. Tune similarity thresholds
3. Pre-populate cache with common topics

---

*Document prepared by: Claude Code Agent*
*Last Updated: 2026-01-08*
