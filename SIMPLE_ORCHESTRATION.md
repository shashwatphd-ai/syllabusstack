# Simple Orchestration Logic

## Principle

**Use FREE APIs first. Use PAID/LIMITED APIs only when FREE fails.**

---

## Instructor Pipeline

### Step 1: Create Course
```
Instructor uploads syllabus (PDF/DOCX)
         ↓
parse-syllabus-document (Gemini) → extracts text
         ↓
process-syllabus (Gemini) → creates modules + learning objectives
         ↓
Course structure saved to database
```

**No changes needed.** Gemini is required for understanding syllabus content.

---

### Step 2: Find Content for Each Learning Objective

**Current (broken):**
```
Check quota → assumes 10K → YouTube API → fails → Khan Academy only
```

**Should be:**
```
1. Check cache (FREE)
   ↓ (miss)
2. Invidious (FREE, no limits, same YouTube content)
   ↓ (fails)
3. Piped (FREE, no limits, same YouTube content)
   ↓ (fails)
4. Khan Academy (FREE)
   ↓ (fails)
5. Archive.org / MIT OCW (FREE)
   ↓ (insufficient results)
6. YouTube API (QUOTA-LIMITED) - only if above returned < 3 results
```

**Why this order:**
- Invidious/Piped return YouTube videos without using YouTube quota
- Khan Academy has educational content specifically
- Archive.org/MIT OCW have free educational videos
- YouTube API is last resort, preserves quota for edge cases

---

### Step 3: AI Evaluation of Content

```
Top candidates from search
         ↓
evaluate-content-batch (Gemini) → scores relevance to LO
         ↓
Auto-approve if score > threshold
```

**No changes needed.** AI evaluation adds value.

---

### Step 4: Generate Assessments

```
For each module with approved content
         ↓
generate-assessment-questions (Gemini) → creates MCQ + short answer
         ↓
generate-micro-checks (Gemini) → creates in-video checks
```

**No changes needed.** AI generation is the core value.

---

## Student Pipeline

### Step 1: Learn Content

```
Student selects learning objective
         ↓
Show approved content (videos, readings)
         ↓
Track consumption (watch %, segments, time)
         ↓
Trigger micro-checks at set times
         ↓
Mark verified when engagement threshold met
```

**No changes needed.** This is working.

---

### Step 2: Take Assessment

```
Student completes content verification
         ↓
Unlock assessment
         ↓
Answer questions (MCQ auto-graded, short answer via Gemini)
         ↓
Calculate score, update progress
```

**No changes needed.**

---

### Step 3: Career Planning (Dream Jobs)

**Current:**
```
Paste job URL → Firecrawl scrapes → OpenAI extracts → gap analysis
```

**Should be:**
```
Option A: Search jobs (if RAPIDAPI_KEY configured)
         ↓
    Active Jobs DB (pre-structured, has salary, requirements)
         ↓
    Select job → save as dream job → gap analysis

Option B: Paste URL (fallback)
         ↓
    Jina scrapes (FREE) → OpenAI extracts → gap analysis
```

**Why:**
- Active Jobs DB: Pre-structured data, no scraping/extraction needed
- Jina: Free scraping, same result as Firecrawl
- OpenAI extraction: Still needed for pasted URLs

---

### Step 4: Gap Analysis & Recommendations

```
Dream job requirements vs user's verified skills
         ↓
gap-analysis (Gemini) → identifies gaps
         ↓
generate-recommendations (Gemini) → suggests actions
         ↓
firecrawl-search-courses → finds courses for gaps
```

**Change needed:** Use Jina instead of Firecrawl for course search.

---

## The Actual Code Changes

### Change 1: Reorder Content Search Priority

**File:** `supabase/functions/search-youtube-content/index.ts`

**Current logic (line 460-461):**
```typescript
const quotaStatus = await checkYouTubeQuota();
const useAlternativeAPIs = !quotaStatus.canSearch || quotaStatus.remaining < 500;
```

**New logic:**
```typescript
// ALWAYS try free APIs first
const useAlternativeAPIs = true;
```

Or better, restructure the flow:

```typescript
// Step 1: Try Invidious (FREE)
let allVideos = await searchInvidious(searchQuery, 15);

// Step 2: If Invidious fails, try Piped (FREE)
if (allVideos.length === 0) {
  allVideos = await searchPiped(searchQuery, 15);
}

// Step 3: If still no results, try Khan Academy (FREE)
if (allVideos.length === 0) {
  const khanResults = await searchKhanAcademy(core_concept, search_keywords);
  allVideos.push(...khanResults);
}

// Step 4: If still insufficient, try YouTube API (QUOTA-LIMITED)
if (allVideos.length < 3) {
  const quotaStatus = await checkYouTubeQuota();
  if (quotaStatus.canSearch) {
    const youtubeVideos = await searchYouTubeAPI(queries);
    allVideos.push(...youtubeVideos);
  }
}
```

---

### Change 2: Set Jina as Default Web Provider

**In Supabase Dashboard → Secrets:**
```
WEB_PROVIDER=jina
```

**Affects:**
- scrape-job-posting (job URL scraping)
- firecrawl-search-courses (course recommendations)
- search-khan-academy (web fallback)

---

### Change 3: Add Job Search (Optional)

**New function:** `search-jobs/index.ts`

Only if you have RAPIDAPI_KEY. Provides search instead of URL paste.

---

## Summary

| Pipeline Step | Current | Should Be |
|---------------|---------|-----------|
| Content search | YouTube first | Invidious/Piped first |
| Web scraping | Firecrawl ($16-83/mo) | Jina (FREE) |
| Job discovery | Paste URL only | Search + paste fallback |
| AI (Gemini) | No change | No change (required) |
| AI (OpenAI) | Job extraction | No change (required for URL paste) |

---

## Implementation

### Step 1: Change search-youtube-content to use Invidious/Piped first

```typescript
// At the start of the main logic (around line 400), BEFORE quota check:

// Try FREE APIs first
const searchQuery = `${core_concept} ${(search_keywords || []).slice(0, 2).join(' ')} educational`;

// 1. Invidious (FREE)
let allVideos = await searchInvidious(searchQuery, 15);
console.log(`Invidious found ${allVideos.length} videos`);

// 2. Piped if needed (FREE)
if (allVideos.length < 5) {
  const pipedVideos = await searchPiped(searchQuery, 15);
  // Add non-duplicates
  for (const v of pipedVideos) {
    if (!allVideos.some(existing => existing.id === v.id)) {
      allVideos.push(v);
    }
  }
  console.log(`After Piped: ${allVideos.length} videos`);
}

// 3. YouTube API only if FREE APIs returned too few results
if (allVideos.length < 3) {
  const quotaStatus = await checkYouTubeQuota();
  if (quotaStatus.canSearch) {
    console.log('Free APIs insufficient, using YouTube API');
    // ... existing YouTube API logic ...
  }
}

// Continue with scoring and saving...
```

### Step 2: Set WEB_PROVIDER=jina

In Supabase Dashboard. Takes 30 seconds.

### Step 3: Deploy and test

```bash
supabase functions deploy search-youtube-content
```

---

## What This Achieves

1. **Content discovery always works** - Invidious/Piped have no limits
2. **YouTube quota preserved** - Only used when free APIs fail
3. **Web scraping is free** - Jina instead of Firecrawl
4. **Same content quality** - Invidious/Piped return YouTube videos
5. **Cost reduced** - $16-83/mo saved on Firecrawl

---

## What Could Go Wrong

1. **Invidious/Piped instances down** - All 8 could be down simultaneously (rare)
2. **Search quality differs** - Invidious ranking may differ from YouTube's
3. **Jina rate limits** - 20 req/min on free tier

**Mitigation:** YouTube API and Firecrawl remain as fallbacks in the code.
