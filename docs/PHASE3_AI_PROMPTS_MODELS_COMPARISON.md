# Phase 3: AI Prompts, Models & Provider Comparison

> **Report Date:** 2026-03-26
> **Scope:** Every AI prompt, model, and provider used in both codebases

---

## 1. AI Provider Architecture

### `projectify-syllabus` - Single Provider

| Aspect | Value |
|--------|-------|
| **Gateway** | Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) |
| **Auth** | `LOVABLE_API_KEY` env var |
| **Model** | `google/gemini-2.5-flash` (parsing), `google/gemini-2.5-pro` (generation) |
| **Fallback** | Regex-based extraction (no AI fallback) |
| **Circuit Breaker** | Yes - `withAICircuit()` pattern |
| **Timeout** | `AI_GATEWAY_TIMEOUT_MS` configurable |
| **Cost Tracking** | None |
| **Rate Limiting** | HTTP response headers only |

### `syllabusstack` - Multi-Provider Router

| Aspect | Value |
|--------|-------|
| **Gateway** | OpenRouter (`https://openrouter.ai/api/v1`) |
| **Auth** | `OPENROUTER_API_KEY` (primary), `GOOGLE_API_KEY` (images), `EVOLINK_API_KEY` (budget images) |
| **Routing** | `unified-ai-client.ts` (1,391 LoC) routes all AI calls |
| **Fallbacks** | Automatic model fallbacks per task type |
| **Circuit Breaker** | No (relies on provider-level retries) |
| **Timeout** | Provider-level in OpenRouter client |
| **Cost Tracking** | `track-consumption` edge fn + `consumption_records` table |
| **Rate Limiting** | DB-backed per-user limits (`rate-limiter.ts`) |

---

## 2. Model Routing (syllabusstack)

| Task | Primary Model | Fallback Model | Provider Toggle |
|------|--------------|----------------|-----------------|
| Slide Content | `google/gemini-3-flash-preview` | `google/gemini-2.5-flash` | `BATCH_PROVIDER` (openrouter/vertex) |
| Image Generation | `google/gemini-3-pro-image-preview` | `google/gemini-2.5-flash-image` | `IMAGE_PROVIDER` (openrouter/google/evolink) |
| Research/Grounding | `perplexity/sonar-pro` | `perplexity/sonar` | N/A |
| Syllabus Parsing | `google/gemini-2.5-flash` | `google/gemini-flash-1.5` | N/A |
| Curriculum Reasoning | `deepseek/deepseek-r1` | `google/gemini-2.5-pro` | N/A |
| Fast Extraction | `google/gemini-2.5-flash-lite` | `openai/gpt-4o-mini` | N/A |
| Capstone Generation | `google/gemini-3-flash-preview` (PROFESSOR_AI) | `google/gemini-2.5-flash` | N/A |
| Audio Narration | Google Cloud TTS (not LLM) | N/A | N/A |

**projectify-syllabus uses only:** `google/gemini-2.5-flash` and `google/gemini-2.5-pro` via Lovable gateway.

---

## 3. Complete Prompt Inventory

### 3A. SHARED Prompts (exist in both, may differ)

#### Prompt 1: Project Generation System Prompt

**IDENTICAL in both repos.** The core system prompt is:

```
You are an elite experiential learning designer creating HIGH-VALUE, SPECIFIC project proposals.

ABSOLUTE REQUIREMENTS - FAILURE TO COMPLY WILL RESULT IN REJECTION:

1. FORBIDDEN GENERIC TERMS (Automatic Rejection):
   "research", "analyze", "synthesis", "investigate", "explore", "recommendations",
   "report", "memo", "presentation", "findings"
   Generic skills: "communication", "leadership", "teamwork", "critical thinking", "problem solving"

2. MANDATORY SPECIFICITY IN EVERY ELEMENT:
   Tasks: MUST include named framework/tool + quantified scope + specific data source
   Deliverables: MUST be named artifacts with format specified
   Skills: MUST be domain-specific technical/business skills EXTRACTED FROM tasks

3. EXTRACTION RULE - Skills MUST Mirror Tasks:
   "SWOT" -> "SWOT Strategic Analysis"
   "SQL" -> "SQL Database Querying"
   "Tableau" -> "Tableau Data Visualization"
   ...30+ mapping rules
```

#### Prompt 2: Project Generation User Prompt

**SIMILAR but syllabusstack has enhancements:**

| Element | `projectify-syllabus` | `syllabusstack` |
|---------|----------------------|-----------------|
| Bloom's Taxonomy tier | Not included | `bloomTierConstraint` section with Guided/Applied/Advanced |
| Subject-specific guidance | 5 domains (Engineering, CS, Business, Science, Math) | 5 domains (identical) |
| Specificity examples | 4 examples (Business-focused) | 8 examples (Business + Engineering + CS) |
| Output JSON structure | 7 tasks, 6 deliverables, 7 skills | 7 tasks, 6 deliverables, 7 skills (identical) |
| `faculty_expertise` field | Required in output | Not in output |
| `publication_opportunity` field | Required in output | Not in output |
| `company_needs` field | Required in output | Not in output |
| `company_description` field | Required in output | Not in output |

**Key difference:** syllabusstack adds **Bloom's Taxonomy tier** constraint:
```
PROJECT COMPLEXITY TIER: ${bloomTier.toUpperCase()}
Guided → Structured tasks with clear steps, templates, instructor checkpoints
Applied → Open-ended analysis requiring framework selection and justification
Advanced → Original research/creation with minimal scaffolding
```

#### Prompt 3: Syllabus Parsing

**SIGNIFICANTLY DIFFERENT:**

**projectify-syllabus** (`parse-syllabus/index.ts`):
- System: `"You are an expert at analyzing academic syllabi. Extract course information accurately."`
- Uses **tool calling** (function calling) with `extract_course_info` function schema
- Extracts: `title`, `level` (UG/MBA), `weeks`, `hrs_per_week`, `outcomes`, `artifacts`, `schedule`
- Fallback: Regex-based extraction
- Output: Stored in `course_profiles` table

**syllabusstack** (`analyze-syllabus/index.ts`):
- System: `MASTER_SYSTEM_PROMPT` + `SYLLABUS_EXTRACTION_PROMPT` (combined ~60 lines)
- Uses **structured generation** via `generateStructured()` with JSON schema
- Extracts: `capabilities` (with category, proficiency, evidence_type), `course_themes`, `tools_learned`, `course_title`, `course_code`, `semester`, `credits`
- No regex fallback - relies on AI model fallback chain
- Output: Stored in `courses` + `capabilities` + `capability_profiles` tables
- Also: Generates keyword vectors for similarity matching

**Critical difference:** projectify extracts **course structure** (outcomes, artifacts, schedule). syllabusstack extracts **marketable capabilities** (skills, proficiency, evidence). They serve different purposes.

---

### 3B. Prompts ONLY in `syllabusstack`

#### Prompt 4: MASTER_SYSTEM_PROMPT (used across all AI functions)
```
You are an expert career advisor who gives specific, honest advice to college students.

CORE PRINCIPLES:
1. NOTHING IS HARDCODED - analyze each situation fresh
2. BE SPECIFIC - reference actual courses, skills, and target job
3. BE HONEST - if a student is far from ready, say so
4. BE ACTIONABLE - every advice should be something doable
5. THINK LIKE AN EMPLOYER - what would make you hire this student?

OUTPUT FORMAT RULES:
- Capabilities: "Can do X"
- Gaps: "Cannot yet do X"
- Recommendations: include specific resources
```

#### Prompt 5: SYLLABUS_EXTRACTION_PROMPT
```
Extract marketable capabilities from course syllabus.
- Focus on DEMONSTRABLE skills
- Use industry terminology
- Rate proficiency: beginner/intermediate/advanced/expert
- Consider both hard and soft skills
- Map to evidence types (projects, tools, methodologies)
```

#### Prompt 6: CAPABILITY_ANALYSIS_PROMPT
```
Synthesize student capabilities from multiple courses.
- Combine related capabilities
- Identify strongest themes
- Note progression
- Identify unique combinations
```

#### Prompt 7: JOB_REQUIREMENTS_PROMPT
```
Analyze real-world job requirements.
- CRITICAL: deal-breakers
- IMPORTANT: strongly preferred
- NICE_TO_HAVE: differentiators
- Context by company type (Startup/Big Tech/Finance/Consulting)
- Focus on DAY ONE capabilities
```

#### Prompt 8: GAP_ANALYSIS_PROMPT (in gap-analysis edge fn)
- Compares student capabilities vs job requirements
- Identifies specific gaps with severity ratings
- Generates actionable closing recommendations

#### Prompt 9: RECOMMENDATION_PROMPT (in generate-recommendations edge fn)
- Generates specific learning recommendations
- Links to courses, certifications, projects
- Prioritizes by impact on employability

#### Prompt 10: CURRICULUM_PROMPT (in generate-curriculum edge fn)
- Generates personalized learning paths
- Backward design from career goals
- Sequential skill building

#### Prompt 11: ASSESSMENT_GENERATION_PROMPT (in generate-assessment-questions edge fn)
- Generates Bloom's taxonomy-aligned questions
- Multiple question types (MCQ, short answer, scenario-based)
- Tied to specific learning objectives

#### Prompt 12: SLIDE_PROMPTS (slide-prompts.ts - 27,753 LoC)
- Entire library of prompts for lecture slide generation
- Includes: content structure, visual design, speaker notes
- Domain-specific templates for 10+ academic fields
- Image generation prompts for diagrams and illustrations

#### Prompt 13: CONTENT_ASSISTANT_PROMPT (in content-assistant-chat edge fn)
- AI chat assistant for course content creation
- Context-aware responses about course material
- Helps instructors refine content

#### Prompt 14: MICRO_CHECK_PROMPT (in generate-micro-checks edge fn)
- Quick comprehension checks for students
- Tied to specific content sections
- Immediate feedback generation

#### Prompt 15: CMM (Conversational Mastery Method) NARRATOR PROMPT (`_shared/ai-narrator.ts`, 152+ lines)
Used for generating natural lecture audio narration:
```
You are a tutor modeled on a master educator's teaching philosophy and delivery style.
Your goal is not to make students pass exams, but to make them *understand* — deeply,
structurally, and in a way they can apply to new situations.

YOUR TEACHING METHOD: THE ZERO-TO-EXPERT ARC
1. START FROM ZERO. Never assume prior knowledge.
2. BUILD BRICK BY BRICK. Each new idea connects to the previous one.
3. LAYER COMPLEXITY GRADUALLY. Once the foundation is solid...
4. END WITH MASTERY-LEVEL SYNTHESIS.

ABSOLUTE RULES:
- You are delivering a CONTINUOUS MONOLOGUE. There is NO audience responding.
- NEVER say "thank you for that question," "great point," etc.
- START each slide by diving directly into the content.
- Rhetorical questions encouraged but NEVER answer as if someone responded.
- Each slide flows from the previous one via 100-word rolling tail.
```

#### Prompt 16: ASSESSMENT QUESTION GENERATION (`generate-assessment-questions/index.ts`)
```
Expert assessment designer creating questions that test deep understanding.
- Question mix: 2-3 MCQ conceptual, 1-2 scenario MCQ, 1-2 short_answer, 0-1 true_false
- Difficulty: 2 easy, 2-3 medium, 1-2 hard
- Bloom's coverage: easy=remember/understand, medium=apply/analyze, hard=evaluate/create
- MCQ: plausible distractors based on common misconceptions
- Short answer: full model answer (2-4 sentences) + required_keywords
- 5-7 questions per learning objective
```

#### Prompt 17: CURRICULUM REASONING AGENT (`curriculum-reasoning-agent/index.ts`)
Uses Gemini 3 Pro with **Extended Thinking** + **Google Search** integration:
```
Expert curriculum designer using Understanding by Design (UbD) framework.
BACKWARD DESIGN (Wiggins & McTighe):
1. START WITH THE END: What should students be able to DO?
2. DETERMINE EVIDENCE: How will we know they've achieved it?
3. DESIGN LEARNING: Work backward to identify discrete micro-concepts.

Output: 3-5 teaching units with:
- search_queries (5 highly specific), required_concepts, avoid_terms
- target_video_type: explainer|tutorial|case_study|worked_example|lecture|demonstration
- common_misconceptions, prerequisites, enables
```
Model: `gemini-3-pro-preview` with `thinkingLevel: "high"`, `maxOutputTokens: 65536`

---

### 3C. Prompts ONLY in `projectify-syllabus`

#### Prompt 18: Apollo Filter Generation (`apollo-provider.ts` -> `generateFilters`)
- **Model:** Gemini 2.5 Flash, **Temperature:** 0.1
- Purpose: Auto-generate Apollo.io search parameters from course context
- System: `"You are an AI that analyzes course syllabi and generates Apollo.io search filters."`
- Outputs: locations, keyword tags, job titles, employee ranges for Apollo API

#### Prompt 19: Company Validation Prompt (in company-validation-service.ts)
- AI validates company-course fit before project generation
- Uses semantic matching with Gemini embeddings
- Returns confidence score + rejection reason

#### Prompt 16: Semantic Validation V2 (in semantic-validation-v2-service.ts)
- Enhanced semantic matching for company-skill alignment
- Uses Lightcast embeddings for skill normalization

---

## 4. Company Discovery Signal System

Both repos use the same 4-signal scoring system, but implementations differ slightly:

### Signal Architecture (shared)
```
Signal Orchestrator
├── Job Skills Signal      (weight: varies)
├── Market Intel Signal    (weight: varies)
├── Department Fit Signal  (weight: varies)
└── Contact Quality Signal (weight: varies)
```

### Signal Weights

**projectify-syllabus** (`signal-types.ts`):
```typescript
SIGNAL_WEIGHTS = {
  skill_match: 0.35,
  market_intel: 0.25,
  department_fit: 0.25,
  contact_quality: 0.15,
}
```

**syllabusstack** (`capstone/signal-types.ts`):
Same weights (ported directly).

### Signal Calculation Differences

| Signal | `projectify-syllabus` | `syllabusstack` |
|--------|----------------------|-----------------|
| Job Skills | Uses Lightcast embeddings for skill matching | Same (ported) |
| Market Intel | Apollo data + hiring activity | Same (ported) |
| Department Fit | AI-based department matching | Same (ported) |
| Contact Quality | Contact completeness scoring | Same (ported) |
| Hiring Signal | **EXISTS** (hiring-signal.ts) | **Not ported** (may be merged into Market Intel) |

---

## 5. AI Client Implementation Comparison

### projectify-syllabus: Direct fetch to Lovable Gateway

```typescript
// generation-service.ts
const response = await fetchWithTimeout(
  "https://ai.gateway.lovable.dev/v1/chat/completions",
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    })
  },
  AI_GATEWAY_TIMEOUT_MS
);
```

### syllabusstack: Unified AI Client with provider routing

```typescript
// capstone/generation-service.ts
import { generateText, MODELS } from '../unified-ai-client.ts';

const result = await generateText({
  prompt,
  systemPrompt,
  model: MODELS.PROFESSOR_AI,  // google/gemini-3-flash-preview
  temperature: 0.4,
  maxTokens: 5000,
});
```

**Key differences:**
1. syllabusstack uses a **newer model** (gemini-3-flash vs gemini-2.5-flash)
2. syllabusstack has **automatic fallbacks** configured per model
3. syllabusstack routes through **OpenRouter** (300+ model access) vs Lovable (limited)
4. syllabusstack tracks **cost per AI call** in `consumption_records`

---

## 6. Environment Variables Comparison

### projectify-syllabus
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
LOVABLE_API_KEY                    # Single AI gateway key
APOLLO_API_KEY                     # Company discovery
LIGHTCAST_CLIENT_ID/SECRET         # Skill normalization
```

### syllabusstack
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY                 # Primary AI gateway
GOOGLE_API_KEY                     # Google direct (images)
EVOLINK_API_KEY                    # Budget image generation
VERTEX_AI_PROJECT_ID               # Vertex AI batch processing
VERTEX_AI_REGION                   # Vertex AI region
VERTEX_AI_SERVICE_ACCOUNT          # Vertex AI auth
IMAGE_PROVIDER                     # Toggle: openrouter|google|evolink
BATCH_PROVIDER                     # Toggle: openrouter|vertex
APOLLO_API_KEY                     # Company discovery
STRIPE_SECRET_KEY                  # Billing
STRIPE_WEBHOOK_SECRET              # Stripe webhooks
```

---

## 7. Why Results Differ

The different AI results between the two repos stem from:

1. **Different models**: gemini-2.5-flash (projectify) vs gemini-3-flash-preview (syllabusstack)
2. **Different prompt structure**: projectify embeds prompts inline; syllabusstack uses centralized prompts with Bloom's taxonomy tiers
3. **Different extraction focus**: projectify extracts course structure (outcomes, artifacts); syllabusstack extracts marketable capabilities
4. **Different temperature settings**: projectify uses default; syllabusstack uses 0.4 (more deterministic)
5. **Different context**: syllabusstack passes `bloomTier` constraint; projectify does not
6. **Missing fields**: projectify returns `faculty_expertise` and `publication_opportunity`; syllabusstack does not

---

**Next: Phase 4 - Capstone Project Generation Variance**
