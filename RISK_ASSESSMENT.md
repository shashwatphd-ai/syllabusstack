# Risk Assessment: Performance Optimization Implementation

**Date:** January 10, 2026
**Scale Target:** 100,000 users

This document analyzes the potential impact of each proposed performance fix on existing functionality and pipelines, with special consideration for production scale.

---

## Risk Summary

| Fix | Risk Level | Breaking Change? | Scale Impact | Testing Required |
|-----|------------|------------------|--------------|------------------|
| 1.1 User filter fix | **LOW** | No (Bug fix) | Critical | Basic |
| 1.2 Database indexes | **LOW** | No | Critical | Query verification |
| 1.3 RLS optimization | **MEDIUM** | Schema change | Critical | Integration |
| 1.4 Batch LO inserts | **MEDIUM** | Error handling | High | Integration |
| 1.5 Batch module/LO inserts | **HIGH** | Pipeline | High | End-to-end |
| 1.6 Map lookup optimization | **LOW** | No | High | Unit test |
| 2.1 staleTime configuration | **LOW** | No | High | Manual UX |
| 2.2 Rate limiting | **MEDIUM** | New feature | Critical | Load test |
| 2.3 Promise.all search | **MEDIUM** | Error handling | Medium | Integration |
| 2.4 Pagination | **HIGH** | API change | Critical | End-to-end |
| 3.1 TooltipProvider | **LOW** | No | Medium | UI verification |
| 3.2 useMemo/useCallback | **LOW** | No | Medium | UI verification |
| 4.1 Background jobs | **HIGH** | Architecture | Critical | Full system |
| 4.2 WebSocket | **MEDIUM** | Architecture | High | Integration |

---

## Detailed Risk Analysis

### 1.1 Missing User Filter Fix

**Risk Level:** LOW
**Scale Necessity:** CRITICAL (app will crash without this at scale)

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

**Scale Impact Analysis:**

| Users | Rows Fetched (Before) | Rows Fetched (After) | Memory Impact |
|-------|----------------------|---------------------|---------------|
| 1K | 20,000 | 20 | Slow |
| 10K | 200,000 | 20 | Very slow |
| 100K | 2,000,000 | 20 | **CRASH** (150MB Deno limit) |

**Breaking Changes:** None - this is a bug fix that improves correctness.

**Affected Pipelines:** None negatively - recommendations will be MORE accurate.

**Testing Required:**
- [ ] Verify recommendations generate with correct user data
- [ ] Load test with 100 concurrent requests

---

### 1.2 Database Indexes

**Risk Level:** LOW
**Scale Necessity:** CRITICAL (10-100× slower queries without indexes)

**Impact Analysis:**
- ✅ No schema changes (indexes are metadata)
- ✅ No application code changes
- ✅ Queries automatically use new indexes
- ⚠️ Index creation takes time on large tables (use CONCURRENTLY)
- ⚠️ Slight increase in write latency (minimal)

**Scale Impact:**

| Table | Rows at 100K | Without Index | With Index |
|-------|-------------|---------------|------------|
| capabilities | 2M | 5-10s | 10-50ms |
| learning_objectives | 5M | 10-30s | 20-100ms |
| consumption_records | 10M | 20-60s | 30-150ms |
| recommendations | 5M | 10-30s | 20-100ms |

**Testing Required:**
- [ ] Run EXPLAIN ANALYZE on key queries
- [ ] Verify "Index Scan" instead of "Seq Scan"
- [ ] Monitor query times in production

---

### 1.3 RLS Policy Optimization

**Risk Level:** MEDIUM
**Scale Necessity:** CRITICAL (subqueries kill performance at scale)

**Current Behavior:**
```sql
-- Subquery runs for EVERY row checked
CREATE POLICY "Students can view LOs from enrolled courses"
ON learning_objectives
FOR SELECT
USING (
  instructor_course_id IN (
    SELECT instructor_course_id FROM course_enrollments
    WHERE student_id = auth.uid()
  )
);
```

**After Fix:**
```sql
-- Array contains check with GIN index - O(1)
CREATE POLICY "Students can view LOs - optimized"
ON learning_objectives
FOR SELECT
USING (
  user_id = auth.uid()
  OR auth.uid() = ANY(accessible_student_ids)
);
```

**Breaking Changes:**

| Aspect | Before | After | Risk |
|--------|--------|-------|------|
| Schema | No extra column | New `accessible_student_ids` column | LOW |
| Enrollment trigger | None | Auto-update trigger | LOW |
| Data sync | Always current | Requires trigger | MEDIUM |

**Critical Risk:**
If the trigger fails or has a bug, student access may be incorrect.

**Mitigation:**
```sql
-- Add fallback check in case array is out of sync
CREATE POLICY "Students can view LOs - with fallback"
ON learning_objectives
FOR SELECT
USING (
  user_id = auth.uid()
  OR auth.uid() = ANY(accessible_student_ids)
  OR instructor_course_id IN (
    SELECT instructor_course_id FROM course_enrollments
    WHERE student_id = auth.uid()
  )
);
```

**Testing Required:**
- [ ] Enroll student → verify immediate access
- [ ] Unenroll student → verify access revoked
- [ ] Bulk enrollment → verify all students get access
- [ ] Load test RLS with 1000 concurrent queries

---

### 1.4 Batch LO Inserts

**Risk Level:** MEDIUM
**Scale Necessity:** HIGH (connection pool exhaustion at scale)

**Current Behavior:**
```typescript
for (const lo of learningObjectives) {
  const { data, error } = await supabase.insert(lo).single();
  if (error) {
    console.error(error);
    // Continues - partial success possible
  }
}
```

**After Fix:**
```typescript
const { data, error } = await supabase.insert(loArray).select();
if (error) {
  throw new Error("All failed");
  // ALL-OR-NOTHING
}
```

**Breaking Changes:**

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| Partial success | ✅ Saves valid LOs | ❌ All fail if one fails | MEDIUM |
| Error granularity | Per-LO errors | Single error | LOW |
| Connection usage | N connections | 1 connection | POSITIVE |

**Scale Impact:**

| Concurrent Uploads | Connections (Before) | Connections (After) |
|-------------------|---------------------|---------------------|
| 10 | 150 | 10 |
| 50 | 750 | 50 |
| 100 | 1,500 | 100 |

Without fix at 100 concurrent: **Pool exhausted, requests fail.**

**Mitigation:**
```typescript
// Validate before insert
const validLOs = loArray.filter(lo => lo.text && lo.core_concept);
if (validLOs.length !== loArray.length) {
  console.warn(`Filtered ${loArray.length - validLOs.length} invalid LOs`);
}
// Insert only valid LOs
```

**Testing Required:**
- [ ] Upload valid syllabus → verify all LOs created
- [ ] Upload with invalid LO → verify handled gracefully
- [ ] Concurrent upload test (50 simultaneous)

---

### 1.5 Batch Module/LO Inserts

**Risk Level:** HIGH
**Scale Necessity:** HIGH (critical path for course creation)

**Critical Risks:**

1. **Module-LO Relationship Integrity**
   - Before: Insert module → get ID → insert LOs with that ID
   - After: Insert all modules → map titles to IDs → insert LOs
   - Risk: If module titles are duplicated, mapping fails

2. **Sequence Order Preservation**
   - Before: Sequential insertion maintains order
   - After: Batch return order may differ
   - Risk: Modules/LOs could be out of order

3. **Transaction Atomicity**
   - Before: Partial failure leaves some data
   - After: All-or-nothing

**Mitigation Strategy:**
```typescript
// Use sequence index instead of title for mapping
const moduleIdByIndex = new Map<number, string>();
savedModules.forEach((m, idx) => {
  moduleIdByIndex.set(idx, m.id);
});

// Match by original array index, not title
courseStructure.modules.forEach((module, idx) => {
  const moduleId = moduleIdByIndex.get(idx);
  // ...
});
```

**Testing Required:**
- [ ] Upload syllabus with unique module titles ✓
- [ ] Upload syllabus with DUPLICATE module titles
- [ ] Upload syllabus with 0 LOs in a module
- [ ] Verify sequence_order is correct in database
- [ ] Verify all module-LO relationships are correct
- [ ] Performance test: 20 modules × 50 LOs

---

### 2.2 Rate Limiting

**Risk Level:** MEDIUM
**Scale Necessity:** CRITICAL (cost protection)

**New User-Facing Behavior:**
- Users will see "Rate limit exceeded" errors
- This is intentional and necessary

**Breaking Changes:**

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| API calls | Unlimited | 5-10/minute | User-facing |
| Error handling | None | 429 responses | Needs UI handling |
| Cost | Unbounded | Controlled | POSITIVE |

**Scale Impact:**

| Scenario | Without Rate Limit | With Rate Limit |
|----------|-------------------|-----------------|
| Normal user | Works | Works |
| Power user | Works | May hit limits |
| Malicious actor | $10K+/month AI costs | Blocked |
| Accidental loop | Bankrupt | Safe |

**Testing Required:**
- [ ] Verify normal usage doesn't hit limits
- [ ] Verify rate limit response format
- [ ] Verify UI handles 429 gracefully
- [ ] Test limit reset timing

---

### 2.4 Pagination

**Risk Level:** HIGH
**Scale Necessity:** CRITICAL (mobile unusable without this)

**Breaking Changes:**

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| Response format | `Course[]` | `PaginatedResult<Course>` | API CHANGE |
| Component props | Simple array | Pagination controls | UI CHANGE |
| Infinite scroll | Not available | Available | NEW FEATURE |

**Migration Path:**
1. Add new paginated hooks alongside existing ones
2. Migrate components one by one
3. Deprecate old hooks
4. Remove old hooks after migration

**Testing Required:**
- [ ] Page 1 returns correct data
- [ ] Page navigation works
- [ ] Infinite scroll loads more
- [ ] Total count is accurate
- [ ] Empty state handled
- [ ] Mobile performance improved

---

### 4.1 Background Job Queue

**Risk Level:** HIGH
**Scale Necessity:** CRITICAL for UX (30s spinner is unacceptable)

**Architecture Change:**

```
BEFORE:
User → Edge Function → [30 seconds] → Response

AFTER:
User → Edge Function → Queue Job → Response (instant)
                              ↓
                       [Background Worker]
                              ↓
                       User polls for status
```

**Breaking Changes:**

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| Response time | 5-30s | <1s | POSITIVE |
| Response format | Final result | Job ID | API CHANGE |
| Error handling | Immediate | Async | UX CHANGE |
| UI flow | Wait for result | Poll for status | UI CHANGE |

**Testing Required:**
- [ ] Job queuing works
- [ ] Worker processes jobs
- [ ] Status polling works
- [ ] Error jobs handled
- [ ] Retry logic works
- [ ] UI shows progress correctly

---

## Scale-Specific Risks

### Connection Pool Exhaustion

**Current Risk:** At 100+ concurrent syllabus uploads, the database connection pool will be exhausted.

| Supabase Plan | Connection Limit | Risk Threshold |
|---------------|-----------------|----------------|
| Free | 60 | 4 concurrent uploads |
| Pro | 100-500 | 7-33 concurrent uploads |

**Mitigation:** Batch inserts reduce connections by 90%.

### Memory Limits

**Deno Edge Function Limit:** 150MB

| Operation | Memory at 100K users | Risk |
|-----------|---------------------|------|
| Fetch all capabilities | 200MB+ | CRASH |
| Fetch user's capabilities | <1MB | Safe |

**Mitigation:** User filter fix is mandatory.

### Supabase Billing

| Resource | Without Optimization | With Optimization |
|----------|---------------------|-------------------|
| API requests | 50K/hour | 5K/hour |
| Bandwidth | 500GB/month | 50GB/month |
| Database CPU | 100% | 20% |

---

## Pipeline Impact Summary

### Syllabus Processing Pipeline

**Risk Level:** HIGH

**Components Affected:**
1. `BulkSyllabusUploader.tsx` - UI changes for async
2. `parse-syllabus-document` - Rate limiting added
3. `process-syllabus` - Batch inserts (HIGH RISK)
4. `extract-learning-objectives` - Batch inserts (MEDIUM RISK)

**Testing Checklist:**
- [ ] Upload single syllabus → all modules/LOs created correctly
- [ ] Upload duplicate module titles → handled correctly
- [ ] Upload very large syllabus (50+ LOs) → completes without timeout
- [ ] Concurrent uploads (10 simultaneous) → no errors
- [ ] Rate limit hit → user sees friendly message

### Gap Analysis Pipeline

**Risk Level:** LOW

**Components Affected:**
1. `useCourses.ts` - staleTime, cache invalidation
2. `gap-analysis` - Rate limiting
3. `generate-recommendations` - User filter fix (CRITICAL)

**Testing Checklist:**
- [ ] Recommendations use only current user's data
- [ ] Gap analysis completes correctly
- [ ] Rate limit protects AI costs

### Instructor Dashboard Pipeline

**Risk Level:** MEDIUM

**Components Affected:**
1. `useCourseStudents` - Map lookup optimization
2. `UnifiedLOCard` - TooltipProvider consolidation
3. RLS policies - Optimized for scale

**Testing Checklist:**
- [ ] Dashboard loads with 50+ students in <1 second
- [ ] Student progress data is accurate
- [ ] All tooltips work after consolidation

---

## Recommended Implementation Order (Risk-Based)

### Week 1: Critical + Low Risk
1. ✅ User filter fix (LOW risk, CRITICAL necessity)
2. ✅ Database indexes (LOW risk, CRITICAL necessity)
3. ✅ staleTime configuration (LOW risk, HIGH benefit)
4. ✅ Map lookup optimization (LOW risk, HIGH benefit)
5. ✅ useMemo/useCallback (LOW risk, MEDIUM benefit)

### Week 2: Medium Risk with Testing
6. ⚠️ Batch LO inserts (MEDIUM risk) - Test thoroughly
7. ⚠️ TooltipProvider consolidation (LOW risk) - Verify all locations
8. ⚠️ Promise.allSettled for search (MEDIUM risk) - Error handling

### Week 3: High Risk with Full Testing
9. ⚠️ RLS optimization (MEDIUM risk) - Verify access control
10. ⚠️ Rate limiting (MEDIUM risk) - Test user experience
11. ⚠️ Batch module/LO inserts (HIGH risk) - Full pipeline test

### Week 4+: Architecture Changes
12. ⚠️ Pagination (HIGH risk) - API change
13. ⚠️ Background jobs (HIGH risk) - Full system change
14. ⚠️ WebSocket (MEDIUM risk) - New infrastructure

---

## Testing Checklist by Scale

### Before 10K Users
- [ ] User filter verified
- [ ] All indexes created
- [ ] Basic load test (50 concurrent users)
- [ ] Batch inserts working
- [ ] No query timeouts

### Before 50K Users
- [ ] RLS policies optimized
- [ ] Rate limiting active
- [ ] staleTime configured
- [ ] Load test (500 concurrent users)
- [ ] Monitor connection pool usage

### Before 100K Users
- [ ] Pagination implemented
- [ ] Background jobs working
- [ ] WebSocket for real-time
- [ ] Load test (5000 concurrent users)
- [ ] Disaster recovery plan

---

## Rollback Plan

### Edge Functions
```bash
# Deploy previous version
supabase functions deploy <function-name> --version <previous>
```

### Database Indexes
```sql
-- Indexes can be dropped without data loss
DROP INDEX IF EXISTS idx_capabilities_user_id;
```

### RLS Policies
```sql
-- Revert to original policy
DROP POLICY IF EXISTS "Students can view LOs - optimized" ON learning_objectives;
-- Recreate original policy
CREATE POLICY "Students can view LOs from enrolled courses" ...
```

### Frontend
```bash
# Revert commit and redeploy
git revert HEAD
git push
```

---

## Monitoring Alerts

Set up alerts for:

| Metric | Warning | Critical |
|--------|---------|----------|
| Query time | >1s | >5s |
| Connection pool | 70% | 90% |
| Edge function timeout | Any | >3/hour |
| 429 rate limit responses | >100/hour | >1000/hour |
| Error rate | >1% | >5% |

---

*Risk assessment updated for 100K user scale on January 10, 2026*
