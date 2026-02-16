# Slide Generation System — Complete Code-Based Audit

> **Date**: 2026-02-08
> **Source**: Code-only analysis of `main` branch. No documentation referenced.
> **Method**: Line-by-line trace of every edge function, hook, component, and shared utility.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Database Schema](#3-database-schema)
4. [AI Model Routing](#4-ai-model-routing)
5. [PATHWAY A: Single Slide Generation (Fast Path)](#5-pathway-a-single-slide-generation)
6. [PATHWAY B: Batch Slide Generation (Cost-Optimized Path)](#6-pathway-b-batch-slide-generation)
7. [PATHWAY C: Async Image Generation (Queue System)](#7-pathway-c-async-image-generation)
8. [PATHWAY D: Audio Generation (TTS)](#8-pathway-d-audio-generation)
9. [PATHWAY E: Progressive Generation Trigger (Enrollment-Based)](#9-pathway-e-progressive-generation-trigger)
10. [Frontend Mutation Hooks & CRUD](#10-frontend-mutation-hooks--crud)
11. [Publishing Workflow](#11-publishing-workflow)
12. [Conditional Branch Map (If/Then/Else)](#12-conditional-branch-map)
13. [Shared Utilities Reference](#13-shared-utilities-reference)
14. [Quality Metrics System](#14-quality-metrics-system)
15. [Storage Buckets](#15-storage-buckets)
16. [Security & Access Control](#16-security--access-control)

---

## 1. System Overview

The slide generation system converts **teaching units** (pedagogical atoms) into **6-slide lecture decks** with optional images and audio narration. It is an AI-native content pipeline with no static templates — all structure emerges from LLM generation + React rendering.

**Core entities:**
- `teaching_units` → input (what to teach)
- `lecture_slides` → output (the generated deck)
- `batch_jobs` → orchestrator for bulk generation
- `image_generation_queue` → async image pipeline
- `research_cache` → cached Perplexity research results

**Number of edge functions involved:** 7
**Number of frontend hooks:** 8+
**Number of AI model calls per single slide generation:** 2-3 (research + professor + optional image prompt)

---

## 2. Tech Stack

### Backend
| Layer | Technology | Details |
|-------|-----------|---------|
| Runtime | Deno (Supabase Edge Functions) | 150s timeout limit |
| Database | PostgreSQL (Supabase) | JSONB for slides array |
| Storage | Supabase Storage | `lecture-audio`, `lecture-visuals` buckets |
| Auth | Supabase Auth + RLS | JWT tokens, service role for queue |
| Batch Processing | Vertex AI Batch Prediction | 50% cost discount (optional) |
| Cloud Storage | Google Cloud Storage | For Vertex AI batch I/O |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React + TypeScript |
| State Management | TanStack React Query (v5) |
| Routing | TanStack Router |
| Forms | react-hook-form + zod |
| UI Components | Radix UI + Tailwind CSS |
| Icons | lucide-react |
| PDF Export | html2pdf.js |

### AI Services (all via OpenRouter unless toggled)
| Operation | Model | Fallback | Provider |
|-----------|-------|----------|----------|
| Slide Content ("Professor AI") | `google/gemini-3-flash-preview` | `google/gemini-2.5-flash` | OpenRouter |
| Research / Web Search | `perplexity/sonar-pro` | `perplexity/sonar` | OpenRouter |
| Image Generation | `google/gemini-3-pro-image-preview` | `google/gemini-2.5-flash-image` | OpenRouter OR Google Native (toggle) |
| Image Prompt Writing | `google/gemini-2.5-flash-lite` | `openai/gpt-4o-mini` | OpenRouter |
| Audio Narration Enhancement | Gemini (via `ai-narrator.ts`) | Simple fallback builder | Google Direct |
| SSML Transformation | Gemini (via `ssml-transformer.ts`) | Plain text passthrough | Google Direct |
| Audio Segment Mapping | Gemini (via `segment-mapper.ts`) | No mapping | Google Direct |
| Text-to-Speech | Google Cloud TTS Neural2 | — | Google Direct |

### Environment Variable Toggles
| Variable | Options | Controls |
|----------|---------|----------|
| `BATCH_PROVIDER` | `'openrouter'` (default) / `'vertex'` | Batch slide routing |
| `IMAGE_PROVIDER` | `'openrouter'` (default) / `'google'` | Image generation routing |
| `ENABLE_RESEARCH_CACHE` | `'true'` (default) / `'false'` | Research result caching |

---

## 3. Database Schema

### `lecture_slides` (primary output table)
```
id                        UUID PK
teaching_unit_id          UUID FK (unique constraint — 1 deck per unit)
learning_objective_id     UUID FK
instructor_course_id      UUID FK
title                     TEXT
slides                    JSONB (array of slide objects)
total_slides              INTEGER
estimated_duration_minutes INTEGER
slide_style               TEXT ('standard'|'minimal'|'detailed'|'interactive')
generation_context        JSONB
generation_model          TEXT
status                    TEXT → 'pending'|'preparing'|'batch_pending'|'generating'|'ready'|'published'|'failed'
error_message             TEXT
has_audio                 BOOLEAN
audio_status              TEXT → 'pending'|'generating'|'ready'|'failed'
quality_score             INTEGER (0-100)
citation_count            INTEGER
is_research_grounded      BOOLEAN
research_context          JSONB
generation_phases         JSONB (progress tracking)
batch_job_id              UUID FK
created_by                UUID FK
created_at / updated_at   TIMESTAMPTZ
```

### `batch_jobs` (orchestration table)
```
id                  UUID PK
google_batch_id     TEXT (Vertex AI job ID, nullable for OpenRouter mode)
instructor_course_id UUID FK
job_type            TEXT ('slides'|'audio'|'assessment')
total_requests      INTEGER
status              TEXT → 'submitted'|'processing'|'completed'|'failed'|'partial'|'preparing'|'researching'
succeeded_count     INTEGER
failed_count        INTEGER
output_uri          TEXT (GCS path)
error_message       TEXT
failed_request_keys JSONB
request_mapping     JSONB
research_data       JSONB
created_by          UUID
created_at / updated_at / completed_at TIMESTAMPTZ
```

### `image_generation_queue` (async image pipeline)
```
id                UUID PK
lecture_slides_id UUID FK
slide_index       INTEGER
slide_title       TEXT
prompt            TEXT
status            TEXT → 'pending'|'processing'|'completed'|'failed'|'skipped'
attempts          INTEGER
max_attempts      INTEGER
error_message     TEXT
image_url         TEXT
created_at / started_at / processed_at TIMESTAMPTZ
```
**Unique constraint:** `(lecture_slides_id, slide_index)` — prevents duplicate queue entries.

### `research_cache` (Perplexity result caching)
```
topic_hash        TEXT (SHA-256, unique)
search_terms      TEXT
domain            TEXT
research_content  JSONB (full ResearchContext)
input_tokens      INTEGER
output_tokens     INTEGER
expires_at        TIMESTAMPTZ (default: +7 days)
hit_count         INTEGER
```

---

## 4. AI Model Routing

**Source:** `_shared/openrouter-client.ts` (lines 64-130) and `_shared/unified-ai-client.ts` (lines 1-50)

All AI calls are routed through the **Unified AI Client** (`unified-ai-client.ts`), which delegates to OpenRouter (`openrouter-client.ts`). The model constants live in the `MODELS` object:

```typescript
// openrouter-client.ts:64-130
MODELS = {
  PROFESSOR_AI:          'google/gemini-3-flash-preview',
  PROFESSOR_AI_FALLBACK: 'google/gemini-2.5-flash',
  IMAGE:                 'google/gemini-3-pro-image-preview',
  IMAGE_FALLBACK:        'google/gemini-2.5-flash-image',
  IMAGE_FREE:            'google/gemini-2.5-flash-image-preview:free',
  RESEARCH:              'perplexity/sonar-pro',
  RESEARCH_FALLBACK:     'perplexity/sonar',
  REASONING:             'deepseek/deepseek-r1',
  FAST:                  'google/gemini-2.5-flash-lite',
  // ... plus PARSING, GENERAL, etc.
}
```

**Model config constants** also exist in `_shared/ai-orchestrator.ts` (lines 36-47) for Vertex AI batch operations:
```typescript
MODEL_CONFIG = {
  GEMINI_FLASH:    'gemini-2.5-flash',
  GEMINI_3_FLASH:  'gemini-3-flash-preview',
  GEMINI_PRO:      'gemini-3-pro-preview',
  GEMINI_IMAGE:    'gemini-3-pro-image-preview',
}
```

---

## 5. PATHWAY A: Single Slide Generation

**Entry point:** `supabase/functions/generate-lecture-slides-v3/index.ts` (1502 lines)
**Frontend trigger:** `useGenerateLectureSlides()` in `src/hooks/lectureSlides/mutations.ts:17`
**Invocation:** `supabase.functions.invoke('generate-lecture-slides-v3', { body: { teaching_unit_id, style, regenerate } })`

### Step-by-step execution:

#### STEP 1: Request Parsing (line 1146-1161)
```
Input: { teaching_unit_id, style='standard', regenerate=false, user_id?, _from_queue=false }
```

#### STEP 2: Authentication (lines 1181-1203)
```
IF authHeader exists:
  IF token === supabaseServiceRoleKey:
    → Service role call. Use explicitUserId. Skip rate limit.
  ELSE:
    → Validate JWT via supabase.auth.getUser(token)
    → Extract userId
ELSE:
  → userId = null (proceeds but ownership checks relaxed)
```

#### STEP 3: Rate Limiting (lines 1206-1212)
```
IF userId exists AND NOT isServiceRoleCall:
  → getUserLimits(supabase, userId)
  → checkRateLimit(supabase, userId, 'generate-lecture-slides-v3', limits)
  IF NOT allowed:
    → RETURN 429 Rate Limit Response. STOP.
```

#### STEP 4: Context Gathering — PHASE 1 (lines 1214-1216)
**Function:** `fetchTeachingUnitContext()` (line 312-483)

Sequential database queries:
1. **Teaching unit** → `teaching_units` table (line 320-334)
   - IF not found → throw Error. STOP.
   - IF missing `learning_objective_id` → throw Error. STOP.

2. **Learning objective** → `learning_objectives` table (line 342-364)
   - IF not found → throw Error. STOP.
   - IF missing `instructor_course_id` → throw Error. STOP.

3. **Course** → `instructor_courses` table (line 367-381)
   - IF not found → throw Error. STOP.
   - IF userId exists AND course.instructor_id !== userId → throw Error("Not authorized"). STOP.
   - Extracts `domain_config` (DomainConfig JSONB)

4. **Module** → `modules` table (line 398-412)
   - IF module_id missing → defaults: title='Unassigned', description='', sequence=0
   - IF query fails → warn and continue with defaults

5. **Sibling units** → `teaching_units` filtered by same `learning_objective_id` (line 415-423)
   - IF query fails → warn and continue with empty array

Returns complete `TeachingUnitContext` object with all pedagogical metadata.

#### STEP 5: Upsert Slide Record (lines 1220-1248)
```
Upsert into lecture_slides with:
  - status: 'generating'
  - generation_phases: { current_phase: 'professor', progress_percent: 0 }
  - onConflict: 'teaching_unit_id' (one deck per unit)
  IF regenerate: clear slides to []
```

#### STEP 6: Research Agent — PHASE 2 (lines 1251-1264)
**Function:** `runResearchAgent()` (line 593-618)

```
→ buildResearchQuery(context, domainConfig)
  - Uses domainConfig.trusted_sites or defaults ['scholar.google.com', '.edu']
  - Uses domainConfig.avoid_sources or defaults
  - Builds structured research request string

→ searchGrounded({ query, logPrefix })
  - unified-ai-client.ts → OpenRouter → perplexity/sonar-pro
  - Returns: grounded_content[], recommended_reading[], visual_descriptions[]

IF research fails (any error):
  → Log warning, continue with EMPTY research context
  → getEmptyResearchContext(topic) = { grounded_content: [], recommended_reading: [], visual_descriptions: [] }
```

#### STEP 7: Professor AI — PHASE 2C (lines 1266-1277)
**Function:** `runProfessorAI()` (line 870-1108)

1. **Build lecture brief:** `buildLectureBrief(context)` (line 489-548)
   - Assembles: course context, module context, learning objective, sequence position, teaching unit details, prerequisites, misconceptions, avoid terms, duration

2. **Merge research:** `mergeResearchIntoBrief(baseBrief, researchContext)` (line 634-679)
   ```
   IF researchContext.grounded_content.length === 0:
     → Append "No external research available" notice
     → Tell AI to use training data, mark as "illustrative examples"
   ELSE:
     → Append verified definitions with [Source N] markers
     → Append recommended reading
     → Append visual framework descriptions
     → Append citation rules (CRITICAL: must use verified data)
   ```

3. **Generate slides:** `generateText()` via unified AI client (line 1082-1091)
   ```
   model: MODELS.PROFESSOR_AI ('google/gemini-3-flash-preview')
   temperature: 0.4
   maxTokens: 16000
   fallbacks: [MODELS.PROFESSOR_AI_FALLBACK ('google/gemini-2.5-flash')]
   ```

4. **Parse response:** `parseJsonFromAI()` (line 202-207)
   - Extracts JSON from markdown code blocks if wrapped
   - IF parse fails → throw Error. Slide record marked 'failed'.

**Fixed output:** 6 slides per teaching unit.

#### STEP 8: Save Slides — PHASE 3 (lines 1279-1355)

1. Transform `ProfessorSlide[]` → storage format with:
   - `visual.url = null` (images generated async later)
   - Layout hints preserved (`main_text_layout`, `key_points_layout`)
   - `visual_directive` mapped to `visual` object

2. Calculate quality metrics: `calculateQualityMetrics()` (line 213-305)
   - Base score: 70
   - +5 if avgMainTextWords >= 50
   - +10 if avgSpeakerNotesWords >= 200
   - +5 if avgKeyPointsPerSlide >= 3
   - +5 if has misconception slide
   - +5 if has definition slide
   - +5 if citationCount >= 3
   - -2 per quality warning
   - Clamped to 0-100
   - **Logging only — NOT a gate. Never blocks saving.**

3. Save to `lecture_slides` with `status: 'ready'`

#### STEP 9: Queue Images — PHASE 4 (lines 1357-1443)

```
Filter slides where visual.type !== 'none' and visual.type exists

IF slidesNeedingVisuals.length > 0:
  → Build queue items with image prompts
  → Upsert into image_generation_queue (onConflict: lecture_slides_id,slide_index)
  → Fire-and-forget: fetch('process-batch-images', { continue: true })
    IF fetch fails → warn only, don't fail the response
```

#### STEP 10: Return Response (lines 1445-1479)
```json
{
  "success": true,
  "slideId": "uuid",
  "slideCount": 6,
  "imagesQueued": 4,
  "qualityScore": 85,
  "durationMs": 25000,
  "version": 3
}
```

#### ERROR PATH (lines 1481-1498)
```
IF any phase throws:
  → Update lecture_slides.status = 'failed', error_message = error text
  → Return 500 INTERNAL_ERROR
```

---

## 6. PATHWAY B: Batch Slide Generation

Two-function split architecture due to Supabase Edge Function 150s timeout.

### STEP B1: Submit Placeholders (Fast)
**File:** `supabase/functions/submit-batch-slides/index.ts`
**Input:** `{ instructor_course_id, teaching_unit_ids[] }`

1. Validate input
2. Check existing slides (skip already-generated)
3. Create `batch_jobs` record with `status: 'preparing'`
4. Create `lecture_slides` records with `status: 'preparing'` for each unit
5. Return immediately with `{ batchJobId, total, skipped }`

### STEP B2: Process Research + Generation (Slow)
**File:** `supabase/functions/process-batch-research/index.ts`
**Input:** `{ batch_job_id }`

**Provider toggle** (line 61):
```
BATCH_PROVIDER = Deno.env.get('BATCH_PROVIDER') || 'openrouter'
```

#### IF BATCH_PROVIDER === 'openrouter' (default):
1. Fetch all teaching units for this batch
2. For each unit:
   a. Check research cache → `getCachedResearch(supabase, searchTerms, domain)`
   b. IF cache HIT → use cached research
   c. IF cache MISS → `searchGrounded()` via Perplexity → `cacheResearch()` (7-day TTL)
3. Process each unit sequentially via `generateText()` (same model as v3)
4. Update `lecture_slides` records inline as each completes
5. Queue images for completed slides

#### IF BATCH_PROVIDER === 'vertex':
1. Same research phase as above
2. Build JSONL request file for Vertex AI Batch Prediction
3. Upload JSONL to Google Cloud Storage
4. Create Vertex AI batch prediction job
5. Store `google_batch_id` in `batch_jobs` table
6. Return — polling handled by `poll-active-batches`

### STEP B3: Polling (Vertex mode only)
**File:** `supabase/functions/poll-active-batches/index.ts`
**Trigger:** pg_cron every 30 seconds

1. Query `batch_jobs` where status IN ('submitted', 'processing', 'pending', 'researching') AND `google_batch_id` IS NOT NULL
2. IF no active batches → return early
3. For each active batch:
   a. Poll Vertex AI with exponential backoff (1s → 2s → 4s, max 3 retries)
   b. Map Vertex state → internal status
   c. Update `batch_jobs` table (triggers Supabase Realtime to all subscribers)
   d. IF completed successfully → `processCompletedBatch()` — parse results, update `lecture_slides`
   e. IF failed → mark associated `lecture_slides` as 'failed'

---

## 7. PATHWAY C: Async Image Generation

**File:** `supabase/functions/process-batch-images/index.ts`
**Architecture:** Queue-based self-continuation to avoid 60s edge function timeout.

### Trigger Modes (line 22-26):
| Input | Behavior |
|-------|----------|
| `{ continue: true }` | Process next batch from queue |
| `{ lecture_slides_id }` | Process specific lecture |
| `{ lecture_slides_ids }` | Process multiple lectures |
| `{ batch_job_id }` | Legacy: populate queue from batch then process |

### Configuration (lines 54-60):
```
BATCH_SIZE = 1          (items per invocation)
MAX_CONCURRENT = 1      (concurrent image generations)
BATCH_DELAY_MS = 2000   (delay between items)
```

### Per-Image Processing:

#### STEP C1: Check if image needed
**Function:** `slideNeedsImage()` (line 329-344)
```
IF slide.visual.url exists → SKIP (already has image)
IF slide.type IN ['conclusion', 'recap', 'further_reading', 'title'] → SKIP
IF slide.visual_directive.type exists AND !== 'none' → NEEDS IMAGE
IF slide has content (main_text, key_points, steps, definition) → NEEDS IMAGE
```

#### STEP C2: Build Image Prompt via LLM
**Function:** `buildImagePrompt()` (line 372-420)
```
→ serializeSlideContext(slide, lectureTitle, domain)
  (Includes ALL: content, steps, layout hints, pedagogy, speaker notes, visual directive)

→ simpleCompletion(MODELS.FAST, IMAGE_PROMPT_WRITER_SYSTEM, context)
  Model: google/gemini-2.5-flash-lite (~$0.00005 per call)
  Temperature: 0.4
  Max tokens: 350

IF LLM call fails:
  → buildFallbackPrompt(slide, lectureTitle, domain) — static template
```

The `IMAGE_PROMPT_WRITER_SYSTEM` encodes image rendering rules for gemini-3-pro-image-preview:
- Max 5 text labels, each max 2 words
- Spatial descriptions required
- Clean flat design, white background
- Adapts to slide type (process → flowchart, definition → centered term, etc.)

#### STEP C3: Generate Image
**Provider toggle** (unified-ai-client.ts line 69):
```
IMAGE_PROVIDER = Deno.env.get('IMAGE_PROVIDER') || 'openrouter'

IF IMAGE_PROVIDER === 'google':
  → generateImageGoogle() — native Google Generative Language API
  → Model: gemini-3-pro-image-preview
ELSE:
  → generateImageOpenRouter() — via OpenRouter
  → Primary: MODELS.IMAGE ('google/gemini-3-pro-image-preview')
  → Fallback chain: try primary, IF 5xx error → try MODELS.IMAGE_FALLBACK
```

#### STEP C4: Upload to Storage
```
→ Decode base64 response
→ Upload to Supabase storage: lecture-visuals/{lecture_slides_id}/slide_{index}.webp
→ Get public URL
→ Update image_generation_queue status = 'completed', image_url = URL
→ Update lecture_slides.slides[index].visual.url = URL (JSONB patch)
```

#### STEP C5: Self-Continuation
```
IF more pending items exist in queue:
  → fetch('process-batch-images', { continue: true })  // self-invoke
  → Prevents timeout by breaking work into small batches
```

---

## 8. PATHWAY D: Audio Generation

**File:** `supabase/functions/generate-lecture-audio/index.ts`
**Input:** `{ slideId, voice='en-US-Neural2-D', enableSSML?, enableSegmentMapping? }`

### Per-Slide Processing (iterates all slides in deck):

#### PHASE D1: Narration Text Preparation (lines 132-162)
```
narrationText = slide.speaker_notes || ''

IF GOOGLE_CLOUD_API_KEY exists AND needsNarration(narrationText):
  → generateNarration() via ai-narrator.ts (Gemini)
  → Receives: slide type, title, content, speaker_notes, context
  IF AI narration fails:
    → generateSimpleFallback(slide) — concatenates title + main_text + key_points + definition

ELSE IF narrationText is empty or < 50 chars:
  → generateSimpleFallback(slide)

IF final narrationText is still empty:
  → SKIP this slide (push original, no audio)
```

#### PHASE D2: SSML Transformation (lines 170-198)
```
IF enableSSML AND GOOGLE_CLOUD_API_KEY AND NOT already SSML:
  → transformToSSML() via ssml-transformer.ts
  → Receives: narration text + slide context (type, index, total, has definition/example/steps)
  IF SSML output validates:
    → Use { ssml: ssmlOutput } for TTS
  ELSE:
    → Fall back to { text: narrationText }
  IF transformation fails:
    → Fall back to { text: narrationText }
```

#### PHASE D3: Google Cloud TTS API Call (lines 203-223)
```
POST https://texttospeech.googleapis.com/v1/text:synthesize
Body:
  input: { text } or { ssml }
  voice: { languageCode, name, ssmlGender }
  audioConfig: { audioEncoding: 'MP3', pitch: 0, speakingRate: 1.0 }

Gender detection (line 214):
  IF voice includes 'Neural2-D' or 'Neural2-B' or 'Neural2-J' → MALE
  ELSE → FEMALE
```

#### PHASE D4: Upload + Segment Mapping (lines 238-298)
```
→ Decode base64 audioContent to Uint8Array
→ Upload to Supabase storage: lecture-audio/{slideId}/slide_{i}.mp3

Duration estimate (line 266):
  wordCount / (150 * 0.95) * 60 seconds

IF enableSegmentMapping AND GOOGLE_CLOUD_API_KEY:
  → mapAudioSegments() via segment-mapper.ts
  → Returns: { target_block, start_percent, end_percent, narration_excerpt }[]
  → Used for sync-highlighting of content blocks during playback
  IF mapping fails → continue without segments

Slide updated with: audio_url, audio_duration_seconds, audio_segment_map
300ms delay between slides to avoid rate limiting
```

#### PHASE D5: Final Save (lines 312-344)
```
→ Update lecture_slides with:
  - slides: updatedSlides (with audio_url per slide)
  - has_audio: true (if any slide has audio)
  - audio_status: 'ready'
```

#### ERROR PATH (per-slide):
```
IF any individual slide fails TTS:
  → Log error, push original slide without audio
  → Continue processing remaining slides
  → Does NOT fail the entire batch
```

#### ERROR PATH (function-level):
```
IF entire function throws:
  → Update lecture_slides.audio_status = 'failed'
  → Return error response
```

---

## 9. PATHWAY E: Progressive Generation Trigger

**File:** `supabase/functions/trigger-progressive-generation/index.ts`
**Purpose:** Enrollment-threshold-based automatic content generation.
**Status:** Partially implemented (scaffolded, not fully wired).

### Flow:
```
Input: { instructor_course_id } OR { check_all: true }

IF check_all:
  → Query generation_triggers where is_triggered = false
  → Deduplicate by instructor_course_id

FOR each courseId:
  → RPC: check_generation_trigger(p_instructor_course_id)
    (Database function checks enrollment count against threshold, default 10)
  → Query newly triggered items (is_triggered=true, batch_job_id=null)
  → Filter by trigger_type === 'slides'
  → Log "Queuing N slide generations" (line 83)
  → Increment generation_jobs_queued counter

NOTE (line 82-87): The actual call to submit-batch-slides is commented as
"In production, this would call submit-batch-slides". Currently only logs
and counts. The wiring to actually invoke batch generation is NOT complete.
```

---

## 10. Frontend Mutation Hooks & CRUD

**File:** `src/hooks/lectureSlides/mutations.ts`

### Available mutations:

| Hook | Action | Code Call | DB Operation |
|------|--------|-----------|-------------|
| `useGenerateLectureSlides()` | Generate slides | `supabase.functions.invoke('generate-lecture-slides-v3')` | Creates/upserts `lecture_slides` |
| `usePublishLectureSlides()` | Publish to students | Direct DB update | `status → 'published'` |
| `useUnpublishLectureSlides()` | Retract from students | Direct DB update | `status → 'ready'` |
| `useUpdateLectureSlide()` | Inline edit slides | Direct DB update | Updates `slides` JSONB + `total_slides` |
| `useDeleteLectureSlides()` | Delete slide deck | Direct DB delete | Removes `lecture_slides` row |

### Progress Simulation (mutations.ts:73-94):
The frontend does NOT poll real-time progress. Instead it simulates phases on an 8-second interval:
```
15% → "Analyzing teaching context..."
35% → "Designing pedagogical sequence..."
55% → "Writing slide content..."
70% → "Generating custom diagrams..."
85% → "Processing images..."
95% → "Finalizing lecture deck..."
```

### Query Invalidation on Success:
All mutations invalidate these query keys:
- `['lecture-slides', teachingUnitId]`
- `['course-lecture-slides']`
- `['published-lecture-slides']` (publish/unpublish/delete only)

---

## 11. Publishing Workflow

```
GENERATION:     status = 'generating'
                   ↓
COMPLETION:     status = 'ready'     ← Slides visible to instructor only
                   ↓
PUBLISH:        status = 'published' ← Students can see via RLS policy
                   ↓
UNPUBLISH:      status = 'ready'     ← Reverted, students lose access

FAILURE:        status = 'failed'    ← error_message populated
```

**RLS enforcement:**
- Instructors: Full CRUD on their own course slides
- Students: SELECT only, WHERE status = 'published' AND enrolled in course

---

## 12. Conditional Branch Map

This is the complete decision tree across all pathways:

### Authentication Branches
```
[REQUEST ARRIVES]
  ├── Has Authorization header?
  │   ├── YES → Is service role key?
  │   │   ├── YES → isServiceRoleCall=true, userId=explicitUserId, SKIP rate limit
  │   │   └── NO → Validate JWT → extract userId
  │   │       ├── Valid → proceed with userId
  │   │       └── Invalid → userId=null, proceed (ownership check skipped)
  │   └── NO → userId=null, proceed
```

### Rate Limiting Branch
```
[AFTER AUTH]
  ├── userId exists AND NOT isServiceRoleCall?
  │   ├── YES → checkRateLimit()
  │   │   ├── Allowed → proceed
  │   │   └── Not allowed → RETURN 429, STOP
  │   └── NO → skip rate limiting
```

### Research Branch
```
[PHASE 2: RESEARCH]
  ├── runResearchAgent() called
  │   ├── SUCCESS → researchContext with grounded_content
  │   └── FAILURE → warn, use empty research context
  │
  ├── mergeResearchIntoBrief()
  │   ├── grounded_content.length === 0?
  │   │   ├── YES → "No external research available" notice
  │   │   └── NO → Inject citations, readings, visual descriptions
```

### Research Cache Branch (Batch mode)
```
[BATCH RESEARCH]
  ├── ENABLE_RESEARCH_CACHE !== 'false'?
  │   ├── YES → computeTopicHash() → query research_cache
  │   │   ├── CACHE HIT (not expired) → use cached, increment hit_count
  │   │   └── CACHE MISS → call Perplexity → store with 7-day TTL
  │   └── NO → always call Perplexity
```

### Batch Provider Branch
```
[BATCH PROCESSING]
  ├── BATCH_PROVIDER env var?
  │   ├── 'openrouter' (default) → sequential processing via OpenRouter
  │   │   → Each unit processed inline, results saved immediately
  │   └── 'vertex' → Vertex AI Batch Prediction
  │       → JSONL upload to GCS → batch job creation → async polling
```

### Image Provider Branch
```
[IMAGE GENERATION]
  ├── IMAGE_PROVIDER env var?
  │   ├── 'openrouter' (default) → OpenRouter API
  │   │   ├── Primary: gemini-3-pro-image-preview
  │   │   ├── IF 5xx error → try fallback: gemini-2.5-flash-image
  │   │   ├── IF still fails → return ImageResultError
  │   └── 'google' → native Google Generative Language API
  │       → Model: gemini-3-pro-image-preview
```

### Image Prompt Generation Branch
```
[PER-IMAGE PROMPT]
  ├── slideNeedsImage()?
  │   ├── NO → skip (already has URL, or is recap/title/conclusion type)
  │   └── YES → buildImagePrompt()
  │       ├── LLM call succeeds AND output >= 30 words → use LLM prompt
  │       └── LLM call fails OR output too short → buildFallbackPrompt() (static)
```

### Audio Narration Branch
```
[PER-SLIDE AUDIO]
  ├── GOOGLE_CLOUD_API_KEY exists AND needsNarration(speaker_notes)?
  │   ├── YES → generateNarration() via Gemini
  │   │   ├── SUCCESS → use AI narration
  │   │   └── FAILURE → generateSimpleFallback()
  │   └── NO → speaker_notes.length < 50?
  │       ├── YES → generateSimpleFallback()
  │       └── NO → use speaker_notes as-is
  │
  ├── narrationText empty?
  │   ├── YES → SKIP slide (no audio for this slide)
  │   └── NO → continue to SSML
  │
  ├── enableSSML AND API key AND NOT already SSML?
  │   ├── YES → transformToSSML()
  │   │   ├── Valid SSML output → use { ssml }
  │   │   └── Invalid/failed → use { text }
  │   └── NO → use { text }
  │
  ├── TTS API call
  │   ├── SUCCESS → upload MP3, build segment map
  │   └── FAILURE → push original slide without audio, continue
  │
  ├── enableSegmentMapping AND API key?
  │   ├── YES → mapAudioSegments()
  │   │   ├── SUCCESS → attach segment map
  │   │   └── FAILURE → no segment map
  │   └── NO → no segment map
```

### Vertex AI Polling Branch
```
[POLL SWEEP — every 30s via cron]
  ├── Vertex AI configured?
  │   ├── NO → return "not configured, skipping"
  │   └── YES → query active batches
  │       ├── No active batches → return early
  │       └── For each batch:
  │           ├── pollWithBackoff()
  │           │   ├── 429/quota error AND attempts < 3 → retry with backoff
  │           │   └── Success → map state
  │           ├── Vertex state → completed?
  │           │   ├── YES → processCompletedBatch() → parse results → update slides
  │           │   └── NO → Vertex state → failed?
  │           │       ├── YES → mark slides as failed
  │           │       └── NO → still processing, update counts
```

---

## 13. Shared Utilities Reference

| File | Purpose | Used By |
|------|---------|--------|
| `_shared/unified-ai-client.ts` | Routes all AI calls (text, image, search) | v3, batch, images |
| `_shared/openrouter-client.ts` | OpenRouter HTTP client + MODELS constants | unified-ai-client |
| `_shared/ai-orchestrator.ts` | MODEL_CONFIG constants + Supabase helpers | batch, polling |
| `_shared/ai-narrator.ts` | AI-enhanced narration generation | audio |
| `_shared/ssml-transformer.ts` | Convert text → SSML markup | audio |
| `_shared/segment-mapper.ts` | Map audio timestamps to content blocks | audio |
| `_shared/vertex-ai-auth.ts` | GCP service account JWT signing | batch, polling |
| `_shared/vertex-ai-batch.ts` | Vertex AI Batch Prediction API client | batch, polling |
| `_shared/gcs-client.ts` | Google Cloud Storage read/write | batch, polling |
| `_shared/rate-limiter.ts` | Per-user rate limiting | v3 |
| `_shared/cors.ts` | CORS header management | all functions |
| `_shared/error-handler.ts` | Logging + error response builders | all functions |
| `_shared/validators/index.ts` | Zod-based request validation | audio |
| `src/lib/citationParser.ts` | Parse [Source N] markers in rendered slides | frontend |

---

## 14. Quality Metrics System

**Source:** `generate-lecture-slides-v3/index.ts:213-305`

| Metric | Target | Points |
|--------|--------|--------|
| Avg main_text words | 50+ | +5 |
| Avg speaker_notes words | 200+ | +10 |
| Avg key_points per slide | 3+ | +5 |
| Has misconception slide | any | +5 |
| Has definition slide | any | +5 |
| Citation count | 3+ | +5 |
| Quality warnings | each | -2 |

**Warnings generated for:**
- main_text < 30 words
- speaker_notes < 150 words
- visual description < 50 words (for non-'none' visuals)
- Contains "N/A" or "Not applicable" placeholders

**Base score:** 70. **Range:** 0-100. **Max theoretical:** 105 (clamped to 100).

**IMPORTANT: Quality score is LOGGED but NEVER gates saving or publishing.** A score of 0 will still save successfully.

---

## 15. Storage Buckets

| Bucket | Content | Path Pattern | Access |
|--------|---------|-------------|--------|
| `lecture-audio` | MP3 audio files | `{slideId}/slide_{index}.mp3` | RLS: course enrollment |
| `lecture-visuals` | Generated images | `{lecture_slides_id}/slide_{index}.webp` | RLS: teaching unit enrollment |

---

## 16. Security & Access Control

### Row-Level Security (RLS)
- **Instructor access:** Full CRUD on `lecture_slides` WHERE `instructor_course_id` matches courses they own
- **Student access:** SELECT only WHERE `status = 'published'` AND enrolled via `student_enrollments`
- **Service role:** Bypasses RLS (used by queue processors and batch functions)

### Ownership Validation
- `fetchTeachingUnitContext()` (line 384-391): IF userId provided AND course.instructor_id !== userId → throws "Not authorized"
- Skipped for service role calls (isServiceRoleCall=true) and null userId

### Rate Limiting
- Per-user, per-function limits via `checkRateLimit()` in `_shared/rate-limiter.ts`
- Skipped for service role calls
- Returns 429 with retry information when exceeded

---

## Summary of All Edge Functions

| # | Function | Purpose | Trigger | Timeout Risk |
|---|----------|---------|---------|-------------|
| 1 | `generate-lecture-slides-v3` | Single slide deck generation | User click | Medium (research + AI) |
| 2 | `submit-batch-slides` | Create batch placeholders | User "Generate All" | Low (DB only) |
| 3 | `process-batch-research` | Research + batch generation | Called after #2 | High (mitigated by provider toggle) |
| 4 | `process-batch-images` | Queue-based image generation | Fire-and-forget from #1/#3 | Low (self-continues) |
| 5 | `generate-lecture-audio` | TTS narration for all slides | User click | Medium (N slides x TTS) |
| 6 | `poll-active-batches` | Poll Vertex AI batch status | pg_cron (30s) | Low (API poll only) |
| 7 | `trigger-progressive-generation` | Enrollment threshold check | Cron/enrollment event | Low (DB only, partially implemented) |
