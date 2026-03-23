

# Implementation Plan: Fix All Data Flow Mismatches in Capstone Pipeline

## Summary

There are 5 critical mismatches preventing the capstone pipeline from functioning like EduThree1. This plan fixes them in 4 sequential phases, each deployable and testable independently. All changes are isolated to `_shared/capstone/` and capstone-specific edge functions — zero impact on existing SyllabusStack pipelines.

---

## Phase 1: Database Schema Fix (Unblocks Everything)

**Objective**: Add the 14 missing columns to `company_profiles` so ranking, enrichment, and linkage data actually persists.

**Approach**: Single SQL migration adding all columns as nullable with sensible defaults.

**Columns to add**:

| Column | Type | Purpose |
|---|---|---|
| `instructor_course_id` | uuid (FK → instructor_courses) | Links companies to the course that discovered them (Fix #1) |
| `match_score` | numeric | Composite ranking score from ranking service |
| `match_reason` | text | Human-readable selection reason |
| `similarity_score` | numeric | Semantic match score (0-1) |
| `match_confidence` | text | high/medium/low label |
| `discovery_source` | text | Which Apollo strategy found this company |
| `seo_description` | text | Secondary description from Apollo enrichment |
| `buying_intent_signals` | jsonb | Funding + hiring velocity signals |
| `contact_first_name` | text | Split contact name for real emails |
| `contact_last_name` | text | Split contact name |
| `departmental_head_count` | jsonb | Department headcounts for signal scoring |
| `last_enriched_at` | timestamptz | When enrichment was last run |
| `organization_revenue_range` | text | Revenue bracket for scope sizing |

**Guardrails**:
- All columns nullable — no risk of breaking existing rows
- No NOT NULL constraints — discovery can still work if enrichment fails
- FK on `instructor_course_id` uses `ON DELETE SET NULL` so deleting a course doesn't cascade-delete shared company data
- RLS: `company_profiles` remains accessible via existing policies; the new column is just data, not an access control boundary

**If-Then-Else**:
- IF migration succeeds → proceed to Phase 2
- IF column already exists (duplicate run) → migration is idempotent via `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`

---

## Phase 2: Course Linkage Fix (Breaks the Circular Dependency)

**Objective**: Discovered companies are linked to the course that found them. Generation fetches companies by `instructor_course_id` instead of the broken `capstone_projects` self-reference.

**Approach**: Modify two edge functions.

### File 1: `supabase/functions/discover-companies/index.ts`
- In the upsert data object (line 211-235), add `instructor_course_id` field from the request parameter
- This means every company saved knows which course discovered it

### File 2: `supabase/functions/generate-capstone-projects/index.ts`
- Replace lines 80-96 (the broken fetch logic) with:
  ```
  IF company_ids provided → use those (explicit selection)
  ELSE → query company_profiles WHERE instructor_course_id = X
         ORDER BY match_score DESC NULLS LAST
  ```
- This eliminates the circular dependency where generation looks for `capstone_projects` rows that don't exist yet

### File 3: `src/hooks/useCapstoneProjects.ts`
- `useCompanyProfiles(courseId)` currently queries via `capstone_projects` join — replace with direct `company_profiles WHERE instructor_course_id = courseId`
- Add `instructor_course_id` to the `CompanyProfile` type
- Add `match_score` and `match_reason` to the type

**Guardrails**:
- IF `instructor_course_id` column doesn't exist yet (Phase 1 not run) → upsert silently ignores it (Supabase behavior), companies still save without linkage
- IF no companies found for course → return clear error message "Run company discovery first" (existing behavior preserved)
- IF `company_ids` explicitly passed → bypass course linkage entirely (allows manual company selection)

---

## Phase 3: Apollo Enrichment Service (Fills the Data Void)

**Objective**: After Apollo search returns raw organization IDs, enrich each company with full profile data, job postings, and decision-maker contacts — exactly as EduThree1 does.

**Approach**: Create new service file, integrate into existing discovery flow.

### File 1: Create `supabase/functions/_shared/capstone/apollo-enrichment-service.ts` (~250 lines)

Three enrichment functions:

**`enrichOrganization(domain, apiKey)`**
- Calls `POST /v1/organizations/enrich` with `{ domain }`
- Returns: `short_description`, `seo_description`, `industries[]`, `technology_names[]`, `departmental_head_count`, `funding_events[]`, `estimated_num_employees`, `annual_revenue_printed`, `linkedin_url`
- IF domain is null/empty → skip enrichment, return partial data
- IF API returns 404 → return null (company may not be in Apollo's enrichment DB)
- IF API returns 429 → exponential backoff retry (reuse existing `apolloFetch` pattern)

**`fetchJobPostingsRobust(orgId, apiKey)`**
- Dual endpoint fallback:
  1. Try `POST /v1/mixed_companies/search` with org ID to get job postings inline
  2. Fallback to current `POST /organizations/job_postings` endpoint
- Handle both response field names: `job_postings` and `organization_job_postings`
- IF both endpoints fail → return empty array (non-blocking)

**`findBestContact(orgId, courseContext, apiKey)`**
- Calls `POST /v1/mixed_people/search` with 4-strategy cascade:
  1. VP/Director in relevant department (mapped from course domain)
  2. C-level in relevant department
  3. Manager in relevant department
  4. Any decision-maker company-wide
- Returns: `{ first_name, last_name, email, title, phone, linkedin_url }`
- IF no contacts found → return null (generation will use AI-generated placeholders)
- IF API quota exhausted → skip contact search entirely (non-blocking)

**`calculateBuyingIntent(org, jobPostings)`**
- Scores funding stage (Series A=0.3, Series B=0.5, Series C+=0.7)
- Scores hiring velocity (0 jobs=0, 1-3=0.3, 4-10=0.6, 10+=0.9)
- Returns jsonb with signals and composite score

### File 2: Modify `supabase/functions/_shared/capstone/apollo-precise-discovery.ts`

Replace the current post-search loop (lines 270-290) which only fetches job postings with:
1. Call `enrichOrganization()` per company — populate description, technologies, employee count, funding, departments, revenue
2. Call `fetchJobPostingsRobust()` — replace current basic job fetch
3. Call `findBestContact()` — get decision-maker contact
4. Call `calculateBuyingIntent()` — derive market signals
5. Merge all enrichment data into the `DiscoveredCompany` object

Add new fields to `DiscoveredCompany` type in `pipeline-types.ts`:
- `seoDescription`, `contactFirstName`, `contactLastName`, `contactEmail`, `contactTitle`, `contactPhone`
- `departmentalHeadCount`, `buyingIntentSignals`, `revenueRange`, `lastEnrichedAt`

### File 3: Modify `supabase/functions/discover-companies/index.ts`

Update the upsert data object (line 211-235) to write all enrichment fields:
- `seo_description`, `buying_intent_signals`, `departmental_head_count`
- `contact_first_name`, `contact_last_name` (from enrichment contact)
- `contact_email`, `contact_title`, `contact_phone` (from enrichment contact, overwriting any existing)
- `similarity_score`, `match_confidence`, `discovery_source`
- `organization_revenue_range`, `last_enriched_at`

**Guardrails**:
- IF enrichment API fails for a company → still save the company with basic search data (non-blocking)
- IF Apollo API key has no enrichment credits → skip enrichment entirely, log warning, continue with search-only data
- IF company has no domain (no website_url) → skip org enrichment, still fetch job postings by org ID
- Rate limiting: 200ms pause between enrichment calls per company (Apollo's fair-use limit)
- Total enrichment capped at `targetCount * 2` companies to control API spend

---

## Phase 4: Leverage SyllabusStack's Richer LO Data

**Objective**: Use `bloom_level`, `search_keywords`, and `core_concept` from `learning_objectives` to improve discovery precision and project complexity — a SyllabusStack advantage over EduThree1.

### File 1: Modify `supabase/functions/discover-companies/index.ts`

Currently fetches LOs but only uses `lo.text` (line 78). Change to:
- Fetch `text, bloom_level, search_keywords, core_concept`
- Pass `search_keywords[]` directly into Apollo query keywords (more precise than AI-extracted skills alone)
- Pass `bloom_level` distribution to generation function for tier determination

### File 2: Modify `supabase/functions/_shared/capstone/skill-extraction.ts`

- Accept `searchKeywords` as additional input alongside `objectiveTexts`
- Merge LO `search_keywords` into the skill extraction output (they're already industry-relevant terms)
- Boost confidence scores for skills that match `search_keywords`

### File 3: Modify `supabase/functions/generate-capstone-projects/index.ts`

- Pass `bloom_level` data alongside objectives
- Use Bloom level distribution to auto-set project tier:
  - Majority `remember/understand` → Tier 1 (guided)
  - Majority `apply/analyze` → Tier 2 (applied)
  - Majority `evaluate/create` → Tier 3 (advanced)
- IF bloom_level data is missing → fall back to existing tier logic from AI proposal

**Guardrails**:
- IF `search_keywords` is null/empty for a LO → skip, use only `text` (backward compatible)
- IF `bloom_level` is null → default to 'apply' (middle ground)
- NEVER override an explicit instructor tier selection (if that feature exists)

---

## Files Summary

| Phase | File | Action |
|---|---|---|
| 1 | DB Migration | Add 14 columns to `company_profiles` |
| 2 | `discover-companies/index.ts` | Add `instructor_course_id` to upsert |
| 2 | `generate-capstone-projects/index.ts` | Fix company fetch to use `instructor_course_id` |
| 2 | `src/hooks/useCapstoneProjects.ts` | Fix `useCompanyProfiles` query + types |
| 3 | `_shared/capstone/apollo-enrichment-service.ts` | Create (~250 lines) |
| 3 | `_shared/capstone/pipeline-types.ts` | Add enrichment fields to types |
| 3 | `_shared/capstone/apollo-precise-discovery.ts` | Integrate enrichment into post-search loop |
| 3 | `discover-companies/index.ts` | Write enrichment data to DB |
| 4 | `discover-companies/index.ts` | Use LO search_keywords + bloom_level |
| 4 | `_shared/capstone/skill-extraction.ts` | Accept search_keywords input |
| 4 | `generate-capstone-projects/index.ts` | Bloom-level tier mapping |

**Total new code**: ~300 lines (enrichment service) + ~100 lines of modifications
**Existing SyllabusStack impact**: Zero — all changes within capstone fork

