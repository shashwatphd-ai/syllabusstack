
# CDN Import Migration Progress

## Status: COMPLETE ✅

All edge functions have been migrated from external CDN imports to local `npm:` specifiers via `deno.json`. Zero files remain with `https://esm.sh/` or `https://deno.land/` imports. All `serve()` calls replaced with native `Deno.serve()`.

---

## Issue 2: Instructor Audio Preview

### Status: FIXED ✅
Applied autoplay-safe Audio pattern in LectureSlideViewer.tsx for cross-browser reliability.
Audio element is now created synchronously in the click handler gesture context, then `audio.play()` is called immediately to unlock the audio context (iOS Safari), before setting the `src` after the signed URL resolves.
