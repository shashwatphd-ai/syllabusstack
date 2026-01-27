# Master Implementation Plan: Production-Ready SyllabusStack

**Date:** 2026-01-27
**Source Documents:** PRODUCTION_IMPLEMENTATION_PLAN.md, SPRINT_TASKS.md, FRONTEND_UX_COMPREHENSIVE_REVIEW.md, CODE_CLARITY_REFACTORING_REPORT.md
**Verified Against:** Actual codebase state (build, tests, schema)

---

## Executive Summary

This plan reconciles four source documents against the verified codebase state to provide a complete roadmap for making SyllabusStack production-ready.

### Current State Assessment

| Metric | Documentation Claims | Verified Reality |
|--------|---------------------|------------------|
| Sprint Completion | All 9 COMPLETED | **Features exist but quality gaps remain** |
| Build Status | Not specified | **PASSES (0 errors)** |
| Type Checking | Not specified | **PASSES (0 errors)** |
| Test Suite | >80% coverage | **92% passing (12 fail / 139 pass)** |
| Edge Function Standardization | Not specified | **2.6% (2 of 78)** |
| Security Features | Listed | **Partial implementation** |

### Key Gaps Identified

| Category | Gap | Impact |
|----------|-----|--------|
| Testing | 2 missing hooks, 6 mock issues | Tests fail |
| Database | `last_accessed_at` column missing | Runtime errors in analytics |
| Security | No email verification | Account security |
| UX | Assessment progress not saved | Data loss risk |
| Code Quality | 76 edge functions lack error handling | Production stability |

---

## Part 1: Foundation Fixes (Week 1)

These must be completed first as other features depend on them.

### 1.1 Test Suite Stabilization

**Goal:** All 151 tests passing

#### Task 1.1.1: Create Missing Hook - useCourseProgress.ts

**Source:** SPRINT_TASKS.md Sprint 7, PRODUCTION_IMPLEMENTATION_PLAN.md Appendix C

**File:** `src/hooks/useCourseProgress.ts`

**Required Exports:**
```typescript
export interface ObjectiveProgress {
  id: string;
  objectiveId: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt: string | null;
  assessmentPassed: boolean | null;
  assessmentScore: number | null;
  timeSpent: number;
}

export interface ModuleProgress {
  id: string;
  moduleId: string;
  title: string;
  orderIndex: number;
  status: 'not_started' | 'in_progress' | 'completed';
  objectives: ObjectiveProgress[];
  completedObjectives: number;
  totalObjectives: number;
  percentComplete: number;
  completedAt: string | null;
}

export interface CourseProgress {
  enrollmentId: string;
  courseId: string;
  userId: string;
  courseTitle: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  enrolledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
  overallProgress: number;
  modules: ModuleProgress[];
  completedModules: number;
  totalModules: number;
  completedObjectives: number;
  totalObjectives: number;
  totalTimeSpent: number;
  currentModule: ModuleProgress | null;
  currentObjective: ObjectiveProgress | null;
  certificateEarned: boolean;
  certificateId: string | null;
}

export function useCourseProgress(courseId: string | undefined): UseQueryResult<CourseProgress | null>;
export function useEnrollment(courseId: string | undefined): UseQueryResult<CourseProgress | null>;
export function useModuleProgress(moduleId: string | undefined): UseQueryResult<ModuleProgress | null>;
```

**Implementation:** Query course_enrollments → course_modules → learning_objectives → assessment_sessions

**Effort:** 4-6 hours

---

#### Task 1.1.2: Create Missing Hook - useGapAnalysis.ts

**Source:** SPRINT_TASKS.md Sprint 7

**File:** `src/hooks/useGapAnalysis.ts`

**Solution:** Re-export from existing `useAnalysis.ts`:
```typescript
// src/hooks/useGapAnalysis.ts
export { useGapAnalysis, type SkillGap } from './useAnalysis';
```

**Effort:** 5 minutes

---

#### Task 1.1.3: Fix Test Mock Hoisting (6 files)

**Source:** Verified via test run

**Affected Files:**
- `src/hooks/useGradebook.test.ts`
- `src/hooks/useNotifications.test.ts`
- `src/hooks/useRecommendations.test.ts`
- `src/hooks/useVerifiedSkills.test.ts`
- `src/hooks/useCareerMatches.test.ts`
- `src/hooks/useTeachingUnits.test.ts`

**Fix Pattern:**
```typescript
// Change FROM:
const mockSupabase = { auth: { getUser: vi.fn() }, from: vi.fn() };
vi.mock('@/integrations/supabase/client', () => ({ supabase: mockSupabase }));

// Change TO:
const mockSupabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  functions: { invoke: vi.fn() },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mockSupabase }));
```

**Effort:** 2-3 hours total

---

#### Task 1.1.4: Fix Component Test Router Issue

**File:** `src/components/recommendations/CurrentlyLearningPanel.test.tsx`

**Problem:** Test wrapper includes BrowserRouter, component renders another Router

**Fix:** Use MemoryRouter in test wrapper without nesting

**Effort:** 30 minutes

---

### 1.2 Database Schema Alignment

#### Task 1.2.1: Add last_accessed_at Column

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Section 2.2.1, verified via types.ts analysis

**Migration File:** `supabase/migrations/20260127_add_last_accessed_at.sql`

```sql
-- Add last_accessed_at to course_enrollments for activity tracking
-- Required by: useInstructorAnalytics, useGradebook

ALTER TABLE public.course_enrollments
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

-- Index for "active in last 7 days" queries
CREATE INDEX IF NOT EXISTS idx_enrollments_last_accessed
ON course_enrollments(last_accessed_at)
WHERE last_accessed_at IS NOT NULL;

-- Auto-update on content consumption
CREATE OR REPLACE FUNCTION update_enrollment_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE course_enrollments
  SET last_accessed_at = NOW()
  WHERE student_id = NEW.user_id
    AND instructor_course_id = NEW.instructor_course_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_enrollment_activity ON consumption_records;
CREATE TRIGGER trg_update_enrollment_activity
AFTER INSERT ON consumption_records
FOR EACH ROW
EXECUTE FUNCTION update_enrollment_last_accessed();
```

**Post-Migration:** `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`

**Effort:** 1 hour

---

## Part 2: Security Hardening (Week 2)

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 11, PRODUCTION_IMPLEMENTATION_PLAN.md Section 4.2

### 2.1 Authentication Security

#### Task 2.1.1: Email Verification

**Priority:** CRITICAL (Section 12, Issue #1)

**Files to Create:**
- `src/components/auth/EmailVerificationBanner.tsx`
- `supabase/functions/send-verification-email/index.ts`

**Implementation:**
1. Modify signup flow to send verification email
2. Add banner on protected pages for unverified users
3. Restrict certain features until verified

**Effort:** 6 hours

---

#### Task 2.1.2: Strengthen Password Requirements

**Priority:** CRITICAL (Section 12, Issue #2)

**File:** `src/pages/Auth.tsx`

**Current:** Min 6 characters
**Target:** Min 8 characters, 1 uppercase, 1 number, 1 special

**Effort:** 1 hour

---

#### Task 2.1.3: Rate Limiting Implementation

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Section 4.2.1, CODE_CLARITY_REFACTORING_REPORT.md Section 3.3

**File:** `supabase/functions/_shared/rate-limiter.ts` (EXISTS but underused)

**Current Usage:** 2 functions
**Target Usage:** All AI and auth functions

**Rate Limits per PRODUCTION_IMPLEMENTATION_PLAN.md:**
- AI functions: 10 requests/minute per user
- Search functions: 30 requests/minute per user
- Auth functions: 5 attempts/minute per IP
- Employer API: Based on tier (100-10000/day)

**Functions to Add Rate Limiting:**
```
Priority 1 (AI-intensive):
- generate-slides-batch
- discover-dream-jobs
- generate-assessment-questions
- match-careers
- evaluate-content-batch
- curriculum-reasoning-agent

Priority 2 (Auth):
- All auth-related functions
```

**Effort:** 4 hours

---

#### Task 2.1.4: Server-Side Webhook Secrets

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 11 (High severity)

**Problem:** Webhook secret generated client-side in `WebhookSettings.tsx`

**Fix:** Generate secrets server-side in edge function

**Effort:** 2 hours

---

### 2.2 Input Validation Audit

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Section 4.2.2

**Tasks:**
1. Audit all 78 edge functions for input validation
2. Add Zod schemas for all inputs
3. Sanitize user-provided text before AI prompts
4. Validate file uploads (size, type, content)

**Effort:** 8 hours

---

### 2.3 RLS Policy Audit

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Section 4.2.3

**Tasks:**
1. Review all 73 tables for RLS policies
2. Test with different user roles
3. Document intentional public access
4. Fix any data leakage issues

**Effort:** 6 hours

---

## Part 3: UX Critical Fixes (Week 2-3)

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Sections 4, 5, 6, 12

### 3.1 Assessment Progress Auto-Save

**Priority:** CRITICAL (Section 12, Issue #3)

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 6.4

**Problem:** "Connection loss = lost progress"

**Files to Modify:**
- `src/components/assessment/AssessmentSession.tsx`
- `src/hooks/useAssessment.ts`

**Implementation:**
1. Auto-save answers to localStorage every answer
2. On reconnect, offer to restore progress
3. Save progress to server every 5 answers

**Effort:** 4 hours

---

### 3.2 Form Persistence

**Priority:** HIGH (Section 12, Issue #6)

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 4

**Problem:** Onboarding data lost if page closes

**Files to Modify:**
- `src/pages/Onboarding.tsx`
- `src/pages/instructor/QuickCourseSetup.tsx`

**Implementation:**
1. Save form state to localStorage on change
2. Restore on page load
3. Clear on successful submission

**Effort:** 3 hours

---

### 3.3 Error Boundaries

**Priority:** CRITICAL (Section 12, Issue #4)

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 12, PRODUCTION_IMPLEMENTATION_PLAN.md Section 3.2.1

**File to Enhance:** `src/components/common/ErrorBoundary.tsx`

**Current Features:** Basic error display
**Target Features:**
- Friendly error message
- "Report this issue" button
- Retry action
- Return to dashboard link
- Error details (collapsible)

**Effort:** 3 hours

---

### 3.4 Loading Skeletons

**Priority:** HIGH (Section 12, Issue #9)

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Sections 2, 5

**Pages Needing Skeletons:**
- Dashboard (all widgets)
- Learn page (course cards)
- Career Path (gap analysis)
- Instructor Courses
- Admin pages

**Effort:** 6 hours

---

### 3.5 Pagination

**Priority:** HIGH (Section 12, Issue #7)

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 11

**Pages Needing Pagination:**
- `src/pages/admin/UserManagement.tsx`
- `src/pages/admin/RoleManagement.tsx` (audit log)
- `src/pages/employer/EmployerDashboard.tsx` (activity tab)
- Course lists when >20 items

**Effort:** 4 hours

---

### 3.6 Confirmation Dialogs

**Priority:** HIGH (Section 12, Issue #13)

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 6

**Actions Needing Confirmation:**
- Delete course
- Delete dream job
- Unenroll from course
- Revoke API key
- Remove user from org
- Bulk delete operations

**File to Create:** `src/components/common/ConfirmationDialog.tsx`

**Effort:** 2 hours

---

### 3.7 Fix Broken Features

#### PDF Export (Issue #5)
**File:** `src/pages/admin/OutcomesReport.tsx`
**Problem:** Uses window.print() instead of proper PDF generation
**Fix:** Use html2pdf or jsPDF library
**Effort:** 3 hours

#### "Send Reminder" Button (Issue #12)
**File:** `src/pages/admin/UserManagement.tsx`
**Problem:** Non-functional button
**Fix:** Implement reminder email functionality
**Effort:** 2 hours

---

## Part 4: Edge Function Standardization (Week 3-4)

**Source:** CODE_CLARITY_REFACTORING_REPORT.md Section 3, PRODUCTION_IMPLEMENTATION_PLAN.md Section 3.2

### 4.1 Error Handling Migration

**Current State:** 2 of 78 functions (2.6%) use `error-handler.ts`

**Using Standardized Handling:**
- `analyze-syllabus/index.ts`
- `gap-analysis/index.ts`

**Migration Priority Order:**

**Week 3, Day 1-2: AI Functions (10 functions)**
```
- analyze-dream-job
- discover-dream-jobs
- generate-recommendations
- match-careers
- generate-assessment-questions
- complete-assessment
- evaluate-content-batch
- generate-slides-batch
- curriculum-reasoning-agent
- content-rating-engine
```

**Week 3, Day 3-4: Search Functions (5 functions)**
```
- search-youtube-content
- search-youtube-manual
- search-khan-academy
- search-educational-content
- search-jobs
```

**Week 3, Day 5: Assessment Functions (5 functions)**
```
- start-assessment
- submit-assessment-answer
- start-skills-assessment
- complete-skills-assessment
- generate-micro-check
```

**Week 4: Remaining Functions (58 functions)**
```
Batch migrate remaining functions
```

**Per-Function Migration Pattern:**
```typescript
// Import shared handler
import { handleError, createResponse, validateInput } from '../_shared/error-handler.ts';

// Wrap main logic
try {
  const input = await validateInput(req, schema);
  // ... function logic
  return createResponse(result, 200);
} catch (error) {
  return handleError(error);
}
```

**Effort:** 20-30 hours total

---

### 4.2 Search Function Consolidation

**Source:** CODE_CLARITY_REFACTORING_REPORT.md Section 3.2

**Current Functions (duplicated logic):**
- `search-youtube-content`
- `search-youtube-manual`
- `search-khan-academy`
- `search-educational-content`

**Target Architecture:**
```
search-content/index.ts
├── providers/
│   ├── youtube.ts
│   ├── khan-academy.ts
│   └── educational-content.ts
└── strategy pattern for provider selection
```

**Effort:** 6 hours

---

## Part 5: Code Cleanup (Week 4)

**Source:** CODE_CLARITY_REFACTORING_REPORT.md Section 4, 5

### 5.1 Remove Unused Code

#### Confirmed Safe to Delete (verified via codebase analysis):

**Unused Hooks (~437 lines):**
```
src/hooks/useWorkflows.ts (4 lines)
src/hooks/workflows/ (entire directory, 318 lines)
src/hooks/useProgressiveGeneration.ts (115 lines)
```

**Legacy Pages (routes redirect):**
```
src/pages/Courses.tsx → /learn
src/pages/DreamJobs.tsx → /career
src/pages/Analysis.tsx → /career
```

**Effort:** 1 hour

---

#### Evaluate Before Deletion:

These hooks may have planned use per PRODUCTION_IMPLEMENTATION_PLAN.md:

| Hook | Lines | Potential Use | Decision |
|------|-------|---------------|----------|
| `useAIGeneration.ts` | 345 | Unified AI operations | Keep if planning consolidation |
| `useAdminAnalytics.ts` | 390 | Admin dashboard | Integrate into AdminDashboard |
| `useOnboardingProgress.ts` | 287 | Onboarding flow | Integrate per Sprint 3 |
| `useInstructorNotifications.ts` | 286 | Notification system | Integrate per Sprint 4 |
| `useRecommendationLinks.ts` | 224 | Course linking | Evaluate usage |
| `useUsageStats.ts` | 69 | Usage statistics | Evaluate usage |

---

### 5.2 Split Large Hook Files

**Source:** CODE_CLARITY_REFACTORING_REPORT.md Section 1.2

| File | Lines | Split Into |
|------|-------|------------|
| `useLectureSlides.ts` | 907 | `useGenerateSlides.ts`, `usePublishSlides.ts`, `useLectureAudio.ts` |
| `useInstructorCourses.ts` | 541 | `useModules.ts`, `useCourseStudents.ts` |
| `useAssessment.ts` | 502 | `useMicroChecks.ts`, `useAssessmentQuestions.ts` |

**Effort:** 10 hours total

---

### 5.3 Note on useStudentCourses.ts

**Source:** CODE_CLARITY_REFACTORING_REPORT.md Section 1.1

**Report Claims:** "Rename to useStudentEnrollments.ts"

**Verified Reality:** The naming is **intentional**:
- File queries `course_enrollments` table (instructor courses student enrolls in)
- NOT the `courses` table (personal transcript courses)
- `useStudentEnrollments` accurately describes the data model

**Action:** Add JSDoc comment explaining the naming, do NOT rename

---

## Part 6: Feature Completion (Week 5-7)

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Phases 1-3, SPRINT_TASKS.md

### 6.1 Verified Skills Loop (Sprint 1 Features)

**Status per SPRINT_TASKS.md:** COMPLETED

**Verification Required:**

| Task | Expected File | Verify |
|------|---------------|--------|
| skill-extractor helper | `_shared/skill-extractor.ts` | Check exists & works |
| complete-assessment records skills | `complete-assessment/index.ts` | Check integration |
| useVerifiedSkills hook | `hooks/useVerifiedSkills.ts` | Check exists (420 lines found) |
| VerifiedSkillsBadges component | `components/profile/VerifiedSkillsBadges.tsx` | Check exists |
| gap-analysis uses verified skills | `gap-analysis/index.ts` | Check integration |

**Gap:** Tests exist but some fail due to mock issues (fixed in Part 1)

---

### 6.2 Career-Dream Job Connection (Sprint 2 Features)

**Status per SPRINT_TASKS.md:** COMPLETED

**Verification Required:**

| Task | Expected | Verify |
|------|----------|--------|
| "Set as Dream Job" on CareerMatchCard | Button exists | Check UI |
| Discovered careers on CareerPath | Section exists | Check UI |
| Recommendation completion tracking | Logic exists | Check flow |

---

### 6.3 Student Journey (Sprint 3 Features)

**Status per SPRINT_TASKS.md:** COMPLETED

**Verification Required:**

| Task | Expected File | Status |
|------|---------------|--------|
| useOnboardingProgress | `hooks/useOnboardingProgress.ts` | Found (287 lines, UNUSED) |
| LearningPathVisualization | `components/student/LearningPathVisualization.tsx` | Check exists |
| LearningPath page | `pages/LearningPath.tsx` | Check exists |
| useNotifications | `hooks/useNotifications.ts` | Found (315 lines) |
| NotificationBell | `components/common/NotificationBell.tsx` | Check exists |

**Gap:** useOnboardingProgress exists but is not imported anywhere - needs integration

---

### 6.4 Instructor Analytics (Sprint 4 Features)

**Status per SPRINT_TASKS.md:** COMPLETED

**Verification Required:**

| Task | Expected File | Status |
|------|---------------|--------|
| useInstructorAnalytics | `hooks/useInstructorAnalytics.ts` | Found (references missing column) |
| CourseAnalytics page | `pages/instructor/CourseAnalytics.tsx` | Check exists |
| useGradebook | `hooks/useGradebook.ts` | Found (528 lines, references missing column) |
| Gradebook page | `pages/instructor/Gradebook.tsx` | Check exists |
| useInstructorNotifications | `hooks/useInstructorNotifications.ts` | Found (286 lines, UNUSED) |

**Gap:** Both useInstructorAnalytics and useGradebook reference `last_accessed_at` which doesn't exist - fixed in Part 1

---

### 6.5 Employer & Admin (Sprint 5 Features)

**Status per SPRINT_TASKS.md:** COMPLETED

**Verification Required:**

| Task | Expected File | Verify |
|------|---------------|--------|
| BatchVerificationUpload | `components/employer/BatchVerificationUpload.tsx` | Check exists |
| WebhookSettings | `pages/employer/WebhookSettings.tsx` | Check exists |
| useAdminAnalytics | `hooks/useAdminAnalytics.ts` | Found (390 lines, UNUSED) |
| SystemHealth | `pages/admin/SystemHealth.tsx` | Check exists |

**Gap:** useAdminAnalytics exists but is not integrated into AdminDashboard

---

### 6.6 Help & Support Systems (Sprint 6 Features)

**Status per SPRINT_TASKS.md:** COMPLETED

**Verification Required:**

| Task | Expected File | Verify |
|------|---------------|--------|
| HelpTooltip | `components/common/HelpTooltip.tsx` | Check exists |
| ProductTour | `components/common/ProductTour.tsx` | Check exists |
| HelpCenter | `pages/HelpCenter.tsx` | Check exists |
| FeedbackWidget | `components/common/FeedbackWidget.tsx` | Check exists |
| SatisfactionSurvey | `components/common/SatisfactionSurvey.tsx` | Check exists |

---

## Part 7: Performance Optimization (Week 7)

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Section 4.3, FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 11

### 7.1 Database Indexes

**File:** `supabase/migrations/20260127_add_indexes.sql`

```sql
-- Indexes for common queries per PRODUCTION_IMPLEMENTATION_PLAN.md
CREATE INDEX IF NOT EXISTS idx_verified_skills_user ON verified_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_consumption_records_user_content ON consumption_records(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_dreamjob ON recommendations(dream_job_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user ON assessment_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_instructor ON course_enrollments(instructor_course_id);
CREATE INDEX IF NOT EXISTS idx_learning_objectives_module ON learning_objectives(module_id);
```

**Effort:** 1 hour

---

### 7.2 Query Optimization

**Source:** FRONTEND_UX_COMPREHENSIVE_REVIEW.md Section 11

**Issues:**
- N+1 queries in Dashboard
- In-memory data processing in Outcomes Report
- No caching strategy

**Solutions:**
1. Create database views for complex aggregations
2. Implement cursor-based pagination
3. Add React Query caching configuration

**Effort:** 6 hours

---

### 7.3 Frontend Performance

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Section 4.3.3

**Tasks:**
1. Audit bundle size (target: <500KB initial)
2. Implement code splitting for routes
3. Lazy load heavy components (charts, editors)
4. Optimize images (WebP, lazy loading)

**Current:** 2,324 KB bundle (from build output)
**Target:** <500 KB initial load

**Effort:** 8 hours

---

## Part 8: Monitoring & Documentation (Week 8)

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Sections 4.4, 5

### 8.1 Error Tracking

**File:** `src/lib/error-tracking.ts`

**Integration:** Sentry or similar

**Features:**
- Automatic error capture
- User context attachment
- Performance monitoring
- Release tracking

**Effort:** 4 hours

---

### 8.2 Application Monitoring

**Metrics to Track:**
- Page load times
- API response times
- Error rates by function
- User session duration
- Feature usage

**Effort:** 4 hours

---

### 8.3 Alerting Rules

**Alerts per PRODUCTION_IMPLEMENTATION_PLAN.md:**
- Error rate > 5% for 5 minutes
- API latency > 3s for 5 minutes
- Database connection failures
- AI API quota exhaustion (warning at 80%)
- Failed payment webhooks

**Effort:** 3 hours

---

### 8.4 Documentation Updates

**Source:** PRODUCTION_IMPLEMENTATION_PLAN.md Section 5.1

**Files to Create/Update:**
```
docs/architecture/
  - overview.md (system diagram, tech stack)
  - database-schema.md (ERD, key relationships)
  - api-reference.md (all edge functions)
  - frontend-structure.md (component hierarchy)
  - deployment.md (CI/CD, environments)

docs/api/
  - authentication.md
  - student-api.md
  - instructor-api.md
  - employer-api.md
  - webhooks.md
```

**Effort:** 16 hours

---

## Implementation Schedule

### Week 1: Foundation
| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Create useCourseProgress.ts | 5 |
| 1 | Create useGapAnalysis.ts redirect | 0.5 |
| 2 | Fix test mock hoisting (6 files) | 3 |
| 2 | Fix Router test issue | 0.5 |
| 3 | Create last_accessed_at migration | 1 |
| 3 | Regenerate types, verify hooks work | 2 |
| 4-5 | Buffer / verification | 4 |
| **Total** | | **16** |

### Week 2: Security
| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Email verification implementation | 6 |
| 2 | Password requirements + rate limiting | 5 |
| 3 | Server-side webhook secrets | 2 |
| 4 | Input validation audit | 8 |
| 5 | RLS policy audit | 6 |
| **Total** | | **27** |

### Week 3: UX Critical Fixes
| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Assessment progress auto-save | 4 |
| 2 | Form persistence (onboarding, quick setup) | 3 |
| 2 | Error boundary enhancement | 3 |
| 3 | Loading skeletons (5 pages) | 6 |
| 4 | Pagination (4 pages) | 4 |
| 5 | Confirmation dialogs + broken features | 5 |
| **Total** | | **25** |

### Week 4: Edge Functions
| Day | Tasks | Hours |
|-----|-------|-------|
| 1-2 | Migrate AI functions (10) | 8 |
| 3 | Migrate search functions (5) | 4 |
| 4 | Migrate assessment functions (5) | 4 |
| 5 | Start remaining functions | 4 |
| **Total** | | **20** |

### Week 5: Code Cleanup + Edge Functions
| Day | Tasks | Hours |
|-----|-------|-------|
| 1-2 | Complete edge function migration | 10 |
| 3 | Remove unused code | 2 |
| 4-5 | Split large hook files | 10 |
| **Total** | | **22** |

### Week 6: Feature Integration
| Day | Tasks | Hours |
|-----|-------|-------|
| 1-2 | Integrate unused hooks (onboarding, admin analytics, instructor notifications) | 8 |
| 3-4 | Verify all Sprint 1-6 features | 8 |
| 5 | Fix any gaps found | 4 |
| **Total** | | **20** |

### Week 7: Performance
| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Database indexes | 1 |
| 2-3 | Query optimization | 6 |
| 4-5 | Frontend bundle optimization | 8 |
| **Total** | | **15** |

### Week 8: Monitoring & Docs
| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Error tracking integration | 4 |
| 2 | Application monitoring | 4 |
| 3 | Alerting rules | 3 |
| 4-5 | Documentation | 16 |
| **Total** | | **27** |

---

## Total Effort Summary

| Week | Focus | Hours |
|------|-------|-------|
| 1 | Foundation | 16 |
| 2 | Security | 27 |
| 3 | UX Critical | 25 |
| 4 | Edge Functions | 20 |
| 5 | Cleanup + Edge Functions | 22 |
| 6 | Feature Integration | 20 |
| 7 | Performance | 15 |
| 8 | Monitoring & Docs | 27 |
| **Total** | | **172 hours** |

---

## Success Criteria

### Foundation Complete (Week 1)
- [ ] All 151+ tests passing
- [ ] last_accessed_at column exists
- [ ] Instructor analytics loads without errors

### Security Complete (Week 2)
- [ ] Email verification active
- [ ] Password requirements enforced
- [ ] Rate limiting on AI functions
- [ ] Webhook secrets generated server-side

### UX Complete (Week 3)
- [ ] Assessment progress auto-saves
- [ ] Onboarding form persists
- [ ] All pages have loading skeletons
- [ ] Pagination on all list pages

### Edge Functions Complete (Weeks 4-5)
- [ ] >50% of functions use standardized error handling
- [ ] Search functions consolidated
- [ ] Rate limiting on all AI functions

### Code Quality Complete (Week 5)
- [ ] Unused code removed
- [ ] Large hook files split
- [ ] No new TypeScript errors

### Features Complete (Week 6)
- [ ] All Sprint 1-6 features verified working
- [ ] Unused hooks integrated
- [ ] Gap analysis uses verified skills

### Performance Complete (Week 7)
- [ ] Bundle size <500KB initial
- [ ] Database queries optimized
- [ ] Pagination working

### Production Ready (Week 8)
- [ ] Error tracking active
- [ ] Monitoring dashboards ready
- [ ] Alerting configured
- [ ] Documentation complete

---

## Appendix A: Files to Create

| File | Purpose | Week |
|------|---------|------|
| `src/hooks/useCourseProgress.ts` | Course progress tracking | 1 |
| `src/hooks/useGapAnalysis.ts` | Re-export from useAnalysis | 1 |
| `supabase/migrations/20260127_add_last_accessed_at.sql` | Activity tracking | 1 |
| `src/components/auth/EmailVerificationBanner.tsx` | Unverified user notice | 2 |
| `supabase/functions/send-verification-email/index.ts` | Verification email | 2 |
| `src/components/common/ConfirmationDialog.tsx` | Delete confirmations | 3 |
| `supabase/migrations/20260127_add_indexes.sql` | Performance indexes | 7 |
| `src/lib/error-tracking.ts` | Sentry integration | 8 |

## Appendix B: Files to Modify

| File | Changes | Week |
|------|---------|------|
| `src/hooks/useGradebook.test.ts` | Fix mock hoisting | 1 |
| `src/hooks/useNotifications.test.ts` | Fix mock hoisting | 1 |
| `src/hooks/useRecommendations.test.ts` | Fix mock hoisting | 1 |
| `src/hooks/useVerifiedSkills.test.ts` | Fix mock hoisting | 1 |
| `src/hooks/useCareerMatches.test.ts` | Fix mock hoisting | 1 |
| `src/hooks/useTeachingUnits.test.ts` | Fix mock hoisting | 1 |
| `src/components/recommendations/CurrentlyLearningPanel.test.tsx` | Fix Router nesting | 1 |
| `src/pages/Auth.tsx` | Password requirements | 2 |
| `src/pages/employer/WebhookSettings.tsx` | Server-side secrets | 2 |
| `src/components/assessment/AssessmentSession.tsx` | Auto-save | 3 |
| `src/pages/Onboarding.tsx` | Form persistence | 3 |
| `src/components/common/ErrorBoundary.tsx` | Enhanced features | 3 |
| `src/pages/admin/OutcomesReport.tsx` | PDF generation | 3 |
| `src/pages/admin/UserManagement.tsx` | Send reminder, pagination | 3 |

## Appendix C: Files to Delete

| File | Reason | Week |
|------|--------|------|
| `src/hooks/useWorkflows.ts` | Never imported | 5 |
| `src/hooks/workflows/*` | Never imported | 5 |
| `src/hooks/useProgressiveGeneration.ts` | Never imported | 5 |
| `src/pages/Courses.tsx` | Route redirected | 5 |
| `src/pages/DreamJobs.tsx` | Route redirected | 5 |
| `src/pages/Analysis.tsx` | Route redirected | 5 |

---

*Master Implementation Plan - Generated 2026-01-27*
*Based on: PRODUCTION_IMPLEMENTATION_PLAN.md, SPRINT_TASKS.md, FRONTEND_UX_COMPREHENSIVE_REVIEW.md, CODE_CLARITY_REFACTORING_REPORT.md*
*Verified against actual codebase state*
