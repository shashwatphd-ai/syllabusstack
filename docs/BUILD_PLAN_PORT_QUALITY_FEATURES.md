# Build Plan: Port Quality Features from projectify-syllabus to syllabusstack

## Context

syllabusstack ported capstone project generation from projectify-syllabus but the port was incomplete. 61% of discovery logic was lost (1727→673 lines), 13 critical backend services are missing, the circuit breaker was reduced by 74%, semantic matching was downgraded from embedding-based to keyword-based, and 3 frontend pages + 20 project-detail components were never ported. This results in lower quality company discovery, weaker project proposals, and a less complete user experience.

**Goal:** Achieve full feature parity on quality-impacting features while supporting BOTH the instructor-centric flow (existing) and the student-centric flow (from projectify). Include all external APIs (Lightcast, ESCO, O*NET).

**Constraint:** All AI calls must use syllabusstack's `unified-ai-client.ts` (OpenRouter), NOT Lovable Gateway.

---

## Phase 1: Backend Foundation — Missing Services (HIGH IMPACT)

**Goal:** Port the 13 missing shared services that the discovery pipeline depends on.

### 1.1 Port Provider Interface & Occupation Services
| Action | Source (projectify) | Target (syllabusstack) |
|--------|-------------------|----------------------|
| Port | `_shared/occupation-provider-interface.ts` (3.7K) | `_shared/capstone/occupation-provider-interface.ts` |
| Port | `_shared/onet-structured-service.ts` (14K) | `_shared/capstone/onet-structured-service.ts` |
| Port | `_shared/esco-provider.ts` (12K) | `_shared/capstone/esco-provider.ts` |
| Port | `_shared/skills-ml-provider.ts` (17K) | `_shared/capstone/skills-ml-provider.ts` |
| Port | `_shared/occupation-coordinator.ts` (14K) | `_shared/capstone/occupation-coordinator.ts` |

**Adaptation:** Replace any `fetchWithTimeout()` calls with syllabusstack's timeout patterns. Use existing `onet-service.ts` as reference for O*NET API auth.

### 1.2 Port Lightcast Integration
| Action | Source | Target |
|--------|--------|--------|
| Port | `_shared/lightcast-skill-extractor.ts` (15K) | `_shared/capstone/lightcast-skill-extractor.ts` |
| Port | `_shared/lightcast-service.ts` (11K) | `_shared/capstone/lightcast-service.ts` |

**New env vars:** `LIGHTCAST_CLIENT_ID`, `LIGHTCAST_CLIENT_SECRET`

### 1.3 Port Embedding & Semantic Services
| Action | Source | Target |
|--------|--------|--------|
| Port | `_shared/embedding-service.ts` (13K) | `_shared/capstone/embedding-service.ts` |
| Port | `_shared/semantic-validation-v2-service.ts` (15K) | `_shared/capstone/semantic-validation-v2-service.ts` |
| Port | `_shared/skill-extraction-service.ts` (31K) | `_shared/capstone/skill-extraction-service.ts` |

**Adaptation:** Replace Gemini direct embedding calls with `unified-ai-client.ts` or keep Google Generative Language API for embeddings (768-dim text-embedding-004 model, not available via OpenRouter).

### 1.4 Port Pipeline Orchestrator
| Action | Source | Target |
|--------|--------|--------|
| Port | `_shared/company-discovery-pipeline.ts` (12K) | `_shared/capstone/company-discovery-pipeline.ts` |

**Adaptation:** This orchestrates the 5-phase pipeline. Must import from syllabusstack's capstone/ paths. Wire it to use `unified-ai-client.ts` for any AI calls. Rename syllabusstack's existing `discovery-pipeline.ts` (12K) to `discovery-pipeline-legacy.ts` to avoid conflict.

**Dependencies:** Requires 1.1, 1.2, 1.3 to be complete first.

---

## Phase 2: Upgrade Degraded Services (MEDIUM-HIGH IMPACT)

### 2.1 Upgrade Circuit Breaker
- **Current:** `_shared/capstone/circuit-breaker.ts` (3.4K, basic)
- **Target:** Merge in projectify's 13K implementation
- **Key additions:** Named configs (APOLLO_CIRCUIT_CONFIG, AI_GATEWAY_CIRCUIT_CONFIG, GOOGLE_API_CIRCUIT_CONFIG), callbacks (onOpen/onClose/onHalfOpen), detailed stats tracking, registry pattern with `withApolloCircuit()` and `withAICircuit()` helpers

### 2.2 Upgrade Semantic Matching
- **Current:** `_shared/capstone/semantic-matching-service.ts` (7.4K, TF-IDF keyword)
- **Target:** Merge projectify's 31K embedding-based matching
- **Key additions:** Gemini embedding integration via `embedding-service.ts`, adaptive threshold with embedding similarity, hybrid keyword+embedding scoring

### 2.3 Upgrade Context-Aware Industry Filter
- **Current:** 7.6K
- **Target:** Merge projectify's 15K expanded version
- **Key additions:** Job posting intelligence, refined domain classification, additional exclusion rules

### 2.4 Upgrade Other Degraded Services
| Service | Current | Target | Key Changes |
|---------|---------|--------|-------------|
| `input-validation.ts` | 5.0K | 11K | SQL injection detection, more validators |
| `generation-service.ts` | 14K | 26K | More generation options, richer prompts |
| `onet-service.ts` | 9.2K | 21K | More comprehensive data, technology mapping |
| `alignment-service.ts` | 8.1K | 12K | Expanded alignment scoring |
| `signal-types.ts` | 3.8K | 7.3K | Expanded signal definitions |
| `pricing-service.ts` | 14K | 18K | Additional pricing models |
| `geo-distance.ts` | 30K | 39K | Additional distance calculations |

---

## Phase 3: Upgrade Edge Functions (HIGH IMPACT)

### 3.1 Upgrade discover-companies
- **Current:** 673 lines
- **Target:** ~1200 lines (adapted from projectify's 1727)
- **Changes:**
  - Add Phase 2b: O*NET occupational enrichment via `onet-structured-service.ts`
  - Add Phase 6b: AI company-course validation
  - Add Phase 6c: Semantic matching with O*NET enrichment via `semantic-validation-v2-service.ts`
  - Add Phase 6d: Multi-factor ranking via `company-ranking-service.ts`
  - Add Phase 7: 3-stage enrichment + upsert
  - Add Phase 8: 4-signal scoring (already have signals/ dir)
  - Add Phase 9: Career page validation via Firecrawl (`career-page-validator.ts` already exists)
  - Add Phase 10: Inferred needs synthesis (`inferred-needs-service.ts` already exists)
  - Wire new 5-phase pipeline as opt-in via `USE_NEW_PIPELINE` env var
- **File:** `supabase/functions/discover-companies/index.ts`

### 3.2 Add Post-Generation Validation to generate-capstone-projects
- **File:** `supabase/functions/generate-capstone-projects/index.ts`
- **Add:** `cleanAndValidate()` function (strip markdown, remove week numbers, validate description length)
- **Add:** `validateProjectData()` function (validate description >100 chars, contact completeness, >=3 skills, >=1 major, email format)
- **Add:** Retry logic with exponential backoff (1s, 2s, 4s) for transient AI failures

### 3.3 Add Atomic Project Creation RPC
- **New migration:** `create_project_atomic(p_project_data JSONB, p_forms_data JSONB, p_metadata_data JSONB)`
- **Purpose:** Single-transaction insert for capstone_projects + project_forms + project_metadata
- **Wire:** Update `generate-capstone-projects` to use RPC instead of sequential inserts

### 3.4 Add Rate Limit Headers
- **Port:** `_shared/rate-limit-headers.ts` (6.3K)
- **Wire:** Add to discover-companies, generate-capstone-projects, and other resource-intensive functions

---

## Phase 4: Frontend — Student Upload Flow (MEDIUM IMPACT)

### 4.1 Add Upload Page
- **New file:** `src/pages/student/UploadSyllabus.tsx`
- **Features:** PDF upload (max 10MB), location auto-detection from email via `detect-location`, manual location override, sessionStorage persistence
- **Route:** `/student/upload-syllabus`
- **Calls:** `parse-syllabus-document` edge function (already exists in syllabusstack)
- **Adaptation:** Use syllabusstack's existing `useProcessSyllabus` hook + extend it

### 4.2 Add ReviewSyllabus Page
- **New file:** `src/pages/student/ReviewSyllabus.tsx`
- **Features:** Display parsed course data (title, level, weeks, outcomes, artifacts), editable fields, "Generate Projects" CTA
- **Route:** `/student/review-syllabus/:courseId`

### 4.3 Add Configure Page
- **New file:** `src/pages/student/ConfigureDiscovery.tsx`
- **Features:** Target industries, company names, team count inputs; polling for generation status; progress tracking
- **Route:** `/student/configure/:courseId`
- **Calls:** `discover-companies` + `generate-capstone-projects` edge functions

### 4.4 Add Student Apply Flow
- **New component:** `src/components/capstone/StudentApplyButton.tsx`
- **DB:** Add `capstone_applications` table operations (already exists)
- **Hook:** Extend `useCapstoneProjects.ts` with `useApplyToProject()` mutation
- **UI:** "Apply Now" button on project cards in student view

### 4.5 Add Routes
- **File:** `src/App.tsx`
- **Add routes:**
  - `/student/upload-syllabus`
  - `/student/review-syllabus/:courseId`
  - `/student/configure/:courseId`

---

## Phase 5: Frontend — Rich Project Detail (MEDIUM IMPACT)

### 5.1 Port Project Detail Components
Create `src/components/project-detail/` directory with adapted versions of:

| Component | Source Size | Purpose |
|-----------|-----------|---------|
| `PrintableProjectView.tsx` | 7.8K | PDF export |
| `MarketInsightsTab.tsx` | 25.8K | Company profile, hiring, tech stack |
| `SalaryROICard.tsx` | 13.1K | Salary projections |
| `CareerPathwayCard.tsx` | 10.7K | Career trajectory |
| `SkillGapAnalysisCard.tsx` | 10.3K | Skill requirements analysis |

**Note:** syllabusstack already has `ProjectReportView.tsx` and `ProjectDetailTabs.tsx` with 12 tabs. These new components should be integrated into the existing tab structure rather than replacing it.

### 5.2 Add Quality Badges
- **Component:** `src/components/capstone/QualityBadge.tsx`
- **Logic:** Letter grades (A+ ≥85%, A ≥80%, B+ ≥75%, B ≥70%, C <70%) based on composite signal score
- **Integrate:** Into `CapstoneProjectCard.tsx` and project detail header

### 5.3 Add PDF Export
- **Component:** Adapt `PrintableProjectView.tsx` for syllabusstack
- **Library:** Already has `html2pdf.js` in dependencies
- **Button:** Add "Export PDF" to project detail view

---

## Phase 6: Database Migrations (Required for Phases 3-5)

### 6.1 Atomic RPC Migration
```sql
CREATE OR REPLACE FUNCTION create_project_atomic(
  p_project_data JSONB, p_forms_data JSONB, p_metadata_data JSONB
) RETURNS JSONB AS $$
  -- Insert project, forms, metadata in single transaction
  -- Rollback all on any failure
$$ LANGUAGE plpgsql;
```

### 6.2 Student Application Enhancements
- Add indexes on `capstone_applications` for student queries
- Add RLS policies for student access to capstone_projects (read-only for enrolled students)

---

## Dependency Graph

```
Phase 1.1 (Provider Interface + Occupation Services)
Phase 1.2 (Lightcast Integration)
Phase 1.3 (Embedding + Semantic Services) ──depends on──> Phase 1.1
Phase 1.4 (Pipeline Orchestrator) ──depends on──> Phase 1.1, 1.2, 1.3

Phase 2 (Upgrade Degraded Services) ──depends on──> Phase 1.3

Phase 3.1 (Upgrade discover-companies) ──depends on──> Phase 1.4, Phase 2
Phase 3.2 (Post-gen validation) ──independent──
Phase 3.3 (Atomic RPC) ──depends on──> Phase 6.1
Phase 3.4 (Rate limit headers) ──independent──

Phase 4 (Student Upload Flow) ──depends on──> Phase 3.1, 3.2
Phase 5 (Rich Project Detail) ──independent (can parallel with Phase 4)──
Phase 6 (DB Migrations) ──should run before Phase 3.3, 4.4──
```

## Verification Plan

### Backend Testing
1. **Unit tests:** Add tests for each new service in `supabase/functions/tests/`
   - Test circuit breaker state transitions
   - Test semantic-validation-v2 with mock Lightcast data
   - Test occupation-coordinator with mock multi-provider responses
   - Test create_project_atomic rollback on failure
2. **Integration test:** Run full discover-companies pipeline with a test course
3. **Comparison test:** Generate projects for same course in both repos, compare quality scores

### Frontend Testing
1. **Upload flow:** Upload a PDF syllabus → verify parsed data → configure discovery → verify projects generated
2. **Student apply:** Login as student → browse projects → apply → verify application recorded
3. **Project detail:** Open project → verify all tabs render → export PDF → verify output
4. **Instructor flow:** Verify existing instructor flow still works unchanged

### Environment Setup
- Set env vars: `LIGHTCAST_CLIENT_ID`, `LIGHTCAST_CLIENT_SECRET`, `USE_NEW_PIPELINE=true`
- Verify Apollo API key works with new precise discovery
- Test ESCO API connectivity (free, no auth)

---

## Estimated Scope

| Phase | New/Modified Files | Effort |
|-------|-------------------|--------|
| Phase 1 | 13 new files (~180K total) | Large |
| Phase 2 | 10 modified files (~+100K delta) | Medium |
| Phase 3 | 4 modified/new files | Medium |
| Phase 4 | 5 new files + route changes | Medium |
| Phase 5 | 6 new components + integrations | Medium |
| Phase 6 | 2 migrations | Small |

**Critical path:** Phase 1 → Phase 2 → Phase 3.1 (discovery pipeline upgrade)
**Quick wins:** Phase 3.2 (post-gen validation), Phase 3.4 (rate limit headers), Phase 5.2 (quality badges)
