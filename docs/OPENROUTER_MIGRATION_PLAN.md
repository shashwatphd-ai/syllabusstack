# REVISED: OpenRouter Migration Plan

## Why OpenRouter is BETTER Than Direct OpenAI

### Problem with Current Plan (Direct OpenAI)
| Issue | Impact |
|-------|--------|
| Two API formats | Google format for 2 functions, OpenAI for 10 |
| Two client libraries | `openai-client.ts` + keep `google-ai-gateway.ts` |
| No fallbacks | If OpenAI is down, everything fails |
| Manual provider switching | Must change code to switch models |
| No cost optimization | Stuck with one provider's pricing |

### OpenRouter Solution
| Benefit | Impact |
|---------|--------|
| **ONE API format** | OpenAI-compatible for ALL functions (including Gemini) |
| **ONE client library** | Just `openrouter-client.ts` |
| **Automatic fallbacks** | Routes to backup provider if primary fails |
| **Model flexibility** | Change model by changing string, no code change |
| **Cost optimization** | Use `:floor` suffix for cheapest provider |
| **Response healing** | Auto-fixes malformed JSON from LLMs |

---

## OpenRouter API Overview

### Endpoint
```
https://openrouter.ai/api/v1/chat/completions
```

### Authentication
```typescript
headers: {
  'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
  'HTTP-Referer': 'https://syllabusstack.com',  // Required
  'X-Title': 'SyllabusStack'                     // Optional
}
```

### Model Format
```
provider/model-name
```

Examples:
- `openai/gpt-4.1` → OpenAI GPT-4.1
- `openai/gpt-4o-mini` → OpenAI GPT-4o-mini
- `google/gemini-2.5-flash` → Google Gemini 2.5 Flash
- `google/gemini-2.0-flash` → Google Gemini 2.0 Flash (multimodal)
- `anthropic/claude-sonnet-4` → Claude Sonnet 4

### Special Routing Suffixes
- `:floor` → Route to cheapest provider (e.g., `openai/gpt-4o-mini:floor`)
- `:nitro` → Route to fastest provider (e.g., `google/gemini-2.5-flash:nitro`)
- `openrouter/auto` → Let OpenRouter pick best model for the prompt

---

## Revised Model Mapping

| Function | Current Model | OpenRouter Model | Fallback |
|----------|--------------|------------------|----------|
| **curriculum-reasoning-agent** | gemini-3-pro-preview | `openai/gpt-4.1` | `anthropic/claude-sonnet-4` |
| **evaluate-content-batch** | gemini-2.5-flash | `openai/gpt-4o-mini:floor` | auto |
| **analyze-syllabus** | gemini-2.5-flash | `openai/gpt-4o-mini` | `google/gemini-2.5-flash` |
| **gap-analysis** | gemini-2.5-flash | `openai/gpt-4o-mini` | `google/gemini-2.5-flash` |
| **generate-recommendations** | gemini-2.5-flash | `openai/gpt-4o-mini` | `google/gemini-2.5-flash` |
| **process-syllabus** (domain) | gemini-2.5-flash | `openai/gpt-4o-mini` | auto |
| **process-syllabus** (PDF) | gemini-2.0-flash | `google/gemini-2.0-flash` | `openai/gpt-4o-mini` |
| **process-syllabus** (structure) | gemini-2.5-flash | `openai/gpt-4o-mini` | auto |
| **submit-batch-curriculum** | gemini-3-pro (Vertex) | `openai/gpt-4.1` | N/A (batch) |
| **submit-batch-evaluation** | gemini-2.5-flash (Vertex) | `openai/gpt-4o-mini` | N/A (batch) |
| **process-batch-research** (research) | gemini-2.5-flash + Google Search | Keep native (Google Search grounding) | N/A |
| **process-batch-images** | gemini-3-pro-image | Keep native (OpenRouter doesn't support image gen) | N/A |

---

## Simplified Architecture

### Before (Current Plan - 2 Providers)
```
┌─────────────────────────────────────────────────────────────┐
│                     Edge Functions                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │  openai-client.ts   │    │ google-ai-gateway.ts│        │
│  │  (10 functions)     │    │ (2 functions)       │        │
│  └──────────┬──────────┘    └──────────┬──────────┘        │
└─────────────┼──────────────────────────┼────────────────────┘
              │                          │
              ▼                          ▼
    ┌─────────────────┐        ┌─────────────────┐
    │   OpenAI API    │        │   Google API    │
    └─────────────────┘        └─────────────────┘
```

### After (OpenRouter - 1 Provider)
```
┌─────────────────────────────────────────────────────────────┐
│                     Edge Functions                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              openrouter-client.ts                    │   │
│  │              (ALL 12 functions)                      │   │
│  └──────────────────────────┬──────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  OpenRouter API │
                    │  (unified)      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  OpenAI  │  │  Google  │  │ Anthropic│
        └──────────┘  └──────────┘  └──────────┘
```

---

## Single Client Implementation

### New File: `supabase/functions/_shared/openrouter-client.ts`

```typescript
// ============================================================================
// OPENROUTER CLIENT - Unified AI Gateway
// ============================================================================

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

// Model aliases for easy switching
export const MODELS = {
  // Reasoning (complex tasks)
  REASONING: 'openai/gpt-4.1',
  REASONING_FALLBACK: 'anthropic/claude-sonnet-4',

  // Fast (simple tasks)
  FAST: 'openai/gpt-4o-mini',
  FAST_CHEAP: 'openai/gpt-4o-mini:floor',

  // Google-specific (when needed)
  GEMINI_FLASH: 'google/gemini-2.5-flash',
  GEMINI_MULTIMODAL: 'google/gemini-2.0-flash',

  // Auto-routing
  AUTO: 'openrouter/auto',
} as const;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface OpenRouterOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  // OpenRouter-specific
  fallbacks?: string[];  // Fallback models if primary fails
  transforms?: string[]; // e.g., ["middle-out"] for context compression
}

export async function callOpenRouter(
  options: OpenRouterOptions,
  logPrefix = '[OpenRouter]'
): Promise<OpenRouterResponse> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
  };

  // Add optional parameters
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.max_tokens !== undefined) body.max_tokens = options.max_tokens;
  if (options.response_format) body.response_format = options.response_format;
  if (options.tools?.length) {
    body.tools = options.tools;
    if (options.tool_choice) body.tool_choice = options.tool_choice;
  }

  // OpenRouter-specific: fallbacks
  if (options.fallbacks?.length) {
    body.route = 'fallback';
    body.models = [options.model, ...options.fallbacks];
  }

  console.log(`${logPrefix} Calling ${options.model}`);

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://syllabusstack.com',
      'X-Title': 'SyllabusStack',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Log which model actually responded (useful for fallbacks)
  const actualModel = data.model || options.model;
  console.log(`${logPrefix} Response from ${actualModel}: ${data.usage?.total_tokens} tokens`);

  return data;
}

// Convenience helper with fallbacks
export async function safeCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; json?: boolean; fallbacks?: string[] } = {}
): Promise<string> {
  const response = await callOpenRouter({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature,
    response_format: options.json ? { type: 'json_object' } : undefined,
    fallbacks: options.fallbacks,
  });

  return response.choices[0]?.message?.content || '';
}
```

---

## Environment Variables

### Required (Supabase Dashboard)
```
OPENROUTER_API_KEY=sk-or-v1-...
```

### Optional (for gradual rollout)
```
AI_PROVIDER=openrouter   # or 'google' for rollback
```

### Can Remove Later
```
OPENAI_API_KEY          # No longer needed
GOOGLE_CLOUD_API_KEY    # Keep for image generation + search grounding
```

---

## Migration Steps (Simplified)

### Phase 1: Setup (5 minutes)
1. Get OpenRouter API key from https://openrouter.ai
2. Add `OPENROUTER_API_KEY` to Supabase secrets
3. Add $20 credits to OpenRouter account

### Phase 2: Create Client (30 minutes)
1. Create `openrouter-client.ts` (single file, ~150 lines)
2. Delete `openai-client.ts` (not needed)
3. Delete `openai-batch-client.ts` (not needed)

### Phase 3: Migrate Functions (2 hours)
For each function, simple find-replace:
```typescript
// FROM (Google)
const url = `${GOOGLE_API_BASE}/models/gemini-2.5-flash:generateContent?key=${key}`;
const response = await fetch(url, {
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: system }] },
  })
});

// TO (OpenRouter)
import { callOpenRouter, MODELS } from "../_shared/openrouter-client.ts";

const response = await callOpenRouter({
  model: MODELS.FAST,  // or MODELS.REASONING for complex tasks
  messages: [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ],
  fallbacks: [MODELS.GEMINI_FLASH],  // Auto-fallback to Gemini
});
```

### Phase 4: Handle Special Cases
1. **Google Search grounding** → Keep `google/gemini-2.5-flash` via OpenRouter
2. **Image generation** → Keep native Gemini (OpenRouter doesn't support image gen)

---

## Batch Processing Strategy

### Option A: OpenAI Batch API via OpenRouter
OpenRouter forwards to OpenAI Batch API when using `openai/*` models.

### Option B: Sequential with Rate Limiting
For non-critical batch jobs, use sequential calls with automatic fallbacks:
```typescript
for (const item of items) {
  const result = await callOpenRouter({
    model: MODELS.FAST_CHEAP,  // :floor suffix = cheapest
    messages: [...],
    fallbacks: [MODELS.GEMINI_FLASH, 'anthropic/claude-haiku'],
  });
  await delay(100);  // Rate limiting
}
```

### Option C: OpenRouter Batch (Coming Soon)
OpenRouter is working on native batch support. Check their docs for updates.

---

## Cost Comparison

| Model | Direct API | OpenRouter | Difference |
|-------|-----------|------------|------------|
| GPT-4.1 | $2.00/$8.00 | ~$2.00/$8.00 | Same |
| GPT-4o-mini | $0.15/$0.60 | ~$0.15/$0.60 | Same |
| Gemini 2.5 Flash | $0.15/$0.60 | ~$0.15/$0.60 | Same |
| Claude Sonnet 4 | $3.00/$15.00 | ~$3.00/$15.00 | Same |

**OpenRouter Margin:** ~0-5% markup (minimal)
**But you get:** Fallbacks, routing, response healing, unified billing

---

## Lovable Integration Benefits

From the [Lovable + OpenRouter tutorial](https://lovable.dev/video/build-an-ai-app-with-any-llm-lovable-openrouter-tutorial):

1. **Single API Key** → One secret to manage
2. **Model Comparison** → Test different models side-by-side
3. **Prompt Studio** → Built-in testing interface
4. **Usage Tracking** → Unified billing across all providers
5. **Supabase Auth** → Already integrated

---

## Files Summary

### Create (1 file)
| File | Lines | Description |
|------|-------|-------------|
| `_shared/openrouter-client.ts` | ~150 | Unified AI client |

### Delete (2 files)
| File | Reason |
|------|--------|
| `_shared/openai-client.ts` | Not needed - OpenRouter handles this |
| `_shared/openai-batch-client.ts` | Not needed - OpenRouter handles this |

### Keep (2 files)
| File | Reason |
|------|--------|
| `_shared/google-ai-gateway.ts` | Only for image generation |
| `_shared/vertex-ai-batch.ts` | Keep for reference, can remove later |

---

## Rollback Strategy

If issues occur:
```typescript
// In openrouter-client.ts
const provider = Deno.env.get('AI_PROVIDER') || 'openrouter';

if (provider === 'google') {
  // Use existing google-ai-gateway.ts
  return callGoogleAI(options);
}

// Use OpenRouter
return callOpenRouter(options);
```

---

## Action Items for Lovable Agent

1. **Frontend:** No changes needed (same response format)
2. **Secrets:** Add `OPENROUTER_API_KEY` to Supabase
3. **Testing:** Use OpenRouter's built-in model comparison to validate output quality
4. **Monitoring:** Check OpenRouter dashboard for usage/errors

---

## Summary: Why OpenRouter Wins

| Criteria | Direct OpenAI | OpenRouter |
|----------|--------------|------------|
| Files to create | 2 | 1 |
| API formats to manage | 2 | 1 |
| Automatic fallbacks | No | Yes |
| Model switching | Code change | Config change |
| Response healing | No | Yes |
| Unified billing | No | Yes |
| Provider lock-in | High | None |
| Implementation time | 4-6 hours | 2-3 hours |

**Recommendation: Use OpenRouter for maximum flexibility with minimum complexity.**
