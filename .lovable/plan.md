

# Syllabus Pipeline Enhancement — Final Corrected Plan

## What the Documentation Confirms

From the official Gemini 3 Flash docs:

| Spec | Value |
|------|-------|
| Model ID | `gemini-3-flash-preview` |
| Max input tokens | 1,048,576 (1M) |
| Max output tokens | **65,536** |
| PDF support | Native (direct `application/pdf` input) |
| Structured output | Supported |
| Thinking levels | minimal, low, medium, high |

This means **65,536 is the correct max output for ALL steps** — the previous plan's "32,768 for structure" was unnecessarily conservative.

---

## Current State vs. Proposed State

```text
STEP               CURRENT MODEL        CURRENT OUTPUT   VIA           STATUS
---------------------------------------------------------------------------
Text Extraction    gemini-2.0-flash      16,384 tokens   Direct API    Truncates large docs
Domain Analysis    gemini-2.5-flash      ~8K default      OpenRouter    Works but weak model
Structure Analysis gemini-2.5-flash      ~8K default      OpenRouter    FAILS (413 error)

STEP               PROPOSED MODEL           PROPOSED OUTPUT   VIA           STATUS
---------------------------------------------------------------------------
Text Extraction    gemini-3-flash-preview    65,536 tokens    Direct API    Full capture
Domain Analysis    gemini-3-flash-preview    8,192 tokens     Direct API    Consistent
Structure Analysis gemini-3-flash-preview    65,536 tokens    Direct API    No 413 possible
```

---

## The 4 Changes (All in `supabase/functions/process-syllabus/index.ts`)

### Change 1: Add `callGeminiDirect()` helper function

Insert after line 65 (after DOCX helpers, before domain analyzer). A reusable function that:

- Calls `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Uses `gemini-3-flash-preview` as default model
- Accepts configurable `maxOutputTokens`, `temperature`
- Uses `responseMimeType: "application/json"` when JSON output is needed (eliminates markdown wrapping)
- Logs prompt size and model for debugging
- Returns the text content from the response

```typescript
async function callGeminiDirect(
  prompt: string,
  apiKey: string,
  options: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    jsonOutput?: boolean;
    logPrefix?: string;
  } = {}
): Promise<string> {
  const model = options.model || 'gemini-3-flash-preview';
  const logPrefix = options.logPrefix || '[GeminiDirect]';
  console.log(`${logPrefix} Calling ${model}, prompt: ${prompt.length} chars`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.3,
    maxOutputTokens: options.maxOutputTokens ?? 65536,
  };
  if (options.jsonOutput) {
    generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err.substring(0, 500)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  console.log(`${logPrefix} Response: ${text.length} chars`);
  return text;
}
```

This mirrors the pattern already proven at lines 343-379 but is cleaner and reusable. No new files, no new dependencies.

---

### Change 2: Upgrade text extraction (Lines 343 and 376)

Two sub-changes:

**Line 343** — Upgrade model from `gemini-2.0-flash` to `gemini-3-flash-preview`:
```
BEFORE: generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
AFTER:  generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent
```

**Line 376** — Increase output budget from 16,384 to 65,536:
```
BEFORE: maxOutputTokens: 16384
AFTER:  maxOutputTokens: 65536
```

Why: A 44-page syllabus contains 15,000-25,000 words. At 16K output tokens (~12K words), the model is told "Do NOT summarize" but the token budget silently cuts it off. 65,536 is the model's confirmed maximum output — it will use only what's needed (small docs still produce small output).

---

### Change 3: Route structure analysis through direct Gemini (Lines 483-501)

Replace the `generateText()` call (which routes through OpenRouter and triggers 413) with `callGeminiDirect()`:

```typescript
// Use direct Gemini API - bypasses OpenRouter 100KB body limit
// Gemini 3 Flash has 1M token input, handles any syllabus
let structureResultContent: string;
try {
  structureResultContent = await callGeminiDirect(
    structurePrompt,
    GOOGLE_CLOUD_API_KEY,
    {
      temperature: 0.3,
      maxOutputTokens: 65536,
      jsonOutput: true,
      logPrefix: '[process-syllabus:structure]',
    }
  );
} catch (directError) {
  // Fallback: OpenRouter with truncated text if Google API fails
  console.error('[process-syllabus] Direct Gemini failed, falling back to OpenRouter:', directError);
  const truncatedPrompt = structurePrompt.substring(0, 80000) +
    '\n\n[Document truncated for size. Extract what you can from available text.]';
  const fallbackResult = await generateText({
    prompt: truncatedPrompt,
    model: MODELS.GEMINI_FLASH,
    logPrefix: '[process-syllabus:structure-fallback]',
  });
  structureResultContent = fallbackResult.content;
}

if (!structureResultContent) throw new Error("No content returned from AI");

let courseStructure: CourseStructure;
try {
  courseStructure = parseJsonResponse<CourseStructure>(structureResultContent);
} catch (parseError) {
  console.error("Failed to parse AI response:", structureResultContent.substring(0, 500));
  throw new Error("Failed to parse course structure from AI response");
}
```

Primary path: Direct Google API (no body size limit, 1M token input).
Fallback: OpenRouter with truncated text (only if Google API key fails).

---

### Change 4: Route domain analysis through direct Gemini (Lines 141-148)

Replace the `generateText()` call in `analyzeDomainWithAI()`:

```typescript
try {
  const rawContent = await callGeminiDirect(
    metaPrompt,
    Deno.env.get("GOOGLE_CLOUD_API_KEY")!,
    {
      temperature: 0.3,
      maxOutputTokens: 8192,
      jsonOutput: true,
      logPrefix: '[DOMAIN-ANALYZER]',
    }
  );

  if (!rawContent) {
    console.warn('[DOMAIN-ANALYZER] AI returned no content');
    return getFallbackDomainConfig(syllabusText);
  }

  try {
    const config = parseJsonResponse<DomainConfig>(rawContent);
    console.log(`[DOMAIN-ANALYZER] AI identified domain: ${config.domain}`);
    return config;
  } catch (parseError) {
    console.warn('[DOMAIN-ANALYZER] Parse failed, using fallback');
    return getFallbackDomainConfig(syllabusText);
  }
} catch (error) {
  console.error('[DOMAIN-ANALYZER] Error:', error);
  return getFallbackDomainConfig(syllabusText);
}
```

Domain analysis only processes 8K chars of input and produces a small JSON config, so `maxOutputTokens: 8192` is plenty. The reason to change this is consistency: after this fix, the entire `process-syllabus` function has zero OpenRouter dependency.

---

### Change 5 (Bonus): Enrich prompt and interfaces for rich syllabi

**Update the structure prompt (lines 473-481)** to extract richer data from detailed syllabi:

- Change Rule 1 from "Create 3-8 modules" to "Create 3-15 modules" (large syllabi have more structure)
- Add optional fields to the JSON schema:
  - Per module: `key_topics` (string array), `assessment_type` (string), `readings` (string array)
  - Per LO: `prerequisites` (string array)
  - Course level: `textbooks` (string array), `grading_structure` (object)
- Add rule: "If the syllabus contains assessment details, reading lists, project descriptions, or grading weights, extract them into the corresponding fields."

**Update TypeScript interfaces (lines 215-236):**

```typescript
interface Module {
  title: string;
  description: string;
  learning_objectives: LearningObjective[];
  key_topics?: string[];
  assessment_type?: string;
  readings?: string[];
}

interface LearningObjective {
  text: string;
  core_concept: string;
  action_verb: string;
  bloom_level: string;
  domain: string;
  specificity: string;
  search_keywords: string[];
  prerequisites?: string[];
}

interface CourseStructure {
  course_title?: string;
  course_description?: string;
  modules: Module[];
  unassigned_objectives: LearningObjective[];
  textbooks?: string[];
  grading_structure?: Record<string, number>;
}
```

All new fields are optional — short syllabi simply omit them. No database migration needed.

**Use enriched data in the record-building loops (lines 507-601):**

- Pack `key_topics`, `readings`, `assessment_type` into module `description` (existing TEXT column)
- Append `prerequisites` terms to LO `search_keywords` (existing JSONB array)
- Store `textbooks` and `grading_structure` in `domain_config` (existing JSONB column on `instructor_courses`)

---

## How Small vs. Large Syllabi Are Handled

The same code path serves both. `maxOutputTokens` is a ceiling, not a target.

| Syllabus Size | Extraction Output | Modules | LOs | Downstream Effect |
|---|---|---|---|---|
| 1-5 pages (~2K words) | ~3K tokens (well under 65K) | 3-5 | 10-15 | Normal quality |
| 10-20 pages (~8K words) | ~10K tokens | 5-8 | 20-30 | Good quality |
| 44+ pages (~25K words) | ~35K tokens (was truncated at 16K) | 8-15 | 30-50 | Full richness captured |

---

## What Does NOT Change

| Component | Why |
|---|---|
| Frontend (SyllabusUploader.tsx, useProcessSyllabus hook) | Just passes data through |
| Database schema | All enriched data fits in existing TEXT and JSONB columns |
| Module/LO insert and deduplication logic (lines 503-616) | Already handles batch inserts |
| Batch curriculum trigger (lines 619-651) | Fire-and-forget, reads from DB |
| All downstream functions (slides, audio, content search) | Read from DB, automatically benefit from richer data |
| `_shared/unified-ai-client.ts` and `_shared/openrouter-client.ts` | Unchanged |
| Security fixes from previous session | Unchanged |

---

## Implementation Summary

| # | What | Where in File | Approx Lines |
|---|------|---------------|-------------|
| 1 | Add `callGeminiDirect()` helper | After line 65 | ~30 new lines |
| 2 | Upgrade extraction model to `gemini-3-flash-preview` | Line 343 | 1 line changed |
| 3 | Increase extraction `maxOutputTokens` to 65536 | Line 376 | 1 line changed |
| 4 | Replace structure analysis with direct Gemini + fallback | Lines 483-501 | ~25 lines replaced |
| 5 | Replace domain analysis with direct Gemini | Lines 141-148 | ~20 lines replaced |
| 6 | Add optional enrichment fields to interfaces | Lines 215-236 | ~10 lines added |
| 7 | Enrich structure prompt | Lines 473-481 | ~15 lines added |
| 8 | Use enriched data in record building | Lines 507-512 | ~10 lines added |

Total: ~1 file modified, ~110 lines changed/added. No new files. No migrations. No frontend changes.

## Verification After Deploy

1. Re-upload the 44-page syllabus -- should succeed without 413
2. Check logs for `[process-syllabus:structure] Calling gemini-3-flash-preview`
3. Verify module count (expect 8-15 vs previous failure)
4. Verify LO `search_keywords` include prerequisite terms
5. Upload a small 2-page syllabus -- should still work normally
6. Check `instructor_courses.domain_config` has enriched metadata

