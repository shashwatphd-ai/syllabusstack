# SyllabusStack Current Status Report & Work Plan

> **Version:** 1.0  
> **Created:** 2026-01-07  
> **Purpose:** Comprehensive audit of current implementation state with clear work plan for completion  
> **For:** AI Agents and Developers - Ensures continuity and context preservation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [User Flows Audit](#3-user-flows-audit)
4. [Backend Functions Status](#4-backend-functions-status)
5. [Frontend Components Status](#5-frontend-components-status)
6. [Database Tables Status](#6-database-tables-status)
7. [Integration Points](#7-integration-points)
8. [Identified Issues & Gaps](#8-identified-issues--gaps)
9. [Work Plan](#9-work-plan)
10. [Agent Protocol](#10-agent-protocol)

---

## 1. Executive Summary

### Current State
SyllabusStack is an AI-powered career navigation and verified learning platform with **~75% core functionality complete**. The platform has three primary user flows:

1. **Student Career Path** (Gap Analysis) - ✅ 90% Complete
2. **Student Learning Path** (Verified Learning) - ⚠️ 70% Complete  
3. **Instructor Course Creation** - ⚠️ 65% Complete

### Critical Blockers
| Issue | Severity | Impact |
|-------|----------|--------|
| PDF syllabus upload not connected | HIGH | Users can't upload PDF files |
| Anti-recommendations not displayed | MEDIUM | Generated data goes unused |
| Missing RESEND_API_KEY | MEDIUM | Email notifications don't work |
| YouTube player not properly integrated | HIGH | Video tracking is simulated |

### Secrets Configured
- ✅ `LOVABLE_API_KEY` (AI Gateway)
- ✅ `YOUTUBE_API_KEY` (Content Search)
- ✅ `GOOGLE_CLOUD_API_KEY`
- ❌ `RESEND_API_KEY` (Not configured - email won't work)

---

## 2. System Architecture Overview

### Tech Stack
```
Frontend: React 18 + Vite + TypeScript + TailwindCSS
State: TanStack Query + React Context
Backend: Supabase (Lovable Cloud)
AI: Lovable AI Gateway (gemini-2.5-flash, gpt-5-mini)
Auth: Supabase Auth
```

### Key Directories
```
src/
├── components/
│   ├── analysis/       # Gap analysis views
│   ├── assessment/     # Quiz/assessment UI
│   ├── auth/           # Login/signup guards
│   ├── dashboard/      # Dashboard widgets
│   ├── forms/          # Form components
│   ├── landing/        # Public landing page
│   ├── layout/         # App shell, sidebar
│   ├── onboarding/     # Wizard, uploaders
│   ├── player/         # Video player, micro-checks
│   ├── recommendations/# Recommendation cards
│   └── student/        # Student course views
├── hooks/              # Data fetching hooks
├── pages/              # Route pages
│   ├── instructor/     # Instructor pages
│   └── student/        # Student learning pages
└── lib/                # Utilities, API functions

supabase/functions/     # Edge functions (backend)
```

---

## 3. User Flows Audit

### Flow 1: Student Career Path (Gap Analysis)

**Route:** Landing → Auth → Onboarding → Dashboard → Dream Jobs → Analysis → Recommendations

| Step | Component | Backend | Status | Notes |
|------|-----------|---------|--------|-------|
| 1. Landing | `Index.tsx` | - | ✅ Complete | |
| 2. Signup/Login | `Auth.tsx` | Supabase Auth | ✅ Complete | Auto-confirm enabled |
| 3. Profile Setup | `OnboardingWizard.tsx` | `profiles` table | ✅ Complete | |
| 4. Course Upload | `CourseUploader.tsx` | `analyze-syllabus` | ⚠️ Partial | **Text only, PDF not connected** |
| 5. Syllabus Analysis | `analyzeSyllabus()` | `analyze-syllabus` | ✅ Complete | Capabilities extracted |
| 6. Dream Job Selection | `DreamJobSelector.tsx` | `analyze-dream-job` | ✅ Complete | Requirements analyzed |
| 7. Gap Analysis | `GapAnalysisView.tsx` | `gap-analysis` | ✅ Complete | |
| 8. Recommendations | `RecommendationsList.tsx` | `generate-recommendations` | ⚠️ Partial | **Anti-recs not displayed** |
| 9. Progress Tracking | `ProgressTracker.tsx` | `recommendations` table | ✅ Complete | Status updates work |

**Issues Found:**
1. `parse-syllabus-document` edge function exists but is NOT called from frontend
2. `anti_recommendations` table has data but no UI displays it
3. Gap counts now correctly pulled from `gap_analyses` table (fixed)

---

### Flow 2: Student Learning Path (Verified Learning)

**Route:** Dashboard → My Learning → Course Detail → LO Detail → Video Player → Assessment

| Step | Component | Backend | Status | Notes |
|------|-----------|---------|--------|-------|
| 1. Enrollment | `EnrollmentDialog.tsx` | `course_enrollments` | ✅ Complete | Access code validation |
| 2. Course List | `StudentCoursesPage.tsx` | `useStudentCourses` | ✅ Complete | |
| 3. Course Detail | `StudentCourseDetailPage.tsx` | Modules + LOs | ✅ Complete | |
| 4. LO Detail | `LearningObjective.tsx` | `content_matches` | ⚠️ Partial | Content may not exist |
| 5. Video Player | `VerifiedVideoPlayer.tsx` | `track-consumption` | ⚠️ Partial | **Simulated playback** |
| 6. Micro-checks | `MicroCheckOverlay.tsx` | `generate-micro-checks` | ⚠️ Partial | **Questions may not exist** |
| 7. Assessment Start | `AssessmentPage.tsx` | `start-assessment` | ✅ Complete | |
| 8. Question Display | `QuestionCard.tsx` | `assessment_questions` | ⚠️ Partial | **Questions may not exist** |
| 9. Answer Submit | `submitAnswer` | `submit-assessment-answer` | ✅ Complete | Server-side timing |
| 10. Completion | `AssessmentResults.tsx` | `complete-assessment` | ✅ Complete | |

**Issues Found:**
1. YouTube iframe doesn't integrate with actual YouTube API (time tracking is simulated)
2. Micro-checks require content to exist with generated questions
3. Assessment questions require AI generation which depends on content existing
4. `micro_check_results` are saved but not displayed to user

---

### Flow 3: Instructor Course Creation

**Route:** Instructor Portal → Create Course → Add Modules → Add LOs → Search Content → Generate Questions

| Step | Component | Backend | Status | Notes |
|------|-----------|---------|--------|-------|
| 1. Course List | `InstructorCoursesPage.tsx` | `instructor_courses` | ✅ Complete | |
| 2. Create Course | Dialog in page | `instructor_courses` | ✅ Complete | |
| 3. Course Detail | `InstructorCourseDetailPage.tsx` | Modules view | ✅ Complete | Publish button added |
| 4. Add Module | `ModuleCard.tsx` | `modules` table | ✅ Complete | |
| 5. Extract LOs | - | `extract-learning-objectives` | ⚠️ Partial | **No UI trigger** |
| 6. Search YouTube | - | `search-youtube-content` | ⚠️ Partial | **No UI trigger** |
| 7. Curate Content | `ContentCurationPanel.tsx` | `content_matches` | ✅ Complete | Approve/reject |
| 8. Generate Questions | - | `generate-assessment-questions` | ⚠️ Partial | **No UI trigger** |
| 9. Publish Course | Publish button | `is_published` field | ✅ Complete | |

**Issues Found:**
1. LO extraction has backend but no UI button to trigger it
2. YouTube content search has backend but no UI integration
3. Assessment question generation has backend but no UI trigger
4. These three need UI components in `InstructorCourseDetailPage.tsx`

---

## 4. Backend Functions Status

| Edge Function | Frontend Hook | UI Component | Status |
|---------------|---------------|--------------|--------|
| `analyze-syllabus` | `analyzeSyllabus()` | `CourseUploader` | ✅ Connected |
| `analyze-dream-job` | `analyzeDreamJob()` | `DreamJobSelector` | ✅ Connected |
| `gap-analysis` | `performGapAnalysis()` | `useRefreshAnalysis` | ✅ Connected |
| `generate-recommendations` | `generateRecommendations()` | `useWorkflows` | ✅ Connected |
| `parse-syllabus-document` | ❌ None | ❌ None | **🔴 NOT CONNECTED** |
| `extract-learning-objectives` | ❌ None | ❌ None | **🔴 NOT CONNECTED** |
| `search-youtube-content` | ❌ None | ❌ None | **🔴 NOT CONNECTED** |
| `generate-micro-checks` | ❌ None | ❌ None | **🔴 NOT CONNECTED** |
| `generate-assessment-questions` | ❌ None | ❌ None | **🔴 NOT CONNECTED** |
| `start-assessment` | `useStartAssessment` | `AssessmentSession` | ✅ Connected |
| `submit-assessment-answer` | `useSubmitAnswer` | `QuestionCard` | ✅ Connected |
| `evaluate-answer` | ❌ None (logic in submit) | ❌ None | ⚠️ Redundant |
| `complete-assessment` | `useCompleteAssessment` | `AssessmentResults` | ✅ Connected |
| `track-consumption` | `useConsumptionTracking` | `VerifiedVideoPlayer` | ✅ Connected |
| `get-usage-stats` | `useUsageStats` | `UsagePage` | ✅ Connected |
| `send-digest-email` | ❌ None | ❌ None | **🔴 MISSING SECRET** |

---

## 5. Frontend Components Status

### Dashboard Components
| Component | Data Hook | Status |
|-----------|-----------|--------|
| `DashboardOverview.tsx` | `useDashboardOverview` | ✅ Complete |
| `CapabilitySnapshot.tsx` | `useCapabilities` | ✅ Fixed (scrollable, no truncation) |
| `DreamJobCards.tsx` | `useDreamJobs` + `useGapAnalysesForJobs` | ✅ Fixed (dynamic gap counts) |
| `NextActionBanner.tsx` | `useDashboardStats` | ✅ Complete |
| `ProgressWidget.tsx` | Various | ✅ Complete |
| `WelcomeBackBanner.tsx` | Profile data | ✅ Complete |

### Analysis Components
| Component | Data Hook | Status |
|-----------|-----------|--------|
| `GapAnalysisView.tsx` | `useGapAnalysis` | ✅ Complete |
| `GapsList.tsx` | - | ✅ Complete |
| `OverlapsList.tsx` | - | ✅ Complete |
| `HonestAssessment.tsx` | - | ✅ Complete |

### Recommendation Components
| Component | Data Hook | Status |
|-----------|-----------|--------|
| `RecommendationsList.tsx` | `useRecommendations` | ✅ Complete |
| `RecommendationCard.tsx` | - | ✅ Complete |
| `ProgressTracker.tsx` | - | ✅ Complete |
| `ReAnalysisPrompt.tsx` | - | ✅ Complete |
| `AntiRecommendations.tsx` | ❌ No data hook | **🔴 NOT USED** |

### Player Components
| Component | Data Hook | Status |
|-----------|-----------|--------|
| `VerifiedVideoPlayer.tsx` | `useConsumptionTracking` | ⚠️ Simulated playback |
| `MicroCheckOverlay.tsx` | - | ✅ Complete |

### Assessment Components
| Component | Data Hook | Status |
|-----------|-----------|--------|
| `AssessmentSession.tsx` | `useStartAssessment` | ✅ Complete |
| `QuestionCard.tsx` | `useSubmitAnswer` | ✅ Complete |
| `AssessmentProgress.tsx` | - | ✅ Complete |
| `AssessmentResults.tsx` | `useCompleteAssessment` | ✅ Complete |

---

## 6. Database Tables Status

### Core Tables (All Have RLS)
| Table | Used By | Data Population | Status |
|-------|---------|-----------------|--------|
| `profiles` | Auth/Profile | On signup | ✅ |
| `courses` | Career path | User upload | ✅ |
| `capabilities` | Dashboard | AI extraction | ✅ |
| `capability_profiles` | Dashboard | Aggregated | ✅ |
| `dream_jobs` | Career path | User input | ✅ |
| `job_requirements` | Analysis | AI extraction | ✅ |
| `gap_analyses` | Analysis | AI generation | ✅ |
| `recommendations` | Actions | AI generation | ✅ |
| `anti_recommendations` | ❌ None | AI generation | **🔴 UNUSED** |

### Learning Tables
| Table | Used By | Data Population | Status |
|-------|---------|-----------------|--------|
| `instructor_courses` | Instructor | Manual creation | ✅ |
| `modules` | Instructor | Manual creation | ✅ |
| `learning_objectives` | Learning path | AI extraction | ⚠️ Needs UI trigger |
| `content` | Video player | YouTube search | ⚠️ Needs UI trigger |
| `content_matches` | LO detail | AI matching | ⚠️ Needs UI trigger |
| `consumption_records` | Tracking | Video events | ✅ |
| `micro_checks` | Video player | AI generation | ⚠️ Needs UI trigger |
| `micro_check_results` | ❌ No display | User answers | **🔴 UNUSED** |

### Assessment Tables
| Table | Used By | Data Population | Status |
|-------|---------|-----------------|--------|
| `assessment_questions` | Assessment | AI generation | ⚠️ Needs UI trigger |
| `assessment_sessions` | Assessment | On start | ✅ |
| `assessment_answers` | Assessment | On submit | ✅ |

### Utility Tables
| Table | Used By | Status |
|-------|---------|--------|
| `ai_cache` | Edge functions | ✅ |
| `ai_usage` | Usage page | ✅ |
| `user_roles` | Role-based nav | ✅ |
| `course_enrollments` | Student courses | ✅ |
| `job_requirements_cache` | AI optimization | ✅ |

---

## 7. Integration Points

### AI Gateway (Lovable AI)
- **Model Used:** `google/gemini-2.5-flash` (primary), `openai/gpt-5-mini` (fallback)
- **Functions Using AI:**
  - `analyze-syllabus` ✅
  - `analyze-dream-job` ✅
  - `gap-analysis` ✅
  - `generate-recommendations` ✅
  - `extract-learning-objectives` ✅
  - `generate-micro-checks` ✅
  - `generate-assessment-questions` ✅
  - `evaluate-answer` ✅

### YouTube API
- **Secret:** `YOUTUBE_API_KEY` ✅ Configured
- **Used By:** `search-youtube-content`
- **Status:** Edge function complete, **UI not connected**

### Email (Resend)
- **Secret:** `RESEND_API_KEY` ❌ **NOT CONFIGURED**
- **Used By:** `send-digest-email`
- **Status:** Will fail silently without API key

---

## 8. Identified Issues & Gaps

### Priority 1: Critical (Must Fix)
| ID | Issue | Location | Fix Required |
|----|-------|----------|--------------|
| P1-1 | PDF upload not connected | `CourseUploader.tsx` | Add PDF parsing call |
| P1-2 | Anti-recommendations not shown | `Recommendations.tsx` | Add UI component |
| P1-3 | Instructor LO extraction no UI | `InstructorCourseDetail.tsx` | Add extract button |
| P1-4 | YouTube search no UI | `InstructorCourseDetail.tsx` | Add search panel |
| P1-5 | Question generation no UI | `InstructorCourseDetail.tsx` | Add generate button |

### Priority 2: Important (Should Fix)
| ID | Issue | Location | Fix Required |
|----|-------|----------|--------------|
| P2-1 | Video player is simulated | `VerifiedVideoPlayer.tsx` | Integrate YouTube IFrame API |
| P2-2 | Micro-check results not displayed | `LearningObjective.tsx` | Add history view |
| P2-3 | Email notifications not working | N/A | Configure `RESEND_API_KEY` |
| P2-4 | `evaluate-answer` orphaned | Edge function | Consider removal |

### Priority 3: Nice to Have (Future)
| ID | Issue | Location | Fix Required |
|----|-------|----------|--------------|
| P3-1 | Bulk syllabus upload | `BulkSyllabusUploader.tsx` | Complete implementation |
| P3-2 | Export to PDF/JSON | `ExportButtons.tsx` | Add export logic |
| P3-3 | Email digest scheduling | Cron job | Configure Supabase cron |

---

## 9. Work Plan

### Phase 1: Connect Missing Backend Functions (Priority 1)
**Estimated Effort:** 4-6 hours

#### Task 1.1: Add PDF Upload Support
```
Files to modify:
- src/components/onboarding/CourseUploader.tsx
- src/lib/api.ts (add parseSyllabusDocument function)

Steps:
1. Add API function to call parse-syllabus-document edge function
2. Update CourseUploader to detect PDF files and call parsing
3. Chain: PDF → parse → text → analyze-syllabus
```

#### Task 1.2: Display Anti-Recommendations
```
Files to modify:
- src/pages/Recommendations.tsx
- src/hooks/useRecommendations.ts (add useAntiRecommendations)

Steps:
1. Create hook to fetch from anti_recommendations table
2. Import AntiRecommendations component (already exists!)
3. Add section below recommendations list
```

#### Task 1.3: Add Instructor Actions UI
```
Files to modify:
- src/pages/instructor/InstructorCourseDetailPage.tsx
- src/hooks/useInstructorCourses.ts (add new mutations)
- src/lib/api.ts (add API functions)

Steps:
1. Add "Extract LOs" button per module → calls extract-learning-objectives
2. Add "Search Content" button per LO → calls search-youtube-content
3. Add "Generate Questions" button per LO → calls generate-assessment-questions
4. Show loading states and success feedback
```

### Phase 2: Fix Video Integration (Priority 2)
**Estimated Effort:** 3-4 hours

#### Task 2.1: YouTube IFrame API Integration
```
Files to modify:
- src/components/player/VerifiedVideoPlayer.tsx

Steps:
1. Load YouTube IFrame API script dynamically
2. Create YT.Player instance instead of raw iframe
3. Listen to onStateChange, onPlaybackRateChange events
4. Replace simulated time progression with real events
```

#### Task 2.2: Display Micro-Check History
```
Files to modify:
- src/pages/student/LearningObjective.tsx
- src/hooks/useAssessment.ts (add useMicroCheckResults)

Steps:
1. Create hook to fetch micro_check_results for consumption record
2. Add collapsible section showing past attempts
3. Show correct/incorrect and time taken
```

### Phase 3: Email & Cleanup (Priority 2-3)
**Estimated Effort:** 2 hours

#### Task 3.1: Configure Email
```
Steps:
1. Add RESEND_API_KEY secret via Lovable
2. Test send-digest-email function
3. Create UI to trigger test email (optional)
```

#### Task 3.2: Remove Orphaned Code
```
Files to consider:
- supabase/functions/evaluate-answer (logic duplicated in submit-assessment-answer)

Steps:
1. Verify evaluate-answer is truly unused
2. If confirmed, delete the edge function
```

---

## 10. Agent Protocol

### Context Preservation Rules

1. **Always read this document first** when starting a new session
2. **Update this document** after completing work items (mark status, add notes)
3. **Reference the Work Plan** section for prioritized tasks
4. **Check the Issues table** before implementing fixes

### Before Making Changes

```
1. Read docs/Current_Status_Report.md
2. Identify which task you're working on from Work Plan
3. Read all relevant files listed in the task
4. Understand the data flow (hook → component → edge function → database)
5. Make changes
6. Test in preview
7. Update this document with completion status
```

### Key Files to Understand

| Category | Files |
|----------|-------|
| Data Flow | `src/lib/api.ts`, `src/hooks/useWorkflows.ts` |
| State Management | `src/lib/query-keys.ts`, `src/lib/query-client.ts` |
| Database Types | `src/integrations/supabase/types.ts` (read-only) |
| Routing | `src/App.tsx` |
| Layouts | `src/components/layout/AppShell.tsx`, `Sidebar.tsx` |

### Naming Conventions

- **Hooks:** `use[Entity]` (e.g., `useDreamJobs`, `useCapabilities`)
- **API Functions:** Verb + noun (e.g., `analyzeSyllabus`, `performGapAnalysis`)
- **Components:** PascalCase, descriptive (e.g., `DreamJobCards`, `GapAnalysisView`)
- **Edge Functions:** kebab-case (e.g., `analyze-syllabus`, `gap-analysis`)

### Testing Checklist

Before marking a task complete:
- [ ] No console errors
- [ ] UI renders correctly
- [ ] Data flows correctly (check network tab)
- [ ] Edge function logs show success
- [ ] Database has expected data

---

## Appendix: Quick Reference

### Route Map
```
/                       → Landing (public)
/scanner                → Syllabus Scanner (public)
/test-results           → Scanner Results (public)
/auth                   → Login/Signup
/onboarding             → Setup Wizard
/dashboard              → Main Dashboard
/courses                → My Courses (career path)
/dream-jobs             → Target Roles
/analysis               → Gap Analysis
/recommendations        → Action Items
/learn/courses          → Student Enrolled Courses
/learn/courses/:id      → Course Detail
/learn/objective/:loId  → LO + Video Player
/learn/objective/:loId/assess → Assessment
/instructor/courses     → Instructor Course List
/instructor/courses/:id → Instructor Course Detail
```

### Edge Function URLs (for testing)
```
POST /functions/v1/analyze-syllabus
POST /functions/v1/analyze-dream-job
POST /functions/v1/gap-analysis
POST /functions/v1/generate-recommendations
POST /functions/v1/parse-syllabus-document
POST /functions/v1/extract-learning-objectives
POST /functions/v1/search-youtube-content
POST /functions/v1/generate-micro-checks
POST /functions/v1/generate-assessment-questions
POST /functions/v1/start-assessment
POST /functions/v1/submit-assessment-answer
POST /functions/v1/complete-assessment
POST /functions/v1/track-consumption
GET  /functions/v1/get-usage-stats
POST /functions/v1/send-digest-email
```

---

*Last Updated: 2026-01-07*  
*Next Review: After Phase 1 completion*
