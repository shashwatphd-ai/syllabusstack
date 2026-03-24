

# EduThree vs SyllabusStack: Comprehensive Gap Analysis

## How EduThree's Pipeline Works (End-to-End)

When a professor uploads a syllabus in EduThree, a **7-phase pipeline** executes:

```text
Phase 1: PDF Parse → AI extraction (Gemini Flash + pdfjs-serverless)
         Extracts: title, level, weeks, hrs_per_week, outcomes[], artifacts[], schedule[]
         Also captures: location (city, state, zip, country) as separate fields
         Stores into: course_profiles table

Phase 2: SOC Code Mapping (mapCourseToSOC)
         Course title + outcomes → O*NET Standard Occupational Classification codes
         Then: O*NET API → skills, DWAs, tools, technologies, tasks per occupation

Phase 3: Skill Extraction (extractSkillsHybrid)
         Primary: Lightcast Skills Extractor NLP API (industry taxonomy)
         Fallback: SOC-based skills + 400-line pattern matching with 17 discipline mappings
         Output: ExtractedSkill[] with confidence, category, keywords

Phase 4: Apollo Discovery (apollo-provider.ts — 2,122 lines!)
         Step 1: AI-generated search filters via Lovable AI Gateway
         Step 2: Multi-strategy search (location → state → country → no-industry fallback)
         Step 3: 3-stage enrichment per company:
           a) Organization enrichment (logo, social, funding, revenue, technologies, departments)
           b) Job postings fetch (GET /api/v1/organizations/{id}/job_postings)
           c) Contact search (mixed_people → bulk_match)
         Step 4: Distance calculation (Nominatim geocoding + Haversine)
         Step 5: Context-aware industry filtering (exclude staffing firms)

Phase 5: Semantic Filtering (semantic-matching-service.ts)
         Uses Sentence-BERT embeddings (embedding-service.ts)
         Course skills + DWAs → course embedding
         Company sector + jobs + technologies → company embedding
         Cosine similarity → threshold filtering
         Adaptive retry: lowers threshold if too few pass
         Intelligent fallback: preserves top N if all filtered out

Phase 6: Signal Scoring (signals/ directory — 4 parallel signals)
         Signal 1: Skill Match Score (technology overlap)
         Signal 2: Market Signal Score (hiring velocity + funding)
         Signal 3: Department Fit Score (departmental headcount alignment)
         Signal 4: Contact Quality Score (email verified, seniority)
         + Career Page Validation via Firecrawl (scrape /careers pages)
         Output: composite_signal_score per company

Phase 7: Project Generation (generate-projects — 1,122 lines)
         For each company:
           a) Intelligent signal filtering (expand keywords with synonyms)
           b) Company validation (reject poor fits)
           c) AI proposal generation (250-line prompt with domain-specific guidance)
           d) LO alignment scoring
           e) Market alignment scoring
           f) Pricing & ROI calculation (based on company revenue, size)
           g) Store: project + 6-form structured data (overview, academic, logistics, contact, timeline, verification)
```

### External APIs Used by EduThree

| API | Purpose | Phase |
|-----|---------|-------|
| **Lovable AI Gateway** (Gemini Flash) | PDF parsing, filter generation, project proposals | 1, 4, 7 |
| **O*NET Web Services** | Occupation details, skills, DWAs, technologies | 2 |
| **Lightcast Skills Extractor** | NLP-based skill extraction from text | 3 |
| **Apollo.io** (Organizations Search) | Company discovery | 4 |
| **Apollo.io** (Org Enrichment) | Full company data (revenue, tech, departments) | 4 |
| **Apollo.io** (Job Postings) | Active hiring data | 4 |
| **Apollo.io** (People Search + Bulk Match) | Decision-maker contacts | 4 |
| **Nominatim** (OpenStreetMap) | Geocoding for distance calculation | 4 |
| **Sentence-BERT** (via embedding API) | Semantic similarity embeddings | 5 |
| **Firecrawl** | Career page scraping for hiring validation | 6 |
| **Adzuna** (fallback) | Job-based company discovery if Apollo fails | 4 |

---

## What SyllabusStack Is MISSING vs EduThree

### CRITICAL GAPS (Pipeline Quality)

| # | Gap | EduThree Has | SyllabusStack Has | Impact |
|---|-----|-------------|-------------------|--------|
| 1 | **O*NET Integration** | Full O*NET API client with skills, DWAs, tools, technologies, tasks | None — SOC mapping is code-only with hardcoded fallbacks | Companies matched on superficial keywords, not validated occupational data |
| 2 | **Sentence-BERT Semantic Filtering** | Full embedding service + cosine similarity + adaptive threshold | None — uses AI validation (LLM call per company) which is slower/costlier | No true semantic matching; validation is LLM-based, not embeddings |
| 3 | **Lightcast NLP Skill Extraction** | Lightcast Skills Extractor API as primary | AI-based extraction only (Gemini prompt) | Less taxonomically accurate skills, may miss industry-standard terms |
| 4 | **Signal Scoring System** | 4 parallel signals (skill match, market, department fit, contact quality) with composite score | BuyingIntent only (funding + hiring) — no skill match, department fit, or contact quality | Missing half the ranking intelligence |
| 5 | **Career Page Validation** | Firecrawl scrapes company /careers pages to validate hiring | None | Can't verify Apollo hiring data against real career pages |
| 6 | **Adzuna Fallback Provider** | Full Adzuna provider as fallback if Apollo fails | None | If Apollo returns 0, pipeline has no recovery |
| 7 | **generation_runs Table** | Full pipeline execution tracking (status, phases, timing, credits, errors) | None — no execution audit trail | Can't debug failed discoveries, no metrics |

### MODERATE GAPS (Data Completeness)

| # | Gap | Detail |
|---|-----|--------|
| 8 | **Course location parsing** | EduThree captures city, state, zip, country as separate fields during upload. SyllabusStack has `search_location` but not always `location_city/state/zip` |
| 9 | **Company inferred_needs** | EduThree generates business needs from job postings + technologies for the AI prompt. SyllabusStack doesn't synthesize needs |
| 10 | **Data completeness scoring** | EduThree calculates data_completeness_score (0-100) from all enrichment fields. SyllabusStack has the column but doesn't populate it comprehensively |
| 11 | **Scoring/ranking transparency** | EduThree stores scoring_notes, scoring_version, match_explanation per company. SyllabusStack has match_score but less explanation |

### MINOR GAPS (Already Partially Addressed)

| # | Gap | Status |
|---|-----|--------|
| 12 | Address fields | Just fixed (city, zip, state, country, street) |
| 13 | Organization metadata (logo, social, founded) | Just added in Phase 1 migration |
| 14 | Contact granular fields | Just added |
| 15 | Funding events / revenue range | Just added |

---

## Recommended Implementation Plan

### Phase A: O*NET Integration (Highest Impact)

Add O*NET Web Services API client to `_shared/capstone/onet-service.ts`:
- `getOccupationDetails(socCode)` → skills, DWAs, tools, technologies, tasks
- Requires free O*NET API key (no cost)
- Wire into `discover-companies/index.ts` Phase 2 after SOC mapping
- Store results in a new `onet_occupations` column on a `capstone_generation_runs` table

### Phase B: Semantic Filtering via Embeddings

Add `_shared/capstone/embedding-service.ts`:
- Use Lovable AI Gateway with an embedding-capable model (or a dedicated embedding endpoint)
- OR use a simpler TF-IDF / keyword overlap scoring as a lighter alternative
- Add `semantic-matching-service.ts` with cosine similarity + adaptive threshold
- Insert between company discovery and ranking in the pipeline

### Phase C: Signal Scoring System

Port EduThree's 4-signal scoring to `_shared/capstone/signals/`:
- Signal 1: Skill Match (O*NET skills vs company technologies/jobs)
- Signal 2: Market Signal (funding + hiring velocity) — partially exists
- Signal 3: Department Fit (departmental headcount vs course domain)
- Signal 4: Contact Quality (email status, seniority, title relevance)
- Store `composite_signal_score`, `signal_data` on company_profiles

### Phase D: Generation Runs Audit Trail

Create `capstone_generation_runs` table:
- Track: course_id, status, phases completed, timing, credits used, error details
- Enable pipeline debugging and metrics
- Add `generation_run_id` FK on company_profiles

### Phase E: Fallback & Validation Enhancements

- Add Adzuna as fallback provider (requires ADZUNA_APP_ID + ADZUNA_APP_KEY)
- Add Firecrawl career page validation (already have FIRECRAWL_API_KEY)
- Add company `inferred_needs` synthesis from job postings + technologies

### Not Recommended to Port

- Lightcast API (requires paid API key, AI extraction is adequate)
- Sentence-BERT external service (can use simpler keyword overlap or AI gateway embeddings)

---

## Technical Notes

- O*NET Web Services is free with registration — no API cost
- The signal scoring system is the biggest quality differentiator after O*NET
- Semantic filtering can be approximated with TF-IDF keyword overlap instead of BERT embeddings
- The generation_runs audit table is critical for debugging and should be Phase D
- All changes are additive — no breaking changes to existing pipeline

