

## Root Cause: OpenRouter API Key Monthly Limit (Not Credits)

### Evidence (from live edge function logs just now)

Every image generation attempt is failing with this exact error:

```text
Key limit exceeded (monthly limit). Manage it using https://openrouter.ai/settings/keys
```

This is NOT a credits issue. OpenRouter has TWO separate controls:
1. **Account credits** (what you topped up) -- this is fine
2. **Per-key monthly spending limit** -- this is what's blocking you

The API key stored in your backend has a monthly cap configured on OpenRouter's side. Even with unlimited credits, the key itself refuses requests once its monthly budget is hit.

### Immediate Fix (User Action -- 30 seconds)

1. Go to [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Find the API key being used (starts with `sk-or-...`)
3. Click edit and **increase or remove the monthly limit**
4. Save

### Code Problems Found (3 Issues)

Even after the key limit is fixed, the current code has structural gaps:

#### Problem 1: "Generate Images" button ignores failed items

The "Generate Images" button sends `{ continue: true }` which ONLY processes `pending` items. All 184 items are `failed` with `attempts = 3`, so the button does nothing. The separate "Retry Failed Images" button exists in code but requires users to notice it -- and it may not be visible if the `imageGenStatus` query result hasn't loaded.

**Fix:** Make the "Generate Images" button smart -- if there are 0 pending items but failed items exist, automatically reset them before processing.

#### Problem 2: 403/402 errors burn all 3 retry attempts instantly

When a billing/key error occurs, the worker processes 3 items, all fail, self-continues, processes 3 more, all fail -- burning through all 184 items' retry budget in seconds. These are NOT transient errors that benefit from retrying.

**Fix:** Add "circuit breaker" logic -- if the first item in a batch fails with 402/403, stop the entire batch immediately and report the billing error. Don't waste remaining retries on a systemic issue.

#### Problem 3: No fallback model for billing errors

When OpenRouter returns 402/403 on the primary model (`gemini-3-pro-image-preview`), the code falls through to the fallback model (`gemini-2.5-flash-image`) only for 5xx errors. Billing errors terminate immediately.

**Fix:** On 402/403 from OpenRouter, attempt the fallback model (`gemini-2.5-flash-image` aka Nano Banana) which is cheaper and may stay under the key limit. This is the same provider and similar quality tier -- not Imagen 4 Ultra.

### Implementation Plan

#### Step 1: Database -- Reset the 184 stuck items

```sql
UPDATE image_generation_queue
SET status = 'pending', attempts = 0, error_message = NULL
WHERE status = 'failed';
```

#### Step 2: Edge Function -- Circuit breaker for billing errors

**File:** `supabase/functions/process-batch-images/index.ts`

In the MODE 1 processing loop (lines 653-686), add circuit breaker logic:
- After processing a concurrent batch, if ALL items failed with the same billing error (402/403), stop the self-continuation loop
- Return the billing error message in the response so the UI can display it
- Do NOT trigger `triggerContinuation()` when a billing error is detected

This prevents the current behavior where the worker burns through all 184 items' retry budgets in 30 seconds on a systemic error.

#### Step 3: Unified AI Client -- Fallback model on billing errors

**File:** `supabase/functions/_shared/unified-ai-client.ts`

In `generateImageOpenRouter()` (around line 442-463), change the HTTP error handling:
- Currently: only 5xx errors trigger fallback to `gemini-2.5-flash-image`
- New: 402 and 403 errors ALSO try the fallback model before returning an error
- The fallback model (`gemini-2.5-flash-image`) is cheaper per-image, so it may succeed under the same key limit

```text
Current flow:
  gemini-3-pro-image → 403 → FAIL (no retry with cheaper model)

Fixed flow:
  gemini-3-pro-image → 403 → gemini-2.5-flash-image → try again → succeed or fail
```

#### Step 4: Frontend -- Merge "Generate" and "Retry" into one smart button

**File:** `src/pages/instructor/InstructorCourseDetail.tsx`

Make the "Generate Images" button handle all states:
- If pending items exist: process them (current behavior)
- If no pending but failed items exist: reset them first, then process
- If a billing error is active: show the error reason in the button tooltip
- Remove the separate "Retry Failed Images" button (merge into the main one)

**File:** `src/hooks/useBatchSlides.ts`

Update `useTriggerImageGeneration` to:
1. Check if queue has failed items (via `imageGenStatus`)
2. If yes, call `reset_failed` mode first, then `continue`
3. If no pending and no failed, call `instructor_course_id` mode to populate

### What Changes for You

```text
Before (current broken flow):
  "Generate Images" → calls { continue: true } → finds 0 pending → nothing happens
  "Retry Failed" button → may not be visible → requires extra click

After (fixed flow):
  "Generate Images" → detects 184 failed → auto-resets → starts processing
  If key limit hit → circuit breaker stops after 1st batch → shows "Key limit exceeded"
  If primary model blocked → falls back to gemini-2.5-flash-image automatically
```

### Files Modified

| File | Change |
|------|--------|
| Database migration | Reset 184 failed items to pending |
| `supabase/functions/process-batch-images/index.ts` | Circuit breaker for billing errors |
| `supabase/functions/_shared/unified-ai-client.ts` | Fallback model on 402/403 |
| `src/pages/instructor/InstructorCourseDetail.tsx` | Merge buttons into one smart button |
| `src/hooks/useBatchSlides.ts` | Auto-reset failed items in trigger hook |

### Prerequisite (Your Action)

Before any code fix matters: go to [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) and raise/remove the monthly limit on your API key. Without this, even the fallback model will hit the same limit.

