# Security Assessment Report

**Assessment Date:** January 26, 2026
**Scope:** Frontend (React), Backend (77 Edge Functions), Database (PostgreSQL)

---

## Executive Summary

| Category | Findings | Critical | High | Medium | Low |
|----------|----------|----------|------|--------|-----|
| Authentication | 4 | 0 | 0 | 1 | 3 |
| Authorization (RLS) | 3 | 0 | 0 | 1 | 2 |
| Input Validation | 3 | 0 | 1 | 1 | 1 |
| API Security | 5 | 0 | 2 | 2 | 1 |
| Secrets Management | 2 | 0 | 0 | 1 | 1 |
| Webhook Security | 2 | 0 | 0 | 2 | 0 |
| **Total** | **19** | **0** | **3** | **8** | **8** |

**Overall Risk Level:** Medium

---

## Authentication Security

### SEC-AUTH-001: Supabase Auth Properly Implemented

**Severity:** Low (Positive Finding)
**Location:** `src/contexts/AuthContext.tsx`

**Description:**
Authentication is handled through Supabase Auth with proper patterns:
- JWT-based authentication with auto-refresh
- Session persistence in localStorage
- Profile data excludes sensitive Stripe IDs from frontend

**Evidence:**
```typescript
// Secure profile type excluding sensitive fields
type FullProfile = Tables<'profiles'>;
export type Profile = Omit<FullProfile, 'stripe_customer_id' | 'stripe_subscription_id'>;
```

---

### SEC-AUTH-002: 21 Edge Functions Without JWT Verification

**Severity:** Medium
**Location:** `supabase/config.toml`

**Description:**
21 of 77 edge functions have `verify_jwt = false`. While some are legitimately public, others need review.

**Categorized Public Functions:**

| Function | Legitimacy | Risk |
|----------|------------|------|
| `stripe-webhook` | Legitimate (Stripe verifies) | Low |
| `idv-webhook` | Legitimate (Persona verifies) | Low |
| `verify-certificate` | Legitimate (public verification) | Low |
| `get-onet-occupation` | Legitimate (public data) | Low |
| `fetch-video-metadata` | Legitimate (public metadata) | Low |
| `ai-gateway` | **Needs Review** | Medium |
| `analyze-syllabus` | **Needs Review** | Medium |
| `analyze-dream-job` | **Needs Review** | Medium |
| `submit-batch-slides` | Documented (service role) | Low |
| `process-batch-research` | Documented (service role) | Low |
| `curriculum-reasoning-agent` | **Needs Review** | Medium |
| `generate-lecture-slides-v3` | **Needs Review** | Medium |

**Risk:**
- AI-generation endpoints without auth could be abused for resource consumption
- No rate limiting visible on public endpoints

**Recommendation:**
1. Add rate limiting to all public AI endpoints
2. Consider API key authentication for unauthenticated AI calls
3. Document security rationale for each public function

---

### SEC-AUTH-003: AuthGuard and AdminGuard Implemented

**Severity:** Low (Positive Finding)
**Location:** `src/App.tsx`, `src/components/auth/`

**Description:**
Route protection is properly implemented:
- `AuthGuard` for authenticated routes
- `GuestGuard` for login pages (redirects authenticated users)
- `AdminGuard` for admin routes

---

### SEC-AUTH-004: Password Reset Flow Secure

**Severity:** Low (Positive Finding)
**Location:** `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`

**Description:**
Password reset uses Supabase's built-in secure flow with email verification links.

---

## Authorization (RLS) Security

### SEC-RLS-001: RLS Enabled on All User Tables

**Severity:** Low (Positive Finding)
**Location:** `supabase/migrations/`

**Description:**
Row Level Security is consistently enabled across all user-facing tables. Policies follow the pattern:
- Users can only access their own data
- Service role has full access for edge functions
- Some tables (occupations, assessment items) are read-only for all authenticated users

**Tables with RLS verified:**
- `profiles` - User can access own profile
- `courses`, `dream_jobs`, `capabilities` - User-scoped
- `teaching_units`, `learning_objectives` - Course-scoped
- `skill_profiles`, `career_matches` - User-scoped
- `identity_verifications` - User-scoped (service role can update)
- `employer_accounts`, `employer_api_keys` - Owner-scoped
- `content_search_cache`, `api_quota_tracking` - Service role managed

---

### SEC-RLS-002: Multi-tenant Organization Isolation Needs Audit

**Severity:** Medium
**Location:** `supabase/migrations/`

**Description:**
Organization-based access control exists for instructor courses and employer accounts, but the full multi-tenancy isolation needs verification.

**Evidence:**
- `organization_id` field exists on profiles
- Instructor courses have organization context
- Employer accounts have user ownership

**Recommendation:**
Create a dedicated RLS audit document mapping all tables to their access patterns.

---

### SEC-RLS-003: Service Role Key Usage Appropriate

**Severity:** Low (Positive Finding)
**Location:** Edge functions

**Description:**
Service role key is used appropriately for:
- Webhook handlers (Stripe, Persona)
- Cross-table updates
- Batch processing operations

The frontend uses only the anon key.

---

## Input Validation Security

### SEC-INPUT-001: Zod Validation Available But Inconsistently Applied

**Severity:** High
**Location:** Frontend forms, edge functions

**Description:**
Zod is installed (`zod@3.25.76`) for schema validation, but usage is inconsistent. Some edge functions accept unvalidated JSON payloads.

**Evidence (ai-gateway):**
```typescript
const body: GatewayRequest = await req.json();  // No validation
const { task, prompt, system_prompt, options } = body;

if (!task || !prompt) {  // Basic null check only
  return new Response(...);
}
```

**Risk:**
- Malformed inputs could cause unexpected behavior
- Type mismatches between expected and actual payloads

**Recommendation:**
Create shared Zod schemas for all edge function request/response types.

---

### SEC-INPUT-002: SQL Injection Protected by Supabase Client

**Severity:** Low (Positive Finding)
**Location:** All database queries

**Description:**
All database queries use Supabase's query builder, which parameterizes inputs. No raw SQL queries found in edge functions.

---

### SEC-INPUT-003: Prompt Injection Risk in AI Functions

**Severity:** Medium
**Location:** AI-related edge functions

**Description:**
User input is passed directly to AI prompts. While not a traditional injection vulnerability, malicious prompts could:
- Extract system prompts
- Generate inappropriate content
- Consume excessive resources

**Recommendation:**
- Implement input sanitization for AI prompts
- Add content moderation for AI outputs
- Consider prompt injection detection

---

## API Security

### SEC-API-001: CORS Configured as Wildcard

**Severity:** Medium
**Location:** All edge functions

**Description:**
All edge functions use `Access-Control-Allow-Origin: "*"`, allowing any origin to call the APIs.

**Evidence:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

**Risk:**
- Any website can make authenticated requests if they have a user's token
- Increases attack surface for CSRF-like attacks

**Recommendation:**
Configure specific allowed origins in production:
```typescript
const allowedOrigins = ['https://syllabusstack.com', 'https://app.syllabusstack.com'];
```

---

### SEC-API-002: No Rate Limiting Implemented

**Severity:** High
**Location:** All edge functions

**Description:**
No rate limiting is implemented on any edge function. Public endpoints are especially vulnerable.

**Risk:**
- DoS attacks possible on AI endpoints
- Resource exhaustion from bulk requests
- Cost amplification for AI API calls

**Recommendation:**
Implement rate limiting using:
1. Supabase's built-in rate limiting (if available)
2. User-based rate limiting tracked in database
3. IP-based rate limiting for public endpoints

---

### SEC-API-003: API Usage Tracking Implemented

**Severity:** Low (Positive Finding)
**Location:** `ai-gateway/index.ts`, `_shared/`

**Description:**
AI usage is tracked per user for billing and monitoring:
```typescript
await trackAIUsage(
  supabase,
  userId,
  'ai-gateway/text',
  result.provider,
  result.model,
  Math.ceil(prompt.length / 4),
  Math.ceil(result.content.length / 4),
  result.cost_usd
);
```

---

### SEC-API-004: Error Messages Could Leak Information

**Severity:** Medium
**Location:** Edge functions

**Description:**
Some error responses include raw error messages that could expose internal details.

**Evidence:**
```typescript
const errorMessage = error instanceof Error ? error.message : String(error);
return new Response(
  JSON.stringify({ error: errorMessage }),
  { status: 500, ... }
);
```

**Recommendation:**
Log detailed errors server-side; return generic messages to clients.

---

### SEC-API-005: Stripe Webhook Signature Verification Implemented

**Severity:** Low (Positive Finding)
**Location:** `supabase/functions/stripe-webhook/index.ts`

**Description:**
Stripe webhooks properly verify signatures:
```typescript
const signature = req.headers.get("stripe-signature");
event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

---

## Secrets Management

### SEC-SECRET-001: Environment Variables Properly Used

**Severity:** Low (Positive Finding)
**Location:** Edge functions, `.env`

**Description:**
Secrets are loaded from environment variables:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PERSONA_WEBHOOK_SECRET`
- `RESEND_API_KEY`

No hardcoded secrets found in source code.

---

### SEC-SECRET-002: Frontend Only Uses Anon Key

**Severity:** Low (Positive Finding)
**Location:** `src/integrations/supabase/client.ts`

**Description:**
Frontend correctly uses only public Supabase credentials:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

---

## Webhook Security

### SEC-WEBHOOK-001: Stripe Webhook Fully Secured

**Severity:** Low (Positive Finding)
**Location:** `supabase/functions/stripe-webhook/index.ts`

**Description:**
Stripe webhook handler:
- Verifies signature using `stripe.webhooks.constructEvent`
- Returns 400 for missing/invalid signatures
- Properly handles all subscription lifecycle events

---

### SEC-WEBHOOK-002: Persona IDV Webhook Signature Verification Incomplete

**Severity:** Medium
**Location:** `supabase/functions/idv-webhook/index.ts`

**Description:**
The Persona webhook has signature verification code but it's incomplete:
```typescript
if (webhookSecret) {
  const signature = req.headers.get("persona-signature");
  if (!signature) {
    console.error("Missing Persona signature");
    return new Response("Unauthorized", { status: 401 });
  }
  // In production, verify HMAC signature
  // For now, log and continue  <-- NOT IMPLEMENTED
  console.log("[idv-webhook] Received webhook with signature");
}
```

**Risk:**
- Attackers could spoof identity verification completion
- Users could be marked as verified without actual verification

**Recommendation:**
Implement HMAC signature verification per Persona documentation:
```typescript
const crypto = require('crypto');
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(body)
  .digest('hex');
if (signature !== expectedSignature) {
  return new Response("Invalid signature", { status: 401 });
}
```

---

## Security Recommendations Priority

### Critical (P0) - None identified

### High Priority (P1)
1. **Implement rate limiting** on all endpoints, especially public AI functions
2. **Add input validation** with Zod schemas for all edge functions
3. **Complete Persona webhook signature verification**

### Medium Priority (P2)
4. **Restrict CORS origins** to production domains
5. **Sanitize error messages** to avoid information disclosure
6. **Document security rationale** for all public endpoints
7. **Add API key authentication** for public AI endpoints

### Low Priority (P3)
8. Complete multi-tenant RLS audit
9. Add security logging/monitoring
10. Implement content moderation for AI outputs

---

## Appendix: Public Endpoints Review

| Function | JWT | Purpose | Risk Mitigation |
|----------|-----|---------|-----------------|
| `ai-gateway` | No | AI routing | Needs rate limiting |
| `analyze-syllabus` | No | Public syllabus analysis | Needs rate limiting |
| `analyze-dream-job` | No | Public job analysis | Needs rate limiting |
| `parse-syllabus-document` | No | Document parsing | Needs rate limiting |
| `extract-learning-objectives` | No | LO extraction | Needs rate limiting |
| `search-youtube-manual` | No | YouTube search | Needs rate limiting |
| `fetch-video-metadata` | No | Video metadata | Low risk |
| `stripe-webhook` | No | Payment webhook | Signature verified |
| `idv-webhook` | No | Identity webhook | Signature incomplete |
| `verify-certificate` | No | Public cert check | Low risk |
| `get-onet-occupation` | No | Public occupation data | Low risk |
| `auto-link-courses` | No | Course linking | Needs review |
| `curriculum-reasoning-agent` | No | AI reasoning | Needs rate limiting |
| `generate-lecture-slides-v3` | No | Slide generation | Needs rate limiting |
| `submit-batch-slides` | No | Batch submission | Service role calls |
| `process-batch-research` | No | Research processing | Service role calls |
| `send-digest-email` | No | Email digest | Needs review |
