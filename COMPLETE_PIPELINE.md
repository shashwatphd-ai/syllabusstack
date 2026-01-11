# Complete Pipeline Integration

## The Two User Flows

### Flow 1: Instructor Creates Course

```
1. UPLOAD SYLLABUS
   ├── parse-syllabus-document (Gemini) → extract text from PDF/DOCX
   └── process-syllabus (Gemini) → create modules + learning objectives

2. FIND CONTENT (for each Learning Objective)
   ├── Check cache (FREE)
   ├── Invidious search (FREE) → YouTube videos without quota
   ├── Piped search (FREE) → YouTube videos without quota
   ├── Khan Academy search (FREE) → educational videos
   ├── search-educational-content (FREE) → Archive.org, MIT OCW
   └── YouTube API (QUOTA) → only if above return < 3 results

3. EVALUATE CONTENT
   └── evaluate-content-batch (Gemini OR OpenLLM) → score relevance

4. GENERATE ASSESSMENTS
   ├── generate-assessment-questions (Gemini OR OpenLLM)
   └── generate-micro-checks (Gemini OR OpenLLM)

5. PUBLISH
   └── Course available for students
```

### Flow 2: Student Learns + Plans Career

```
1. ENROLL IN COURSE
   └── course_enrollments table

2. LEARN CONTENT (for each LO)
   ├── Watch video → track-consumption
   ├── Answer micro-checks → micro_check_results
   └── Verify completion → consumption_records.is_verified

3. TAKE ASSESSMENT
   ├── start-assessment → create session
   ├── submit-assessment-answer (Gemini OR OpenLLM for short answer)
   └── complete-assessment → calculate score

4. SET DREAM JOB
   │
   ├── Option A: SEARCH (NEW - Active Jobs DB)
   │   └── search-jobs → returns structured job data
   │       ├── title, company, location
   │       ├── salary_min, salary_max
   │       ├── requirements[] (pre-extracted)
   │       └── apply_url
   │
   └── Option B: PASTE URL (existing)
       ├── scrape-job-posting (Jina) → get markdown
       └── OpenAI gpt-4o-mini → extract requirements

5. ANALYZE JOB REQUIREMENTS
   └── analyze-dream-job (Gemini OR OpenLLM) → detailed requirements

6. GAP ANALYSIS
   └── gap-analysis (Gemini OR OpenLLM)
       ├── User's verified skills (from assessments passed)
       └── Job requirements
       → Returns skill gaps

7. RECOMMENDATIONS
   ├── generate-recommendations (Gemini OR OpenLLM) → action items
   └── firecrawl-search-courses (Jina) → find courses for gaps
```

---

## API Usage by Priority

### Content Search (FREE first)
```
1. Cache           → $0
2. Invidious       → $0, no limits
3. Piped           → $0, no limits
4. Khan Academy    → $0
5. Archive.org     → $0
6. MIT OCW         → $0
7. YouTube API     → QUOTA (only if needed)
```

### Web Scraping (FREE first)
```
1. Jina            → $0 (20 req/min free)
2. Firecrawl       → $16-83/mo (fallback)
```

### Job Discovery (structured first)
```
1. Active Jobs DB  → $29-99/mo (pre-structured data)
2. Jina + OpenAI   → URL scraping + extraction (fallback)
```

### AI Calls (cost-optimized)
```
For simple tasks:
1. OpenLLM (DeepSeek/Llama) → $0.001/1K tokens

For complex reasoning:
1. Gemini 2.5 Flash → $0.01/1K tokens
2. OpenLLM (DeepSeek R1) → $0.002/1K tokens (fallback)
```

---

## What Needs to be Built

### 1. search-jobs Function (CREATED)
- Calls Active Jobs DB API
- Returns structured job data
- Frontend calls this before showing dream job form

### 2. OpenLLM Integration (TO CREATE)
- Add to `_shared/ai-provider.ts`
- Functions that can use it:
  - evaluate-content-batch (lower stakes)
  - generate-recommendations (lower stakes)
  - gap-analysis (can use cheaper model)
  - submit-assessment-answer (short answer grading)

### 3. Frontend Integration (TO CREATE)
- Add job search UI to dream jobs page
- Add toggle for AI provider (admin setting)

---

## Implementation Order

### Step 1: OpenLLM Provider
Create `_shared/ai-provider.ts` with:
- Gemini provider (existing)
- OpenLLM provider (new)
- Fallback logic

### Step 2: Update AI Functions
Modify these to use ai-provider:
- evaluate-content-batch
- generate-recommendations
- gap-analysis
- submit-assessment-answer

### Step 3: Frontend Job Search
Add to AddDreamJobForm.tsx:
- Search input for job title
- Location filter
- Results list from search-jobs
- Select job → creates dream_job

### Step 4: Connect verified_skills
When student passes assessment:
- Add to verified_skills table
- Use in gap-analysis

### Step 5: Connect discovered_careers
When search-jobs returns results:
- Cache in discovered_careers
- Show in career exploration page

---

## Environment Variables Needed

```bash
# Supabase Edge Function Secrets

# Web Provider (set to jina for free)
WEB_PROVIDER=jina

# RapidAPI (for OpenLLM and Active Jobs DB)
RAPIDAPI_KEY=your_rapidapi_key

# Existing
OPENAI_API_KEY=existing
GOOGLE_AI_API_KEY=existing (via Lovable Gateway)
```

---

## Summary

| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| Content Search | YouTube first | FREE APIs first | ✅ DONE |
| Web Scraping | Firecrawl | Jina | 🔧 Set WEB_PROVIDER=jina |
| Job Discovery | URL paste only | Search + paste | ✅ Function created |
| AI Provider | Gemini only | Gemini + OpenLLM | 🔧 TO BUILD |
| verified_skills | Table exists | Not populated | 🔧 TO BUILD |
| discovered_careers | Table exists | Not populated | 🔧 TO BUILD |
