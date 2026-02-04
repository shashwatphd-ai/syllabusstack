
# Fix Duplicate Teaching Units

## Current Issue
Double-clicking the "Analyze & Break Down" button created 8 teaching units instead of 4. Two separate calls to the backend ran ~31 seconds apart, each inserting a full set of units.

## Immediate Fix: Clean Up Duplicates

I will delete the **older** batch of duplicate teaching units and keep the newer ones. The duplicates are:

| Keep (newer batch - 15:17:58) | Delete (older batch - 15:17:27) |
|-------------------------------|----------------------------------|
| PESTEL Framework Fundamentals | Foundations of External Environment |
| Deconstructing Porter's Five Forces | Applying the PESTEL Framework |
| Framework Integration Techniques | Applying Porter's Five Forces |
| Strategic Implications Development | Synthesizing PESTEL and Five Forces |

**SQL to execute:**
```sql
DELETE FROM teaching_units 
WHERE learning_objective_id = 'd4f6ad53-235a-4947-8280-b3830b986791'
  AND created_at = '2026-02-04 15:17:27.044658+00';
```

## Prevention: Server-Side Idempotency

Modify `curriculum-reasoning-agent` to:
1. Check if `decomposition_status` is already `'in_progress'` or `'completed'` before starting
2. Return early with existing units if already completed
3. Use database constraint or atomic check to prevent race conditions

## Prevention: UI Double-Click Protection

Modify `UnifiedLOCard.tsx` to disable the button when:
- `decomposeMutation.isPending` is true (current behavior)
- OR `learningObjective.decomposition_status === 'in_progress'` (new check)

---

## Technical Details

### Edge Function Changes (`curriculum-reasoning-agent`)

Add early return check after fetching the learning objective:

```typescript
// After fetching LO, check status
if (lo.decomposition_status === 'in_progress') {
  return { success: false, error: 'Analysis already in progress' };
}

if (lo.decomposition_status === 'completed') {
  // Fetch and return existing units
  const { data: existingUnits } = await supabase
    .from('teaching_units')
    .select('*')
    .eq('learning_objective_id', learning_objective_id);
  
  if (existingUnits?.length > 0) {
    return { success: true, teaching_units: existingUnits, already_exists: true };
  }
}
```

### UI Changes (`UnifiedLOCard.tsx`)

```typescript
const isAnalyzing = decomposeMutation.isPending || 
  learningObjective.decomposition_status === 'in_progress';

// In button:
<Button
  disabled={isAnalyzing}
  onClick={() => decomposeMutation.mutate(learningObjective.id)}
>
  {isAnalyzing ? <Loader2 /> : <Sparkles />}
  {isAnalyzing ? 'Analyzing...' : 'Analyze & Break Down'}
</Button>
```

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| Database | Delete 4 duplicate teaching units |
| `curriculum-reasoning-agent` | Add idempotency check at start |
| `UnifiedLOCard.tsx` | Disable button based on `decomposition_status` |
