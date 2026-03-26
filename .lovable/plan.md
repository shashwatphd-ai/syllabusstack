

# PRD: Merge EduThree1 into SyllabusStack

## 1. Executive Summary

SyllabusStack is the primary production application with a full learning management pipeline (syllabus processing, curriculum generation, assessments, slides, career tools, billing, certificates). EduThree1 is a capstone-focused prototype that pioneered company discovery, project generation, employer engagement, and student competency tracking. Many EduThree1 backend functions have already been ported to SyllabusStack (PRs #124-125). This PRD covers the remaining frontend features, backend utilities, and architectural patterns from EduThree1 that should be consolidated into SyllabusStack to create a single unified product.

---

## 2. What Already Exists in Both (No Work Needed)

These are fully ported or have SyllabusStack equivalents:

| Area | Status |
|------|--------|
| Company discovery pipeline (10-phase) | Ported to SS `_shared/capstone/` |
| Project generation + queue processing | Ported (`generate-capstone-projects`, `run-single-project-generation`) |
| Apollo integration (enrichment, jobs, contacts) | Ported to SS |
| 4-signal scoring (Skill Match, Market Intel, Dept Fit, Contact Quality) | Ported |
| 3D market alignment model | Ported (PR #125) |
| `project_metadata`, `partnership_proposals`, `evaluations` tables | Migrated (PR #124) |
| `capstone_projects`, `company_profiles` schema extensions | Migrated |
| Job matcher, employer-verify-completion, sync-project-match | Exist in SS |
| Demand board page | Exists at `/demand-board` in both |
| `analyze-project-value`, `generate-value-analysis`, `generate-premium-insights` | Exist in SS |
| 12-tab ProjectDetailTabs (Value Analysis, Premium Insights, Discovery Quality, etc.) | Exist in SS |
| `ProposePartnershipDialog`, `ProjectFeedbackDialog` | Exist in SS |
| `AdminCapstoneAnalytics`, `AdminEmployerLeads` | Exist in SS |
| `EmployerCapstoneTab` | Exists in SS |

---

## 3. What Needs to Be Merged

### 3.1 Frontend Components — EduThree1-only

| EduThree1 Component | Purpose | SS Equivalent | Action |
|---------------------|---------|---------------|--------|
| `components/signals/` (7 files) | Professional signal dashboard, evidence-based cards, match insights | None — SS has `DemandSignalBadge` only | **Port** signal visualization components into SS `components/capstone/signals/` |
| `components/skeletons/DashboardSkeleton` | Loading states for role-based dashboards | SS uses ad-hoc Skeleton patterns | **Port** as shared skeleton component |
| `components/notifications/` | `NotificationBell` + `RealtimeNotificationListener` | SS has no notification system | **Port** into SS `components/common/` |
| `components/premium/LiveDemandBadge` | Real-time demand indicator on projects | None | **Port** into `components/capstone/` |
| `components/hiring/CompanyHiringBadge` | Active hiring indicator from Apollo jobs | SS has `CompanyHiringBadge` in capstone/ | **Already ported** — verify parity |

### 3.2 Frontend Pages — EduThree1-only

| Page | Purpose | Action |
|------|---------|--------|
| `MyOpportunities` | Student views job matches from `job_matches` table with search/filter | **Port** as `/student/jobs` — SS already has route + `StudentJobMatches.tsx`, verify it matches EduThree1 functionality |
| `MyCompetencies` | Student views verified competencies + portfolio export | **Port** as `/student/portfolio` — SS has `StudentPortfolio.tsx`, verify it includes competency display + export |
| `StudentDashboard` (role-based) | Unified dashboard showing applications, job matches, recommended projects, competencies | **Integrate** EduThree1's stat cards and `RecommendedProjects` into SS's existing student dashboard |
| `InstructorDashboard` (role-based) | Faculty syllabus management with realtime | SS has full instructor flow at `/instructor/courses` — **Skip**, SS is superior |
| `EmployerDashboard` (role-based) | Employer project management, student applications, rating | SS has `/employer` — **Merge** student application management + rating dialog |
| `AdminProviderTest` | Test AI providers | **Skip** — development tool only |

### 3.3 Hooks — EduThree1-only

| Hook | Purpose | Action |
|------|---------|--------|
| `useStudentDashboard` | Fetches student metrics (applications, matches, competencies) | **Port** |
| `useStudentRealtime` | Realtime subscriptions for student data changes | **Port** |
| `useEmployerDashboard` | Fetches employer projects, applications, company profile | **Port** — merge with SS's existing employer hooks |
| `useEmployerRealtime` | Realtime for employer data | **Port** |
| `useInstructorRealtime` | Realtime for instructor data | **Port** |
| `useRealtimeNotifications` | Cross-role notification listener | **Port** |
| `useNewJobMatchCount` | Badge count for new job matches | **Port** |
| `usePaginatedCourses` | Cursor-based pagination for course lists | **Port** if SS doesn't have equivalent |
| `usePaginatedProjects` | Cursor-based pagination for project lists | **Port** |
| `useProjectAnalytics` | Analytics data for project performance | **Port** |
| `useDemandSignals` | Demand signal aggregation hooks | **Port** |

### 3.4 Contexts — EduThree1-only

| Context | Purpose | Action |
|---------|---------|--------|
| `NotificationContext` | Manages notification state, unread counts, mark-as-read | **Port** — SS has no notification system |

### 3.5 Backend Shared Utilities — EduThree1-only

These `_shared/` files exist only in EduThree1 and power features not yet in SS:

| File | Purpose | Action |
|------|---------|--------|
| `signals/` directory | Signal scoring sub-modules | **Verify** — SS has these in `_shared/capstone/` |
| `alignment-service.ts` | LO-to-project alignment scoring | **Verify** SS parity in capstone/ |
| `apollo-precise-discovery.ts` | Multi-strategy Apollo search | **Verify** — likely in SS `_shared/capstone/` |
| `company-ranking-service.ts` | 9-factor ranking algorithm | **Verify** parity |
| `embedding-service.ts` | Vector embedding for semantic matching | SS has `embedding-client.ts` — **Verify** same functionality |
| `lightcast-service.ts` + `lightcast-skill-extractor.ts` | Lightcast labor market data | SS has `lightcast-client.ts` — **Verify** parity |
| `semantic-matching-service.ts` + `semantic-validation-v2-service.ts` | TF-IDF + semantic validation | SS has `similarity.ts` — **Verify** these are consolidated |
| `esco-provider.ts`, `skills-ml-provider.ts` | Alternative skill taxonomy providers | **Port** if not in SS `_shared/skills-pipeline/` |
| `pricing-service.ts` | Deterministic project pricing model | **Verify** in SS generation service |
| `pipeline-types.ts`, `signal-types.ts` | TypeScript types for pipeline | **Merge** into SS types |

### 3.6 Edge Functions — EduThree1-only

| Function | Purpose | SS Equivalent | Action |
|----------|---------|---------------|--------|
| `competency-extractor` | Extract skills from completed projects | SS has `extract-capstone-competencies` | **Verify** parity |
| `data-enrichment-pipeline` | Batch company data enrichment | No direct equivalent | **Port** |
| `firecrawl-career-pages` | Scrape company career pages | SS has `firecrawl-search-courses` (different purpose) | **Port** |
| `get-apollo-org-id` | Standalone Apollo org lookup | Likely inlined in SS discovery | **Skip** if inlined |
| `import-university-data` | Bulk university import | No equivalent | **Port** for admin use |
| `investigate-apollo-jobs` | Deep Apollo job analysis | May be in SS discovery | **Verify** |
| `migrate-technology-format` | One-time data migration | **Skip** — one-time utility |
| `parse-syllabus` | EduThree1's syllabus parser | SS has `parse-syllabus-document` + `process-syllabus` (superior) | **Skip** |
| `rate-student-performance` | Employer rates student work | No equivalent | **Port** |
| `test-apollo-news` | Dev testing tool | **Skip** |
| `TEST-real-email`, `TEST-talent-alert` | Dev testing | **Skip** |
| `admin-reset-password` | Admin password reset | No equivalent | **Port** |

---

## 4. Implementation Phases

### Phase 1: Notification System (3-4 PRs)
1. Port `NotificationContext` + `RealtimeNotificationListener` + `NotificationBell`
2. Add notification bell to SS's `AppLayout` header
3. Wire realtime subscriptions for role-based events

### Phase 2: Signal Visualization (2 PRs)
1. Port `components/signals/` (7 files) into `components/capstone/signals/`
2. Integrate `ProfessionalSignalDashboard` into project detail views
3. Port `LiveDemandBadge` for project cards

### Phase 3: Student Capstone Experience (2-3 PRs)
1. Port `useStudentDashboard` + `useStudentRealtime` hooks
2. Enhance `StudentCapstoneProjects` with recommended projects, application tracking
3. Verify `StudentJobMatches` parity with EduThree1's `MyOpportunities`
4. Verify `StudentPortfolio` includes competency display + export

### Phase 4: Employer Dashboard Enhancement (2 PRs)
1. Port `useEmployerDashboard` + `useEmployerRealtime`
2. Merge student application management + `StudentRatingDialog` into SS employer view
3. Port `rate-student-performance` edge function

### Phase 5: Backend Utilities (1-2 PRs)
1. Port `data-enrichment-pipeline` edge function
2. Port `firecrawl-career-pages` for career page scraping
3. Port `admin-reset-password`
4. Verify and consolidate shared utility parity (alignment, ranking, signals)
5. Port `import-university-data` for admin

### Phase 6: Pagination + Performance (1 PR)
1. Port `usePaginatedCourses` and `usePaginatedProjects` for large dataset handling
2. Port `DashboardSkeleton` as shared loading component

---

## 5. What to Explicitly Skip

| Item | Reason |
|------|--------|
| EduThree1 Landing page | SS has a superior multi-section landing page |
| EduThree1 Auth page | SS auth is more complete (forgot password, reset, SSO) |
| `parse-syllabus` | SS's `parse-syllabus-document` + `process-syllabus` is superior (Gemini 3 Flash, 1M+ tokens) |
| `Configure` page | SS has `DiscoveryConfigDialog` inline |
| `ReviewSyllabus` page | SS has `SyllabusReview` at `/instructor/courses/:id/review` |
| `Upload` page | SS syllabus upload is integrated into course creation |
| `AdminTestDashboard`, `AdminProviderTest` | Dev-only tools |
| EduThree1's `Header` component | SS layout system is more mature |
| One-time migration scripts | Already executed |
| `ErrorBoundary` | SS has its own |

---

## 6. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Database schema conflicts | Both projects share the same underlying tables; verify column compatibility before porting queries |
| Realtime subscription load | EduThree1 uses per-role subscriptions; consolidate into a single channel-per-user pattern |
| Type conflicts | EduThree1 has `types/project-detail.ts` and `types/project-detail-components.ts` — merge carefully with SS's existing type definitions |
| Duplicate edge functions | Several functions exist in both with slight differences — always prefer SS version, port only truly missing logic |

---

## 7. Success Criteria

- All EduThree1 user journeys (student applications, employer ratings, notification bell, signal dashboards) work in SyllabusStack
- No regression in existing SS features (learning pipeline, assessments, slides, career tools)
- EduThree1 can be archived after merge
- Zero duplicate edge functions between the two codebases

