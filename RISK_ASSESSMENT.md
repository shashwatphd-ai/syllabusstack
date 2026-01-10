# Risk Assessment: Performance Optimization Implementation

**Date:** January 10, 2026

This document analyzes the potential impact of each proposed performance fix on existing functionality and pipelines.

---

## Risk Summary

| Fix | Risk Level | Breaking Change? | Requires Testing |
|-----|------------|------------------|------------------|
| 1.1 User filter fix | **LOW** | No (Bug fix) | Basic |
| 1.2 TooltipProvider consolidation | **LOW** | No | UI verification |
| 1.3 Batch LO inserts | **MEDIUM** | Yes (Error handling) | Integration |
| 1.4 Batch module/LO inserts | **HIGH** | Yes (Pipeline) | End-to-end |
| 1.5 Map lookup optimization | **LOW** | No | Unit test |
| 2.1 Promise.all parallelization | **MEDIUM** | Possible | Integration |
| 2.2 staleTime configuration | **LOW** | No | Manual UX |
| 2.3 useMemo additions | **LOW** | No | UI verification |
| 2.4 useCallback handlers | **LOW** | No | UI verification |
| 2.5 Cache invalidation changes | **MEDIUM** | Possible | End-to-end |
| 3.1 String concatenation fix | **LOW** | No | Unit test |
| 3.2 Parallel gap analysis | **LOW** | No | Integration |
| 3.3 Single-pass counting | **LOW** | No | Unit test |

---

## Detailed Risk Analysis

### 1.1 Missing User Filter Fix (generate-recommendations)

**Risk Level:** LOW

**Current Behavior:**
```typescript
// Fetches ALL capabilities from ALL users
const { data: capabilities } = await supabase
  .from("capabilities")
  .select("name, category, proficiency_level");
```

**After Fix:**
```typescript
// Fetches only current user's capabilities
const { data: capabilities } = await supabase
  .from("capabilities")
  .select("name, category, proficiency_level")
  .eq("user_id", userId);
```

**Impact Analysis:**
- ✅ `userId` is already available at line 42
- ✅ This is a **bug fix** - current behavior is incorrect
- ✅ AI recommendations will be more accurate (based on user's actual skills)
- ⚠️ Recommendations may change slightly (previously included other users' data)

**Affected Pipelines:** None - improves correctness

**Testing Required:**
- [ ] Verify recommendations generate correctly
- [ ] Verify capabilities used match the requesting user

---

### 1.2 TooltipProvider Consolidation

**Risk Level:** LOW

**Current Behavior:** 9 separate TooltipProvider contexts per UnifiedLOCard

**After Fix:** Single TooltipProvider at parent level

**Impact Analysis:**
- ✅ Tooltips will function identically
- ✅ No API or data changes
- ⚠️ Need to ensure parent component has TooltipProvider

**Affected Pipelines:** None - UI only

**Testing Required:**
- [ ] Verify all 9 tooltip locations still work
- [ ] Test on instructor course detail page
- [ ] Verify no visual regressions

**Potential Issue:**
If `UnifiedLOCard` is rendered in a context without a parent `TooltipProvider`, tooltips will break.

**Mitigation:** Search for all usages of `UnifiedLOCard` and ensure each has a parent provider:
```bash
grep -r "UnifiedLOCard" src/ --include="*.tsx"
```

---

### 1.3 Batch LO Inserts (extract-learning-objectives)

**Risk Level:** MEDIUM

**Current Behavior:**
```typescript
for (const lo of learningObjectives) {
  const { data: savedLO, error: saveError } = await supabaseClient
    .from("learning_objectives")
    .insert(loData)
    .select()
    .single();

  if (saveError) {
    console.error("Error saving learning objective:", saveError);
    // Continues to next LO - partial success possible
  } else {
    savedLOs.push(savedLO);
  }
}
```

**After Fix:**
```typescript
const { data: savedLOs, error: saveError } = await supabaseClient
  .from("learning_objectives")
  .insert(loDataArray)
  .select();

if (saveError) {
  throw new Error("Failed to save learning objectives");
  // ALL-OR-NOTHING - no partial success
}
```

**Breaking Changes:**

| Aspect | Before | After |
|--------|--------|-------|
| Partial success | ✅ Yes (saves valid LOs) | ❌ No (all fail if one fails) |
| Error handling | Per-LO | Batch |
| Return value | Array of saved LOs | Array of saved LOs |

**Affected Pipelines:**
- Syllabus upload flow
- Quick course setup
- Any flow calling `extract-learning-objectives`

**Testing Required:**
- [ ] Test with valid syllabus - should work identically
- [ ] Test with malformed LO data - verify error handling
- [ ] Verify returned LOs have correct IDs

**Mitigation Strategy:**
```typescript
// Validate all LO data before batch insert
const validLOs = loDataArray.filter(lo =>
  lo.text && lo.text.length > 0 &&
  lo.core_concept &&
  lo.action_verb
);

if (validLOs.length !== loDataArray.length) {
  console.warn(`Filtered out ${loDataArray.length - validLOs.length} invalid LOs`);
}

const { data: savedLOs, error } = await supabaseClient
  .from("learning_objectives")
  .insert(validLOs)
  .select();
```

---

### 1.4 Batch Module/LO Inserts (process-syllabus)

**Risk Level:** HIGH

**Current Behavior:**
1. Insert module → get module.id
2. For each LO in module → insert LO with module_id
3. Repeat for each module

**After Fix:**
1. Batch insert ALL modules → get array of module IDs
2. Map module titles to IDs
3. Batch insert ALL LOs with correct module_id references

**Breaking Changes:**

| Aspect | Before | After |
|--------|--------|-------|
| Module-LO linking | Direct (insert, use ID) | Indirect (title mapping) |
| Partial success | ✅ Partial modules saved | ❌ All-or-nothing |
| Transaction safety | Per-item | Batch |

**Critical Risk:**
If module titles are not unique within a course, the title→ID mapping will overwrite and LOs may link to wrong modules.

**Affected Pipelines:**
- **Primary:** Syllabus processing (instructor flow)
- Secondary: Course creation
- Secondary: Bulk syllabus upload

**Testing Required:**
- [ ] Test complete syllabus processing end-to-end
- [ ] Verify module-LO relationships are correct
- [ ] Test with duplicate module titles
- [ ] Test with empty modules
- [ ] Test with modules containing 0 LOs
- [ ] Verify sequence_order is preserved

**Mitigation Strategy:**
```typescript
// Use sequence_order as additional key to handle duplicate titles
const moduleIdMap = new Map(
  savedModules.map((m, index) => [`${m.title}-${index}`, m.id])
);

// Or use array index matching (assumes same order)
const moduleIdMap = new Map(
  courseStructure.modules.map((m, i) => [i, savedModules[i].id])
);
```

**Recommended Approach:**
Implement as a database transaction to ensure atomicity:
```typescript
// Use Supabase RPC for transaction
const { data, error } = await supabaseClient.rpc('process_syllabus_batch', {
  p_modules: moduleDataArray,
  p_learning_objectives: loDataArray
});
```

---

### 1.5 Map Lookup Optimization

**Risk Level:** LOW

**Current Behavior:**
```typescript
const consumptionRecord = studentConsumption.find(c => c.learning_objective_id === lo.id);
```

**After Fix:**
```typescript
const consumptionRecord = consumptionMap.get(`${studentId}-${lo.id}`);
```

**Impact Analysis:**
- ✅ Produces identical results
- ✅ No API changes
- ✅ No data structure changes
- ⚠️ Map key must be consistent

**Affected Pipelines:** None - internal optimization

**Testing Required:**
- [ ] Verify instructor dashboard shows correct student progress
- [ ] Compare before/after data for same course

**Edge Case:**
If `studentId` or `lo.id` contains a hyphen, the composite key could collide. Use a different separator:
```typescript
consumptionMap.set(`${c.user_id}|${c.learning_objective_id}`, c);
```

---

### 2.1 Promise.all Parallelization (global-search)

**Risk Level:** MEDIUM

**Current Behavior:** Sequential queries, errors handled per-query

**After Fix:** Parallel queries, one failure affects all

**Breaking Changes:**

| Aspect | Before | After |
|--------|--------|-------|
| One query fails | Other results return | All results fail |
| Error message | Specific to failed query | Generic Promise.all error |

**Affected Pipelines:**
- Global search functionality
- Header search component

**Testing Required:**
- [ ] Test search with valid query
- [ ] Test search with no results
- [ ] Test behavior when one table has errors

**Mitigation Strategy:**
Use `Promise.allSettled` for graceful degradation:
```typescript
const results = await Promise.allSettled([
  supabase.from("courses")...,
  supabase.from("dream_jobs")...,
  // ...
]);

const courses = results[0].status === 'fulfilled' ? results[0].value.data : [];
const dreamJobs = results[1].status === 'fulfilled' ? results[1].value.data : [];
// ...
```

---

### 2.2 staleTime Configuration

**Risk Level:** LOW

**Impact Analysis:**
- ✅ No breaking changes
- ✅ Data will still be accurate
- ⚠️ Data may be up to 5 minutes stale
- ⚠️ Users may see brief "old" data after mutations

**User Experience Change:**
- Before: Every navigation triggers loading state
- After: Cached data shown immediately, background refresh

**Affected Pipelines:** None - caching only

**Testing Required:**
- [ ] Verify data updates after mutations
- [ ] Verify loading states work correctly
- [ ] Check that stale data doesn't cause issues

---

### 2.5 Cache Invalidation Changes

**Risk Level:** MEDIUM

**Current Behavior:**
```typescript
// Invalidates entire query families
queryClient.invalidateQueries({ queryKey: queryKeys.courses });
queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
```

**After Fix:**
```typescript
// Optimistic update + targeted invalidation
queryClient.setQueryData<Course>(queryKeys.courseDetail(id), updatedCourse);
queryClient.setQueryData<Course[]>(queryKeys.coursesList(), (old) =>
  old?.map(c => c.id === id ? updatedCourse : c)
);
```

**Breaking Changes:**

| Aspect | Before | After |
|--------|--------|-------|
| UI update timing | After refetch (~200ms) | Immediate (optimistic) |
| Data consistency | Always fresh from server | May show optimistic value |
| Error recovery | Auto (refetch shows truth) | Need manual rollback |

**Affected Pipelines:**
- Course create/update/delete
- Any component using course data

**Testing Required:**
- [ ] Create course → verify appears in list
- [ ] Update course → verify details update
- [ ] Delete course → verify removes from list
- [ ] Test mutation failure → verify rollback

**Mitigation Strategy:**
Add rollback on error:
```typescript
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.coursesList() });
  const previousCourses = queryClient.getQueryData(queryKeys.coursesList());

  // Optimistic update
  queryClient.setQueryData(queryKeys.coursesList(), (old) => ...);

  return { previousCourses };
},
onError: (err, variables, context) => {
  // Rollback on error
  queryClient.setQueryData(queryKeys.coursesList(), context.previousCourses);
},
```

---

## Pipeline Impact Summary

### Syllabus Processing Pipeline

**Components:**
1. `BulkSyllabusUploader.tsx` → calls `parse-syllabus-document`
2. `parse-syllabus-document` → extracts text
3. `process-syllabus` → creates modules + LOs (HIGH RISK)
4. `extract-learning-objectives` → creates standalone LOs (MEDIUM RISK)

**Recommendation:**
- Test end-to-end syllabus upload with 3+ different syllabi
- Verify module-LO relationships in database
- Test error scenarios (malformed files, partial failures)

### Gap Analysis Pipeline

**Components:**
1. `useCourses.ts` → triggers `refreshAllGapAnalyses`
2. `gap-analysis` function → analyzes skills
3. `generate-recommendations` → creates recommendations (LOW RISK - fix only)

**Recommendation:**
- Test that recommendations use correct user's capabilities
- Verify gap analysis runs correctly after course changes

### Instructor Dashboard Pipeline

**Components:**
1. `useCourseStudents` → fetches student progress (LOW RISK)
2. `UnifiedLOCard` → displays LO details (LOW RISK)

**Recommendation:**
- Verify student progress displays correctly
- Test with courses having 50+ students, 100+ LOs

---

## Recommended Implementation Order

Based on risk analysis, implement in this order:

### Phase 1: Low-Risk Quick Wins
1. ✅ User filter fix (1.1) - Bug fix, no risk
2. ✅ staleTime configuration (2.2) - No breaking changes
3. ✅ useMemo/useCallback (2.3, 2.4) - No breaking changes
4. ✅ String concatenation fix (3.1) - No breaking changes
5. ✅ Single-pass counting (3.3) - No breaking changes

### Phase 2: Medium-Risk with Testing
6. ⚠️ Map lookup optimization (1.5) - Test dashboard
7. ⚠️ TooltipProvider consolidation (1.2) - Test all tooltips
8. ⚠️ Promise.allSettled for search (2.1) - Test search

### Phase 3: High-Risk with Thorough Testing
9. ⚠️ Batch LO inserts (1.3) - Integration test required
10. ⚠️ Cache invalidation changes (2.5) - E2E test required
11. ⚠️ Batch module/LO inserts (1.4) - Full pipeline test required

---

## Testing Checklist

### Before Deployment

- [ ] Unit tests pass
- [ ] Manual test: Create new course via syllabus upload
- [ ] Manual test: Verify modules have correct LOs
- [ ] Manual test: Check instructor dashboard student progress
- [ ] Manual test: Verify tooltips work on LO cards
- [ ] Manual test: Search functionality works
- [ ] Manual test: Gap analysis generates correctly
- [ ] Manual test: Recommendations use correct user data

### After Deployment

- [ ] Monitor error logs for new errors
- [ ] Check database for orphaned LOs (no module_id when expected)
- [ ] Verify no performance regression in Supabase dashboard
- [ ] User feedback on any issues

---

## Rollback Plan

If issues occur after deployment:

1. **Edge Functions:** Redeploy previous version
   ```bash
   supabase functions deploy <function-name> --version <previous>
   ```

2. **Frontend:** Revert commit and redeploy
   ```bash
   git revert HEAD
   git push
   ```

3. **Database:** No schema changes, no rollback needed

---

*Risk assessment completed January 10, 2026*
