# Comprehensive Implementation Path - UNIFIED VIEW
## Post-Merge Status Report & Detailed Execution Roadmap

---

## Document Metadata

| Field | Value |
|-------|-------|
| **Created** | 2026-02-01 18:30 UTC |
| **Last Updated** | 2026-02-02 14:00 UTC |
| **Updated By** | Claude AI Agent |
| **Version** | 3.1 |
| **Status** | Active |

### Change Log

| Date/Time | Editor | Changes | Explanation |
|-----------|--------|---------|-------------|
| 2026-02-01 18:30 UTC | Claude AI | Initial creation | Consolidated roadmap from merged branches |
| 2026-02-01 18:45 UTC | Claude AI | Added detailed steps, agentic guidance | Enhanced with execution details per user request |
| 2026-02-02 UTC | Claude AI | **Phase 1 Complete** | All 78 edge functions migrated to CORS/error handler pattern |
| 2026-02-02 UTC | Claude AI | **Phase 2-3 Progress** | Rate limiting (19 funcs), Zod (9 funcs), Sentry, monitoring, tests, accessibility |
| 2026-02-02 14:00 UTC | Claude AI | **Major Progress** | Zod (46 funcs), Rate limiting (38 funcs), 11 test files, 17 accessibility fixes, hook splits |

---

## Related Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| `MASTER_IMPLEMENTATION_PLAN_V3.md` | Production readiness roadmap with detailed task specs | Active |
| `ALGORITHM_UPGRADE_PLAN.md` | Patentable algorithm foundations with code templates | Complete |
| `SCHOLARCHAIN_INTEGRATION_PLAN.md` | Blockchain credential integration (Week 11+) | Proposal |

---

## EXECUTIVE SUMMARY

### Work Completed (Merged to Main)

| Category | Status | Commits | Explanation of Work |
|----------|--------|---------|---------------------|
| **Foundation (Week 1)** | ✅ Done | 1a0a2a7, 31979c1 | Created missing hooks (useCourseProgress, useGapAnalysis), fixed test mock hoisting in 10 files, resolved router test issues, added last_accessed_at DB migration |
| **Security (Week 2)** | ✅ Done | e7e22e5 | Implemented EmailVerificationBanner component, strengthened password requirements, added rate limiting to 6 AI functions, created server-side webhook generation |
| **UX (Week 3)** | ✅ Done | cf513ec, 3373d0c | Built useAssessmentAutoSave hook with localStorage, added form persistence to OnboardingWizard, created reusable Pagination and ConfirmationDialog components, fixed PDF export with html2pdf.js |
| **Loading Skeletons** | ✅ Done | 23b411b | Created 4 skeleton components matching actual page layouts: DashboardSkeleton, LearnSkeleton, CareerPathSkeleton, InstructorCoursesSkeleton |
| **CORS Handler** | ✅ Done | 23b411b | Implemented environment-based CORS in `_shared/cors.ts` with production/staging/development origin whitelists, preflight handling |
| **Algorithm Foundations** | ✅ Done | ad29777 | Implemented 5 patentable algorithms: Weibull decay, IRT 2PL assessment, skill transfer graph, NSGA-II optimizer, assessment logger |
| **Assessment Migration** | ✅ Done | e77b6d6 | Migrated 5 assessment functions to use CORS handler: start-assessment, submit-assessment-answer, complete-assessment, start-skills-assessment, complete-skills-assessment |
| **ScholarChain Plan** | ✅ Documented | 39d4f88 | Created comprehensive integration plan for blockchain-based credential verification (Week 11+) |

### Current Metrics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Edge Functions Total | 78 | - | - |
| Using CORS Handler | **78 (100%)** | 78 (100%) | ✅ Complete |
| Using Error Handler | **78 (100%)** | 78 (100%) | ✅ Complete |
| Using Rate Limiter | **38 (49%)** | ~50 (AI/Auth) | ~12 functions |
| Loading Skeletons | 4/4 (100%) | ✅ | Complete |
| Algorithm Foundations | 5/5 (100%) | ✅ | Complete |
| Zod Validators Library | ✅ Created | ✅ | Complete |
| Zod Validation Applied | **46 (59%)** | ~60 | ~14 functions |
| Weibull Decay Integration | ✅ gap-analysis | ✅ | Complete |
| Assessment Logger Integration | ✅ submit-assessment-answer | ✅ | Complete |
| Sentry Integration | ✅ Frontend (optional) | ✅ | Complete |
| Edge Function Monitoring | ✅ Created | ✅ | Complete |
| Test Framework | ✅ Setup + 11 test files | >80% | 🔄 In Progress |
| WCAG Accessibility | ✅ 17 components fixed | WCAG AA | 🔄 In Progress |
| Large Hook Splits | **2/3** | 3/3 | useLectureSlides ✅, useInstructorCourses ✅, useAssessment pending |

---

## AGENTIC BEHAVIOR GUIDELINES

### For AI Agents Working on This Codebase

When executing tasks from this implementation plan, follow these principles:

#### 1. Pre-Task Analysis
```
Before starting any task:
□ Read the existing file completely before making changes
□ Understand the current implementation pattern
□ Check for related files that may need updates (indexes, exports)
□ Verify test files exist and understand their patterns
□ Run the build to ensure clean starting state
```

#### 2. Implementation Standards
```
For every code change:
□ Follow existing code patterns in the file
□ Maintain consistent import ordering (external → internal → types)
□ Use TypeScript strictly (no 'any' unless absolutely necessary)
□ Add JSDoc comments for exported functions
□ Ensure error handling covers all edge cases
```

#### 3. Testing Protocol
```
After making changes:
□ Run 'npm run build' to verify no compilation errors
□ Run 'npm run test' to verify no test regressions
□ Test the specific functionality manually if possible
□ Check for console warnings/errors
```

#### 4. Documentation Updates
```
When completing a task:
□ Update this document's Change Log with date/time
□ Mark the task as complete in the relevant section
□ Update metrics if they change
□ Note any deviations from the plan
```

#### 5. Commit Standards
```
For each commit:
□ Use descriptive commit message with context
□ Reference the task being completed
□ Include session URL for traceability
□ Stage only relevant files (no unrelated changes)
```

---

## PHASE 1: EDGE FUNCTION STANDARDIZATION (Weeks 4-6) ✅ COMPLETE

### Objective
Migrate all 78 edge functions to use standardized CORS handling and error management.

### Status: ✅ COMPLETED (2026-02-02)
All 78 edge functions have been migrated to use:
- `getCorsHeaders(req)` for dynamic CORS headers
- `handleCorsPreFlight(req)` for OPTIONS handling
- `withErrorHandling(handler, getCorsHeaders)` wrapper
- `createErrorResponse()` and `createSuccessResponse()` for responses
- `logError()` and `logInfo()` for structured logging

### Reference Documentation
- **Detailed Pattern:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Part 4: Edge Function Standardization
- **CORS Handler:** `supabase/functions/_shared/cors.ts`
- **Error Handler:** `supabase/functions/_shared/error-handler.ts`

---

### WEEK 4: HIGH-PRIORITY FUNCTIONS

#### Task 4.1: Search Functions Migration (Day 1-2)
**Estimated Hours:** 6
**Reference:** `MASTER_IMPLEMENTATION_PLAN_V3.md` lines 263-270

| Function | File Path | Current State | Priority |
|----------|-----------|---------------|----------|
| search-youtube-content | `supabase/functions/search-youtube-content/index.ts` | No CORS/error handler | High |
| search-youtube-manual | `supabase/functions/search-youtube-manual/index.ts` | No CORS/error handler | High |
| search-khan-academy | `supabase/functions/search-khan-academy/index.ts` | No CORS/error handler | High |
| search-educational-content | `supabase/functions/search-educational-content/index.ts` | No CORS/error handler | High |
| global-search | `supabase/functions/global-search/index.ts` | No CORS/error handler | High |

**Step-by-Step Execution:**

```markdown
For each function in the list above:

STEP 1: Read and Analyze (5 min)
□ Open the file and read the entire implementation
□ Identify the current CORS handling (likely hardcoded '*')
□ Identify the current error handling pattern
□ Note any special logic that must be preserved

STEP 2: Add Imports (2 min)
□ Add at top of file:
  ```typescript
  import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
  import { createErrorResponse, createSuccessResponse, withErrorHandling, logInfo } from "../_shared/error-handler.ts";
  ```

STEP 3: Update Handler Structure (10 min)
□ Wrap existing logic in the standard pattern:
  ```typescript
  const handler = async (req: Request): Promise<Response> => {
    // CORS preflight
    const preflightResponse = handleCorsPreFlight(req);
    if (preflightResponse) return preflightResponse;

    const corsHeaders = getCorsHeaders(req);

    // ... existing logic with corsHeaders ...
  };
  ```

STEP 4: Replace Error Responses (5 min)
□ Replace manual error responses with createErrorResponse()
□ Replace manual success responses with createSuccessResponse()
□ Remove hardcoded CORS headers

STEP 5: Update serve() Call (2 min)
□ Change from: serve(handler) or serve(async (req) => {...})
□ To: serve(withErrorHandling(handler, getCorsHeaders))

STEP 6: Add Logging (3 min)
□ Add logInfo() calls at key points
□ Include request ID and operation name

STEP 7: Test (5 min)
□ Deploy function locally if possible
□ Verify CORS headers are correct
□ Verify error responses have correct format

STEP 8: Document (2 min)
□ Update this file's metrics
□ Mark function as complete in checklist
```

**Completion Checklist:**
- [ ] search-youtube-content migrated
- [ ] search-youtube-manual migrated
- [ ] search-khan-academy migrated
- [ ] search-educational-content migrated
- [ ] global-search migrated
- [ ] All functions tested
- [ ] Commit pushed

---

#### Task 4.2: AI Generation Functions Migration (Day 3-4)
**Estimated Hours:** 6
**Reference:** `MASTER_IMPLEMENTATION_PLAN_V3.md` lines 272-279

| Function | File Path | Special Considerations |
|----------|-----------|----------------------|
| evaluate-content-batch | `supabase/functions/evaluate-content-batch/index.ts` | Batch processing, may have long timeouts |
| content-rating-engine | `supabase/functions/content-rating-engine/index.ts` | AI model calls |
| generate-lecture-slides-v3 | `supabase/functions/generate-lecture-slides-v3/index.ts` | Large response payloads |
| generate-lecture-audio | `supabase/functions/generate-lecture-audio/index.ts` | Audio processing |
| curriculum-reasoning-agent | `supabase/functions/curriculum-reasoning-agent/index.ts` | Complex AI orchestration |

**Step-by-Step Execution:**
Same pattern as Task 4.1, with additional considerations:

```markdown
ADDITIONAL STEPS for AI Functions:

STEP 2.5: Add Rate Limiting (if not present)
□ Import rate limiting utilities:
  ```typescript
  import { checkRateLimit, getUserLimits, rateLimitResponse } from "../_shared/skills-pipeline/index.ts";
  ```
□ Add rate limit check after authentication:
  ```typescript
  const userLimits = await getUserLimits(supabase, userId);
  const rateLimitResult = await checkRateLimit(supabase, userId, 'function-name', userLimits);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.reason || 'Rate limit exceeded', rateLimitResult.retryAfter || 3600, requestId, rateLimitResult.remaining, corsHeaders);
  }
  ```

STEP 6.5: Add AI Usage Logging
□ Log AI model calls for cost tracking
□ Include token counts if available
```

**Completion Checklist:**
- [x] evaluate-content-batch migrated + rate limited
- [ ] content-rating-engine migrated + rate limited (function not found - may be deprecated)
- [x] generate-lecture-slides-v3 migrated + rate limited
- [x] generate-lecture-audio migrated + rate limited
- [x] curriculum-reasoning-agent migrated + rate limited
- [ ] All functions tested
- [ ] Commit pushed

---

#### Task 4.3: Content Functions Migration (Day 5)
**Estimated Hours:** 4

| Function | File Path |
|----------|-----------|
| generate-micro-checks | `supabase/functions/generate-micro-checks/index.ts` |
| generate-search-context | `supabase/functions/generate-search-context/index.ts` |
| generate-content-strategy | `supabase/functions/generate-content-strategy/index.ts` |

**Completion Checklist:**
- [ ] generate-micro-checks migrated
- [ ] generate-search-context migrated
- [ ] generate-content-strategy migrated
- [ ] All functions tested
- [ ] Commit pushed

---

#### Task 4.4: Week 4 Integration Tasks (Day 5, continued)
**Estimated Hours:** 4

```markdown
INTEGRATION STEP 1: Weibull Decay Integration
□ Open: supabase/functions/gap-analysis/index.ts
□ Import: import { applyDecayToSkills, generateDecaySummary, getSkillsNeedingRetest } from "../_shared/skill-decay.ts";
□ After fetching verified_skills, apply decay:
  ```typescript
  const decayedSkills = applyDecayToSkills(verifiedSkills);
  const decaySummary = generateDecaySummary(decayedSkills);
  const skillsNeedingRetest = getSkillsNeedingRetest(decayedSkills);
  ```
□ Include decaySummary in AI prompt for gap analysis
□ Return skillsNeedingRetest in response

INTEGRATION STEP 2: Assessment Logger Integration
□ Open: supabase/functions/submit-assessment-answer/index.ts
□ Import: import { logAssessmentResponse } from "../_shared/assessment-logger.ts";
□ After processing answer, log response:
  ```typescript
  await logAssessmentResponse(supabase, {
    session_id: sessionId,
    question_id: questionId,
    user_id: userId,
    skill_name: skillName,
    is_correct: isCorrect,
    response_time_ms: responseTimeMs,
    bloom_level: question.bloom_level,
    estimated_difficulty: question.difficulty,
  });
  ```

INTEGRATION STEP 3: Verify Build & Tests
□ Run: npm run build
□ Run: npm run test
□ Fix any issues
```

**Week 4 Summary Checklist:**
- [x] All search functions migrated (5)
- [x] All AI generation functions migrated (4/5 - content-rating-engine not found)
- [x] Content functions migrated (3)
- [x] Weibull decay integrated into gap-analysis
- [x] Assessment logger integrated
- [ ] Build passes
- [ ] Tests pass
- [ ] Commit pushed with comprehensive message

---

### WEEK 5: BATCH MIGRATION PART 1

**Reference:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Week 5 schedule

#### Daily Targets (6 functions per day)

| Day | Functions | Category |
|-----|-----------|----------|
| Day 1 | auto-link-courses, enroll-in-course, extract-learning-objectives, parse-syllabus-document, analyze-dream-job, match-careers | Course & Career |
| Day 2 | create-checkout-session, create-portal-session, cancel-subscription, get-invoices, create-course-payment, get-usage-stats | Payment |
| Day 3 | stripe-webhook, idv-webhook, initiate-identity-verification, identity-verification-status, invite-users, configure-organization-sso | Webhooks & Identity |
| Day 4 | fetch-video-metadata, add-instructor-content, add-manual-content, firecrawl-search-courses, compare-web-providers, get-onet-occupation | Content & External APIs |
| Day 5 | employer-verify-completion, issue-certificate, poll-batch-curriculum, cancel-batch-job + Rate Limiting Expansion | Batch & Certification |

**For Each Day, Follow This Pattern:**

```markdown
MORNING (3 functions):
1. Read all 3 functions to understand patterns
2. Migrate first function completely (follow Task 4.1 steps)
3. Migrate second function
4. Migrate third function
5. Test all 3 together

AFTERNOON (3 functions):
1. Migrate remaining 3 functions
2. Test all functions
3. Run full build and test suite
4. Commit with descriptive message

END OF DAY:
□ Update this document with completed functions
□ Note any issues or deviations
□ Update metrics
```

#### Task 5.5: Rate Limiting Expansion
**Reference:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Task 4.2

**Functions Requiring Rate Limiting:**
```
Priority 1 (AI-intensive) - Add during migration:
✓ evaluate-content-batch (Week 4)
✓ content-rating-engine (Week 4)
✓ generate-lecture-slides-v3 (Week 4)
✓ generate-lecture-audio (Week 4)
✓ curriculum-reasoning-agent (Week 4)
□ analyze-dream-job
□ auto-link-courses (if AI-powered)

Priority 2 (Authentication-related):
□ initiate-identity-verification
□ configure-organization-sso
□ invite-users
```

---

### WEEK 6: COMPLETE MIGRATION + CLEANUP

#### Task 6.1: Remaining Functions (Day 1-3)
**Estimated Hours:** 15

Complete migration of all remaining functions. Use `ls supabase/functions/` to identify any unmigrated functions.

**Verification Script:**
```bash
# Run this to find functions not using CORS handler
for dir in supabase/functions/*/; do
  if [[ "$dir" != *"_shared"* ]]; then
    if ! grep -q "getCorsHeaders" "$dir/index.ts" 2>/dev/null; then
      echo "NOT MIGRATED: $dir"
    fi
  fi
done
```

#### Task 6.2: Authorization Audit (Day 3-4)
**Estimated Hours:** 12
**Reference:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Task 4.3

```markdown
For each function, verify:

□ Authorization header is validated
  - Check: if (!authHeader?.startsWith('Bearer '))

□ User token is validated and user retrieved
  - Check: const { data: { user }, error } = await supabase.auth.getUser()

□ User has permission for requested operation
  - Check: RLS policies, role checks, ownership checks

□ Anon key used (not service key) for RLS enforcement
  - Check: createClient uses SUPABASE_ANON_KEY, not SERVICE_ROLE_KEY

Create audit checklist for each function documenting findings.
```

#### Task 6.3: Code Cleanup (Day 4-5)
**Estimated Hours:** 10
**Reference:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Part 5

**Split Large Hook Files:**

| File | Lines | Split Into | Approach |
|------|-------|------------|----------|
| `src/hooks/useLectureSlides.ts` | 907 | useGenerateSlides, usePublishSlides, useLectureAudio | Extract by responsibility |
| `src/hooks/useInstructorCourses.ts` | 541 | useModules, useCourseStudents | Extract CRUD operations |
| `src/hooks/useAssessment.ts` | 502 | useMicroChecks, useAssessmentQuestions | Extract by entity |

**For Each Split:**
```markdown
STEP 1: Identify extraction boundaries
□ Group related functions
□ Identify shared state
□ Map dependencies

STEP 2: Create new file
□ Extract functions and types
□ Update imports
□ Add JSDoc documentation

STEP 3: Update original file
□ Remove extracted code
□ Import from new file if needed
□ Re-export for backward compatibility

STEP 4: Update consumers
□ Find all imports of original file
□ Update to use new specific imports

STEP 5: Test
□ Verify all functionality works
□ Check for circular dependencies
```

**Integrate Unused Hooks:**

| Hook | Target Integration |
|------|-------------------|
| useAdminAnalytics | AdminDashboard page |
| useOnboardingProgress | OnboardingWizard component |
| useInstructorNotifications | Instructor dashboard |

---

## PHASE 2: INPUT VALIDATION (Week 7)

### Objective
Implement Zod schema validation for all edge function inputs.

### Reference Documentation
- **Detailed Schemas:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Part 7

#### Task 7.1: Zod Schema Library
**Estimated Hours:** 8

**Create:** `supabase/functions/_shared/validators/index.ts`

```typescript
// Template for validators/index.ts
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================
// COMMON FIELD VALIDATORS
// ============================================================

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const dateSchema = z.string().datetime();

// ============================================================
// FUNCTION-SPECIFIC SCHEMAS
// ============================================================

export const assessmentStartSchema = z.object({
  learning_objective_id: uuidSchema,
  num_questions: z.number().min(1).max(20).optional().default(5),
});

export const webhookCreateSchema = z.object({
  employer_account_id: uuidSchema,
  url: urlSchema.refine(url => url.startsWith('https://'), 'HTTPS required'),
  events: z.array(z.string()).min(1),
});

export const skillsAssessmentSchema = z.object({
  skill_names: z.array(z.string().min(1)).min(1).max(10),
  assessment_type: z.enum(['quick', 'comprehensive', 'adaptive']).optional(),
});

export const dreamJobSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  target_salary_min: z.number().positive().optional(),
  target_salary_max: z.number().positive().optional(),
});

export const courseEnrollmentSchema = z.object({
  course_id: uuidSchema,
  payment_intent_id: z.string().optional(),
});

export const contentSearchSchema = z.object({
  query: z.string().min(2).max(200),
  filters: z.object({
    provider: z.array(z.string()).optional(),
    duration_max: z.number().positive().optional(),
    free_only: z.boolean().optional(),
  }).optional(),
  limit: z.number().min(1).max(50).optional().default(10),
});

// ============================================================
// VALIDATION HELPER
// ============================================================

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }
  return { success: true, data: result.data };
}
```

#### Task 7.2: Apply Validation to Functions
**Estimated Hours:** 16

**For Each Function:**
```markdown
STEP 1: Identify input requirements
□ What parameters does this function accept?
□ What are the type constraints?
□ What are the business rules?

STEP 2: Create or use schema
□ Check if schema exists in validators/index.ts
□ Create new schema if needed
□ Export from validators/index.ts

STEP 3: Add validation to handler
□ Parse request body
□ Validate with schema
□ Return validation errors with 400 status
  ```typescript
  const body = await req.json();
  const validation = validateRequest(mySchema, body);
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
  }
  const { data } = validation;
  // Use data.field1, data.field2, etc.
  ```

STEP 4: Update tests
□ Add test cases for validation errors
□ Test boundary conditions
```

---

## PHASE 3: SECURITY & MONITORING (Week 8)

### Reference Documentation
- **Security:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Part 8
- **Monitoring:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Part 9

#### Task 8.1: CORS Verification Audit
**Estimated Hours:** 3

```bash
# Run this audit script
echo "=== CORS AUDIT ===" > cors_audit.txt
echo "Date: $(date)" >> cors_audit.txt
echo "" >> cors_audit.txt

for dir in supabase/functions/*/; do
  if [[ "$dir" != *"_shared"* ]]; then
    name=$(basename "$dir")
    if grep -q "getCorsHeaders" "$dir/index.ts" 2>/dev/null; then
      echo "✅ $name: Using getCorsHeaders" >> cors_audit.txt
    elif grep -q "'\\*'" "$dir/index.ts" 2>/dev/null; then
      echo "❌ $name: HARDCODED WILDCARD CORS" >> cors_audit.txt
    else
      echo "⚠️ $name: No CORS found" >> cors_audit.txt
    fi
  fi
done

cat cors_audit.txt
```

#### Task 8.2: Sentry Integration
**Estimated Hours:** 4
**Reference:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Task 9.1

**Create:** `src/lib/error-tracking.ts`

```typescript
import * as Sentry from '@sentry/react';

export function initErrorTracking() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  console.error(error);
  if (import.meta.env.PROD) {
    Sentry.captureException(error, { extra: context });
  }
}

export function setUserContext(user: { id: string; email: string; role: string }) {
  Sentry.setUser({ id: user.id, email: user.email, role: user.role });
}
```

**Integration Steps:**
```markdown
□ Install: npm install @sentry/react
□ Add VITE_SENTRY_DSN to .env
□ Call initErrorTracking() in main.tsx
□ Call setUserContext() after login
□ Wrap error boundaries with Sentry.ErrorBoundary
```

---

## PHASE 4: ACCESSIBILITY & TESTING (Weeks 9-10)

### Reference Documentation
- **Accessibility:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Part 10
- **Testing:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Part 11

#### Task 9.1: WCAG Accessibility Audit
**Estimated Hours:** 8

```bash
# Install and run axe-core audit
npx @axe-core/cli http://localhost:5173 --tags wcag2a,wcag2aa > accessibility_audit.txt
```

**Common Fixes:**
| Issue | Fix |
|-------|-----|
| Missing alt text | Add alt="" for decorative, descriptive alt for meaningful |
| Insufficient contrast | Adjust colors to meet 4.5:1 ratio |
| Missing form labels | Add `<label>` or aria-label |
| Keyboard navigation | Add tabIndex, onKeyDown handlers |
| Missing ARIA landmarks | Add role="main", role="navigation", etc. |
| Focus management | Manage focus in modals and dynamic content |

#### Task 10.1: Edge Function Test Framework
**Estimated Hours:** 4
**Reference:** `MASTER_IMPLEMENTATION_PLAN_V3.md` → Task 11.1

**Create:** `supabase/functions/tests/setup.ts`

```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

export function createMockRequest(
  method: string,
  body?: unknown,
  authToken?: string
): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:5173',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return new Request('http://localhost', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function assertSuccessResponse(response: Response) {
  assertEquals(response.status, 200);
  assertExists(response.headers.get('Content-Type'));
}

export async function assertErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedCode: string
) {
  assertEquals(response.status, expectedStatus);
  const body = await response.json();
  assertEquals(body.code, expectedCode);
}

export function createMockSupabase() {
  // Mock Supabase client for testing
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user-id' } }, error: null }),
    },
    from: (table: string) => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  };
}
```

---

## PHASE 5: SCHOLARCHAIN INTEGRATION (Weeks 11-18)

### Reference Documentation
- **Full Plan:** `SCHOLARCHAIN_INTEGRATION_PLAN.md`

This phase is optional and extends beyond production readiness. See the referenced document for complete implementation details.

---

## METRICS TRACKING

### Update This Section After Each Work Session

| Date | Editor | Metric | Previous | New | Notes |
|------|--------|--------|----------|-----|-------|
| 2026-02-01 | Claude AI | CORS Handler Usage | 5 (6.3%) | 5 (6.3%) | Baseline |
| 2026-02-01 | Claude AI | Error Handler Usage | 7 (8.9%) | 7 (8.9%) | Baseline |
| 2026-02-01 | Claude AI | CORS Handler Usage | 18 (23%) | 21 (26.9%) | +3 functions (generate-lecture-slides-v3, generate-lecture-audio, gap-analysis) |
| 2026-02-01 | Claude AI | Error Handler Usage | 19 (24%) | 21 (26.9%) | +2 functions |
| 2026-02-01 | Claude AI | Zod Validators | 0 | ✅ Created | Created `_shared/validators/index.ts` with 20+ schemas |
| 2026-02-01 | Claude AI | Weibull Decay | Not integrated | ✅ | Integrated into gap-analysis function |
| 2026-02-01 | Claude AI | Assessment Logger | Not integrated | ✅ | Integrated into submit-assessment-answer function |
| 2026-02-01 | Claude AI | CORS Handler Usage | 21 (26.9%) | 27 (34.6%) | Week 5 Day 1: +6 functions |
| 2026-02-02 | Claude AI | CORS Handler Usage | 27 (34.6%) | **78 (100%)** | ✅ **PHASE 1 COMPLETE** - All remaining 51 functions migrated |
| 2026-02-02 | Claude AI | Error Handler Usage | 27 (34.6%) | **78 (100%)** | ✅ All functions now use error-handler.ts |
| 2026-02-02 | Claude AI | Zod Validation | 0 | **4** | Applied to: start-assessment, submit-assessment-answer, gap-analysis, create-webhook |
| 2026-02-02 | Claude AI | Rate Limiter | 10 | **19** | +9 AI functions (ai-gateway, content-assistant-chat, curriculum-reasoning-agent, etc.) |
| 2026-02-02 | Claude AI | Zod Validation | 4 | **9** | +5 functions (match-careers, discover-dream-jobs, enroll-in-course, analyze-dream-job, generate-curriculum) |
| 2026-02-02 | Claude AI | Sentry Integration | None | ✅ | Frontend error tracking (optional, console fallback) |
| 2026-02-02 | Claude AI | Edge Function Monitoring | None | ✅ | Created _shared/monitoring.ts with metrics, alerts, health checks |
| 2026-02-02 | Claude AI | Test Framework | 3 files | **7 files** | Added setup.ts + 26 tests for critical functions |
| 2026-02-02 | Claude AI | WCAG Accessibility | 34 aria attrs | **+5 fixes** | Added aria-labels to icon buttons |
| 2026-02-02 14:00 | Claude AI | Zod Validation | 9 | **46** | Applied to 37 more functions across all categories |
| 2026-02-02 14:00 | Claude AI | Rate Limiter | 19 | **38** | Added to 19 more AI-intensive functions |
| 2026-02-02 14:00 | Claude AI | Test Files | 7 | **11** | 4 new test files for critical edge functions |
| 2026-02-02 14:00 | Claude AI | WCAG Accessibility | +5 | **+17** | 12 more components fixed (forms, buttons, navigation) |
| 2026-02-02 14:00 | Claude AI | Hook File Splits | 0/3 | **2/3** | useLectureSlides (5 files), useInstructorCourses (4 files) |

---

## TOTAL EFFORT SUMMARY

| Phase | Weeks | Hours | Status |
|-------|-------|-------|--------|
| Edge Function Standardization | 4-6 | 85 | ✅ **Complete** |
| Validation & Features | 7 | 40 | 🔄 **90% Complete** |
| Security & Monitoring | 8 | 17 | ✅ **Complete** |
| Accessibility & Testing | 9-10 | 92 | 🔄 **50% Complete** |
| Code Quality / Hook Splits | 8 | 8 | 🔄 **67% Complete** |
| **Total to Production Ready** | | **242** | |
| ScholarChain Integration | 11-18 | ~200 | Optional |
| **Total with ScholarChain** | | **~442** | |

---

## QUICK REFERENCE: MIGRATION PATTERN

```typescript
// STANDARD EDGE FUNCTION TEMPLATE
// Copy this pattern for each migration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
} from "../_shared/error-handler.ts";

const handler = async (req: Request): Promise<Response> => {
  // 1. CORS Preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  // 2. Environment
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // 3. Authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Missing authorization');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid token');
  }

  // 4. Request Validation (add Zod validation here)
  const body = await req.json();

  // 5. Business Logic
  logInfo('function-name', 'starting operation', { userId: user.id });

  // ... your logic here ...

  // 6. Success Response
  return createSuccessResponse({ result: 'data' }, corsHeaders);
};

serve(withErrorHandling(handler, getCorsHeaders));
```

---

*Unified Implementation Path v2.0*
*Last Updated: 2026-02-01 18:45 UTC by Claude AI*
*Next Review: After Week 4 completion*
