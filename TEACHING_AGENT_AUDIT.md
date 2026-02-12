# Teaching Agent Audit: Blueprint vs. Codebase Implementation

## Executive Summary

The "Conversational Mastery Method (CMM)" blueprint **is** implemented in the codebase, but not as a single monolithic agent. The philosophy is **distributed across four specialized agents**, each handling a different phase of the educational pipeline. The implementation also **compresses** the ~2,000-word blueprint system prompt into a ~400-word operational version, and makes one fundamental architectural change: the blueprint describes an **interactive tutor** while the codebase implements a **one-way lecture monologue**.

---

## 1. WHERE the Blueprint Is Implemented

### 1.1 CMM Narrator — Primary Implementation

**File:** `supabase/functions/_shared/ai-narrator.ts:71-93`
**Variable:** `CMM_SYSTEM_PROMPT`

This is the **closest match** to the blueprint's Section 6 system prompt. It contains:

| Blueprint Concept | Implemented? | Code Location |
|---|---|---|
| "Zero-to-Expert" method | **Yes** — verbatim | `ai-narrator.ts:71` |
| "Build brick by brick" | **Yes** — verbatim | `ai-narrator.ts:71` |
| "Mastery-level synthesis" | **Yes** — verbatim | `ai-narrator.ts:71` |
| Conversational delivery | **Yes** | `ai-narrator.ts:74` |
| Think-aloud modeling | **Yes** | `ai-narrator.ts:75` |
| Warm, intelligent humor | **Yes** | `ai-narrator.ts:76` |
| Everyday analogies | **Yes** | `ai-narrator.ts:77` |
| Calm, unhurried pace | **Yes** | `ai-narrator.ts:78` |
| Belief in the student | **Yes** | `ai-narrator.ts:79` |
| Multi-perspectival fairness | **Yes** | `ai-narrator.ts:82` |
| "Why before What" | **Yes** | `ai-narrator.ts:83` |
| Cross-disciplinary connections | **Yes** | `ai-narrator.ts:84` |
| Historical-contextual grounding | **Yes** | `ai-narrator.ts:85` |

The CMM prompt is consumed by two callers:
- `ai-narrator.ts:generateNarration()` — generates narration text per slide
- `generate-lecture-audio/index.ts:142` — invokes `generateNarration()` during the audio pipeline

### 1.2 Professor AI — Content Generation Layer

**File:** `supabase/functions/_shared/slide-prompts.ts:19-198`
**Variable:** `PROFESSOR_SYSTEM_PROMPT`

This agent generates the lecture **slide content** (not narration). It implements blueprint principles through a different lens:

| Blueprint Concept | How Implemented |
|---|---|
| "Why before What" | `slide-prompts.ts:38` — "Explain the underlying reasoning (not just WHAT, but WHY and HOW)" |
| First principles definitions | `slide-prompts.ts:33-37` — Formal definition + plain-language + significance |
| Misconception addressing | `slide-prompts.ts:43` — "ADDRESS misconceptions explicitly" |
| No jargon without explanation | `slide-prompts.ts:124` — "NO unexplained jargon" |
| Concrete examples | `slide-prompts.ts:39-42` — Specific real-world scenarios with actual data |
| Pedagogical structure | `slide-prompts.ts:31-45` — ACTIVATE → HOOK → DEFINE → EXPLAIN → ILLUSTRATE → ADDRESS → SYNTHESIZE → PREVIEW |

### 1.3 Curriculum Reasoning Agent — Structural Decomposition

**File:** `supabase/functions/curriculum-reasoning-agent/index.ts:66-93`
**Variable:** `SYSTEM_PROMPT`

This agent decomposes learning objectives into teachable micro-units. It operationalizes blueprint concepts at the **curriculum architecture** level:

| Blueprint Concept | How Implemented |
|---|---|
| Zero-to-Expert scaffolding | `index.ts:76` — "Cognitive scaffolding: progress from Remember → Understand → Apply → Analyze → Evaluate → Create" |
| Never assume prior knowledge | `index.ts:75` — "Foundational concepts FIRST — never assume prior knowledge" |
| Misconception identification | `index.ts:83` — "Common misconceptions identified proactively" |
| Build brick by brick | `index.ts:74` — "MICROLEARNING: Each teaching unit = ONE focused concept" |

### 1.4 TTS System Prompt — Voice Delivery

**File:** `supabase/functions/generate-lecture-audio/index.ts:192`

The text-to-speech prompt carries forward CMM traits at the voice-synthesis layer:

```
"You are a master educator delivering a continuous lecture monologue. Read the
following narration naturally with warmth, intellectual generosity, and calm,
unhurried pacing."
```

### 1.5 Implementation Plan (Historical)

**File:** `.lovable/plan.md`

Documents the planned rewrite that replaced a prior single-line prompt ("You are an expert university professor who gives engaging, clear lectures.") with the full CMM persona. This file confirms the blueprint was consciously adopted as the design target.

---

## 2. HOW the Blueprint Is Implemented

### 2.1 Compression: 2,000 Words → 400 Words

The blueprint's Section 6 system prompt (~2,000 words) is compressed to ~400 words in `CMM_SYSTEM_PROMPT`. The compression preserves **core principles** but drops:

- The full "YOUR CORE IDENTITY" paragraph
- The detailed "YOUR LESSON STRUCTURE" arc (Opening → Foundation → Build → Perspectives → Synthesis)
- "YOUR PERSONA BOUNDARIES" section
- "WHAT YOU NEVER DO" negative constraints
- The `[SUBJECT DOMAIN]` templating system

The lesson structure is instead handled **procedurally** by the `generateNarration()` function:
- First slide: "Open with a warm, conversational welcome. Preview what the lecture will cover. Set the 'journey' frame." (`ai-narrator.ts:174`)
- Middle slides: "Continue naturally from where you left off." (`ai-narrator.ts:171-172`)
- Last slide: "Synthesize the full journey, connect back to the opening hook" (`ai-narrator.ts:179`)

### 2.2 Distribution Across Agents

The blueprint envisions **one agent** handling everything. The codebase splits responsibilities:

```
Blueprint (Single Agent)          Codebase (Multi-Agent Pipeline)
─────────────────────────        ────────────────────────────────
                                 ┌─ Curriculum Reasoning Agent
Teaching philosophy ────────────►│  (pedagogical decomposition, UbD)
                                 │
Content creation ───────────────►├─ Professor AI
                                 │  (slide content generation, RAG)
                                 │
Delivery style ─────────────────►├─ CMM Narrator
                                 │  (narration text, continuity)
                                 │
Voice/presence ─────────────────►├─ TTS System Prompt
                                 │  (audio synthesis persona)
                                 │
Research grounding ─────────────►└─ Research Agent (Perplexity)
                                    (verified facts, citations)
```

### 2.3 Cross-Slide Continuity (Not in Blueprint)

The codebase adds a capability the blueprint doesn't mention: **rolling narration tail**. Each slide receives the last ~100 words of the previous slide's narration to prevent re-introductions and maintain natural flow. This is implemented in:
- `ai-narrator.ts:169-175` (tail injection into prompt)
- `ai-narrator.ts:272-274` (tail tracking in batch loop)
- `generate-lecture-audio/index.ts:177-179` (tail tracking in audio pipeline)

### 2.4 Citation Stripping (Not in Blueprint)

The codebase strips `[Source N]` markers from narration text before TTS, converting academic citations into natural speech references ("research from MIT shows..."). This is implemented in:
- `ai-narrator.ts:19-21` (`stripCitations()` helper)
- `ai-narrator.ts:90-91` (ABSOLUTE RULE against citation markers)
- `generate-lecture-audio/index.ts:169` (final safety strip)

---

## 3. What Is NOT Implemented (Blueprint → Code Gaps)

### 3.1 "Culture of Discourses"

The blueprint's core philosophical framing — a "Culture of Discourses" emphasizing "free, constructive discussion rather than enforced consensus or herd mentality" — appears **nowhere** in the codebase. No file references this phrase.

### 3.2 Interactive Tutoring / Student Agency

This is the **single largest divergence**. The blueprint describes:
- "Classes aren't just lectures — they are conversations"
- "Invite their own reflection: 'What do you think about this?'"
- "Leave the student equipped to form their own informed view"

The codebase **explicitly forbids** this:
- `ai-narrator.ts:88` — "You are delivering a CONTINUOUS MONOLOGUE. There is NO audience responding."
- `ai-narrator.ts:89` — "NEVER say 'thank you for that question,' 'great point'... or ANY phrase implying someone else is speaking."
- `ai-narrator.ts:92` — "Rhetorical questions are encouraged... but NEVER answer as if someone responded to them."

The implementation is a **one-way lecture delivery system**, not an interactive tutor.

### 3.3 "What You Never Do" Constraints

The blueprint's 8 negative constraints are not present in `CMM_SYSTEM_PROMPT`:

| Blueprint "Never" Rule | In CMM Prompt? | Elsewhere? |
|---|---|---|
| Never give dry, textbook-style answers | **No** | `slide-prompts.ts` bans vague content |
| Never assume the student "should know this" | **No** | Curriculum agent says "never assume prior knowledge" |
| Never present only one side | **No** | Multi-perspectival is positive-framed instead |
| Never use jargon without explaining | **No** | `slide-prompts.ts:124` — "NO unexplained jargon" |
| Never rush foundational concepts | **No** | Implied by "calm, unhurried pace" |
| Never make the student feel small | **No** | Implied by "belief in the student" |
| Never sacrifice clarity for impressiveness | **No** | `slide-prompts.ts:129-150` bans hollow rhetorical patterns |
| Never treat memorization as understanding | **No** | Implied by "conceptual understanding over memorization" |

The implementation relies on **positive framing** rather than explicit prohibitions. The BANNED RHETORICAL PATTERNS in `slide-prompts.ts:129-150` serve a similar purpose but are specific to content quality, not teaching persona.

### 3.4 Persona Boundaries

The blueprint defines explicit persona boundaries:
- "Deeply knowledgeable but never arrogant"
- "Champions accessibility"
- "Honest, sometimes uncomfortable opinions — but with warmth"
- "Intellectual who is profoundly practical"
- "Patient — the problem is the explanation, not the student's intelligence"

Only one of these appears in the CMM prompt: "Belief in the student: radiate the assumption they CAN understand this" (`ai-narrator.ts:79`). The rest are absent.

### 3.5 Humor Specification

The blueprint details four specific humor patterns:
1. **Observational humor from daily life** — Generalized in code as "warm, intelligent humor"
2. **Self-deprecating touches** — Not mentioned
3. **Ironic juxtaposition** — Not mentioned
4. **Timing for cognitive load** — Mentioned as "timed for cognitive breaks"

The implementation reduces humor guidance to a single line: "Warm, intelligent humor timed for cognitive breaks -- never at anyone's expense" (`ai-narrator.ts:76`).

### 3.6 Domain Adaptation Guide (Section 7)

The blueprint provides domain-specific adaptation strategies for STEM, Business, Arts, Technical Skills, and Professional Development. The codebase does not implement domain-variant prompts. Instead:
- Domain is passed as a parameter: `context.domain` in `ai-narrator.ts:187`
- The LLM is expected to adapt autonomously based on the domain string
- No domain-specific prompt branches exist

### 3.7 Quality Checklist (Section 8)

The blueprint's 10-dimension rubric (Warmth, Zero-to-Expert, Analogies, Humor, etc.) is **not implemented as an automated evaluation**. The only quality checks are:
- Narration length validation: `>50 chars` (`ai-narrator.ts:218`)
- Teaching unit count: `3-5 units` enforced (`curriculum-reasoning-agent/index.ts:346-356`)

### 3.8 Opening/Closing Ritual

The blueprint describes a specific opening ritual ("By the end of this, you'll understand X in a way most people don't") and closing ritual ("What do *you* think about this?"). The codebase implements:
- Opening: "Open with a warm, conversational welcome. Preview what the lecture will cover. Set the 'journey' frame." (`ai-narrator.ts:174`) — **partial match**
- Closing: "Synthesize the full journey, connect back to the opening hook, and encourage the student to explore further." (`ai-narrator.ts:179`) — **partial match**, but "explore further" replaces "What do you think?"

### 3.9 Historical-Contextual Grounding Depth

The blueprint specifies four sub-dimensions:
1. How did this idea emerge?
2. How has it evolved?
3. Who were the key actors/thinkers?
4. What's the contemporary relevance?

The implementation compresses to: "Historical-contextual grounding: how did this idea emerge? Who were the thinkers?" (`ai-narrator.ts:85`) — keeping (1) and (3), dropping (2) evolution and (4) contemporary relevance.

---

## 4. Capabilities in the Codebase NOT in the Blueprint

The codebase adds significant capabilities beyond the blueprint:

| Capability | Location | Description |
|---|---|---|
| RAG (Retrieval-Augmented Generation) | `slide-prompts.ts:170-197` | Mandatory citation from verified research |
| Research Agent with caching | `research-agent.ts` | Perplexity-powered grounded research, 7-day TTL cache |
| Bloom's Taxonomy integration | `curriculum-reasoning-agent/index.ts:76` | Cognitive level mapping to content type |
| Understanding by Design (UbD) | `curriculum-reasoning-agent/index.ts:68` | Backward design pedagogical framework |
| Cross-slide continuity | `ai-narrator.ts:169-175` | Rolling 100-word narration tail |
| Citation stripping | `ai-narrator.ts:19-21` | Clean narration for TTS |
| Banned rhetorical patterns | `slide-prompts.ts:129-150` | 6 specific hollow patterns banned |
| Visual directive system | `slide-prompts.ts:104-120` | AI image generation guidance |
| Adaptive layout hints | `slide-prompts.ts:361-370` | Semantic content presentation |
| Audio segment mapping | `generate-lecture-audio/index.ts:264-282` | Slide-audio sync highlighting |
| Microlearning architecture | `curriculum-reasoning-agent/index.ts:74` | 5-15 min focused units |
| Multi-model routing | `unified-ai-client.ts` | 6+ LLM providers with fallbacks |

---

## 5. Summary: Blueprint Fidelity Assessment

| Dimension | Fidelity | Notes |
|---|---|---|
| Zero-to-Expert arc | **High** | Verbatim in CMM prompt |
| Conversational delivery | **Medium** | Present but constrained to monologue |
| Humor guidance | **Low** | Single line vs. 4 detailed patterns |
| Analogy engine | **High** | Specific daily-life categories listed |
| Multi-perspectival | **High** | Verbatim commitment |
| Cross-disciplinary | **High** | Specific domains listed |
| Historical grounding | **Medium** | 2 of 4 sub-dimensions |
| Lesson structure | **Medium** | Procedural (code) rather than in prompt |
| Persona boundaries | **Low** | Only "belief in student" retained |
| "Never" constraints | **None** | Not in CMM prompt; partially elsewhere |
| Interactive tutoring | **Inverted** | Blueprint: conversation. Code: monologue |
| Domain adaptation | **Low** | Dynamic parameter, no variant prompts |
| Quality evaluation | **None** | No automated rubric |
| Culture of Discourses | **None** | Not referenced anywhere |

### Bottom Line

The blueprint is the **design origin** for the CMM Narrator agent. The codebase faithfully implements the core pedagogical philosophy (Zero-to-Expert, analogies, multi-perspectival fairness, cross-disciplinary connections) but **compresses** the delivery guidance, **distributes** the single-agent design across a multi-agent pipeline, and **fundamentally changes** the interaction model from interactive conversation to one-way lecture monologue. The codebase also **extends well beyond** the blueprint with RAG, UbD, Bloom's Taxonomy, citation management, and multi-model AI routing.
