

# Expanded Plan: Complete Audio Cleanup Chain

## The Core Problem

There are **5 places** in `StudentSlideViewer.tsx` where audio should be fully stopped. Currently, only one of them (the final guard before play, lines 219-227) does a complete teardown. The other four are incomplete, leaving audio playing after navigation.

## Complete Teardown Sequence (what every exit path MUST do)

A proper audio stop requires all 5 steps in this order:

```text
1. Remove event listeners   -- prevents error cascades when src is cleared
2. Pause playback           -- immediate silence
3. Clear source (src = '')  -- forces browser to release the audio buffer/hardware
4. Null the ref             -- drops our reference for GC
5. setAudioRef(null)        -- clears useSlideSync's internal 100ms polling interval
```

## Current State of Each Exit Path

### Path 1: Per-slide cleanup (lines 238-248) -- INCOMPLETE

When the slide index changes or hasAudio toggles, this cleanup runs.

**Current code:**
```typescript
return () => {
  isCancelled = true;
  if (audioRef.current) {
    audioRef.current.removeEventListener(...)  // step 1 OK
    audioRef.current.pause();                  // step 2 OK
    audioRef.current = null;                   // step 4 OK
    // MISSING: audio.src = ''   (step 3)
  }
  // MISSING: setAudioRef(null)  (step 5)
};
```

**Fix:** Add `audioRef.current.src = ''` after pause, and `setAudioRef(null)` after the if-block.

### Path 2: Unmount cleanup (lines 62-73) -- INCOMPLETE

Runs when the component is destroyed (any navigation away).

**Current code:**
```typescript
return () => {
  isMountedRef.current = false;
  if (audioRef.current) {
    audioRef.current.pause();   // step 2 OK
    audioRef.current.src = '';  // step 3 OK
    audioRef.current = null;    // step 4 OK
    // MISSING: removeEventListener (step 1) -- but OK because component is dead
  }
  // MISSING: setAudioRef(null)  (step 5)
};
```

**Fix:** Add `setAudioRef(null)` after the if-block. (Listener removal not strictly needed here since the Audio element is being destroyed, but adding it is harmless and consistent.)

### Path 3: Location change cleanup (lines 75-84) -- INCOMPLETE

Runs when `location.pathname` changes (browser back, sidebar link).

**Current code:**
```typescript
return () => {
  if (audioRef.current) {
    audioRef.current.pause();   // step 2 OK
    audioRef.current.src = '';  // step 3 OK
    audioRef.current = null;    // step 4 OK
    // MISSING: removeEventListener (step 1)
  }
  // MISSING: setAudioRef(null)  (step 5)
};
```

**Fix:** Add `setAudioRef(null)` after the if-block.

### Path 4: handleClose (lines 312-319) -- MOST INCOMPLETE

Runs when the user clicks the X button.

**Current code:**
```typescript
const handleClose = () => {
  if (audioRef.current) {
    audioRef.current.pause();    // step 2 OK
    // MISSING: src = ''         (step 3)
    // MISSING: = null           (step 4)
  }
  // MISSING: setAudioRef(null)  (step 5)
  handleComplete();
  onClose();
};
```

**Fix:** Add `audioRef.current.src = ''`, `audioRef.current = null`, and `setAudioRef(null)`.

### Path 5: Final guard before play (lines 219-227) -- COMPLETE (no changes needed)

This path already does all 5 steps correctly.

## Why `setAudioRef(null)` Matters

The `useSlideSync` hook (from `useSlideSync.ts`) stores its own internal reference to the Audio element and runs a `setInterval` every 100ms to poll `audio.currentTime`. If we never call `setAudioRef(null)`:

- The interval keeps firing even after navigation
- The hook holds a reference preventing garbage collection
- In some browsers, this reference keeps the audio buffer alive

Looking at the hook code (lines 66-83 of `useSlideSync.ts`):
```typescript
const setAudioRef = useCallback((audio: HTMLAudioElement | null) => {
  audioRef.current = audio;
  if (intervalRef.current) {
    window.clearInterval(intervalRef.current);  // clears old interval
    intervalRef.current = null;
  }
  if (!audio || !enabled) {
    setActiveBlockId(null);
    setCurrentPercent(0);
    return;                                      // exits without new interval
  }
  intervalRef.current = window.setInterval(updateActiveBlock, 100);
}, [enabled, updateActiveBlock]);
```

Passing `null` clears the interval and resets state. Without it, the interval persists.

## Why `audio.src = ''` Matters

Calling `.pause()` alone tells the browser to stop decoding, but does NOT release the network connection or audio buffer. Setting `src = ''` forces the browser to:
- Abort any in-flight network requests for the audio file
- Release the decoded audio buffer from memory
- Disconnect from the audio output hardware

This was previously removed from the per-slide cleanup to avoid triggering error events, but that concern is resolved: event listeners are now removed BEFORE the source is cleared (step 1 before step 3).

## Exact Edits

### Edit 1: Per-slide cleanup (lines 238-248)

```typescript
// BEFORE:
return () => {
  isCancelled = true;
  if (audioRef.current) {
    audioRef.current.removeEventListener('play', handlePlay);
    audioRef.current.removeEventListener('pause', handlePause);
    audioRef.current.removeEventListener('ended', handleEnded);
    audioRef.current.removeEventListener('error', handleError);
    audioRef.current.pause();
    audioRef.current = null;
  }
};

// AFTER:
return () => {
  isCancelled = true;
  if (audioRef.current) {
    audioRef.current.removeEventListener('play', handlePlay);
    audioRef.current.removeEventListener('pause', handlePause);
    audioRef.current.removeEventListener('ended', handleEnded);
    audioRef.current.removeEventListener('error', handleError);
    audioRef.current.pause();
    audioRef.current.src = '';
    audioRef.current = null;
  }
  setAudioRef(null);
};
```

### Edit 2: Unmount cleanup (lines 62-73)

```typescript
// BEFORE:
return () => {
  isMountedRef.current = false;
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
    audioRef.current = null;
  }
};

// AFTER:
return () => {
  isMountedRef.current = false;
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
    audioRef.current = null;
  }
  setAudioRef(null);
};
```

### Edit 3: Location change cleanup (lines 75-84)

```typescript
// BEFORE:
return () => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
    audioRef.current = null;
  }
};

// AFTER:
return () => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
    audioRef.current = null;
  }
  setAudioRef(null);
};
```

### Edit 4: handleClose (lines 312-319)

```typescript
// BEFORE:
const handleClose = () => {
  if (audioRef.current) {
    audioRef.current.pause();
  }
  handleComplete();
  onClose();
};

// AFTER:
const handleClose = () => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
    audioRef.current = null;
  }
  setAudioRef(null);
  handleComplete();
  onClose();
};
```

## What Does NOT Change

- Audio playback initiation (signed URL resolution, autoplay)
- Slide-to-slide transition logic (isCancelled per-invocation guard)
- NarratedScrollViewer (has no audio management)
- useSlideSync hook internals (only its public setAudioRef is called)
- Scroll sync, block highlighting, progress tracking
- Assessment error handling and state recovery (already implemented)

## File Modified

| File | Changes |
|------|---------|
| `src/components/slides/StudentSlideViewer.tsx` | Add `audio.src = ''` and `setAudioRef(null)` to 4 incomplete cleanup paths |

