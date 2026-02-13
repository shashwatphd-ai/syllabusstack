
# Fix All 7 Batch Audio Bugs

## Overview
This plan fixes 2 critical bugs, 3 medium flaws, and 2 low-severity issues in the batch audio generation pipeline. No existing pipeline logic is changed -- only the specific bugs are corrected.

## Bug Fixes

### BUG 1 (CRITICAL): Offset pagination skips units
**File:** `supabase/functions/generate-batch-audio/index.ts`
**Root cause:** The query filters `has_audio = false`, so processed units disappear from results. But the offset from the previous invocation is applied to this shorter list, skipping items.
**Fix:** Remove the offset parameter entirely. Always query with `LIMIT BATCH_SIZE` from the top. Since processed units drop out of the result set (`has_audio` flips to `true`), the next batch naturally picks up the next unprocessed units. Also add `.not('audio_status', 'eq', 'generating')` to avoid double-processing units.

### BUG 2 (CRITICAL): `has_audio = true` on partial success
**File:** `supabase/functions/generate-lecture-audio/index.ts`, line 339
**Root cause:** `updatedSlides.some(s => s.audio_url)` marks the unit as complete even if only 1 of 20 slides got audio.
**Fix:** Change `.some()` to `.every()` so that `has_audio` is only `true` when all slides in the unit have audio. Partially-completed units stay in the "needs audio" queue.

### FLAW 3 (MEDIUM): SSML transformer dead code
**Action:** No code change. This is a planned feature for future quality improvement. Documenting as known unused code. No pipeline impact.

### FLAW 4 (MEDIUM): Polling timeout leaves units stuck in `generating`
**File:** `supabase/functions/generate-batch-audio/index.ts`, after polling loop
**Fix:** After the polling loop exits without reaching `ready` or `failed`, explicitly update the unit to `audio_status = 'failed'`. This prevents infinite stuck loops where the self-healing guard in `generate-lecture-audio` keeps returning `alreadyGenerating`.

### FLAW 5 (MEDIUM): Single fire-and-forget self-continuation with no retry
**File:** `supabase/functions/generate-batch-audio/index.ts`, self-continuation block
**Fix:** Replace the single fire-and-forget `fetch().catch()` with a retry loop (3 attempts, exponential backoff). Each attempt is awaited with a 10s timeout. Log an error if all attempts fail so the issue is visible.

### FLAW 6 (LOW): `has_audio` type mismatch
**File:** `src/hooks/lectureSlides/types.ts`, line 166
**Fix:** Change `has_audio: boolean` to `has_audio: boolean | null` to match the database schema where new rows can have `null`.

### FLAW 7 (LOW): Batch orchestrator blocks on full audio response
**File:** `supabase/functions/generate-batch-audio/index.ts`, the `await fetch(generate-lecture-audio)` call
**Fix:** Add `AbortSignal.timeout(30_000)` to the initial fetch so the orchestrator doesn't block indefinitely waiting for the full response. The polling loop handles the actual completion detection. Also mark failed units in the catch block so they don't stay stuck.

## Files Changed

| File | Changes |
|------|---------|
| `supabase/functions/generate-batch-audio/index.ts` | Full rewrite: remove offset, use LIMIT, add timeout marking, retry self-continuation |
| `supabase/functions/generate-lecture-audio/index.ts` | Line 339: `.some()` to `.every()` |
| `src/hooks/lectureSlides/types.ts` | Line 166: `boolean` to `boolean \| null` |

## Technical Details

### generate-batch-audio rewrite key changes:

```text
BEFORE (buggy):
  Query all pending -> slice(offset, offset + BATCH_SIZE) -> process -> self-invoke(offset + processed)
  
AFTER (fixed):
  Query pending with LIMIT BATCH_SIZE -> process -> re-count remaining -> self-invoke (no offset)
```

### generate-lecture-audio single-line fix:
```typescript
// BEFORE (Bug 2):
has_audio: updatedSlides.some(s => s.audio_url),

// AFTER:
has_audio: updatedSlides.length > 0 && updatedSlides.every(s => s.audio_url),
```

### Types fix:
```typescript
// BEFORE (Flaw 6):
has_audio: boolean;

// AFTER:
has_audio: boolean | null;
```

## Pipeline Safety
- No changes to `generate-lecture-audio` logic beyond the single `.some()` to `.every()` fix
- No changes to the TTS client, AI narrator, segment mapper, or any shared utilities
- No database schema changes required
- The batch orchestrator changes are internal to its own file and don't affect any other edge function
- Frontend hook logic (`audio.ts`) is unchanged -- the `!s.has_audio` filter already handles `null` correctly
