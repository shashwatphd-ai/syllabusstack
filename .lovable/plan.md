

# Fix Security Vulnerabilities — Detailed Plan

## Summary of Findings

After investigating each flagged issue against the actual database state, here is what needs fixing and what is already safe.

---

## ERROR 1: Content Table Publicly Readable (NEEDS FIX)

**What's happening now:** The `content` table has an RLS policy called "Anyone can view available content" with `USING (is_available = true)` applied to `{public}` roles. This means unauthenticated (anonymous) users can query 1,726+ curated YouTube videos, including titles, quality scores, channel info, and engagement metrics.

**Why it exists:** Students need to see content matched to their learning objectives. Instructors need to browse content.

**The fix:** Change the policy role from `{public}` (includes anonymous) to `authenticated` only. All legitimate users (students, instructors) are always authenticated.

**Migration SQL:**
```sql
DROP POLICY "Anyone can view available content" ON public.content;

CREATE POLICY "Authenticated users can view available content"
  ON public.content
  FOR SELECT
  TO authenticated
  USING (is_available = true);
```

**Impact check:** The frontend only queries `content` from `useContentRating.ts` (fetching ratings for a specific content ID). Students access content through `content_matches` and consumption records. All these flows require authentication. No breakage expected.

---

## ERROR 2: Certificate Enumeration via Anon Policy (NEEDS FIX)

**What's happening now:** The `certificates` table has an anon SELECT policy: "Public certificate verification via share token" with `USING (share_token IS NOT NULL AND status = 'active')`. This allows unauthenticated users to enumerate ALL active certificates with share tokens -- not just look up a specific one. The `certificates_public_verify` view inherits this via `security_invoker=on`.

**Why it exists:** The `verify-certificate` edge function is a public endpoint for employers to verify a certificate. However, the edge function already uses the **service role key** (bypasses RLS entirely), so it does NOT need an anon RLS policy at all.

**The fix:** Remove the anon SELECT policy. The verify-certificate edge function will continue working unchanged since it uses the service role. Keep the view for any future needs but it will no longer be queryable by anonymous users.

**Migration SQL:**
```sql
DROP POLICY "Public certificate verification via share token" ON public.certificates;
```

**Impact check:** Verified that `verify-certificate/index.ts` creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY`, so it bypasses all RLS. No frontend code queries `certificates_public_verify` directly. No breakage.

---

## WARNING: Organizations Safe View (NO FIX NEEDED)

**What's actually happening:** The `organizations_safe` view already has `security_invoker=on`. This means it inherits the caller's RLS context. The base `organizations` table has an RLS policy requiring the user to be an organization member. Anonymous users cannot read this view. The CASE-based column masking further hides sensitive fields from non-admin members.

**Action:** Update the security scan finding to mark this as a false positive / ignored.

---

## WARNING: Profiles Stripe IDs (MINOR FIX)

**What's happening now:** The profiles table RLS lets users SELECT their own row, which includes `stripe_customer_id` and `stripe_subscription_id`. The frontend already strips these via TypeScript `Omit<>`, but they still travel over the network.

**Why it matters:** If a browser extension, network proxy, or XSS attack reads the response, the Stripe IDs are exposed.

**The fix:** Create a `profiles_safe` view that excludes Stripe columns, with `security_invoker=on`. Then update frontend queries to use the view. The base table remains accessible for edge functions via service role.

**Migration SQL:**
```sql
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker=on) AS
  SELECT
    id, user_id, full_name, email, avatar_url,
    student_level, learning_style, preferred_pace,
    subscription_tier, subscription_status, subscription_ends_at,
    ai_calls_this_month, ai_calls_reset_at,
    is_instructor_verified, instructor_verification_id, instructor_trust_score,
    organization_id, preferences,
    onboarding_completed, created_at, updated_at
  FROM public.profiles;
  -- Excludes: stripe_customer_id, stripe_subscription_id
```

**Frontend changes:**
- Update `src/hooks/useProfile.ts` to query from `profiles_safe` instead of `profiles`
- Update `src/contexts/AuthContext.tsx` profile fetch to use `profiles_safe`
- Remove the TypeScript `Omit<>` workarounds since the view already excludes those fields

---

## WARNING: Tables with RLS but No Policies (MINOR FIX)

**Table:** `image_generation_queue` (1,609 rows, RLS enabled, zero policies)

**What's happening:** This table is completely inaccessible to all users (including authenticated ones). Only service role can read/write. This is likely intentional for a backend-only queue.

**The fix:** Add a comment and a restrictive policy to make intent explicit:

```sql
COMMENT ON TABLE public.image_generation_queue IS 
  'Service-role only queue for image generation. No user access intended.';

CREATE POLICY "Service role only - no direct user access"
  ON public.image_generation_queue
  FOR ALL
  TO authenticated
  USING (false);
```

---

## WARNING: Edge Functions without JWT (NO CODE FIX -- DOCUMENTATION)

16 functions have `verify_jwt=false`. Per the project's architecture, this is correct because:
- Webhook handlers (stripe-webhook) verify signatures manually
- Some functions (submit-batch-slides, process-batch-research) are called by service role from other functions
- Public lookup functions (verify-certificate, get-onet-occupation) are intentionally public

The scan finding should be marked as reviewed/ignored with documentation.

---

## Files Changed Summary

| Change | File | Type |
|--------|------|------|
| Tighten content table policy | Database migration | SQL |
| Remove anon certificate policy | Database migration | SQL |
| Create profiles_safe view | Database migration | SQL |
| Add image_generation_queue policy | Database migration | SQL |
| Use profiles_safe in queries | `src/hooks/useProfile.ts` | Frontend |
| Use profiles_safe in auth context | `src/contexts/AuthContext.tsx` | Frontend |
| Update security findings | Security scan tool | Metadata |

## What Stays the Same

- All instructor flows (course creation, slide generation, audio generation)
- All student flows (enrollment, content viewing, assessments, certificates)
- verify-certificate edge function (uses service role, unaffected by RLS changes)
- organizations_safe view (already secure)
- All edge functions (no code changes)
- All existing RLS policies on other tables

