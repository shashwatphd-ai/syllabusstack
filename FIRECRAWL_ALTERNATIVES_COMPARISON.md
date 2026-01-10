# Firecrawl Alternatives Comparison

**Your Requirements (from `firecrawl-search-courses/index.ts`):**
1. Web SEARCH with site filtering (`site:coursera.org OR site:udemy.com OR site:edx.org`)
2. Returns markdown content (not just URLs)
3. Single-URL scraping for job postings

---

## Executive Summary

| Provider | Search | Scrape | Markdown | Price/1K ops | Best For |
|----------|--------|--------|----------|--------------|----------|
| **Jina AI** | ✅ | ✅ | ✅ Native | **FREE** (rate limited) | Your use case |
| **Tavily** | ✅ | ✅ | ✅ | $1-8 | AI agents |
| **Serper + Jina** | ✅ | ✅ | ✅ | $1-2 | High volume |
| Firecrawl | ✅ | ✅ | ✅ | $5.30-16.70 | Current |
| Apify | ✅ | ✅ | Via Actor | Variable | Complex workflows |
| SerpAPI | ✅ | ❌ | ❌ | $15 | SERP only |

**Recommendation: Jina AI (FREE) or Tavily ($1-2/1K) can replace Firecrawl at 70-90% cost savings.**

---

## Option 1: Jina AI Reader (BEST VALUE)

### Features
- **Read Mode**: `https://r.jina.ai/` prefix converts any URL to markdown
- **Search Mode**: `https://s.jina.ai/?q=` prefix returns top 5 results WITH content
- **Native markdown output** - perfect for LLMs
- **Open source** - can self-host for zero cost

### Pricing

| Tier | Rate Limit | Cost |
|------|------------|------|
| Free (no API key) | 20 RPM | **$0** |
| Free (with API key) | 500 RPM | **$0** (token-based for extras) |
| ReaderLM-v2 (complex sites) | 500 RPM | 3x tokens |

### Migration Example

```typescript
// CURRENT: Firecrawl search
const response = await fetch("https://api.firecrawl.dev/v1/search", {
  method: "POST",
  headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}` },
  body: JSON.stringify({
    query: "python course site:coursera.org",
    limit: 5,
    scrapeOptions: { formats: ["markdown"] },
  }),
});

// NEW: Jina AI search (FREE!)
const query = encodeURIComponent("python course site:coursera.org");
const response = await fetch(`https://s.jina.ai/?q=${query}`, {
  headers: {
    "Accept": "application/json",
    "X-With-Generated-Alt": "true",  // Get image descriptions
  },
});
// Returns top 5 results with markdown content
```

### Pros
- **FREE** for your current usage
- Native markdown (saves 67% LLM tokens vs HTML)
- Both search AND scraping in one API
- Open source (can self-host)
- 500 RPM with API key

### Cons
- Rate limited without API key (20 RPM)
- Search returns only top 5 results (Firecrawl allows custom limit)
- No site filtering in API (must include in query string)

### Cost Comparison

| Scale | Firecrawl | Jina AI | Savings |
|-------|-----------|---------|---------|
| 500/mo | $16 | **$0** | 100% |
| 3K/mo | $16 | **$0** | 100% |
| 100K/mo | $83 | ~$10* | 88% |

*High volume may need API key with token billing

---

## Option 2: Tavily (BEST FOR AI AGENTS)

### Features
- **Search API**: Returns ranked results with content
- **Extract API**: Scrapes URLs with markdown output
- **Crawl API**: Maps entire domains
- **Built for AI**: Native LangChain/LlamaIndex integration
- **93.3% accuracy** on factual benchmarks

### Pricing

| Plan | Credits/mo | Cost | Per Credit |
|------|------------|------|------------|
| Free | 1,000 | $0 | - |
| Researcher | 5,000 | $40 | $0.008 |
| Professional | 20,000 | $100 | $0.005 |
| Enterprise | 100,000 | $500 | $0.005 |
| Pay-as-you-go | - | - | $0.008/credit |

**Credit Costs:**
- Basic Search: 1 credit
- Advanced Search: 2 credits
- Extract (5 URLs): 1-2 credits

### Migration Example

```typescript
// NEW: Tavily search
const response = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    api_key: TAVILY_API_KEY,
    query: "python course site:coursera.org",
    search_depth: "basic",  // or "advanced" for 2 credits
    include_domains: ["coursera.org", "udemy.com", "edx.org"],
    max_results: 5,
  }),
});
```

### Pros
- Domain filtering built-in (`include_domains`)
- Higher result limits than Jina
- Enterprise SLAs available
- SOC 2 certified
- MCP (Model Context Protocol) support

### Cons
- Not free at scale
- More expensive than Jina for basic use

### Cost Comparison

| Scale | Firecrawl | Tavily | Savings |
|-------|-----------|--------|---------|
| 500/mo | $16 | **$0** (free tier) | 100% |
| 3K/mo | $16 | **$24** | -50% |
| 100K/mo | $83 | **$40** (Researcher) | 52% |

---

## Option 3: Serper + Jina Combo (BEST FOR HIGH VOLUME)

### Strategy
Use **Serper** for cheap Google search, then **Jina** to convert URLs to markdown.

### Serper Pricing

| Volume | Price | Per 1K |
|--------|-------|--------|
| Free | 2,500 queries | $0 |
| 50K | $50 | $1.00 |
| 500K | $150 | $0.30 |
| 2.5M | $375 | $0.15 |

### Migration Example

```typescript
// Step 1: Serper for search results (URLs only)
const searchResponse = await fetch("https://google.serper.dev/search", {
  method: "POST",
  headers: {
    "X-API-KEY": SERPER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    q: "python course site:coursera.org",
    num: 5,
  }),
});
const { organic } = await searchResponse.json();

// Step 2: Jina for markdown conversion (FREE)
const results = await Promise.all(
  organic.map(async (result) => {
    const content = await fetch(`https://r.jina.ai/${result.link}`);
    return {
      url: result.link,
      title: result.title,
      markdown: await content.text(),
    };
  })
);
```

### Cost Comparison

| Scale | Firecrawl | Serper + Jina | Savings |
|-------|-----------|---------------|---------|
| 500/mo | $16 | **$0** | 100% |
| 3K/mo | $16 | **$3** | 81% |
| 100K/mo | $83 | **$30** | 64% |

---

## Option 4: Apify (BEST FOR COMPLEX WORKFLOWS)

### Features
- 4,000+ pre-built "Actors" (scrapers)
- Custom scraper development
- Scheduled runs
- Proxy network included
- Course-specific scrapers available

### Relevant Actors
- **Google Search Scraper**: $0.50/1K searches
- **Coursera Course Scraper**: Direct API to Coursera
- **Udemy Course Scraper**: Direct API to Udemy
- **URL to Markdown**: $0.50/1K URLs

### Pricing

| Plan | Platform Credits | Cost |
|------|------------------|------|
| Free | $5/mo (renewing) | $0 |
| Starter | $49/mo | $49 |
| Scale | $499/mo | $499 |
| Pay-as-you-go | Per compute unit | Variable |

### Pros
- Course-specific scrapers (more accurate)
- Can combine multiple sources
- No code options available
- Handles anti-bot measures

### Cons
- Complex pricing model
- Learning curve
- May be overkill for your use case

---

## Option 5: Direct Course APIs (CHEAPEST FOR COURSES)

Instead of scraping, use official/unofficial APIs:

### Coursera
- **Coursera API** (via RapidAPI): $10-30/month
- Returns structured course data directly

### Udemy
- **Udemy Affiliate API**: Free with affiliate account
- Full course catalog with ratings, pricing

### edX
- **edX Course API**: Free (unofficial)
- Limited but functional

### Example

```typescript
// Coursera via RapidAPI
const response = await fetch(
  "https://coursera-api.p.rapidapi.com/search?query=python",
  {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "coursera-api.p.rapidapi.com",
    },
  }
);
```

**Pros:** Structured data, no scraping failures, official data
**Cons:** Separate API per provider, may miss some courses

---

## Recommendation Matrix

### For Your Current Scale (<500 students)

**Use: Jina AI (FREE)**

```
Cost: $0/month vs $16/month
Savings: $192/year
```

### For Growth (500-5K students)

**Use: Tavily ($40-100/month)**
- Better rate limits
- Domain filtering
- Enterprise features

### For Scale (>5K students)

**Use: Serper + Jina ($30-150/month)**
- Cheapest at volume
- Parallel processing
- No rate limit issues

### For Maximum Accuracy

**Use: Direct Course APIs + Active Jobs DB**
- Official data sources
- No scraping failures
- Structured output

---

## Migration Plan

### Phase 1: Replace Firecrawl Search with Jina (This Week)

```typescript
// firecrawl-search-courses/index.ts

// OLD
const response = await fetch("https://api.firecrawl.dev/v1/search", {
  method: "POST",
  headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}` },
  body: JSON.stringify({ query, limit: 5 }),
});

// NEW
async function searchWithJina(query: string, limit: number = 5) {
  const encoded = encodeURIComponent(query);
  const response = await fetch(`https://s.jina.ai/?q=${encoded}`, {
    headers: { "Accept": "application/json" },
  });
  const data = await response.json();
  // Jina returns { data: [{ url, title, content, description }] }
  return data.data.slice(0, limit);
}
```

### Phase 2: Add Fallback Chain

```typescript
async function searchCourses(query: string) {
  // Try Jina first (FREE)
  try {
    return await searchWithJina(query);
  } catch (e) {
    console.warn("Jina failed, trying Tavily...");
  }

  // Fallback to Tavily
  try {
    return await searchWithTavily(query);
  } catch (e) {
    console.warn("Tavily failed, trying Firecrawl...");
  }

  // Final fallback to Firecrawl (existing code)
  return await searchWithFirecrawl(query);
}
```

### Phase 3: Replace Job Scraping

For `scrape-job-posting/index.ts`:

```typescript
// Try Active Jobs DB first (no scraping needed)
const jobs = await searchActiveJobsDB(jobTitle);
if (jobs.length > 0) return jobs[0];

// Fallback: User-provided URL -> Jina Reader (FREE)
const markdown = await fetch(`https://r.jina.ai/${userUrl}`);
return extractJobData(await markdown.text());
```

---

## Cost Summary

### Current (Firecrawl Only)

| Scale | Monthly Cost |
|-------|--------------|
| 500 ops | $16 |
| 3K ops | $16 |
| 100K ops | $83 |
| 500K ops | $333 |

### After Migration (Jina Primary + Tavily Fallback)

| Scale | Monthly Cost | Savings |
|-------|--------------|---------|
| 500 ops | **$0** | 100% |
| 3K ops | **$0** | 100% |
| 100K ops | **$40** | 52% |
| 500K ops | **$100** | 70% |

---

## Final Recommendation

**Replace Firecrawl with Jina AI as primary, keep Firecrawl as fallback.**

| Priority | Provider | Use For | Cost |
|----------|----------|---------|------|
| 1 | **Jina AI** | Search + scraping | FREE |
| 2 | **Tavily** | Fallback with better limits | $40/mo |
| 3 | **Firecrawl** | Final fallback | Keep existing |
| 4 | **Active Jobs DB** | Replace job scraping | $29-99/mo |

**Projected Savings:** $192-2,796/year depending on scale

---

## Sources

- [Jina Reader API](https://jina.ai/reader/)
- [Tavily Pricing](https://docs.tavily.com/documentation/api-credits)
- [Serper Pricing](https://serper.dev/pricing)
- [Firecrawl Pricing](https://www.firecrawl.dev/pricing)
- [Apify Pricing](https://apify.com/pricing)
- [Best Web Scraping APIs 2025](https://www.firecrawl.dev/blog/best-web-scraping-api)
- [Jina vs Firecrawl Comparison](https://blog.apify.com/jina-ai-vs-firecrawl/)
- [Tavily Review 2025](https://aiagentslist.com/agents/tavily)
