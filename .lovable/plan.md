

# Plan: Scalable Batch Status Polling Architecture

## Problem Statement

The current polling architecture calls the Vertex AI API directly from `poll-batch-status` edge function **every time a frontend user polls** (every 10 seconds). With 1000 users watching batch jobs, this results in 1000+ Vertex AI API calls per minute, exceeding Google's quota of ~600 CRUD operations/minute.

---

## Solution: Single-Worker Polling Pattern

Shift from **"every user polls Vertex"** to **"one worker polls Vertex, users receive Realtime updates"**.

```text
BEFORE (Broken at Scale):
  1000 users × 6 polls/min = 6000 Vertex API calls/min → 429 errors

AFTER (Scales to 100K users):
  1 cron job × 2 polls/min = 2 Vertex API calls per active batch/min
  Users receive instant updates via Supabase Realtime WebSocket
```

---

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌─────────────┐        ┌─────────────────┐                       │
│   │  pg_cron    │───────►│ poll-active-    │──────► Vertex AI API  │
│   │  (30 sec)   │        │ batches         │        (1 call/batch) │
│   └─────────────┘        └────────┬────────┘                       │
│                                   │                                 │
│                          UPDATE batch_jobs                          │
│                                   │                                 │
│                                   ▼                                 │
│                       ┌───────────────────────┐                    │
│                       │   Supabase Realtime   │                    │
│                       │   (postgres_changes)  │                    │
│                       └───────────┬───────────┘                    │
│                                   │                                 │
│           ┌───────────────────────┼───────────────────────┐        │
│           ▼                       ▼                       ▼        │
│     ┌──────────┐           ┌──────────┐           ┌──────────┐    │
│     │  User 1  │           │  User 2  │           │User 1000 │    │
│     │  (ws)    │           │  (ws)    │           │  (ws)    │    │
│     └──────────┘           └──────────┘           └──────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Result: 2 Vertex API calls/min instead of 6000
```

---

## Implementation Tasks

### Task 1: Create Single-Worker Polling Edge Function

**New File:** `supabase/functions/poll-active-batches/index.ts`

This function will:
- Query all `batch_jobs` with status IN ('submitted', 'processing', 'researching')
- Poll Vertex AI API once per active batch (with exponential backoff)
- Update `batch_jobs` table with current status
- The database update triggers Supabase Realtime → all subscribed frontends update

**Key Logic:**
```text
// Exponential backoff for Vertex AI calls
const POLL_DELAYS = [30, 60, 120, 240]; // seconds between retries on 429
let delay = POLL_DELAYS[0];

for (const batch of activeBatches) {
  try {
    const status = await batchClient.getBatchJob(batch.google_batch_id);
    await updateBatchStatus(batch.id, status);
    delay = POLL_DELAYS[0]; // Reset on success
  } catch (error) {
    if (error.status === 429) {
      delay = Math.min(delay * 2, POLL_DELAYS[3]);
      await sleep(delay * 1000);
    }
  }
}
```

---

### Task 2: Modify poll-batch-status to Be Read-Only

**File:** `supabase/functions/poll-batch-status/index.ts`

**Changes:**
- Remove all Vertex AI API calls (lines 102-158)
- Remove batchClient initialization
- Only read status from database
- Keep `processCompletedBatch` but don't call Vertex API

**Before (lines 102-158):**
```text
if (batchClient && batchJob.google_batch_id) {
  const vertexStatus = await batchClient.getBatchJob(batchJob.google_batch_id);
  // ... updates database ...
}
```

**After:**
```text
// Just return current database status
// Vertex polling is handled by poll-active-batches cron job
return createSuccessResponse({
  success: true,
  batch_job: batchJob,
  is_complete: ['completed', 'failed', 'partial'].includes(batchJob.status),
  progress_percent: calculateProgress(batchJob),
}, corsHeaders);
```

---

### Task 3: Set Up pg_cron Trigger

**SQL Migration:**
```sql
-- Enable pg_cron extension (already enabled)
-- Create cron job to poll active batches every 30 seconds

SELECT cron.schedule(
  'poll-active-batches',
  '*/30 * * * * *', -- Every 30 seconds
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/poll-active-batches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

### Task 4: Update Frontend Polling Intervals

**File:** `src/hooks/useBatchSlides.ts`

**Changes at lines 284-293 and 395-404:**

```text
// BEFORE: Poll every 10 seconds (causes 429s)
refetchInterval: (query) => {
  if (data?.is_complete) return false;
  return 10000; // 10 seconds
},

// AFTER: Rely on Realtime, use 60s fallback only
refetchInterval: (query) => {
  if (data?.is_complete) return false;
  return 60000; // 60 seconds (safety net, not primary)
},
```

---

### Task 5: Add Exponential Backoff to poll-active-batches

**In poll-active-batches/index.ts:**

```text
const BACKOFF_CONFIG = {
  initialDelay: 1000,    // 1 second
  maxDelay: 60000,       // 60 seconds
  multiplier: 2,
  maxRetries: 3,
};

async function pollWithBackoff(batchClient, batch, attempt = 0) {
  try {
    return await batchClient.getBatchJob(batch.google_batch_id);
  } catch (error) {
    if (error.status === 429 && attempt < BACKOFF_CONFIG.maxRetries) {
      const delay = Math.min(
        BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, attempt),
        BACKOFF_CONFIG.maxDelay
      );
      await sleep(delay);
      return pollWithBackoff(batchClient, batch, attempt + 1);
    }
    throw error;
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/poll-active-batches/index.ts` | **NEW** - Single-worker polling with exponential backoff |
| `supabase/functions/poll-batch-status/index.ts` | Remove Vertex API calls, read-only from database |
| `src/hooks/useBatchSlides.ts` | Change refetchInterval from 10s to 60s |
| SQL Migration | Add pg_cron job for poll-active-batches every 30s |

---

## Scalability Comparison

| Metric | Current | After Fix |
|--------|---------|-----------|
| Vertex API calls with 10 active batches | 600/min per 100 users | **20/min total** |
| Vertex API calls with 100 active batches | **6000/min (429s)** | **200/min total** |
| Frontend update latency | 10 seconds | **< 1 second (Realtime)** |
| Can handle 1000 users | ❌ No | ✅ Yes |
| Can handle 100K users | ❌ No | ✅ Yes |

---

## Testing Checklist

After implementation:
- Verify pg_cron job runs every 30 seconds
- Confirm Vertex API is only called from poll-active-batches (check logs)
- Test Realtime updates are received by frontend within 1 second of batch status change
- Confirm no 429 errors with 10+ concurrent batch viewers
- Verify fallback polling at 60s works when Realtime disconnects
- Load test with 100 simulated concurrent users watching batches

---

## Expected Outcome

1. **No more 429 errors** - Single worker polls Vertex, not every user
2. **Faster UI updates** - Realtime pushes updates instantly vs 10s polling
3. **Scales to 100K users** - WebSocket connections are cheap, API calls are expensive
4. **Lower costs** - Fewer Edge Function invocations, fewer Vertex API calls

