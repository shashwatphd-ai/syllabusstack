# Slide Generation System — Consolidation & Production Plan

> **Date:** 2026-02-08
> **Basis:** Code-only audit of `main` branch (see `SLIDE_GENERATION_SYSTEM_REPORT.md`)
> **Scope:** Architecture consolidation, pathway reduction, production hardening
> **Constraint:** OpenRouter primary, Vertex AI for batch only where it delivers real savings

---

## Executive Summary

The current system has **7 edge functions, 5 pathways, and ~1,000+ lines of duplicated code** across three implementations of the same slide generation logic. After tracing every line, the actual cost savings from Vertex AI batch mode are **$0.13 per 78-unit batch** (~0.5%), not the 50% suggested by documentation — because the discount only applies to Professor AI inference, which is 1.4% of total cost. Images (53%) and audio (40%) dominate costs and get no batch discount.

**This plan consolidates to 3 streamlined pathways and 5 edge functions**, eliminates all code duplication, fixes the image generation bottleneck (currently 2.4 hours for a full course), and produces a production-ready architecture.

---

## Table of Contents

1. [Current State: What's Actually Wrong](#1-current-state-whats-actually-wrong)
2. [Target Architecture: 3 Pathways, 5 Functions](#2-target-architecture-3-pathways-5-functions)
3. [Shared Module Extraction Plan](#3-shared-module-extraction-plan)
4. [Consolidated Pathway A: Single Slide Generation](#4-consolidated-pathway-a-single-slide-generation)
5. [Consolidated Pathway B: Batch Slide Generation](#5-consolidated-pathway-b-batch-slide-generation)
6. [Consolidated Pathway C: Media Generation (Images + Audio)](#6-consolidated-pathway-c-media-generation)
7. [What Gets Deleted](#7-what-gets-deleted)
8. [Cost Reality & Provider Strategy](#8-cost-reality--provider-strategy)
9. [Performance Targets](#9-performance-targets)
10. [Migration Sequence](#10-migration-sequence)
11. [Risk Analysis](#11-risk-analysis)
12. [Production Checklist](#12-production-checklist)

---

## 1. Current State: What's Actually Wrong

### 1.1 Code Duplication (verified, line-by-line)

| Duplicated Asset | Copies | Locations | Lines Wasted |
|-----------------|--------|-----------|-------------|
| `PROFESSOR_SYSTEM_PROMPT` | 3 | v3 (179 lines), submit-batch (130 lines), batch-research (105 lines) | ~235 lines |
| `buildLectureBrief()` | 3 | v3, submit-batch, batch-research | ~180 lines |
| `mergeResearchIntoBrief()` | 3 | Same three files | ~135 lines |
| `runResearchAgent()` | 2 | v3 (no cache), batch-research (with cache) | ~89 lines |
| `fetchTeachingUnitContext()` | 2 | v3 (defensive), batch (inline, fragile) | ~170 lines |
| Image prompt (hardcoded) | 1 (dead) | v3 lines 1379-1401 — overwritten by LLM prompt in process-batch-images | 23 lines |
| **Total duplicated** | | | **~832 lines** |

### 1.2 Prompt Drift (verified)

The three copies of `PROFESSOR_SYSTEM_PROMPT` have already drifted:
- **v3** (179 lines): Has banned rhetorical patterns, quality reference examples, RAG rules, layout hints, optional field handling
- **submit-batch** (130 lines): Missing banned patterns, missing quality examples, different JSON output instruction
- **batch-research** (105 lines): Most stripped — missing visual directive quality requirements, different instruction style entirely

This means **batch-generated slides are lower quality than single-generated slides** due to a shorter, less precise prompt. This is a silent quality regression.

### 1.3 Useless Vertex AI Discount

**Cost breakdown per teaching unit ($0.30 total):**

| Component | Cost | % of Total | Vertex Discount? |
|-----------|------|-----------|-----------------|
| Images (4x) | $0.16 | **53%** | No |
| Audio/TTS | $0.12 | **40%** | No |
| Research (Perplexity) | $0.02 | 6% | No |
| Professor AI (Gemini) | $0.004 | **1.4%** | Yes (50% off) |

**Vertex AI batch saves $0.002 per unit.** For 78 units: **$0.13 total savings.** The entire Vertex AI integration (batch client, GCS client, auth, polling, JSONL formatting) exists to save thirteen cents per course.

### 1.4 Image Generation Bottleneck

Current settings: `BATCH_SIZE=1`, `MAX_CONCURRENT=1`, `BATCH_DELAY_MS=2000`

For a 78-unit course (~312 images): **2.3-2.4 hours** of sequential single-image processing across 312 separate edge function invocations.

### 1.5 Orphaned/Legacy Code

| Function | Status | Action |
|----------|--------|--------|
| `process-lecture-queue` | Explicitly marked `DEPRECATED` in code | Delete |
| `poll-batch-curriculum` | Superseded by `poll-active-batches` | Delete |
| `trigger-progressive-generation` | Partially implemented — logs but never calls `submit-batch-slides` | Fix or delete |
| Hardcoded image prompt in v3 (lines 1379-1401) | Overwritten by LLM prompt in `process-batch-images` | Delete |

---

## 2. Target Architecture: 3 Pathways, 5 Functions

### Current: 7 functions, 5 pathways
```
generate-lecture-slides-v3     ← Pathway A (single)
submit-batch-slides            ← Pathway B step 1
process-batch-research         ← Pathway B step 2
poll-active-batches            ← Pathway B step 3 (Vertex only)
process-batch-images           ← Pathway C (images)
generate-lecture-audio         ← Pathway D (audio)
trigger-progressive-generation ← Pathway E (enrollment, half-built)
process-lecture-queue           ← DEPRECATED
poll-batch-curriculum           ← SUPERSEDED
```

### Target: 5 functions, 3 pathways

```
generate-lecture-slides        ← Pathway A: Single unit (renamed, uses shared modules)
generate-batch-slides          ← Pathway B: Batch (merges submit + process-batch-research)
generate-slide-media           ← Pathway C: Images + Audio (merges process-batch-images + generate-lecture-audio)
poll-active-batches            ← Pathway B support: Vertex polling (kept, only if Vertex retained)
trigger-progressive-generation ← Pathway B support: Enrollment trigger (fixed to actually call batch)
```

### Visual Architecture

```
INSTRUCTOR CLICKS                     ENROLLMENT THRESHOLD
"Generate Slides"                     (auto-trigger)
       │                                     │
       ▼                                     ▼
┌─────────────────┐              ┌──────────────────────────┐
│  PATHWAY A:     │              │  PATHWAY B:              │
│  Single Unit    │              │  Batch (N units)         │
│                 │              │                          │
│  generate-      │              │  generate-batch-slides   │
│  lecture-slides │              │  (merged function)       │
│                 │              │                          │
│  1. Context     │              │  1. Create placeholders  │
│  2. Research    │              │  2. Research (cached)    │
│  3. Professor AI│              │  3. Professor AI (loop)  │
│  4. Save        │              │  4. Save per unit        │
│  5. Queue media │              │  5. Queue media          │
└────────┬────────┘              └────────────┬─────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────────────────────────────────────────┐
│  PATHWAY C: Media Generation                             │
│  generate-slide-media                                    │
│                                                          │
│  Mode A: Images                                          │
│    1. Fetch queue items                                  │
│    2. LLM prompt generation (Gemini Flash Lite)          │
│    3. Image generation (gemini-3-pro-image-preview)      │
│    4. Upload to storage                                  │
│    5. Self-continue if more pending                      │
│                                                          │
│  Mode B: Audio                                           │
│    1. AI narration (optional)                            │
│    2. SSML transformation (optional)                     │
│    3. Google TTS                                         │
│    4. Segment mapping (optional)                         │
│    5. Upload to storage                                  │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Shared Module Extraction Plan

These new shared modules eliminate all duplication. Every edge function imports from shared instead of maintaining its own copy.

### 3.1 `_shared/slide-prompts.ts` (NEW)

**Absorbs from:** v3, submit-batch, batch-research

```
Exports:
  PROFESSOR_SYSTEM_PROMPT          ← Single canonical copy (v3's 179-line version)
  IMAGE_PROMPT_WRITER_SYSTEM       ← Moved from process-batch-images
  buildLectureBrief(context)       ← Single copy
  mergeResearchIntoBrief(brief, research) ← Single copy
  buildUserPrompt(context, research, targetSlides) ← Single copy
  parseJsonFromAI(content)         ← Already in v3, formalize
```

### 3.2 `_shared/context-fetcher.ts` (NEW)

**Absorbs from:** v3's `fetchTeachingUnitContext()`

```
Exports:
  fetchTeachingUnitContext(supabase, teachingUnitId, userId?)
    → Returns TeachingUnitContext (fully typed)
    → Defensive: checks every join, handles missing module/siblings gracefully
    → Ownership: validates instructor_id when userId provided

  fetchBatchContext(supabase, teachingUnitIds[])
    → Returns TeachingUnitContext[] (batch-optimized, fewer queries)
    → Uses IN clause instead of N sequential queries
```

### 3.3 `_shared/research-agent.ts` (NEW)

**Absorbs from:** v3's `runResearchAgent()` + batch-research's `runResearchAgent()` + caching logic

```
Exports:
  runResearchAgent(context, domainConfig, options?)
    options.supabase? → enables cache (7-day TTL)
    options.forceRefresh? → bypasses cache
    → Calls searchGrounded() via unified-ai-client
    → Returns ResearchContext

  buildResearchQuery(context, domainConfig)
    → Single canonical query builder

  getCachedResearch(supabase, searchTerms, domain)
  cacheResearch(supabase, searchTerms, domain, research)
```

### 3.4 `_shared/image-prompt-builder.ts` (NEW)

**Absorbs from:** process-batch-images's `buildImagePrompt()`, `serializeSlideContext()`, `buildFallbackPrompt()`

```
Exports:
  buildImagePrompt(slide, lectureTitle, domain?)
    → LLM-based prompt via Gemini Flash Lite
    → Fallback to static prompt on failure

  slideNeedsImage(slide)
    → Boolean check

  IMAGE_PROMPT_WRITER_SYSTEM
    → System prompt constant (or import from slide-prompts.ts)
```

### 3.5 `_shared/quality-metrics.ts` (NEW)

**Absorbs from:** v3's `calculateQualityMetrics()`

```
Exports:
  calculateQualityMetrics(slides)
    → { score, metrics, warnings }
    → Logging only, never gates
```

### Module dependency tree:
```
Edge Functions
  ├── generate-lecture-slides
  │     ├── _shared/context-fetcher.ts
  │     ├── _shared/research-agent.ts
  │     ├── _shared/slide-prompts.ts
  │     ├── _shared/quality-metrics.ts
  │     └── _shared/unified-ai-client.ts
  │
  ├── generate-batch-slides
  │     ├── _shared/context-fetcher.ts   (fetchBatchContext)
  │     ├── _shared/research-agent.ts    (with caching)
  │     ├── _shared/slide-prompts.ts
  │     ├── _shared/quality-metrics.ts
  │     └── _shared/unified-ai-client.ts
  │
  └── generate-slide-media
        ├── _shared/image-prompt-builder.ts
        ├── _shared/unified-ai-client.ts  (generateImage)
        ├── _shared/ai-narrator.ts        (existing)
        ├── _shared/ssml-transformer.ts   (existing)
        └── _shared/segment-mapper.ts     (existing)
```

---

## 4. Consolidated Pathway A: Single Slide Generation

**Function:** `generate-lecture-slides` (renamed from v3)
**Trigger:** Instructor clicks "Generate Slides" on a teaching unit
**Estimated time:** 25-45 seconds

### Sequential Flow:

```
STEP 1: VALIDATE & AUTH (1-2s)
  ├── Parse { teaching_unit_id, style, regenerate }
  ├── IF service role token → skip rate limit, use explicit user_id
  ├── ELSE → validate JWT, extract userId
  └── IF userId && !serviceRole → checkRateLimit()
        └── IF rate limited → RETURN 429. STOP.

STEP 2: CONTEXT (2-4s)
  └── fetchTeachingUnitContext(supabase, teaching_unit_id, userId)
        ├── teaching_units → IF not found → STOP
        ├── learning_objectives → IF not found → STOP
        ├── instructor_courses → IF not found → STOP
        │     └── IF userId mismatch → STOP (403)
        ├── modules → IF not found → defaults (non-blocking)
        └── sibling teaching_units → IF fails → empty array (non-blocking)

STEP 3: UPSERT RECORD (1s)
  └── lecture_slides UPSERT (onConflict: teaching_unit_id)
        status='generating', slides=[] if regenerate

STEP 4: RESEARCH (8-15s)
  └── runResearchAgent(context, domainConfig, { supabase })  ← NOW WITH CACHE
        ├── Check cache → IF HIT → use cached (saves 8-15s)
        ├── IF MISS → searchGrounded() via Perplexity
        ├── Cache result (7-day TTL)
        └── IF research fails entirely → empty context (non-blocking)

STEP 5: PROFESSOR AI (15-25s)
  ├── buildLectureBrief(context)              ← from _shared/slide-prompts.ts
  ├── mergeResearchIntoBrief(brief, research) ← from _shared/slide-prompts.ts
  └── generateText({
        model: MODELS.PROFESSOR_AI,           // google/gemini-3-flash-preview
        fallbacks: [MODELS.PROFESSOR_AI_FALLBACK],  // google/gemini-2.5-flash
        temperature: 0.4,
        maxTokens: 16000,
      })
      ├── parseJsonFromAI(response)
      └── IF parse fails → status='failed'. STOP.

STEP 6: SAVE (2s)
  ├── Transform ProfessorSlide[] → storage format
  ├── calculateQualityMetrics() → log only
  ├── UPDATE lecture_slides: status='ready', slides=[...], quality_score=N
  └── Mark research grounding metadata

STEP 7: QUEUE MEDIA (1s, fire-and-forget)
  ├── Filter slides where visual.type !== 'none'
  ├── UPSERT into image_generation_queue
  └── fetch('generate-slide-media', { mode: 'images', continue: true })
      └── IF fetch fails → warn only (images are optional)

RETURN { success, slideId, slideCount, qualityScore, imagesQueued }
```

**Changes from current v3:**
1. Research agent NOW uses cache (saves $0.02 and 8-15s on repeat generations)
2. All prompt/context logic imported from `_shared/` — zero duplication
3. Image queue triggers `generate-slide-media` (merged function) not `process-batch-images`
4. Hardcoded image prompt at lines 1379-1401 DELETED — queue stores minimal context, LLM prompt built at generation time in `generate-slide-media`

---

## 5. Consolidated Pathway B: Batch Slide Generation

**Function:** `generate-batch-slides` (merges `submit-batch-slides` + `process-batch-research`)
**Trigger:** Instructor clicks "Generate All Slides"
**Architecture:** Two-phase within single function, with self-continuation for timeout safety

### Why merge submit + process?

Currently `submit-batch-slides` creates placeholders (2 seconds) then the frontend must call `process-batch-research` separately. The submit function contains 130 lines of `PROFESSOR_SYSTEM_PROMPT` it never uses. Merging eliminates this dead code and reduces one round-trip.

### Sequential Flow:

```
PHASE 1: FAST SETUP (2-3s) — Returns immediately to frontend
  ├── Parse { instructor_course_id, teaching_unit_ids[], mode? }
  ├── Validate: course exists, user owns it
  ├── Check for active batch (prevent duplicate runs)
  ├── Filter: skip teaching_unit_ids that already have status='ready'|'published'
  ├── CREATE batch_jobs record: status='preparing'
  ├── CREATE lecture_slides placeholders: status='preparing'
  └── RETURN { batchJobId, total, skipped }
      └── Frontend starts polling batch status

PHASE 2: SELF-INVOKED PROCESSING — Async, chunked
  ├── Invoked by: frontend calls same function with { batch_job_id, _continue: true }
  │   OR: Phase 1 triggers Phase 2 via fire-and-forget fetch
  │
  ├── CHUNK_SIZE = 8 (process 8 units per invocation to stay under 150s)
  │
  ├── FOR each unit in chunk:
  │   ├── fetchTeachingUnitContext(supabase, unitId)  ← from _shared/context-fetcher.ts
  │   ├── runResearchAgent(context, domainConfig, { supabase })  ← WITH CACHE
  │   │     └── Cache hits skip Perplexity call (saves ~10s + $0.02 per hit)
  │   ├── buildLectureBrief() + mergeResearchIntoBrief()  ← from _shared/slide-prompts.ts
  │   ├── generateText(PROFESSOR_SYSTEM_PROMPT, brief)
  │   │     └── Same model, same prompt as Pathway A — quality parity guaranteed
  │   ├── parseJsonFromAI() → 6 slides
  │   ├── calculateQualityMetrics() → log
  │   ├── UPDATE lecture_slides: status='ready', slides=[...]
  │   ├── UPSERT image_generation_queue items
  │   └── 500ms inter-unit delay
  │
  ├── UPDATE batch_jobs: succeeded_count++, progress
  │
  ├── IF more units pending:
  │   └── Self-invoke: fetch('generate-batch-slides', { batch_job_id, _continue: true })
  │
  └── IF all complete:
      ├── UPDATE batch_jobs: status='completed'
      └── fetch('generate-slide-media', { batch_job_id, mode: 'images', continue: true })
```

### Vertex AI Decision

**Recommendation: Drop Vertex AI batch for slides. Keep only for future use cases where it delivers meaningful savings.**

Rationale:
- Saves $0.13 per 78-unit course (0.5% of total)
- Adds massive complexity: GCS client, Vertex auth, JSONL formatting, polling loop, result parsing
- Vertex polling (poll-active-batches) runs every 30s via cron even when no batches exist
- OpenRouter sequential is simpler, debuggable, and the frontend gets real-time per-unit progress

**If Vertex is retained** (e.g., for future high-volume enterprise), keep `poll-active-batches` and make it dormant when `BATCH_PROVIDER !== 'vertex'`. But do not invest in making it the primary path.

---

## 6. Consolidated Pathway C: Media Generation

**Function:** `generate-slide-media` (merges `process-batch-images` + `generate-lecture-audio`)
**Trigger:** Fire-and-forget from Pathway A or B completion, OR explicit instructor "Generate Audio" click
**Architecture:** Mode-based, queue-driven, self-continuing

### Why merge images + audio?

Both are:
- Async, post-generation processes
- Queue-based with self-continuation
- Per-slide processing loops
- Upload-to-storage workflows
- Optional (slides are usable without either)

A single function with a `mode` parameter eliminates an entire edge function and unifies the storage/upload logic.

### Flow:

```
INPUT: { mode: 'images' | 'audio', continue?: true, lecture_slides_id?, batch_job_id? }

IF mode === 'images':
  ┌─────────────────────────────────────────────────┐
  │  IMAGE GENERATION MODE                          │
  │                                                 │
  │  CONFIG:                                        │
  │    BATCH_SIZE = 3       ← UP FROM 1 (3x faster) │
  │    MAX_CONCURRENT = 2   ← UP FROM 1             │
  │    BATCH_DELAY_MS = 1000 ← DOWN FROM 2000       │
  │                                                 │
  │  PER IMAGE:                                     │
  │  1. Fetch pending from image_generation_queue   │
  │  2. For each item:                              │
  │     a. buildImagePrompt(slide, title, domain)   │
  │        ← from _shared/image-prompt-builder.ts   │
  │        ← Uses LLM (Gemini Flash Lite, $0.00005) │
  │        ← Falls back to static prompt on failure │
  │     b. generateImage({ prompt, aspectRatio })   │
  │        ← Routes based on IMAGE_PROVIDER env     │
  │        ← OpenRouter (default) or Google native  │
  │     c. Upload to Supabase storage               │
  │        lecture-visuals/{id}/slide_{i}.webp       │
  │     d. Update queue status + lecture_slides JSON │
  │  3. IF more pending → self-invoke               │
  └─────────────────────────────────────────────────┘

IF mode === 'audio':
  ┌─────────────────────────────────────────────────┐
  │  AUDIO GENERATION MODE                          │
  │                                                 │
  │  INPUT: { lecture_slides_id, voice, enableSSML,  │
  │           enableSegmentMapping }                │
  │                                                 │
  │  1. Fetch lecture_slides record                 │
  │  2. Update audio_status = 'generating'          │
  │  3. FOR each slide:                             │
  │     a. Narration:                               │
  │        IF needsNarration(speaker_notes):        │
  │          → generateNarration() via Gemini       │
  │          → IF fails → generateSimpleFallback()  │
  │        ELSE IF speaker_notes < 50 chars:        │
  │          → generateSimpleFallback()             │
  │        IF empty → SKIP slide                    │
  │                                                 │
  │     b. SSML (optional):                         │
  │        IF enableSSML:                           │
  │          → transformToSSML()                    │
  │          → IF invalid → fallback to plain text  │
  │                                                 │
  │     c. TTS:                                     │
  │        → Google Cloud TTS Neural2               │
  │        → Upload MP3 to lecture-audio bucket     │
  │                                                 │
  │     d. Segment mapping (optional):              │
  │        IF enableSegmentMapping:                 │
  │          → mapAudioSegments()                   │
  │          → IF fails → no mapping (non-blocking) │
  │                                                 │
  │     300ms inter-slide delay                     │
  │                                                 │
  │  4. UPDATE lecture_slides:                      │
  │     slides (with audio_url per slide),          │
  │     has_audio=true, audio_status='ready'        │
  └─────────────────────────────────────────────────┘
```

### Image Performance Fix

The single most impactful change in this entire plan:

| Setting | Current | Target | Impact |
|---------|---------|--------|--------|
| `BATCH_SIZE` | 1 | 3 | 3x fewer invocations |
| `MAX_CONCURRENT` | 1 | 2 | 2x parallelism within batch |
| `BATCH_DELAY_MS` | 2000 | 1000 | 50% less idle time |

**Result for 312 images (78-unit course):**
- Current: 312 invocations x 27s = **2.3 hours**
- Target: 104 invocations x 20s = **~35 minutes** (4x improvement)

---

## 7. What Gets Deleted

| Item | Lines | Reason |
|------|-------|--------|
| `process-lecture-queue/` (entire function) | ~539 | Explicitly `DEPRECATED` in code |
| `poll-batch-curriculum/` (entire function) | ~200 | Superseded by `poll-active-batches` |
| `submit-batch-slides/` (entire function) | ~1002 | Merged into `generate-batch-slides` |
| `process-batch-research/` (entire function) | ~1200 | Merged into `generate-batch-slides` |
| `process-batch-images/` (entire function) | ~950 | Merged into `generate-slide-media` |
| `generate-lecture-audio/` (entire function) | ~380 | Merged into `generate-slide-media` |
| PROFESSOR_SYSTEM_PROMPT in submit-batch (130 lines, never used) | 130 | Dead code |
| PROFESSOR_SYSTEM_PROMPT in batch-research (105 lines, drifted) | 105 | Replaced by shared |
| Hardcoded image prompt in v3 (lines 1379-1401) | 23 | Overwritten by LLM prompt |
| Inline context fetching in batch-research | ~170 | Replaced by shared |
| Inline research agent in v3 | ~27 | Replaced by shared |
| **Total deleted** | **~4,726 lines** | |

**Net new shared code:** ~600 lines (extracted, not duplicated)

**Net reduction: ~4,100 lines** (excluding shared modules)

---

## 8. Cost Reality & Provider Strategy

### Per-Unit Cost Breakdown (Unchanged by Consolidation)

| Component | Provider | Model | Cost | % |
|-----------|----------|-------|------|---|
| Images (4x) | OpenRouter/Google/EvoLink | gemini-3-pro-image-preview | $0.160 | 53% |
| Audio (6 slides) | Google Cloud | Neural2 TTS | $0.120 | 40% |
| Research | OpenRouter | Perplexity Sonar-Pro | $0.020 | 6% |
| Professor AI | OpenRouter | Gemini 3 Flash | $0.004 | 1.4% |
| Image prompt LLM (4x) | OpenRouter | Gemini Flash Lite | $0.0002 | 0.07% |
| **Total** | | | **$0.304** | 100% |

### Provider Strategy

```
OPENROUTER (primary, all operations):
  ├── Professor AI:    google/gemini-3-flash-preview
  ├── Research:        perplexity/sonar-pro
  ├── Image Gen:       gemini-3-pro-image-preview (via EvoLink/Google/OpenRouter)
  ├── Image Prompts:   google/gemini-2.5-flash-lite
  ├── AI Narration:    google/gemini-2.5-flash
  └── SSML Transform:  google/gemini-2.5-flash

GOOGLE DIRECT (only where OpenRouter has no equivalent):
  ├── Text-to-Speech:  Google Cloud TTS Neural2 ($16/1M chars)
  └── Segment Mapping: Google Cloud Gemini (audio sync)

VERTEX AI BATCH (dormant, available via env toggle):
  └── Only activated if BATCH_PROVIDER=vertex
      └── Saves $0.002/unit (negligible)
      └── Retain infra but don't invest in improving it
```

### Where Real Cost Savings Come From

1. **Research caching** (adding to Pathway A): Save $0.02 per cache hit on repeat/regenerate. For a course regenerated 5 times during development: saves ~$7.80 per course.

2. **Skipping unnecessary images**: `slideNeedsImage()` already filters title/recap/conclusion slides. No change needed.

3. **Audio is optional**: Most instructors won't generate audio for all 78 units. Cost only incurred on demand.

4. **Rate limiting is already enforced**: Free tier capped at $10/day, Pro at $5/day.

---

## 9. Performance Targets

### Single Unit (Pathway A)

| Phase | Current | Target | How |
|-------|---------|--------|-----|
| Context fetch | 3-5s | 2-3s | Batch DB queries with single JOIN |
| Research | 8-15s | 0-15s | Cache hits = 0s, misses = same |
| Professor AI | 15-25s | 15-25s | No change (model-bound) |
| Save + queue | 3-4s | 2-3s | No change |
| **Total** | **35-60s** | **20-45s** | Cache + parallel DB |

### Batch (Pathway B, 78 units)

| Phase | Current | Target | How |
|-------|---------|--------|-----|
| Placeholder creation | 2s | 2s | Same |
| Research (78 units) | 10-20 min | 5-15 min | Cache hits save 8-15s each |
| Professor AI (78 units) | 20-25 min | 18-22 min | Marginal (model-bound) |
| **Total slides** | **30-45 min** | **23-37 min** | Cache + shared modules |

### Image Generation (312 images)

| Setting | Current | Target | Impact |
|---------|---------|--------|--------|
| Total time | **2.3 hours** | **~35 min** | BATCH_SIZE 1→3, CONCURRENT 1→2 |
| Invocations | 312 | ~104 | 3x fewer cold starts |
| Per-image | 20-25s | 15-20s | Less delay overhead |

### Audio (78 units, 468 slides)

| Metric | Current | Target | How |
|--------|---------|--------|-----|
| Per-slide | 18s | 12-15s | Parallel narration + SSML |
| Total | 2.0-2.5 hours | 1.3-1.5 hours | Promise.all for independent phases |

### End-to-End (Full Course, 78 Units)

| Phase | Current | Target |
|-------|---------|--------|
| Slides | 30-45 min | 23-37 min |
| Images | 2.3 hours | 35 min |
| Audio | 2.0-2.5 hours | 1.3-1.5 hours |
| **TOTAL** | **5.5-6.5 hours** | **2.3-2.8 hours** |

---

## 10. Migration Sequence

Ordered by risk (lowest first) and dependency chain.

### Phase 1: Extract Shared Modules (Zero Risk)

No behavior change. Just moving code to `_shared/` and importing from there.

```
Step 1.1: Create _shared/slide-prompts.ts
  → Copy v3's PROFESSOR_SYSTEM_PROMPT (the complete 179-line version)
  → Move buildLectureBrief(), mergeResearchIntoBrief(), parseJsonFromAI()
  → Update v3 to import from shared (delete inline copies)
  → Test: v3 produces identical output

Step 1.2: Create _shared/context-fetcher.ts
  → Move fetchTeachingUnitContext() from v3
  → Add fetchBatchContext() for batch-optimized queries
  → Update v3 to import from shared
  → Test: v3 context fetching unchanged

Step 1.3: Create _shared/research-agent.ts
  → Merge v3's runResearchAgent() with batch-research's caching version
  → Single function with optional { supabase } for cache
  → Update v3 to import and pass supabase (enables caching)
  → Test: v3 with cache disabled = same behavior

Step 1.4: Create _shared/quality-metrics.ts
  → Move calculateQualityMetrics() from v3
  → Test: scores identical

Step 1.5: Create _shared/image-prompt-builder.ts
  → Move buildImagePrompt(), serializeSlideContext(), slideNeedsImage() from process-batch-images
  → Test: image prompts identical
```

**Validation gate:** Deploy shared modules. v3 and existing functions still work identically. All tests pass. Zero user-visible change.

### Phase 2: Fix Image Performance (Low Risk, High Impact)

```
Step 2.1: Update process-batch-images configuration
  → BATCH_SIZE: 1 → 3
  → MAX_CONCURRENT: 1 → 2
  → BATCH_DELAY_MS: 2000 → 1000

Step 2.2: Test with a real course
  → Verify images generate correctly in batches of 3
  → Monitor for rate limiting (adjust if needed)
  → Measure wall-clock improvement
```

**Validation gate:** 312-image course completes in under 1 hour instead of 2.3 hours.

### Phase 3: Delete Legacy Code (Low Risk)

```
Step 3.1: Delete process-lecture-queue/ (confirmed DEPRECATED)
Step 3.2: Delete poll-batch-curriculum/ (confirmed superseded)
Step 3.3: Remove hardcoded image prompt from v3 (lines 1379-1401)
  → Queue items now store only slide metadata, not full prompts
  → LLM prompt built at generation time in process-batch-images
Step 3.4: Remove dead PROFESSOR_SYSTEM_PROMPT from submit-batch-slides (130 lines, never referenced)
```

**Validation gate:** No broken imports. No frontend errors. No calls to deleted functions.

### Phase 4: Merge Batch Functions (Medium Risk)

```
Step 4.1: Create generate-batch-slides
  → Phase 1 logic from submit-batch-slides (placeholder creation)
  → Phase 2 logic from process-batch-research (research + generation)
  → Imports all from _shared/ modules
  → Uses PROFESSOR_SYSTEM_PROMPT from _shared/slide-prompts.ts (quality parity with v3)
  → Self-continuation with CHUNK_SIZE=8

Step 4.2: Update frontend hooks
  → useBatchSlides() calls generate-batch-slides instead of submit + process
  → Polling logic remains same (queries batch_jobs table)

Step 4.3: Delete submit-batch-slides/ and process-batch-research/
Step 4.4: Fix trigger-progressive-generation to call generate-batch-slides
```

**Validation gate:** Batch generation produces identical quality slides. Frontend polling works. No regressions.

### Phase 5: Merge Media Functions (Medium Risk)

```
Step 5.1: Create generate-slide-media with mode parameter
  → mode='images': logic from process-batch-images (with BATCH_SIZE=3)
  → mode='audio': logic from generate-lecture-audio
  → Shared storage upload logic

Step 5.2: Update all callers
  → v3 fire-and-forget: fetch('generate-slide-media', { mode: 'images' })
  → generate-batch-slides: same
  → Frontend audio hook: supabase.functions.invoke('generate-slide-media', { mode: 'audio', ... })

Step 5.3: Delete process-batch-images/ and generate-lecture-audio/
```

**Validation gate:** Images generate with 3x throughput. Audio generation identical. Storage paths unchanged.

### Phase 6: Production Hardening (Post-Merge)

```
Step 6.1: Add research caching to Pathway A (v3 equivalent)
  → Pass supabase to runResearchAgent() in single-unit path
  → 7-day TTL, SHA-256 topic hash

Step 6.2: Add parallel narration+SSML in audio mode
  → generateNarration() and transformToSSML() can run concurrently
  → Promise.all([narration, ssml]) before TTS call

Step 6.3: Add batch context fetching
  → fetchBatchContext() uses single IN query instead of N sequential
  → Saves 2-3s per unit in batch mode

Step 6.4: Monitor and tune
  → BATCH_SIZE for images: start at 3, increase to 5 if stable
  → MAX_CONCURRENT: start at 2, increase to 3 if rate limits allow
  → Research cache hit rate: log and track
```

---

## 11. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Shared module import path breaks in Deno | Medium | Test imports before merging any function |
| Image BATCH_SIZE=3 triggers rate limiting | Medium | Start with 3, monitor, fall back to 2 if 429s spike |
| Prompt change causes quality regression | High | Use EXACT same prompt (v3's 179-line version) everywhere — diff before deploying |
| Frontend calls deleted function name | High | Update frontend hooks BEFORE deleting backend functions. Keep old function as redirect for 1 release |
| Vertex AI batch breaks after batch-research merge | Low | Vertex path is env-toggled off by default. Only affects BATCH_PROVIDER=vertex users |
| Audio mode in merged function has different error handling | Medium | Port exact error handling from generate-lecture-audio. Per-slide failures must not kill batch |
| Self-continuation chains break on cold function | Low | Already battle-tested in process-batch-images. Same pattern reused |

### Rollback Strategy

Each phase is independently deployable and reversible:
- Phase 1 (shared modules): Old inline code still works if imports fail
- Phase 2 (image perf): Revert 3 constants to original values
- Phase 3 (delete legacy): No rollback needed (already deprecated/unused)
- Phase 4 (merge batch): Keep old functions for 1 release, redirect
- Phase 5 (merge media): Same redirect strategy

---

## 12. Production Checklist

### Before Each Phase

- [ ] All shared module unit tests pass
- [ ] Edge function deploys successfully to staging
- [ ] Single slide generation produces identical output (diff JSON)
- [ ] Batch generation completes without errors for test course
- [ ] Image generation queue processes fully
- [ ] Audio generation produces playable MP3s
- [ ] Frontend hooks updated and tested
- [ ] Rate limiting still enforced
- [ ] RLS policies still work (student can only see published)
- [ ] Quality scores comparable to pre-change baseline

### Post-Consolidation Metrics

- [ ] Total edge functions: 7 → 5 (or 4 if Vertex polling removed)
- [ ] Total duplicated lines: ~832 → 0
- [ ] Image generation for 78-unit course: < 1 hour (from 2.3 hours)
- [ ] End-to-end course generation: < 3 hours (from 6.5 hours)
- [ ] Research cache hit rate: tracked and logged
- [ ] Zero prompt drift between single and batch paths
- [ ] `PROFESSOR_SYSTEM_PROMPT` exists in exactly 1 file

---

## Summary: Before and After

| Dimension | Current | Target |
|-----------|---------|--------|
| Edge functions (slide-related) | 9 (7 active + 2 deprecated) | 5 |
| Pathways | 5 (including 1 half-built) | 3 |
| PROFESSOR_SYSTEM_PROMPT copies | 3 (drifted) | 1 |
| Code duplication | ~832 lines | 0 |
| Deprecated/dead code | ~1,700 lines | 0 |
| Image generation (78-unit course) | 2.3 hours | ~35 min |
| End-to-end (78-unit course) | 5.5-6.5 hours | 2.3-2.8 hours |
| Vertex AI savings | $0.13/course (0.5%) | Dormant (toggle available) |
| Research caching in single path | No | Yes |
| Prompt parity (single vs batch) | No (drifted) | Guaranteed (single source) |
