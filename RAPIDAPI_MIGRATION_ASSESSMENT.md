# RapidAPI Migration Technical Assessment (Reconciled)

**Objective:** Evaluate switching from Lovable AI Gateway + Firecrawl to RapidAPI alternatives for cost reduction, higher performance, and scalability with profitability per user.

**Assessment Context:** This reconciled assessment corrects errors from two previous analyses - one from Lovable (biased toward keeping their revenue) and one from my initial analysis (which overestimated Crawler-AI capabilities).

---

## Executive Summary

| Service | Current Provider | RapidAPI Alternative | Recommendation |
|---------|-----------------|---------------------|----------------|
| LLM API | Lovable AI Gateway (Gemini) | OpenLLM (DeepSeek R1) | **SWITCH at >1K users** - saves $25-50/mo initially, scales to $30K+/mo at 100K |
| Web Search | Firecrawl `/v1/search` | **NONE AVAILABLE** | **KEEP Firecrawl** - Crawler-AI has NO search |
| Web Scraping | Firecrawl `/v1/scrape` | Crawler-AI | **ADD as fallback** - not replacement |
| Jobs Data | Firecrawl + OpenAI extraction | Active Jobs DB | **ADD** - eliminates scraping + AI costs |

**Critical Correction:** Crawler-AI **CANNOT** replace Firecrawl. Your `firecrawl-search-courses` function uses Firecrawl's `/v1/search` endpoint (web search), not `/v1/scrape`. Crawler-AI only does scraping.

---

## Part 1: Current Infrastructure (Verified from Codebase)

### 1.1 AI Services Used

| Function | Provider | Model | Endpoint |
|----------|----------|-------|----------|
| Gap Analysis | Lovable Gateway | `gemini-2.5-pro` | `ai.gateway.lovable.dev` |
| Job Requirements | Lovable Gateway | `gemini-2.5-pro` | `ai.gateway.lovable.dev` |
| Syllabus Extraction | Lovable Gateway | `gemini-2.0-flash` | `ai.gateway.lovable.dev` |
| Recommendations | Lovable Gateway | `gemini-2.0-flash` | `ai.gateway.lovable.dev` |
| **Job Scrape Extraction** | **OpenAI Direct** | `gpt-4o-mini` | `api.openai.com` |

**Key Finding:** `scrape-job-posting/index.ts:104` uses OpenAI GPT-4o-mini directly, NOT Lovable AI. This is a separate cost.

### 1.2 Current Pricing (from ai-orchestrator.ts:74-80)

```
gemini-2.0-flash:     $0.075/1M input, $0.30/1M output
gemini-2.5-pro:       $1.25/1M input,  $5.00/1M output
gpt-4o-mini (OpenAI): $0.15/1M input,  $0.60/1M output
```

### 1.3 Firecrawl Usage (Verified)

| Function | Endpoint | Purpose | Can Crawler-AI Replace? |
|----------|----------|---------|------------------------|
| `firecrawl-search-courses` | `/v1/search` | Find courses on Coursera/Udemy/edX | **NO - no search API** |
| `scrape-job-posting` | `/v1/scrape` | Scrape job posting URLs | YES |
| `search-khan-academy` | `/v1/search` (fallback) | Find Khan Academy content | **NO - no search API** |

**Lovable was correct:** Crawler-AI cannot replace Firecrawl because 2 of 3 functions need web SEARCH, not scraping.

### 1.4 Caching Strategy (from ai-cache.ts)

| Task | Cache TTL | Effect |
|------|-----------|--------|
| job_requirements | 7 days | Heavy savings (same job = 0 cost) |
| gap_analysis | 1 hour | Moderate savings |
| capability_analysis | 1 day | Good savings |
| recommendations | 1 day | Good savings |

**Estimated cache hit rate at scale:** 60-80% (reduces costs significantly)

---

## Part 2: Scale-Based Analysis

### Development Stage (Current: ~33 calls/month)

| Metric | Value |
|--------|-------|
| Total AI Calls | ~33/month |
| Total AI Cost | ~$1.59/month |
| Firecrawl Usage | Minimal |
| **Verdict** | Migration NOT worth it - current costs are negligible |

### Early Traction (100-500 students)

| Component | Current Cost | With RapidAPI | Savings |
|-----------|-------------|---------------|---------|
| AI (Lovable) | ~$50-200/mo | ~$25-50/mo | $25-150 |
| Firecrawl | Free tier | Still need Firecrawl | $0 |
| Jobs DB | $0 | +$29/mo | -$29 |
| **Net** | ~$50-200/mo | ~$54-79/mo | **Possible loss** |

**Verdict:** At <500 students, migration may COST more due to Active Jobs DB subscription.

### Growth Stage (1,000-5,000 students)

| Component | Current Cost | With RapidAPI | Savings |
|-----------|-------------|---------------|---------|
| AI (Lovable) | $500-2,000/mo | $100-400/mo | **$400-1,600** |
| Firecrawl | $83/mo (Standard) | $83/mo (keep) | $0 |
| Jobs DB | $0 | +$99/mo | -$99 |
| OpenAI (job extraction) | $30/mo | $0 (Jobs DB) | **$30** |
| **Net** | ~$613-2,113/mo | ~$282-582/mo | **$331-1,531/mo** |

**Verdict:** Migration makes sense. OpenLLM + Active Jobs DB saves 50%+.

### Scale (10,000-100,000 students)

| Component | Current Cost | With RapidAPI | Savings |
|-----------|-------------|---------------|---------|
| AI (Gemini Pro tasks) | $10,000-32,000/mo | $1,200-3,600/mo | **$8,800-28,400** |
| AI (Gemini Flash tasks) | $2,000-6,000/mo | $1,000-3,000/mo | **$1,000-3,000** |
| Firecrawl | $333-1,332/mo | $333-1,332/mo (keep) | $0 |
| Jobs DB | $0 | +$299/mo | -$299 |
| OpenAI (job extraction) | $300-1,000/mo | $0 | **$300-1,000** |
| **Net** | ~$12,633-40,332/mo | ~$2,832-8,231/mo | **$9,801-32,101/mo** |

**Verdict:** Massive savings. Migration is essential for profitability.

---

## Part 3: API-by-API Honest Assessment

### 3.1 OpenLLM (Replace Lovable AI for Pro tasks)

**When to Switch:**
- Switch when Gemini Pro costs exceed $100/month
- This happens around 1,000+ students

**What Works:**
- DeepSeek R1: 89% cheaper than Gemini Pro, comparable quality for reasoning
- OpenAI-compatible API: Minimal code changes
- Your existing fallback logic in `ai-orchestrator.ts` already supports multiple providers

**What Doesn't Work:**
- Need to tune prompts for different model behaviors
- Structured JSON output may differ slightly
- Rate limits on free tier (500-1K requests/month)

**Migration Effort:**
```typescript
// Add ~50 lines to ai-orchestrator.ts
// NOT a rewrite as Lovable claimed

async function makeOpenLLMCall(request: AIRequest, model: string) {
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
  const response = await fetch(
    "https://open-llm.p.rapidapi.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "open-llm.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model, // e.g., "deepseek-r1"
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
      }),
    }
  );
  return response.json();
}
```

**Recommendation:**
- **< 1,000 students:** Keep Lovable (not worth the effort)
- **> 1,000 students:** Add OpenLLM for `job_requirements` + `gap_analysis` (biggest savings)
- **> 5,000 students:** Move all tasks to OpenLLM, keep Lovable as fallback

### 3.2 Crawler-AI (CANNOT Replace Firecrawl)

**Critical Issue:**
```
firecrawl-search-courses/index.ts:79
  fetch("https://api.firecrawl.dev/v1/search", ...)
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         This is WEB SEARCH, not scraping!
```

Crawler-AI only does URL scraping. It has NO search endpoint.

**What Crawler-AI CAN Do:**
- Replace Firecrawl for `scrape-job-posting` (single URL scraping)
- Act as fallback scraper if Firecrawl fails

**What Crawler-AI CANNOT Do:**
- Search for courses on Coursera/Udemy/edX
- Search Khan Academy content

**Recommendation:**
- **Keep Firecrawl** for search functionality
- **Add Crawler-AI** as backup scraper for `scrape-job-posting` only

### 3.3 Active Jobs DB (HIGH VALUE Add)

**Current Job Flow:**
```
User pastes URL → Firecrawl scrapes ($0.001) → OpenAI extracts ($0.0003)
Total: $0.0013/job + friction + failure rate
```

**New Flow with Active Jobs DB:**
```
User types job title → Active Jobs DB returns 20 matches → User selects
Total: $0.006/search, covers 20 jobs = $0.0003/job + ZERO friction
```

**Unique Value:**
1. **Real job listings** with salary data, requirements, application links
2. **No AI extraction needed** (pre-structured)
3. **Better gap analysis** using real requirements, not AI-generated
4. **User engagement** - "Apply now" links create measurable outcomes

**Recommendation:** Add Active Jobs DB at any scale. Even at $29/month, the UX improvement justifies it.

---

## Part 4: Risk Assessment (Honest)

### 4.1 Where Lovable Was Right

| Claim | Accuracy | Nuance |
|-------|----------|--------|
| "Crawler-AI cannot replace Firecrawl" | **TRUE** | No search endpoint |
| "OpenLLM adds complexity" | Partially true | But it's ~50 lines, not a rewrite |
| "Current scale doesn't justify switching" | **TRUE for now** | False at 1K+ students |
| "Built-in fallback logic already exists" | **TRUE** | Makes migration easier, not harder |

### 4.2 Where Lovable Was Wrong

| Claim | Reality |
|-------|---------|
| "No cost savings" | FALSE at scale - $10K-32K/month savings at 100K users |
| "Would need to rewrite ai-orchestrator.ts" | FALSE - add ~50 lines to existing multi-provider pattern |
| "OpenLLM free tier similar to Lovable included" | MISLEADING - Lovable may charge after fair use |
| "Quality risk with open-source models" | OUTDATED - DeepSeek R1 matches GPT-4 on reasoning benchmarks |

### 4.3 Where My Initial Assessment Was Wrong

| Claim | Reality |
|-------|---------|
| "Crawler-AI can replace Firecrawl" | **FALSE** - no search endpoint |
| "Switch everything immediately" | TOO AGGRESSIVE - phase by scale |
| "$35K/month savings" | Only at 100K users with 70% cache miss |

### 4.4 Breaking Changes Risk

| Change | Risk | Mitigation |
|--------|------|------------|
| Add OpenLLM | Medium | Feature flag, A/B test, keep Lovable fallback |
| Add Active Jobs DB | **None** | Additive feature, no existing code changes |
| Add Crawler-AI as backup | Low | Only affects `scrape-job-posting` fallback |
| Replace Firecrawl | **IMPOSSIBLE** | Cannot replace - no search alternative |

---

## Part 5: Phased Implementation Plan

### Phase 1: Zero-Risk Additions (This Week)

**1.1 Add Active Jobs DB**

Create new function (doesn't touch existing code):

```typescript
// NEW FILE: supabase/functions/search-jobs/index.ts
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

serve(async (req) => {
  const { title, location, skills } = await req.json();

  const response = await fetch(
    "https://active-jobs-db.p.rapidapi.com/active-ats-7d",
    {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "active-jobs-db.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title_filter: title,
        location_filter: location,
        description_filter: skills?.join(" "),
        limit: 20,
      }),
    }
  );

  return new Response(JSON.stringify(await response.json()));
});
```

**Impact:** Users get real job listings. No changes to existing code.

### Phase 2: Cost Reduction (When >1K students)

**2.1 Add OpenLLM for Expensive Tasks**

Modify `ai-orchestrator.ts` to route `job_requirements` and `gap_analysis` to DeepSeek R1:

```typescript
// Add new provider
async function makeOpenLLMCall(request: AIRequest, model: string) {
  // ... implementation above
}

// Update makeAICall to check provider preference
async function makeAICall(request: AIRequest, model: string) {
  // Check if this task should use OpenLLM
  const useOpenLLM =
    Deno.env.get("RAPIDAPI_KEY") &&
    ['job_requirements', 'gap_analysis'].includes(request.task);

  if (useOpenLLM) {
    try {
      return await makeOpenLLMCall(request, 'deepseek-r1');
    } catch (e) {
      console.warn("OpenLLM failed, falling back to Lovable:", e);
      // Fall through to existing logic
    }
  }

  // Existing Lovable/Google logic
  const { key, useGoogleDirect } = getAPIConfig();
  // ...
}
```

**Impact:** 89% cost reduction on most expensive tasks. Automatic fallback to Lovable.

### Phase 3: Reliability (When >5K students)

**3.1 Add Crawler-AI as Backup Scraper**

Only for `scrape-job-posting` fallback:

```typescript
// In scrape-job-posting/index.ts, add fallback
async function scrapeWithCrawlerAI(url: string) {
  const response = await fetch(
    "https://crawler-ai.p.rapidapi.com/crawl",
    {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": Deno.env.get("RAPIDAPI_KEY"),
        "X-RapidAPI-Host": "crawler-ai.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, render_js: true }),
    }
  );
  return response.json();
}

// Add to existing flow:
// 1. Try Firecrawl
// 2. If fails, try Crawler-AI
// 3. If both fail, return error
```

---

## Part 6: Cost Projection by Scale

### Per-User Economics

| Scale | Current Cost/User | After Migration | Breakeven Price |
|-------|------------------|-----------------|-----------------|
| 100 students | $0.16 | $0.29 (+Jobs DB) | $1.45/mo |
| 1,000 students | $0.21 | $0.08 | $0.40/mo |
| 10,000 students | $0.25 | $0.06 | $0.30/mo |
| 100,000 students | $0.40 | $0.08 | $0.40/mo |

### Recommended Pricing Strategy

| Your Price | At 1K Users (Current) | At 1K Users (Migrated) | At 100K Users (Migrated) |
|------------|----------------------|------------------------|-------------------------|
| $4.99/mo | 96% margin ($4,780 profit) | 98% margin ($4,910) | 98% margin ($491K) |
| $2.99/mo | 93% margin ($2,780 profit) | 97% margin ($2,910) | 97% margin ($291K) |
| $0.99/mo | 79% margin ($780 profit) | 92% margin ($910) | 92% margin ($91K) |

---

## Part 7: Final Recommendations

### If You Have <500 Students (Now)

1. **Add Active Jobs DB** ($29/mo) - Improves UX significantly
2. **Keep everything else as-is** - Current costs are negligible
3. **Don't add OpenLLM yet** - Not worth the effort

### If You Have 500-5,000 Students

1. **Add OpenLLM for Pro tasks** - Saves $500-2,000/month
2. **Keep Firecrawl** - Cannot be replaced
3. **Add Active Jobs DB** ($99/mo) - Essential for scale
4. **Add Crawler-AI as backup** ($29/mo) - Reliability

### If You Have >5,000 Students

1. **Use OpenLLM for all tasks** - Saves $10,000+/month
2. **Keep Lovable as fallback only** - Reliability
3. **Active Jobs DB Ultra** ($299/mo) - Essential
4. **Consider Firecrawl Growth plan** - Handle volume
5. **Implement aggressive caching** - Target 80%+ hit rate

---

## Summary: What to Do Now

| Priority | Action | Cost | Benefit |
|----------|--------|------|---------|
| 1 | Add Active Jobs DB | $29/mo | Better UX, real jobs, measurable outcomes |
| 2 | Get RAPIDAPI_KEY secret | $0 | Enables future optimizations |
| 3 | Wait for 1K students | - | Then add OpenLLM |
| 4 | Keep Firecrawl | Current | CANNOT be replaced |

**Do NOT:**
- Replace Firecrawl with Crawler-AI (impossible - no search)
- Switch LLM providers before 1K students (not worth effort)
- Over-engineer multi-provider routing (add complexity gradually)

---

*Reconciled Assessment Date: January 10, 2026*
*Prepared for: SyllabusStack Migration Planning*

## Sources

- [Firecrawl Pricing](https://www.firecrawl.dev/pricing)
- [LLM Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)
- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Active Jobs DB on RapidAPI](https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/active-jobs-db)
- [OpenLLM GitHub](https://github.com/bentoml/OpenLLM)
- Codebase analysis: `ai-orchestrator.ts`, `firecrawl-search-courses/index.ts`, `scrape-job-posting/index.ts`
