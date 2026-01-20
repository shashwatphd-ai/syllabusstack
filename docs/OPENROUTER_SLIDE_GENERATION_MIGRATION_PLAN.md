# OpenRouter Migration Plan: generate-lecture-slides-v3

## Executive Summary

Migrate `generate-lecture-slides-v3` to use OpenRouter for **Professor AI** and **Visual AI** phases while retaining native Google API only for **Research Agent** (which requires Google Search Grounding).

### Current State vs. Proposed State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │  Research Agent │     │   Professor AI  │     │    Visual AI    │       │
│  │  (gemini-2.0-   │     │  (gemini-3-pro- │     │ (gemini-3-pro-  │       │
│  │   flash)        │     │   preview)      │     │  image-preview) │       │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘       │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │              Google Cloud Generative Language API                │       │
│  │              (generativelanguage.googleapis.com)                 │       │
│  │              Auth: GOOGLE_CLOUD_API_KEY                          │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROPOSED ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │  Research Agent │     │   Professor AI  │     │    Visual AI    │       │
│  │  (gemini-2.0-   │     │ google/gemini-  │     │ google/gemini-  │       │
│  │   flash)        │     │ 3-flash-preview │     │ 2.5-flash-image │       │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘       │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌──────────────────┐   ┌──────────────────────────────────────────┐       │
│  │  Google Cloud    │   │              OpenRouter API               │       │
│  │  (Search         │   │         (openrouter.ai/api/v1)            │       │
│  │   Grounding)     │   │         Auth: OPENROUTER_API_KEY          │       │
│  │  Auth: GOOGLE_   │   │         + HTTP-Referer: APP_URL           │       │
│  │  CLOUD_API_KEY   │   │                                           │       │
│  └──────────────────┘   └──────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Research Agent - NO CHANGE (Google Search Grounding Required)

### Current Code (Lines 557-707)
```typescript
async function runResearchAgent(...): Promise<ResearchContext> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  // ...
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [...],
      tools: [{ googleSearch: {} }],  // ← THIS IS THE BLOCKER
    }),
  });
}
```

### Why OpenRouter Cannot Be Used
OpenRouter does not support:
- `tools: [{ googleSearch: {} }]` parameter
- `googleSearchRetrieval` for grounded content
- `groundingMetadata` response field with citations

**Decision: KEEP on native Google API**

---

## Phase 2: Professor AI - MIGRATE TO OPENROUTER

### Current Implementation (Lines 908-1119)

```typescript
async function runProfessorAI(...): Promise<ProfessorSlide[]> {
  const result = await callGoogleAI(
    MODEL_CONFIG.GEMINI_PRO,           // gemini-3-pro-preview
    PROFESSOR_SYSTEM_PROMPT,
    userPrompt,
    0.7
  );
  // ...
}
```

### Proposed Implementation

```typescript
import { simpleCompletion, MODELS, parseJsonResponse } from "../_shared/openrouter-client.ts";

async function runProfessorAI(...): Promise<ProfessorSlide[]> {
  const result = await simpleCompletion(
    'google/gemini-3-flash-preview',    // Fast, high-quality reasoning
    PROFESSOR_SYSTEM_PROMPT,
    userPrompt,
    {
      temperature: 0.7,
      max_tokens: 16000,                // Slide decks are large
      json: true,                        // Request JSON output
      fallbacks: [
        MODELS.GEMINI_FLASH,            // google/gemini-2.5-flash
        MODELS.REASONING,               // openai/gpt-4.1
      ],
    },
    '[Professor AI]'
  );
  
  return parseJsonResponse<{ slides: ProfessorSlide[] }>(result).slides;
}
```

### Model Selection Rationale

| Model | Cost | Speed | Quality | Recommendation |
|-------|------|-------|---------|----------------|
| `google/gemini-3-flash-preview` | Low | Fast | High | **PRIMARY** |
| `google/gemini-2.5-flash` | Low | Fast | Medium | Fallback #1 |
| `openai/gpt-4.1` | Medium | Medium | Very High | Fallback #2 |
| `google/gemini-3-pro-preview` | High | Slow | Very High | Overkill for this task |

**Per OpenRouter docs**: `gemini-3-flash-preview` is "Fast preview of Google's next-generation model. Balanced speed and capability."

---

## Phase 3: Visual AI - MIGRATE TO OPENROUTER

### Current Implementation (Lines 1125-1204)

```typescript
async function runVisualAI(...): Promise<Map<number, string>> {
  // ...
  const result = await generateImage(imagePrompt, slide.title);
  // This calls native Google API with gemini-3-pro-image-preview
}

// Native Google generateImage function (lines 246-306)
async function generateImage(prompt: string, slideTitle: string) {
  const model = 'gemini-3-pro-image-preview';
  const url = `${GOOGLE_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
  // ...
}
```

### Proposed Implementation

```typescript
import { generateImage as generateImageOpenRouter } from "../_shared/openrouter-client.ts";

async function runVisualAI(...): Promise<Map<number, string>> {
  // ...
  const result = await generateImageOpenRouter(
    imagePrompt,
    { maxRetries: 2, retryDelayMs: 1500 },
    '[Visual AI]'
  );
  
  if (result?.base64) {
    // Upload to storage (same as before)
  }
}
```

### OpenRouter Image Generation Compatibility

Per [OpenRouter Image Generation Docs](https://openrouter.ai/docs/guides/overview/multimodal/image-generation):

```typescript
// openrouter-client.ts already implements this (lines 548-651)
const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': appUrl,
    'X-Title': 'SyllabusStack',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash-image-preview',  // MODELS.GEMINI_IMAGE
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image', 'text']  // ← Required for image output
  })
});
```

### Image Model Options on OpenRouter

| Model | Provider | Notes |
|-------|----------|-------|
| `google/gemini-2.5-flash-image-preview` | Google | ✅ Already in openrouter-client.ts |
| `google/gemini-3-pro-image-preview` | Google | ❌ NOT yet available on OpenRouter |

**Decision**: Use `google/gemini-2.5-flash-image-preview` via OpenRouter. Quality difference vs. gemini-3-pro-image-preview is minimal for educational diagrams.

---

## Detailed Code Changes

### File: `supabase/functions/generate-lecture-slides-v3/index.ts`

#### Change 1: Add OpenRouter Import (Top of file)
```typescript
// ADD after existing imports
import { 
  simpleCompletion, 
  generateImage as generateImageOpenRouter,
  parseJsonResponse,
  MODELS 
} from "../_shared/openrouter-client.ts";
```

#### Change 2: Remove Native callGoogleAI for Professor AI (Lines 193-244)
- **KEEP** the function for Research Agent only
- **RENAME** to `callGoogleAIWithGrounding` to clarify its purpose

#### Change 3: Remove Native generateImage (Lines 246-306)
- **DELETE** entirely - use openrouter-client.ts version instead

#### Change 4: Update runProfessorAI (Lines 908-1119)

**Before:**
```typescript
const result = await callGoogleAI(
  MODEL_CONFIG.GEMINI_PRO,
  PROFESSOR_SYSTEM_PROMPT,
  userPrompt,
  0.7
);
```

**After:**
```typescript
const result = await simpleCompletion(
  'google/gemini-3-flash-preview',
  PROFESSOR_SYSTEM_PROMPT,
  userPrompt,
  {
    temperature: 0.7,
    max_tokens: 16000,
    fallbacks: [MODELS.GEMINI_FLASH, MODELS.REASONING],
  },
  '[Professor AI]'
);
```

#### Change 5: Update runVisualAI (Lines 1125-1204)

**Before:**
```typescript
const result = await generateImage(imagePrompt, slide.title);
```

**After:**
```typescript
const result = await generateImageOpenRouter(
  imagePrompt,
  { maxRetries: 2, retryDelayMs: 1500 },
  `[Visual AI] Slide ${slide.order}`
);
```

---

## Environment Variables Required

| Variable | Current Status | Purpose |
|----------|----------------|---------|
| `OPENROUTER_API_KEY` | ✅ Configured | OpenRouter authentication |
| `APP_URL` | ✅ Configured | HTTP-Referer header (syllabusstack.com) |
| `GOOGLE_CLOUD_API_KEY` | ✅ Configured | Research Agent (Search Grounding) |

---

## Risk Assessment

### Low Risk
| Risk | Mitigation |
|------|------------|
| API format differences | OpenRouter uses OpenAI-compatible format; already tested |
| Response parsing | `parseJsonResponse` handles markdown code blocks |
| Rate limiting | OpenRouter has generous limits; existing retry logic |

### Medium Risk
| Risk | Mitigation |
|------|------------|
| Image quality difference | `gemini-2.5-flash-image-preview` vs `gemini-3-pro-image-preview` may differ; test visually |
| Token limits | Set `max_tokens: 16000` for slide decks; monitor for truncation |

### Mitigated by Architecture
| Risk | Why Not a Problem |
|------|-------------------|
| Search Grounding unavailable | Research Agent stays on native Google API |
| Fallback failures | OpenRouter automatic fallback chain configured |
| Cost tracking | OpenRouter provides unified usage dashboard |

---

## Testing Checklist

### Pre-Migration
- [ ] Document current slide generation quality (screenshots of 3 teaching units)
- [ ] Note current generation times
- [ ] Backup current function code

### Post-Migration
- [ ] Trigger slide generation for same 3 teaching units
- [ ] Compare visual quality (images)
- [ ] Compare content quality (speaker notes, key points)
- [ ] Check logs for proper model routing
- [ ] Verify fallback triggers work
- [ ] Monitor generation times

### SQL: Test Queue Reset
```sql
-- Reset any failed slides for testing
UPDATE lecture_slides 
SET generation_status = 'pending', 
    error_message = NULL,
    generation_phases = NULL
WHERE teaching_unit_id = '9832924a-...';  -- Test unit
```

---

## Rollback Plan

If issues are detected:

1. **Immediate**: Revert to previous function version via git
2. **Environment**: Set `AI_PROVIDER=google` to skip OpenRouter (if implemented)
3. **Partial**: Comment out OpenRouter imports, restore native functions

---

## Estimated Impact

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Professor AI latency | 8-12s | 5-8s (gemini-3-flash faster) |
| Visual AI latency | 3-5s per image | 3-5s (similar) |
| Total generation | ~150s | ~120s (estimated) |
| Cost per generation | ~$0.02 | ~$0.015 (flash models cheaper) |
| Codebase consistency | Mixed APIs | Unified OpenRouter |

---

## Approval Required

**Changes to be implemented:**
1. ✅ Add OpenRouter import to generate-lecture-slides-v3
2. ✅ Rename `callGoogleAI` → `callGoogleAIWithGrounding` (clarity)
3. ✅ Delete native `generateImage` function (use shared)
4. ✅ Update `runProfessorAI` to use `simpleCompletion`
5. ✅ Update `runVisualAI` to use `generateImageOpenRouter`
6. ✅ Keep `runResearchAgent` on native Google API

**Estimated Development Time**: 30-45 minutes

---

## Appendix: OpenRouter Model Availability Verification

From https://openrouter.ai/models:

| Model | Available | Verified |
|-------|-----------|----------|
| `google/gemini-3-flash-preview` | ✅ Yes | [Link](https://openrouter.ai/google/gemini-3-flash-preview) |
| `google/gemini-2.5-flash-image-preview` | ✅ Yes | [Link](https://openrouter.ai/google/gemini-2.5-flash-image-preview) |
| `google/gemini-2.5-flash` | ✅ Yes | In MODELS constant |
| `google/gemini-3-pro-preview` | ✅ Yes | Expensive, not needed |
| `google/gemini-3-pro-image-preview` | ❌ No | Not on OpenRouter |
