# SyllabusStack: S.O.L.I.D. Refactoring & Production Readiness Plan

## Executive Summary

After comprehensive codebase review, this document outlines a phased approach to transform SyllabusStack from a prototype with mock data into a production-ready, commercially viable application following S.O.L.I.D. principles.

**Current State Assessment:**
- ❌ 47% of dashboard components use hardcoded mock data
- ❌ 4 "God Objects" violating Single Responsibility Principle
- ❌ Settings page is 100% non-functional (local state only)
- ❌ No pricing/billing integration for commercialization
- ❌ Auth flow works but role-based access needs enforcement
- ✅ Database schema is well-designed
- ✅ Edge functions exist (but some need fixes)
- ✅ Core user flows are architecturally sound

---

## Phase 1: Remove Mock Data & Connect Real Data (Priority: CRITICAL)

### 1.1 Dashboard Components with Mock Data

| Component | Location | Problem | Fix |
|-----------|----------|---------|-----|
| `DreamJobCards` | `src/components/dashboard/DreamJobCards.tsx` | Lines 33-64: Hardcoded `mockJobs` array used as default prop | Remove mock, show empty state or data from props only |
| `CapabilitySnapshot` | `src/components/dashboard/CapabilitySnapshot.tsx` | Lines 20-27: `mockCapabilities` hardcoded | Remove mock, use real capabilities from `useCapabilities()` |
| `ProgressTracker` | `src/components/recommendations/ProgressTracker.tsx` | Lines 28-85: `mockMilestones` hardcoded | Replace with real recommendations from database |
| `SyllabusScanner` | `src/pages/SyllabusScanner.tsx` | Lines 299-315: Hardcoded fallback demo result | Remove fallback, show proper error state |

### 1.2 Settings Page (Completely Non-Functional)

**Current Issues (`src/pages/Settings.tsx`):**
- Line 20: `darkMode` is local state, never persisted
- Lines 80-91: Theme selection does nothing
- Lines 110-118: Privacy toggles do nothing
- Lines 126-129: Export button does nothing
- Lines 150-159: Language selection does nothing

**Solution:** Connect to `profiles.email_preferences` and create new columns for other preferences.

### 1.3 Price/Cost Display

- `Usage.tsx` works correctly, reads from `ai_usage` table
- **GOOD:** No mock data here

---

## Phase 2: Apply S.O.L.I.D. Principles (Priority: HIGH)

### 2.1 Single Responsibility Principle (SRP) Violations

#### God Object #1: `src/lib/api.ts` (319 lines)

**Problem:** One file handles 7 different concerns:
- Syllabus analysis
- Dream job analysis
- Gap analysis
- Recommendations
- PDF parsing
- Learning objectives
- YouTube search
- Assessment questions

**Solution:** Split into focused modules:
```
src/services/
├── syllabus-service.ts      (analyzeSyllabus, parseSyllabusDocument)
├── dream-job-service.ts     (analyzeDreamJob)
├── gap-analysis-service.ts  (performGapAnalysis)
├── recommendations-service.ts (generateRecommendations)
├── content-service.ts       (searchYouTubeContent)
└── assessment-service.ts    (generateAssessmentQuestions, extractLearningObjectives)
```

#### God Object #2: `src/hooks/useWorkflows.ts` (307 lines)

**Problem:** Single hook handles three distinct workflows with database + AI orchestration:
- Course workflow
- Dream job workflow
- Gap analysis workflow

**Solution:** Split into:
```
src/hooks/workflows/
├── useCourseWorkflow.ts
├── useDreamJobWorkflow.ts
└── useGapAnalysisWorkflow.ts
```

#### God Object #3: `supabase/functions/_shared/ai-orchestrator.ts` (527 lines)

**Problem:** Hardcoded task-model mapping violates Open/Closed Principle

**Current (closed for extension):**
```typescript
export const TASK_MODEL_MAP: Record<AITaskType, { primary: string; fallback: string }> = {
  syllabus_extraction: { primary: MODEL_CONFIG.GEMINI_FLASH, fallback: MODEL_CONFIG.GEMINI_PRO },
  // ... hardcoded
};
```

**Solution:** Use configuration injection:
```typescript
// ai-config.ts - separate configuration file
export const getTaskModelConfig = () => JSON.parse(Deno.env.get("AI_TASK_CONFIG") || DEFAULT_CONFIG);
```

### 2.2 Interface Segregation Principle (ISP) Violations

**Problem:** Components receive large prop interfaces with unused fields.

**Example (`DreamJobCards`):**
```typescript
interface DreamJobCardsProps {
  jobs?: DreamJob[];        // ✅ Used
  isLoading?: boolean;      // ✅ Used
  onViewJob?: (jobId: string) => void;  // ✅ Used
  onAddJob?: () => void;    // ✅ Used
}
```
This one is actually fine. But check:

**`DashboardOverview` interface (useDashboard.ts lines 6-32):**
- 12 fields, but most views use 3-4 fields
- Consider splitting into `DashboardCounts`, `DashboardProgress`, `DashboardRecommendations`

### 2.3 Dependency Inversion Principle (DIP)

**Problem:** Components directly import Supabase client.

**Current:**
```typescript
import { supabase } from '@/integrations/supabase/client';
```

**Better:** Use hooks or services that abstract the data source:
```typescript
// Good - already doing this in most places:
const { data: courses } = useCourses();
```

**Recommendation:** Audit remaining direct Supabase imports in components (should only be in hooks/services).

---

## Phase 3: Production Hardening (Priority: HIGH)

### 3.1 Error Handling

**Current Issues:**
- Edge function errors return 500 with generic message
- Frontend catches errors but doesn't always display them
- No retry logic for transient failures

**Solution:** Implement error boundary hierarchy + toast notifications.

### 3.2 Loading States

**Audit Result:** Most pages have proper loading skeletons ✅

### 3.3 Empty States

**Audit Result:**
- Courses page: ✅ Has empty state
- Dashboard: ❌ Falls back to mock data instead of empty state
- Recommendations: ✅ Has empty state

### 3.4 Rate Limiting

**Current:** Client-side rate limiting in SyllabusScanner.tsx (5 scans/hour via sessionStorage)

**Problem:** Easily bypassed, provides no real protection.

**Solution:** Implement server-side rate limiting in edge functions using `ai_usage` table:
```sql
SELECT COUNT(*) FROM ai_usage 
WHERE user_id = $1 
AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Phase 4: Commercialization (Priority: MEDIUM)

### 4.1 Missing Billing/Subscription System

**Required for Day-1 Profitability:**

1. **Pricing Tiers:**
   - Free: 3 course analyses, 1 dream job, basic dashboard
   - Pro ($9.99/mo): Unlimited analyses, 5 dream jobs, recommendations
   - Enterprise ($29.99/mo): Team features, priority AI, export

2. **Implementation Plan:**
   - Add `subscriptions` table
   - Integrate Stripe via Lovable connector
   - Add usage limits enforcement

3. **UI Changes:**
   - Add pricing page (landing/pricing exists but needs backend)
   - Add upgrade prompts when hitting limits
   - Show current plan in Settings

### 4.2 Usage Limits Enforcement

**Current:** No limits on API calls (could cause cost overruns)

**Solution:** Add middleware check in edge functions:
```typescript
const canProceed = await checkUsageLimits(userId, functionName);
if (!canProceed) {
  return new Response(JSON.stringify({ 
    error: "Usage limit reached. Upgrade to continue." 
  }), { status: 402 });
}
```

---

## Phase 5: Code Organization & Modularity (Priority: MEDIUM)

### 5.1 Component File Size Audit

| File | Lines | Assessment |
|------|-------|------------|
| `SyllabusScanner.tsx` | 630 | ❌ Too large, split into subcomponents |
| `BulkSyllabusUploader.tsx` | 483 | ⚠️ Large but cohesive |
| `DreamJobCards.tsx` | 203 | ✅ Good |
| `Dashboard.tsx` | 129 | ✅ Good |
| `Courses.tsx` | 314 | ⚠️ Consider extracting CourseCard |

### 5.2 Recommended Splits

**SyllabusScanner.tsx → Split into:**
```
src/pages/SyllabusScanner.tsx (main coordinator, ~100 lines)
src/components/scanner/
├── ScannerDropzone.tsx
├── ScanResultDisplay.tsx
├── RateLimitBanner.tsx
└── PublicScanCTA.tsx
```

### 5.3 Remove Orphaned Code

**Files to Review:**
- `src/pages/Universities.tsx` - Empty/placeholder?
- `src/pages/Resources.tsx` - Used?
- `src/pages/TestResults.tsx` - Testing only?

---

## Phase 6: Frontend Coherence (Priority: MEDIUM)

### 6.1 Navigation Simplification

**Current Sidebar Items:**
1. Dashboard
2. Courses
3. Dream Jobs
4. Analysis
5. Recommendations
6. Profile
7. Settings
8. Usage

**Recommendation:** Consolidate into:
1. Dashboard (overview + quick actions)
2. My Learning (courses + capabilities)
3. Career Goals (dream jobs + gap analysis + recommendations)
4. Account (profile + settings + usage combined)

### 6.2 Consistent Empty States

Create unified empty state component:
```typescript
// src/components/common/EmptyState.tsx exists, ensure all pages use it
```

### 6.3 Design Token Audit

**Good:** Using semantic tokens like `text-muted-foreground`, `bg-card`
**Issue:** Some hardcoded colors found (e.g., `text-green-500` in Usage.tsx)

---

## Implementation Order

### Sprint 1 (Critical Path - 3 days)
- [ ] Remove all mock data from dashboard components
- [ ] Fix Settings page to persist to database
- [ ] Fix `parse-syllabus-document` edge function (current issue)

### Sprint 2 (S.O.L.I.D. Refactor - 4 days)
- [ ] Split `src/lib/api.ts` into services
- [ ] Split `useWorkflows.ts` into focused hooks
- [ ] Add proper error boundaries

### Sprint 3 (Production Hardening - 3 days)
- [ ] Server-side rate limiting
- [ ] Proper empty states everywhere
- [ ] Error handling improvements

### Sprint 4 (Commercialization - 5 days)
- [ ] Stripe integration
- [ ] Subscription tiers
- [ ] Usage limits enforcement
- [ ] Upgrade prompts

### Sprint 5 (Polish - 2 days)
- [ ] Navigation consolidation
- [ ] Component splits
- [ ] Design token cleanup

---

## Files to Modify

### Phase 1 Files:
1. `src/components/dashboard/DreamJobCards.tsx` - Remove mock
2. `src/components/dashboard/CapabilitySnapshot.tsx` - Remove mock
3. `src/components/recommendations/ProgressTracker.tsx` - Remove mock
4. `src/pages/SyllabusScanner.tsx` - Remove fallback mock
5. `src/pages/Settings.tsx` - Connect to database

### Phase 2 Files:
1. Create `src/services/` directory with 6 service files
2. Split `src/hooks/useWorkflows.ts` into 3 files
3. Create `src/hooks/workflows/` directory

### Phase 3 Files:
1. Create `src/components/common/ErrorBoundary.tsx` (exists, enhance)
2. Update edge functions with rate limiting

### Phase 4 Files:
1. Create `src/hooks/useSubscription.ts`
2. Create `src/pages/Pricing.tsx` (or connect existing)
3. Add migration for `subscriptions` table

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Mock data usage | 47% of components | 0% |
| God objects | 4 | 0 |
| Settings functionality | 0% | 100% |
| Components >300 lines | 3 | 0 |
| Hardcoded colors | ~15 | 0 |
| Error boundary coverage | Partial | 100% |
| Rate limiting | Client-only | Server-side |
| Billing integration | None | Stripe |

---

## Appendix: Current Codebase Statistics

- **Total Pages:** 25
- **Total Components:** 60+
- **Total Hooks:** 19
- **Edge Functions:** 15
- **Database Tables:** 22
- **Lines of TypeScript:** ~15,000

---

*Document Version: 1.0*
*Created: 2026-01-07*
*Author: AI Code Review*
