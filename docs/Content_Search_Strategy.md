# Content Search Strategy: Optimized for Cost & Quality

> **Version:** 1.0
> **Date:** 2026-01-08
> **Purpose:** Address YouTube API quota limits (10K units/day) with smart caching and multi-source approach

---

## Problem Statement

**YouTube API Quota:** 10,000 units/day
- Search request: ~100 units
- Video details: ~3 units per video
- **Result:** ~100 searches/day maximum
- **Impact:** 1 syllabus with 20 LOs × 6 queries each = 120 searches = quota exceeded

**Khan Academy API:** Officially removed in 2020
- Internal GraphQL API exists (server-accessible, CORS blocked for browsers)
- oEmbed still works for metadata retrieval
- Current implementation uses Firecrawl (paid)

---

## Solution: Multi-Tier Caching + Smart Deduplication

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTENT SEARCH PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    TIER 1: CONCEPT CACHE                          │   │
│  │  "Introduction to Machine Learning" → cached results (30 days)   │   │
│  │  Similar concepts share cached results                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼ Cache Miss                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    TIER 2: CONTENT LIBRARY                        │   │
│  │  Check existing content table for matching videos                 │   │
│  │  Match by: title keywords, channel, topic similarity              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼ No Match                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    TIER 3: KHAN ACADEMY (FREE)                    │   │
│  │  Server-side GraphQL access (bypasses CORS)                       │   │
│  │  High-quality, trusted educational content                        │   │
│  │  Auto-approve at lower threshold (0.45 vs 0.55)                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼ Insufficient Results (<3)                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    TIER 4: YOUTUBE (QUOTA-LIMITED)                │   │
│  │  Only when cache + Khan Academy insufficient                      │   │
│  │  Results cached for 30 days                                       │   │
│  │  Semantic deduplication across LOs                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Concept-Level Caching (New Table)

```sql
CREATE TABLE content_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_hash TEXT NOT NULL,              -- Hash of normalized search concept
  concept_text TEXT NOT NULL,              -- Original concept text
  bloom_level TEXT,                        -- Bloom's taxonomy level
  domain TEXT,                             -- Subject domain
  search_results JSONB NOT NULL,           -- Cached API response
  source TEXT NOT NULL,                    -- 'youtube' | 'khan_academy'
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  hit_count INTEGER DEFAULT 0,             -- Track cache utilization

  UNIQUE(concept_hash, source)
);

CREATE INDEX idx_cache_concept ON content_search_cache(concept_hash);
CREATE INDEX idx_cache_expires ON content_search_cache(expires_at);
```

### 2. Concept Normalization

Before searching, normalize the concept to maximize cache hits:

```typescript
function normalizeConcept(concept: string): string {
  return concept
    .toLowerCase()
    .replace(/[^\w\s]/g, '')           // Remove punctuation
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .split(' ')
    .filter(w => w.length > 2)          // Remove short words
    .filter(w => !STOP_WORDS.has(w))    // Remove stop words
    .sort()                             // Alphabetize for consistency
    .join(' ');
}

// "Introduction to Machine Learning" → "introduction learning machine"
// "Machine Learning Basics" → "basics learning machine"
// These would have different hashes, but semantic similarity check catches this
```

### 3. Semantic Similarity Pre-Check

Before making API calls, check if similar concepts already have cached results:

```typescript
async function findSimilarCachedConcepts(concept: string, threshold: number = 0.7) {
  const { data: cachedConcepts } = await supabase
    .from('content_search_cache')
    .select('concept_text, concept_hash, search_results')
    .gt('expires_at', new Date().toISOString())
    .limit(50);

  for (const cached of cachedConcepts) {
    const similarity = calculateSimilarity(concept, cached.concept_text);
    if (similarity >= threshold) {
      // Update hit count
      await supabase
        .from('content_search_cache')
        .update({ hit_count: cached.hit_count + 1 })
        .eq('concept_hash', cached.concept_hash);

      return cached.search_results;
    }
  }

  return null;
}
```

### 4. Khan Academy GraphQL Access (Server-Side)

Since Edge Functions run server-side, CORS doesn't apply. We can access Khan Academy's internal GraphQL:

```typescript
const KHAN_GRAPHQL_URL = 'https://www.khanacademy.org/api/internal/graphql';

async function searchKhanAcademy(concept: string, limit: number = 5) {
  const query = `
    query searchContent($query: String!, $limit: Int!) {
      searchContent(query: $query, contentKind: VIDEO, limit: $limit) {
        ... on Video {
          id
          title
          description
          thumbnailUrl
          duration
          translatedYoutubeId
          slug
        }
      }
    }
  `;

  const response = await fetch(KHAN_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SyllabusStack/1.0 (Educational Platform)',
    },
    body: JSON.stringify({
      query,
      variables: { query: concept, limit },
    }),
  });

  if (!response.ok) {
    console.log('Khan Academy GraphQL failed, falling back to oEmbed');
    return null;
  }

  return response.json();
}
```

### 5. YouTube Quota Management

Track and limit YouTube API usage:

```sql
CREATE TABLE youtube_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  units_used INTEGER DEFAULT 0,
  searches_count INTEGER DEFAULT 0,

  UNIQUE(date)
);

-- Function to check if quota allows search
CREATE OR REPLACE FUNCTION can_use_youtube_quota(units_needed INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  daily_limit INTEGER := 9000;  -- Leave 1000 buffer
  current_usage INTEGER;
BEGIN
  SELECT COALESCE(units_used, 0) INTO current_usage
  FROM youtube_quota_usage
  WHERE date = CURRENT_DATE;

  RETURN COALESCE(current_usage, 0) + units_needed <= daily_limit;
END;
$$ LANGUAGE plpgsql;
```

---

## Optimized Search Function Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    searchContent(learning_objective)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. NORMALIZE CONCEPT                                                    │
│     concept = normalizeConcept(lo.core_concept)                         │
│     hash = sha256(concept + bloom_level + domain)                       │
│                                                                          │
│  2. CHECK EXACT CACHE                                                    │
│     SELECT * FROM content_search_cache WHERE concept_hash = hash        │
│     IF found AND not expired → RETURN cached results                    │
│                                                                          │
│  3. CHECK SIMILAR CONCEPTS (Semantic)                                    │
│     similar = findSimilarCachedConcepts(concept, threshold=0.75)        │
│     IF similar found → RETURN similar results                           │
│                                                                          │
│  4. CHECK CONTENT LIBRARY                                                │
│     existing = searchExistingContent(concept, keywords)                 │
│     IF existing.length >= 3 → CREATE matches, RETURN                    │
│                                                                          │
│  5. SEARCH KHAN ACADEMY (FREE)                                          │
│     khanResults = searchKhanAcademy(concept, limit=5)                   │
│     CACHE results                                                        │
│     IF khanResults.length >= 3 → CREATE matches, RETURN                 │
│                                                                          │
│  6. CHECK YOUTUBE QUOTA                                                  │
│     IF NOT can_use_youtube_quota(150) → RETURN khan results only        │
│                                                                          │
│  7. SEARCH YOUTUBE (QUOTA-LIMITED)                                       │
│     youtubeResults = searchYouTube(concept, limit=10)                   │
│     UPDATE youtube_quota_usage                                           │
│     CACHE results                                                        │
│     COMBINE with khan results                                            │
│     CREATE matches, RETURN                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Expected Quota Savings

| Scenario | Without Optimization | With Optimization | Savings |
|----------|---------------------|-------------------|---------|
| First syllabus (20 LOs) | 120 searches | 20 searches | 83% |
| Second similar syllabus | 120 searches | 5 searches (cache hits) | 96% |
| 10 syllabi same subject | 1,200 searches | 100 searches | 92% |

**Key Insight:** Educational content is highly repetitive across syllabi. "Introduction to Statistics" will appear in hundreds of syllabi - we only need to search YouTube once.

---

## Alternative Free Content Sources

### Tier 3B: MIT OpenCourseWare (via RSS/Scraping)

MIT OCW provides RSS feeds for courses:
```
https://ocw.mit.edu/rss/new/ocw_youtube_videos.xml
```

We can parse this periodically and cache locally:

```typescript
async function importMITOpenCourseWare() {
  const rssUrl = 'https://ocw.mit.edu/rss/new/ocw_youtube_videos.xml';
  const response = await fetch(rssUrl);
  const xml = await response.text();

  // Parse RSS and extract video metadata
  const videos = parseRSS(xml);

  // Bulk insert into content table
  for (const video of videos) {
    await supabase.from('content').upsert({
      source_type: 'mit_ocw',
      source_id: video.youtubeId,
      source_url: video.link,
      title: video.title,
      description: video.description,
      channel_name: 'MIT OpenCourseWare',
      quality_score: 0.90, // Pre-vetted educational content
    }, { onConflict: 'source_type,source_id' });
  }
}
```

### Tier 3C: Open Yale Courses

Yale provides video downloads and metadata:
```
https://oyc.yale.edu/courses
```

---

## Implementation Phases

### Phase 1: Quick Wins (4 hours)
1. Add `content_search_cache` table
2. Add concept normalization
3. Add cache check before YouTube API calls
4. Add quota tracking table

### Phase 2: Khan Academy Direct (6 hours)
1. Implement server-side GraphQL access
2. Add fallback to Firecrawl if GraphQL fails
3. Update search priority (Khan first)

### Phase 3: Content Library Growth (Ongoing)
1. Import MIT OCW video catalog
2. Import Open Yale catalog
3. Build semantic index for local search

---

## Monitoring & Alerts

```sql
-- Daily quota usage report
SELECT
  date,
  units_used,
  searches_count,
  ROUND(units_used::numeric / 10000 * 100, 1) as quota_percentage
FROM youtube_quota_usage
ORDER BY date DESC
LIMIT 7;

-- Cache hit rate
SELECT
  DATE(created_at) as date,
  SUM(hit_count) as total_hits,
  COUNT(*) as total_entries,
  ROUND(SUM(hit_count)::numeric / NULLIF(COUNT(*), 0), 2) as avg_hits_per_entry
FROM content_search_cache
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Summary

| Strategy | Impact | Effort |
|----------|--------|--------|
| **Concept Caching** | 80% reduction in API calls | 4 hours |
| **Khan Academy Direct** | Free unlimited searches | 6 hours |
| **Quota Tracking** | Prevent quota exhaustion | 2 hours |
| **Content Library Import** | 90%+ local matches over time | Ongoing |

**Bottom Line:** With aggressive caching and Khan Academy as primary source, we can support 10x more users within free tier limits.

---

*Document prepared for: SyllabusStack Development Team*
*Last Updated: 2026-01-08*
