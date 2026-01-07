# EduThree Implementation Roadmap v2

> **Version:** 2.0  
> **Created:** 2026-01-07  
> **Status:** IN PROGRESS  
> **Reference:** docs/Current_Status_Report.md  
> **Purpose:** Detailed implementation specifications for all outstanding work items

---

## Executive Summary

### Scope
12 tasks across 4 phases to achieve 95%+ core functionality.

### Time Estimates
| Phase | Description | Est. Time | Priority |
|-------|-------------|-----------|----------|
| Phase 1 | Connect Missing Backend Functions | 6-8 hrs | P1 Critical |
| Phase 2 | Fix Video Integration | 4-5 hrs | P2 Important |
| Phase 3 | Email & Cleanup | 2-3 hrs | P2-P3 |
| Phase 4 | Polish & Edge Cases | 3-4 hrs | P3 |

---

## Phase 1: Connect Missing Backend Functions ✅ COMPLETE

### Task 1.1: PDF Syllabus Upload ✅
- **Status:** ✅ Complete
- **Files:** `src/lib/api.ts`, `src/components/onboarding/CourseUploader.tsx`
- **Changes:** Added `parseSyllabusDocument()` API function, CourseUploader now handles PDF/DOCX

### Task 1.2: Display Anti-Recommendations ✅
- **Status:** ✅ Complete
- **Files:** `src/hooks/useRecommendations.ts`, `src/pages/Recommendations.tsx`, `src/lib/query-keys.ts`
- **Changes:** Added `useAntiRecommendations` hook, Recommendations page now shows anti-recs

### Task 1.3: Instructor - Extract LOs UI ✅
- **Status:** ✅ Complete (was already implemented in ModuleCard.tsx)

### Task 1.4: Instructor - YouTube Search UI ✅
- **Status:** ✅ Complete (was already implemented in ModuleCard.tsx)

### Task 1.5: Instructor - Generate Questions UI ✅
- **Status:** ✅ Complete (was already implemented in ModuleCard.tsx)

---

## Phase 2: Fix Video Integration (Partial)

### Task 2.1: YouTube IFrame API ✅
- **Status:** ✅ Complete
- **Files:** `src/types/youtube.d.ts` ✅, `src/components/player/VerifiedVideoPlayer.tsx` ✅
- **Changes:** Replaced simulated `setInterval` time tracking with real YouTube IFrame API. Component now loads YT API dynamically, creates YT.Player instance, and listens to real `onStateChange`, `onPlaybackRateChange` events.

### Task 2.2: Micro-Check History ✅
- **Status:** ✅ Complete
- **Files:** `src/hooks/useAssessment.ts`, `src/pages/student/LearningObjective.tsx`
- **Changes:** Added `useMicroCheckResults` hook, LO page shows collapsible history

---

## Phase 3: Email & Cleanup

### Task 3.1: Configure RESEND_API_KEY
- **Status:** ☐ Not Started
- **Goal:** User must add secret for email functionality

### Task 3.2: Remove Orphaned Function
- **Status:** ☐ Not Started
- **Goal:** Delete unused `evaluate-answer` edge function

---

## Phase 4: Polish

### Task 4.1: Bulk Syllabus Upload
### Task 4.2: Export Buttons  
### Task 4.3: Generate Micro-Checks UI

---

## Agent Protocol

1. Read this document at session start
2. Work on tasks in order (P1 → P2 → P3)
3. Update status markers as work progresses
4. Test each change before moving to next task

---

*Last Updated: 2026-01-07*
