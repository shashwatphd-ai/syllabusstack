

# Upgrade Curriculum Decomposition: DeepSeek R1 to Gemini 3 Pro (Thinking + Search Grounding)

## Why This Change

DeepSeek R1 via OpenRouter has known issues:
- Connection drops during long thinking times
- 100KB OpenRouter body limit can be hit with large syllabus context
- No web search capability -- it reasons only from the prompt content
- Fallback chain (R1 -> Gemini 2.5 Pro -> Flash Lite) degrades quality significantly

Gemini 3 Pro via direct Google API offers:
- Native `thinking` with configurable levels (minimal/low/medium/high)
- Native `search` tool (Google Search Grounding) -- the model can look up current information
- 1M token input context (no truncation needed)
- 65,536 output tokens
- `responseMimeType: "application/json"` for guaranteed valid JSON
- Same direct API pattern already proven in `process-syllabus` (`callGeminiDirect`)
- No OpenRouter dependency, no 100KB body limit

## What Changes

### File 1: `supabase/functions/curriculum-reasoning-agent/index.ts`

**Change A: Replace `callAI` function (lines 181-206)**

Remove the `generateText()` call via OpenRouter. Replace with a direct Google API call using `gemini-3-pro-preview` with thinking enabled and search grounding.

```typescript
async function callAI(systemPrompt: string, userPrompt: string): Promise<DecomposeResponse> {
  console.log('[curriculum-reasoning-agent] Calling Gemini 3 Pro with thinking + search...');

  const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
  if (!GOOGLE_CLOUD_API_KEY) {
    throw new Error("GOOGLE_CLOUD_API_KEY not configured");
  }

  const model = 'gemini-3-pro-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "high" },
      },
      tools: [{
        googleSearch: {}
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[curriculum-reasoning-agent] Gemini API error:', err.substring(0, 500));

    // Fallback to OpenRouter
    console.log('[curriculum-reasoning-agent] Falling back to OpenRouter...');
    const fallbackResult = await generateText({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      model: MODELS.GEMINI_PRO,
      fallbacks: [MODELS.GEMINI_FLASH, MODELS.FAST],
      logPrefix: '[curriculum-reasoning-agent-fallback]'
    });
    if (!fallbackResult.content) throw new Error('No content from fallback');
    return parseJsonFromAI(fallbackResult.content) as DecomposeResponse;
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text)
    ?.map((p: any) => p.text)
    ?.join("") || "";

  if (!text) throw new Error('No content in Gemini response');

  console.log('[curriculum-reasoning-agent] Response:', text.length, 'chars');
  return parseJsonFromAI(text) as DecomposeResponse;
}
```

Key capabilities unlocked:
- **`thinkingConfig: { thinkingLevel: "high" }`** -- Deep reasoning before output (replaces R1's chain-of-thought)
- **`tools: [{ googleSearch: {} }]`** -- Model can search the web for current pedagogical practices, real-world examples, authoritative definitions
- **`responseMimeType: "application/json"`** -- Guaranteed valid JSON output (eliminates markdown wrapping parse failures)
- **Direct API** -- No OpenRouter body limit, no connection drops

**Change B: Enhance the system prompt (lines 66-93)**

Add instructions that leverage Gemini 3 Pro's search grounding capability:

- Add: "USE YOUR SEARCH CAPABILITY to verify: (1) Current real-world applications and case studies from the last 2 years, (2) Authoritative definitions of domain-specific terms, (3) Current best practices in pedagogy for this domain"
- Update date reference from "2024-2025" to "2025-2026"
- Add: "SEARCH QUERY GENERATION: For each teaching unit, your search queries should be informed by what you found during your research -- use verified terminology, not guesses"

**Change C: Enhance syllabus context in user prompt (line 112)**

Currently truncates syllabus to 3,000 chars. With Gemini 3 Pro's 1M context, increase to 15,000 chars:

```typescript
// BEFORE
${course.syllabus_text ? `\nSYLLABUS EXCERPT (for context):\n${course.syllabus_text.substring(0, 3000)}` : ''}

// AFTER
${course.syllabus_text ? `\nSYLLABUS EXCERPT (for deeper context):\n${course.syllabus_text.substring(0, 15000)}` : ''}
```

This gives the model 5x more syllabus context for better prerequisite mapping and domain-aware decomposition.

### File 2: `supabase/functions/_shared/openrouter-client.ts`

No changes needed. The `MODELS` constants and `generateText` remain available for the fallback path.

### File 3: `supabase/functions/_shared/ai-orchestrator.ts`

No changes needed. `MODEL_CONFIG.GEMINI_PRO` = `gemini-3-pro-preview` is already defined.

### File 4: `supabase/functions/process-syllabus/index.ts` (Fallback truncation fix)

**Change D: Increase fallback truncation limit (line 580)**

Currently truncates to 80,000 chars when falling back to OpenRouter. The OpenRouter body limit is ~100KB which includes headers/JSON wrapper. Increase to the safe maximum:

```typescript
// BEFORE
const truncatedPrompt = structurePrompt.substring(0, 80000) +

// AFTER  
const truncatedPrompt = structurePrompt.substring(0, 90000) +
```

This squeezes the maximum possible content through the fallback pipe (90K chars + JSON overhead stays under 100KB).

## What Does NOT Change

- `submit-batch-curriculum` (Vertex AI Batch) -- still uses `gemini-3-pro-preview` for bulk processing, untouched
- All downstream functions (slides, audio, images, evaluation) -- untouched
- Frontend hooks (`useDecomposeLearningObjective`, `useTeachingUnits`) -- untouched, same request/response shape
- Database schema -- untouched
- `process-syllabus` primary path (direct Gemini) -- untouched (only fallback truncation adjusted)

## Pipeline Continuity Check

The `curriculum-reasoning-agent` receives a `learning_objective_id`, fetches LO + module + course context from the DB, calls AI, and inserts `teaching_units` rows. The input/output contract is identical -- only the AI provider changes internally. Both the manual "Analyze & Break Down" button and the batch curriculum path feed into the same `teaching_units` table.

## Cost Comparison

| Model | Input (per 1M) | Output (per 1M) | Thinking | Search |
|-------|----------------|------------------|----------|--------|
| DeepSeek R1 (current) | $0.55 | $2.19 | Yes (uncontrolled) | No |
| Gemini 3 Pro (proposed) | $2.00 | $12.00 | Yes (configurable) | Yes |
| Gemini 3 Flash (batch) | $0.50 | $3.00 | No | No |

Gemini 3 Pro is more expensive per token but: (1) produces better structured output requiring fewer retries, (2) search grounding eliminates stale/hallucinated content, (3) configurable thinking avoids R1's unbounded token consumption. For single-LO decomposition (the agentic path), the cost per call is typically $0.01-0.03.

