
# Plan: Auto-Recovery for Stuck Slide Generation

## Problem Summary
The slide generation UI shows "Generating..." and "Preparing..." states permanently because:
1. Database contains 5 slides stuck in `generating` and 4 in `preparing` since January 29th
2. A batch job is stuck in `researching` status with no progress
3. No automatic cleanup mechanism detects and resets stale jobs
4. The frontend trusts database status without checking staleness

---

## Solution Overview

Implement a **self-healing system** that automatically detects and resets stale generation jobs, ensuring the UI reflects accurate state and allows users to retry cleanly.

---

## Technical Implementation

### 1. Enhanced `poll-batch-status` with Auto-Reset Logic

Modify the edge function to automatically detect and reset stale records during polling:

```text
┌─────────────────────────────────────────────────────────┐
│  poll-batch-status (enhanced)                          │
├─────────────────────────────────────────────────────────┤
│  1. Query slides and batch jobs                        │
│  2. Detect stale records (>30 min for intermediate)    │
│  3. Auto-reset: generating/preparing → pending or fail │
│  4. Auto-reset: batch_jobs researching → failed        │
│  5. Return clean counts to frontend                    │
└─────────────────────────────────────────────────────────┘
```

**Staleness thresholds:**
- `generating` slides: >30 minutes → reset to `failed` with error message
- `preparing` slides: >30 minutes → reset to `pending` 
- `batch_pending` slides: >60 minutes without progress → reset to `pending`
- `researching` batch jobs: >30 minutes → mark as `failed`

### 2. Cleaner UI State Logic

Update frontend to show accurate generation state:

**Current (problematic):**
```
if (generating > 0) → show "Generating..."
```

**New (improved):**
```
if (active_batch && !active_batch.is_stale) → show batch progress
else if (generating > 0 && hasRecentActivity) → show "Generating..."
else → show "Generate All Slides" button (ready state)
```

The backend will reset stale counts, so the frontend can trust the data.

### 3. Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/poll-batch-status/index.ts` | Add auto-reset logic for stale slides and batch jobs |
| `src/hooks/useBatchSlides.ts` | Add `is_stale` field parsing from response |
| `src/pages/instructor/InstructorCourseDetail.tsx` | Simplify logic (backend handles cleanup) |

---

## Detailed Changes

### A. poll-batch-status Edge Function

Add a new function `resetStaleRecords()` that runs during every poll:

1. **Find stale slides:**
   - Status is `generating`, `preparing`, or `batch_pending`
   - Last `updated_at` is older than 30 minutes

2. **Reset logic:**
   - `generating` → `failed` with message "Generation timed out - please retry"
   - `preparing` → `pending` (allows clean restart)
   - `batch_pending` → `pending` (allows clean restart)

3. **Find stale batch jobs:**
   - Status is `researching`, `submitted`, or `processing`
   - No `google_batch_id` or last update > 30 minutes

4. **Reset batch jobs:**
   - Mark as `failed` with appropriate error message
   - Clear slides linked to this job back to `pending`

### B. Frontend Simplification

The frontend no longer needs complex staleness detection because:
- Backend auto-resets stale records before returning counts
- `generating` count only includes truly active generation
- `active_batch` only present when a real batch is in progress

### C. Add Manual Reset Button (Optional UX Enhancement)

Add a small "Reset stuck items" button that appears when:
- No active batch but `generating > 0` persists for 2+ minutes
- Calls the existing `cleanup-stuck` action with expanded scope

---

## Data Migration (One-Time Cleanup)

Before deploying, run a one-time SQL to clear the current stuck data:

```sql
-- Reset stuck slides to failed state
UPDATE lecture_slides 
SET status = 'failed', 
    error_message = 'Generation timed out - please retry'
WHERE status IN ('generating', 'preparing', 'batch_pending')
AND updated_at < NOW() - INTERVAL '30 minutes';

-- Mark stuck batch job as failed
UPDATE batch_jobs 
SET status = 'failed',
    error_message = 'Research phase timed out - please retry'
WHERE status = 'researching'
AND updated_at < NOW() - INTERVAL '30 minutes';
```

---

## Expected Behavior After Fix

1. **On page load:** Backend detects stale records, resets them, returns clean counts
2. **UI shows:** "Generate All Slides" button (not stuck spinner)
3. **When user clicks:** New batch job starts fresh
4. **If generation stalls:** Auto-reset kicks in within 30 minutes
5. **User can always:** Click the button to start a new generation

---

## Testing Verification

After implementation:
1. Visit the instructor course detail page
2. Verify "Generating..." spinner is gone
3. Click "Generate All Slides" to start fresh
4. Verify stuck records were cleaned up in database

