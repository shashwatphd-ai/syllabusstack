# Architecture Findings

**Assessment Date:** January 26, 2026

---

## Summary

| Category | Finding Count | Critical | High | Medium | Low |
|----------|---------------|----------|------|--------|-----|
| Structure | 8 | 0 | 2 | 4 | 2 |

---

## Findings

### ARCH-001: Dual Routing Libraries Present

**Severity:** Medium
**Location:** `package.json`, `src/App.tsx`

**Description:**
The codebase includes both React Router DOM (v7.12) and TanStack Router (v1.141). The main App.tsx uses React Router, but TanStack Router is also installed.

**Evidence:**
```json
"react-router-dom": "^7.12.0",
"@tanstack/react-router": "^1.141.6"
```

**Risk:**
- Developer confusion about which router to use
- Increased bundle size
- Potential routing conflicts

**Recommendation:**
Standardize on one routing solution. If React Router is primary, remove TanStack Router or document when each should be used.

---

### ARCH-002: Large Number of Custom Hooks (55+)

**Severity:** Medium
**Location:** `src/hooks/`

**Description:**
55+ custom hooks exist in the hooks directory. While hooks are good for code organization, this quantity suggests potential duplication or overly granular separation.

**Evidence:**
- `useCourses.ts`, `useStudentCourses.ts`, `useInstructorCourses.ts` - potential overlap
- `useCourseSearch.ts`, `useSingleCourseSearch.ts`, `useGlobalSearch.ts` - multiple search hooks

**Risk:**
- Maintenance overhead
- Potential inconsistent patterns
- Difficulty for new developers to navigate

**Recommendation:**
Audit hooks for consolidation opportunities. Consider grouping related functionality into composite hooks.

---

### ARCH-003: Service Layer Inconsistently Used

**Severity:** High
**Location:** `src/services/`, `src/hooks/`

**Description:**
Only 7 service modules exist, but 77 edge functions are called. Many hooks call `supabase.functions.invoke()` directly rather than through the service layer.

**Evidence:**
- Services handle: syllabus, dream-job, gap-analysis, recommendations, content, assessment
- Missing services for: payments, certificates, batch processing, admin functions

**Risk:**
- Inconsistent API abstraction
- Harder to refactor backend calls
- No central place for error handling

**Recommendation:**
Extend service layer to cover all edge function domains, or document when direct invocation is acceptable.

---

### ARCH-004: No API Gateway Pattern

**Severity:** High
**Location:** `supabase/functions/`

**Description:**
Each of the 77 edge functions independently handles concerns like authentication, rate limiting, and error formatting. There's an `ai-gateway` function but it's for AI routing only.

**Risk:**
- Duplicated auth/validation code across functions
- Inconsistent error responses
- No centralized rate limiting

**Recommendation:**
Consider implementing a shared middleware pattern using the `_shared/` folder for common concerns.

---

### ARCH-005: 21 Edge Functions Without JWT Verification

**Severity:** Medium (requires security review)
**Location:** `supabase/config.toml`

**Description:**
21 out of 77 edge functions have `verify_jwt = false`. While some are legitimately public (webhooks, certificate verification), others may need review.

**Public Functions:**
- Legitimate: `stripe-webhook`, `verify-certificate`, `get-onet-occupation`
- Needs review: `ai-gateway`, `analyze-syllabus`, `submit-batch-slides`

**Risk:**
- Potential unauthorized access to functionality
- Resource abuse on AI-generation endpoints

**Recommendation:**
Document rationale for each public function. Consider adding API key or rate limiting for non-authenticated endpoints.

---

### ARCH-006: Missing Observability Infrastructure

**Severity:** Medium
**Location:** Entire codebase

**Description:**
No centralized logging, monitoring, or tracing infrastructure is visible in the codebase. Edge functions may log to Supabase's built-in logging, but there's no application-level observability.

**Evidence:**
- No logging library in dependencies
- No Sentry/DataDog/similar integration
- No custom error tracking

**Risk:**
- Difficult to debug production issues
- No visibility into API performance
- No alerting on failures

**Recommendation:**
Implement structured logging in edge functions and consider adding error tracking (Sentry) to the frontend.

---

### ARCH-007: Batch Processing Architecture Well-Designed

**Severity:** Low (Positive Finding)
**Location:** `supabase/functions/submit-batch-*`, `poll-batch-*`

**Description:**
The batch processing pattern for AI generation is well-architected:
- Submit → Create job record → Poll → Update on completion
- Uses Vertex AI Batch API for 50% cost savings
- Proper job status tracking in database

**Evidence:**
```
# From config.toml comments:
# Batch API functions for slide generation (50% cost savings)
# These replace the queue-based system in process-lecture-queue
```

**Recommendation:**
Document this pattern as a reference architecture for future batch processing needs.

---

### ARCH-008: Component Directory Structure Clear

**Severity:** Low (Positive Finding)
**Location:** `src/components/`

**Description:**
Components are well-organized into 30+ domain-specific directories:
- `auth/`, `billing/`, `certificates/` - feature-specific
- `ui/` - shadcn/ui primitives
- `common/` - shared components
- `layout/` - structural components

**Recommendation:**
Maintain this organization pattern. Consider adding an `index.ts` barrel export for each directory.

---

## Architectural Debt Summary

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Consolidate routing libraries | Low | Medium | P2 |
| Extend service layer | Medium | High | P1 |
| Implement shared middleware | Medium | High | P1 |
| Add observability | Medium | High | P1 |
| Audit public endpoints | Low | Medium | P2 |
| Consolidate hooks | Medium | Medium | P3 |

---

## Next Steps

1. Security assessment to review ARCH-005 (public endpoints)
2. Performance audit to identify hook optimization opportunities
3. Create shared middleware pattern for edge functions
