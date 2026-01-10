# Systematic Implementation Guide

**Goal:** Implement all performance optimizations while ensuring the system works better than before at every step.

**Principle:** Each change must be:
1. **Testable** - Can verify it works before moving on
2. **Reversible** - Can rollback if issues arise
3. **Incremental** - Small changes, frequently validated
4. **Observable** - Can measure improvement

---

## Implementation Strategy Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SAFE IMPLEMENTATION FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │
│   │ Baseline│ -> │  Test   │ -> │ Deploy  │ -> │ Verify  │        │
│   │ Measure │    │ Locally │    │ Staging │    │ Metrics │        │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘        │
│        │              │              │              │               │
│        │              │              │              ▼               │
│        │              │              │         ┌─────────┐         │
│        │              │              │         │ Better? │         │
│        │              │              │         └─────────┘         │
│        │              │              │          │      │           │
│        │              │              │        YES      NO          │
│        │              │              │          │      │           │
│        │              │              │          ▼      ▼           │
│        │              │              │      ┌──────┐┌──────┐       │
│        │              │              │      │Deploy││Rollback│     │
│        │              │              │      │ Prod ││       │      │
│        │              │              │      └──────┘└──────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 0: Baseline Measurements (BEFORE ANY CHANGES)

### 0.1 Record Current Performance Metrics

Run these measurements and save the results:

```bash
# Create baseline metrics file
mkdir -p docs/performance
touch docs/performance/baseline-$(date +%Y%m%d).md
```

**Metrics to capture:**

```markdown
## Baseline Performance Metrics - [DATE]

### API Response Times
| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| GET /courses | _ms | _ms | _ms |
| GET /recommendations | _ms | _ms | _ms |
| POST /process-syllabus | _ms | _ms | _ms |
| GET /global-search | _ms | _ms | _ms |

### Database Query Times (from Supabase Dashboard)
| Query | Avg Time | Rows Scanned |
|-------|----------|--------------|
| capabilities by user | _ms | _ |
| learning_objectives by course | _ms | _ |
| consumption_records by user | _ms | _ |

### Frontend Metrics
| Page | LCP | FID | CLS |
|------|-----|-----|-----|
| Dashboard | _s | _ms | _ |
| Courses | _s | _ms | _ |
| Course Detail | _s | _ms | _ |

### Resource Usage
- API calls per hour: ___
- Database connections (peak): ___
- Memory usage (Edge Functions): ___
```

### 0.2 Create Test Suite for Critical Paths

```typescript
// tests/critical-paths.test.ts
describe('Critical Path Tests', () => {
  describe('Syllabus Processing', () => {
    test('uploads syllabus and creates modules', async () => {
      const result = await uploadSyllabus(testSyllabus);
      expect(result.modules.length).toBeGreaterThan(0);
      expect(result.learningObjectives.length).toBeGreaterThan(0);
    });

    test('module-LO relationships are correct', async () => {
      const course = await getCourse(testCourseId);
      for (const module of course.modules) {
        const los = await getLOsByModule(module.id);
        expect(los.every(lo => lo.module_id === module.id)).toBe(true);
      }
    });
  });

  describe('Gap Analysis', () => {
    test('generates recommendations with user data only', async () => {
      const recs = await generateRecommendations(testUserId);
      expect(recs.every(r => r.user_id === testUserId)).toBe(true);
    });
  });

  describe('Instructor Dashboard', () => {
    test('loads student progress correctly', async () => {
      const progress = await getStudentProgress(testCourseId);
      expect(progress.students.length).toBeGreaterThan(0);
      expect(progress.loadTime).toBeLessThan(5000);
    });
  });
});
```

---

## Step 1: Zero-Risk Fixes (Day 1)

These changes have NO risk of breaking anything and only improve the system.

### 1.1 Fix Missing User Filter

**Why it's safe:** Adds a filter that was missing. Makes the query MORE correct.

```bash
# Step 1: Read the current code
cat supabase/functions/generate-recommendations/index.ts | grep -A5 "from.*capabilities"

# Step 2: Make the change
# Edit line 66-68 to add .eq("user_id", userId)

# Step 3: Test locally
supabase functions serve generate-recommendations

# Step 4: Verify with curl
curl -X POST http://localhost:54321/functions/v1/generate-recommendations \
  -H "Authorization: Bearer [test-token]" \
  -d '{"dreamJobId": "[test-id]"}'

# Step 5: Check the response contains only ~20 capabilities, not thousands
```

**Verification Checklist:**
- [ ] Response time < 1 second (was timing out before)
- [ ] Capabilities count is reasonable (~20, not 200,000)
- [ ] Recommendations are relevant to user's skills

**Rollback (if needed):**
```bash
git checkout HEAD~1 -- supabase/functions/generate-recommendations/index.ts
supabase functions deploy generate-recommendations
```

---

### 1.2 Add Database Indexes

**Why it's safe:** Indexes are metadata only. Queries automatically use them. No code changes needed.

```sql
-- Step 1: Check current indexes
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;

-- Step 2: Add indexes ONE AT A TIME (so you can identify issues)

-- Index 1: Capabilities
CREATE INDEX CONCURRENTLY idx_capabilities_user_id
ON capabilities(user_id);

-- Verify it's being used:
EXPLAIN ANALYZE SELECT * FROM capabilities WHERE user_id = '[test-uuid]';
-- Should show "Index Scan" not "Seq Scan"

-- Index 2: Learning Objectives
CREATE INDEX CONCURRENTLY idx_lo_instructor_course
ON learning_objectives(instructor_course_id);

-- Verify:
EXPLAIN ANALYZE SELECT * FROM learning_objectives WHERE instructor_course_id = '[test-uuid]';

-- Continue with remaining indexes...
```

**Verification Checklist:**
- [ ] All EXPLAIN ANALYZE shows "Index Scan"
- [ ] Query times reduced by 10-100×
- [ ] No errors in application logs
- [ ] All existing functionality still works

**Rollback (if needed):**
```sql
DROP INDEX IF EXISTS idx_capabilities_user_id;
-- Queries will work (just slower)
```

---

### 1.3 Add staleTime to Hooks

**Why it's safe:** Only affects caching behavior. Data is still fetched correctly.

```typescript
// Step 1: Add to ONE hook first (least critical)
// src/hooks/useCapabilities.ts
export function useCapabilities() {
  return useQuery({
    queryKey: queryKeys.capabilities(),
    queryFn: fetchCapabilities,
    staleTime: 1000 * 60 * 10,  // 10 minutes
  });
}

// Step 2: Test in browser
// - Navigate to page using capabilities
// - Check Network tab: should NOT refetch on navigation
// - Wait 10 minutes, navigate: SHOULD refetch

// Step 3: If working, apply to more hooks
```

**Verification Checklist:**
- [ ] Data loads correctly on first visit
- [ ] Navigation doesn't trigger unnecessary refetches
- [ ] Data still updates after mutations
- [ ] No stale data issues reported

**Rollback (if needed):**
```typescript
// Simply remove the staleTime line
// Default behavior returns
```

---

## Step 2: Low-Risk Optimizations (Day 2-3)

### 2.1 Parallelize Global Search

**Why it's safe:** Same queries, just run in parallel. Uses Promise.allSettled for graceful degradation.

```typescript
// Before: Sequential (current)
const courses = await supabase.from("courses")...
const dreamJobs = await supabase.from("dream_jobs")...
const recommendations = await supabase.from("recommendations")...
const capabilities = await supabase.from("capabilities")...

// After: Parallel with fallback
const results = await Promise.allSettled([
  supabase.from("courses")...,
  supabase.from("dream_jobs")...,
  supabase.from("recommendations")...,
  supabase.from("capabilities")...,
]);

// Extract with fallbacks (if one fails, others still work)
const courses = results[0].status === 'fulfilled' ? results[0].value.data : [];
const dreamJobs = results[1].status === 'fulfilled' ? results[1].value.data : [];
// ...
```

**Testing Script:**
```bash
# Time the search before and after
time curl -X POST http://localhost:54321/functions/v1/global-search \
  -H "Authorization: Bearer [token]" \
  -d '{"query": "python"}'

# Expected: ~50ms (was ~200ms)
```

**Verification Checklist:**
- [ ] Search still returns all result types
- [ ] Response time reduced by ~4×
- [ ] If one table errors, others still return
- [ ] No console errors

---

### 2.2 Fix Map Lookups (O(n³) → O(n²))

**Why it's safe:** Same logic, just more efficient data structures. Output is identical.

```typescript
// Step 1: Add Map creation (new code, doesn't change existing logic)
const consumptionMap = new Map<string, typeof consumption[0]>();
consumption?.forEach(c => {
  consumptionMap.set(`${c.user_id}|${c.learning_objective_id}`, c);
});

// Step 2: Replace .find() with .get()
// Before:
const record = studentConsumption.find(c => c.learning_objective_id === lo.id);
// After:
const record = consumptionMap.get(`${studentId}|${lo.id}`);

// Step 3: Verify output is identical
const beforeResult = getStudentProgressOld(courseId);
const afterResult = getStudentProgressNew(courseId);
expect(JSON.stringify(beforeResult)).toBe(JSON.stringify(afterResult));
```

**Verification Checklist:**
- [ ] Dashboard loads 10× faster
- [ ] Student progress data is identical
- [ ] No missing or incorrect progress records

---

### 2.3 Add useMemo/useCallback

**Why it's safe:** Pure optimization. Same values, just cached.

```typescript
// Step 1: Wrap ONE computed value
const filteredSkills = useMemo(() =>
  skillProfile.filter(skill =>
    skill.skill_name.toLowerCase().includes(searchQuery.toLowerCase())
  ),
  [skillProfile, searchQuery]  // Dependencies
);

// Step 2: Verify with React DevTools
// - Open React DevTools > Profiler
// - Record a render
// - Verify memoized components don't re-render unnecessarily
```

**Verification Checklist:**
- [ ] Filtering still works correctly
- [ ] React DevTools shows fewer re-renders
- [ ] No infinite loops or stale data
- [ ] UI feels more responsive

---

## Step 3: Medium-Risk Changes (Day 4-7)

These changes require more careful testing.

### 3.1 Batch LO Inserts

**Risk:** Changes error handling from partial-success to all-or-nothing.

**Safe Implementation Strategy:**

```typescript
// Step 1: Add validation BEFORE changing insert logic
const validLOs = learningObjectives.filter(lo =>
  lo.text && lo.text.trim().length > 0 &&
  lo.core_concept && lo.core_concept.trim().length > 0
);

const invalidCount = learningObjectives.length - validLOs.length;
if (invalidCount > 0) {
  console.warn(`Filtered out ${invalidCount} invalid LOs`);
}

// Step 2: Keep OLD code as fallback
const USE_BATCH_INSERT = true;  // Feature flag

if (USE_BATCH_INSERT) {
  // New batch insert
  const { data, error } = await supabase
    .from("learning_objectives")
    .insert(validLOs)
    .select();

  if (error) {
    console.error("Batch insert failed, trying individual inserts");
    // Fallback to old method
    for (const lo of validLOs) {
      await supabase.from("learning_objectives").insert(lo);
    }
  }
} else {
  // Old individual inserts
  for (const lo of validLOs) {
    await supabase.from("learning_objectives").insert(lo);
  }
}
```

**Testing Matrix:**

| Test Case | Expected Result | ✓ |
|-----------|-----------------|---|
| Valid syllabus (10 LOs) | All 10 created | |
| Valid syllabus (50 LOs) | All 50 created | |
| Syllabus with 1 invalid LO | 49 created, 1 filtered | |
| Empty syllabus | Graceful error | |
| Duplicate LOs | Handled correctly | |

**Verification Checklist:**
- [ ] All test cases pass
- [ ] Upload time reduced from 4s to <1s
- [ ] No orphaned modules
- [ ] sequence_order is correct

---

### 3.2 Consolidate TooltipProviders

**Risk:** If parent doesn't have TooltipProvider, all tooltips break.

**Safe Implementation Strategy:**

```typescript
// Step 1: Add TooltipProvider to App.tsx (covers everything)
// src/App.tsx
import { TooltipProvider } from '@/components/ui/tooltip';

function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}

// Step 2: VERIFY all tooltips still work BEFORE removing inner providers
// Check every page that uses UnifiedLOCard

// Step 3: Remove inner TooltipProviders ONE FILE AT A TIME
// Start with UnifiedLOCard.tsx

// Step 4: Test after each removal
```

**Verification Checklist:**
- [ ] Bloom level tooltip works
- [ ] Duration tooltip works
- [ ] AI concern tooltip works
- [ ] All 9 tooltip locations verified
- [ ] No console errors

---

## Step 4: High-Risk Changes (Day 8-14)

These require careful planning and thorough testing.

### 4.1 Batch Module + LO Inserts

**Risk:** Module-LO relationships could break.

**Safe Implementation Strategy:**

```typescript
// Step 1: Create comprehensive test data
const testCases = [
  { name: "Normal syllabus", modules: 5, losPerModule: 4 },
  { name: "Large syllabus", modules: 20, losPerModule: 10 },
  { name: "Duplicate titles", modules: 3, duplicateTitles: true },
  { name: "Empty modules", modules: 3, emptyModules: [1] },
];

// Step 2: Run each test case
for (const testCase of testCases) {
  const syllabus = generateTestSyllabus(testCase);
  const result = await processSyllabus(syllabus);

  // Verify relationships
  for (let i = 0; i < testCase.modules; i++) {
    const module = result.modules[i];
    const los = await getLOsByModule(module.id);

    // Check count
    expect(los.length).toBe(testCase.losPerModule);

    // Check sequence order
    expect(los.every((lo, idx) => lo.sequence_order === idx + 1)).toBe(true);

    // Check foreign key
    expect(los.every(lo => lo.module_id === module.id)).toBe(true);
  }
}

// Step 3: A/B test in production
// 10% of users get new code, 90% get old code
// Monitor for errors
```

**Verification Checklist:**
- [ ] All test cases pass
- [ ] Module order preserved
- [ ] LO sequence_order correct
- [ ] No orphaned LOs
- [ ] Performance improved 10×+

---

### 4.2 RLS Policy Optimization

**Risk:** Could break student access to courses.

**Safe Implementation Strategy:**

```sql
-- Step 1: Add new column WITHOUT changing policy
ALTER TABLE learning_objectives
ADD COLUMN IF NOT EXISTS accessible_student_ids UUID[] DEFAULT '{}';

-- Step 2: Create trigger to populate (runs in background)
CREATE OR REPLACE FUNCTION update_lo_accessible_students()
RETURNS TRIGGER AS $$
BEGIN
  -- Update logic here
END;
$$ LANGUAGE plpgsql;

-- Step 3: Backfill existing data (async, doesn't affect live queries)
UPDATE learning_objectives lo
SET accessible_student_ids = (
  SELECT COALESCE(array_agg(ce.student_id), '{}')
  FROM course_enrollments ce
  WHERE ce.instructor_course_id = lo.instructor_course_id
);

-- Step 4: Create NEW policy alongside OLD (both work)
CREATE POLICY "Students can view LOs - optimized"
ON learning_objectives
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR auth.uid() = ANY(accessible_student_ids)
);

-- Step 5: Test with specific users
-- Verify they can still access their courses

-- Step 6: Drop old policy ONLY after confirming new one works
DROP POLICY IF EXISTS "Students can view LOs from enrolled courses" ON learning_objectives;
```

**Verification Checklist:**
- [ ] Enrolled students can access LOs
- [ ] Non-enrolled students cannot
- [ ] Newly enrolled students get immediate access
- [ ] Unenrolled students lose access
- [ ] Query performance improved

---

## Step 5: Architecture Changes (Week 3+)

### 5.1 Implement Rate Limiting

**Safe Implementation:**

```typescript
// Step 1: Implement rate limiter but DON'T enforce (logging only)
const { allowed, remaining } = await checkRateLimit(userId, functionName);
if (!allowed) {
  console.warn(`Rate limit would block user ${userId}`);
  // Don't actually block yet
}

// Step 2: Monitor logs for 1 week
// - How many users would be blocked?
// - Are limits reasonable?

// Step 3: Adjust limits based on data

// Step 4: Enable enforcement with generous limits
if (!allowed) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
}

// Step 5: Gradually tighten limits
```

---

### 5.2 Add Pagination

**Safe Implementation:**

```typescript
// Step 1: Create NEW paginated hooks alongside old ones
export function useCoursesPaginated(page: number) { ... }

// Step 2: Keep old hook working
export function useCourses() { ... }  // Unchanged

// Step 3: Migrate ONE component to paginated version
// Test thoroughly

// Step 4: Migrate remaining components one by one

// Step 5: Deprecate old hook (add console.warn)
export function useCourses() {
  console.warn('useCourses is deprecated, use useCoursesPaginated');
  return useQuery(...);
}

// Step 6: Remove old hook after all migrations complete
```

---

## Monitoring & Alerting

### Set Up Dashboards

```typescript
// Add to each Edge Function
const startTime = Date.now();

// ... function logic ...

const duration = Date.now() - startTime;

// Log metrics
console.log(JSON.stringify({
  function: 'process-syllabus',
  duration_ms: duration,
  user_id: user.id,
  success: !error,
  timestamp: new Date().toISOString(),
}));

// Store metrics for trending
await supabase.from('performance_metrics').insert({
  function_name: 'process-syllabus',
  duration_ms: duration,
  success: !error,
});
```

### Alert Thresholds

| Metric | Normal | Warning | Critical | Action |
|--------|--------|---------|----------|--------|
| Query time | <100ms | >1s | >5s | Check indexes |
| Edge function | <5s | >15s | >25s | Check N+1 |
| Error rate | <1% | >3% | >5% | Rollback |
| Connection pool | <50% | >70% | >90% | Scale/optimize |

---

## Rollback Procedures

### Quick Rollback (< 5 minutes)

```bash
# Edge Functions
supabase functions deploy <function-name> --version <previous>

# Frontend
git revert HEAD
git push origin main
# CI/CD will deploy previous version
```

### Database Rollback

```sql
-- Indexes (safe to drop)
DROP INDEX IF EXISTS idx_capabilities_user_id;

-- Columns (if added)
ALTER TABLE learning_objectives DROP COLUMN IF EXISTS accessible_student_ids;

-- Policies (revert to old)
DROP POLICY IF EXISTS "Students can view LOs - optimized" ON learning_objectives;
CREATE POLICY "Students can view LOs from enrolled courses" ON learning_objectives ...;
```

---

## Success Criteria

After ALL optimizations, verify:

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| Syllabus processing | 4s | <1s | |
| Dashboard load | 10s | <1s | |
| Search response | 200ms | <50ms | |
| API calls/hour | 50K | <5K | |
| Connection pool usage | 90% | <30% | |
| Memory usage | 150MB+ | <50MB | |
| Error rate | 5% | <1% | |

---

## Daily Checklist

```markdown
## Day N Deployment Checklist

### Before Deploying
- [ ] Baseline metrics recorded
- [ ] All tests passing locally
- [ ] Feature flag ready (if applicable)
- [ ] Rollback procedure documented

### After Deploying
- [ ] Smoke tests passing
- [ ] Error rates normal
- [ ] Response times improved (or same)
- [ ] No user complaints

### Sign-off
- [ ] Metrics better than before
- [ ] Ready for next step
```

---

*Systematic Implementation Guide - January 10, 2026*
