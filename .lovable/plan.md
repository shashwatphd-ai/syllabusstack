

# Capstone Discovery Pipeline: EduThree Parity Implementation Plan

## Verified Gap Analysis

After reading the actual source files in both EduThree1 and SyllabusStack, every gap from the previous analysis is **confirmed**. Here's the verified plan with exact files, dependencies, and testing strategy.

---

## Phase A: Haversine Geo-Distance Scoring (HIGHEST IMPACT)

**Problem confirmed:** `company-ranking-service.ts` line 118-141 uses naive substring matching. Every US company gets `Location: 40%` because `companyAddress.includes('united states')` matches everything.

**Source:** EduThree's `_shared/geo-distance.ts` (849 lines) has a 400+ entry coordinate table, Nominatim API geocoding fallback, and Haversine distance calculation.

**Changes:**
1. **Replace `_shared/capstone/geo-distance.ts`** (currently 78 lines, only 20 cities) with EduThree's full 476-entry coordinate table (US cities, university towns, tech hubs, 50 US states, Canada, UK, Australia, India, Africa, Middle East, Latin America, Asia, Europe), Nominatim geocoding fallback, and `calculateDistanceBetweenLocations()` async function.

2. **Update `company-ranking-service.ts` `calculateLocationScore()`** (lines 118-141) to:
   - Parse course location to coordinates (from the new geo-distance module)
   - Parse company `full_address` to coordinates
   - Calculate Haversine distance in miles
   - Score: 0 miles = 1.0, 50 miles = 0.9, 100 miles = 0.7, 200 miles = 0.4, 300+ miles = 0.2
   - Keep `isSameMetroArea` as bonus boost, not primary signal
   - Note: `calculateLocationScore` becomes `async` — the `rankAndSelectCompanies` function must also become async

**Unknowns:**
- Some Apollo companies may have empty `city`/`state` fields. Fallback: use the `full_address` string for parsing. If that's also empty, default score 0.3.

---

## Phase B: Apollo Industry Keyword Mapper

**Problem confirmed:** `apollo-precise-discovery.ts` passes raw SOC industry keywords (e.g., "manufacturing", "logistics") directly to `q_organization_keyword_tags`. EduThree has a 111-entry translation dictionary (`apollo-industry-mapper.ts`) that maps these to Apollo-compatible terms.

**Changes:**
1. **Create `_shared/capstone/apollo-industry-mapper.ts`** — port EduThree's `SOC_INDUSTRY_TO_APOLLO_TAXONOMY` dictionary (111 entries covering engineering, software, business, finance, healthcare, logistics). Include the `mapSOCIndustriesToApollo()` function with context-aware exclusions (already partially in `context-aware-industry-filter.ts`).

2. **Update `apollo-precise-discovery.ts` `searchByIndustry()`** — replace raw keyword pass-through with mapped Apollo keywords from the new mapper. Add `person_not_titles: ['Recruiter', 'HR Manager', 'Talent Acquisition', 'Staffing']` to API requests for non-business courses.

**Dependency:** Uses `classifyCourseDomain()` from existing `context-aware-industry-filter.ts` — already ported.

---

## Phase C: Technology UID Strategy (Strategy 1)

**Problem confirmed:** `apollo-precise-discovery.ts` line 6 comments "not used yet; requires Apollo tech UIDs". Strategy 1 is never called. EduThree's `apollo-technology-mapping.ts` (202 lines) has a complete `SOC_TO_APOLLO_TECHNOLOGIES` dictionary mapping 14 SOC codes to Apollo technology names.

**Changes:**
1. **Create `_shared/capstone/apollo-technology-mapping.ts`** — port the `SOC_TO_APOLLO_TECHNOLOGIES` dictionary and `getTechnologiesForSOCCodes()` function.

2. **Add `searchByTechnology()` to `apollo-precise-discovery.ts`** — new strategy function using `currently_using_any_of_technology_uids` Apollo parameter. Run as Strategy 1 (before job titles).

3. **Update `discoverCompanies()`** — accept SOC codes as input parameter, call `getTechnologiesForSOCCodes()`, execute Strategy 1 first with technology filter. If zero results, continue to Strategies 2 and 3 (safe fallback, matching EduThree's pattern).

4. **Update `discover-companies/index.ts`** — pass SOC codes from Phase 2 into `discoverCompanies()`.

**Unknowns:**
- Apollo technology UID strings (e.g., `'autocad'`, `'solidworks'`) may have changed. EduThree uses simple lowercase names. If Apollo returns 0 results with tech filter, the fallback to Strategies 2/3 handles this gracefully.

---

## Phase D: Location-First Search Cascade + Course Seed Diversity

**Problem confirmed:** `apollo-precise-discovery.ts` sends ALL location variants in ONE request and always requests page 1. EduThree uses progressive fallback (city → state → national) and a course-title hash for page offset.

**Changes:**
1. **Update `discoverCompanies()` in `apollo-precise-discovery.ts`:**
   - Search city-level first (e.g., "Kansas City, Missouri")
   - Only broaden to state if city yields < target companies
   - Only broaden to national as last resort
   - Request 10x target count (instead of 3-4x) for filtering headroom

2. **Add course seed diversity:**
   - Accept `courseTitle` parameter
   - Generate deterministic hash: `courseTitle.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % 5`
   - Use as `page` offset in Apollo requests so different courses get different result pages

**Dependency:** Requires updated `discoverCompanies()` input to include `courseTitle`.

---

## Phase E: Batch AI Validation (Fixes Timeout)

**Problem confirmed:** `company-validation-service.ts` makes one AI call per company × 300ms delay = 9+ seconds for 30 companies. Combined with enrichment, this pushes past the 60-second gateway timeout.

**Changes:**
1. **Update `filterValidCompanies()` in `company-validation-service.ts`:**
   - Replace sequential per-company AI calls with a single batch prompt
   - Send all company names + descriptions in one prompt, ask for JSON array of scores
   - Return numeric confidence (0-1) instead of binary valid/invalid
   - Remove the 300ms `setTimeout` between calls

2. **Handle token limits:**
   - If > 15 companies, split into 2 batches of ~15 each
   - Truncate company descriptions to 200 chars each in the prompt
   - Total prompt stays under ~4000 tokens

3. **Update `discover-companies/index.ts`:**
   - Remove sleep delays between enrichment calls (lines 292, 307 in `apollo-precise-discovery.ts`)
   - Cap enrichment to 20 companies max (down from current enrichmentCap)

---

## Execution Order & Testing Strategy

### Step 1: Phase A (Geo-Distance)
- Create/replace `geo-distance.ts` with full coordinate table
- Update `company-ranking-service.ts` location scoring to async Haversine
- **Test:** Run discovery for Kansas City course, verify companies within 50 miles score > 0.8, companies 500+ miles away score < 0.3

### Step 2: Phase C (Technology UIDs)
- Create `apollo-technology-mapping.ts`
- Add Strategy 1 to `apollo-precise-discovery.ts`
- **Test:** Run discovery for an engineering course, verify Apollo returns companies using relevant CAD/simulation software

### Step 3: Phase B (Industry Mapper)
- Create `apollo-industry-mapper.ts`
- Update `searchByIndustry()` to use mapped keywords
- **Test:** Verify staffing firms are excluded for engineering courses but included for HR courses

### Step 4: Phase E (Batch Validation)
- Rewrite `filterValidCompanies()` for batch processing
- Remove sleep delays
- **Test:** Full pipeline completes within 60 seconds without "connection closed" error

### Step 5: Phase D (Search Cascade)
- Update discovery to use progressive location fallback
- Add course seed diversity
- **Test:** Two different courses at same university produce different company lists

### Final Integration Test
- Run full pipeline for 2-3 courses with different domains (engineering, business, CS)
- Verify: local companies rank higher, irrelevant industries filtered, pipeline completes < 60s, 10+ companies saved per course

---

## Files Modified/Created Summary

| File | Action | Phase |
|------|--------|-------|
| `_shared/capstone/geo-distance.ts` | Replace (78→850 lines) | A |
| `_shared/capstone/company-ranking-service.ts` | Modify (async location scoring) | A |
| `_shared/capstone/apollo-industry-mapper.ts` | Create new (~215 lines) | B |
| `_shared/capstone/apollo-technology-mapping.ts` | Create new (~200 lines) | C |
| `_shared/capstone/apollo-precise-discovery.ts` | Modify (add Strategy 1, cascade, seed) | C, D |
| `_shared/capstone/company-validation-service.ts` | Modify (batch validation) | E |
| `discover-companies/index.ts` | Modify (pass SOC codes, courseTitle) | C, D |

