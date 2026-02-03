# SyllabusStack: Codebase Issues Implementation Plan

## Executive Summary

This document outlines a detailed implementation plan for fixing 6 identified issues in the SyllabusStack codebase. Each fix is evaluated against:

1. **Platform Objectives** - Alignment with the core mission of helping students discover skills, analyze career gaps, and get actionable recommendations
2. **Dependency Analysis** - Understanding what components consume or depend on the code being modified
3. **Consistency** - Ensuring edits follow existing patterns and conventions
4. **No Patchwork** - Making meaningful changes that solve root causes, not symptoms

---

## Platform Context

**SyllabusStack** is a career-success platform that:
- Helps students understand their true capabilities from academic courses
- Matches skills to real job requirements via AI-powered gap analysis
- Generates personalized, actionable recommendations
- Serves instructors with AI-powered course content generation
- Connects employers with verified talent

**Core User Experience Promise**: Students should always have clear visibility into their career readiness status and what actions will move them forward.

---

## Issue #1: Pointless Ternary in Dashboard.tsx:43

### Current Code
```typescript
// src/pages/Dashboard.tsx:43
status: job.is_primary ? 'active' as const : 'active' as const,
```

### Problem
Both branches return `'active'`, making the `is_primary` field completely ignored in the Dashboard view. This contradicts:
- The `DreamJobCards` component which renders different styles for `active` vs `achieved` vs `paused`
- The `DreamJobs.tsx` page which correctly shows "Primary" vs "Active" badges (lines 262-264)

### Dependency Analysis

**Upstream (what provides data):**
- `useDreamJobs()` hook → returns `DreamJob[]` with `is_primary: boolean`
- Database: `dream_jobs.is_primary` column

**Downstream (what consumes this):**
- `DreamJobCards` component expects `status: "active" | "achieved" | "paused"`
- Component renders different badge styles based on status (lines 136-147):

```typescript
// DreamJobCards.tsx:140-143
${job.status === "active"
  ? "bg-accent/10 text-accent border border-accent/20"
  : "bg-success/10 text-success border border-success/20"  // achieved/paused
}
```

### Platform Alignment

The Dashboard is the **first screen** users see after login. It should provide:
- Clear visibility of career progress
- Visual differentiation of their **primary** goal vs secondary goals

Currently, all jobs look identical, which fails the "clear visibility" promise.

### Recommended Fix

**Option A (Recommended):** Map `is_primary` to visual distinction without changing semantic meaning
```typescript
// Dashboard.tsx:43
status: job.is_primary ? 'active' as const : 'paused' as const,
```

This makes primary jobs stand out with accent colors while secondary jobs appear more muted.

**Option B (Alternative):** If semantically a "primary" job represents the user's #1 focus:
```typescript
status: job.is_primary ? 'achieved' as const : 'active' as const,
```

This would show primary jobs with success styling (green), signaling "this is your target."

### Why Option A is Better

- `paused` semantically means "not the current focus" which aligns with non-primary jobs
- `achieved` implies the goal was reached, which is misleading for an aspirational target
- The visual contrast (accent vs muted) correctly communicates "primary focus" vs "also tracking"

### Implementation Steps

1. ✅ Read `DreamJobCards.tsx` styling to confirm visual behavior
2. Edit `Dashboard.tsx:43` to use Option A
3. Verify no TypeScript errors
4. Test: Dashboard should show visual distinction between primary and non-primary jobs

### Risk Assessment
- **Breaking change risk:** None - component already handles all three status values
- **Data migration:** None required
- **Test coverage:** Manual verification sufficient

---

## Issue #2: Fire-and-Forget Async in useDreamJobs.ts:79-115

### Current Code
```typescript
// src/hooks/useDreamJobs.ts:79-115
(async () => {
  try {
    const analysisResult = await analyzeDreamJob(...);
    // ... update dream_jobs table
    // ... check for existing analysis
    // ... performGapAnalysis
    // ... generateRecommendations
  } catch (workflowError) {
    console.error('[Workflow] Background analysis failed:', workflowError);
    // Don't throw - background task shouldn't break the main flow
  }
})();
```

### Problem
1. Users receive a success toast saying "Analyzing requirements..." but have **no feedback** if it fails
2. Silent failures mean users might wait indefinitely for recommendations that will never appear
3. No retry mechanism exists
4. The gap analysis and recommendations are the **core value proposition** - failing silently breaks user trust

### Dependency Analysis

**What this async block does:**
1. `analyzeDreamJob()` → Edge function to extract job requirements
2. Updates `dream_jobs` table with extracted data
3. `hasExistingAnalysis()` → Checks if gap analysis exists
4. `performGapAnalysis()` → Edge function to compare skills vs requirements
5. `generateRecommendations()` → Edge function to create actionable steps

**Upstream:**
- Called from `createDreamJobWithWorkflow()` after successful job creation
- `useCreateDreamJob()` mutation wraps this function

**Downstream consumers:**
- Dashboard: Shows gap counts per job
- DreamJob detail page: Shows full gap analysis
- Recommendations page: Shows generated recommendations
- All these will show **empty or stale data** if the background task fails

### Platform Alignment

The platform promises: "Add your dream job → Get personalized gap analysis → Get actionable recommendations"

A silent failure breaks this promise without the user knowing. They might:
- Think the system is slow
- Give up and leave
- Lose trust in the platform's reliability

### Recommended Fix

**Phase 1 (Immediate - This Sprint):** Add user notification on failure

The file already imports `toast` from `@/hooks/use-toast` (line 5), so we just need to add the toast call:

```typescript
// src/hooks/useDreamJobs.ts - in the catch block (line 111-114)
} catch (workflowError) {
  console.error('[Workflow] Background analysis failed:', workflowError);
  toast({
    title: 'Analysis incomplete',
    description: 'We couldn\'t complete the full analysis. You can retry from the job details page.',
    variant: 'destructive',
  });
}
```

**Phase 2 (Future enhancement):** Add retry mechanism and status tracking
- Add `analysis_status` column to `dream_jobs`: `'pending' | 'analyzing' | 'completed' | 'failed'`
- Show status indicator in UI
- Add "Retry Analysis" button on job detail page

### Why This Fix Works

1. **Minimal change:** Only adds toast call - no structural changes
2. **Uses existing import:** `toast` is already imported on line 5
3. **User gets feedback:** Failure is communicated clearly
4. **Actionable:** User knows they can retry (even if manual for now)
5. **Consistent pattern:** Other hooks in the codebase already use toast for error feedback

### Implementation Steps

1. ✅ Verify `toast` import exists (line 5)
2. Add toast call in the catch block (lines 111-114)
3. Verify the toast appears when analysis fails (can test by temporarily throwing)

### Risk Assessment
- **Breaking change risk:** None - only adds notification
- **Performance impact:** None
- **User experience:** Significantly improved

---

## Issue #3: Deprecated Hooks Still Maintained

### Current State
Three files marked `@deprecated` but still exist:
- `src/hooks/useAssessment.ts` - re-exports from `./assessment/`
- `src/hooks/useLectureSlides.ts` - re-exports from `./lectureSlides/`
- `src/hooks/useInstructorCourses.ts` - re-exports from `./instructorCourses/`

Each file has a JSDoc comment like:
```typescript
/**
 * @deprecated Import from '@/hooks/assessment' instead for better tree-shaking.
 */
```

### Problem
1. Two import paths for the same functionality creates confusion
2. Tree-shaking optimizations may not work properly
3. New developers might use deprecated paths
4. Maintenance burden of keeping re-exports in sync

### Dependency Analysis

**Search required before changes:**
```bash
# Find all imports from deprecated files
grep -r "from '@/hooks/useAssessment'" src/
grep -r "from '@/hooks/useLectureSlides'" src/
grep -r "from '@/hooks/useInstructorCourses'" src/
```

### Platform Alignment

This is **tech debt cleanup** - does not directly affect user experience but:
- Improves developer velocity
- Reduces bundle size (better tree-shaking)
- Prevents future bugs from import confusion

### Recommended Fix

**Option A (Clean break - Recommended for dedicated sprint):**
1. Search for all imports from deprecated files
2. Update imports to modular paths (`@/hooks/assessment`, etc.)
3. Delete deprecated files
4. Update any documentation

**Option B (Gradual deprecation - For now):**
1. Keep files but add `/** @deprecated */` JSDoc on each individual export
2. IDEs will show strikethrough on usage
3. Set a date to remove in future sprint

### Implementation Steps (Option A - Deferred)

1. Run grep commands to find all usages
2. For each usage, update import path:
   - `from '@/hooks/useAssessment'` → `from '@/hooks/assessment'`
   - `from '@/hooks/useLectureSlides'` → `from '@/hooks/lectureSlides'`
   - `from '@/hooks/useInstructorCourses'` → `from '@/hooks/instructorCourses'`
3. Verify no TypeScript errors
4. Delete deprecated files
5. Run full build to confirm

### Risk Assessment
- **Breaking change risk:** Medium - requires updating imports
- **Mitigation:** Comprehensive search before deletion
- **Rollback:** Easy via git if issues found
- **Recommendation:** Defer to dedicated tech debt sprint

---

## Issue #4: Inconsistent Toast Import in useCourses.ts:5

### Current Code
```typescript
// src/hooks/useCourses.ts:5
import { toast } from '@/hooks/use-toast';
```

### Standard Pattern (used in components)
```typescript
import { useToast } from '@/hooks/use-toast';
// Inside component/hook:
const { toast } = useToast();
```

### Analysis

**Files using standalone `toast`:**
- `src/hooks/useCourses.ts:5`
- `src/hooks/useDreamJobs.ts:5`

**Files using `useToast()` hook:**
- `src/pages/DreamJobs.tsx:33` - `const { toast } = useToast();`
- `src/hooks/lectureSlides/mutations.ts:9` - `import { useToast } from '@/hooks/use-toast';`
- Most other component files

### Platform Alignment

This is **code consistency** - doesn't affect users but:
- Makes codebase easier to maintain
- Follows React best practices

### Recommended Decision: No Change Needed

**Reason:** The standalone `toast` pattern is actually **intentional and correct** in these hooks:

1. Hooks like `useCourses` and `useDreamJobs` use `toast` in mutation callbacks
2. These callbacks may execute **after component unmount** (e.g., user navigates away while mutation is pending)
3. Calling a React hook (`useToast`) outside the component lifecycle would cause an error
4. The standalone `toast` function works globally and is designed for this exact use case

### Implementation Steps

1. Add clarifying code comment to both files explaining the pattern:

```typescript
// src/hooks/useCourses.ts:5
// Using standalone toast (not useToast hook) because mutation callbacks may execute
// after component unmount, where hooks cannot be called
import { toast } from '@/hooks/use-toast';
```

2. Same comment for `useDreamJobs.ts:5`

### Risk Assessment
- **Breaking change risk:** None
- **Value:** Documentation improvement only
- **Priority:** Low

---

## Issue #5: Progress Bar Timing Mismatch in lectureSlides/mutations.ts:73-94

### Current Code
```typescript
// src/hooks/lectureSlides/mutations.ts:73-94
const phases = [
  { phase: 'professor', percent: 15, message: 'Professor AI: Analyzing teaching context...' },
  { phase: 'professor', percent: 35, message: 'Professor AI: Designing pedagogical sequence...' },
  { phase: 'professor', percent: 55, message: 'Professor AI: Writing slide content...' },
  { phase: 'visual', percent: 70, message: 'Visual AI: Generating custom diagrams...' },
  { phase: 'visual', percent: 85, message: 'Visual AI: Processing images...' },
  { phase: 'finalize', percent: 95, message: 'Finalizing lecture deck...' },
];

let currentPhaseIndex = 0;
const interval = setInterval(() => {
  if (currentPhaseIndex < phases.length) {
    setProgress(phases[currentPhaseIndex]);
    currentPhaseIndex++;
  }
}, 8000); // ~8s per phase estimate
```

### Problem
1. 6 phases × 8 seconds = 48 seconds to reach "Finalizing..." at 95%
2. If actual generation takes 60+ seconds, progress bar shows 95% while still waiting
3. If generation takes 30 seconds, progress bar is only at ~55% when complete
4. Creates disconnect between perceived and actual progress

### Dependency Analysis

**What uses this:**
- `useGenerateLectureSlides()` hook returns `progress` state
- UI components show progress bar based on this state
- When `mutation.isPending` becomes false, progress resets to null (line 55)

**The actual operation:**
- Calls `generate-lecture-slides-v3` edge function
- Real duration varies based on content complexity (20-90 seconds typical)
- No server-sent events or real progress reporting from backend

### Platform Alignment

Instructors use this to generate lecture content. Poor progress feedback:
- Creates anxiety ("Is it stuck?")
- May lead to refresh/retry causing duplicate requests
- Reduces trust in the AI generation system

### Recommended Fix

**Option A (Never reach 100% until actually done - Recommended):**

Change line 87 from:
```typescript
if (currentPhaseIndex < phases.length) {
```

To:
```typescript
if (currentPhaseIndex < phases.length - 1) {  // Stop at 85%, never show "Finalizing" until actually done
```

This ensures:
- Progress never shows "Finalizing" (95%) until actual completion
- Maximum simulated progress is 85% ("Processing images...")
- User sees honest "still working" state

**Why This Fix Works:**
1. **One-line change:** Minimal code modification
2. **Honest UX:** Never claims "Finalizing" until actually finalizing
3. **No complex timing math:** Avoids over-engineering
4. **User expectation:** "85% and waiting" is better than "95% and waiting"

### Implementation Steps

1. Edit line 87: change `< phases.length` to `< phases.length - 1`
2. Optionally: Add comment explaining why
3. Test with actual generation to verify behavior

### Risk Assessment
- **Breaking change risk:** None
- **UX impact:** Positive - more honest progress indication
- **Performance impact:** None

---

## Issue #6: Query Key Naming Inconsistency in query-keys.ts

### Current State
Mixed patterns in the same file:

**Pattern A (Flat functions):**
```typescript
// Lines 18-22
dreamJobs: ['dreamJobs'] as const,
dreamJobsList: () => [...queryKeys.dreamJobs, 'list'] as const,
dreamJobDetail: (id: string) => [...queryKeys.dreamJobs, 'detail', id] as const,
```

**Pattern B (Nested objects):**
```typescript
// Lines 57-61
instructorCourses: {
  all: ['instructor-courses'] as const,
  list: () => ['instructor-courses', 'list'] as const,
  detail: (id: string) => ['instructor-courses', 'detail', id] as const,
},
```

### Problem
1. Inconsistent patterns make code harder to learn
2. Cache invalidation queries differ based on which pattern is used:
   - Pattern A: `queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs })`
   - Pattern B: `queryClient.invalidateQueries({ queryKey: queryKeys.instructorCourses.all })`
3. New features might use either pattern randomly

### Dependency Analysis

**Scope of change:** This affects ~50+ hook files that import `queryKeys`

**Examples of current usage:**
- `useDreamJobs.ts:147` - `queryKey: queryKeys.dreamJobsList()`
- `useDreamJobs.ts:173` - `queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs })`
- `lectureSlides/queries.ts` - Uses nested pattern

### Platform Alignment

This is **significant refactoring** that:
- Doesn't affect users directly
- Improves long-term maintainability
- Has high risk of introducing bugs if not done carefully

### Recommended Fix

**Option B (Freeze current state - Recommended for now):**
- Document the two patterns at the top of `query-keys.ts`
- Mandate nested pattern for all NEW query keys
- Plan full standardization for a dedicated tech debt sprint

**Reason:**
- High effort (~50+ files to update)
- Low immediate value
- Risk of introducing bugs across many files
- Should be done with comprehensive test coverage

### Implementation Steps (Minimal - For Now)

1. Add documentation comment at top of `query-keys.ts`:

```typescript
/**
 * Query Key Factory
 *
 * PATTERNS IN USE:
 * 1. Flat functions (legacy): dreamJobs, dreamJobsList(), dreamJobDetail(id)
 * 2. Nested objects (preferred): instructorCourses.all, instructorCourses.list()
 *
 * FOR NEW KEYS: Use the nested object pattern (Pattern 2)
 * MIGRATION: Planned for future tech debt sprint
 */
export const queryKeys = {
```

2. Create GitHub issue for future standardization

### Risk Assessment
- **Breaking change risk:** High if standardizing now
- **Recommendation:** Defer full refactoring to dedicated sprint

---

## Implementation Priority Matrix

| Issue | Platform Impact | Effort | Risk | Priority |
|-------|----------------|--------|------|----------|
| #1 Dashboard ternary | High (first screen users see) | Low (1 line) | None | **P0 - Do First** |
| #2 Silent async failure | High (core value proposition) | Low (add toast) | None | **P0 - Do First** |
| #5 Progress bar timing | Medium (instructor UX) | Low (1 line) | None | **P1 - Do Second** |
| #4 Toast consistency | Low (code quality) | Low (add comment) | None | **P2 - Quick Win** |
| #3 Deprecated hooks | Low (tech debt) | Medium (find/replace) | Medium | **P3 - Dedicated Sprint** |
| #6 Query key naming | Low (tech debt) | High (50+ files) | High | **P4 - Future Sprint** |

---

## Pre-Implementation Checklist

Before making any changes:

- [ ] Run `npm run build` to confirm clean baseline
- [ ] Run `npm run typecheck` if separate from build
- [ ] Verify git status is clean
- [ ] Create feature branch

## Post-Implementation Checklist

After each fix:

- [ ] Run TypeScript check - no new errors
- [ ] Run build - successful
- [ ] Manual test the affected feature
- [ ] Commit with descriptive message

---

## Summary

This plan prioritizes:
1. **User-facing fixes first** (#1, #2) - directly improve the experience
2. **Low-risk UX improvements second** (#5) - better feedback during AI operations
3. **Documentation/cleanup third** (#4) - adds clarity without risk
4. **Major refactoring deferred** (#3, #6) - requires dedicated effort and testing

All P0 and P1 fixes can be implemented in a single focused session with minimal risk.

---

*Document created: February 3, 2026*
*Related to: Code quality review session*
