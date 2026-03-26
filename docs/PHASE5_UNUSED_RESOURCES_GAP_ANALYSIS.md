# Phase 5: Unused Resources & Gap Analysis

> **Report Date:** 2026-03-26
> **Scope:** Resources not being used, gaps between repos, and recommendations

---

## 1. Edge Functions Never Called from Frontend (41 functions)

These edge functions exist in `syllabusstack/supabase/functions/` but are **never invoked** by any frontend code (`src/`):

### 1A. Background/Cron/Webhook Functions (expected to be unused from frontend)

These are server-side functions triggered by cron jobs, webhooks, or other edge functions:

| Function | Trigger Mechanism | Status |
|----------|-------------------|--------|
| `apollo-webhook-listener` | Apollo.io webhook | OK - webhook-triggered |
| `stripe-webhook` | Stripe webhook | OK - webhook-triggered |
| `idv-webhook` | Identity verification webhook | OK - webhook-triggered |
| `send-employer-webhook` | Called by other functions | OK - server-side |
| `send-digest-email` | Cron job | OK - scheduled |
| `send-student-message` | Called by other functions | OK - server-side |
| `send-faculty-approval-email` | Called by other functions | OK - server-side |
| `process-generation-queue` | Cron/queue processor | OK - background job |
| `process-lecture-queue` | Cron/queue processor | OK - background job |
| `cleanup-orphaned-data` | Cron job | OK - maintenance |
| `refresh-company-jobs` | Cron job | OK - scheduled |
| `trigger-pending-evaluations` | Cron job | OK - scheduled |
| `trigger-progressive-generation` | Cron job | OK - scheduled |
| `poll-active-batches` | Called by other functions | OK - server-side |
| `poll-batch-curriculum` | Called by other functions | OK - server-side |
| `poll-batch-evaluation` | Called by other functions | OK - server-side |
| `run-single-project-generation` | Called by `process-generation-queue` | OK - server-side |

### 1B. Truly Unused Functions (likely dead code or unfinished features)

| Function | Purpose | Likely Reason |
|----------|---------|---------------|
| `add-instructor-content` | Add instructor content | **Dead code** - content added via direct DB inserts |
| `admin-regenerate-projects` | Regenerate projects for a course | **Ported from projectify** but admin UI doesn't call it |
| `aggregate-demand-signals` | Aggregate demand data | **Ported from projectify** but demand board doesn't call it |
| `analyze-project-value` | Analyze project value | **Ported from projectify** but detail view uses `generate-value-analysis` instead |
| `cancel-batch-job` | Cancel a batch job | **Unfinished** - no cancel button in UI |
| `career-pathway-mapper` | Map career paths | **Ported from projectify** but career page uses `match-careers` instead |
| `compare-web-providers` | Compare service providers | **Unfinished** - no UI page |
| `configure-organization-sso` | SSO configuration | **Unfinished** - no SSO settings page |
| `evaluate-content-batch` | Batch content evaluation | **Unfinished** - batch evaluation UI not built |
| `generate-content-strategy` | AI content strategy | **Unfinished** - no UI |
| `generate-search-context` | Contextualize search results | **Unused** - search doesn't use it |
| `get-live-demand` | Live demand data | **Ported from projectify** but demand board queries DB directly |
| `project-suitability-scorer` | Score project fit | **Ported from projectify** but scoring done in `generate-capstone-projects` |
| `record-proctor-event` | Proctoring events | **Unfinished** - no proctoring UI |
| `salary-roi-calculator` | Salary ROI calculation | **Ported from projectify** but never wired to UI |
| `search-educational-content` | Multi-source search | **Replaced** by YouTube + Khan Academy individual searches |
| `search-khan-academy` | Khan Academy search | **Unused** - Khan Academy search not in any UI |
| `skill-gap-analyzer` | Skill gap analysis | **Ported from projectify** but `gap-analysis` used instead |
| `student-project-matcher` | Match students to projects | **Ported from projectify** but not wired to student UI |
| `student-search-agent` | AI search agent | **Unfinished** - no student search UI |
| `submit-batch-curriculum` | Submit curriculum batch | **Unused** - curriculum generation is single-request |
| `submit-batch-evaluation` | Submit batch evaluation | **Unused** - evaluation is single-request |
| `submit-employer-interest` | Employer interest form | **Ported from projectify** but employer UI uses different flow |
| `sync-project-match` | Sync project updates | **Ported from projectify** but not called anywhere |

**Total truly unused: 24 functions**

---

## 2. Unused Frontend Hooks (non-test files)

| Hook | Purpose | Likely Reason |
|------|---------|---------------|
| `useAIGeneration` | Unified AI generation hook | **Replaced** by specific hooks (useBatchSlides, etc.) |
| `useAdminAnalytics` | Admin analytics | **Referenced** in AdminDashboard but imported indirectly via barrel export |
| `useInstructorNotifications` | Instructor notifications | **Unfinished** - notification system not built |
| `useOnboardingProgress` | Onboarding progress tracking | **Unfinished** - onboarding flow simplified |
| `usePlacementOutcomes` | Placement outcomes data | **Unfinished** - outcomes report uses different approach |
| `useRecommendationLinks` | Recommendation course links | **Unused** - recommendations display doesn't use links |
| `useUsageStats` | Usage statistics | **Unused** from pages (may be used in admin but indirectly) |

---

## 3. Features in `projectify-syllabus` NOT Ported to `syllabusstack`

| Feature | projectify-syllabus | syllabusstack Status |
|---------|---------------------|---------------------|
| **Firecrawl career page scraping** | `firecrawl-career-pages` | Not ported - job data from Apollo |
| **Firecrawl generic scraping** | `firecrawl-scrape` | Not ported - replaced by `firecrawl-search-courses` |
| **Apollo org ID lookup** | `get-apollo-org-id` | Merged into discovery pipeline |
| **University data import** | `import-university-data` | Not ported |
| **Student performance rating** | `rate-student-performance` | Not ported - assessments handle evaluation |
| **Data enrichment pipeline** | `data-enrichment-pipeline` | Merged into discovery |
| **Technology format migration** | `migrate-technology-format` | One-time migration, not needed |
| **Hiring Signal** | `signals/hiring-signal.ts` | May be merged into Market Intel signal |
| **Project detail edge function** | `get-project-detail` | Replaced by direct DB query in frontend |
| **Company signals table** | `company_signals` | Signals stored in `company_profiles` directly |
| **Adzuna job provider** | `adzuna-provider.ts` | Not ported - only Apollo used |
| **Circuit breaker pattern** | `circuit-breaker.ts` | Not ported - relies on OpenRouter retries |
| **Provider factory** | `provider-factory.ts` | Not ported - single provider (Apollo) |
| **faculty_expertise field** | In project JSON output | Not in syllabusstack prompt output |
| **publication_opportunity field** | In project JSON output | Not in syllabusstack prompt output |
| **Dashboard analytics view** | `dashboard_analytics` DB view | Not ported |

---

## 4. Features in `syllabusstack` NOT in `projectify-syllabus`

| Feature Category | Count | Examples |
|-----------------|-------|---------|
| **Lecture Slide Generation** | 8 functions | generate-lecture-slides-v3, process-batch-images, etc. |
| **Assessment System** | 12 functions | start-assessment, generate-assessment-questions, etc. |
| **Career/Dream Jobs** | 8 functions | discover-dream-jobs, gap-analysis, match-careers, etc. |
| **Billing/Subscription** | 7 functions | Stripe integration, certificates, invoices |
| **User Management** | 10 functions | Invitations, SSO, verification, messaging |
| **Identity Verification** | 3 functions | IDV initiation, status, webhook |
| **Curriculum Generation** | 3 functions | generate-curriculum, curriculum-reasoning-agent, etc. |
| **Content Search** | 5 functions | YouTube, educational content, global search |
| **Employer Portal** | 4 functions | Webhooks, verification, job scraping |
| **Multi-provider AI** | 1 (unified-ai-client) | OpenRouter + Vertex + Google + EvoLink |
| **Centralized Prompts** | 2 files (37,000+ LoC) | prompts.ts + slide-prompts.ts |
| **Bloom's Taxonomy** | Integrated into generation | Tier-based project complexity |
| **6-Form Project Structure** | `project_forms` table | Normalized project data |
| **Generation Run Tracking** | `capstone_generation_runs` | Progress tracking for long operations |

---

## 5. Database Tables: Usage Analysis

### Tables Queried by Frontend but Potentially Underused

| Table | Query Count (hooks) | Notes |
|-------|-------------------|-------|
| `partnership_proposals` | 1 read | Only fetched, never created from UI |
| `employer_interest_submissions` | 1 read | Only fetched, submit goes through edge fn |
| `capstone_applications` | 1 read, 1 insert | Minimal usage |
| `placement_outcomes` | Read in unused hook | Hook not imported anywhere |
| `verified_skills` | Read in test hook | Test file only |
| `suggestion_votes` | 1 insert | Minimal feature |
| `student_ratings` | 1 read, 1 insert | Minimal feature |
| `user_xp` | 1 read | Gamification - read only |
| `achievements` / `user_achievements` | 1 read | Gamification - read only |

### Tables in projectify-syllabus NOT in syllabusstack

| Table | Purpose | Status |
|-------|---------|--------|
| `company_signals` | Separate signal scores | Signals embedded in `company_profiles` in syllabusstack |
| `course_profiles` | Course data | Replaced by `courses` + `instructor_courses` |
| `projects` | Generated projects | Replaced by `capstone_projects` + `project_forms` |
| `verified_competencies` | Verified student competencies | Replaced by `capabilities` + `verified_skills` |
| `generation_runs` | Generation tracking | Replaced by `capstone_generation_runs` |
| `project_generation_queue` | Generation queue | Handled by `process-generation-queue` edge fn |
| `syllabi` | Uploaded files | Files stored in Supabase Storage |
| `evaluations` | Simple evaluations | Replaced by `assessment_sessions` + `assessment_questions` |
| `dashboard_analytics` | Dashboard metrics | Computed on-the-fly from other tables |
| `project_feedback_analytics` | Feedback aggregation | Replaced by `project_feedback` table |

---

## 6. External Service Usage Comparison

| Service | `projectify-syllabus` | `syllabusstack` |
|---------|----------------------|-----------------|
| **Apollo.io** | Company discovery, enrichment | Same (identical API calls) |
| **Lightcast** | Skill normalization, embeddings | Same |
| **O*NET** | Occupation mapping | Same + `get-onet-occupation` edge fn |
| **Lovable AI** | ALL AI calls | **NOT USED** - replaced by OpenRouter |
| **OpenRouter** | Not used | ALL AI text generation |
| **Google Direct** | Not used | Image generation (toggle) |
| **EvoLink** | Not used | Budget image generation (toggle) |
| **Vertex AI** | Not used | Batch slide generation (toggle) |
| **Perplexity** | Not used | Research/grounding (via OpenRouter) |
| **DeepSeek** | Not used | Curriculum reasoning (via OpenRouter) |
| **Stripe** | Not used | Billing, subscriptions, certificates |
| **YouTube API** | Not used | Content search |
| **Khan Academy** | Not used | Content search (but unused from UI) |
| **Firecrawl** | Career pages, generic scraping | Course search only |
| **Adzuna** | Job search provider | **NOT USED** in syllabusstack |
| **Google Cloud TTS** | Not used | Audio narration |

---

## 7. Summary: What Needs Attention

### High Priority (Affecting Results)

1. **Model version gap**: syllabusstack uses gemini-3-flash-preview vs projectify's gemini-2.5-flash - significant quality difference
2. **Input data divergence**: Instructor-authored LOs vs AI-extracted outcomes produce fundamentally different project proposals
3. **Missing Bloom's tier in projectify**: Projects lack complexity calibration
4. **Missing AI validation in projectify**: All companies get projects regardless of fit

### Medium Priority (Dead Code / Unused Resources)

5. **24 unused edge functions** in syllabusstack should be reviewed - keep, wire up, or remove
6. **7 unused hooks** should be cleaned up
7. **`search-khan-academy`** is deployed but never called from any UI
8. **`career-pathway-mapper`** ported from projectify but never wired (uses `match-careers` instead)
9. **`salary-roi-calculator`** ported but never wired to any frontend

### Low Priority (Missing Features)

10. **Adzuna job provider** not ported (was backup in projectify)
11. **Circuit breaker pattern** not ported (OpenRouter handles retries)
12. **faculty_expertise / publication_opportunity** fields not in syllabusstack output
13. **Hiring signal** may need explicit porting if not merged into Market Intel

---

## 8. Files Referenced in This Report

All 5 phases reference these key files:

**syllabusstack:**
- `supabase/functions/generate-capstone-projects/index.ts` (507 lines)
- `supabase/functions/_shared/capstone/generation-service.ts` (281 lines)
- `supabase/functions/_shared/unified-ai-client.ts` (1,391 lines)
- `supabase/functions/_shared/openrouter-client.ts` (MODELS definition)
- `supabase/functions/_shared/prompts.ts` (9,396 lines)
- `supabase/functions/analyze-syllabus/index.ts` (325 lines)
- `supabase/functions/discover-companies/index.ts` (673 lines)
- `src/hooks/useCapstoneProjects.ts` (main capstone hook)

**projectify-syllabus:**
- `supabase/functions/generate-projects/index.ts` (~500 lines)
- `supabase/functions/_shared/generation-service.ts` (~400 lines)
- `supabase/functions/parse-syllabus/index.ts` (382 lines)
- `supabase/functions/discover-companies/index.ts` (1,727 lines)
- `supabase/functions/_shared/circuit-breaker.ts`
- `supabase/functions/_shared/signals/signal-orchestrator.ts`
