

## Fix 3 Errors in Module Analysis Flow

### Fix 1: VerificationBanner `.single()` to `.maybeSingle()` 

**File:** `src/components/instructor/VerificationBanner.tsx` (line 147)

Change `.single()` to `.maybeSingle()`. The downstream code already handles `null` via optional chaining (`pendingRequest?.status === 'pending'`), so no other changes needed.

**Risk:** Zero. This is the documented PostgREST pattern for "might not exist" queries.

---

### Fix 2: poll-batch-status auth method

**File:** `supabase/functions/poll-batch-status/index.ts` (lines 53-62)

Replace:
```typescript
const { data: claims, error: authError } = await anonClient.auth.getClaims(
  authHeader.replace("Bearer ", "")
);
if (authError || !claims?.claims?.sub) {
```

With:
```typescript
const { data: { user }, error: authError } = await anonClient.auth.getUser();
if (authError || !user) {
```

**Why not fix the other 3 functions using `getClaims()`?** Those (`submit-assessment-answer`, `start-assessment`, `complete-assessment`) import from the Deno import map (`npm:@supabase/supabase-js@^2.49.0`) which includes `getClaims()`. Only `poll-batch-status` uses the older pinned esm.sh import (`@2.47.12`). They are not broken.

**Risk:** Zero. The `user` object is only checked for existence (authentication gate). No code downstream references `claims.sub`.

---

### Fix 3: Resilient JSON parsing in curriculum-reasoning-agent

**File:** `supabase/functions/curriculum-reasoning-agent/index.ts`

Two changes:

1. **Import**: Replace `parseJsonResponse` with `parseJsonFromAI` from `slide-prompts.ts` (line 3)
2. **Usage**: Replace `parseJsonResponse<DecomposeResponse>(result.content)` with `parseJsonFromAI(result.content)` (line 199)

`parseJsonFromAI` is a strict superset of `parseJsonResponse`:
- Strategy 1: Extract from markdown code blocks (same as `parseJsonResponse`)
- Strategy 2: Find outermost `{...}` braces
- Strategy 3: Repair truncated JSON by closing open delimiters

The existing error handling (lines 328-335) and fallback models (line 188) remain untouched.

**Risk:** Zero. `parseJsonFromAI` tries the exact same `JSON.parse` first, then falls through to repair strategies only if that fails.

---

### Summary

| Fix | Type | Risk | Breaks anything? |
|-----|------|------|-------------------|
| `.maybeSingle()` | Bug fix | None | No -- downstream already null-safe |
| `getUser()` | Bug fix | None | No -- only used as auth gate |
| `parseJsonFromAI` | Resilience | None | No -- superset of current parser |

All three follow existing patterns already used elsewhere in the codebase.

