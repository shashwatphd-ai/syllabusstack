# Action Plan

## Problem Statement

When a user clicks "Find Content" for a learning objective:
1. System checks YouTube quota → table is empty → assumes 10,000 remaining
2. Tries YouTube API → gets 403 (quota actually exhausted)
3. Logs error, tries next query → also fails
4. Falls back to Khan Academy only
5. Invidious/Piped (free YouTube alternatives) never tried

**Result**: Users get 0 or few results when YouTube quota is exhausted.

---

## Action 1: Fix YouTube 403 Detection

### What It Does
Detects when YouTube returns 403 "quotaExceeded" and switches to Invidious/Piped immediately.

### The Change

**File**: `supabase/functions/search-youtube-content/index.ts`

**Before** (lines 757-761):
```typescript
if (!searchResponse.ok) {
  console.error(`YouTube search error for query "${query}":`, await searchResponse.text());
  continue;
}
```

**After**:
```typescript
if (!searchResponse.ok) {
  const errorText = await searchResponse.text();
  console.error(`YouTube search error for query "${query}":`, errorText);

  // Detect quota exhaustion - stop trying YouTube
  if (searchResponse.status === 403 && errorText.includes('quotaExceeded')) {
    console.warn('YouTube quota EXHAUSTED - switching to Invidious/Piped');
    youtubeQuotaExhausted = true;
    break;
  }
  continue;
}
```

**Add after line 802** (after the YouTube search loop):
```typescript
// If YouTube quota exhausted during search, try Invidious/Piped
if (youtubeQuotaExhausted && allVideos.length === 0) {
  console.log('Triggering Invidious/Piped fallback after YouTube 403');
  const searchQuery = `${core_concept} ${(search_keywords || []).slice(0, 2).join(' ')} educational`;

  let altVideos = await searchInvidious(searchQuery, 15);
  if (altVideos.length === 0) {
    console.log('Invidious failed, trying Piped...');
    altVideos = await searchPiped(searchQuery, 15);
  }

  // Add to allVideos for processing
  allVideos.push(...altVideos);
  console.log(`Alternative APIs found ${altVideos.length} videos`);
}
```

**Add variable declaration** (around line 730, before the search loop):
```typescript
let youtubeQuotaExhausted = false;
```

### Why This Works
- Currently: 403 is logged but code continues trying more queries (all fail)
- After: First 403 stops the loop and triggers Invidious/Piped
- Invidious/Piped use the same YouTube content but have no quota limits

### Intended Consequences
- Content discovery works even when YouTube quota is exhausted
- Users get results from Invidious/Piped (same videos, different API)
- No additional cost (Invidious/Piped are free)

### Unintended Consequences
- **Slower response**: Invidious/Piped may be slower than YouTube API
- **Less metadata**: Invidious doesn't return like counts
- **Instance failures**: If all 5 Invidious + 3 Piped instances are down, still fails
- **Different results**: Invidious search ranking may differ from YouTube's

### Risk Level: Low
The fallback code already exists and is tested (lines 49-130). We're just triggering it in a new scenario.

---

## Action 2: Default Unknown Quota to Zero

### What It Does
When quota tracking table has no data for today, assume quota is exhausted instead of full.

### The Change

**File**: `supabase/functions/_shared/content-cache.ts`

**Before** (line 174):
```typescript
const remaining = data ?? YOUTUBE_DAILY_QUOTA;
```

**After**:
```typescript
// If no tracking data, be conservative - assume quota may be exhausted
// This forces Invidious/Piped first, which is free and has no limits
const remaining = data ?? 0;
```

### Why This Works
- Currently: Empty table → assumes 10,000 remaining → tries YouTube → fails
- After: Empty table → assumes 0 remaining → tries Invidious/Piped first → works

### Intended Consequences
- First search of the day uses Invidious/Piped (free)
- Once YouTube is successfully used, tracking starts and quota is known
- Saves YouTube quota for cases where Invidious/Piped fail

### Unintended Consequences
- **YouTube API rarely used**: If Invidious/Piped always work, YouTube API becomes backup only
- **Less accurate metadata**: Invidious provides less data than YouTube API
- **Depends on third-party instances**: Invidious/Piped are community-run

### Risk Level: Medium
This changes default behavior. YouTube API becomes secondary instead of primary.

### Alternative: Keep YouTube Primary
If you want YouTube API to remain primary, skip this change and only do Action 1.

---

## Action 3: Switch Web Provider to Jina

### What It Does
Changes web scraping/search from Firecrawl ($16-83/month) to Jina (free).

### The Change

**In Supabase Dashboard** → Edge Functions → Secrets:
```
WEB_PROVIDER=jina
```

No code changes needed. The abstraction layer already exists.

### Why This Works
- `web-provider.ts` line 281: `Deno.env.get("WEB_PROVIDER") || "firecrawl"`
- Setting the env var switches the provider
- Both providers return the same format (SearchResult, ScrapeResult)

### Affected Functions
1. `scrape-job-posting` - scrapes job URLs for dream job analysis
2. `firecrawl-search-courses` - searches Coursera/Udemy/edX for courses
3. `search-khan-academy` - web fallback when GraphQL fails

### Intended Consequences
- **Cost savings**: $16-83/month → $0
- **Same functionality**: Both providers do search + scrape
- **No code changes**: Abstraction handles the switch

### Unintended Consequences
- **Rate limits**: Jina free tier is 20 requests/minute (vs Firecrawl's higher limits)
- **Different results**: Jina and Firecrawl may return different search results
- **Reliability unknown**: Jina uptime vs Firecrawl uptime not compared
- **Job scraping quality**: May affect how well job postings are scraped

### Risk Level: Medium
Affects 3 functions. Should test job posting scraping and course search after switching.

### Mitigation
Use `compare-web-providers` function to test both before switching:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/compare-web-providers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"mode": "search", "query": "python course site:coursera.org"}'
```

---

## Action 4: Add Active Jobs DB (Optional)

### What It Does
Adds job search capability using RapidAPI's Active Jobs DB instead of URL scraping.

### The Change

**New file**: `supabase/functions/search-jobs/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, location, skills, limit = 20 } = await req.json();
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

    if (!RAPIDAPI_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RAPIDAPI_KEY not configured",
          message: "Please paste a job URL instead"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        location_filter: location || undefined,
        description_filter: skills?.join(" OR ") || undefined,
        limit,
      }),
    });

    if (!response.ok) {
      throw new Error(`Active Jobs DB error: ${response.status}`);
    }

    const jobs = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        jobs: jobs.map((job: any) => ({
          title: job.title,
          company: job.company,
          location: job.location,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          requirements: job.requirements || [],
          description: job.description,
          apply_url: job.apply_url,
          posted_date: job.posted_date,
        })),
        total: jobs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-jobs:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Why This Works
- Current: User pastes URL → scrape → OpenAI extracts data
- After: User searches → pre-structured data → no scraping/AI needed

### Intended Consequences
- **Better UX**: Search instead of paste
- **Real salary data**: Active Jobs DB has actual salary ranges
- **Apply links**: Direct links to apply
- **No AI cost**: Data is pre-structured, no extraction needed
- **Faster**: No scraping delay

### Unintended Consequences
- **Monthly cost**: ~$29-99/month for Active Jobs DB
- **Limited jobs**: Only jobs in their database (not all job sites)
- **API dependency**: If RapidAPI down, job search fails
- **Requires frontend changes**: Need to add search UI to dream jobs page

### Risk Level: Low (additive)
This is a new function. Existing URL-paste flow still works as fallback.

---

## Summary Table

| Action | Change | Benefit | Risk | Cost |
|--------|--------|---------|------|------|
| 1. Fix 403 detection | Code change | Content discovery works | Low | $0 |
| 2. Default quota to 0 | Code change | Invidious/Piped first | Medium | $0 |
| 3. Switch to Jina | Env var | Save $16-83/mo | Medium | $0 |
| 4. Add Active Jobs DB | New function | Better job discovery | Low | $29-99/mo |

---

## Recommended Order

### Phase 1: Immediate (Today)
1. **Action 1 only** - Fix 403 detection
   - Lowest risk
   - Fixes the immediate problem
   - Keeps YouTube as primary

### Phase 2: After Testing (This Week)
2. **Action 3** - Switch to Jina
   - Run compare-web-providers first
   - Test job scraping manually
   - Monitor for issues

### Phase 3: Optional Enhancement
3. **Action 4** - Add Active Jobs DB
   - Only if budget allows
   - Requires frontend work too

### Phase 4: Consider Later
4. **Action 2** - Default quota to 0
   - Only if you want Invidious/Piped as primary
   - Changes system behavior significantly

---

## How to Implement Action 1

```bash
# 1. Open the file
code supabase/functions/search-youtube-content/index.ts

# 2. Around line 730, add:
let youtubeQuotaExhausted = false;

# 3. Replace lines 757-761 with the new code (see above)

# 4. After line 802, add the fallback trigger (see above)

# 5. Deploy
supabase functions deploy search-youtube-content

# 6. Test
# - Use the app to search for content
# - Check function logs for "YouTube quota EXHAUSTED" or "Invidious" messages
```

---

## Rollback Plan

If Action 1 causes issues:
```bash
# Revert to previous version
git checkout HEAD~1 -- supabase/functions/search-youtube-content/index.ts
supabase functions deploy search-youtube-content
```

If Action 3 (Jina) causes issues:
```bash
# In Supabase Dashboard, remove or change:
WEB_PROVIDER=firecrawl
# Or just delete the WEB_PROVIDER secret (defaults to firecrawl)
```
