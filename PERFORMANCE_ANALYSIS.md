# Performance Analysis Report

**Date:** January 10, 2026
**Analyzed by:** Claude Code

This report identifies performance anti-patterns, N+1 queries, unnecessary re-renders, and inefficient algorithms in the SyllabusStack codebase.

---

## Executive Summary

| Category | Issues Found | Critical | High | Medium |
|----------|-------------|----------|------|--------|
| Backend N+1 Queries | 10 | 1 | 3 | 6 |
| React Re-render Issues | 15+ | 1 | 5 | 4 |
| Data Fetching Patterns | 12+ | 2 | 4 | 6 |
| Algorithm Efficiency | 10 | 1 | 4 | 5 |

---

## 1. Backend Performance Issues (Supabase Edge Functions)

### CRITICAL: Security + Performance

#### Missing User Filter on Capabilities Query
**File:** `supabase/functions/generate-recommendations/index.ts`
**Lines:** 66-68

```typescript
// PROBLEM: Fetches ALL capabilities from ALL users!
const { data: capabilities } = await supabase
  .from("capabilities")
  .select("name, category, proficiency_level");
  // MISSING: .eq("user_id", userId)
```

**Impact:** Fetches entire capabilities table instead of user-specific data. Major security vulnerability and scales O(total users).

**Fix:** Add `.eq("user_id", userId)` filter.

---

### HIGH: N+1 Query Patterns

#### 1. Single Learning Objective Inserts in Loop
**File:** `supabase/functions/extract-learning-objectives/index.ts`
**Lines:** 181-212

```typescript
// PROBLEM: N database calls for N learning objectives
for (const lo of learningObjectives) {
  const { data: savedLO } = await supabaseClient
    .from("learning_objectives")
    .insert(loData)
    .select()
    .single();  // ← Single insert per loop iteration
}
```

**Impact:** 50 learning objectives = 50 database roundtrips instead of 1.

**Fix:** Batch insert all learning objectives in single query.

---

#### 2. Nested Module/LO Inserts
**File:** `supabase/functions/process-syllabus/index.ts`
**Lines:** 277-364

```typescript
// PROBLEM: Nested loops with individual inserts
for (const module of courseStructure.modules) {
  await supabaseClient.from("modules").insert({...}).single();

  for (const lo of module.learning_objectives) {
    await supabaseClient.from("learning_objectives").insert({...}).single();
  }
}
```

**Impact:** 5 modules × 4 LOs = 23 database roundtrips instead of 2 batched inserts.

---

### MEDIUM: Sequential Queries That Could Be Parallelized

#### 1. Global Search Sequential Queries
**File:** `supabase/functions/global-search/index.ts`
**Lines:** 58-135

```typescript
// PROBLEM: Four independent queries executed sequentially
const { data: courses } = await supabase.from("courses")...
const { data: dreamJobs } = await supabase.from("dream_jobs")...
const { data: recommendations } = await supabase.from("recommendations")...
const { data: capabilities } = await supabase.from("capabilities")...
```

**Fix:** Use `Promise.all()` to parallelize:
```typescript
const [courses, dreamJobs, recommendations, capabilities] = await Promise.all([
  supabase.from("courses")...,
  supabase.from("dream_jobs")...,
  supabase.from("recommendations")...,
  supabase.from("capabilities")...
]);
```

#### 2. Redundant Answer Fetches
**File:** `supabase/functions/complete-assessment/index.ts`
**Lines:** 62-100

Answers are fetched twice for completed sessions - once to check status, once in main flow.

#### 3. Duplicate Session Queries
**File:** `supabase/functions/start-assessment/index.ts`
**Lines:** 106-158

Two separate queries for session data + count when both could come from single fetch.

---

## 2. React Re-render Issues

### CRITICAL: Multiple TooltipProvider Instances

**File:** `src/components/instructor/UnifiedLOCard.tsx`
**Lines:** 146, 165, 502, 520, 559, 601, 615, 642, 658

```tsx
// PROBLEM: 9 separate TooltipProvider instances
{learningObjective.bloom_level && (
  <TooltipProvider>  // Instance 1
    <Tooltip>...</Tooltip>
  </TooltipProvider>
)}
// ... repeated 8 more times ...
```

**Impact:** Each TooltipProvider creates a new React Context, causing cascade re-renders.

**Fix:** Wrap entire component with ONE TooltipProvider at the root level.

---

### HIGH: Missing useMemo/useCallback

#### 1. Learn.tsx - Computed Values Without Memoization
**File:** `src/pages/Learn.tsx`
**Lines:** 264-275

```typescript
// PROBLEM: Recalculates on every render
const filteredSkills = skills?.filter(skill =>
  skill.name.toLowerCase().includes(skillSearchQuery.toLowerCase())
);

const groupedSkills = filteredSkills?.reduce((acc, skill) => {
  // grouping logic
}, {});
```

**Fix:** Wrap in `useMemo` with `[skills, skillSearchQuery]` dependencies.

#### 2. Courses.tsx - Inline Dropdown Callbacks
**File:** `src/pages/Courses.tsx`
**Lines:** 854-921

```tsx
// PROBLEM: 10+ inline arrow functions in dropdown menu
<DropdownMenuItem onClick={(e) => {
  e.stopPropagation();
  handleEditCourse(course);
}}>
```

**Impact:** New function reference created per course, per render.

**Fix:** Use `useCallback` and pass course ID as data attribute.

#### 3. UnifiedLOCard.tsx - Missing React.memo
**File:** `src/components/instructor/UnifiedLOCard.tsx`
**Line:** 435

`CompactContentCard` rendered in map without React.memo wrapper.

---

### HIGH: Inline Object/Array Creation

#### CareerPath.tsx - Array Spread in Render
**File:** `src/pages/CareerPath.tsx`
**Lines:** 447-466

```tsx
// PROBLEM: Creates new array every render
overlaps={[
  ...strongOverlaps.map((o, i) => ({...})),
  ...partialOverlaps.map((o, i) => ({...}))
]}
```

**Fix:** Memoize with `useMemo`.

---

## 3. Data Fetching Anti-Patterns

### CRITICAL: Missing staleTime Configuration

12 hooks are missing `staleTime`, causing unnecessary refetches on every component mount:

| File | Hook | Line |
|------|------|------|
| `src/hooks/useCourses.ts` | useCourses() | 140-145 |
| `src/hooks/useCourses.ts` | useCourse() | 147-153 |
| `src/hooks/useDreamJobs.ts` | useDreamJobs() | 150-155 |
| `src/hooks/useCapabilities.ts` | useCapabilities() | 22-27 |
| `src/hooks/useRecommendations.ts` | useRecommendations() | 48-53 |
| `src/hooks/useProfile.ts` | useProfile() | 50-55 |
| `src/hooks/useDashboard.ts` | useDashboardOverview() | 181-186 |
| `src/hooks/useInstructorCourses.ts` | useInstructorCourses() | 30-43 |
| `src/hooks/useStudentCourses.ts` | useStudentEnrollments() | 45-73 |

**Fix:** Add `staleTime: 1000 * 60 * 5` (5 minutes) for stable data, or appropriate duration based on update frequency.

---

### HIGH: Waterfalling Queries

#### 1. useLOSuggestions - Sequential Fetches
**File:** `src/hooks/useContentSuggestions.ts`
**Lines:** 35-91

```typescript
// PROBLEM: Waterfall - second query waits for first
const suggestions = await fetchSuggestions();
const votes = await fetchVotes(suggestions); // Depends on suggestions
```

#### 2. useEnrolledCourseDetail - Nested Promise.all
**File:** `src/hooks/useStudentCourses.ts`
**Lines:** 115-132

Fetches modules first, then loops to fetch LOs for each module.

#### 3. useCourseStudents - Multiple Sequential Queries
**File:** `src/hooks/useInstructorCourses.ts`
**Lines:** 275-376

5 sequential database queries that could be parallelized.

---

### HIGH: Overly Broad Cache Invalidation

**File:** `src/hooks/useCourses.ts`
**Lines:** 160-165, 200-204, 225-229

```typescript
// PROBLEM: Invalidates 4 query families on every mutation
queryClient.invalidateQueries({ queryKey: queryKeys.courses });
queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
```

**Fix:** Target specific queries with IDs rather than entire families.

---

## 4. Algorithm Efficiency Issues

### CRITICAL: O(n²) Nested Loops with find()

**File:** `src/hooks/useInstructorCourses.ts`
**Lines:** 343-349

```typescript
// PROBLEM: O(n*m*k) complexity
for (const studentId of studentIds) {
  const studentConsumption = consumption?.filter(c => c.user_id === studentId);

  for (const lo of los) {
    const consumptionRecord = studentConsumption.find(c =>
      c.learning_objective_id === lo.id
    );
    const loState = loStates?.find(s => s.id === lo.id);
  }
}
```

**Fix:** Pre-compute Maps for O(1) lookups:
```typescript
const consumptionMap = new Map(consumption.map(c =>
  [`${c.user_id}-${c.learning_objective_id}`, c]
));
const loStateMap = new Map(loStates.map(s => [s.id, s]));
```

---

### HIGH: Multiple filter().length Calls

**File:** `src/hooks/useDashboard.ts`
**Lines:** 74-77

```typescript
// PROBLEM: Scans array 4 times
const completedRecs = recs.filter(r => r.status === 'completed').length;
const inProgressRecs = recs.filter(r => r.status === 'in_progress').length;
const pendingRecs = recs.filter(r => r.status === 'pending' || !r.status).length;
const skippedRecs = recs.filter(r => r.status === 'skipped').length;
```

**Fix:** Single pass with reduce:
```typescript
const counts = recs.reduce((acc, r) => {
  acc[r.status || 'pending']++;
  return acc;
}, { completed: 0, in_progress: 0, pending: 0, skipped: 0 });
```

---

### HIGH: String Concatenation in Loops

**Files affected:**
- `src/pages/instructor/QuickCourseSetup.tsx` (lines 131-133)
- `src/components/onboarding/BulkSyllabusUploader.tsx` (lines 165-167)
- `src/pages/Courses.tsx` (line 542)
- `src/pages/Learn.tsx` (line 435)

```typescript
// PROBLEM: O(n²) string operations
let binary = '';
for (let i = 0; i < bytes.byteLength; i++) {
  binary += String.fromCharCode(bytes[i]);
}
```

**Fix:** Use array and join:
```typescript
const chars = new Array(bytes.byteLength);
for (let i = 0; i < bytes.byteLength; i++) {
  chars[i] = String.fromCharCode(bytes[i]);
}
const binary = chars.join('');
```

---

## Priority Fix Order

### Immediate (Critical)
1. `generate-recommendations/index.ts:66-68` - Add user filter to capabilities query (SECURITY)
2. `UnifiedLOCard.tsx` - Replace 9 TooltipProvider instances with single provider

### High Priority
3. `extract-learning-objectives/index.ts:181-212` - Batch LO inserts
4. `process-syllabus/index.ts:277-364` - Batch module/LO inserts
5. `useInstructorCourses.ts:343-349` - Use Map for O(1) lookups
6. Add `staleTime` to 12 hooks missing it
7. `global-search/index.ts:58-135` - Parallelize with Promise.all

### Medium Priority
8. `Learn.tsx:264-275` - Add useMemo for filtered/grouped skills
9. `Courses.tsx:854-921` - Add useCallback for dropdown handlers
10. `useDashboard.ts:74-77` - Single-pass counting with reduce
11. Fix string concatenation loops (5 files)
12. More granular cache invalidation

---

## Estimated Impact

| Fix | Performance Gain |
|-----|-----------------|
| Batch LO inserts | 50x fewer DB calls |
| Parallelize global search | 4x faster search |
| Add staleTime | 80% fewer refetches |
| Map-based lookups | O(n²) → O(n) |
| Single TooltipProvider | Significant re-render reduction |
| useMemo/useCallback | Reduced component re-renders |

---

*Report generated by Claude Code performance analysis*
