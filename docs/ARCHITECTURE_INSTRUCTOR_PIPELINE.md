# SyllabusStack Instructor Pipeline Architecture

## End-to-End Flow: From Syllabus Upload to Published Course

**Document Version**: 2.0
**Last Updated**: 2026-01-19
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#1-overview)
2. [Stage 1: Course Creation](#2-stage-1-course-creation)
3. [Stage 2: Batch Curriculum Decomposition](#3-stage-2-batch-curriculum-decomposition)
4. [Stage 3: Content Discovery](#4-stage-3-content-discovery)
5. [Stage 4: Batch Video Evaluation](#5-stage-4-batch-video-evaluation)
6. [Stage 5: Slide Generation](#6-stage-5-slide-generation)
7. [Stage 6: Async Image Generation](#7-stage-6-async-image-generation)
8. [Stage 7: Display & Publishing](#8-stage-7-display--publishing)
9. [Sync Fallback Paths](#9-sync-fallback-paths)
10. [Database Schema](#10-database-schema)
11. [Feature Flags](#11-feature-flags)
12. [Model Configuration](#12-model-configuration)
13. [Unit Test Points](#13-unit-test-points)
14. [Cost Analysis](#14-cost-analysis)
15. [Deployment Commands](#15-deployment-commands)

---

## 1. Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INSTRUCTOR PIPELINE FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SYLLABUS     CURRICULUM      CONTENT        VIDEO         SLIDE     IMAGE │
│  UPLOAD   →   DECOMPOSE   →   DISCOVERY  →   EVALUATION →  GEN   →   GEN  │
│                                                                             │
│  [Sync]       [Batch]         [Sync]         [Batch]       [Batch]  [Async]│
│  ~10s         ~5min           ~2min          ~5min         ~10min   ~3min  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Technologies

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL (Supabase) |
| AI Models | Google Gemini (2.0, 2.5, 3.0) |
| Batch Processing | Vertex AI Batch Prediction |
| Storage | Google Cloud Storage (GCS), Supabase Storage |
| Video Search | YouTube Data API v3 |

---

## 2. Stage 1: Course Creation

### User Action
Instructor uploads syllabus file (PDF, DOCX, or TXT)

### Frontend Component
```
src/pages/instructor/QuickCourseSetup.tsx
```

### UI States
```
upload → extracting → analyzing → creating_course → saving_structure →
finding_content → evaluating_content → complete
```

### Edge Function
```
supabase/functions/process-syllabus/index.ts
```

### Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROCESS-SYLLABUS FUNCTION                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: TEXT EXTRACTION                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Model: gemini-2.5-flash-lite                                       │   │
│  │  Input: PDF/DOCX binary (base64)                                    │   │
│  │  Output: Raw text content                                           │   │
│  │  Cost: ~$0.008                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  PHASE 2: DOMAIN DETECTION                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Model: gemini-2.5-flash                                            │   │
│  │  Input: Extracted text (first 5000 chars)                           │   │
│  │  Output: {                                                          │   │
│  │    detected_domain: "business" | "science" | "humanities" | ...,    │   │
│  │    domain_config: { visual_templates, terminology_style, ... }      │   │
│  │  }                                                                  │   │
│  │  Cost: ~$0.003                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  PHASE 3: STRUCTURE ANALYSIS                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Model: gemini-2.5-flash                                            │   │
│  │  Input: Full text + domain context                                  │   │
│  │  Output: {                                                          │   │
│  │    title: "Course Title",                                           │   │
│  │    code: "MGT471",                                                  │   │
│  │    modules: [{ title, description, sequence_order }],               │   │
│  │    learning_objectives: [{                                          │   │
│  │      text: "Analyze competitive forces...",                         │   │
│  │      bloom_level: "analyze",                                        │   │
│  │      core_concept: "Porter's Five Forces",                          │   │
│  │      module_id, sequence_order                                      │   │
│  │    }]                                                               │   │
│  │  }                                                                  │   │
│  │  Cost: ~$0.015                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  PHASE 4: DATABASE INSERTS                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  INSERT instructor_courses                                          │   │
│  │    - id, title, code, detected_domain, syllabus_text                │   │
│  │                                                                     │   │
│  │  INSERT modules[]                                                   │   │
│  │    - instructor_course_id, title, description, sequence_order       │   │
│  │                                                                     │   │
│  │  INSERT learning_objectives[]                                       │   │
│  │    - instructor_course_id, module_id, text, bloom_level             │   │
│  │    - decomposition_status = 'not_started'                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  PHASE 5: TRIGGER BATCH CURRICULUM (Fire-and-Forget)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Condition: ENABLE_BATCH_CURRICULUM !== 'false' && LO count >= 3    │   │
│  │                                                                     │   │
│  │  fetch('/functions/v1/submit-batch-curriculum', {                   │   │
│  │    method: 'POST',                                                  │   │
│  │    body: { instructor_course_id, learning_objective_ids }           │   │
│  │  })                                                                 │   │
│  │                                                                     │   │
│  │  NOTE: Non-blocking. Returns immediately to frontend.               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Point 1: Syllabus Processing
```typescript
// Assertions:
- instructor_courses record created with detected_domain
- modules[] created with correct sequence_order
- learning_objectives[] created with:
  - valid bloom_level enum ('remember'|'understand'|'apply'|'analyze'|'evaluate'|'create')
  - decomposition_status = 'not_started'
  - text not empty
```

---

## 3. Stage 2: Batch Curriculum Decomposition

### Purpose
Decompose each Learning Objective into 3-8 teachable micro-concepts (Teaching Units) using Vertex AI Batch Prediction for 50% cost savings.

### Edge Functions
```
supabase/functions/submit-batch-curriculum/index.ts
supabase/functions/poll-batch-curriculum/index.ts
```

### Submit Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBMIT-BATCH-CURRICULUM FUNCTION                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Fetch learning_objectives by IDs                                        │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ SELECT * FROM learning_objectives                               │    │
│     │ WHERE id IN (...)                                               │    │
│     │ AND decomposition_status = 'not_started'                        │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  2. Build JSONL batch request                                               │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ For each LO, create prompt with:                                │    │
│     │ - UbD Backward Design Framework                                 │    │
│     │ - Bloom's Taxonomy matching                                     │    │
│     │ - Expected output: 3-8 teaching units                           │    │
│     │ - Search query generation guidelines                            │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  3. INSERT batch_jobs record                                                │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ INSERT INTO batch_jobs (                                        │    │
│     │   id, instructor_course_id, job_type, status,                   │    │
│     │   google_batch_id, total_requests, request_mapping              │    │
│     │ ) VALUES (                                                      │    │
│     │   uuid, course_id, 'curriculum', 'preparing',                   │    │
│     │   'pending-{uuid}',  -- Placeholder until Vertex job created    │    │
│     │   lo_count, { mapping }                                         │    │
│     │ )                                                               │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  4. Upload JSONL to GCS                                                     │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ Path: curriculum-batch/{batch_job_id}/input.jsonl               │    │
│     │ Bucket: GCS_BUCKET_NAME env var                                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  5. Create Vertex AI Batch Job                                              │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ Model: publishers/google/models/gemini-3-pro-preview            │    │
│     │ Input: gs://bucket/curriculum-batch/{id}/input.jsonl            │    │
│     │ Output: gs://bucket/curriculum-batch/{id}/output/               │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  6. UPDATE batch_jobs.google_batch_id with real Vertex job ID               │
│                              │                                              │
│                              ▼                                              │
│  7. UPDATE learning_objectives                                              │
│     SET decomposition_status = 'in_progress',                               │
│         curriculum_batch_job_id = batch_job_id                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Poll Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POLL-BATCH-CURRICULUM FUNCTION                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Fetch batch_jobs record                                                 │
│                              │                                              │
│                              ▼                                              │
│  2. VALIDATION: Reject pending placeholder                                  │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ if (!google_batch_id || google_batch_id.startsWith('pending-')) │    │
│     │   throw Error('No valid google_batch_id found')                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  3. Get Vertex AI job status                                                │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ States: JOB_STATE_PENDING | JOB_STATE_RUNNING |                 │    │
│     │         JOB_STATE_SUCCEEDED | JOB_STATE_FAILED                  │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                    ┌─────────┴─────────┐                                    │
│                    ▼                   ▼                                    │
│              STILL RUNNING         COMPLETE                                 │
│                    │                   │                                    │
│                    ▼                   ▼                                    │
│              Return early:       4. Download JSONL from GCS                 │
│              { is_complete:           │                                     │
│                false }                ▼                                     │
│                                 5. Parse AI responses                       │
│                                       │                                     │
│                                       ▼                                     │
│                                 6. INSERT teaching_units                    │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ For each LO response:                                           │    │
│     │   INSERT INTO teaching_units (                                  │    │
│     │     learning_objective_id, sequence_order, title,               │    │
│     │     description, what_to_teach, why_this_matters,               │    │
│     │     how_to_teach, common_misconceptions[],                      │    │
│     │     prerequisites[], enables[], target_video_type,              │    │
│     │     target_duration_minutes, search_queries[],                  │    │
│     │     required_concepts[], avoid_terms[], status                  │    │
│     │   )                                                             │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                       │                                     │
│                                       ▼                                     │
│                                 7. UPDATE learning_objectives               │
│                                    SET decomposition_status = 'completed'   │
│                                       │                                     │
│                                       ▼                                     │
│                                 8. UPDATE batch_jobs                        │
│                                    SET status = 'completed',                │
│                                        succeeded_count, failed_count        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Point 2: Batch Curriculum Submission
```typescript
// Assertions:
- batch_jobs.job_type = 'curriculum'
- batch_jobs.status = 'submitted'
- batch_jobs.google_batch_id NOT starts with 'pending-' (after Vertex job created)
- batch_jobs.request_mapping contains LO IDs
```

### Test Point 3: Teaching Unit Creation
```typescript
// Assertions:
- teaching_units created with valid learning_objective_id
- teaching_units count = 3-8 per LO
- teaching_units.search_queries array has 4-5 queries
- teaching_units.target_video_type in valid enum
- learning_objectives.decomposition_status = 'completed'
```

---

## 4. Stage 3: Content Discovery

### Purpose
Search YouTube for educational videos matching each Teaching Unit's search queries.

### Frontend Trigger
```typescript
// QuickCourseSetup.tsx - Recommended: Parallel processing for better performance
await Promise.all(
  learningObjectives.map(lo =>
    supabase.functions.invoke('search-youtube-content', {
      body: { learning_objective_id: lo.id }
    })
  )
);
```

> **Performance Note**: Using `Promise.all` enables parallel requests, significantly
> reducing total time when processing many learning objectives. The sequential `for`
> loop pattern should be avoided as it waits for each request before starting the next.

### Edge Function
```
supabase/functions/search-youtube-content/index.ts
```

### Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SEARCH-YOUTUBE-CONTENT FUNCTION                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Check if teaching_units exist for this LO                               │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ SELECT * FROM teaching_units                                    │    │
│     │ WHERE learning_objective_id = ?                                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                    ┌─────────┴─────────────────────┐                        │
│                    ▼                               ▼                        │
│              UNITS EXIST                      NO UNITS                      │
│                    │                               │                        │
│                    │                               ▼                        │
│                    │                    Check batch_jobs for                │
│                    │                    pending curriculum job              │
│                    │                               │                        │
│                    │                    ┌─────────┴─────────┐               │
│                    │                    ▼                   ▼               │
│                    │              JOB PENDING         NO PENDING JOB        │
│                    │                    │                   │               │
│                    │                    ▼                   ▼               │
│                    │              Return 202:        SYNC FALLBACK:         │
│                    │              retry_later        Call curriculum-       │
│                    │                                 reasoning-agent        │
│                    │                                 (blocking call)        │
│                    │                                       │                │
│                    └───────────────────┬───────────────────┘                │
│                                        ▼                                    │
│  2. For each teaching_unit:                                                 │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ a. YouTube Data API search                                      │    │
│     │    - Query: unit.search_queries[0..4]                           │    │
│     │    - Filter: type=video, videoDuration=medium                   │    │
│     │    - Max results: 10 per query                                  │    │
│     │                                                                 │    │
│     │ b. INSERT content (video metadata)                              │    │
│     │    - source='youtube', source_id=videoId                        │    │
│     │    - title, description, duration_seconds, channel_name         │    │
│     │                                                                 │    │
│     │ c. INSERT content_matches                                       │    │
│     │    - learning_objective_id, teaching_unit_id, content_id        │    │
│     │    - status depends on ENABLE_BATCH_EVALUATION flag             │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                        │                                    │
│                                        ▼                                    │
│  3. Evaluation mode decision                                                │
│                                        │                                    │
│                    ┌───────────────────┴───────────────────┐                │
│                    ▼                                       ▼                │
│     ENABLE_BATCH_EVALUATION=true              ENABLE_BATCH_EVALUATION=false │
│                    │                                       │                │
│                    ▼                                       ▼                │
│     Set status='pending_evaluation'           Call evaluate-content-batch   │
│     Return early with:                        (blocking, inline)            │
│     { batch_evaluation_pending: true }                     │                │
│                                                            ▼                │
│                                               Return evaluated videos       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Point 4: Content Discovery
```typescript
// Assertions:
- content records created with source='youtube'
- content.source_id = valid YouTube video ID
- content_matches.learning_objective_id valid
- content_matches.teaching_unit_id valid
- If batch mode: content_matches.status = 'pending_evaluation'
```

---

## 5. Stage 4: Batch Video Evaluation

### Purpose
Score discovered videos for pedagogical fit using Bloom's Taxonomy and Mayer's Multimedia Principles.

### Edge Functions
```
supabase/functions/submit-batch-evaluation/index.ts
supabase/functions/poll-batch-evaluation/index.ts
```

### Submit Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBMIT-BATCH-EVALUATION FUNCTION                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Fetch content_matches needing evaluation                                │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ SELECT cm.*, c.*, lo.*, tu.*                                    │    │
│     │ FROM content_matches cm                                         │    │
│     │ JOIN content c ON cm.content_id = c.id                          │    │
│     │ JOIN learning_objectives lo ON cm.learning_objective_id = lo.id │    │
│     │ LEFT JOIN teaching_units tu ON cm.teaching_unit_id = tu.id      │    │
│     │ WHERE cm.status = 'pending_evaluation'                          │    │
│     │ AND lo.instructor_course_id = ?                                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  2. Group by LO/teaching_unit (max 15 videos per request)                   │
│                              │                                              │
│                              ▼                                              │
│  3. Build evaluation prompts with:                                          │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ BLOOM'S TAXONOMY FRAMEWORK (weighted by level):                 │    │
│     │   remember:    weight 1.0 (relevance 50%, pedagogy 30%, quality 20%)│ │
│     │   understand:  weight 1.1 (relevance 40%, pedagogy 40%, quality 20%)│ │
│     │   apply:       weight 1.2 (relevance 35%, pedagogy 45%, quality 20%)│ │
│     │   analyze:     weight 1.3 (relevance 40%, pedagogy 40%, quality 20%)│ │
│     │   evaluate:    weight 1.4 (relevance 40%, pedagogy 35%, quality 25%)│ │
│     │   create:      weight 1.5 (relevance 35%, pedagogy 45%, quality 20%)│ │
│     │                                                                 │    │
│     │ MAYER'S MULTIMEDIA PRINCIPLES:                                  │    │
│     │   - Coherence, Signaling, Segmenting, Modality, Personalization │    │
│     │                                                                 │    │
│     │ SCORING CALIBRATION:                                            │    │
│     │   90-100: Exceptional (rare)                                    │    │
│     │   80-89:  Excellent                                             │    │
│     │   70-79:  Good                                                  │    │
│     │   60-69:  Acceptable                                            │    │
│     │   50-59:  Marginal                                              │    │
│     │   <50:    Not recommended                                       │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  4. INSERT batch_jobs (job_type='evaluation')                               │
│  5. Upload JSONL to GCS                                                     │
│  6. Create Vertex AI batch job                                              │
│  7. UPDATE content_matches.evaluation_batch_job_id                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Poll Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POLL-BATCH-EVALUATION FUNCTION                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Get Vertex AI job status                                                │
│                                                                             │
│  2. If complete: Download and parse evaluation scores                       │
│                                                                             │
│  3. UPDATE content_matches with:                                            │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ ai_relevance_score:  0.0 - 1.0 (decimal)                        │    │
│     │ ai_pedagogy_score:   0.0 - 1.0 (decimal)                        │    │
│     │ ai_quality_score:    0.0 - 1.0 (decimal)                        │    │
│     │ ai_reasoning:        "Detailed explanation..."                  │    │
│     │ ai_recommendation:   'highly_recommended' | 'recommended' |     │    │
│     │                      'acceptable' | 'not_recommended'           │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  4. Auto-approve highly recommended videos:                                 │
│     IF ai_recommendation = 'highly_recommended'                             │
│     THEN status = 'auto_approved'                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Point 5: Evaluation Submission
```typescript
// Assertions:
- batch_jobs.job_type = 'evaluation'
- batch_jobs.request_mapping contains content_match IDs
- JSONL contains video metadata and teaching unit context
```

### Test Point 6: Evaluation Results
```typescript
// Assertions:
- content_matches.ai_relevance_score between 0 and 1
- content_matches.ai_pedagogy_score between 0 and 1
- content_matches.ai_quality_score between 0 and 1
- content_matches.ai_recommendation in valid enum
- Highly recommended videos have status='auto_approved'
```

---

## 6. Stage 5: Slide Generation

### Purpose
Generate comprehensive lecture slides for each Teaching Unit with research grounding.

### Edge Functions
```
supabase/functions/submit-batch-slides/index.ts
supabase/functions/process-batch-research/index.ts
supabase/functions/poll-batch-status/index.ts
```

### Submit Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBMIT-BATCH-SLIDES FUNCTION                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Fetch teaching_units for course                                         │
│                                                                             │
│  2. INSERT lecture_slides records (status='preparing')                      │
│                                                                             │
│  3. INSERT batch_jobs (job_type='slides')                                   │
│                                                                             │
│  4. Build slide generation prompts with examples:                           │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ SLIDE TYPE EXAMPLES IN PROMPT:                                  │    │
│     │                                                                 │    │
│     │ 1. TITLE SLIDE                                                  │    │
│     │    - main_text, key_points, visual_directive                    │    │
│     │                                                                 │    │
│     │ 2. DEFINITION SLIDE                                             │    │
│     │    - definition: { term, formal_definition, simple_explanation, │    │
│     │                    significance, example }                      │    │
│     │                                                                 │    │
│     │ 3. MISCONCEPTION SLIDE (critical for learning)                  │    │
│     │    - misconception: {                                           │    │
│     │        wrong_belief: "What students incorrectly think...",      │    │
│     │        why_wrong: "This is problematic because...",             │    │
│     │        correct_understanding: "The accurate view is..."         │    │
│     │      }                                                          │    │
│     │                                                                 │    │
│     │ 4. EXAMPLE SLIDE (real-world application)                       │    │
│     │    - example: {                                                 │    │
│     │        scenario: "In 2023, Company X faced...",                 │    │
│     │        application: "They implemented...",                      │    │
│     │        outcome: "The result was...",                            │    │
│     │        lesson: "The key takeaway..."                            │    │
│     │      }                                                          │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  5. Upload JSONL to GCS                                                     │
│  6. Create Vertex AI batch job                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Research Flow (with Caching)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROCESS-BATCH-RESEARCH FUNCTION                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For each teaching_unit:                                                    │
│                                                                             │
│  1. Compute topic hash (SHA-256)                                            │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ hash = SHA256(normalize(searchTerms) + ":" + domain)            │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  2. Check research_cache (if ENABLE_RESEARCH_CACHE=true)                    │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ SELECT * FROM research_cache                                    │    │
│     │ WHERE topic_hash = ?                                            │    │
│     │ AND expires_at > now()                                          │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                    ┌─────────┴─────────┐                                    │
│                    ▼                   ▼                                    │
│              CACHE HIT            CACHE MISS                                │
│                    │                   │                                    │
│                    │                   ▼                                    │
│                    │        Call Google Search Grounding API                │
│                    │        (gemini-2.5-flash with search tools)            │
│                    │                   │                                    │
│                    │                   ▼                                    │
│                    │        INSERT research_cache                           │
│                    │        (expires: now + 7 days)                         │
│                    │                   │                                    │
│                    └─────────┬─────────┘                                    │
│                              ▼                                              │
│  3. Merge research into slide prompts                                       │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ research_context: {                                             │    │
│     │   grounding_sources: [...],                                     │    │
│     │   key_facts: [...],                                             │    │
│     │   current_developments: [...],                                  │    │
│     │   expert_perspectives: [...],                                   │    │
│     │   statistics: [...],                                            │    │
│     │   case_studies: [...]                                           │    │
│     │ }                                                               │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  4. Submit to Vertex AI batch                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Poll Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POLL-BATCH-STATUS FUNCTION                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Get Vertex AI job status                                                │
│                                                                             │
│  2. If complete: Download and parse slides                                  │
│                                                                             │
│  3. Format slides with full content structure:                              │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ {                                                               │    │
│     │   order: 1,                                                     │    │
│     │   type: 'concept' | 'definition' | 'misconception' | 'example', │    │
│     │   title: "Slide Title",                                         │    │
│     │   content: {                                                    │    │
│     │     main_text: "...",                                           │    │
│     │     main_text_layout: { type, emphasis_words },                 │    │
│     │     key_points: [...],                                          │    │
│     │     key_points_layout: [...],                                   │    │
│     │     definition: { term, formal_definition, ... },    // if def  │    │
│     │     misconception: { wrong_belief, why_wrong, ... }, // if misc │    │
│     │     example: { scenario, application, outcome, ... } // if ex   │    │
│     │   },                                                            │    │
│     │   visual: {                                                     │    │
│     │     url: null,  // Populated by process-batch-images            │    │
│     │     alt_text: "...",                                            │    │
│     │     fallback_description: "..."                                 │    │
│     │   },                                                            │    │
│     │   speaker_notes: "200-300 words...",                            │    │
│     │   pedagogy: { purpose, bloom_action, transition_to_next }       │    │
│     │ }                                                               │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  4. UPDATE lecture_slides with formatted slides                             │
│     SET status = 'ready'                                                    │
│                                                                             │
│  5. TRIGGER process-batch-images (fire-and-forget)                          │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ if (ENABLE_BATCH_IMAGE_GENERATION !== 'false') {                │    │
│     │   fetch('/functions/v1/process-batch-images', {                 │    │
│     │     body: { batch_job_id }                                      │    │
│     │   })                                                            │    │
│     │ }                                                               │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Point 7: Slide Generation
```typescript
// Assertions:
- lecture_slides.status = 'ready'
- lecture_slides.slides is valid JSON array
- Each slide has speaker_notes (200+ chars)
```

### Test Point 8: Research Caching
```typescript
// Assertions:
- research_cache.topic_hash is 64-char hex (SHA-256)
- research_cache.expires_at = created_at + 7 days
- Cache hit increments hit_count
- research_content contains grounding_sources
```

### Test Point 9: Slide Content Structure
```typescript
// Assertions:
- Misconception slides have: wrong_belief, why_wrong, correct_understanding
- Example slides have: scenario, application, outcome, lesson
- visual.url is null (pending image generation)
- visual.fallback_description not empty
```

---

## 7. Stage 6: Async Image Generation

### Purpose
Generate educational diagrams for slides asynchronously after slides are saved.

### Edge Function
```
supabase/functions/process-batch-images/index.ts
```

### Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROCESS-BATCH-IMAGES FUNCTION                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Fetch lecture_slides by batch_job_id                                    │
│                                                                             │
│  2. Filter slides needing images:                                           │
│     WHERE visual_directive.type != 'none'                                   │
│     AND visual.url IS NULL                                                  │
│                                                                             │
│  3. For each slide (batches of 3 for rate limiting):                        │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ a. Build image prompt:                                          │    │
│     │    - Topic, lecture context, domain                             │    │
│     │    - Visual requirements: type, description, elements, style    │    │
│     │    - Design rules: clean, high contrast, 16:9, no photos        │    │
│     │                                                                 │    │
│     │ b. Generate image via Gemini 3 Pro Image                        │    │
│     │    Model: gemini-3-pro-image-preview (MODEL_CONFIG.GEMINI_IMAGE)│    │
│     │    Config: { responseModalities: ['TEXT', 'IMAGE'] }            │    │
│     │                                                                 │    │
│     │ c. Upload to Supabase Storage                                   │    │
│     │    Bucket: 'lecture-visuals'                                    │    │
│     │    Path: slide_{teaching_unit_id}_{order}_{timestamp}.png       │    │
│     │                                                                 │    │
│     │ d. UPDATE slide.visual.url                                      │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  4. UPDATE lecture_slides.generation_phases:                                │
│     {                                                                       │
│       images_completed: timestamp,                                          │
│       images_generated: N,                                                  │
│       images_failed: M,                                                     │
│       current_phase: 'complete'                                             │
│     }                                                                       │
│                                                                             │
│  Rate Limiting:                                                             │
│  - Max 3 concurrent image generations                                       │
│  - 500ms delay between batches                                              │
│  - Retry with exponential backoff (max 2 retries)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Point 10: Image Generation
```typescript
// Assertions:
- lecture_slides.slides[].visual.url is valid storage URL
- Image file exists in lecture-visuals bucket
- generation_phases.images_generated matches actual count
- Images are PNG format with educational content
```

---

## 8. Stage 7: Display & Publishing

### Frontend Components
```
src/components/slides/SlideRenderer.tsx
src/pages/instructor/CourseSlideViewer.tsx
```

### Rendering Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SLIDE RENDERER COMPONENT                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Render slide.content:                                                      │
│                                                                             │
│  1. main_text → Primary paragraph with emphasis_words highlighted           │
│                                                                             │
│  2. definition (if present) → Blue box                                      │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  📘 term                                                        │    │
│     │  formal_definition                                              │    │
│     │  simple_explanation                                             │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  3. misconception (if present) → Red/Pink box                               │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  ⚠️ Common Misconception                                        │    │
│     │  Wrong belief: {wrong_belief}                                   │    │
│     │  Why it's wrong: {why_wrong}                                    │    │
│     │  Correct: {correct_understanding}                               │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  4. example (if present) → Green box                                        │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  📗 Example                                                     │    │
│     │  {scenario}                                                     │    │
│     │  {explanation}                                                  │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  5. key_points → Bullet list with layout hints                              │
│                                                                             │
│  6. visual:                                                                 │
│     IF visual.url exists → Display image with lightbox                      │
│     ELSE → Display fallback: "💡 Visual: {fallback_description}"            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Point 11: Slide Rendering
```typescript
// Assertions:
- Misconception box shows all 3 fields populated (not empty placeholders)
- Example box shows scenario and explanation
- Images display (not fallback text) when visual.url exists
- Speaker notes available for audio generation
```

---

## 9. Sync Fallback Paths

### Fallback: Sync Curriculum Decomposition

```
When batch curriculum hasn't completed before video search:

search-youtube-content/index.ts
         │
         │ No teaching_units found, no pending batch job
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  curriculum-reasoning-agent/index.ts                                        │
│  - Called synchronously (blocks video search)                               │
│  - Uses enhanced UbD/Backward Design prompts                                │
│  - Model: gemini-3-pro-preview                                              │
│  - INSERT teaching_units directly                                           │
│  - Return to search-youtube-content                                         │
└─────────────────────────────────────────────────────────────────────────────┘

Trigger: ENABLE_SYNC_CURRICULUM_FALLBACK !== 'false' (default: enabled)
```

### Fallback: Sync Video Evaluation

```
When ENABLE_BATCH_EVALUATION=false:

search-youtube-content/index.ts
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  evaluate-content-batch/index.ts                                            │
│  - Called synchronously (inline with video search)                          │
│  - Uses enhanced Mayer's Principles prompts                                 │
│  - Model: gemini-2.5-flash                                                  │
│  - UPDATE content_matches with scores directly                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fallback: Sync Slide Generation (V3)

```
Direct slide generation without batch:

┌─────────────────────────────────────────────────────────────────────────────┐
│  generate-lecture-slides-v3/index.ts                                        │
│  - Called directly for single teaching unit                                 │
│  - Runs research grounding inline                                           │
│  - Generates slides with Gemini 3 Pro                                       │
│  - Generates images inline with Gemini Image                                │
│  - Saves complete slides with images in one call                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Database Schema

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `instructor_courses` | Course metadata | id, title, detected_domain, domain_config, syllabus_text |
| `modules` | Course modules | instructor_course_id, title, sequence_order |
| `learning_objectives` | Learning goals | text, bloom_level, decomposition_status, curriculum_batch_job_id |
| `teaching_units` | Micro-concepts | learning_objective_id, search_queries[], common_misconceptions[] |
| `content` | Video metadata | source, source_id, title, duration_seconds |
| `content_matches` | Video-LO links | ai_relevance_score, ai_recommendation, evaluation_batch_job_id |
| `batch_jobs` | Batch tracking | job_type, google_batch_id, status, request_mapping |
| `lecture_slides` | Slide content | slides (JSON), status, generation_phases |
| `research_cache` | Research caching | topic_hash, research_content, expires_at, hit_count |

### Batch Jobs Schema

```sql
CREATE TABLE batch_jobs (
  id UUID PRIMARY KEY,
  instructor_course_id UUID REFERENCES instructor_courses(id),
  google_batch_id TEXT NOT NULL,  -- Vertex AI job ID
  job_type TEXT CHECK (job_type IN ('slides', 'audio', 'assessment', 'curriculum', 'evaluation')),
  total_requests INTEGER,
  succeeded_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('preparing', 'researching', 'submitted', 'pending', 'processing', 'completed', 'partial', 'failed')),
  error_message TEXT,
  request_mapping JSONB,  -- Maps response index to entity IDs
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

### Research Cache Schema

```sql
CREATE TABLE research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_hash TEXT NOT NULL UNIQUE,  -- SHA-256 of normalized search terms
  search_terms TEXT NOT NULL,
  domain TEXT,
  research_content JSONB NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,  -- TTL: 7 days
  hit_count INTEGER DEFAULT 0
);
```

---

## 11. Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_BATCH_CURRICULUM` | `true` | Use Vertex AI batch for curriculum decomposition |
| `ENABLE_BATCH_EVALUATION` | `true` | Use Vertex AI batch for video evaluation |
| `ENABLE_SYNC_CURRICULUM_FALLBACK` | `true` | Allow sync fallback when batch not ready |
| `ENABLE_RESEARCH_CACHE` | `true` | Cache research grounding results (7-day TTL) |
| `ENABLE_BATCH_IMAGE_GENERATION` | `true` | Generate images asynchronously after slides |

All flags use consistent `!== 'false'` checking (enabled by default unless explicitly set to 'false').

### Setting Feature Flags

```bash
# Supabase Secrets
supabase secrets set ENABLE_BATCH_CURRICULUM=true
supabase secrets set ENABLE_BATCH_EVALUATION=true
supabase secrets set ENABLE_RESEARCH_CACHE=true
supabase secrets set ENABLE_BATCH_IMAGE_GENERATION=true

# To disable
supabase secrets set ENABLE_BATCH_CURRICULUM=false
```

---

## 12. Model Configuration

### Models Used

| Model ID | Purpose | Cost/1M tokens |
|----------|---------|----------------|
| `gemini-2.5-flash` | Domain analysis, Structure analysis, Research, Evaluation | $0.15 input |
| `gemini-2.5-flash-lite` | Fast text extraction, embeddings | $0.10 input |
| `gemini-3-pro-preview` | Curriculum decomposition, Slide generation (batch) | $2.00 input |
| `gemini-3-flash-preview` | Fast complex reasoning | $0.50 input |
| `gemini-3-pro-image-preview` | Image generation (sync and async batch) | $0.50 input |

### Model Configuration (ai-orchestrator.ts)

```typescript
export const MODEL_CONFIG = {
  GEMINI_FLASH: 'gemini-2.5-flash',
  GEMINI_FLASH_LITE: 'gemini-2.5-flash-lite',
  GEMINI_PRO: 'gemini-3-pro-preview',
  GEMINI_3_FLASH: 'gemini-3-flash-preview',
  GEMINI_IMAGE: 'gemini-3-pro-image-preview',
};
```

### Vertex AI Model Paths

```typescript
export const VERTEX_MODEL_PATHS = {
  GEMINI_FLASH: 'publishers/google/models/gemini-2.5-flash',
  GEMINI_PRO: 'publishers/google/models/gemini-3-pro-preview',
};
```

---

## 13. Unit Test Points

| # | Location | Test Assertion |
|---|----------|----------------|
| 1 | process-syllabus | LOs created with valid bloom_level, decomposition_status='not_started' |
| 2 | submit-batch-curriculum | batch_jobs created, google_batch_id updated from 'pending-*' |
| 3 | poll-batch-curriculum | Rejects 'pending-*' IDs, teaching_units created (3-8 per LO) |
| 4 | search-youtube-content | content_matches created with status='pending_evaluation' |
| 5 | submit-batch-evaluation | batch_jobs.job_type='evaluation', request_mapping populated |
| 6 | poll-batch-evaluation | Scores between 0-1, auto-approval for highly_recommended |
| 7 | submit-batch-slides | lecture_slides.status='preparing', prompts include all slide types |
| 8 | process-batch-research | Cache hit/miss logic, 7-day TTL, hit_count increments |
| 9 | poll-batch-status | Misconception/example content populated, triggers image generation |
| 10 | process-batch-images | Images uploaded to storage, URLs updated in slides |
| 11 | SlideRenderer | All content fields render, images display (not fallback text) |

### Test File Locations

```
supabase/functions/{function-name}/index.test.ts
src/components/slides/__tests__/SlideRenderer.test.tsx
```

---

## 14. Cost Analysis

### Per Course Estimate (26 LOs, 89 Teaching Units)

| Stage | Operation | Model | Cost |
|-------|-----------|-------|------|
| 1 | Text Extraction | gemini-2.5-flash-lite | $0.008 |
| 1 | Domain Analysis | gemini-2.5-flash | $0.003 |
| 1 | Structure Analysis | gemini-2.5-flash | $0.015 |
| 2 | Curriculum Decomposition | gemini-3-pro-preview (batch, 50% off) | $0.52 |
| 4 | Video Evaluation | gemini-2.5-flash (batch, 50% off) | $0.06 |
| 5 | Research Grounding | gemini-2.5-flash | $0.27 |
| 5 | Slide Generation | gemini-3-pro-preview (batch, 50% off) | $1.74 |
| 6 | Image Generation | gemini-3-pro-image-preview | $0.40 |
| **Total** | | | **~$3.02** |

### Savings from Batch Processing

| Metric | Sync Mode | Batch Mode | Savings |
|--------|-----------|------------|---------|
| Curriculum Decomposition | $1.04 | $0.52 | 50% |
| Video Evaluation | $0.12 | $0.06 | 50% |
| Slide Generation | $3.48 | $1.74 | 50% |
| **Per Course** | $4.64 | $2.32 | **$2.32 (50%)** |

---

## 15. Deployment Commands

### Deploy All Batch Functions

```bash
# Core batch functions
supabase functions deploy process-syllabus
supabase functions deploy submit-batch-curriculum
supabase functions deploy poll-batch-curriculum
supabase functions deploy search-youtube-content
supabase functions deploy submit-batch-evaluation
supabase functions deploy poll-batch-evaluation
supabase functions deploy submit-batch-slides
supabase functions deploy process-batch-research
supabase functions deploy poll-batch-status
supabase functions deploy process-batch-images

# Fallback/sync functions
supabase functions deploy curriculum-reasoning-agent
supabase functions deploy evaluate-content-batch
supabase functions deploy generate-lecture-slides-v3

# Apply migrations
supabase db push
```

### Verify Deployment

```bash
# Check function logs
supabase functions logs submit-batch-curriculum --tail
supabase functions logs poll-batch-status --tail

# Check batch job status
SELECT job_type, status, COUNT(*)
FROM batch_jobs
WHERE created_at > now() - interval '24 hours'
GROUP BY job_type, status;
```

---

## Appendix: Environment Variables

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
GOOGLE_CLOUD_API_KEY=xxx
GCP_PROJECT_ID=your-project
GCP_REGION=us-central1
GCP_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GCS_BUCKET_NAME=your-bucket
YOUTUBE_API_KEY=xxx

# Feature Flags
ENABLE_BATCH_CURRICULUM=true
ENABLE_BATCH_EVALUATION=true
ENABLE_SYNC_CURRICULUM_FALLBACK=true
ENABLE_RESEARCH_CACHE=true
ENABLE_BATCH_IMAGE_GENERATION=true
```

---

**END OF DOCUMENT**
