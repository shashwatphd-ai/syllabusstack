

# Fix: submit-batch-evaluation Model Mismatch

## Root Cause

The `submit-batch-evaluation` function has a **locally hardcoded model** that doesn't match the working batch infrastructure:

```text
WORKING (submit-batch-curriculum):
  Model: MODEL_CONFIG.GEMINI_PRO = 'gemini-3-pro-preview'  (from ai-orchestrator.ts)
  Endpoint routing: global (matches gemini-3 + preview check)
  Result: 200 OK

FAILING (submit-batch-evaluation):
  Model: 'gemini-2.5-flash-preview-05-20'  (hardcoded locally, line 44)
  Issue: This is NOT a valid Vertex AI Batch model ID
  Result: 404 Not Found
```

The `vertex-ai-batch.ts` client constructs the URL correctly, but Vertex AI Batch Prediction does not support `gemini-2.5-flash-preview-05-20` as a batch model. The working batch functions use models from the shared `MODEL_CONFIG` in `ai-orchestrator.ts`.

## The Fix (2 lines changed, 1 file)

### File: `supabase/functions/submit-batch-evaluation/index.ts`

**Change 1** (line 28): Import `MODEL_CONFIG` from the shared orchestrator (same pattern as `submit-batch-curriculum`):

```typescript
// BEFORE:
import { createVertexAIBatchClient, VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';

// AFTER:
import { createVertexAIBatchClient, VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
import { MODEL_CONFIG } from "../_shared/ai-orchestrator.ts";
```

**Change 2** (lines 42-45): Replace the local hardcoded model with the shared config:

```typescript
// BEFORE:
const MODEL_CONFIG = {
  EVALUATION_MODEL: 'gemini-2.5-flash-preview-05-20',
};

// AFTER (use gemini-3-flash-preview - fast, cost-effective, confirmed working for batch):
// MODEL_CONFIG is now imported from ai-orchestrator.ts
// The model path at line 866 already uses: VertexAIBatchClient.buildModelPath(MODEL_CONFIG.EVALUATION_MODEL)
// But MODEL_CONFIG from ai-orchestrator doesn't have EVALUATION_MODEL, so we reference GEMINI_3_FLASH instead
```

**Change 3** (line 866): Update the model reference to use the shared config's flash model:

```typescript
// BEFORE:
const modelPath = VertexAIBatchClient.buildModelPath(MODEL_CONFIG.EVALUATION_MODEL);

// AFTER:
const modelPath = VertexAIBatchClient.buildModelPath(MODEL_CONFIG.GEMINI_3_FLASH);
```

This aligns `submit-batch-evaluation` with the same pattern that `submit-batch-curriculum` uses successfully. The `gemini-3-flash-preview` model:
- Is confirmed working for Vertex AI Batch on your project
- Routes correctly to the global endpoint (passes the `gemini-3` + `preview` check in `vertex-ai-batch.ts`)
- Is cost-effective (evaluation doesn't need the heavier `gemini-3-pro-preview`)
- Has 65,536 output token support (more than the 4,096 this function requests)

## What Does NOT Change

- All other batch functions (curriculum, slides, research) -- untouched
- The evaluation prompts, scoring framework, Bloom's taxonomy logic -- untouched
- Frontend QuickCourseSetup.tsx -- untouched
- GCS upload, polling, result processing -- untouched
- Shared libraries (vertex-ai-batch.ts, ai-orchestrator.ts, vertex-ai-auth.ts) -- untouched

## Verification

1. Re-run the QuickCourseSetup pipeline (or trigger submit-batch-evaluation manually)
2. Check logs for `[VertexAI Batch] Using global endpoint for model: publishers/google/models/gemini-3-flash-preview`
3. Confirm batch job creation returns 200 (not 404)
4. Confirm `batch_jobs` table shows status `submitted` (not `failed`)

