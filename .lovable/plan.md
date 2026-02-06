

# Plan: Enable Google Image Provider and Process Queue

## Overview

This plan will switch image generation to native Google Cloud API and restart processing for all pending/failed images.

---

## Steps

### Step 1: Add IMAGE_PROVIDER Secret
- **Action:** Add environment secret `IMAGE_PROVIDER` with value `google`
- **Effect:** All image generation calls will route to native Google API instead of OpenRouter

### Step 2: Reset Failed Images to Pending
- **Action:** Execute SQL to reset the 135 failed images:
```sql
UPDATE image_generation_queue 
SET status = 'pending', 
    attempts = 0, 
    error_message = NULL,
    updated_at = NOW()
WHERE status = 'failed';
```
- **Effect:** Failed images become eligible for retry

### Step 3: Trigger Image Processing
- **Action:** Call `process-batch-images` edge function to start processing
- **Effect:** Queue processor picks up pending items and generates via Google API

---

## Expected Outcome

| Before | After |
|--------|-------|
| Provider: OpenRouter (402 errors) | Provider: Google Direct |
| Failed: 135 | Failed: 0 (reset to pending) |
| Pending: 392 | Pending: 527 (392 + 135) |
| Processing: Stopped | Processing: Active |

---

## Files Changed

| File | Change |
|------|--------|
| Environment Secrets | Add `IMAGE_PROVIDER=google` |
| Database | Reset failed queue items |
| Edge Function | Trigger `process-batch-images` |

