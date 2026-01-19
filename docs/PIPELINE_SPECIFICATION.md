# SyllabusStack AI Pipeline - Complete Technical Specification

## Document Purpose
This document provides a verified, comprehensive specification of the SyllabusStack AI pipeline from syllabus upload to course publishing. It serves as the source of truth for frontend development, backend optimization, and AI agent coordination.

**Last Verified:** 2026-01-19
**Branch:** `claude/vertex-ai-batch-optimization-IHqY4`

---

## Executive Summary

### Business Objective
Transform any instructor's syllabus into a complete, publication-ready course with:
- Structured curriculum (modules → learning objectives → teaching units)
- Professor-quality lecture slides with verified research citations
- AI-generated educational visuals
- Speaker notes for video narration

### Key Principle: NO HARDCODING
```
"NOTHING IS HARDCODED - You analyze each situation fresh based on provided context"
```
The AI must reason like a top professor for THAT specific course, not apply generic templates.

---

## Current Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     COMPLETE PIPELINE FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: SYLLABUS UPLOAD
┌──────────────────┐
│   Instructor     │
│   Uploads PDF/   │
│   DOCX/Image     │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    process-syllabus                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 1. Extract text (Gemini 2.0 Flash for PDF, local for DOCX)  │ │
│  │ 2. Domain Analysis (Gemini 2.5 Flash)                       │ │
│  │    → Generate: trusted_sites, citation_style, visual_templates│
│  │ 3. Structure Analysis (Gemini 2.5 Flash)                    │ │
│  │    → Extract: modules, learning_objectives, Bloom levels    │ │
│  │ 4. Store in database                                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼ (fire-and-forget trigger)

PHASE 2: CURRICULUM DECOMPOSITION
┌──────────────────────────────────────────────────────────────────┐
│                 submit-batch-curriculum                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ For each Learning Objective:                                │ │
│  │ 1. Build prompt with course/module/LO context              │ │
│  │ 2. Create JSONL batch request                               │ │
│  │ 3. Upload to GCS                                            │ │
│  │ 4. Submit to Vertex AI (Gemini 3 Pro, 50% batch discount)  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼ (async, 5-30 min)
┌──────────────────────────────────────────────────────────────────┐
│                 poll-batch-curriculum                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ When Vertex AI completes:                                   │ │
│  │ 1. Download JSONL results from GCS                         │ │
│  │ 2. Parse teaching_units (3-8 per LO):                      │ │
│  │    - title, description, what_to_teach                      │ │
│  │    - why_this_matters, how_to_teach                        │ │
│  │    - common_misconceptions, prerequisites, enables          │ │
│  │    - search_queries, required_concepts, avoid_terms         │ │
│  │ 3. Insert into database                                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼

PHASE 3: SLIDE GENERATION
┌──────────────────────────────────────────────────────────────────┐
│              generate-lecture-slides-v3 (per teaching unit)       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ STEP 1: Fetch Complete Context                              │ │
│  │ - Teaching unit + sibling units (sequence context)          │ │
│  │ - Learning objective (Bloom level, core concept)            │ │
│  │ - Module (title, description)                               │ │
│  │ - Course (domain, domain_config, syllabus_text)             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ STEP 2: Research Agent (Gemini 2.5 Flash + Google Search)   │ │
│  │ - Query domain-specific trusted sites                       │ │
│  │ - Find verified definitions and facts                       │ │
│  │ - Find 2-3 specific examples with real data                 │ │
│  │ - Identify common misconceptions                            │ │
│  │ - Describe visual frameworks (e.g., Porter's Five Forces)   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ STEP 3: Professor AI (Gemini 3 Pro)                         │ │
│  │ - Build lecture brief with research grounding               │ │
│  │ - Generate 5-15 slides based on Bloom level                 │ │
│  │ - Each slide: content, layout hints, visual directive,      │ │
│  │   speaker notes (200-300 words), pedagogy metadata          │ │
│  │ - Citations marked as [Source N] in content                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ STEP 4: Visual AI (Gemini 3 Pro Image, parallel)            │ │
│  │ - Generate educational diagrams/illustrations               │ │
│  │ - Upload to Supabase Storage                                │ │
│  │ - Link URLs to slides                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    lecture_slides (DB)                            │
│  - slides[] with full content, visuals, speaker notes            │
│  - quality_score (80-95)                                         │
│  - status: ready → published                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Instructor's course (root entity)
instructor_courses
├── id (uuid, PK)
├── title (text)
├── code (text)  -- "CS 101", "MGT 471"
├── instructor_id (uuid, FK → auth.users)
├── syllabus_text (text)  -- Extracted full text
├── detected_domain (text)  -- "strategic management", "organic chemistry"
├── domain_config (jsonb)  -- AI-generated research configuration
│   ├── domain: string
│   ├── trusted_sites: string[]
│   ├── citation_style: string
│   ├── avoid_sources: string[]
│   ├── visual_templates: string[]
│   ├── academic_level: string
│   └── terminology_preferences: string[]
└── created_at, updated_at

-- Course modules (chapters/units)
modules
├── id (uuid, PK)
├── instructor_course_id (uuid, FK)
├── title (text)
├── description (text)
├── sequence_order (int)
└── created_at

-- Learning objectives (what students will learn)
learning_objectives
├── id (uuid, PK)
├── instructor_course_id (uuid, FK)
├── module_id (uuid, FK)
├── text (text)  -- Full LO text
├── core_concept (text)  -- Key concept
├── bloom_level (text)  -- remember/understand/apply/analyze/evaluate/create
├── action_verb (text)  -- "explain", "analyze", "create"
├── decomposition_status (text)  -- not_started/in_progress/completed
├── curriculum_batch_job_id (uuid, FK → batch_jobs)
└── created_at

-- Teaching units (micro-concepts, 3-8 per LO)
teaching_units
├── id (uuid, PK)
├── learning_objective_id (uuid, FK)
├── sequence_order (int)
├── title (text)
├── description (text)
├── what_to_teach (text)
├── why_this_matters (text)
├── how_to_teach (text)
├── common_misconceptions (text[])
├── prerequisites (text[])
├── enables (text[])
├── target_video_type (text)  -- explainer/tutorial/case_study/demonstration
├── target_duration_minutes (int)
├── search_queries (text[])
├── required_concepts (text[])
├── avoid_terms (text[])
└── created_at

-- Lecture slides (generated content)
lecture_slides
├── id (uuid, PK)
├── teaching_unit_id (uuid, FK)
├── slides (jsonb[])  -- Array of slide objects
│   ├── order: int
│   ├── type: string  -- title/hook/definition/example/misconception/etc.
│   ├── title: string
│   ├── content: object  -- main_text, key_points, definition, example, misconception
│   ├── visual_directive: object  -- type, description, elements, style
│   ├── visual: string  -- Image URL after generation
│   ├── speaker_notes: string  -- 200-300 words
│   ├── pedagogy: object  -- purpose, bloom_action, transition_to_next
│   └── estimated_seconds: int
├── status (text)  -- preparing/ready/published
├── quality_score (int)  -- 0-100
├── estimated_duration (int)  -- Total minutes
├── batch_job_id (uuid, FK → batch_jobs)
├── research_context (jsonb)  -- Grounded content for citations
└── created_at

-- Batch job tracking
batch_jobs
├── id (uuid, PK)
├── job_type (text)  -- curriculum/slides/evaluation
├── google_batch_id (text)  -- Vertex AI job ID
├── openai_batch_id (text)  -- For OpenAI Batch API (NEW)
├── provider (text)  -- vertex_ai/openai (NEW)
├── status (text)  -- preparing/submitted/processing/completed/partial/failed
├── total_requests (int)
├── succeeded_count (int)
├── failed_count (int)
├── request_mapping (jsonb)  -- Maps request keys to entity IDs
├── gcs_input_uri (text)
├── gcs_output_uri (text)
├── created_at
└── completed_at
```

---

## Core AI Prompts (Exact Text)

### 1. MASTER SYSTEM PROMPT
```
You are an expert career advisor who gives specific, honest advice to college students.

CORE PRINCIPLES:
1. NOTHING IS HARDCODED - You analyze each situation fresh based on provided context
2. BE SPECIFIC - Never give generic advice. Always reference the student's actual courses, skills, and target job
3. BE HONEST - If a student is far from ready, say so. False hope is cruel
4. BE ACTIONABLE - Every piece of advice should be something the student can actually do
5. THINK LIKE AN EMPLOYER - What would actually make you hire this student?

OUTPUT FORMAT RULES:
- All capabilities should be phrased as "Can do X" (e.g., "Can build REST APIs", "Can analyze data with Python")
- All gaps should be phrased as "Cannot yet do X" or "Has not demonstrated X"
- Recommendations should include specific resources, not generic categories
```

### 2. CURRICULUM DECOMPOSITION PROMPT
```
You are an expert curriculum designer with deep expertise in pedagogical sequencing, instructional design, and Bloom's Taxonomy. Your task is to decompose high-level learning objectives into teachable micro-concepts that can be taught through individual videos.

CRITICAL RULES:
1. Each teaching unit should represent ONE focused concept that can be taught in a single 5-15 minute video
2. Units must be ordered by prerequisite dependencies - foundational concepts FIRST
3. Search queries must be HIGHLY SPECIFIC to find the exact teaching content needed
4. Think about what a student ACTUALLY needs to learn to achieve the learning objective
5. Generate 3-8 teaching units per learning objective based on complexity

OUTPUT FORMAT: Return valid JSON only, no markdown code blocks or explanations outside the JSON.
```

**User Prompt Template:**
```
TASK: Decompose this learning objective into 3-8 teachable micro-concepts.

LEARNING OBJECTIVE:
"${lo.text}"
Core Concept: ${lo.core_concept}
Bloom's Level: ${lo.bloom_level}
Expected Duration: ${lo.expected_duration_minutes} minutes

CONTEXT:
Course: ${course.title}
Course Description: ${course.description}
Domain: ${course.detected_domain}
Module: ${module.title}
Module Description: ${module.description}
Syllabus Context (first 3000 chars): ${course.syllabus_text.substring(0, 3000)}

REQUIRED OUTPUT FORMAT (JSON):
{
  "reasoning_chain": "Step-by-step explanation of how you decomposed this objective",
  "domain_context": "The specific academic/professional field this belongs to",
  "total_estimated_time_minutes": <number>,
  "teaching_units": [
    {
      "sequence_order": 1,
      "title": "Clear, specific title for this micro-concept",
      "description": "2-3 sentence description of what this unit covers",
      "what_to_teach": "Specific knowledge or skill to convey",
      "why_this_matters": "Connection to the overall learning objective",
      "how_to_teach": "Recommended pedagogical approach",
      "common_misconceptions": ["misconception 1", "misconception 2"],
      "prerequisites": ["concept A", "concept B"],
      "enables": ["concept X", "concept Y"],
      "target_video_type": "explainer|tutorial|case_study|worked_example|lecture|demonstration",
      "target_duration_minutes": <5-15>,
      "search_queries": ["specific query 1", "specific query 2", ...],
      "required_concepts": ["key term 1", "key term 2"],
      "avoid_terms": ["ambiguous term", "outdated term"]
    }
  ]
}
```

### 3. RESEARCH AGENT PROMPT
```
You are a research assistant gathering verified information for a ${academic_level}-level lecture.

TOPIC: ${context.title}
DOMAIN: ${domain}
WHAT TO TEACH: ${context.what_to_teach}

REQUIRED CONCEPTS TO RESEARCH:
${required_concepts.map(c => `- ${c}`).join('\n')}

RESEARCH REQUIREMENTS:
1. Find the CORE DEFINITION of "${context.title}" from authoritative sources
2. Find 2-3 SPECIFIC EXAMPLES or case studies with real data, names, dates
3. Find any COMMON MISCONCEPTIONS and their corrections
4. If this involves a framework or model, describe its visual structure exactly
5. Find recommended readings or resources students should explore

SEARCH STRATEGY:
- Prioritize sources from: ${trusted_sites.join(', ')}
- Use search queries like: "${required_concepts[0]} site:hbr.org OR site:.edu"
- AVOID: ${avoid_sources.join(', ')}

REQUIRED OUTPUT FORMAT (JSON only, no markdown):
{
  "topic": "${context.title}",
  "grounded_content": [
    {
      "claim": "Verified factual statement with specific data",
      "source_url": "URL from search results",
      "source_title": "Source name/publication",
      "confidence": 0.95
    }
  ],
  "recommended_reading": [
    {
      "title": "Resource title",
      "url": "URL",
      "type": "Academic|Industry|Case Study|Documentation"
    }
  ],
  "visual_descriptions": [
    {
      "framework_name": "e.g., Porter's Five Forces",
      "description": "Text description of the visual structure",
      "elements": ["Element 1", "Element 2", "Element 3"]
    }
  ]
}
```

### 4. PROFESSOR AI SYSTEM PROMPT (Full)
```
You are an expert university professor creating comprehensive, self-contained lecture slides. You have decades of teaching experience, deep subject matter expertise, and mastery of evidence-based pedagogy.

YOUR MISSION:
Create a complete slide deck that enables DEEP LEARNING. Every slide must provide substantive, textbook-quality content that students can study independently. NO superficial bullet points or vague phrases—only thorough, academically rigorous explanations.

CORE TEACHING PHILOSOPHY:
- Write as if this is the student's PRIMARY learning resource (not supplementary)
- Every concept deserves a proper textbook-style definition followed by detailed explanation
- Abstract ideas must be grounded in concrete, real-world examples with verifiable data
- Build understanding step-by-step, never assuming the student will "figure it out"
- Anticipate confusion and address it proactively

PEDAGOGICAL STRUCTURE:
1. ACTIVATE prior knowledge (connect explicitly to prerequisites they've learned)
2. HOOK with real-world relevance (use specific statistics, case studies, or current events)
3. DEFINE every new term with:
   a) Formal academic definition (as found in authoritative textbooks)
   b) Plain-language explanation of what this means in practice
   c) Why this concept matters in the field
4. EXPLAIN the underlying reasoning (not just WHAT, but WHY and HOW)
5. ILLUSTRATE with concrete examples that include:
   a) Specific real-world scenarios with actual data when possible
   b) Step-by-step walkthrough of application
   c) Connection back to the abstract concept
6. ADDRESS misconceptions explicitly—name the wrong belief, explain why it's wrong, provide the correct understanding
7. SYNTHESIZE by connecting concepts to each other and the bigger picture
8. PREVIEW upcoming content to build anticipation and show learning progression

SLIDE TYPES:
- title: Opening that hooks attention with real-world relevance
- hook: Why students should care—use statistics, trends, career implications
- recap: Connect to prerequisites with specific callbacks to prior learning
- definition: COMPREHENSIVE treatment—formal definition + explanation + significance + example
- explanation: Detailed conceptual exploration with reasoning
- example: Rich, detailed real-world application with specific data
- demonstration: Step-by-step walkthrough with explicit reasoning
- process: Multi-step procedures with why each step matters
- misconception: State wrong belief, explain why wrong, provide correct understanding
- practice: Guided mental exercise with thinking prompts
- synthesis: Connect multiple concepts, show relationships
- summary: Consolidate key learning points with actionable takeaways
- preview: Foreshadow next topics, create anticipation

CONTENT DEPTH REQUIREMENTS:

1. main_text: 3-4 substantive sentences that TEACH, not tease. Include:
   - Core concept or principle being taught
   - Why it matters or how it applies
   - Connection to broader context or real-world implications

2. key_points: 4-5 detailed bullet points where each point:
   - Makes a complete, educational statement (not fragments)
   - Explains the WHY behind the WHAT
   - Includes specific details, data, or examples where relevant

   BAD: "Important for analysis"
   GOOD: "Critical for data analysis because it reveals patterns that would be invisible in raw numbers—for instance, identifying that 80% of customer complaints come from just 20% of product categories enables targeted improvement efforts"

3. speaker_notes: 200-300 words of natural, conversational lecture narration that:
   - Sounds like a professor actually speaking to students
   - Adds context, anecdotes, and explanatory depth beyond the slides
   - Anticipates questions students might have
   - Provides additional examples or clarifications

MANDATORY COVERAGE:
- Every common_misconception from the brief MUST have a dedicated slide
- Every required_concept MUST be formally defined before use
- Prerequisites must be explicitly referenced in the recap
- The enables/next topics must be mentioned in the preview slide

RAG (RETRIEVAL-AUGMENTED GENERATION) RULES:
When a "RESEARCH GROUNDING" section is provided:

1. CITATION MANDATE:
   - You MUST use the verified facts from the research grounding section
   - Every slide that uses a grounded fact must include [Source N] in the content

2. NO HALLUCINATION RULE:
   - If the research does not contain a specific statistic, DO NOT invent one
   - Use phrases like "Research indicates..." or "According to established frameworks..."
   - Never fabricate case studies, dates, or numerical data

3. SOURCE ATTRIBUTION:
   - For definition slides: Use the exact definition from research, cite source
   - For example slides: Use real cases from research, or clearly mark as "Illustrative example"

QUALITY STANDARDS:
- NO vague phrases like "important for business"—be SPECIFIC
- NO unexplained jargon—every technical term gets a definition
- NO orphaned concepts—everything connects to something known
- NO abstract-only explanations—always ground in concrete examples
- NO filler content—every sentence must teach something
```

---

## OpenRouter Integration Changes

### Why OpenRouter?

| Before (Direct Google/OpenAI) | After (OpenRouter) |
|------------------------------|-------------------|
| 2 API formats (Google + OpenAI) | 1 unified API format |
| No automatic fallbacks | Auto-fallback to backup models |
| Hard-coded provider | Switch models by config |
| Multiple API keys | Single API key |
| Manual error handling | Response healing built-in |

### Code Changes Required

#### File: `supabase/functions/_shared/openrouter-client.ts` (NEW)
```typescript
// Already created - provides unified AI client
export const MODELS = {
  REASONING: 'openai/gpt-4.1',           // Complex: curriculum, lectures
  FAST: 'openai/gpt-4o-mini',            // Simple: evaluation, extraction
  GEMINI_FLASH: 'google/gemini-2.5-flash', // When Google-specific needed
  AUTO: 'openrouter/auto',               // Let OpenRouter decide
};

export async function callOpenRouter(options) { ... }
export async function simpleCompletion(model, systemPrompt, userPrompt, options) { ... }
export async function functionCall<T>(model, systemPrompt, userPrompt, schema, options) { ... }
```

#### File Changes Summary

| File | Current Model | New Model | Change Type |
|------|--------------|-----------|-------------|
| `process-syllabus/index.ts` | gemini-2.5-flash | MODELS.FAST | Replace fetch |
| `submit-batch-curriculum/index.ts` | gemini-3-pro-preview | MODELS.REASONING | Replace batch logic |
| `generate-lecture-slides-v3/index.ts` | gemini-3-pro-preview | MODELS.REASONING | Replace callGoogleAI |
| `analyze-syllabus/index.ts` | gemini-2.5-flash | MODELS.FAST | Replace fetch |
| `gap-analysis/index.ts` | gemini-2.5-flash | MODELS.FAST | Replace fetch |
| `generate-recommendations/index.ts` | gemini-2.5-flash | MODELS.FAST | Replace fetch |
| `evaluate-content-batch/index.ts` | gemini-2.5-flash | MODELS.FAST | Replace fetch |
| `curriculum-reasoning-agent/index.ts` | gemini-3-pro-preview | MODELS.REASONING | Replace fetch |

#### Files That Stay on Google (No Change)
| File | Reason |
|------|--------|
| `generate-lecture-slides-v3/index.ts` (Research Agent) | Uses `tools: [{googleSearch: {}}]` - no OpenRouter equivalent |
| `generate-lecture-slides-v3/index.ts` (Image Gen) | Uses `gemini-3-pro-image-preview` - native image generation |
| `process-batch-images/index.ts` | Native image generation |

### Example Diff: `analyze-syllabus/index.ts`

```diff
- const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
+ import { functionCall, MODELS, convertSchemaToTool } from "../_shared/openrouter-client.ts";

// ...

- const url = `${GOOGLE_API_BASE}/models/gemini-2.5-flash:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;
- const response = await fetch(url, {
-   method: "POST",
-   headers: { "Content-Type": "application/json" },
-   body: JSON.stringify({
-     contents: [{ role: "user", parts: [{ text: userContent }] }],
-     systemInstruction: { parts: [{ text: systemPrompt }] },
-     tools: [{ functionDeclarations: [SYLLABUS_EXTRACTION_SCHEMA] }],
-     toolConfig: { functionCallingConfig: { mode: "ANY" } }
-   }),
- });
-
- const data = await response.json();
- const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
- const extractedData = functionCall?.args;

+ const extractedData = await functionCall<ExtractedSyllabusData>(
+   MODELS.FAST,
+   systemPrompt,
+   userContent,
+   SYLLABUS_EXTRACTION_SCHEMA,
+   { fallbacks: [MODELS.GEMINI_FLASH] }
+ );
```

---

## Environment Variables

### Required (Supabase Dashboard → Edge Functions → Secrets)

| Variable | Purpose | How to Get |
|----------|---------|-----------|
| `OPENROUTER_API_KEY` | **NEW** - Unified AI access | https://openrouter.ai |
| `GOOGLE_CLOUD_API_KEY` | Image gen + Research grounding | GCP Console |
| `GCP_SERVICE_ACCOUNT_KEY` | GCS for batch files | GCP Console |
| `GCP_PROJECT_ID` | Vertex AI project | GCP Console |

### Optional (for gradual rollout)
```
AI_PROVIDER=openrouter   # or 'google' to rollback
```

---

## Quality Metrics

### Slide Quality Scoring
```typescript
let score = 70;  // Base: slides generated

// Content depth (aligned with 200-400 word speaker notes from prompt)
if (avgSpeakerNotesLength > 200) score += 5;
if (avgSpeakerNotesLength > 350) score += 5;  // Bonus for hitting upper range
if (hasMisconceptionSlides) score += 5;
if (hasDefinitionBlocks) score += 5;

// Visual richness
if (imagesGenerated >= 3) score += 10;
```

### Bloom Level → Slide Count
| Bloom Level | Target Slides | Emphasis |
|-------------|--------------|----------|
| Remember | 5-8 | Definitions, key facts, memorable examples |
| Understand | 8-10 | Explanations, reasoning, cause-effect |
| Apply | 10-12 | Worked examples, demonstrations |
| Analyze | 10-12 | Compare/contrast, relationships |
| Evaluate | 12-15 | Criteria, pros/cons, critical assessment |
| Create | 12-15 | Design processes, synthesis |

---

## API Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/process-syllabus` | POST | Upload & analyze syllabus | `{ modules[], learning_objectives[] }` |
| `/submit-batch-curriculum` | POST | Start curriculum decomposition | `{ batch_job_id, status }` |
| `/poll-batch-curriculum` | POST | Check/download curriculum | `{ status, teaching_units_created }` |
| `/generate-lecture-slides-v3` | POST | Generate slides (single) | `{ slideId, slideCount, visualCount }` |
| `/submit-batch-slides` | POST | Start batch slide generation | `{ batch_job_id }` |
| `/process-batch-research` | POST | Run research + submit batch | `{ status }` |
| `/poll-batch-status` | POST | Check batch progress | `{ status, completed, failed }` |
| `/process-batch-images` | POST | Generate images async | `{ images_generated }` |

---

## Frontend Integration Points

### Real-time Status Updates
```typescript
// Subscribe to batch_jobs changes
const subscription = supabase
  .channel('batch-progress')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'batch_jobs',
    filter: `id=eq.${batchJobId}`
  }, (payload) => {
    updateProgress(payload.new.succeeded_count, payload.new.total_requests);
  })
  .subscribe();
```

### Slide Rendering
Slides array structure enables adaptive rendering:
```typescript
interface Slide {
  order: number;
  type: 'title' | 'definition' | 'example' | 'misconception' | ...;
  title: string;
  content: {
    main_text: string;
    main_text_layout?: LayoutHint;
    key_points?: string[];
    definition?: { term, formal_definition, simple_explanation };
    example?: { scenario, walkthrough, connection_to_concept };
    misconception?: { wrong_belief, why_wrong, correct_understanding };
  };
  visual_directive: { type, description, elements, style };
  visual?: string;  // URL after image generation
  speaker_notes: string;
  estimated_seconds: number;
}
```

---

## Deployment Checklist

### Before Deployment
- [ ] Add `OPENROUTER_API_KEY` to Supabase secrets
- [ ] Add $20 OpenRouter credits
- [ ] Verify `GOOGLE_CLOUD_API_KEY` still works (for image gen)

### Deploy Sequence
1. Deploy `openrouter-client.ts` (shared utility)
2. Deploy low-risk functions first: `evaluate-content-batch`, `curriculum-reasoning-agent`
3. Test with single course
4. Deploy remaining sync functions
5. Deploy batch functions last

### Rollback
Set `AI_PROVIDER=google` in Supabase secrets → Redeploy

---

## Summary

This pipeline transforms a syllabus into a complete course by:

1. **Understanding the domain** (AI-generated domain_config)
2. **Structuring the curriculum** (modules → LOs → teaching units)
3. **Researching each topic** (Google Search grounding for verified facts)
4. **Generating professor-quality lectures** (comprehensive slides with citations)
5. **Creating educational visuals** (AI-generated diagrams)

The OpenRouter integration simplifies this by providing:
- **One API** for all providers
- **Automatic fallbacks** for reliability
- **Consistent quality** across batch and sync operations
- **Easy model switching** without code changes

The system is designed to reason like a top professor for THAT specific course, not apply generic templates. Every output is grounded in the actual syllabus content, domain context, and verified research.
