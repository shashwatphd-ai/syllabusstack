

## Fix: "Found undefined videos" Toast and Batch Save Failures

### Root Cause

Two separate but related bugs:

1. **Toast shows "undefined"**: The `search-youtube-content` edge function has two response paths — **sync mode** returns `total_found` and `auto_approved_count`, but **batch mode** returns `videos_discovered` instead. The frontend toast always reads `data.total_found`, which is undefined in batch mode.

2. **Zero records saved**: The batch mode tries to insert content matches with status `pending_evaluation`, but the `content_matches_status_check` database constraint doesn't include that value. Every insert fails with the constraint violation error visible in the logs.

### Changes

#### 1. Fix the database constraint

Add `pending_evaluation` to the `content_matches_status_check` constraint so batch-discovered videos can be saved.

```sql
ALTER TABLE content_matches
  DROP CONSTRAINT content_matches_status_check,
  ADD CONSTRAINT content_matches_status_check
    CHECK (status IN ('pending', 'pending_evaluation', 'auto_approved', 'approved', 'rejected', 'skipped'));
```

#### 2. Fix the frontend toast to handle both response shapes

**File:** `src/hooks/useLearningObjectives.ts` (line 176-179)

Update the `onSuccess` handler to read from whichever fields exist:

```typescript
onSuccess: (data, variables) => {
  queryClient.invalidateQueries({ queryKey: ['content-matches', variables.id] });
  const found = data.total_found ?? data.videos_discovered ?? 0;
  const autoApproved = data.auto_approved_count ?? 0;
  const description = data.batch_evaluation_pending
    ? `Discovered ${found} videos, queued for evaluation`
    : `Found ${found} videos, ${autoApproved} auto-approved`;
  toast({ title: 'Content Found', description });
},
```

### What Will NOT Change

- The edge function logic itself (both sync and batch paths work correctly, the issue is field naming and constraint)
- The teaching unit search flow (uses a different code path)
- Any existing content matches already in the database
