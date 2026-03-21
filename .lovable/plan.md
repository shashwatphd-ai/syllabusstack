

# Implementation Plan: Replicate EduThree1's Full Capstone Pipeline in SyllabusStack

## Overview

This is a phased port of EduThree1's 7-stage capstone pipeline (~12,000 lines across ~25 shared files + 3 edge functions) into SyllabusStack's isolated `_shared/capstone/` directory. The work is divided into 6 implementation batches, each deployable and testable independently.

---

## Current State vs Target

SyllabusStack currently has simplified stubs:
- `skill-extraction.ts` — 98 lines of regex patterns (EduThree1: 744 lines + Lightcast API)
- `discover-companies/index.ts` — 229 lines, single naive Apollo search (EduThree1: 1,727 lines, 3-strategy + semantic validation)
- `generation-service.ts` — 88 lines, basic prompt (EduThree1: 509 lines, 250-line domain-specific prompt)
- `alignment-service.ts` — 99 lines (EduThree1: 348 lines with detailed LO mapping)
- No SOC mapping, no industry mapper, no technology mapping, no company validation, no ranking, no pricing

---

## Batch 1: Foundation — SOC Mapping + Location Utilities + Industry Filtering

**Goal**: Give the pipeline the ability to translate academic course context into Apollo-compatible search parameters.

### Files to create:

**`supabase/functions/_shared/capstone/course-soc-mapping.ts`** (~410 lines)
- Port EduThree1's `DISCIPLINE_SOC_MAP` covering 12 disciplines (mechanical, systems, computer, electrical, civil, chemical, data, business, finance, accounting, marketing)
- Add `strategic management` and `operations management` as new discipline stems
- Each discipline maps to SOC codes with confidence scores, industry keywords, and skill keywords
- `mapCourseToSOC()` — fuzzy matches course title + objectives against discipline stems
- `getIndustryKeywordsFromSOC()` — extracts Apollo-compatible industry keywords
- `getJobTitlesFromSOC()` — extracts occupation titles for Apollo job title search
- `generateFallbackSkillsFromSOC()` — synthetic skills when APIs fail

**`supabase/functions/_shared/capstone/location-utils.ts`** (~100 lines)
- Port EduThree1's `generateLocationVariants()` with full 50-state abbreviation map
- `normalizeLocationForApollo()` — strips zip codes, expands abbreviations, appends "United States"
- Returns 4+ location variants for fallback chain

**`supabase/functions/_shared/capstone/context-aware-industry-filter.ts`** (~430 lines)
- Port EduThree1's two-tier exclusion system:
  - Hard exclude: insurance, gambling, tobacco, law firms (never relevant)
  - Soft exclude: staffing/HR (relevant for business courses, not for engineering)
- `classifyCourseDomain()` — uses SOC major groups to determine course type
- `shouldExcludeIndustry()` — context-aware filtering with penalty scores
- `analyzeJobPostingsForProjects()` — checks if staffing company has real internal roles

**`supabase/functions/_shared/capstone/pipeline-types.ts`** (~294 lines)
- Port EduThree1's full type definitions for the 5-phase pipeline
- Types for: `LightcastSkillId`, `MappedOccupation`, `OccupationTechnology`, `DiscoveredCompany`, `ValidatedCompany`, `RankedCompany`, `PipelineInput/Output`

### Files to modify:

**`supabase/functions/_shared/capstone/types.ts`**
- Fix `CourseContext.learning_objectives[].objective_text` → `.text` (line 69)

---

## Batch 2: Enhanced Skill Extraction + Apollo Discovery Rewrite

**Goal**: Replace naive keyword search with EduThree1's 3-strategy Apollo discovery.

### Files to create:

**`supabase/functions/_shared/capstone/apollo-precise-discovery.ts`** (~540 lines)
- Port EduThree1's 3-strategy search:
  - Strategy 1: `currently_using_any_of_technology_uids` — most precise
  - Strategy 2: `q_organization_job_titles` — finds hiring companies
  - Strategy 3: `q_organization_keyword_tags` with industry keywords — broadest fallback
- `generateLocationVariants()` for each strategy
- `apolloFetch()` with retry, exponential backoff, rate-limit handling (429)
- `fetchJobPostings()` per company for enrichment
- Deduplication across strategies via `seenIds` set

### Files to rewrite:

**`supabase/functions/_shared/capstone/skill-extraction.ts`** (rewrite from 98 → ~300 lines)
- Add AI-powered skill extraction using `unified-ai-client.ts` (SyllabusStack already has this)
- Use Gemini Flash to translate academic learning objectives into industry skills + SOC-relevant keywords
- Keep regex pattern extraction as fallback
- Add missing `COURSE_SKILL_MAP` entries: `'strategic management'`, `'operations management'`, `'information systems'`, `'accounting'`, `'supply chain'`
- New function: `extractIndustrySkills()` — combines AI extraction + SOC mapping + pattern fallback

**`supabase/functions/discover-companies/index.ts`** (rewrite from 229 → ~400 lines)
- Replace single naive search with pipeline orchestration:
  1. Call `mapCourseToSOC()` to get SOC codes
  2. Call `getIndustryKeywordsFromSOC()` for Apollo keywords
  3. Call `normalizeLocationForApollo()` for location variants
  4. Call `discoverCompanies()` from `apollo-precise-discovery.ts` with 3-strategy fallback
  5. Apply `shouldExcludeIndustry()` context-aware filtering
  6. Enrich companies (job postings, technologies) via Apollo
  7. Upsert into `company_profiles` with full enrichment data
- Remove unused `inferIndustries()` function

---

## Batch 3: Company Validation + Ranking

**Goal**: Add AI pre-validation and multi-factor scoring before project generation.

### Files to create:

**`supabase/functions/_shared/capstone/company-validation-service.ts`** (~250 lines)
- Port EduThree1's AI company-course validation
- Uses `unified-ai-client.ts` (not direct Lovable AI gateway) to assess genuine fit
- `validateCompanyCourseMatch()` — returns `{ isValid, confidence, reason, suggestedProjectType, skillsOverlap }`
- `filterValidCompanies()` — batch validates and separates valid/rejected
- Rejection examples: Engineering course + HR software company, Data Science + bakery
- Defaults to accept on AI failure (non-blocking)

**`supabase/functions/_shared/capstone/company-ranking-service.ts`** (~426 lines)
- Port EduThree1's multi-factor scoring:
  - Semantic score (40%) — from validation
  - Hiring score (25%) — active job posting count
  - Location score (15%) — distance-based decay
  - Size score (10%) — company size fit for capstone scope
  - Diversity score (10%) — industry variety bonus
- `rankAndSelectCompanies()` — returns top N ranked companies with selection reasons
- Industry diversity enforcement: no more than 40% from one industry

---

## Batch 4: Enhanced Project Generation

**Goal**: Replace simplified generation prompt with EduThree1's 250-line domain-specific system.

### Files to rewrite:

**`supabase/functions/_shared/capstone/generation-service.ts`** (rewrite from 88 → ~510 lines)
- Port EduThree1's comprehensive prompt structure:
  - Course-first constraint (title, LOs, level as PRIMARY)
  - Subject-specific project type guidance for 6 academic domains (Engineering, CS/Data, Business, Science, Math, Arts)
  - Forbidden generic terms with automatic rejection criteria
  - Mandatory specificity formula: `[Action Verb] + [Named Framework/Tool] + [Quantified Scope] + [Data/Context]`
  - Company intelligence section (job postings, tech stack, funding stage, buying intent)
- Output: 7 tasks (not generic), 6 named deliverables with format, 5-7 domain-specific skills
- Uses SyllabusStack's `generateText()` from `unified-ai-client.ts` (not direct API calls)

**`supabase/functions/_shared/capstone/alignment-service.ts`** (enhance from 99 → ~350 lines)
- Port `generateLOAlignmentDetail()` — detailed task-to-LO mapping
- Enhance `calculateMarketAlignmentScore()` with synonym expansion and intelligent keyword matching from EduThree1
- Uses SyllabusStack's `generateText()` from `unified-ai-client.ts`

### Files to create:

**`supabase/functions/_shared/capstone/pricing-service.ts`** (~508 lines)
- Port EduThree1's Apollo-enriched pricing:
  - Base: student labor hours x rate
  - Buying intent signal multiplier
  - Hiring velocity multiplier
  - Company size/funding tier adjustment
  - Technology complexity adjustment

### Files to rewrite:

**`supabase/functions/generate-capstone-projects/index.ts`** (rewrite from 216 → ~500 lines)
- Add company validation step before generation
- Integrate pricing service
- Enhanced 6-form generation with real data (not TBD placeholders)
- Add market alignment scoring
- Better milestone generation (weekly checkpoints from deliverables)

---

## Batch 5: Pipeline Orchestrator + Competency Extraction

**Goal**: Wire everything together and enhance the post-completion flow.

### Files to create:

**`supabase/functions/_shared/capstone/discovery-pipeline.ts`** (~300 lines)
- Port EduThree1's `runCompanyDiscoveryPipeline()` orchestrator
- 5-phase execution: Skill Extraction → SOC Mapping → Apollo Discovery → Filtering → Ranking
- Structured logging with phase timing
- Error isolation (phase failure doesn't crash pipeline)
- Returns `PipelineOutput` with full phase data for debugging

### Files to modify:

**`supabase/functions/extract-capstone-competencies/index.ts`**
- Enhance AI skill extraction prompt (port EduThree1's tool-calling approach)
- Add `verified_skills` table insertion (SyllabusStack already has this table)
- Use `source_type = 'capstone_project'` for proper attribution

---

## Batch 6: Frontend Integration

**Goal**: Surface the enhanced pipeline in the UI.

### Files to modify:

**`src/hooks/useCapstoneProjects.ts`**
- Update `useDiscoverCompanies` to handle pipeline phase output
- Add `useCourseIndustryProfile()` query hook
- Add `useCompanyValidation()` mutation hook

**`src/components/capstone/CapstoneProjectsTab.tsx`**
- Show discovery progress with phase indicators
- Display validated vs rejected companies
- Show ranking scores and selection reasons

---

## External Dependencies

| Dependency | Status | Fallback |
|---|---|---|
| Apollo API (`APOLLO_API_KEY`) | Already configured | None (required) |
| Lovable AI (`LOVABLE_API_KEY`) | Already configured | Pattern-based extraction |
| Google Geocoding (`GOOGLE_CLOUD_API_KEY`) | Already configured | Nominatim (already in detect-location) |
| Lightcast | NOT configured | AI-powered extraction via Gemini (new) |
| O*NET | NOT configured | Curated SOC mapping table (ported from EduThree1) |

Since Lightcast and O*NET are not configured in SyllabusStack, the pipeline will use:
- **AI-powered skill extraction** (Gemini Flash via `unified-ai-client.ts`) instead of Lightcast NLP
- **Curated SOC mapping** (`course-soc-mapping.ts`) instead of O*NET API lookups
- This matches EduThree1's fallback behavior when those APIs are unavailable

---

## File Summary

| File | Action | Lines (approx) |
|---|---|---|
| `_shared/capstone/course-soc-mapping.ts` | Create | 410 |
| `_shared/capstone/location-utils.ts` | Create | 100 |
| `_shared/capstone/context-aware-industry-filter.ts` | Create | 430 |
| `_shared/capstone/pipeline-types.ts` | Create | 294 |
| `_shared/capstone/apollo-precise-discovery.ts` | Create | 540 |
| `_shared/capstone/company-validation-service.ts` | Create | 250 |
| `_shared/capstone/company-ranking-service.ts` | Create | 426 |
| `_shared/capstone/pricing-service.ts` | Create | 508 |
| `_shared/capstone/discovery-pipeline.ts` | Create | 300 |
| `_shared/capstone/skill-extraction.ts` | Rewrite | 98 → 300 |
| `_shared/capstone/generation-service.ts` | Rewrite | 88 → 510 |
| `_shared/capstone/alignment-service.ts` | Enhance | 99 → 350 |
| `_shared/capstone/types.ts` | Fix | 102 (line 69 fix) |
| `discover-companies/index.ts` | Rewrite | 229 → 400 |
| `generate-capstone-projects/index.ts` | Rewrite | 216 → 500 |
| `extract-capstone-competencies/index.ts` | Enhance | TBD |
| `src/hooks/useCapstoneProjects.ts` | Modify | Add hooks |
| `src/components/capstone/CapstoneProjectsTab.tsx` | Modify | Phase indicators |

**Total new/rewritten code**: ~5,000+ lines (backend) + frontend updates
**Existing SyllabusStack pipeline impact**: Zero — all changes within `_shared/capstone/` and capstone-only edge functions

---

## Recommended Implementation Order

Start with **Batch 1 + Batch 2** together (foundation + discovery fix) — this solves the immediate "0 companies returned" problem. Then Batch 3 + 4 (validation + generation quality). Batch 5 + 6 last (orchestrator + UI polish).

