# Comprehensive Implementation Plan

**Date:** 2026-01-27
**Based On:** Verified codebase analysis with actual build/test results
**Purpose:** Fix all verified issues and implement missing features

---

## Verified State (Not Claims)

| Metric | Claimed (Lovable) | Actual (Verified) |
|--------|-------------------|-------------------|
| Build Errors | 51+ | **0** |
| TypeScript Errors | "Many" | **0** |
| Test Failures | Not specified | **12 of 151** |
| Missing Hooks | 4+ | **2** |
| DB Schema Issues | last_accessed_at | **Runtime issue, not build** |

---

## Phase 1: Fix Test Suite (Priority: HIGH)

### 1.1 Create Missing Hooks

#### Task 1.1.1: Create `useCourseProgress.ts`

**Why:** `useCourseProgress.test.ts` exists with 367 lines of tests expecting this hook.

**Location:** `src/hooks/useCourseProgress.ts`

**Required Exports (from test file analysis):**
```typescript
// Types
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

// Hooks
export function useCourseProgress(courseId: string | undefined): UseQueryResult<CourseProgress | null>;
export function useEnrollment(courseId: string | undefined): UseQueryResult<CourseProgress | null>;
export function useModuleProgress(moduleId: string | undefined): UseQueryResult<ModuleProgress | null>;
```

**Implementation Approach:**
1. Query `course_enrollments` with instructor_course join
2. Query `course_modules` for module structure
3. Query `learning_objectives` for objective details
4. Query `assessment_sessions` for assessment scores
5. Compute progress metrics from data

**Effort:** 4-6 hours

---

#### Task 1.1.2: Create `useGapAnalysis.ts` (or fix test imports)

**Why:** `useGapAnalysis.test.ts` imports from `./useGapAnalysis` but file doesn't exist.

**Options:**

**Option A: Create redirect file (5 minutes)**
```typescript
// src/hooks/useGapAnalysis.ts
export { useGapAnalysis, type SkillGap } from './useAnalysis';
```

**Option B: Update test imports (10 minutes)**
Change test file to import from `useAnalysis.ts` instead.

**Recommendation:** Option A - maintains backward compatibility

---

### 1.2 Fix Test Mock Hoisting Issues

**Problem:** Vitest hoists `vi.mock()` calls to the top of the file, but tests define `mockSupabase` after the mock call.

**Affected Files:**
- `src/hooks/useGradebook.test.ts`
- `src/hooks/useNotifications.test.ts`
- `src/hooks/useRecommendations.test.ts`
- `src/hooks/useVerifiedSkills.test.ts`
- `src/hooks/useCareerMatches.test.ts`

**Fix Pattern:**

```typescript
// BEFORE (broken):
const mockSupabase = { ... };
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase  // ERROR: mockSupabase not defined yet
}));

// AFTER (working):
const mockSupabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  functions: { invoke: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));
```

**Effort per file:** 15-30 minutes
**Total effort:** 2-3 hours

---

### 1.3 Fix Component Test Router Issue

**File:** `src/components/recommendations/CurrentlyLearningPanel.test.tsx`

**Problem:** Test wrapper includes BrowserRouter, but component also renders a Router.

**Fix:** Update test wrapper to use MemoryRouter and ensure component doesn't double-wrap:

```typescript
import { MemoryRouter } from 'react-router-dom';

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);
```

**Effort:** 30 minutes

---

### 1.4 Fix Incomplete Test Mock

**File:** `src/hooks/useTeachingUnits.test.ts`

**Problem:** Mock doesn't include `update` method in chain.

**Fix:**
```typescript
mockSupabase.from.mockReturnValue({
  select: vi.fn().mockReturnValue({ ... }),
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null })
  }),
  // ... other methods
});
```

**Effort:** 30 minutes

---

## Phase 2: Database Alignment (Priority: MEDIUM)

### 2.1 Add `last_accessed_at` Column

**Current State:** Code references this column, but it doesn't exist in schema. This causes **runtime errors**, not build errors.

**Migration File:** `supabase/migrations/YYYYMMDD_add_last_accessed_at.sql`

```sql
-- Add last_accessed_at to track student activity
ALTER TABLE public.course_enrollments
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

-- Index for "active in last 7 days" queries
CREATE INDEX IF NOT EXISTS idx_enrollments_last_accessed
ON course_enrollments(last_accessed_at)
WHERE last_accessed_at IS NOT NULL;

-- Update trigger on consumption_records
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

**Post-migration:** Run `npx supabase gen types typescript` to update types.ts

**Effort:** 1 hour (including testing)

---

### 2.2 Verify RPC Function Existence

**Check:** Does `create_dream_job_from_career_match` RPC exist?

**Action:** If not, create it or ensure code gracefully handles its absence (it already has a fallback in `useCareerMatches.ts`).

**Effort:** 30 minutes to verify, 1 hour if creation needed

---

## Phase 3: Code Cleanup (Priority: LOW)

### 3.1 Remove Verified Unused Code

**Confirmed unused hooks (from grep analysis):**

| File | Lines | Status | Action |
|------|-------|--------|--------|
| `useWorkflows.ts` | 4 | Unused | Delete |
| `workflows/` directory | 318 | Unused | Delete |
| `useProgressiveGeneration.ts` | 115 | Unused | Delete |

**Hooks requiring evaluation before deletion:**

| File | Lines | Potential Use |
|------|-------|---------------|
| `useAIGeneration.ts` | 345 | May be planned for future |
| `useAdminAnalytics.ts` | 390 | AdminDashboard integration |
| `useOnboardingProgress.ts` | 287 | Onboarding flow |
| `useInstructorNotifications.ts` | 286 | Notification system |

**Recommendation:** Delete only the confirmed unused files. Keep others until explicit decision.

**Effort:** 1 hour

---

### 3.2 Legacy Pages (Optional)

**Files:** `Courses.tsx`, `DreamJobs.tsx`, `Analysis.tsx`

**Current State:** Routes redirect, files exist as backup.

**Recommendation:** Keep for now (low impact, provides fallback).

---

## Phase 4: Edge Function Improvements (Priority: LOW)

### 4.1 Error Handling Standardization

**Current State:** 2 of 78 functions use `error-handler.ts`

**Recommended Approach:** Gradual migration, not big-bang.

**Start with high-traffic functions:**
1. `complete-assessment`
2. `start-assessment`
3. `generate-slides-batch`
4. `match-careers`
5. `gap-analysis` (already done)

**Effort per function:** 30-60 minutes
**Total for 5 functions:** 4-5 hours

---

### 4.2 Rate Limiting Adoption

**Current State:** 2 of 78 functions use `rate-limiter.ts`

**Priority functions (AI-intensive):**
1. `generate-slides-batch`
2. `discover-dream-jobs`
3. `generate-assessment-questions`
4. `match-careers`
5. `evaluate-content-batch`

**Effort:** 2-3 hours

---

## Implementation Schedule

### Week 1

| Day | Task | Effort | Owner |
|-----|------|--------|-------|
| Day 1 AM | Create useCourseProgress.ts | 4h | Dev |
| Day 1 PM | Create useGapAnalysis.ts redirect | 15m | Dev |
| Day 1 PM | Fix test mock hoisting (3 files) | 1.5h | Dev |
| Day 2 AM | Fix test mock hoisting (2 files) | 1h | Dev |
| Day 2 AM | Fix CurrentlyLearningPanel test | 30m | Dev |
| Day 2 PM | Fix useTeachingUnits test mock | 30m | Dev |
| Day 2 PM | Run full test suite, verify fixes | 1h | Dev |

**Week 1 Goal:** All 151 tests passing

### Week 2

| Day | Task | Effort | Owner |
|-----|------|--------|-------|
| Day 1 | Create last_accessed_at migration | 1h | Dev |
| Day 1 | Deploy migration to staging | 30m | DevOps |
| Day 1 | Regenerate TypeScript types | 15m | Dev |
| Day 1 | Test instructor analytics | 1h | QA |
| Day 2 | Delete confirmed unused code | 1h | Dev |
| Day 3-5 | Edge function improvements (5 functions) | 4h | Dev |

**Week 2 Goal:** Runtime errors fixed, dead code removed

---

## Success Criteria

### Phase 1 Complete
- [ ] `npx vitest run` shows 0 failures
- [ ] All 151+ tests passing

### Phase 2 Complete
- [ ] Instructor analytics loads without errors
- [ ] `last_accessed_at` column exists in production
- [ ] TypeScript types updated

### Phase 3 Complete
- [ ] Unused code removed (~437 lines)
- [ ] No new TypeScript errors introduced

### Phase 4 Complete
- [ ] 7+ edge functions use standardized error handling
- [ ] 7+ AI functions have rate limiting

---

## Files to Modify/Create

### Create New
| File | Purpose | Priority |
|------|---------|----------|
| `src/hooks/useCourseProgress.ts` | Implement hook for tests | HIGH |
| `src/hooks/useGapAnalysis.ts` | Redirect to useAnalysis | HIGH |
| `supabase/migrations/YYYYMMDD_add_last_accessed_at.sql` | DB schema fix | MEDIUM |

### Modify (Test Fixes)
| File | Change | Priority |
|------|--------|----------|
| `src/hooks/useGradebook.test.ts` | Fix mock hoisting | HIGH |
| `src/hooks/useNotifications.test.ts` | Fix mock hoisting | HIGH |
| `src/hooks/useRecommendations.test.ts` | Fix mock hoisting | HIGH |
| `src/hooks/useVerifiedSkills.test.ts` | Fix mock hoisting | HIGH |
| `src/hooks/useCareerMatches.test.ts` | Fix mock hoisting | HIGH |
| `src/hooks/useTeachingUnits.test.ts` | Add update mock | HIGH |
| `src/components/recommendations/CurrentlyLearningPanel.test.tsx` | Fix Router | HIGH |

### Delete
| File | Reason | Priority |
|------|--------|----------|
| `src/hooks/useWorkflows.ts` | Never imported | LOW |
| `src/hooks/workflows/` | Entire directory unused | LOW |
| `src/hooks/useProgressiveGeneration.ts` | Never imported | LOW |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| useCourseProgress implementation doesn't match test expectations | Medium | High | Review test file thoroughly before implementation |
| Migration breaks production | Low | High | Test in staging, have rollback plan |
| Deleting "unused" code breaks something | Low | Medium | Search for dynamic imports first |
| Edge function changes cause regressions | Medium | Medium | Deploy one at a time, monitor |

---

## NOT Recommended (Based on Analysis)

The following actions from the Lovable agent response are **NOT recommended**:

1. **"Fix useStudentCourses naming"** - The naming is intentional and correct
2. **"Create barrel exports for 7 directories"** - Already exist or not needed
3. **"51+ build error fixes"** - Build already passes
4. **"Rename kebab-case directories"** - Kebab-case is valid and consistent

---

*Plan generated from verified codebase analysis - 2026-01-27*
