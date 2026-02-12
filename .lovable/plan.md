

# Fix Two Build Errors from PR #109 Merge

Two type-checking errors need trivial fixes. No logic changes.

## Error 1: `generate-lecture-slides-v3/index.ts` line 157

`'error' is of type 'unknown'` -- the `catch` block doesn't type the error variable.

**Fix:** Change line 157 from:
```
throw new Error(`Failed to parse Professor AI response: ${error.message}`);
```
to:
```
throw new Error(`Failed to parse Professor AI response: ${error instanceof Error ? error.message : String(error)}`);
```

## Error 2: `poll-batch-status/index.ts` line 240

`selfHealSlides` parameter typed as `ReturnType<typeof createClient>` causes a generic mismatch with the actual `supabase` client instance.

**Fix:** Change the `supabase` parameter type on line 240 from:
```
supabase: ReturnType<typeof createClient>,
```
to:
```
// deno-lint-ignore no-explicit-any
supabase: any,
```

This matches the pattern used elsewhere in the codebase for passing Supabase clients between functions where the generic schema type is irrelevant.

## Summary

- Two one-line fixes
- Zero logic changes
- Both are TypeScript strictness issues, not functional bugs

