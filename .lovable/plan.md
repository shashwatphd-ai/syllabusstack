
# Plan: Model Optimization for Higher-Quality Slide Generation

## Problem Summary

The current slide generation pipeline has two quality issues:

| Issue | Symptom | Root Cause |
|-------|---------|------------|
| **"N/A" on slides** | Title slides show "N/A" for misconception/example | `google/gemini-2.5-flash` is "completing" optional fields with placeholders instead of omitting them |
| **Poor visual descriptions** | Generic, uninspired image directives ("network of people", "trophy") | Flash model optimizes for speed, not creative/pedagogical depth |

## Current Model Configuration

From `openrouter-client.ts` lines 64-124:

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT ROUTING                                     │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐│
│  │   Professor AI     │     │    Visual AI       │     │   Research Agent   ││
│  │                    │     │  (Descriptions)    │     │                    ││
│  └─────────┬──────────┘     └─────────┬──────────┘     └─────────┬──────────┘│
│            │                          │                          │           │
│            ▼                          ▼                          ▼           │
│  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────────┐│
│  │ gemini-2.5-flash │      │ gemini-2.5-flash │      │ perplexity/sonar-pro ││
│  │ (Fast, Cheap)    │      │ (Same model)     │      │ (Research)           ││
│  │ $0.075/1M input  │      │                  │      │ $3.00/1M input       ││
│  └──────────────────┘      └──────────────────┘      └──────────────────────┘│
│                                                                               │
│  PROBLEM: Flash model prioritizes speed over depth. It fills optional        │
│  schema fields with "N/A" instead of omitting them, and generates            │
│  generic visual descriptions lacking pedagogical specificity.                 │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Recommended Model Selection

Based on OpenRouter's model catalog and your architecture constraints:

### Option A: Upgrade to Gemini 3 Flash Preview (Recommended)

| Role | Current Model | Proposed Model | Cost Change | Quality Improvement |
|------|---------------|----------------|-------------|---------------------|
| **Professor AI** | `google/gemini-2.5-flash` | `google/gemini-3-flash-preview` | +33% | Better instruction following, richer content |
| **Fallback** | `google/gemini-flash-1.5` | `google/gemini-2.5-flash` | Same | Stable fallback |

**Why Gemini 3 Flash Preview:**
- **Better instruction following**: Newer models respect "omit if not applicable" directives
- **Richer pedagogical output**: Improved reasoning produces more substantive content
- **Balanced cost**: $0.10/1M input vs $0.075/1M (33% increase, still affordable)
- **Already in MODELS constant**: `MODELS.SLIDES = 'google/gemini-3-flash-preview'` (line 71)

### Option B: Use Gemini 2.5 Pro for Complex Tasks (Premium)

| Role | Proposed Model | Cost | When to Use |
|------|----------------|------|-------------|
| **Professor AI** | `google/gemini-2.5-pro` | $1.25/1M input | Large courses, premium quality |
| **Fallback** | `google/gemini-3-flash-preview` | $0.10/1M input | Standard generation |

**When to choose Pro:**
- Complex pedagogical content (graduate-level courses)
- Multi-step reasoning for misconception handling
- ~16x more expensive but significantly higher quality

### Recommendation: **Option A** (Gemini 3 Flash Preview)

Best balance of quality improvement and cost efficiency. The model is already defined in your codebase but not being used.

## Detailed Technical Changes

### Change 1: Update MODELS.PROFESSOR_AI in openrouter-client.ts

**File:** `supabase/functions/_shared/openrouter-client.ts`

**Lines 68-71 - Current:**
```typescript
PROFESSOR_AI: 'google/gemini-3-flash-preview',     // Next-gen: Best quality/speed balance
PROFESSOR_AI_FALLBACK: 'google/gemini-2.5-flash',  // Fallback: Stable 2.5 Flash
SLIDES: 'google/gemini-3-flash-preview',           // Alias for clarity
```

**Analysis:** Wait - the MODELS constant **already specifies** `gemini-3-flash-preview`!

Let me trace where the actual model is being used...

**Lines 917-926 in generate-lecture-slides-v3/index.ts:**
```typescript
const aiResult = await generateText({
  prompt: userPrompt,
  systemPrompt: PROFESSOR_SYSTEM_PROMPT,
  model: MODELS.PROFESSOR_AI,              // 'google/gemini-2.5-flash' <-- COMMENT IS WRONG!
  temperature: 0.7,
  maxTokens: 16000,
  fallbacks: [MODELS.PROFESSOR_AI_FALLBACK], // 'google/gemini-flash-1.5'
  logPrefix: '[Professor AI]'
});
```

**Root Cause Found:** The **comment** in the code says `'google/gemini-2.5-flash'` but `MODELS.PROFESSOR_AI` is actually `'google/gemini-3-flash-preview'`. The code is **already using the right model** - the issue is the **prompt**, not the model!

### Re-Analysis: The Real Problem

Since `MODELS.PROFESSOR_AI = 'google/gemini-3-flash-preview'` (the correct model), the "N/A" issue is a **prompt problem**, not a model problem.

**Looking at the prompt (lines 730-908):**
The schema shows optional fields like `misconception` and `example`, but the prompt doesn't explicitly tell the model to **omit these when not applicable**. The model is being "helpful" by filling them.

### Change 2: Update Prompt to Explicitly Handle Optional Fields

**File:** `supabase/functions/generate-lecture-slides-v3/index.ts`

Add explicit instruction after line 776:

```text
7. OPTIONAL FIELDS HANDLING (CRITICAL):
   - The fields "definition", "example", "misconception", and "steps" are OPTIONAL
   - ONLY include these if the slide type warrants them
   - DO NOT fill optional fields with "N/A", "Not applicable", or placeholder text
   - If a field doesn't apply to the slide type, OMIT the key entirely from the JSON
   - For example, a "title" slide should NOT have a "misconception" or "example" block
   
   WRONG (do not do this):
   "misconception": { "wrong_belief": "N/A", "why_wrong": "N/A" }
   
   CORRECT (omit entirely):
   // No misconception key at all for title slides
```

### Change 3: Improve Visual Directive Prompt Quality

**File:** `supabase/functions/generate-lecture-slides-v3/index.ts`

Add after line 677 (within VISUAL DIRECTIVES section):

```text
VISUAL DIRECTIVE QUALITY REQUIREMENTS:
- description: Must be 50+ words, highly specific to the educational content
- Avoid generic visuals like "people connecting", "trophy", "lightbulb"
- Describe the EXACT visual representation of the concept being taught
- Include specific labels, data points, or framework components
- Match the domain terminology (e.g., for management: "Strategic Analysis Matrix with 4 quadrants labeled...")

BAD: "A diagram showing communication between people"
GOOD: "A horizontal flowchart showing the AIDA model: four connected boxes labeled 'Attention' (with eye icon), 'Interest' (with lightbulb), 'Desire' (with heart), and 'Action' (with checkmark). Arrows flow left to right. Below each box, include a one-line example from digital marketing context."
```

### Change 4: Fix Misleading Comments

**File:** `supabase/functions/generate-lecture-slides-v3/index.ts`

Update lines 913-915 to match reality:

```text
// ROUTING (Verified 2026-02):
//   Primary: MODELS.PROFESSOR_AI = 'google/gemini-3-flash-preview'
//   Fallback: MODELS.PROFESSOR_AI_FALLBACK = 'google/gemini-2.5-flash'
```

Update lines 177-194 to match reality:

```text
// CURRENT ROUTING:
//   | Operation      | Provider   | Model                              |
//   |----------------|------------|------------------------------------|
//   | Professor AI   | OpenRouter | google/gemini-3-flash-preview      |
//   | Images         | OpenRouter | google/gemini-3-pro-image-preview  |
//   | Research Agent | OpenRouter | perplexity/sonar-pro               |
```

## Files to Modify

| File | Change Type | Lines Affected |
|------|-------------|----------------|
| `supabase/functions/generate-lecture-slides-v3/index.ts` | Add optional field handling instruction | After line 776 |
| `supabase/functions/generate-lecture-slides-v3/index.ts` | Add visual directive quality requirements | After line 677 |
| `supabase/functions/generate-lecture-slides-v3/index.ts` | Fix misleading comments | Lines 177-194, 913-915 |

## Cost Analysis

**No model change required** - you're already using `gemini-3-flash-preview`.

| Model | Cost (per 1M input) | Cost (per 1M output) | Status |
|-------|---------------------|----------------------|--------|
| `google/gemini-3-flash-preview` | $0.10 | $0.40 | **Already in use** |
| `google/gemini-2.5-flash` | $0.075 | $0.30 | Fallback |

**Cost per 6-slide generation:** ~$0.002-$0.004 (unchanged)

## Expected Outcomes

After these prompt improvements:

1. **No more "N/A" on slides** - Model will omit optional fields instead of filling them
2. **Richer visual descriptions** - Specific, domain-relevant visuals with detailed elements
3. **Accurate documentation** - Comments match actual model routing

## Testing Checklist

After implementation:
- Generate slides for a teaching unit and verify no "N/A" appears on title slides
- Check that misconception fields only appear on misconception-type slides
- Verify visual descriptions are 50+ words with specific elements
- Confirm logs show `google/gemini-3-flash-preview` as the model used
- Compare before/after slide quality for the same teaching unit

## Summary

The model configuration is correct (`gemini-3-flash-preview`), but the prompt needs explicit instructions to:
1. Omit optional fields when not applicable (instead of filling with "N/A")
2. Generate detailed, domain-specific visual descriptions (50+ words)
3. Comments should be updated to match the actual routing

This is a prompt engineering fix, not a model swap.
