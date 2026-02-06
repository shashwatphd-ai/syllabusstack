
# Plan: Single-Switch Provider Toggle for Image Generation

## Overview

This plan adds a **BATCH_PROVIDER**-style toggle for image generation that lets you switch between OpenRouter and native Google Cloud API with a single environment variable change. The same UI flow ("Generate Slides") will work identically regardless of which provider is active.

---

## Current State

| Component | Current Provider | Notes |
|-----------|------------------|-------|
| Slide Content (batch) | Vertex AI Batch | 50% discount, uses `BATCH_PROVIDER=vertex` |
| Slide Content (single) | OpenRouter | via `unified-ai-client.ts` |
| **Image Generation** | **OpenRouter** | Hitting 402 Payment Required errors |
| Research/Grounding | Perplexity via OpenRouter | Works |
| Syllabus Parsing | Google Direct (`generativelanguage.googleapis.com`) | Works |

---

## Proposed Solution

Add an **`IMAGE_PROVIDER`** environment variable that controls routing:
- `openrouter` (default): Current behavior via OpenRouter
- `google` (new): Native Google Generative Language API

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     process-batch-images                             │
│                            │                                         │
│                   ┌────────▼────────┐                               │
│                   │ IMAGE_PROVIDER? │                               │
│                   └────────┬────────┘                               │
│              ┌─────────────┴─────────────┐                          │
│              ▼                           ▼                          │
│   ┌──────────────────┐       ┌───────────────────────┐             │
│   │ 'openrouter'     │       │ 'google'              │             │
│   │ (current)        │       │ (new native path)     │             │
│   │                  │       │                       │             │
│   │ OpenRouter API   │       │ generativelanguage    │             │
│   │ $0.039/image     │       │ .googleapis.com       │             │
│   │ Uses OPENROUTER_ │       │ Uses GOOGLE_CLOUD_    │             │
│   │ API_KEY          │       │ API_KEY               │             │
│   └──────────────────┘       └───────────────────────┘             │
│                                         │                           │
│                                         ▼                           │
│                              Uses GCP Free Tier or                  │
│                              billed to GCP project                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### 1. Add Native Google Image Generation to unified-ai-client.ts

Add a new function `generateImageGoogle()` that calls the native Google endpoint:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent
Header: x-goog-api-key: ${GOOGLE_CLOUD_API_KEY}
```

**Key differences from OpenRouter:**
- Uses `inlineData` response format (base64 directly in response)
- Different request body structure (`contents` array)
- Requires `response_modalities: ["IMAGE", "TEXT"]` in generation config

### 2. Modify generateImage() for Provider Toggle

Update the main `generateImage()` function in `unified-ai-client.ts` to:

```typescript
const IMAGE_PROVIDER = Deno.env.get('IMAGE_PROVIDER') || 'openrouter';

export async function generateImage(request: {...}): Promise<ImageResult> {
  if (IMAGE_PROVIDER === 'google') {
    return generateImageGoogle(request);
  }
  return generateImageOpenRouter(request); // current implementation
}
```

### 3. Google Direct Implementation Details

**Request format:**
```json
{
  "contents": [
    {"role": "user", "parts": [{"text": "Your prompt..."}]}
  ],
  "generationConfig": {
    "responseModalities": ["IMAGE", "TEXT"]
  }
}
```

**Response parsing:**
- Response contains `candidates[0].content.parts[]`
- Image data is in `parts[].inlineData.data` (base64) with `mimeType`
- Text responses in `parts[].text`

### 4. Update process-batch-images (Optional Enhancement)

The current implementation already calls `generateImage()` from `unified-ai-client.ts`, so the toggle will automatically work. However, we can add explicit logging:

```typescript
console.log(`[Image Queue] Using provider: ${Deno.env.get('IMAGE_PROVIDER') || 'openrouter'}`);
```

### 5. Add IMAGE_PROVIDER Secret

Add new secret via Lovable Cloud:
- **Name:** `IMAGE_PROVIDER`
- **Value:** `google` (to switch to native GCP)

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/unified-ai-client.ts` | Add `generateImageGoogle()`, modify `generateImage()` with provider toggle |
| `supabase/functions/process-batch-images/index.ts` | Add provider logging (optional) |
| Environment Secrets | Add `IMAGE_PROVIDER=google` |

---

## Benefits

1. **Single Switch:** Change `IMAGE_PROVIDER` from `openrouter` to `google` to route all images through GCP
2. **Same UI Flow:** No frontend changes needed
3. **Use GCP Credits:** Avoids OpenRouter billing, uses existing `GOOGLE_CLOUD_API_KEY`
4. **Fallback Preserved:** Can easily switch back to OpenRouter if needed
5. **Consistent Pattern:** Matches existing `BATCH_PROVIDER` toggle architecture

---

## Technical Details: Google Image API

Based on research, the Google Generative Language API endpoint for image generation:

**Endpoint:**
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent
```

**Model Options:**
- `gemini-2.5-flash-image-preview` - Fast, GA-quality
- `gemini-3-pro-image-preview` - Higher quality (if available via this endpoint)

**Authentication:**
- Header: `x-goog-api-key: ${GOOGLE_CLOUD_API_KEY}` (already configured)

**Cost:**
- Uses GCP project quotas and billing
- Free tier available for initial usage

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Google API format differences | Parse both OpenRouter and Google response formats in extraction function |
| Rate limits | Same self-continuation loop handles delays |
| Model availability | Fallback to `gemini-2.5-flash-image` if preview unavailable |

---

## Testing Plan

1. Set `IMAGE_PROVIDER=google` secret
2. Reset the 135 failed images to `pending`
3. Trigger `process-batch-images` edge function
4. Monitor logs for successful generation via Google Direct
5. Verify images appear in `lecture-visuals` storage bucket
