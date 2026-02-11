

# Combined Fix: Audio Cleanup, Assessment Error Handling, State Recovery, and Navigation

## 4 Problems to Fix

### Problem 1: Audio keeps playing after navigating away

The audio effect uses a closure-scoped `let isMounted = true` variable. When navigation happens (back button, sidebar link), the component unmounts but there is a race condition: if the signed URL promise resolves in the micro-window between cleanup and `.play()`, audio starts after cleanup already ran.

**Fix in `StudentSlideViewer.tsx`**:
- Replace closure-scoped `isMounted` with a shared `useRef(true)` (`isMountedRef`) so all in-flight async operations see the unmount immediately
- Add a route-change cleanup effect using `useLocation` from `react-router-dom` that stops audio whenever the URL changes
- Add a guard check on `isMountedRef.current` right before `audio.play()`
- Set `audio.src = ''` in cleanup to force the browser to release the resource

### Problem 2: Assessment shows generic error when no questions exist

The `start-assessment` edge function returns a NOT_FOUND error because the instructor hasn't generated questions yet. The `AssessmentSession` component shows a raw "Edge Function returned a non-2xx status code" message.

**Fix in `AssessmentSession.tsx`**:
- Detect "no questions" or "not_found" patterns in the error message
- Show a friendly "Assessment Not Ready Yet" card with a clock icon and a "Back to Learning" button instead of the generic red error
- Keep the generic error for actual retryable failures (network issues etc.)

### Problem 3: "Take Assessment" CTA disappears / state not recovered

Students who completed slides before the previous fix was deployed still have `verification_state = 'unstarted'` in the database. The CTA only shows when state is `'verified'`, so it vanishes.

**Fix in `LearningObjective.tsx`**:
- Add a one-time state recovery effect on page load
- If `verification_state` is `'unstarted'` or `'in_progress'` but a `slide_completions` record exists with `watch_percentage >= 80`, auto-update to `'verified'` and invalidate queries
- This catches all students whose completions pre-date the fix

### Problem 4: "Back to Course" button does nothing

The button uses `navigate(-1)` which relies on browser history. If the user opened the page directly or refreshed, there is no history entry to go back to.

**Fix in `LearningObjective.tsx`**:
- Replace `navigate(-1)` with `navigate(`/learn/course/${learningObjective.course_id}`)` -- `course_id` is already available from the query (the hook selects `*` from `learning_objectives`)
- In the error state where `data` is unavailable, fall back to `navigate('/learn')`

## Technical Changes

### File 1: `src/components/slides/StudentSlideViewer.tsx`

**Audio cleanup -- 5 specific edits:**

1. Add import: `import { useLocation } from 'react-router-dom';`
2. Add after existing refs: `const isMountedRef = useRef(true);` and `const location = useLocation();`
3. Update the unmount effect (line 59-68) to also set `isMountedRef`:

```typescript
useEffect(() => {
  isMountedRef.current = true;
  return () => {
    isMountedRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  };
}, []);
```

4. Add a new route-change effect right after the unmount effect:

```typescript
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  };
}, [location.pathname]);
```

5. In the per-slide audio effect (line 104-219):
   - Remove `let isMounted = true` (line 119) -- use `isMountedRef.current` instead
   - Replace all `isMounted` references with `isMountedRef.current`
   - Add a guard before `audio.play()`: `if (!isMountedRef.current) { audio.src = ''; return; }`
   - In the cleanup function, remove `isMounted = false` (the ref handles it)

### File 2: `src/components/assessment/AssessmentSession.tsx`

**Assessment error handling -- 2 edits:**

1. Add `Clock` and `ArrowLeft` to lucide imports
2. Replace the error state block (line 278-298) to detect "no questions" errors:

```typescript
if (sessionState === 'error') {
  const isNoQuestions = error?.toLowerCase().includes('no assessment questions')
    || error?.toLowerCase().includes('not_found')
    || error?.toLowerCase().includes('non-2xx');

  if (isNoQuestions) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="font-semibold text-lg">Assessment Not Ready Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Assessment questions haven't been prepared for this topic yet.
            Your instructor will make them available soon.
          </p>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Learning
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Generic retryable error (existing code)
  return ( ... );
}
```

### File 3: `src/pages/student/LearningObjective.tsx`

**3 edits:**

1. **State recovery effect** -- add after existing hooks (around line 30):

```typescript
import { useEffect } from 'react';

useEffect(() => {
  if (!data || !user || !loId) return;
  const currentState = data.learningObjective.verification_state || 'unstarted';
  if (currentState !== 'unstarted' && currentState !== 'in_progress') return;

  const checkAndRecover = async () => {
    const { data: completions } = await supabase
      .from('slide_completions')
      .select('watch_percentage')
      .eq('user_id', user.id)
      .eq('learning_objective_id', loId)
      .gte('watch_percentage', 80)
      .limit(1);

    if (completions && completions.length > 0) {
      await supabase
        .from('learning_objectives')
        .update({ verification_state: 'verified', updated_at: new Date().toISOString() })
        .eq('id', loId);
      queryClient.invalidateQueries({ queryKey: ['lo-progress', loId] });
    }
  };
  checkAndRecover();
}, [data, user, loId]);
```

2. **Back to Course button** (line 161): change `navigate(-1)` to `navigate(`/learn/course/${learningObjective.course_id}`)`

3. **Error state Go Back** (line 94): change `navigate(-1)` to `navigate('/learn')`

## What Does NOT Change

- The `start-assessment` edge function (it correctly returns NOT_FOUND)
- Database schema (no migrations needed)
- Slide viewer scroll/sync behavior
- Classic slides mode
- NarratedScrollViewer (no audio management there)
- Instructor workflows
- Video consumption tracking

## Testing Scenarios Covered

| Scenario | Mechanism |
|----------|-----------|
| Click X button to close viewer | `handleClose` pauses audio, then unmount cleanup |
| Browser back button | Route change effect + unmount cleanup via `isMountedRef` |
| Sidebar link to another page | Route change effect + unmount cleanup |
| Signed URL resolves after unmount | `isMountedRef.current` is false, skips `.play()` |
| Assessment with no questions | Friendly "Not Ready Yet" card instead of crash |
| Student completed slides before fix | State recovery effect auto-updates to "verified" |
| Direct URL access then "Back to Course" | Navigates to `/learn/course/{course_id}` |
| Error page "Go Back" | Navigates to `/learn` dashboard |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/slides/StudentSlideViewer.tsx` | Audio cleanup: `isMountedRef`, route-change effect, play guard |
| `src/components/assessment/AssessmentSession.tsx` | Friendly "no questions" error state |
| `src/pages/student/LearningObjective.tsx` | State recovery effect, explicit "Back to Course" navigation, error fallback |
