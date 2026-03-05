# SyllabusStack - Document Processing Pipeline Architecture

> Current state as of 2026-03-05. This document maps the actual code, not aspirational plans.

---

## High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React/Vite)                             │
│  src/components/scanner/  ─── Upload UI (PDF, DOCX, image, URL)            │
│  src/components/instructor/ ─ Instructor dashboard, slide viewer, audio     │
│  src/hooks/lectureSlides/  ── React hooks for slide generation polling      │
└───────────┬─────────────────────────────────────────────────────────────────┘
            │  Supabase Edge Function calls (HTTPS)
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS (Deno)                            │
│                                                                             │
│  ┌─── TWO PARALLEL ENTRY POINTS ──────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  PATH A: Student Scan               PATH B: Instructor Process          │ │
│  │  ─────────────────────              ────────────────────────            │ │
│  │  parse-syllabus-document    ──OR──  process-syllabus                   │ │
│  │  (extract + analyze)                (extract + structure + decompose)   │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─── SHARED INFRASTRUCTURE ──────────────────────────────────────────────┐ │
│  │  _shared/unified-ai-client.ts    ← Single AI router (OpenRouter/GCP)  │ │
│  │  _shared/ai-orchestrator.ts      ← Model config & cost tracking       │ │
│  │  _shared/rate-limiter.ts         ← Per-user, per-function limits      │ │
│  │  _shared/error-handler.ts        ← Structured error responses         │ │
│  │  _shared/pipeline-contracts.ts   ← TypeScript I/O types               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                   │
│                                                                             │
│  ┌─ AI Providers ──────────┐  ┌─ Storage ──────────┐  ┌─ Search ────────┐ │
│  │ OpenRouter (primary)    │  │ Supabase DB (PG)   │  │ YouTube API     │ │
│  │ Google Gemini (direct)  │  │ Supabase Storage   │  │ Firecrawl       │ │
│  │ Vertex AI Batch         │  │ Google Cloud Stor.  │  │ Jina AI         │ │
│  │ Google Cloud Vision     │  │                     │  │ Invidious       │ │
│  │ Google TTS              │  │                     │  │ Perplexity      │ │
│  │ EvoLink (images, opt.)  │  │                     │  │                 │ │
│  └─────────────────────────┘  └─────────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Stage Enum (from `pipeline-contracts.ts`)

```
PipelineStage.SYLLABUS_ANALYSIS         → analyze-syllabus
PipelineStage.LEARNING_OBJECTIVES       → extract-learning-objectives
PipelineStage.CURRICULUM_DECOMPOSITION  → curriculum-reasoning-agent
PipelineStage.LECTURE_SLIDES            → generate-lecture-slides-v3
PipelineStage.BATCH_SLIDES_SUBMIT       → submit-batch-slides
PipelineStage.BATCH_SLIDES_POLL         → poll-batch-status
PipelineStage.BATCH_IMAGES              → process-batch-images
PipelineStage.ASSESSMENT_QUESTIONS      → generate-assessment-questions
PipelineStage.CONTENT_SEARCH            → search-youtube-content
```

---

## PATH A: Student Syllabus Scan

Simple 2-step flow for students uploading a syllabus to discover their capabilities.

```
┌──────────────────────────────┐
│  1. parse-syllabus-document  │   Entry point for student uploads
│                              │
│  Input:  document_base64     │   Accepts PDF, DOCX, image, URL
│          OR document_url     │
│          course_id (opt)     │
│          file_name           │
│          isPublicScan (opt)  │
│                              │
│  Processing:                 │
│  ├─ DOCX → local fflate     │   Local XML extraction (no AI cost)
│  │         unzip + parse     │
│  ├─ TXT  → base64 decode    │   Direct text read
│  ├─ PDF  → Gemini 2.0 Flash │   AI-powered OCR/extraction
│  └─ IMG  → Gemini 2.0 Flash │   Vision + OCR
│           (fallback: Cloud   │   Falls back to Google Cloud Vision
│            Vision API)       │   if Gemini fails on images
│                              │
│  Output: extracted_text      │
│          (chains to step 2)  │
└──────────────┬───────────────┘
               │ Internal fetch (server-to-server)
               ▼
┌──────────────────────────────┐
│  2. analyze-syllabus         │   AI capability extraction
│                              │
│  Input:  syllabusText        │
│          courseId (opt)       │
│                              │
│  AI Model: OpenRouter        │
│    MODELS.FAST (gpt-4o-mini) │
│    fallback: gemini-2.5-flash│
│    Schema: structured output │
│                              │
│  Extracts:                   │
│  ├─ capabilities[] (5-15)    │   "Can do X" format
│  │   ├─ name                 │
│  │   ├─ category             │   technical/analytical/communication/...
│  │   ├─ proficiency_level    │   beginner → expert
│  │   └─ evidence_type        │
│  ├─ course_themes[]          │
│  ├─ tools_learned[]          │
│  ├─ course_title             │   AI-extracted metadata
│  ├─ course_code              │
│  ├─ semester                 │
│  └─ credits                  │
│                              │
│  DB Writes:                  │
│  ├─ courses.update()         │   capability_text, key_capabilities,
│  │                           │   keywords, analysis_status
│  ├─ capabilities.insert()    │   Per-capability records
│  └─ capability_profiles      │   Aggregated user profile
│     .upsert()                │
└──────────────────────────────┘
```

---

## PATH B: Instructor Syllabus Processing

Full pipeline for instructors — extracts structure, creates modules, decomposes into teaching units, generates slides, images, and audio.

### Stage 1: Document Ingestion & Structure Extraction

```
┌─────────────────────────────────────────────┐
│  1. process-syllabus                         │  ENTRY POINT (instructor flow)
│                                              │
│  Input:  document_base64 OR document_url     │
│          instructor_course_id (required)     │
│          file_name                           │
│                                              │
│  STEP 1: Text Extraction                    │
│  ├─ DOCX → local fflate (same as Path A)   │
│  └─ PDF/IMG → Gemini 3 Flash (65K tokens)   │  Upgraded model vs Path A
│                                              │
│  STEP 1.5: AI Domain Analysis               │  ← NEW: Universal Adaptive Engine
│  ├─ analyzeDomainWithAI(text)               │  Gemini direct call
│  │   Returns DomainConfig:                   │
│  │   ├─ domain ("Strategic Management")     │
│  │   ├─ trusted_sites[] (hbr.org, ...)      │
│  │   ├─ citation_style                       │
│  │   ├─ avoid_sources[]                      │
│  │   ├─ visual_templates[]                   │
│  │   ├─ academic_level                       │
│  │   └─ terminology_preferences[]            │
│  ├─ extractDomainTerms() for synonyms       │
│  ├─ Store domain_config in instructor_courses│
│  └─ Fire-and-forget: getLearnedSynonyms()   │  Background synonym learning
│                                              │
│  STEP 2: Structure Analysis (AI)            │
│  ├─ Gemini 3 Flash (direct, JSON mode)      │  Bypasses OpenRouter 100KB limit
│  │   Fallback: OpenRouter + truncated text   │
│  └─ Output: CourseStructure {               │
│       ├─ modules[] (3-15)                   │
│       │   ├─ title, description             │
│       │   ├─ key_topics[], readings[]       │
│       │   ├─ assessment_type                │
│       │   └─ learning_objectives[] (2-6)    │
│       │       ├─ text, core_concept         │
│       │       ├─ bloom_level, domain        │
│       │       ├─ specificity                │
│       │       ├─ search_keywords[]          │
│       │       └─ prerequisites[]            │
│       ├─ unassigned_objectives[]            │
│       ├─ textbooks[]                        │
│       └─ grading_structure {}               │
│     }                                        │
│                                              │
│  STEP 3: Database Writes (batched)          │
│  ├─ modules.insert() (batch all at once)    │
│  ├─ learning_objectives.insert() (batch)    │  Deduplicated by normalized text
│  └─ Enrich domain_config with textbooks     │
│                                              │
│  STEP 4: Trigger batch curriculum (async)   │
│  └─ Fire-and-forget → submit-batch-curriculum│  If ≥3 LOs and enabled
│                                              │
│  Output: modules[], learning_objectives[]    │
└──────────────┬──────────────────────────────┘
               │
               ▼ (async, triggered automatically)
```

### Stage 2: Curriculum Decomposition

Two paths: batch (Vertex AI) or sync (per-LO).

```
┌──────────────────────────────────────────────────────────────────┐
│                CURRICULUM DECOMPOSITION                            │
│                                                                    │
│  ┌─── BATCH PATH (preferred) ──────────┐  ┌─── SYNC PATH ──────┐ │
│  │  submit-batch-curriculum             │  │  curriculum-        │ │
│  │  ├─ Build JSONL for all LOs         │  │  reasoning-agent    │ │
│  │  ├─ Upload to GCS                   │  │  (per LO, on-demand)│ │
│  │  ├─ Create Vertex AI batch job      │  │                     │ │
│  │  └─ 50% cost discount               │  │  Called when:       │ │
│  │                                      │  │  ├─ batch failed    │ │
│  │  poll-batch-curriculum               │  │  ├─ < 3 LOs        │ │
│  │  ├─ Check batch job status          │  │  └─ manual trigger  │ │
│  │  └─ Parse results → DB              │  │                     │ │
│  └──────────────────────────────────────┘  └─────────────────────┘ │
│                                                                    │
│  AI Model: Gemini 3 Pro Preview                                   │
│    ├─ Thinking: enabled (high)                                    │
│    ├─ Tools: Google Search (grounding)                            │
│    └─ Fallback: OpenRouter (gemini-pro → gemini-flash → gpt-4o)  │
│                                                                    │
│  Per LO Output: 3-5 TeachingUnits (capped at 5)                  │
│  ├─ sequence_order, title, description                            │
│  ├─ what_to_teach, why_this_matters, how_to_teach                │
│  ├─ common_misconceptions[]                                       │
│  ├─ prerequisites[], enables[]                                    │
│  ├─ target_video_type (explainer/tutorial/case_study/...)        │
│  ├─ target_duration_minutes (5-15)                                │
│  ├─ search_queries[] (max 5)                                      │
│  ├─ required_concepts[], avoid_terms[]                            │
│  └─ reasoning_chain, domain_context                               │
│                                                                    │
│  DB: teaching_units.insert()                                      │
│  Status tracking: learning_objectives.decomposition_status        │
│    (unstarted → in_progress → completed/failed)                   │
│                                                                    │
│  Idempotency: Checks status before processing, returns existing   │
│  units if already completed.                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Stage 3: Lecture Slide Generation

Two paths: single (real-time) or batch (background).

```
┌──────────────────────────────────────────────────────────────────────┐
│                   SLIDE GENERATION                                    │
│                                                                      │
│  ┌─── SINGLE PATH (real-time) ──────┐  ┌─── BATCH PATH ───────────┐ │
│  │  generate-lecture-slides-v3       │  │  submit-batch-slides     │ │
│  │  (per teaching unit)              │  │  ├─ Create placeholders  │ │
│  │                                   │  │  ├─ batch_jobs record    │ │
│  │  PHASE 1: Context Gathering      │  │  └─ Return immediately   │ │
│  │  └─ fetchTeachingUnitContext()    │  │                          │ │
│  │     (LO + module + course +      │  │  process-batch-research  │ │
│  │      domain_config)              │  │  ├─ Research per unit    │ │
│  │                                   │  │  ├─ Generate slides     │ │
│  │  PHASE 2: Research Agent         │  │  │  (OpenRouter or       │ │
│  │  └─ runResearchAgent()            │  │  │   Vertex AI Batch)   │ │
│  │     Model: perplexity/sonar-pro  │  │  ├─ Quality metrics     │ │
│  │     → grounded_content[]         │  │  └─ CMM notes upgrade   │ │
│  │     (with research cache)         │  │                          │ │
│  │                                   │  │  BATCH_PROVIDER env:    │ │
│  │  PHASE 2C: Professor AI          │  │  ├─ 'openrouter' (def)  │ │
│  │  └─ Model: gemini-3-flash-prev   │  │  └─ 'vertex' (50% off) │ │
│  │     via OpenRouter                │  │                          │ │
│  │     Fallback: PROFESSOR_AI_FB    │  │  poll-batch-status       │ │
│  │     Output: 6 slides/unit         │  │  └─ Vertex batch polling│ │
│  │                                   │  │                          │ │
│  │  PHASE 2D: CMM Notes Upgrade     │  └──────────────────────────┘ │
│  │  └─ upgradeSpeakerNotes()         │                               │
│  │     Conversational Mastery Method│                               │
│  │                                   │                               │
│  │  PHASE 3: Save Slides            │                               │
│  │  └─ lecture_slides.update()       │                               │
│  │     status: 'ready'               │                               │
│  │     quality_score calculated      │                               │
│  │                                   │                               │
│  │  PHASE 4: Queue Images (async)   │                               │
│  │  └─ image_generation_queue        │                               │
│  │     .upsert()                     │                               │
│  │     + trigger process-batch-images│                               │
│  └───────────────────────────────────┘                               │
│                                                                      │
│  Slide Structure (per slide):                                        │
│  ├─ order, type (title/hook/definition/example/synthesis/...)       │
│  ├─ title                                                            │
│  ├─ content { main_text, key_points[], definition?, example?,       │
│  │            misconception?, steps?, layout hints }                 │
│  ├─ visual_directive { type, description, elements, style }         │
│  ├─ speaker_notes (200-300 words, CMM-upgraded)                     │
│  ├─ estimated_seconds                                                │
│  └─ pedagogy { purpose, bloom_action, transition_to_next }          │
│                                                                      │
│  Shared Modules (_shared/):                                          │
│  ├─ slide-prompts.ts     → Canonical prompt template (v3 + batch)   │
│  ├─ slide-types.ts       → TypeScript interfaces                     │
│  ├─ context-fetcher.ts   → DB context assembly                       │
│  ├─ research-agent.ts    → Perplexity research + caching             │
│  ├─ quality-metrics.ts   → Slide quality scoring                     │
│  ├─ ai-narrator.ts       → CMM speaker notes upgrade                 │
│  └─ image-prompt-builder.ts → AI-powered image prompt generation    │
└──────────────────────────────────────────────────────────────────────┘
```

### Stage 4: Image Generation (Async, Queue-Based)

```
┌──────────────────────────────────────────────────────────────────┐
│  process-batch-images                                             │
│  Self-continuing queue processor                                  │
│                                                                    │
│  Queue: image_generation_queue table                              │
│  ├─ Populated by: generate-lecture-slides-v3 (single path)       │
│  │                 populateQueueFromLecture() (batch/manual)     │
│  │                                                                │
│  ├─ BATCH_SIZE = 3 items per invocation                          │
│  ├─ MAX_CONCURRENT = 2 parallel image generations                │
│  ├─ Self-invokes to continue until queue is empty                │
│  │                                                                │
│  │  Per item:                                                     │
│  │  1. buildImagePrompt() → AI-powered prompt from slide context │
│  │  2. generateImage() → unified-ai-client.ts                   │
│  │     IMAGE_PROVIDER env:                                       │
│  │     ├─ 'openrouter' (default) → Gemini 3 Pro Image           │
│  │     ├─ 'google' → Google Generative Language API              │
│  │     └─ 'evolink' → EvoLink.ai (~$0.05/image, 63% cheaper)   │
│  │  3. Upload PNG to Supabase Storage (lecture-visuals bucket)   │
│  │  4. Update lecture_slides.slides[].visual.url                 │
│  │                                                                │
│  ├─ Retry: 3 attempts per item                                   │
│  ├─ Stale detection: resets items stuck >15min                   │
│  └─ Circuit breaker: stops on billing/auth errors (402/403)     │
│                                                                    │
│  Trigger Modes:                                                   │
│  ├─ { continue: true }        → Process next batch from queue    │
│  ├─ { lecture_slides_id }     → Populate + process one lecture   │
│  ├─ { lecture_slides_ids }    → Populate + process multiple      │
│  ├─ { batch_job_id }          → Legacy: from batch job           │
│  ├─ { instructor_course_id }  → All slides for a course         │
│  ├─ { sync_only: true }       → Just sync URLs to slides        │
│  └─ { reset_failed: true }    → Reset failed → pending          │
└──────────────────────────────────────────────────────────────────┘
```

### Stage 5: Audio Generation (Async, Fire-and-Forget)

```
┌──────────────────────────────────────────────────────────────────┐
│  generate-batch-audio                                             │
│  Course-level batch audio orchestrator                            │
│                                                                    │
│  Input: instructorCourseId                                        │
│                                                                    │
│  Self-continuing with concurrency control:                        │
│  ├─ MAX_CONCURRENT = 4 parallel workers                          │
│  ├─ BATCH_SIZE = 2 dispatches per invocation                     │
│  ├─ Stale detection: resets workers stuck >10 min                │
│  └─ Idle polling: up to 20 loops (~10 min) for stragglers       │
│                                                                    │
│  Per unit: fire-and-forget → generate-lecture-audio               │
│  ├─ AI narration via ai-narrator.ts                              │
│  │   (or fallback to simple slide-text-based narration)          │
│  ├─ SSML transformation                                          │
│  ├─ TTS synthesis (Google Cloud TTS, 6 voice options)            │
│  ├─ Audio segment mapping (sync audio to slide blocks)           │
│  └─ Upload MP3 to Supabase Storage                               │
└──────────────────────────────────────────────────────────────────┘
```

### Stage 6: Content Discovery

```
┌──────────────────────────────────────────────────────────────────┐
│  search-youtube-content                                           │
│  Unified educational content search for instructors               │
│                                                                    │
│  Pipeline:                                                        │
│  1. Context Assembly → Single DB round-trip (LO + module + course)│
│  2. Query Intelligence → 3 query builders                        │
│     (_shared/query-intelligence/)                                │
│     ├─ concept-extractor.ts                                      │
│     ├─ query-builders.ts                                         │
│     ├─ role-aware-builder.ts                                     │
│     └─ content-role-reasoner.ts                                  │
│  3. Multi-Query Discovery → Top 3 queries, parallel search       │
│     (_shared/youtube-search/)                                    │
│     ├─ firecrawl-search.ts  (primary)                           │
│     ├─ jina-search.ts       (fallback 1)                        │
│     ├─ invidious-search.ts  (fallback 2)                        │
│     └─ youtube-api-search.ts (fallback 3)                       │
│  4. Pre-Filter → Duration fit + channel authority                │
│  5. AI Evaluation → evaluate-content-batch (scoring)             │
│  6. Save & Auto-Approve → AI recommendation → DB                │
│                                                                    │
│  Caching: content-cache.ts (keyword-based)                       │
│  Rate limiting: quota-tracker.ts (per provider)                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## AI Model Routing (unified-ai-client.ts)

All AI operations are routed through a single client with provider toggles:

```
┌──────────────────────────────────────────────────────────────────────┐
│  unified-ai-client.ts - SINGLE ENTRY POINT                          │
│                                                                      │
│  Text Generation:                                                    │
│  ├─ MODELS.FAST           → openai/gpt-4o-mini ($0.15/$0.60/M)    │
│  ├─ MODELS.GEMINI_FLASH   → google/gemini-2.5-flash               │
│  ├─ MODELS.GEMINI_PRO     → google/gemini-3-pro-preview            │
│  ├─ MODELS.PROFESSOR_AI   → google/gemini-3-flash-preview          │
│  ├─ MODELS.PROFESSOR_AI_FB→ google/gemini-2.5-flash (fallback)    │
│  ├─ MODELS.RESEARCH       → perplexity/sonar-pro                   │
│  ├─ MODELS.HAIKU          → anthropic/claude-3.5-haiku             │
│  └─ MODELS.SONNET         → anthropic/claude-sonnet-4              │
│                                                                      │
│  Image Generation (IMAGE_PROVIDER toggle):                          │
│  ├─ 'openrouter' (default) → gemini-3-pro-image via OpenRouter    │
│  ├─ 'google'               → Google Generative Language API        │
│  └─ 'evolink'              → EvoLink.ai ($0.05/image)             │
│                                                                      │
│  Batch Processing (BATCH_PROVIDER toggle):                          │
│  ├─ 'openrouter' (default) → Sequential via OpenRouter             │
│  └─ 'vertex'               → Vertex AI Batch (50% discount)        │
│                                                                      │
│  Direct Google API calls (bypass OpenRouter):                       │
│  ├─ parse-syllabus-document  → Gemini 2.0 Flash (OCR)             │
│  ├─ process-syllabus         → Gemini 3 Flash (structure analysis) │
│  ├─ curriculum-reasoning-agent → Gemini 3 Pro (thinking + search)  │
│  └─ Domain analysis          → Gemini 3 Flash (JSON mode)          │
│                                                                      │
│  Functions: generateText(), generateStructured(), generateImage()   │
│  Features: automatic fallback chains, cost tracking, retry logic    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (key tables)

```
courses                  ← Student-uploaded courses (Path A)
├─ syllabus_text
├─ key_capabilities      (JSONB)
├─ capability_keywords   (text[])
├─ analysis_status       (analyzing/completed/failed)
└─ ai_model_used

capabilities             ← Extracted skills per user/course
├─ name, category, proficiency_level
└─ source (course)

capability_profiles      ← Aggregated per-user profiles

instructor_courses       ← Instructor-created courses (Path B)
├─ syllabus_text
├─ detected_domain
├─ domain_config         (JSONB - full AI-generated config)
└─ instructor_id

modules                  ← Course structure units
├─ instructor_course_id
├─ title, description
└─ sequence_order

learning_objectives      ← Per-module learning goals
├─ module_id, instructor_course_id
├─ text, core_concept, action_verb
├─ bloom_level, domain, specificity
├─ search_keywords       (text[])
├─ expected_duration_minutes
├─ decomposition_status  (unstarted/in_progress/completed/failed)
├─ source_type           (explicit/inferred_from_*)
├─ confidence            (high/medium/low)
└─ approval_status       (approved/pending_review/rejected)

teaching_units           ← Micro-concepts (3-5 per LO)
├─ learning_objective_id
├─ title, description
├─ what_to_teach, why_this_matters, how_to_teach
├─ common_misconceptions (text[])
├─ prerequisites, enables (text[])
├─ target_video_type
├─ target_duration_minutes
├─ search_queries        (text[])
└─ status

lecture_slides           ← Generated slide decks
├─ teaching_unit_id (unique)
├─ slides                (JSONB array)
├─ status                (preparing/generating/ready/published/failed)
├─ quality_score
├─ generation_phases     (JSONB - progress tracking)
├─ batch_job_id
├─ has_audio, audio_status
├─ is_research_grounded
├─ research_context      (JSONB)
└─ generation_model

image_generation_queue   ← Async image processing queue
├─ lecture_slides_id, slide_index (unique)
├─ prompt
├─ status                (pending/processing/completed/failed)
├─ image_url             (storage path)
├─ attempts, max_attempts
└─ generation_model

batch_jobs               ← Batch processing tracking
├─ instructor_course_id
├─ job_type              (slides/curriculum)
├─ status                (preparing/researching/submitting/pending/running/completed/failed)
├─ total_requests, succeeded_count, failed_count
└─ google_batch_id
```

---

## Complete Instructor Flow (End-to-End)

```
 Instructor uploads PDF/DOCX
          │
          ▼
 ┌─ process-syllabus ─────────────────────────────┐
 │  1. Extract text (Gemini 3 Flash / local DOCX)  │
 │  2. Analyze domain (AI → DomainConfig)          │
 │  3. Extract structure (AI → modules + LOs)       │
 │  4. Save to DB (batched inserts)                 │
 │  5. Fire-and-forget: submit-batch-curriculum     │
 └─────────────────────────────────────────────────┘
          │
          ▼ (async)
 ┌─ submit-batch-curriculum ───────────────────────┐
 │  Build JSONL → GCS → Vertex AI Batch Job         │
 │  (or sync: curriculum-reasoning-agent per LO)    │
 │                                                   │
 │  Result: 3-5 teaching_units per LO               │
 └─────────────────────────────────────────────────┘
          │
          ▼ (instructor triggers)
 ┌─ submit-batch-slides ───────────────────────────┐
 │  Create placeholders (batch_jobs + lecture_slides)│
 │  Return immediately                               │
 └──────────────────┬──────────────────────────────┘
                    │ frontend calls next
                    ▼
 ┌─ process-batch-research ────────────────────────┐
 │  For each teaching unit:                         │
 │  1. Research (Perplexity sonar-pro, cached)      │
 │  2. Professor AI → 6 slides                      │
 │  3. CMM speaker notes upgrade                    │
 │  4. Quality metrics                              │
 │  5. Save to lecture_slides                       │
 │  6. Queue images                                 │
 └──────────────────┬──────────────────────────────┘
                    │ auto-triggered
                    ▼
 ┌─ process-batch-images ──────────────────────────┐
 │  Self-continuing queue processor                 │
 │  3 items/invocation, 2 concurrent               │
 │  Generate → Upload → Update slides              │
 └──────────────────┬──────────────────────────────┘
                    │ instructor triggers
                    ▼
 ┌─ generate-batch-audio ──────────────────────────┐
 │  Self-continuing fire-and-forget                 │
 │  4 concurrent workers, 2 dispatches/invocation   │
 │  AI narration → SSML → TTS → Storage            │
 └──────────────────┬──────────────────────────────┘
                    │ parallel / on-demand
                    ▼
 ┌─ search-youtube-content ────────────────────────┐
 │  Query intelligence → Multi-source search        │
 │  AI evaluation → Save & auto-approve             │
 └─────────────────────────────────────────────────┘
```

---

## Environment Variables / Provider Toggles

| Variable | Values | Controls |
|---|---|---|
| `IMAGE_PROVIDER` | `openrouter` (default), `google`, `evolink` | Image generation provider |
| `BATCH_PROVIDER` | `openrouter` (default), `vertex` | Batch slide processing |
| `ENABLE_BATCH_CURRICULUM` | `true` (default), `false` | Auto-trigger batch curriculum after syllabus |
| `OPENROUTER_API_KEY` | - | Primary AI router |
| `GOOGLE_CLOUD_API_KEY` | - | Direct Gemini, Vision, TTS |
| `GCP_SERVICE_ACCOUNT_JSON` | - | Vertex AI batch, GCS |
| `SUPABASE_URL` | - | Database + Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | - | Service-to-service calls |
| `SUPABASE_ANON_KEY` | - | User-authenticated calls |

---

## Key Architectural Patterns

1. **Self-Continuation**: Edge functions have 150s timeout. Long-running tasks (images, audio) use self-invocation via HTTP fetch to process queues in small batches.

2. **Fire-and-Forget**: Non-critical async work (synonym learning, batch curriculum trigger, domain config enrichment) is dispatched without awaiting results.

3. **Dual Entry Points**: Student (Path A) and Instructor (Path B) have separate entry points but share document extraction logic. Path B is significantly richer.

4. **Provider Toggles**: AI providers can be switched via env vars without code changes. OpenRouter is the default router; direct Google APIs are used where OpenRouter has limitations (100KB body, image generation).

5. **Shared Module Consolidation**: All slide generation (single + batch) uses the same canonical prompts from `_shared/slide-prompts.ts` to prevent quality drift.

6. **Queue-Based Processing**: Image generation uses a database queue (`image_generation_queue`) with retry logic, stale detection, and circuit breakers for billing errors.

7. **Idempotency Guards**: Curriculum decomposition checks `decomposition_status` before processing. Batch slides check for active jobs and existing slides.

8. **Fallback Chains**: Every AI call has fallback models. Document extraction falls back from Gemini to Vision API. Search falls back across 4 providers.
