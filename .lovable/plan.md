
# Fix OpenRouter Image Generation Response Parsing

## Problem Summary

OpenRouter is successfully generating images (you can see charges in the dashboard), but our code fails to extract them. The bug is a **mismatch between our parsing logic and OpenRouter's documented response format**.

### OpenRouter's Documented Format
```javascript
const message = result.choices[0].message;
if (message.images) {
  message.images.forEach((image) => {
    const imageUrl = image.image_url.url;  // ← Images are HERE
  });
}
```

### Our Buggy Code (Lines 417-437)
```javascript
const content = data.choices?.[0]?.message?.content;

if (!content) {  // ← BUG: Gemini 3 Pro returns content: null!
  // We bail out here and NEVER check message.images
  continue; // or return error
}

// extractImageFromResponse is never called when content is null
```

---

## Root Cause

| Model | `message.content` | `message.images` | Our Result |
|-------|-------------------|------------------|------------|
| Gemini 3 Pro Image | `null` | `[{image_url: {url: "data:image/..."}}]` | ❌ Bails out at line 419 |
| Gemini 2.5 Flash Image | `[{type: 'image_url', ...}]` | `undefined` | ✅ Works |

Your OpenRouter logs confirm this:
- `Nano Banana Pro (Gemini 3 Pro Image Preview)` with `4,186` tokens → `0` output tokens → **empty content**
- But still charged `$0.0284` → **image was generated but discarded**

---

## Solution

### File: `supabase/functions/_shared/unified-ai-client.ts`

**Change 1: Remove early bail-out on empty content (Lines 417-437)**

Replace:
```typescript
const content = data.choices?.[0]?.message?.content;

if (!content) {
  // ... bail out or try fallback
}
```

With:
```typescript
const message = data.choices?.[0]?.message;
const content = message?.content;

// CRITICAL FIX: Check message.images FIRST before bailing on empty content
// OpenRouter's Gemini 3 Pro Image returns content: null but images in message.images
const extracted = extractImageFromResponse(content, message, logPrefix);

if (!extracted) {
  console.error(`${logPrefix} Could not extract image from response`);
  // Log response structure for debugging
  console.error(`${logPrefix} Response: content=${typeof content}, images=${Array.isArray(message?.images) ? message.images.length : 'none'}`);
  
  if (model === primaryModel) {
    console.warn(`${logPrefix} Failed extraction from ${model}, trying fallback...`);
    continue;
  }
  // return error...
}
```

**Change 2: Prioritize `message.images` in `extractImageFromResponse` (Lines 518-567)**

Reorder the extraction logic to check `message.images` FIRST (OpenRouter's documented format):

```typescript
function extractImageFromResponse(
  content: unknown,
  message: Record<string, unknown> | undefined,
  logPrefix: string
): { base64: string; mimeType: string; textResponse?: string } | null {

  // FORMAT 1 (PRIORITY): images array on message object
  // This is OpenRouter's DOCUMENTED format for image generation
  const images = message?.images as Array<Record<string, unknown>> | undefined;
  if (images?.length && images.length > 0) {
    const imageObj = images[0];
    const imageUrl = (imageObj?.image_url as Record<string, unknown>)?.url || imageObj?.url;

    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
      const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        console.log(`${logPrefix} Extracted image from message.images (OpenRouter format)`);
        return { base64: match[2], mimeType: `image/${match[1]}` };
      }
    }
  }

  // FORMAT 2: content is an array with type: 'image' or 'image_url' items
  // (Gemini 2.5 Flash sometimes uses this format)
  if (Array.isArray(content)) {
    // ... existing logic
  }

  // FORMAT 3: content is a string containing inline base64 data URL
  if (typeof content === 'string' && content.includes('data:image/')) {
    // ... existing logic
  }

  console.warn(`${logPrefix} No image found. Content type: ${typeof content}, isArray: ${Array.isArray(content)}, images: ${images?.length || 0}`);
  return null;
}
```

---

## Summary of Changes

| Location | Change |
|----------|--------|
| Lines 417-437 | Remove `if (!content)` bail-out; call `extractImageFromResponse` unconditionally |
| Lines 518-567 | Move `message.images` check to FIRST priority (before content array) |
| Logging | Add debug output showing `content` type and `images` array length |

---

## Why This Fixes Both Pathways

1. **Single Slide Generation** (`ai-gateway` → `generateImage`)
   - Same code path, will now correctly extract from `message.images`

2. **Batch Slide Generation** (`process-batch-images` → `generateImage`)
   - Uses the same `generateImage()` function
   - Fix applies automatically

---

## No Timeout Changes Needed

The issue was **never a timeout problem**. We were discarding valid images because of the parsing bug. Once fixed:
- Primary model (Gemini 3 Pro) will work immediately
- No fallback needed in most cases
- Generation completes in ~3-5 seconds per image

---

## Testing Plan

After deploying:
1. Trigger single slide image regeneration
2. Check edge function logs for: `Extracted image from message.images (OpenRouter format)`
3. Verify image appears in slide
4. Confirm OpenRouter dashboard shows Gemini 3 Pro Image used (not falling back)
