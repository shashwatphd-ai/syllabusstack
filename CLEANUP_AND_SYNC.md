# Cleanup and Sync Report

## Orphaned Items Found

### Backend Functions (Never Called)

| Function | Status | Action |
|----------|--------|--------|
| `add-instructor-content` | Never called from frontend or backend | DELETE or INTEGRATE |
| `search-educational-content` | Never called - should be used! | INTEGRATE into pipeline |
| `compare-web-providers` | Debug/testing only | KEEP (useful for testing) |
| `send-digest-email` | No cron configured | CONFIGURE or DELETE |
| `stripe-webhook` | Called by Stripe externally | KEEP |

### Frontend Files (Orphaned)

| File | Status | Action |
|------|--------|--------|
| `src/hooks/workflows/useCourseWorkflow.ts` | 0 imports | DELETE |
| `src/hooks/workflows/useDreamJobWorkflow.ts` | 0 imports | DELETE |
| `src/hooks/workflows/useAnalysisWorkflows.ts` | 0 imports | DELETE |
| `src/hooks/useWorkflows.ts` | Only re-exports unused hooks | DELETE |
| `src/lib/api.ts` | 0 imports, marked deprecated | DELETE |
| `src/lib/supabase.ts` | 0 imports, placeholder | DELETE |
| `src/types/database.ts` | 0 imports, doc only | DELETE |
| `src/components/instructor/ModuleCard.tsx` | 0 usages | DELETE (replaced by UnifiedModuleCard) |

### Database Tables (Created but Unused)

| Table | Status | Action |
|-------|--------|--------|
| `api_quota_tracking` | Used by RPC functions | KEEP |
| `discovered_careers` | Never queried | INTEGRATE or DELETE |
| `verified_skills` | Never queried | INTEGRATE or DELETE |

---

## Integration Fixes Needed

### 1. search-educational-content is Orphaned

This function searches Invidious, Piped, Khan Academy, Archive.org, MIT OCW - but it's never called.

**Fix:** Integrate into content search pipeline or remove.

### 2. discovered_careers Table Not Used

Created for AI career discovery but never integrated.

**Fix:** Connect to `discover-dream-jobs` function output.

### 3. verified_skills Table Not Used

Created for tracking verified skills but never queried.

**Fix:** Populate when student passes assessments, query in gap analysis.

---

## Files to Delete

```bash
# Orphaned workflow hooks
rm src/hooks/workflows/useCourseWorkflow.ts
rm src/hooks/workflows/useDreamJobWorkflow.ts
rm src/hooks/workflows/useAnalysisWorkflows.ts
rm src/hooks/useWorkflows.ts

# Deprecated/placeholder files
rm src/lib/api.ts
rm src/lib/supabase.ts
rm src/types/database.ts

# Orphaned component
rm src/components/instructor/ModuleCard.tsx
```

---

## Summary

| Category | Orphaned | Keep | Delete |
|----------|----------|------|--------|
| Backend Functions | 5 | 3 | 2 (add-instructor-content, send-digest-email) |
| Frontend Hooks | 4 | 0 | 4 |
| Frontend Files | 3 | 0 | 3 |
| Frontend Components | 1 | 0 | 1 |
| Database Tables | 2 | 2 | 0 (integrate instead) |

**Total files to delete:** 8
**Functions to integrate:** 1 (search-educational-content)
**Tables to integrate:** 2 (discovered_careers, verified_skills)
