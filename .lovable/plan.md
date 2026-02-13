

# Diagnostic Report: Bundle Timeout and Instructor Audio Preview

## Issue 1: Bundle Generation Timeout (SUPABASE_CODEGEN_ERROR)

### Status: Partially Fixed, 82 Files Remaining

The `"Bundle generation timed out"` error occurs because the Lovable/Supabase bundler attempts to fetch external packages from CDN URLs (`https://esm.sh/` and `https://deno.land/`) at deployment time. These fetches are non-deterministic -- they sometimes succeed, sometimes stall past the bundler's hard timeout.

### What Was Fixed (8 files)
The `_shared/` utilities and the two audio edge functions (`generate-lecture-audio`, `generate-batch-audio`) were migrated to use local `npm:` specifiers via `deno.json`, which the bundler resolves instantly without network calls.

### What Remains (82 files across `supabase/functions/`)
Two categories of legacy imports still exist:

**Category A: `esm.sh` imports (~74 files)**
```
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
```
Must become:
```
import { createClient } from "@supabase/supabase-js";
```

**Category B: `deno.land/std` serve() imports (~81 files)**
```
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(handler);
```
Must become:
```
Deno.serve(handler);
```
(Remove the import entirely and use the native `Deno.serve()` API.)

**Category C: Other CDN imports (~10 files)**
- `stripe` from `esm.sh` -- replace with `npm:stripe`
- `fflate` from `esm.sh` -- replace with `npm:fflate`

### Required Fix
A mechanical find-and-replace across all 82+ edge function files. The `deno.json` import map already has the correct mappings:
```json
{
  "@supabase/supabase-js": "npm:@supabase/supabase-js@^2.49.0",
  "stripe": "npm:stripe@^18.5.0"
}
```

Each file needs:
1. Remove `import { serve } from "https://deno.land/std@..."` line
2. Replace `import { createClient } from "https://esm.sh/@supabase/supabase-js@..."` with `import { createClient } from "@supabase/supabase-js"`
3. Replace `serve(async (req) => { ... })` wrapper with `Deno.serve(async (req) => { ... })`
4. Apply same pattern for any `stripe` or `fflate` CDN imports

### Estimated Effort
This is a mechanical refactor -- approximately 2-3 hours of developer time with a search-and-replace tool. No logic changes required.

---

## Issue 2: Instructor Audio Preview

### Status: Working Correctly

After thorough investigation, the instructor audio preview feature IS functional:

**Evidence from live testing:**
- Clicked the play button (triangle) in the slide viewer footer
- The button toggled to the pause icon -- confirming the `handlePreviewToggle` handler executed
- Network request `POST /storage/v1/object/sign/lecture-audio/669b5493.../Charon/slide_0.wav` returned **200** with a valid signed URL
- Audio files exist in storage with real content (3-4 MB per slide WAV files)
- Zero console errors were logged
- All 6 voice variants are stored correctly

**The audio preview code path (in `LectureSlideViewer.tsx`, line 180-211):**
1. Reads `audio_urls[selectedVoice]` from the current slide
2. Creates a signed URL via `supabase.storage.createSignedUrl()` (with cache-buster)
3. Instantiates `new Audio(signedUrl)` and calls `audio.play()`
4. Toggles button between Play/Pause icons
5. Stops and cleans up on slide change, dialog close, or unmount

**Storage RLS policies are correct:**
- "Instructors can manage audio for their courses" (ALL operations) validates `lecture_slides.id` matches the first folder segment in the storage path -- this is correct since audio is stored at `{lecture_slide_id}/{voiceId}/slide_{i}.wav`

### If the User Cannot Hear Audio
If the user clicked play and saw the button change but heard no sound, possible causes are:
- **Browser autoplay policy**: Some browsers block audio playback in certain contexts. The current code creates `Audio` after an async `createSignedUrl` call, which can break the user-gesture chain. Fix: create the `Audio` element synchronously in the click handler, call `audio.play().catch(() => {})` immediately to unlock it, then set `audio.src` after the signed URL resolves.
- **System volume/mute**: The audio is playing but the user's system volume may be muted
- **WAV format compatibility**: The files are LINEAR16 WAV at 24kHz -- broadly supported, but worth confirming

### Recommended Defensive Fix
Apply the iOS Safari / autoplay-safe pattern to `handlePreviewToggle`:

```typescript
const handlePreviewToggle = useCallback(async () => {
  if (isPreviewPlaying) { stopPreview(); return; }

  const slideAudioUrl = /* existing logic to get URL */;
  if (!slideAudioUrl) return;

  // 1. Create Audio element synchronously in gesture context
  const audio = new Audio();
  audio.play().catch(() => {}); // Unlock for iOS Safari
  audioRef.current = audio;

  try {
    // 2. Async: get signed URL
    const { data } = await supabase.storage
      .from('lecture-audio')
      .createSignedUrl(slideAudioUrl, 3600);
    if (!data?.signedUrl) return;

    // 3. Set source and play
    audio.src = data.signedUrl + cacheBuster;
    audio.addEventListener('ended', () => setIsPreviewPlaying(false));
    await audio.play();
    setIsPreviewPlaying(true);
  } catch (err) {
    console.error('Audio preview failed:', err);
    setIsPreviewPlaying(false);
  }
}, [/* deps */]);
```

---

## Summary for Developer Handoff

| Item | Status | Action Required |
|------|--------|----------------|
| Bundle timeout | Blocking deploys | Migrate 82 edge function files from CDN to npm: imports |
| Audio preview | Functional but fragile | Apply autoplay-safe Audio pattern for cross-browser reliability |
| Batch audio button | Working | Deployed and fires correctly |
| Audio data/storage | Verified | All 6 voices, 3-4 MB WAV files, valid signed URLs |

