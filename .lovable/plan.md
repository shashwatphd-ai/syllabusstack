
# Fix All Build Errors (10 issues across 8 files)

These are all pre-existing issues exposed by the build checker. No logic changes -- just fixing types, imports, and variable scoping so everything compiles and deploys cleanly.

---

## 1. Stripe `apiVersion` mismatch (5 files)

The installed Stripe SDK v18.5.0 expects `"2025-08-27.basil"` but code says `"2023-10-16"`.

**Fix:** Remove `apiVersion` from all Stripe constructors so the SDK uses its built-in default.

| File | Line |
|------|------|
| `cancel-subscription/index.ts` | 26 |
| `create-portal-session/index.ts` | 26 |
| `get-invoices/index.ts` | 26 |
| `purchase-certificate/index.ts` | 108 |
| `stripe-webhook/index.ts` | 28 |

## 2. `current_period_end` type errors (cancel-subscription + stripe-webhook)

With the updated SDK types, `current_period_end` moves from a direct property to being accessed properly. 

**Fix:** After removing `apiVersion`, the SDK's default types will expose `current_period_end` correctly. No additional code changes needed beyond fix #1.

## 3. Duplicate import in `fetch-video-metadata/index.ts`

Line 1 and line 2 are identical CORS imports.

**Fix:** Delete line 2.

## 4. `serve()` not defined in `poll-active-batches/index.ts`

Line 56 uses bare `serve(...)` which is not imported or globally available.

**Fix:** Change `serve(` to `Deno.serve(`.

## 5. `.catch()` on PromiseLike in `process-syllabus/index.ts`

Supabase client returns `PromiseLike` which lacks `.catch()`. Line 617.

**Fix:** Wrap in `Promise.resolve()` so `.then().catch()` works:
```typescript
Promise.resolve(
  supabaseClient
    .from('instructor_courses')
    .update({ domain_config: enrichedConfig })
    .eq('id', instructor_course_id)
)
  .then(() => console.log('...'))
  .catch((e: unknown) => console.warn('...'));
```

## 6. Missing `course` variable in `process-batch-research/index.ts`

Line 194 inside `processBatchViaOpenRouter()` references `course.detected_domain` but `course` is not in scope -- it's only in the main handler.

**Fix:** Add a `domain: string` parameter to `processBatchViaOpenRouter()` and pass `course.detected_domain || 'general'` from the caller (line 681). Use `domain` instead of `course.detected_domain` on line 194.

## 7. Frontend type cast in `src/hooks/lectureSlides/queries.ts`

The lightweight select query doesn't include `generation_context`, `generation_model`, `audio_generated_at`, `created_by`, or `slides`, so TypeScript won't cast directly to `LectureSlide[]`.

**Fix:**
- Line 177: `slide.slides` doesn't exist in the select -- default to empty array: `slides: [] as Slide[]`
- Line 178: Cast through `unknown`: `as unknown as LectureSlide[]`

---

## Summary

| # | File | What changes |
|---|------|-------------|
| 1 | `cancel-subscription/index.ts` | Remove `apiVersion` from Stripe constructor |
| 2 | `create-portal-session/index.ts` | Remove `apiVersion` from Stripe constructor |
| 3 | `get-invoices/index.ts` | Remove `apiVersion` from Stripe constructor |
| 4 | `purchase-certificate/index.ts` | Remove `apiVersion` from Stripe constructor |
| 5 | `stripe-webhook/index.ts` | Remove `apiVersion` from Stripe constructor |
| 6 | `fetch-video-metadata/index.ts` | Delete duplicate import line |
| 7 | `poll-active-batches/index.ts` | `serve(` to `Deno.serve(` |
| 8 | `process-syllabus/index.ts` | Wrap fire-and-forget in `Promise.resolve()` |
| 9 | `process-batch-research/index.ts` | Add `domain` param, pass from caller |
| 10 | `src/hooks/lectureSlides/queries.ts` | Fix type cast + default empty slides |

All edge functions will be redeployed after fixes. Zero logic changes -- purely compilation fixes.
