

## Fix: Video Finder `match_score` Bug + Audio Generation Quality Audit

### Summary

Two targeted fixes: one for the video finder's `match_score` NOT NULL constraint violation, and one for an audio storage URL issue. The slide generation pipeline remains untouched.

---

### Fix 1: `match_score` NOT NULL Violation (Video Finder)

**Problem:** In `search-youtube-content/index.ts` line 863, batch mode sets `match_score: null`, but the `content_matches` column is `NOT NULL` with no default. This causes all batch video saves to silently fail.

**Fix:** Replace `match_score: null` with `match_score: 0` (a neutral score indicating "not yet evaluated"). This is semantically correct since the `status` field is already set to `pending_evaluation`.

**Scope:** Single line change at line 863. No other code paths are affected -- the interactive (non-batch) mode already computes a real `match_score` before inserting.

**File:** `supabase/functions/search-youtube-content/index.ts`

---

### Fix 2: Audio Storage URL Mismatch

**Problem:** The `generate-lecture-audio` edge function uses `getPublicUrl()` (line 260-262) to store the audio URL in the slide JSON, but the `lecture-audio` bucket is **private** (`public: false`). The `getPublicUrl()` URL pattern (`/storage/v1/object/public/...`) will return a 400 error on playback.

The frontend (`StudentSlideViewer.tsx`) already has code to detect and sign these URLs, but only when the URL contains `/object/public/lecture-audio/`. This works by accident because `getPublicUrl()` generates that exact pattern even for private buckets. However, this is fragile.

**Fix:** Change the edge function to use `createSignedUrl()` with a long expiry (e.g., 7 days) instead of `getPublicUrl()`. This produces a URL that works immediately and is more correct for a private bucket.

**File:** `supabase/functions/generate-lecture-audio/index.ts` (lines 260-262)

---

### Audio Quality Audit -- No Code Changes Needed

The audio pipeline is architecturally sound:

| Phase | Component | Status |
|-------|-----------|--------|
| 1. Narration | `ai-narrator.ts` via OpenRouter (gpt-4o-mini) with Gemini Flash fallback | OK -- proper fallback chain, 150-250 word target |
| 2. SSML | `ssml-transformer.ts` via OpenRouter | OK -- rules explicitly avoid `rate="slow"` distortion |
| 3. TTS | Google Cloud TTS (Neural2-D) | OK -- `GOOGLE_CLOUD_API_KEY` secret is configured, pitch=0, rate=1.0 |
| 4. Segment Mapping | `segment-mapper.ts` via OpenRouter | OK -- proportional fallback if AI fails |
| 5. Storage | Supabase Storage (private bucket) | Fix needed (see Fix 2 above) |

---

### What Will NOT Be Changed

- Slide generation pipeline (working correctly)
- CORS configuration (already fixed in previous edit)
- Any frontend components
- Any database schema

### Deployment

After editing, deploy `search-youtube-content` and `generate-lecture-audio` edge functions.

