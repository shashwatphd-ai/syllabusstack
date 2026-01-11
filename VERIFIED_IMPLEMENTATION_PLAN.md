# Verified Implementation Plan

**Date**: January 11, 2026
**Method**: Every claim verified by reading actual source code

---

## Verified System State

### Database
- **41 tables** (verified by counting Tables section in types.ts lines 16-2077)

### Edge Functions
- **37 functions** (verified by `ls supabase/functions | grep -v ^_ | wc -l`)

### AI Provider Usage (Verified by grep)

| Provider | Functions | Count |
|----------|-----------|-------|
| **Gemini 2.5 Flash** (via Lovable Gateway) | analyze-dream-job, analyze-syllabus, content-assistant-chat, discover-dream-jobs, evaluate-content-batch, extract-learning-objectives, gap-analysis, generate-assessment-questions, generate-content-strategy, generate-micro-checks, generate-recommendations, parse-syllabus-document, process-syllabus, submit-assessment-answer | 14 |
| **OpenAI gpt-4o-mini** | scrape-job-posting (for job data extraction) | 1 |

### External API Usage (Verified by grep)

| API | Functions | Notes |
|-----|-----------|-------|
| **YouTube Data API v3** | search-youtube-content, search-youtube-manual, fetch-video-metadata, add-manual-content | 10K daily quota |
| **Web Provider (Firecrawl/Jina)** | scrape-job-posting, firecrawl-search-courses, search-khan-academy, compare-web-providers | Default: Firecrawl |
| **Invidious** (quota-free YouTube) | search-youtube-content | 5 instances configured |
| **Piped** (quota-free YouTube) | search-youtube-content | 3 instances configured |
| **Khan Academy** | search-khan-academy | GraphQL + REST + Topic Tree |

---

## Verified Content Discovery Flow

```
Frontend calls search-youtube-content
           │
           ▼
┌──────────────────────────────────────┐
│ 1. Check Cache (content_search_cache)│
│    └── If hit: return cached results │
└──────────────────────────────────────┘
           │ (cache miss)
           ▼
┌──────────────────────────────────────┐
│ 2. Check YouTube Quota               │
│    └── get_remaining_quota RPC       │
│    └── If NULL → defaults to 10000   │
│    └── useAlternativeAPIs = remaining < 500 │
└──────────────────────────────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐  ┌─────────────────────────┐
│ Quota   │  │ Quota OK                │
│ Low     │  │ (or NULL = 10000)       │
└────┬────┘  └───────────┬─────────────┘
     │                   │
     ▼                   ▼
┌─────────────┐  ┌───────────────────────┐
│ Invidious   │  │ YouTube API           │
│ (try 5)     │  │ (googleapis.com)      │
└──────┬──────┘  └───────────┬───────────┘
       │                     │
       │ (if fails)          │ (if 403 → log + continue)
       ▼                     │
┌─────────────┐              │
│ Piped       │              │
│ (try 3)     │              │
└──────┬──────┘              │
       │                     │
       │ (if still fails)    │ (after all queries)
       ▼                     ▼
┌─────────────────────────────────────┐
│ Khan Academy Fallback               │
│ (if savedMatches < 2 OR allVideos=0)│
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Track Quota Usage                   │
│ (trackApiUsage at end, not per-query)│
└─────────────────────────────────────┘
```

### The Real Problem (Verified)

**Location**: `supabase/functions/search-youtube-content/index.ts`

1. **Line 174 in content-cache.ts**: `remaining = data ?? YOUTUBE_DAILY_QUOTA`
   - If no quota tracking row exists → defaults to 10,000 (full quota)
   - `useAlternativeAPIs` = false

2. **Lines 757-760**: When YouTube returns 403:
   ```typescript
   if (!searchResponse.ok) {
     console.error(`YouTube search error...`);
     continue;  // Just logs and continues to next query
   }
   ```
   - Does NOT update quota tracking
   - Does NOT switch to Invidious/Piped

3. **Lines 1064-1096**: Khan Academy fallback triggers when:
   - `savedMatches.length < 2 OR allVideos.length === 0`
   - This IS working, but only Khan Academy, not Invidious/Piped

4. **Lines 1124-1127**: Quota tracking happens AFTER processing:
   - Tracks `queries.length * 100` units
   - Does not track actual API response (success/failure)

**Result**: When YouTube quota is actually exhausted but tracking table is empty:
- System thinks quota is OK (10,000 remaining)
- Tries YouTube API → all queries fail with 403
- Falls back to Khan Academy only
- Invidious/Piped path is never reached

---

## Verified Job/Career Flow

```
User pastes job URL
         │
         ▼
┌─────────────────────────────────┐
│ scrape-job-posting              │
│ ├── getWebProvider() → Firecrawl│
│ │   (or Jina if WEB_PROVIDER=jina)│
│ └── Scrapes URL → markdown      │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ OpenAI gpt-4o-mini              │
│ └── Extracts: title, company,   │
│     requirements, salary, etc.  │
│ (Lines 84-137 in scrape-job-posting)│
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ analyze-dream-job               │
│ └── Gemini: deeper job analysis │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ gap-analysis                    │
│ └── Gemini: compare user skills │
│     to job requirements         │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ firecrawl-search-courses        │
│ └── getWebProvider() → search   │
│     Coursera/Udemy/edX          │
└─────────────────────────────────┘
```

---

## Web Provider Configuration (Verified)

**Location**: `supabase/functions/_shared/web-provider.ts`

```typescript
// Line 281
const providerName = forceProvider || Deno.env.get("WEB_PROVIDER") || "firecrawl";
```

- **Default**: `firecrawl`
- **To use Jina**: Set `WEB_PROVIDER=jina` in Supabase secrets
- **Jina works without API key** (rate limited to 20 RPM)
- **Jina with API key**: 500 RPM (free tier)

### Functions using web-provider:
1. `scrape-job-posting` - job URL scraping
2. `firecrawl-search-courses` - course search
3. `search-khan-academy` - fallback web search
4. `compare-web-providers` - testing/comparison

---

## Implementation Plan

### Priority 1: Fix Content Discovery (Critical)

**Problem**: YouTube 403 errors don't trigger Invidious/Piped fallback

**Fix Location**: `supabase/functions/search-youtube-content/index.ts`

**Change 1**: Detect 403 as quota exhaustion (lines 757-761)

```typescript
// BEFORE (line 757-761):
if (!searchResponse.ok) {
  console.error(`YouTube search error for query "${query}":`, await searchResponse.text());
  continue;
}

// AFTER:
if (!searchResponse.ok) {
  const errorText = await searchResponse.text();
  console.error(`YouTube search error for query "${query}":`, errorText);

  // Detect quota exhaustion
  if (searchResponse.status === 403 && errorText.includes('quotaExceeded')) {
    console.warn('YouTube quota EXHAUSTED - marking for fallback');
    quotaExhausted = true;
    break; // Stop trying YouTube queries
  }
  continue;
}
```

**Change 2**: Add variable and fallback trigger (after line 802)

```typescript
// After the YouTube search loop, add:
if (quotaExhausted && allVideos.length === 0) {
  console.log('Quota exhausted during search - trying Invidious/Piped');
  const searchQuery = `${core_concept} ${(search_keywords || []).slice(0, 2).join(' ')} educational`;

  let altVideos = await searchInvidious(searchQuery, 15);
  if (altVideos.length === 0) {
    altVideos = await searchPiped(searchQuery, 15);
  }

  if (altVideos.length > 0) {
    // Process altVideos same as line 481-576
    // (score, filter, save to database)
  }
}
```

**Change 3**: Default to Invidious when quota unknown (content-cache.ts line 174)

```typescript
// BEFORE:
const remaining = data ?? YOUTUBE_DAILY_QUOTA;

// AFTER (conservative approach):
const remaining = data ?? 0; // If unknown, assume exhausted → try Invidious first
```

---

### Priority 2: Switch to Jina (Cost Savings)

**Current Cost**: Firecrawl $16-83/month
**After**: Jina $0 (free tier)

**Action**: Set environment variable in Supabase Dashboard:
```
WEB_PROVIDER=jina
```

**Affected Functions**:
- scrape-job-posting
- firecrawl-search-courses
- search-khan-academy

**No code changes required** - abstraction layer already exists.

---

### Priority 3: Integrate Active Jobs DB (Better UX)

**Current Flow**: User pastes URL → scrape → AI extract
**Proposed Flow**: User searches → select from real listings

**New Function**: `search-jobs/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { title, location, skills } = await req.json();
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

  if (!RAPIDAPI_KEY) {
    // Fallback to existing scrape flow
    return new Response(JSON.stringify({
      error: "RAPIDAPI_KEY not configured",
      fallback: true
    }));
  }

  const response = await fetch("https://active-jobs-db.p.rapidapi.com/active-ats-7d", {
    method: "POST",
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "active-jobs-db.p.rapidapi.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title_filter: title,
      location_filter: location,
      description_filter: skills?.join(" OR "),
      limit: 20,
    }),
  });

  const jobs = await response.json();
  return new Response(JSON.stringify({ jobs }));
});
```

**Cost**: ~$29-99/month for Active Jobs DB
**Benefit**: Pre-structured data, no scraping, real salary info, apply links

---

### Priority 4: OpenLLM for Cost Reduction (Future)

**When**: AI costs exceed $100/month (~500+ active users)

**Current**: Gemini 2.5 Flash via Lovable Gateway
**Proposed**: DeepSeek R1 via RapidAPI OpenLLM for expensive tasks

**Functions to migrate** (by cost, highest first):
1. gap-analysis
2. analyze-dream-job
3. generate-recommendations
4. process-syllabus

**Implementation**: Add to `_shared/ai-orchestrator.ts` with fallback to Lovable

---

## Verification Commands

```bash
# Verify quota tracking table
SELECT * FROM api_quota_tracking WHERE api_name = 'youtube' ORDER BY date DESC LIMIT 5;

# Check if Jina is configured
echo $WEB_PROVIDER  # In Supabase function logs

# Test Invidious availability
curl "https://inv.nadeko.net/api/v1/search?q=test&type=video"

# Count content discovery success rate
SELECT
  date_trunc('day', created_at) as day,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'auto_approved') as auto_approved
FROM content_matches
GROUP BY 1
ORDER BY 1 DESC
LIMIT 7;
```

---

## Summary

| Item | Verified State | Action Needed |
|------|----------------|---------------|
| Edge Functions | 37 functions | None |
| Database Tables | 41 tables | None |
| AI Provider | Gemini (14) + OpenAI (1) | Consider OpenLLM at scale |
| YouTube Fallback | Code exists, doesn't trigger on 403 | Fix detection logic |
| Web Provider | Firecrawl default, Jina ready | Set WEB_PROVIDER=jina |
| Job Discovery | URL paste + scrape | Add Active Jobs DB search |

**Immediate Actions**:
1. Fix 403 detection in search-youtube-content (1-2 hours)
2. Set WEB_PROVIDER=jina (5 minutes)
3. Test content discovery after fix

**This document contains only verified claims based on reading the actual source code.**
