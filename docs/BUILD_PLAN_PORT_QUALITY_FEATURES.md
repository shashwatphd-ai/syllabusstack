# PRD: Port Quality Features from projectify-syllabus to syllabusstack

## Context

syllabusstack ported capstone project generation from projectify-syllabus but the port was incomplete. Since the original plan was written, **Lovable added 21 new edge functions, 6 new shared services, 2 new API clients, and 3 major DB migrations** — closing many gaps. This updated PRD reflects the current state as of 2026-03-27.

**Goal:** Achieve full feature parity on quality-impacting features while supporting BOTH the instructor-centric flow (existing) and the student-centric flow (from projectify). Include all external APIs (Lightcast, ESCO, O*NET).

**Constraint:** All AI calls must use syllabusstack's `unified-ai-client.ts` (OpenRouter), NOT Lovable Gateway.

---

## What Was Added Since Last Plan (by Lovable)

### New Shared Services (now exist in syllabusstack)
| File | Lines | Status |
|------|-------|--------|
| `_shared/embedding-client.ts` | 249 | ✅ Full impl (Gemini 004 embeddings via OpenRouter, batch, caching) |
| `_shared/lightcast-client.ts` | 277 | ✅ Full impl (OAuth2, skill extraction, JPA, salary, rate limiting) |
| `_shared/validators/index.ts` | 48 | ✅ Zod-based schema validation |
| `_shared/capstone/input-validation.ts` | 143 | ✅ UUID, email, SQL injection validators |
| `_shared/capstone/json-parser.ts` | 99 | ✅ Safe JSON parsing with error handling |
| `_shared/capstone/retry-utils.ts` | 398 | ✅ Exponential backoff (DEFAULT, AGGRESSIVE, LIGHT configs) |
| `_shared/capstone/timeout-config.ts` | 296 | ✅ Operation-specific timeouts (5s–5min) |
| `_shared/capstone/signals/hiring-signal.ts` | 215 | ✅ Active hiring signal scoring |

### New Edge Functions (21 functions, ~5,400 lines total)
All are **backend-only** (not wired to frontend) except `job-matcher` and `portfolio-export`:
- `salary-roi-calculator` (540), `run-single-project-generation` (475), `job-matcher` (433)
- `career-pathway-mapper` (359), `skill-gap-analyzer` (332), `refresh-company-jobs` (332)
- `portfolio-export` (323), `aggregate-demand-signals` (286), `analyze-project-value` (247)
- `cleanup-orphaned-data` (213), `admin-regenerate-projects` (209), `project-suitability-scorer` (199)
- `submit-employer-interest` (188), `generate-premium-insights` (187), `student-project-matcher` (182)
- `apollo-webhook-listener` (180), `process-generation-queue` (173), `get-live-demand` (162)
- `sync-project-match` (162), `send-faculty-approval-email` (159), `generate-value-analysis` (110)

### New DB Migrations
- `demand_signals`, `company_signals`, `lightcast_skill_cache`, `job_matches`, `skill_embeddings`
- `project_generation_queue`, `employer_interest_submissions`, `dashboard_analytics`
- `project_applications`, `project_metadata`, `verified_competencies`
- Partnership proposals, faculty feedback fields

### generate-capstone-projects Enhanced (+167 lines)
- Intelligent signal filtering (course-relevant job postings only)
- Synonym map for skill matching (STEM + business domains)
- Apollo-enriched company validation
- Extended pricing/ROI calculation

---

## What's STILL Missing (Updated Gap Analysis)

### Still Missing: 8 Backend Services (down from 13)

| File | Size | Purpose | Priority |
|------|------|---------|----------|
| `company-discovery-pipeline.ts` | 12K | **5-phase pipeline orchestrator** — coordinates Lightcast→O*NET→Apollo→Validation→Ranking | P0 |
| `semantic-validation-v2-service.ts` | 15K | **Phase 4 validation** — Lightcast skill ID matching instead of keywords | P0 |
| `occupation-coordinator.ts` | 14K | **Multi-provider occupation mapping** (ESCO + Skills-ML + O*NET) | P1 |
| `occupation-provider-interface.ts` | 3.7K | Abstract provider interface for occupation services | P1 |
| `onet-structured-service.ts` | 14K | Structured O*NET data (DWAs, technologies as objects) | P1 |
| `esco-provider.ts` | 12K | ESCO European Skills taxonomy (free API) | P1 |
| `skills-ml-provider.ts` | 17K | Local ML occupation mapping (no API calls) | P2 |
| `rate-limit-headers.ts` | 6.3K | Standard X-RateLimit response headers | P2 |

**No longer missing** (now covered by new additions):
- ~~embedding-service.ts~~ → covered by `_shared/embedding-client.ts`
- ~~lightcast-skill-extractor.ts~~ → covered by `_shared/lightcast-client.ts`
- ~~lightcast-service.ts~~ → covered by `_shared/lightcast-client.ts`
- ~~skill-extraction-service.ts~~ → partially covered by `_shared/capstone/skill-extraction.ts` + `_shared/skill-extractor.ts`
- ~~retry-utils.ts~~ → now exists in `_shared/capstone/retry-utils.ts`
- ~~input-validation.ts~~ → now exists in `_shared/capstone/input-validation.ts`
- ~~timeout-config.ts~~ → now exists in `_shared/capstone/timeout-config.ts`
- ~~hiring-signal.ts~~ → now exists in `_shared/capstone/signals/hiring-signal.ts`

### Still Degraded: 2 Backend Services (down from 10)

| Service | Current | Projectify | Gap |
|---------|---------|-----------|-----|
| `circuit-breaker.ts` | 112 lines (basic) | 425 lines (full state machine) | Named configs, callbacks, registry pattern |
| `semantic-matching-service.ts` | 7.4K (TF-IDF) | 31K (embedding-based) | Now has embedding-client.ts but semantic-matching not yet wired to use it |

**No longer degraded** (new additions brought to parity):
- ~~input-validation.ts~~ → new 143-line impl covers projectify's validators
- ~~retry-utils.ts~~ → new 398-line impl matches projectify's configs
- ~~signal-types.ts~~ → hiring signal added, signal orchestrator complete
- ~~generation-service.ts~~ → +167 lines added to generate-capstone-projects
- Other services (alignment, pricing, geo-distance, onet, context-filter) — the existing implementations are sufficient; projectify's larger sizes were mostly documentation/comments, not logic

### Still Missing: Frontend

| Feature | Status |
|---------|--------|
| Student Upload page (`/student/upload-syllabus`) | ❌ Missing |
| ReviewSyllabus page | ❌ Missing |
| Configure Discovery page | ❌ Missing |
| Student "Apply Now" flow | ❌ Missing |
| Quality letter-grade badges (A+, A, B, C) | ❌ Missing |
| PDF project export | ❌ Missing |
| 19 backend functions not wired to frontend | ⚠️ Backend exists, no UI |

### Still Missing: Database

| Feature | Status |
|---------|--------|
| `create_project_atomic` RPC | ❌ Missing |
| Student RLS for capstone_projects | ❌ Missing |

---

## Phase 1: Backend — Missing Pipeline Services (HIGH IMPACT)

**Goal:** Port the 8 remaining missing services and wire the 5-phase pipeline.

### 1.1 Port Pipeline Orchestrator + Semantic Validation
| Action | Source (projectify `_shared/`) | Target (syllabusstack `_shared/capstone/`) |
|--------|-------------------------------|------------------------------------------|
| Port | `company-discovery-pipeline.ts` (12K) | `company-discovery-pipeline.ts` |
| Port | `semantic-validation-v2-service.ts` (15K) | `semantic-validation-v2-service.ts` |

**Adaptation:**
- Pipeline orchestrator must import from `capstone/` paths
- Wire `semantic-validation-v2` to use syllabusstack's `embedding-client.ts` (already exists) instead of projectify's `embedding-service.ts`
- Wire AI calls through `unified-ai-client.ts`
- Rename existing `discovery-pipeline.ts` to `discovery-pipeline-legacy.ts`
- Feature-flag new pipeline via `USE_NEW_PIPELINE` env var

### 1.2 Port Occupation Services
| Action | Source | Target |
|--------|--------|--------|
| Port | `occupation-provider-interface.ts` (3.7K) | `_shared/capstone/occupation-provider-interface.ts` |
| Port | `onet-structured-service.ts` (14K) | `_shared/capstone/onet-structured-service.ts` |
| Port | `occupation-coordinator.ts` (14K) | `_shared/capstone/occupation-coordinator.ts` |
| Port | `esco-provider.ts` (12K) | `_shared/capstone/esco-provider.ts` |
| Port | `skills-ml-provider.ts` (17K) | `_shared/capstone/skills-ml-provider.ts` |

**Adaptation:** Use existing `onet-service.ts` for O*NET auth. Use existing `lightcast-client.ts` for Lightcast calls within providers. ESCO API is free (no auth needed).

### 1.3 Upgrade Circuit Breaker
- **File:** `_shared/capstone/circuit-breaker.ts` (112 → ~425 lines)
- **Add:** Named configs (APOLLO_CIRCUIT_CONFIG, AI_GATEWAY_CIRCUIT_CONFIG), callbacks, stats tracking, `withApolloCircuit()` and `withAICircuit()` helpers

### 1.4 Wire Semantic Matching to Embeddings
- **File:** `_shared/capstone/semantic-matching-service.ts`
- **Change:** Import `embedding-client.ts` for cosine similarity; add hybrid keyword+embedding scoring mode
- **Keep:** TF-IDF as fallback when embeddings unavailable

### 1.5 Add Rate Limit Headers
- **Port:** `_shared/rate-limit-headers.ts` (6.3K)
- **Wire:** Add to `discover-companies`, `generate-capstone-projects`

---

## Phase 2: Upgrade discover-companies Pipeline (HIGH IMPACT)

- **File:** `supabase/functions/discover-companies/index.ts`
- **Current:** 673 lines
- **Target:** ~1200 lines

### Changes:
- Add Phase 2b: O*NET occupational enrichment via new `onet-structured-service.ts`
- Add Phase 6b: AI company-course validation (partially exists — extend)
- Add Phase 6c: Semantic validation via new `semantic-validation-v2-service.ts`
- Add Phase 6d: Multi-factor ranking via existing `company-ranking-service.ts`
- Wire Phase 8: Signal scoring — signals dir already complete (5 signals)
- Wire Phase 9: Career page validation — `career-page-validator.ts` already exists
- Wire Phase 10: Inferred needs — `inferred-needs-service.ts` already exists
- Feature-flag: `USE_NEW_PIPELINE` env var to opt into 5-phase pipeline

---

## Phase 3: Post-Generation Validation + Atomic RPC (MEDIUM-HIGH)

### 3.1 Add Post-Generation Validation
- **File:** `supabase/functions/generate-capstone-projects/index.ts`
- **Add:** `cleanAndValidate()` — strip markdown, remove week numbers from deliverables, check description >50 words, flag generic-only skills
- **Add:** `validateProjectData()` — validate description >100 chars, contact completeness, >=3 skills, >=1 major, email format, task length checks
- **Add:** Retry with exponential backoff (1s, 2s, 4s) for transient AI failures

### 3.2 Add Atomic Project Creation RPC
- **New migration:** `create_project_atomic(p_project_data JSONB, p_forms_data JSONB, p_metadata_data JSONB)`
- **Wire:** Update `generate-capstone-projects` to use RPC instead of sequential inserts

---

## Phase 4: Wire Backend Functions to Frontend (MEDIUM)

19 of 21 new edge functions are **not wired to any frontend UI**. Priority wiring:

### 4.1 Wire Existing Functions to Existing UI
| Function | Wire To | How |
|----------|---------|-----|
| `salary-roi-calculator` | ProjectDetailTabs "Scoring" tab | Add salary projection section |
| `career-pathway-mapper` | ProjectDetailTabs or CareerPath page | Add career progression visualization |
| `skill-gap-analyzer` | ProjectDetailTabs "Premium Insights" | Replace stub with real skill gap data |
| `analyze-project-value` | ProjectDetailTabs "Value Analysis" | Wire to existing value analysis tab |
| `student-project-matcher` | StudentCapstoneProjects page | Add "Recommended Projects" section |
| `admin-regenerate-projects` | Instructor Course Detail | Add "Regenerate" button |
| `aggregate-demand-signals` | DemandBoard page | Wire to demand board data |
| `get-live-demand` | DemandBoard page | Wire live demand updates |
| `submit-employer-interest` | Employer pages | Wire to employer interest form |

### 4.2 Create New Hooks
- `useSalaryROI(projectId)` → calls `salary-roi-calculator`
- `useCareerPathway(projectId)` → calls `career-pathway-mapper`
- `useSkillGapAnalysis(projectId)` → calls `skill-gap-analyzer`
- `useProjectValue(projectId)` → calls `analyze-project-value`
- `useStudentProjectRecommendations()` → calls `student-project-matcher`
- `useAdminRegenerate(courseId)` → calls `admin-regenerate-projects`
- `useDemandSignals()` → calls `aggregate-demand-signals` + `get-live-demand`

---

## Phase 5: Frontend — Student Upload Flow (MEDIUM)

### 5.1 Add Upload Page
- **New file:** `src/pages/student/UploadSyllabus.tsx`
- **Features:** PDF upload (max 10MB), location auto-detection via `detect-location`, manual override
- **Route:** `/student/upload-syllabus`
- **Reuse:** Existing `useProcessSyllabus` hook

### 5.2 Add ReviewSyllabus Page
- **New file:** `src/pages/student/ReviewSyllabus.tsx`
- **Route:** `/student/review-syllabus/:courseId`

### 5.3 Add Configure Page
- **New file:** `src/pages/student/ConfigureDiscovery.tsx`
- **Route:** `/student/configure/:courseId`
- **Calls:** `discover-companies` + `generate-capstone-projects`

### 5.4 Add Student Apply Flow
- **New component:** `src/components/capstone/StudentApplyButton.tsx`
- **DB:** Use existing `project_applications` table (added by Lovable migration)
- **Hook:** Extend `useCapstoneProjects.ts` with `useApplyToProject()` mutation

### 5.5 Add Routes to App.tsx

---

## Phase 6: Frontend — Rich Project Detail Enhancements (MEDIUM)

### 6.1 Add Quality Badges
- **New component:** `src/components/capstone/QualityBadge.tsx`
- **Logic:** A+ ≥85%, A ≥80%, B+ ≥75%, B ≥70%, C <70% (composite signal score)
- **Integrate:** Into `CapstoneProjectCard.tsx` and project detail header

### 6.2 Add PDF Export
- **Adapt:** projectify's `PrintableProjectView.tsx` for syllabusstack
- **Library:** `html2pdf.js` already in dependencies
- **Button:** "Export PDF" in project detail view

---

## Phase 7: Database Migrations

### 7.1 Atomic RPC
```sql
CREATE OR REPLACE FUNCTION create_project_atomic(
  p_project_data JSONB, p_forms_data JSONB, p_metadata_data JSONB
) RETURNS JSONB AS $$ ... $$ LANGUAGE plpgsql;
```

### 7.2 Student Access
- Add RLS policies for student read access to `capstone_projects`
- Add indexes on `project_applications` for student queries

---

## Dependency Graph

```
Phase 1 (Backend Services) ──no deps──
Phase 2 (discover-companies upgrade) ──depends on──> Phase 1
Phase 3.1 (Post-gen validation) ──independent──
Phase 3.2 (Atomic RPC) ──depends on──> Phase 7.1
Phase 4 (Wire functions to UI) ──independent (can start immediately)──
Phase 5 (Student Upload Flow) ──depends on──> Phase 2
Phase 6 (Project Detail) ──independent──
Phase 7 (DB Migrations) ──should run before Phase 3.2, 5.4──
```

---

## Verification Plan

### Backend
1. **Unit tests:** Circuit breaker state transitions, semantic-validation-v2 with mock data, create_project_atomic rollback
2. **Integration:** Run full 5-phase discover-companies pipeline with test course
3. **Comparison:** Generate projects for same syllabus in both repos, compare quality scores

### Frontend
1. **Upload flow:** Upload PDF → review → configure → verify projects generated
2. **Student apply:** Login as student → browse → apply → verify in DB
3. **Project detail:** All tabs render → salary ROI shows data → export PDF works
4. **Instructor flow:** Existing instructor flow unchanged
5. **Backend wiring:** Each new hook returns valid data, loading/error states work

### Environment
- Set: `LIGHTCAST_CLIENT_ID`, `LIGHTCAST_CLIENT_SECRET`, `USE_NEW_PIPELINE=true`
- Verify: Apollo API key, ESCO API connectivity (free, no auth)

---

## Estimated Scope (Updated)

| Phase | Files | Effort | Can Start |
|-------|-------|--------|-----------|
| Phase 1 | 8 new + 2 modified | Medium-Large | Immediately |
| Phase 2 | 1 modified | Medium | After Phase 1 |
| Phase 3 | 1 modified + 1 migration | Small-Medium | Phase 3.1 immediately |
| Phase 4 | 7 new hooks + UI wiring | Medium | Immediately |
| Phase 5 | 4 new pages + routes | Medium | After Phase 2 |
| Phase 6 | 2 new components | Small | Immediately |
| Phase 7 | 2 migrations | Small | Immediately |

**Quick wins (start now):** Phase 3.1 (post-gen validation), Phase 4 (wire existing functions), Phase 6.1 (quality badges), Phase 7 (migrations)
**Critical path:** Phase 1 → Phase 2 (discovery pipeline upgrade)
**Total remaining:** ~8 new backend files, 7 new hooks, 4 new pages, 2 new components, 2 migrations
