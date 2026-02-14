

## Fix Build Errors and React #310 Crash

There are 4 distinct issues to fix across 4 files.

### Issue 1: React Error #310 -- Hooks called after conditional returns (CRASH)

**File:** `src/pages/student/StudentCourseDetail.tsx`

The `useQuery` hook on line 79 is called AFTER early return statements on lines 40-48 and 50-66. React requires all hooks to be called in the same order on every render. When the component is loading or has an error, the hook is skipped, causing the crash.

**Fix:** Move the `useQuery` call above all conditional returns, right after line 38. Compute `loIds` from the course data only when available (defaulting to an empty array when course is null).

### Issue 2: TypeScript type mismatch on joined query results

**File:** `supabase/functions/search-youtube-content/index.ts` (lines 213-214)

The Supabase `.select()` with joined relations (`module:module_id(...)`, `course:instructor_course_id(...)`) returns arrays, not single objects, when TypeScript infers the type. The `as { title: string; ... }` cast fails because the actual type is an array.

**Fix:** Cast through `unknown` first:
- `contextData.module as unknown as { title: string; description?: string } | null`
- `contextData.course as unknown as { title: string; ... } | null`

### Issue 3: Stripe `current_period_end` type error

**File:** `supabase/functions/cancel-subscription/index.ts` (lines 75, 79, 83)

The `stripe.subscriptions.update()` return type (`Response<Subscription>`) wraps the subscription object. The property `current_period_end` exists on the inner `Subscription` type, not the response wrapper.

**Fix:** Cast `subscription` as `any` for the `current_period_end` access, or use `(subscription as any).current_period_end`.

### Issue 4: Same Stripe type error in webhook handler

**File:** `supabase/functions/stripe-webhook/index.ts` (lines 222-223, 276-277)

Same `current_period_end` property access issue on lines 222-223 (inside `handleCheckoutCompleted`) and 276-277 (inside `handleSubscriptionUpdate`).

**Fix:** Same approach -- cast through `any` for the timestamp access.

### Summary of Changes

| File | Lines | Fix |
|------|-------|-----|
| `StudentCourseDetail.tsx` | 40-90 | Move `useQuery` above conditional returns |
| `search-youtube-content/index.ts` | 213-214 | Cast joined relations through `unknown` |
| `cancel-subscription/index.ts` | 75, 79, 83 | Cast `subscription` for `current_period_end` |
| `stripe-webhook/index.ts` | 222-223, 276-277 | Cast `subscription` for `current_period_end` |

