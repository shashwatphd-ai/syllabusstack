

# Gap Analysis: SyllabusStack Capstone vs EduThree1 Pipeline

This is a detailed comparison of what's currently implemented vs what EduThree1 has, organized by pipeline stage.

---

## What's Already Implemented (Batch 1 & 2 — Done)

| Component | Status | Lines | Parity |
|---|---|---|---|
| `course-soc-mapping.ts` | ✅ Created | 486 | ~95% — 15 disciplines, fuzzy matching, fallback skills |
| `location-utils.ts` | ✅ Created | ~100 | ~90% — 50-state map, variants, normalization |
| `context-aware-industry-filter.ts` | ✅ Created | 219 | ~95% — hard/soft tiers, domain classification, job analysis |
| `pipeline-types.ts` | ✅ Created | — | ~80% — covers discovery types, missing validation/ranking types |
| `skill-extraction.ts` | ✅ Rewritten | 232 | ~70% — AI extraction via Gemini, SOC fallback, regex fallback |
| `apollo-precise-discovery.ts` | ✅ Created | 304 | ~60% — 2 of 3 strategies (missing tech UID strategy), retry/backoff |
| `discover-companies/index.ts` | ✅ Rewritten | 257 | ~65% — 7-phase pipeline, but missing ranking & validation |

---

## What's NOT Implemented Yet (Gaps)

### Gap 1: Company-Course Validation (Batch 3)
**EduThree1**: 247-line `company-validation-service.ts` — AI validates genuine fit BEFORE project generation. Rejects mismatches (e.g., Engineering course + HR software company). Returns `{isValid, confidence, reason, suggestedProjectType, skillsOverlap}`.

**SyllabusStack**: Completely missing. Every discovered company goes straight to project generation, wasting AI calls on poor fits.

### Gap 2: Company Ranking (Batch 3)
**EduThree1**: 426-line `company-ranking-service.ts` — 5-factor weighted scoring (Semantic 40%, Hiring 25%, Location 15%, Size 10%, Diversity 10%). Diversity constraints prevent >40% from one industry. Generates selection reasons per company.

**SyllabusStack**: No ranking at all. Companies are saved in the order Apollo returns them.

### Gap 3: Generation Prompt Quality (Batch 4)
**EduThree1**: 509-line `generation-service.ts` with a ~250-line structured prompt containing:
- Forbidden generic terms with automatic rejection criteria
- Subject-specific project type guidance for 6 academic domains (Engineering, CS/Data, Business, Science, Math, Arts) with concrete examples
- Mandatory specificity formula: `[Action Verb] + [Named Framework/Tool] + [Quantified Scope] + [Data/Context]`
- Skill extraction rules: framework mentioned in task → exact skill name mapping (30+ mappings)
- Market intelligence integration (job postings → skill extraction, tech stack → task incorporation, funding stage → scope tailoring)
- Contact generation rules (realistic names, emails, phone numbers)

**SyllabusStack**: 88-line `generation-service.ts` with a basic ~30-line prompt. No domain-specific guidance, no rejection criteria, no specificity formula, no skill-to-task mapping rules.

### Gap 4: Pricing & ROI (Batch 4)
**EduThree1**: 508-line `pricing-service.ts` with Apollo-enriched pricing:
- Base: student labor hours × rate
- Buying intent signal multiplier
- Hiring velocity multiplier
- Company size/funding tier adjustment
- Technology complexity adjustment
- Full breakdown with rationale

**SyllabusStack**: Hardcoded `feasibilityScore = 0.80`. No budget calculation whatsoever.

### Gap 5: Enhanced Alignment Scoring (Batch 4)
**EduThree1**: 348-line `alignment-service.ts` with detailed task-to-LO mapping, market alignment with synonym expansion.

**SyllabusStack**: 99-line `alignment-service.ts` — basic AI coverage percentage + simple keyword matching. No synonym expansion, no detailed mapping output.

### Gap 6: `generate-capstone-projects/index.ts` Pipeline Quality (Batch 4)
**EduThree1**: 1,122-line `generate-projects/index.ts`:
- Company validation step (rejects ~30% of companies)
- Signal filtering (job postings by relevance, technologies by course match)
- Market alignment scoring
- Pricing/ROI per project
- Enhanced 6-form generation with real Apollo data
- Better milestone generation with weekly checkpoints

**SyllabusStack**: 216-line `generate-capstone-projects/index.ts`:
- No validation step
- Hardcoded feasibility score
- Basic form generation with TBD placeholders
- Simple milestone generation

### Gap 7: Pipeline Orchestrator (Batch 5)
**EduThree1**: 326-line `discovery-pipeline.ts` — unified 5-phase orchestrator with structured logging, phase timing, error isolation.

**SyllabusStack**: Pipeline phases are inlined in `discover-companies/index.ts`. Works but less maintainable.

### Gap 8: Apollo Technology UID Mapping (Batch 2 incomplete)
**EduThree1**: 202-line `apollo-technology-mapping.ts` — maps SOC codes to Apollo `currently_using_any_of_technology_uids`. Strategy 1 (technology filter) is the most precise search method.

**SyllabusStack**: Strategy 1 is stubbed out. Only Strategies 2 (job titles) and 3 (industry keywords) are active.

---

## Implementation Plan: Batches 3 & 4

### Batch 3: Company Validation + Ranking

**File 1: Create `supabase/functions/_shared/capstone/company-validation-service.ts`** (~250 lines)
- Port EduThree1's validation prompt verbatim (it's well-designed)
- Use SyllabusStack's `generateText()` from `unified-ai-client.ts` instead of direct Lovable AI calls
- `validateCompanyCourseMatch(input)` → `{isValid, confidence, reason, suggestedProjectType, skillsOverlap}`
- `filterValidCompanies(companies, courseContext)` → batch validate, return valid + rejected arrays
- Default to accept on AI failure (non-blocking)

**File 2: Create `supabase/functions/_shared/capstone/company-ranking-service.ts`** (~400 lines)
- Port EduThree1's 5-factor scoring (Semantic 40%, Hiring 25%, Location 15%, Size 10%, Diversity 10%)
- `calculateHiringScore()` — job count tiers (0→0, 1→0.4, 3→0.6, 5→0.8, 10+→1.0)
- `calculateSizeScore()` — prefer 50-5000 employees for capstone projects
- `calculateDiversityScore()` — bonus for adding new industry, penalty for duplicates
- `applyDiversityConstraints()` — max 40% from one industry
- `rankAndSelectCompanies()` → ranked list with selection reasons

**File 3: Modify `supabase/functions/discover-companies/index.ts`**
- Add Phase 6b: Company validation (between filtering and upsert)
- Add Phase 6c: Company ranking (after validation)
- Store validation result + rank scores on company_profiles

### Batch 4: Enhanced Generation + Pricing

**File 4: Rewrite `supabase/functions/_shared/capstone/generation-service.ts`** (88 → ~500 lines)
- Port EduThree1's complete 250-line prompt with:
  - 6 domain-specific project type sections (Engineering, CS/Data, Business, Science, Math, Arts)
  - Forbidden generic terms list with rejection examples
  - Specificity formula: `[Action Verb] + [Named Framework/Tool] + [Quantified Scope] + [Data/Context]`
  - 30+ skill extraction rules (framework → exact skill name)
  - Market intelligence integration
  - Contact generation rules
- Use `generateText()` from `unified-ai-client.ts` (not direct Lovable AI)

**File 5: Create `supabase/functions/_shared/capstone/pricing-service.ts`** (~500 lines)
- Port EduThree1's Apollo-enriched pricing
- 5 pricing factors: buying intent, hiring velocity, company size, funding tier, tech complexity
- Returns `{budget, breakdown}` with detailed rationale

**File 6: Enhance `supabase/functions/_shared/capstone/alignment-service.ts`** (99 → ~350 lines)
- Port detailed LO-to-task mapping
- Add synonym expansion for market alignment
- Return structured coverage data (which LOs covered by which tasks)

**File 7: Rewrite `supabase/functions/generate-capstone-projects/index.ts`** (216 → ~500 lines)
- Add company validation step before generation
- Integrate pricing service for budget calculation
- Enhanced 6-form generation with real data (not TBD)
- Market alignment scoring
- Better milestone generation with weekly checkpoints
- Rate limit handling and structured logging

---

## Files Summary

| File | Action | Current → Target Lines |
|---|---|---|
| `_shared/capstone/company-validation-service.ts` | Create | 0 → 250 |
| `_shared/capstone/company-ranking-service.ts` | Create | 0 → 400 |
| `_shared/capstone/pricing-service.ts` | Create | 0 → 500 |
| `_shared/capstone/generation-service.ts` | Rewrite | 88 → 500 |
| `_shared/capstone/alignment-service.ts` | Enhance | 99 → 350 |
| `discover-companies/index.ts` | Modify | Add validation + ranking phases |
| `generate-capstone-projects/index.ts` | Rewrite | 216 → 500 |

**Total new/rewritten code**: ~2,500 lines
**Existing pipeline impact**: Zero — all within capstone fork

