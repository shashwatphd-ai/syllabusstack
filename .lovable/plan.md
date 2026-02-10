

## Fix: Missing Slide Images (61 Failed Due to OpenRouter 402)

### Root Cause

The missing images are **not a code bug**. All 61 failed image queue items show the same error:

> **"OpenRouter returned HTTP 402: Payment Required"**

This means the OpenRouter account ran out of credits during image generation. The slides that were generated before credits ran out have images; the ones queued after do not.

### Current State

| Queue Status | Count | Notes |
|---|---|---|
| Completed | 1,285 | Images rendered correctly |
| Failed | 61 | All due to 402 Payment Required |
| Processing (stuck) | 2 | Likely timed out, need reset |

All 61 failures span across 15 slide decks. The yellow fallback text you see ("Visual: A 'Bridge' diagram...") is the expected behavior when no image URL exists -- the frontend correctly shows the description instead.

### Fix: Two-Part Solution

#### Part 1: Switch image provider to Lovable AI (no external credits needed)

The codebase already supports routing image generation through the Lovable AI gateway (`LOVABLE_API_KEY`), which uses Google Gemini models without needing OpenRouter credits. We will update the `generateImage` function to add a Lovable AI fallback when OpenRouter returns a 402 error, so image generation never silently fails due to billing issues again.

**File:** `supabase/functions/_shared/unified-ai-client.ts`

Changes:
- In `generateImageOpenRouter()`, catch 402 errors and automatically retry via the Lovable AI gateway (`ai.gateway.lovable.dev`) using `google/gemini-2.5-flash-image`
- This acts as an automatic fallback -- no manual provider switching needed

#### Part 2: Reset and retry the 61 failed + 2 stuck queue items

Run a database update to reset the failed/stuck items so the `process-batch-images` worker can retry them (now with the Lovable AI fallback in place):

```sql
UPDATE image_generation_queue
SET status = 'pending', attempts = 0, error_message = NULL
WHERE status IN ('failed', 'processing');
```

Then trigger the `process-batch-images` function to start processing the reset items.

### What Will NOT Change

- Slide content generation (working correctly)
- Audio generation pipeline (just fixed)
- Frontend rendering logic (already handles fallbacks correctly)
- Any existing completed images (1,285 images stay as-is)

### Technical Detail: Fallback Flow

```
Image Request
  → Try OpenRouter (primary model)
  → If 402 → Try Lovable AI gateway (google/gemini-2.5-flash-image)
  → If still fails → Mark as failed with error
```

### Deployment

1. Edit `unified-ai-client.ts` to add Lovable AI fallback
2. Deploy `process-batch-images` (picks up shared code changes)
3. Reset failed queue items via SQL
4. Trigger batch processing to retry

