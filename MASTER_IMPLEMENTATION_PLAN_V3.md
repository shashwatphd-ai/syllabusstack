# Master Implementation Plan V3: Complete Production Readiness Roadmap

**Date:** 2026-01-31
**Version:** 3.1
**Source Documents:** MASTER_IMPLEMENTATION_PLAN.md, MASTER_IMPLEMENTATION_PLAN_V2.md, Production Readiness Audit, ALGORITHM_UPGRADE_PLAN.md
**Verified Against:** Actual codebase state (build, tests, edge function analysis)

---

## Executive Summary

This comprehensive plan consolidates all previous planning documents and extends them with a full production readiness audit. It provides:
- Complete status tracking for all tasks
- Deep codebase analysis findings
- Extended roadmap for full production readiness
- Accurate effort estimates based on verified complexity
- **NEW: Patentable algorithm foundations for core IP protection**

### Algorithm Upgrade Foundation (Prerequisite - ✅ IMPLEMENTED)

Before proceeding with production hardening, the core algorithms have been upgraded to establish patentable IP. See `ALGORITHM_UPGRADE_PLAN.md` for full details.

| Algorithm | Previous | Upgraded | Patent Claim |
|-----------|----------|----------|--------------|
| Skill Matching | Jaccard similarity (1901) | Semantic embeddings | Career-outcome trained embedding space |
| Assessment | Bloom's taxonomy mapping | IRT 2PL Adaptive | Real-time recalibration + Fisher-optimal selection |
| Course Linking | Keyword overlap | Skill Transfer Graph | GNN with transfer coefficients |
| Skill Freshness | Timestamp only | Weibull Decay | Category-specific empirical parameters |
| Course Selection | AI prioritized | NSGA-II Multi-objective | Pareto-optimal learning paths |

**Files Implemented:**
- `supabase/migrations/20260131100000_algorithm_data_collection.sql` - Data infrastructure
- `supabase/functions/_shared/skill-decay.ts` - Weibull decay model
- `supabase/functions/_shared/irt-engine.ts` - IRT adaptive assessment
- `supabase/functions/_shared/skill-graph.ts` - Skill relationship graph
- `supabase/functions/_shared/course-optimizer.ts` - NSGA-II optimizer
- `supabase/functions/_shared/assessment-logger.ts` - Response logging for IRT
- `src/hooks/usePlacementOutcomes.ts` - Placement outcome tracking

### Current State (Verified 2026-01-29)

| Metric | Status | Target |
|--------|--------|--------|
| Build | **PASSES (0 errors)** | Maintain |
| Tests | **310 passed, 0 failed** | Maintain + add edge function tests |
| Edge Functions Total | **81 functions** | N/A |
| Error Handler Usage | **7/81 (8.6%)** | **100%** |
| Rate Limiter Usage | **10/81 (12.3%)** | **100% for AI/Auth functions** |
| Authorization Checks | **~74% estimated** | **100%** |
| Edge Function Tests | **~5%** | **>80%** |
| APM Integration | **None** | Sentry deployed |
| WCAG Compliance | **Partial** | **AA standard** |

### Completed Tasks (This Sprint)

| Task | Status | Commit | Details |
|------|--------|--------|---------|
| 1.1.1 Create useCourseProgress.ts | ✅ DONE | 1a0a2a7 | Course progress tracking |
| 1.1.2 Create useGapAnalysis.ts | ✅ DONE | 1a0a2a7 | Re-export from useAnalysis |
| 1.1.3 Fix Mock Hoisting (10 files) | ✅ DONE | 1a0a2a7 | All tests passing |
| 1.1.4 Fix Router Test Issue | ✅ DONE | 1a0a2a7 | MemoryRouter fix |
| 1.2.1 Database Migration | ✅ DONE | 31979c1 | last_accessed_at column |
| 2.1.1 Email Verification Banner | ✅ DONE | e7e22e5 | EmailVerificationBanner.tsx |
| 2.1.2 Password Requirements | ✅ DONE | 31979c1 | 8+ chars, complexity |
| 2.1.3 Rate Limiting (6 AI functions) | ✅ DONE | e7e22e5 | AI functions protected |
| 2.1.4 Webhook Secrets Server-Side | ✅ DONE | e7e22e5 | create-webhook edge function |
| 3.1 Assessment Auto-Save | ✅ DONE | cf513ec | useAssessmentAutoSave.ts |
| 3.2 Form Persistence | ✅ DONE | cf513ec | Onboarding localStorage |
| 3.5 Pagination Component | ✅ DONE | 3373d0c | usePagination + Pagination.tsx |
| 3.6 ConfirmationDialog | ✅ DONE | 31979c1 | Reusable dialog component |
| 3.7.1 PDF Export Fix | ✅ DONE | 3373d0c | html2pdf.js integration |
| 4.1 start-assessment Standardization | ✅ DONE | 3373d0c | Error handling pattern |
| 5.1 Remove Unused Code | ✅ DONE | 3373d0c | useWorkflows, workflows/, useProgressiveGeneration |
| **Algorithm Upgrades** | ✅ DONE | (pending) | Patentable IP foundation |

---

### Algorithm Upgrade Tasks (✅ COMPLETED 2026-01-31)

| Task | Status | Details |
|------|--------|---------|
| Data Collection Infrastructure | ✅ Done | DB migration for IRT, decay, outcomes |
| Weibull Skill Decay | ✅ Done | Category-specific decay parameters |
| IRT Adaptive Assessment | ✅ Done | 2PL model with MLE estimation |
| Skill Relationship Graph | ✅ Done | Transfer coefficients, message passing |
| NSGA-II Course Optimizer | ✅ Done | Pareto-optimal learning paths |
| Placement Outcome Tracking | ✅ Done | Frontend hook for data collection |

---

## Production Readiness Gaps Analysis

### Critical Issues (Must Fix Before Production)

| Category | Gap | Impact | Functions Affected |
|----------|-----|--------|-------------------|
| Error Handling | 91% lack standardized handling | Production stability | 74 functions |
| Rate Limiting | 87% AI functions unprotected | Cost overrun, DoS risk | ~71 functions |
| Authorization | 26% lack proper auth checks | Data leakage | ~21 functions |
| Monitoring | No APM integration | Blind to errors | All functions |
| Input Validation | Inconsistent validation | Injection attacks | Most functions |

### High Priority Issues

| Category | Gap | Impact | Components Affected |
|----------|-----|--------|---------------------|
| Testing | <5% edge function coverage | Regression risk | 81 functions |
| CORS | Wildcard origin | CSRF vulnerability | 81 functions |
| Accessibility | Missing ARIA labels | WCAG non-compliance | Multiple components |
| Loading States | Missing skeletons | Poor UX | 5 pages |

---

## Part 1: Foundation Fixes (Week 1) - ✅ COMPLETED

### Summary
All Week 1 tasks have been completed as verified in commits 1a0a2a7 and 31979c1.

### Completed Items
- ✅ useCourseProgress.ts - Course progress tracking hook
- ✅ useGapAnalysis.ts - Re-export from useAnalysis
- ✅ Mock hoisting fixes in 10 test files
- ✅ Router test issue resolution
- ✅ Database migration for last_accessed_at

---

## Part 2: Security Hardening (Week 2) - ✅ COMPLETED

### Summary
All Week 2 tasks have been completed as verified in commits 31979c1 and e7e22e5.

### Completed Items
- ✅ Email verification banner (EmailVerificationBanner.tsx)
- ✅ Password requirements strengthened
- ✅ Rate limiting on 6 AI-intensive functions
- ✅ Webhook secrets generated server-side

---

## Part 3: UX Critical Fixes (Week 3) - ✅ MOSTLY COMPLETED

### Completed Items
- ✅ 3.1 Assessment Auto-Save (useAssessmentAutoSave.ts)
- ✅ 3.2 Form Persistence (OnboardingWizard localStorage)
- ✅ 3.5 Pagination (usePagination.ts + Pagination.tsx)
- ✅ 3.6 Confirmation Dialog (ConfirmationDialog.tsx)
- ✅ 3.7.1 PDF Export Fix (html2pdf.js)

### Remaining Items

#### Task 3.4: Loading Skeletons
**STATUS:** NEEDS IMPLEMENTATION

**Pages Needing Skeletons:**
1. `src/pages/Dashboard.tsx` - Multiple widgets
2. `src/pages/Learn.tsx` - Course cards
3. `src/pages/CareerPath.tsx` - Gap analysis results
4. `src/pages/instructor/InstructorCourses.tsx` - Course list

**Implementation:**
```typescript
// src/components/dashboard/DashboardSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Effort:** 4 hours

#### Task 3.7.2: Send Reminder Button
**File:** `src/pages/admin/UserManagement.tsx`
**Effort:** 2-4 hours

---

## Part 4: Edge Function Standardization (Week 4-6)

### Current State
- **Using error-handler.ts:** 7/81 functions (8.6%)
- **Using rate-limiter:** 10/81 functions (12.3%)

### Task 4.1: Error Handler Migration

**STATUS:** IN PROGRESS (7 done, 74 remaining)

**Functions Using Error Handler (Verified):**
1. ✅ analyze-syllabus
2. ✅ gap-analysis
3. ✅ create-webhook
4. ✅ discover-dream-jobs
5. ✅ generate-recommendations
6. ✅ generate-assessment-questions
7. ✅ generate-curriculum

**Migration Priority Order:**

**Week 4, Day 1-2: Assessment Functions (5 functions)**
```
- complete-assessment
- submit-assessment-answer
- start-skills-assessment
- complete-skills-assessment
- generate-micro-check
```

**Week 4, Day 3-4: Search Functions (5 functions)**
```
- search-youtube-content
- search-youtube-manual
- search-khan-academy
- search-educational-content
- global-search
```

**Week 4, Day 5: AI Generation Functions (5 functions)**
```
- evaluate-content-batch
- content-rating-engine
- generate-lecture-slides-v3
- generate-lecture-audio
- curriculum-reasoning-agent
```

**Week 5: Batch Migration (30 functions)**
```
Migrate remaining functions in groups of 6 per day
```

**Week 6: Complete Migration (34 functions)**
```
Complete remaining functions + verification
```

**Migration Pattern (verified working):**
```typescript
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
} from "../_shared/error-handler.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  // ... function logic ...

  logInfo('function-name', 'operation', { details });

  return createSuccessResponse({ data }, corsHeaders);
};

serve(withErrorHandling(handler, corsHeaders));
```

**Effort:** 35-40 hours total

### Task 4.2: Rate Limiting Expansion

**Current Usage:** 10 functions
**Target:** All AI and authentication functions (~30 functions)

**Additional Functions Needing Rate Limiting:**
```
Priority 1 (AI-intensive):
- evaluate-content-batch
- content-rating-engine
- generate-lecture-slides-v3
- generate-lecture-audio
- curriculum-reasoning-agent
- analyze-dream-job

Priority 2 (Authentication):
- All auth-related functions
```

**Implementation Pattern:**
```typescript
import { checkRateLimit, getUserLimits, rateLimitResponse } from "../_shared/skills-pipeline/index.ts";

// In handler:
const userLimits = await getUserLimits(supabase, userId);
const rateLimitResult = await checkRateLimit(supabase, userId, 'function-name', userLimits);

if (!rateLimitResult.allowed) {
  return rateLimitResponse(
    rateLimitResult.reason || 'Rate limit exceeded',
    rateLimitResult.retryAfter || 3600,
    requestId,
    rateLimitResult.remaining
  );
}
```

**Effort:** 8 hours

### Task 4.3: Authorization Audit

**STATUS:** NEEDS IMPLEMENTATION

**Functions Requiring Auth Audit (estimated 21 functions):**
Verify each function:
1. Validates authorization header
2. Retrieves and validates user from token
3. Checks user has permission for requested operation
4. Uses RLS-enabled client (anon key, not service key)

**Audit Pattern:**
```typescript
// Validate auth header exists
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return createErrorResponse('UNAUTHORIZED', corsHeaders);
}

// Validate token and get user
const token = authHeader.replace('Bearer ', '');
const { data, error: authError } = await supabase.auth.getClaims(token);
if (authError || !data?.claims) {
  return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid token');
}

const userId = data.claims.sub as string;
// Now use userId for all operations
```

**Effort:** 12 hours

---

## Part 5: Code Cleanup (Week 6) - PARTIALLY COMPLETED

### Completed Items
- ✅ 5.1 Remove unused hooks (useWorkflows.ts, workflows/, useProgressiveGeneration.ts)

### Remaining Items

#### Task 5.2: Split Large Hook Files

**Source:** CODE_CLARITY_REFACTORING_REPORT.md Section 1.2

| File | Lines | Split Into |
|------|-------|------------|
| `useLectureSlides.ts` | 907 | `useGenerateSlides.ts`, `usePublishSlides.ts`, `useLectureAudio.ts` |
| `useInstructorCourses.ts` | 541 | `useModules.ts`, `useCourseStudents.ts` |
| `useAssessment.ts` | 502 | `useMicroChecks.ts`, `useAssessmentQuestions.ts` |

**Effort:** 10 hours total

#### Task 5.3: Evaluate Unused Hooks

**These hooks exist but appear unused - review before deletion:**

| Hook | Lines | Possible Use | Decision |
|------|-------|--------------|----------|
| `useAdminAnalytics.ts` | 390 | AdminDashboard | Keep - integrate |
| `useOnboardingProgress.ts` | 287 | Onboarding flow | Keep - integrate |
| `useInstructorNotifications.ts` | 286 | Instructor alerts | Keep - integrate |

**Effort:** 6 hours (integration)

---

## Part 6: Feature Verification (Week 7)

### Task 6.1: Sprint 1-6 Feature Audit

**Verify each feature works end-to-end:**

| Sprint | Feature | Status | Needs Fix |
|--------|---------|--------|-----------|
| 1 | Verified Skills Loop | Needs verification | TBD |
| 2 | Career-Dream Job Connection | Needs verification | TBD |
| 3 | Student Journey | Needs verification | TBD |
| 4 | Instructor Analytics | Needs verification | TBD |
| 5 | Employer & Admin | Needs verification | TBD |
| 6 | Help & Support | Needs verification | TBD |

**Effort:** 16 hours

### Task 6.2: Integration Tests

Create end-to-end tests for critical user flows:
1. Student onboarding → skills assessment → career match
2. Instructor course creation → module → assessment
3. Employer verification request → student verification
4. Admin user management → role assignment

**Effort:** 20 hours

---

## Part 7: Input Validation Framework (Week 7)

### Task 7.1: Zod Schema Library

**File:** `supabase/functions/_shared/validators/index.ts`

**Common Schemas:**
```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Common field validators
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();

// Request schemas by function type
export const assessmentStartSchema = z.object({
  learning_objective_id: uuidSchema,
  num_questions: z.number().min(1).max(20).optional().default(5),
});

export const webhookCreateSchema = z.object({
  employer_account_id: uuidSchema,
  url: urlSchema.refine(url => url.startsWith('https://'), 'HTTPS required'),
  events: z.array(z.string()).min(1),
});

// Validation helper
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
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

**Effort:** 8 hours (framework + 10 common schemas)

### Task 7.2: Migrate Functions to Use Validators

Apply validation to all edge functions that accept user input.

**Effort:** 16 hours

---

## Part 8: CORS Security Hardening (Week 8)

### Task 8.1: Environment-Based CORS

**Problem:** All functions use `Access-Control-Allow-Origin: '*'`

**Solution:** Create shared CORS handler with environment-based origins

**File:** `supabase/functions/_shared/cors.ts`

```typescript
const ALLOWED_ORIGINS = {
  production: ['https://syllabusstack.com', 'https://app.syllabusstack.com'],
  staging: ['https://staging.syllabusstack.com'],
  development: ['http://localhost:5173', 'http://localhost:3000'],
};

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const env = Deno.env.get('ENVIRONMENT') || 'development';
  const allowed = ALLOWED_ORIGINS[env as keyof typeof ALLOWED_ORIGINS] || ALLOWED_ORIGINS.development;

  const isAllowed = allowed.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
```

**Effort:** 6 hours (implementation + migration)

---

## Part 9: APM & Monitoring (Week 8-9)

### Task 9.1: Sentry Integration

**File:** `src/lib/error-tracking.ts`

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
      tracesSampleRate: 0.1, // 10% of transactions
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

**Effort:** 4 hours

### Task 9.2: Edge Function Monitoring

**File:** `supabase/functions/_shared/monitoring.ts`

```typescript
export function logMetric(name: string, value: number, tags?: Record<string, string>) {
  console.log(JSON.stringify({
    type: 'metric',
    name,
    value,
    tags,
    timestamp: new Date().toISOString(),
  }));
}

export function logDuration(functionName: string, startTime: number) {
  const duration = Date.now() - startTime;
  logMetric('function_duration_ms', duration, { function: functionName });
}
```

**Effort:** 4 hours

### Task 9.3: Alerting Rules

**Configure in Supabase Dashboard / Sentry:**

| Alert | Condition | Action |
|-------|-----------|--------|
| High Error Rate | >5% for 5 minutes | Slack + Email |
| Slow Response | p95 >3s for 5 minutes | Slack |
| Rate Limit Spikes | >100 429s in 5 minutes | Slack |
| Auth Failures | >50 401s in 5 minutes | Slack + Email |
| Database Errors | Any 500 from DB | Slack + Email |

**Effort:** 3 hours

---

## Part 10: WCAG Accessibility (Week 9)

### Task 10.1: Accessibility Audit

**Run automated audit:**
```bash
npx @axe-core/cli http://localhost:5173 --tags wcag2a,wcag2aa
```

**Common Issues to Fix:**
1. Missing alt text on images
2. Insufficient color contrast
3. Missing form labels
4. Keyboard navigation issues
5. Missing ARIA landmarks
6. Focus management in modals

**Effort:** 8 hours (audit + fixes)

### Task 10.2: Screen Reader Testing

Test critical flows with NVDA/VoiceOver:
1. Login flow
2. Dashboard navigation
3. Assessment taking
4. Course enrollment

**Effort:** 4 hours

---

## Part 11: Edge Function Testing (Week 9-10)

### Task 11.1: Test Framework Setup

**File:** `supabase/functions/tests/setup.ts`

```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

export function createMockRequest(method: string, body?: unknown, authToken?: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

export function assertErrorResponse(response: Response, expectedCode: string) {
  const body = await response.json();
  assertEquals(body.code, expectedCode);
}
```

**Effort:** 4 hours

### Task 11.2: Critical Function Tests

**Priority Functions (20 tests):**
1. start-assessment
2. submit-assessment-answer
3. complete-assessment
4. match-careers
5. gap-analysis
6. discover-dream-jobs
7. generate-recommendations
8. create-webhook
9. analyze-syllabus
10. generate-curriculum

**Test Pattern:**
```typescript
// supabase/functions/tests/start-assessment.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createMockRequest } from "./setup.ts";

Deno.test("start-assessment - requires authentication", async () => {
  const req = createMockRequest('POST', { learning_objective_id: 'test-id' });
  const response = await handler(req);
  assertEquals(response.status, 401);
});

Deno.test("start-assessment - validates learning_objective_id", async () => {
  const req = createMockRequest('POST', {}, 'valid-token');
  const response = await handler(req);
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.code, 'VALIDATION_ERROR');
});

Deno.test("start-assessment - creates session for valid request", async () => {
  const req = createMockRequest('POST', {
    learning_objective_id: 'valid-uuid',
  }, 'valid-token');
  const response = await handler(req);
  assertEquals(response.status, 200);
  const body = await response.json();
  assertExists(body.session);
});
```

**Effort:** 30 hours (20 functions × 1.5 hours each)

---

## Part 12: Documentation (Week 10)

### Task 12.1: API Documentation

**Files to Create:**
```
docs/api/
├── overview.md
├── authentication.md
├── student-api.md
├── instructor-api.md
├── employer-api.md
├── admin-api.md
└── webhooks.md
```

**Effort:** 12 hours

### Task 12.2: Architecture Documentation

**Files to Create:**
```
docs/architecture/
├── overview.md (system diagram, tech stack)
├── database-schema.md (ERD, key relationships)
├── frontend-structure.md (component hierarchy)
├── edge-functions.md (function catalog)
└── deployment.md (CI/CD, environments)
```

**Effort:** 10 hours

### Task 12.3: Developer Setup Guide

**File:** `docs/DEVELOPMENT.md`

Contents:
- Prerequisites
- Environment setup
- Local Supabase setup
- Running tests
- Code style guidelines
- PR process

**Effort:** 4 hours

---

## Implementation Schedule

### Week 1-2: Foundation & Security - ✅ COMPLETED
| Task | Status | Hours |
|------|--------|-------|
| Test fixes | ✅ Done | 4 |
| Database migration | ✅ Done | 1 |
| Email verification | ✅ Done | 2 |
| Rate limiting (6 functions) | ✅ Done | 3 |
| Webhook secrets | ✅ Done | 2 |
| Password requirements | ✅ Done | 1 |
| **Subtotal** | | **13** |

### Week 3: UX Critical - ✅ MOSTLY COMPLETED
| Task | Status | Hours |
|------|--------|-------|
| Assessment auto-save | ✅ Done | 4 |
| Form persistence | ✅ Done | 2 |
| Pagination | ✅ Done | 3 |
| Confirmation dialog | ✅ Done | 2 |
| PDF export | ✅ Done | 2 |
| Loading skeletons | Pending | 4 |
| **Subtotal Remaining** | | **4** |

### Week 4: Edge Function Migration (Part 1)
| Task | Hours |
|------|-------|
| Assessment functions (5) | 6 |
| Search functions (5) | 6 |
| AI generation functions (5) | 6 |
| **Subtotal** | **18** |

### Week 5: Edge Function Migration (Part 2)
| Task | Hours |
|------|-------|
| Batch migrate 30 functions | 20 |
| Rate limiting expansion | 4 |
| **Subtotal** | **24** |

### Week 6: Edge Function Migration (Part 3) + Cleanup
| Task | Hours |
|------|-------|
| Complete remaining 34 functions | 15 |
| Authorization audit | 12 |
| Split large hooks | 10 |
| Integrate unused hooks | 6 |
| **Subtotal** | **43** |

### Week 7: Validation + Feature Verification
| Task | Hours |
|------|-------|
| Zod schema framework | 8 |
| Apply validation to functions | 16 |
| Sprint feature verification | 16 |
| **Subtotal** | **40** |

### Week 8: Security + Monitoring
| Task | Hours |
|------|-------|
| CORS hardening | 6 |
| Sentry integration | 4 |
| Edge function monitoring | 4 |
| Alerting rules | 3 |
| **Subtotal** | **17** |

### Week 9: Accessibility + Testing (Part 1)
| Task | Hours |
|------|-------|
| WCAG accessibility audit | 8 |
| Screen reader testing | 4 |
| Test framework setup | 4 |
| Critical function tests (10) | 15 |
| **Subtotal** | **31** |

### Week 10: Testing (Part 2) + Documentation
| Task | Hours |
|------|-------|
| Remaining function tests (10) | 15 |
| Integration tests | 20 |
| API documentation | 12 |
| Architecture documentation | 10 |
| Developer guide | 4 |
| **Subtotal** | **61** |

---

## Total Effort Summary

| Week | Focus | Hours |
|------|-------|-------|
| 1-2 | Foundation & Security | ✅ 13 (done) |
| 3 | UX Critical | 4 (remaining) |
| 4 | Edge Functions (Part 1) | 18 |
| 5 | Edge Functions (Part 2) | 24 |
| 6 | Edge Functions (Part 3) + Cleanup | 43 |
| 7 | Validation + Features | 40 |
| 8 | Security + Monitoring | 17 |
| 9 | Accessibility + Testing (Part 1) | 31 |
| 10 | Testing (Part 2) + Docs | 61 |
| **Total Remaining** | | **238 hours** |
| **Total Including Completed** | | **251 hours** |

---

## Success Criteria

### Week 3-4 Complete (Edge Functions Start)
- [ ] Loading skeletons on 4 pages
- [ ] 20+ edge functions using standardized error handling
- [ ] All assessment functions migrated

### Week 5-6 Complete (Edge Functions Done)
- [ ] 100% edge functions using standardized error handling
- [ ] Rate limiting on all AI functions
- [ ] Authorization audit complete
- [ ] Large hooks split
- [ ] Unused hooks integrated

### Week 7 Complete (Validation)
- [ ] Zod schema library created
- [ ] All functions using input validation
- [ ] Sprint 1-6 features verified working

### Week 8 Complete (Security + Monitoring)
- [ ] CORS hardening deployed
- [ ] Sentry integration active
- [ ] Alerting rules configured

### Week 9-10 Complete (Quality)
- [ ] WCAG AA compliance verified
- [ ] >80% edge function test coverage
- [ ] Integration tests passing
- [ ] Documentation complete

### Production Ready Checklist
- [ ] All 81 edge functions standardized
- [ ] Rate limiting on AI/auth functions
- [ ] Authorization verified on all functions
- [ ] Input validation on all functions
- [ ] CORS restricted to allowed origins
- [ ] APM active with alerting
- [ ] >80% test coverage
- [ ] WCAG AA compliant
- [ ] Documentation complete
- [ ] Zero critical/high security issues

---

## Appendix A: Edge Function Inventory

### Standardized (7 functions)
1. analyze-syllabus
2. gap-analysis
3. create-webhook
4. discover-dream-jobs
5. generate-recommendations
6. generate-assessment-questions
7. generate-curriculum

### Using Rate Limiting (10 functions)
1. analyze-syllabus
2. gap-analysis
3. discover-dream-jobs
4. generate-recommendations
5. generate-assessment-questions
6. generate-curriculum
7. match-careers
8. start-skills-assessment
9. complete-skills-assessment
10. submit-skills-response

### Needing Migration (74 functions)
See complete list in codebase: `supabase/functions/*/index.ts`

---

## Appendix B: Files Created This Sprint

| File | Purpose | Commit |
|------|---------|--------|
| `src/hooks/useCourseProgress.ts` | Course progress tracking | 1a0a2a7 |
| `src/hooks/useGapAnalysis.ts` | Re-export from useAnalysis | 1a0a2a7 |
| `src/hooks/useAssessmentAutoSave.ts` | Assessment localStorage | cf513ec |
| `src/hooks/usePagination.ts` | Reusable pagination | 3373d0c |
| `src/components/common/Pagination.tsx` | Pagination UI | 3373d0c |
| `src/components/common/ConfirmationDialog.tsx` | Delete confirmations | 31979c1 |
| `src/components/auth/EmailVerificationBanner.tsx` | Unverified notice | e7e22e5 |
| `supabase/functions/create-webhook/index.ts` | Server-side webhook | e7e22e5 |
| `supabase/migrations/20260128100000_add_last_accessed_at.sql` | Activity tracking | 31979c1 |

## Appendix C: Files Deleted This Sprint

| File | Reason | Commit |
|------|--------|--------|
| `src/hooks/useWorkflows.ts` | Never imported | 3373d0c |
| `src/hooks/workflows/*` | Never imported | 3373d0c |
| `src/hooks/useProgressiveGeneration.ts` | Never imported | 3373d0c |

---

*Master Implementation Plan V3 - Generated 2026-01-29*
*Consolidates: MASTER_IMPLEMENTATION_PLAN.md, MASTER_IMPLEMENTATION_PLAN_V2.md, Production Readiness Audit*
*Verified against actual codebase state*
