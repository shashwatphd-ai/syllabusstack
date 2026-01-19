# OpenAI Migration Implementation Plan

> **⚠️ SUPERSEDED:** This plan has been replaced by `OPENROUTER_MIGRATION_PLAN.md`
>
> OpenRouter provides a simpler solution with:
> - Single API for ALL providers (OpenAI, Google, Anthropic)
> - Automatic fallbacks
> - Same pricing as direct API
> - Less code to maintain
>
> See `OPENROUTER_MIGRATION_PLAN.md` for the recommended approach.

---

## Executive Summary (Original - for reference)

**Objective:** Migrate 10 Supabase Edge Functions from Google Gemini API to OpenAI API for consistent quality across batch and sync operations.

**Scope:**
- 10 functions migrate to OpenAI (Chat Completions + Batch API)
- 2 functions remain on Google Gemini (image generation + search grounding)
- New shared utilities: `openai-client.ts` + `openai-batch-client.ts`

**Benefits:**
- Consistent quality: Same model (GPT-4.1 or GPT-4o-mini) for both batch and sync
- Cost savings: OpenAI Batch API also provides 50% discount
- Simplified architecture: One provider for 10/12 functions

---

## Phase 0: Pre-Migration Checklist

### Environment Variables Required

| Variable | Purpose | Where to Set |
|----------|---------|--------------|
| `OPENAI_API_KEY` | OpenAI API authentication | Supabase Dashboard → Edge Functions → Secrets |
| `GOOGLE_CLOUD_API_KEY` | Keep for 2 remaining Gemini functions | Already exists |
| `GCP_SERVICE_ACCOUNT_KEY` | Keep for GCS operations (batch file storage) | Already exists |

### Supabase Dashboard Actions (User must perform)
1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add new secret: `OPENAI_API_KEY` = `sk-...your-key...`
3. Verify existing secrets are still present

---

## Phase 1: Create Shared Utilities

### 1.1 New File: `supabase/functions/_shared/openai-client.ts`

**Purpose:** Drop-in replacement for `google-ai-gateway.ts` using OpenAI API

**Key Features:**
- Same interface as existing `callGoogleAI()` function
- Model mapping: Maps internal model names to OpenAI model IDs
- Function calling support with schema conversion
- Error handling with retries

**Interface Design:**
```typescript
// Maintains compatibility with existing code patterns
export interface OpenAIRequestOptions {
  model: string;                    // 'gpt-4.1', 'gpt-4o-mini'
  messages: ChatMessage[];          // Same format as google-ai-gateway.ts
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  tools?: ToolDefinition[];         // Function calling
  tool_choice?: ToolChoice;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

// Main function - drop-in replacement
export async function callOpenAI(options: OpenAIRequestOptions): Promise<OpenAIResponse>;

// Convenience helpers
export async function simpleCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; json?: boolean }
): Promise<string>;
```

**Model Mapping:**
```typescript
const MODEL_MAP = {
  // Complex reasoning
  'gpt-4.1': 'gpt-4.1-2025-04-14',
  'gpt-4o': 'gpt-4o-2024-11-20',

  // Fast/cheap tasks
  'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
  'gpt-4.1-mini': 'gpt-4.1-mini-2025-04-14',

  // Batch versions (same models, used via Batch API)
  'gpt-4.1-batch': 'gpt-4.1-2025-04-14',
  'gpt-4o-mini-batch': 'gpt-4o-mini-2024-07-18',
};
```

---

### 1.2 New File: `supabase/functions/_shared/openai-batch-client.ts`

**Purpose:** Replace `vertex-ai-batch.ts` for OpenAI Batch API operations

**OpenAI Batch API Flow:**
1. Create JSONL file with requests
2. Upload file to OpenAI Files API
3. Create batch with file ID
4. Poll for completion
5. Download results file

**Interface Design:**
```typescript
export type BatchJobStatus =
  | 'validating'
  | 'failed'
  | 'in_progress'
  | 'finalizing'
  | 'completed'
  | 'expired'
  | 'cancelling'
  | 'cancelled';

export interface BatchJobConfig {
  displayName: string;           // For logging/tracking
  requests: BatchRequest[];      // Array of requests to process
  endpoint: '/v1/chat/completions';  // Only supported endpoint
  completionWindow: '24h';       // 24-hour window for 50% discount
}

export interface BatchRequest {
  custom_id: string;             // Unique ID for correlating responses
  method: 'POST';
  url: '/v1/chat/completions';
  body: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    response_format?: { type: string };
  };
}

export class OpenAIBatchClient {
  // Create a new batch job
  async createBatch(config: BatchJobConfig): Promise<BatchJob>;

  // Get batch status
  async getBatch(batchId: string): Promise<BatchJob>;

  // Cancel a batch
  async cancelBatch(batchId: string): Promise<void>;

  // Download results when complete
  async getResults(outputFileId: string): Promise<BatchResult[]>;

  // Helper: Wait for completion with polling
  async waitForCompletion(batchId: string, pollIntervalMs?: number): Promise<BatchJob>;

  // Static helpers
  static isTerminalState(status: BatchJobStatus): boolean;
  static isSuccessState(status: BatchJobStatus): boolean;
}
```

**JSONL Format for Batch Requests:**
```jsonl
{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-mini", "messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]}}
{"custom_id": "req-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-mini", "messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]}}
```

---

### 1.3 Schema Conversion Helper

**Google Function Calling → OpenAI Tools Format:**

```typescript
// Google format (current)
{
  tools: [{
    functionDeclarations: [{
      name: "extract_capabilities",
      description: "...",
      parameters: { type: "object", properties: {...} }
    }]
  }],
  toolConfig: {
    functionCallingConfig: { mode: "ANY" }
  }
}

// OpenAI format (new)
{
  tools: [{
    type: "function",
    function: {
      name: "extract_capabilities",
      description: "...",
      parameters: { type: "object", properties: {...} }
    }
  }],
  tool_choice: {
    type: "function",
    function: { name: "extract_capabilities" }
  }
}
```

**Conversion Function:**
```typescript
export function convertGoogleSchemaToOpenAI(googleSchema: any): OpenAITool {
  return {
    type: 'function',
    function: {
      name: googleSchema.name,
      description: googleSchema.description,
      parameters: googleSchema.parameters
    }
  };
}
```

---

## Phase 2: Function Migration Plan

### Migration Order (by dependency)

| Order | Function | Current Model | New Model | Complexity |
|-------|----------|--------------|-----------|------------|
| 1 | `analyze-syllabus` | gemini-2.5-flash | gpt-4o-mini | Medium (function calling) |
| 2 | `gap-analysis` | gemini-2.5-flash | gpt-4o-mini | Medium (function calling) |
| 3 | `generate-recommendations` | gemini-2.5-flash | gpt-4o-mini | Medium (function calling) |
| 4 | `evaluate-content-batch` | gemini-2.5-flash | gpt-4o-mini | Low |
| 5 | `process-syllabus` | gemini-2.0/2.5-flash | gpt-4o-mini | Medium (multimodal) |
| 6 | `curriculum-reasoning-agent` | gemini-3-pro-preview | gpt-4.1 | Low |
| 7 | `submit-batch-curriculum` | gemini-3-pro (Vertex) | gpt-4.1 (Batch API) | High |
| 8 | `submit-batch-evaluation` | gemini-2.5-flash (Vertex) | gpt-4o-mini (Batch API) | High |
| 9 | `submit-batch-slides` | N/A (placeholder) | N/A | N/A |
| 10 | `process-batch-research` (batch part) | gemini-3-pro (Vertex) | gpt-4.1 (Batch API) | High |

### Functions Staying on Gemini (NO CHANGES)

| Function | Model | Reason |
|----------|-------|--------|
| `process-batch-research` (research grounding) | gemini-2.5-flash | Google Search grounding API |
| `process-batch-images` | gemini-3-pro-image-preview | Native image generation |

---

## Phase 3: Detailed Migration Steps Per Function

### 3.1 `analyze-syllabus/index.ts`

**Current Code (Lines 120-143):**
```typescript
const url = `${GOOGLE_API_BASE}/models/gemini-2.5-flash:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    tools: [{ functionDeclarations: [SYLLABUS_EXTRACTION_SCHEMA] }],
    toolConfig: { functionCallingConfig: { mode: "ANY" } }
  }),
});
```

**New Code:**
```typescript
import { callOpenAI, convertSchemaToOpenAI } from "../_shared/openai-client.ts";

const response = await callOpenAI({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ],
  tools: [convertSchemaToOpenAI(SYLLABUS_EXTRACTION_SCHEMA)],
  tool_choice: { type: 'function', function: { name: SYLLABUS_EXTRACTION_SCHEMA.name } }
});
```

**Response Parsing Change:**
```typescript
// Current (Google)
const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
const args = functionCall?.args;

// New (OpenAI)
const toolCall = response.choices[0]?.message?.tool_calls?.[0];
const args = JSON.parse(toolCall?.function?.arguments || '{}');
```

---

### 3.2 `gap-analysis/index.ts`

**Same pattern as analyze-syllabus.** Uses GAP_ANALYSIS_SCHEMA with function calling.

**Changes:**
1. Import `callOpenAI` from openai-client.ts
2. Convert function call format
3. Update response parsing

---

### 3.3 `generate-recommendations/index.ts`

**Same pattern as analyze-syllabus.** Uses RECOMMENDATIONS_SCHEMA with function calling.

---

### 3.4 `evaluate-content-batch/index.ts`

**Current Code (Line 249):**
```typescript
const url = `${GOOGLE_API_BASE}/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`;
const aiResponse = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.3 },
  }),
});
```

**New Code:**
```typescript
const response = await callOpenAI({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.3
});
const content = response.choices[0]?.message?.content;
```

---

### 3.5 `process-syllabus/index.ts`

**Three AI calls to migrate:**

1. **Domain Analysis (Line 141):** `gemini-2.5-flash` → `gpt-4o-mini`
2. **PDF Extraction (Line 345):** `gemini-2.0-flash` with multimodal → `gpt-4o-mini` with vision
3. **Structure Analysis (Line ~485):** `gemini-2.5-flash` → `gpt-4o-mini`

**Multimodal (PDF) Migration:**
```typescript
// Current (Google)
body: JSON.stringify({
  contents: [{
    parts: [
      { inline_data: { mime_type: mimeType, data: base64Content } },
      { text: "Extract ALL text content..." }
    ]
  }]
})

// New (OpenAI)
const response = await callOpenAI({
  model: 'gpt-4o-mini',
  messages: [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Content}` } },
      { type: 'text', text: "Extract ALL text content..." }
    ]
  }]
});
```

---

### 3.6 `curriculum-reasoning-agent/index.ts`

**Current Code (Line 190):**
```typescript
const url = `${GOOGLE_API_BASE}/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`;
```

**New Code:**
```typescript
const response = await callOpenAI({
  model: 'gpt-4.1',  // Complex reasoning
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
});
```

---

### 3.7 `submit-batch-curriculum/index.ts`

**Major rewrite required.** Changes from Vertex AI Batch to OpenAI Batch API.

**Current Flow:**
1. Build JSONL with Google format requests
2. Upload to GCS
3. Call Vertex AI batchPredictionJobs API
4. Store job name in database

**New Flow:**
1. Build JSONL with OpenAI format requests
2. Upload to OpenAI Files API
3. Create batch with POST /v1/batches
4. Store batch ID in database

**JSONL Format Change:**
```jsonl
// OLD (Vertex AI)
{"request":{"contents":[{"role":"user","parts":[{"text":"..."}]}],"systemInstruction":{"parts":[{"text":"..."}]}}}

// NEW (OpenAI Batch)
{"custom_id":"lo-123","method":"POST","url":"/v1/chat/completions","body":{"model":"gpt-4.1","messages":[{"role":"system","content":"..."},{"role":"user","content":"..."}]}}
```

---

### 3.8 `submit-batch-evaluation/index.ts`

**Same pattern as submit-batch-curriculum.** Convert to OpenAI Batch API.

---

### 3.9 `process-batch-research/index.ts`

**PARTIAL MIGRATION:**
- **Batch slides generation:** Migrate to OpenAI Batch API
- **Research with Google Search grounding:** KEEP on Gemini (no OpenAI equivalent)

**Hybrid Approach:**
```typescript
// For slide generation - use OpenAI
const slideResponse = await openAIBatchClient.createBatch({...});

// For research grounding - keep Google
const researchResponse = await fetch(`${GOOGLE_API_BASE}/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  body: JSON.stringify({
    tools: [{ googleSearch: {} }],  // No OpenAI equivalent
    ...
  })
});
```

---

## Phase 4: Database Schema Changes

### 4.1 batch_jobs Table

**Add new column for OpenAI batch ID:**
```sql
-- Migration
ALTER TABLE batch_jobs
ADD COLUMN openai_batch_id TEXT,
ADD COLUMN provider TEXT DEFAULT 'vertex_ai';

-- Update constraint to allow new provider
ALTER TABLE batch_jobs
DROP CONSTRAINT IF EXISTS batch_jobs_provider_check;

ALTER TABLE batch_jobs
ADD CONSTRAINT batch_jobs_provider_check
CHECK (provider IN ('vertex_ai', 'openai'));
```

### 4.2 Status Mapping

| OpenAI Status | Internal Status | Vertex AI Equivalent |
|---------------|-----------------|---------------------|
| validating | submitted | JOB_STATE_PENDING |
| in_progress | processing | JOB_STATE_RUNNING |
| finalizing | processing | JOB_STATE_RUNNING |
| completed | completed | JOB_STATE_SUCCEEDED |
| failed | failed | JOB_STATE_FAILED |
| expired | failed | JOB_STATE_EXPIRED |
| cancelled | failed | JOB_STATE_CANCELLED |

---

## Phase 5: Testing Strategy

### 5.1 Unit Tests (Per Function)

For each migrated function, verify:
1. **Request Format:** OpenAI receives correctly formatted request
2. **Response Parsing:** Response is correctly parsed to match existing behavior
3. **Error Handling:** Errors are caught and handled appropriately
4. **Token Usage Tracking:** Usage metrics are captured

### 5.2 Integration Tests

1. **Sync Functions:**
   - `analyze-syllabus`: Upload a test syllabus, verify capabilities extracted
   - `gap-analysis`: Create test job, verify gaps identified
   - `generate-recommendations`: Verify recommendations match gap analysis

2. **Batch Functions:**
   - `submit-batch-curriculum`: Submit small batch (5 LOs), verify job created
   - Poll until completion, verify results processed correctly

### 5.3 Validation Criteria

| Metric | Acceptable Range | How to Measure |
|--------|------------------|----------------|
| Response quality | Subjective review | Compare 10 outputs with old system |
| Latency (sync) | < 30 seconds | Measure p95 latency |
| Batch completion time | < 24 hours | Monitor batch jobs |
| Error rate | < 1% | Track errors in logs |
| Cost per request | Within 20% of estimate | Track token usage |

---

## Phase 6: Rollback Plan

### 6.1 Feature Flags

Add environment variable for gradual rollout:
```typescript
const USE_OPENAI = Deno.env.get('AI_PROVIDER') !== 'google';

if (USE_OPENAI) {
  response = await callOpenAI({...});
} else {
  response = await callGoogleAI({...});
}
```

### 6.2 Rollback Steps

If issues detected:
1. Set `AI_PROVIDER=google` in Supabase secrets
2. Redeploy affected functions
3. Existing batch jobs will continue (no interruption)

### 6.3 Data Preservation

- Existing batch_jobs with `provider='vertex_ai'` continue to work
- New jobs use `provider='openai'`
- Mixed state is supported during transition

---

## Phase 7: Deployment Sequence

### Step 1: Deploy Shared Utilities
```bash
# Files to create:
supabase/functions/_shared/openai-client.ts
supabase/functions/_shared/openai-batch-client.ts
```

### Step 2: Add Environment Variables
```
OPENAI_API_KEY=sk-...
AI_PROVIDER=openai  # or 'google' for rollback
```

### Step 3: Deploy Functions (Order Matters)

1. **Low Risk First:**
   - `evaluate-content-batch` (no function calling)
   - `curriculum-reasoning-agent` (simple completion)

2. **Medium Risk:**
   - `analyze-syllabus` (function calling)
   - `gap-analysis` (function calling)
   - `generate-recommendations` (function calling)
   - `process-syllabus` (multimodal)

3. **High Risk (Batch):**
   - `submit-batch-curriculum`
   - `submit-batch-evaluation`
   - `process-batch-research` (partial)

### Step 4: Run Database Migration
```sql
-- Run in Supabase SQL Editor
ALTER TABLE batch_jobs
ADD COLUMN openai_batch_id TEXT,
ADD COLUMN provider TEXT DEFAULT 'vertex_ai';
```

### Step 5: Validate Each Function
- Test with real data
- Monitor logs for errors
- Compare output quality

---

## Files to Create/Modify Summary

### New Files (2)
| File | Lines (Est.) | Description |
|------|-------------|-------------|
| `_shared/openai-client.ts` | ~200 | OpenAI Chat Completions client |
| `_shared/openai-batch-client.ts` | ~350 | OpenAI Batch API client |

### Modified Files (10)
| File | Changes |
|------|---------|
| `analyze-syllabus/index.ts` | Replace Google API call with OpenAI |
| `gap-analysis/index.ts` | Replace Google API call with OpenAI |
| `generate-recommendations/index.ts` | Replace Google API call with OpenAI |
| `evaluate-content-batch/index.ts` | Replace Google API call with OpenAI |
| `process-syllabus/index.ts` | Replace 3 Google API calls with OpenAI |
| `curriculum-reasoning-agent/index.ts` | Replace Google API call with OpenAI |
| `submit-batch-curriculum/index.ts` | Major rewrite for OpenAI Batch |
| `submit-batch-evaluation/index.ts` | Major rewrite for OpenAI Batch |
| `process-batch-research/index.ts` | Partial rewrite (batch only) |
| `poll-batch-status/index.ts` | Add OpenAI batch status polling |

### Unchanged Files (2)
| File | Reason |
|------|--------|
| `process-batch-images/index.ts` | Keeps Gemini for image generation |
| `process-batch-research/index.ts` (research part) | Keeps Gemini for Google Search grounding |

---

## Coordination Points with Lovable Agent

### For Lovable to Verify:
1. **Frontend Impact:** None expected - API responses maintain same structure
2. **Error Messages:** May need to update if error format changes
3. **Loading States:** No change needed

### Questions for Lovable:
1. Are there any frontend components that depend on specific AI response formats?
2. Is there any client-side AI model selection that needs updating?
3. Are there any hardcoded model names in the frontend?

### Information Lovable Needs:
1. New environment variable: `OPENAI_API_KEY` must be set
2. Database migration script provided above
3. Rollback procedure documented

---

## Success Criteria

Migration is complete when:
- [ ] All 10 functions respond correctly with OpenAI
- [ ] Batch jobs complete within 24 hours
- [ ] Error rate < 1%
- [ ] No frontend changes required
- [ ] Rollback tested and documented
- [ ] Cost tracking shows expected pricing

---

## Appendix A: API Reference

### OpenAI Chat Completions
```
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer $OPENAI_API_KEY
```

### OpenAI Files API
```
POST https://api.openai.com/v1/files
Authorization: Bearer $OPENAI_API_KEY
Content-Type: multipart/form-data
```

### OpenAI Batches API
```
POST https://api.openai.com/v1/batches
GET https://api.openai.com/v1/batches/{batch_id}
POST https://api.openai.com/v1/batches/{batch_id}/cancel
```

---

## Appendix B: Cost Comparison

| Operation | Current (Google) | New (OpenAI) | Change |
|-----------|-----------------|--------------|--------|
| Complex reasoning (sync) | $2.00/$12.00 | $2.00/$8.00 | -33% output |
| Complex reasoning (batch) | $1.00/$6.00 | $1.00/$4.00 | -33% output |
| Fast tasks (sync) | $0.15/$0.60 | $0.15/$0.60 | Same |
| Fast tasks (batch) | $0.075/$0.30 | $0.075/$0.30 | Same |

*Prices per 1M tokens (input/output)*
