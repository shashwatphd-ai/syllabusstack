
# Revert Unnecessary Edits to Slide Generation Pipeline

## What Happened

The original task was upgrading the CMM system prompt in `ai-narrator.ts` (audio narration only). When an unrelated 500 error appeared in the **slide generation** pipeline (`generate-lecture-slides-v3`), two defensive edits were made to files that had nothing to do with the original task:

1. **Edit to `openrouter-client.ts`** (lines 423-428): Added a guard clause for empty `choices`
2. **Edit to `unified-ai-client.ts`** (lines 229-273): Added a retry loop in `generateText()`

The 500 error was caused by OpenRouter returning HTTP 200 with an empty response because `google/gemini-3-flash-preview` (and its fallback `google/gemini-2.5-flash`) were both experiencing a transient upstream outage. This is **not a code bug** -- it's an external provider issue.

## What To Do

### 1. Revert `unified-ai-client.ts` -- Remove the retry loop

**Why:** The retry loop is redundant. OpenRouter already handles model fallback internally via `route: 'fallback'` + `models: [primary, fallback]` in `callOpenRouter`. Adding a wrapper retry just doubles the wait time (3-6 seconds of artificial delay) without improving success rates -- it retries the same failed model pair.

**Change:** Lines 229-273 revert to the original simple try/catch:

```typescript
try {
  const content = await simpleCompletion(
    model,
    request.systemPrompt || 'You are a helpful assistant.',
    request.prompt,
    {
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      json: request.json,
      fallbacks,
    },
    logPrefix
  );

  const latency_ms = Date.now() - startTime;

  return {
    content,
    provider: 'openrouter',
    model,
    latency_ms,
    cost_usd: estimateCost(model, request.prompt.length, content.length),
  };
} catch (error) {
  console.error(`${logPrefix} OpenRouter failed:`, error);
  throw error;
}
```

### 2. Keep `openrouter-client.ts` guard clause -- This is actually good

**Why:** The guard clause at line 424 (`if (!data.choices || data.choices.length === 0)`) prevents the original crash (`Cannot read properties of undefined (reading '0')`). Without it, the system crashes with an unhelpful error. With it, the system throws a descriptive error. This is a genuine null-safety fix that was missing, even if it was discovered tangentially.

**No change needed here.**

### 3. Keep `ai-narrator.ts` -- The Master Educator Blueprint is correct

The CMM prompt upgrade is fully isolated to audio narration. No changes needed.

## Summary of Changes

| File | Action | Reason |
|---|---|---|
| `unified-ai-client.ts` | Revert retry loop (lines 229-273) | Redundant with OpenRouter's native fallback; adds artificial delay |
| `openrouter-client.ts` | Keep as-is | Guard clause is a genuine safety fix |
| `ai-narrator.ts` | Keep as-is | Original task, fully isolated |

## After Deployment

The slide generation will behave exactly as it did before these edits, with one improvement: empty OpenRouter responses now throw a descriptive error instead of crashing on `undefined[0]`. The upstream provider outage is a transient external issue that no code change can fix.
