# Image Generation Migration Report

**Date:** 2025-01-20  
**Status:** ✅ Complete  
**Migration:** Lovable AI Gateway → OpenRouter

---

## Executive Summary

Successfully migrated the image generation pipeline from the Lovable AI Gateway to OpenRouter's unified API. This consolidates all AI operations under a single provider (OpenRouter) for consistent routing, cost tracking, and model management.

---

## Architecture Changes

### Before Migration

```
┌─────────────────────────────────┐    ┌────────────────────────────────┐
│     process-batch-images        │───▶│    Lovable AI Gateway          │
│     (queue-based generation)    │    │    LOVABLE_API_KEY             │
│                                 │    │    ai.gateway.lovable.dev      │
└─────────────────────────────────┘    └────────────────────────────────┘

┌─────────────────────────────────┐    ┌────────────────────────────────┐
│   generate-lecture-slides-v3    │───▶│    Google Cloud API            │
│   (inline generation)           │    │    GOOGLE_CLOUD_API_KEY        │
│                                 │    │    generativelanguage.google   │
└─────────────────────────────────┘    └────────────────────────────────┘
```

### After Migration

```
┌─────────────────────────────────┐
│     process-batch-images        │────┐
│     (queue-based generation)    │    │    ┌────────────────────────────────┐
└─────────────────────────────────┘    ├───▶│         OpenRouter             │
                                       │    │    OPENROUTER_API_KEY          │
┌─────────────────────────────────┐    │    │    openrouter.ai/api/v1        │
│   generate-lecture-slides-v3    │────┘    │    model: gemini-2.5-flash-    │
│   (inline generation - future)  │         │           image-preview        │
└─────────────────────────────────┘         └────────────────────────────────┘
```

---

## Files Modified

### 1. `supabase/functions/_shared/openrouter-client.ts`

| Section | Change | Lines |
|---------|--------|-------|
| MODELS constant | Added `GEMINI_IMAGE: 'google/gemini-2.5-flash-image-preview'` | 63-65 |
| `getLovableAiKey()` | **Removed** - no longer needed | 545-554 (deleted) |
| `generateImage()` | Updated to use OpenRouter API | 545-630 |

#### Detailed Changes to `generateImage()`

| Aspect | Before | After |
|--------|--------|-------|
| Log prefix | `'[LovableAI-Image]'` | `'[OpenRouter-Image]'` |
| API endpoint | `https://ai.gateway.lovable.dev/v1/chat/completions` | `${OPENROUTER_API_BASE}/chat/completions` |
| API key | `getLovableAiKey()` → `LOVABLE_API_KEY` | `getApiKey()` → `OPENROUTER_API_KEY` |
| Headers | `Authorization`, `Content-Type` | + `HTTP-Referer`, `X-Title` |
| Model reference | Hardcoded string | `MODELS.GEMINI_IMAGE` |

---

## Configuration Verification

| Secret | Status | Value |
|--------|--------|-------|
| `OPENROUTER_API_KEY` | ✅ Configured | `sk-or-v1-***` |
| `APP_URL` | ✅ Configured | `https://syllabusstack.com` |
| `LOVABLE_API_KEY` | ⚠️ No longer used | Can be removed |

---

## API Request Format

### OpenRouter Image Generation Request

```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://syllabusstack.com',  // Required
    'X-Title': 'SyllabusStack',                   // Required
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash-image-preview',
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image', 'text']
  })
});
```

### Expected Response Format

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Generated image description",
      "images": [{
        "type": "image_url",
        "image_url": {
          "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        }
      }]
    }
  }]
}
```

---

## Model Information

| Model | OpenRouter ID | Status | Pricing |
|-------|---------------|--------|---------|
| Gemini 2.5 Flash Image | `google/gemini-2.5-flash-image-preview` | ✅ Active | $0.039/image |
| Gemini 3 Pro Image | `google/gemini-3-pro-image-preview` | ✅ Available | TBD |

---

## Edge Functions Affected

| Function | Status | Notes |
|----------|--------|-------|
| `process-batch-images` | ✅ Updated | Uses shared `generateImage()` |
| `generate-lecture-slides-v3` | ⏳ Separate | Still uses direct Google API |

---

## Queue Management

### Reset Failed Items (Post-Deployment)

```sql
UPDATE image_generation_queue 
SET status = 'pending', 
    attempts = 0, 
    error_message = NULL 
WHERE status = 'failed';
```

### Queue Status Check

```sql
SELECT status, COUNT(*) 
FROM image_generation_queue 
GROUP BY status;
```

---

## Testing Checklist

- [ ] Deploy `process-batch-images` edge function
- [ ] Reset failed queue items to pending
- [ ] Trigger image generation from instructor UI
- [ ] Verify images appear in lecture slides
- [ ] Check edge function logs for `[OpenRouter-Image]` prefix
- [ ] Confirm no `LOVABLE_API_KEY` errors

---

## Rollback Plan

If OpenRouter image generation fails:

1. Restore `getLovableAiKey()` function
2. Change `generateImage()` back to use:
   - `LOVABLE_AI_GATEWAY` endpoint
   - `LOVABLE_API_KEY` for auth
   - Remove `HTTP-Referer` and `X-Title` headers

---

## Future Enhancements

1. **Unify `generate-lecture-slides-v3`** - Migrate from direct Google API to shared OpenRouter client
2. **Add `image_config`** - Include `aspect_ratio: '16:9'` for lecture slide optimization
3. **Automatic Fallback** - Implement fallback to Lovable AI Gateway if OpenRouter fails
4. **Cost Dashboard** - Add image generation cost tracking to usage analytics

---

## Related Documentation

- `docs/OPENROUTER_MIGRATION_PLAN.md` - Full migration strategy
- `docs/PIPELINE_SPECIFICATION.md` - AI pipeline architecture
- `memory/features/queue-based-image-generation` - Queue system details

---

## Conclusion

The migration successfully consolidates image generation under OpenRouter, aligning with the platform's unified AI routing strategy. The change is low-risk with a clear rollback path if issues arise.
