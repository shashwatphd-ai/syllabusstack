
# Integrate CMM Narration into Slide Generation Pipeline

## The Problem

The Conversational Mastery Method (CMM) system prompt -- 1200 tokens of carefully crafted pedagogical instructions covering Zero-to-Expert arc, humor patterns, cross-slide continuity, citation stripping, and anti-hallucination rules -- is never used. Here's why:

```text
SLIDE GENERATION (Professor AI):
  speaker_notes instruction: "200-300 words of natural lecture narration"
  Result: Generic academic notes, 200+ words

AUDIO GENERATION (generate-lecture-audio):
  needsNarration() check: notes < 50 chars?
  Professor AI already wrote 200+ words --> needsNarration() = FALSE
  CMM narrator: SKIPPED ENTIRELY
  TTS reads the generic notes verbatim
```

The CMM was designed to transform dry slide content into warm, conversational narration -- but the pipeline never reaches it because Professor AI's generic notes pass the 50-char threshold.

## The Solution

Inject CMM narration principles directly into the Professor AI speaker_notes instructions. This way, every slide -- both individual (v3) and batch -- produces CMM-quality narration from the start. The audio pipeline then reads these notes verbatim via TTS (which is the correct behavior for deterministic audio).

## What Changes

### File 1: `supabase/functions/_shared/slide-prompts.ts`

**Change A: Replace the generic speaker_notes instruction in PROFESSOR_SYSTEM_PROMPT (lines 91-96)**

Replace the current 6-line generic instruction with CMM-aligned guidance:

```
BEFORE:
5. speaker_notes: 200-300 words of natural, conversational lecture narration that:
   - Sounds like a professor actually speaking to students
   - Adds context, anecdotes, and explanatory depth beyond the slides
   - Anticipates questions students might have
   - Provides additional examples or clarifications
   - Guides students through the material with clear transitions

AFTER:
5. speaker_notes: 200-350 words of CONVERSATIONAL MASTERY narration. These notes
   will be read verbatim by text-to-speech, so write them as a continuous spoken
   monologue — not bullet points, not stage directions, not meta-commentary.

   VOICE AND STYLE:
   - Write as a warm, intellectually generous mentor speaking directly to the student
   - Use direct address: "Now, you might be wondering...", "Let me show you why..."
   - Think aloud: "If we look at it this way... but wait, that creates a problem..."
   - Use everyday analogies to ground abstract concepts (family dynamics, household
     economics, popular culture, common experiences)
   - Include well-timed observational humor when cognitive load is heaviest
   - Pose rhetorical questions, then answer them yourself

   PEDAGOGICAL STRUCTURE:
   - Start from zero — never assume prior knowledge on this specific point
   - Build brick by brick — each new idea connects to the previous one
   - Layer complexity gradually — foundation first, then nuance and exceptions
   - End with synthesis — connect back to the bigger picture

   ABSOLUTE RULES FOR SPOKEN NARRATION:
   - NEVER say "Exactly!", "Great point!", "That's crucial!", or any phrase implying
     someone else is speaking. This is a monologue — the student has said nothing.
   - NEVER read citations verbatim (e.g., "Sull et al., 2015"). Convert to natural
     speech: "researchers found..." or "a major workplace study showed..."
   - NEVER include [Source N] markers — these are visual artifacts, not spoken content
   - NEVER read URLs aloud. Convert to natural references.
   - Each slide's notes should flow naturally from the previous slide's content.
     Use transitions like "Building on that...", "Now let's look at...",
     "Here's where it gets interesting..."
```

**Change B: Update the speaker_notes instruction in buildUserPrompt (lines 342-345)**

Replace:
```
3. Speaker notes MUST be 200-300 words of natural lecture narration that:
   - Sounds like an actual professor speaking
   - Adds depth beyond what's on the slide
   - Anticipates student questions
```

With:
```
3. Speaker notes MUST be 200-350 words of Conversational Mastery narration:
   - Written as a continuous spoken monologue (will be read by TTS verbatim)
   - Warm, conversational tone with everyday analogies and rhetorical questions
   - NO citation markers [Source N], NO "Exactly!", NO reading URLs aloud
   - Natural transitions from the previous slide's content
```

**Change C: Update the output example and final CRITICAL line (lines 415, 426)**

```
BEFORE: "speaker_notes": "200-300 words of natural lecture narration..."
AFTER:  "speaker_notes": "200-350 words of conversational mastery narration (spoken monologue, no citations)..."

BEFORE: CRITICAL: Every slide MUST have speaker_notes with 200-300 words.
AFTER:  CRITICAL: Every slide MUST have speaker_notes with 200-350 words of conversational narration written as a spoken monologue.
```

### File 2: `supabase/functions/process-batch-research/index.ts`

**Change D: Update the batch pipeline speaker_notes instruction (line 89)**

Replace:
```
3. Speaker notes MUST be 200-300 words of natural lecture narration
```

With:
```
3. Speaker notes MUST be 200-350 words of conversational mastery narration (spoken monologue for TTS — no [Source N] markers, no "Exactly!", use natural transitions between slides)
```

Also update the final CRITICAL line (line 114):
```
BEFORE: CRITICAL: Every slide MUST have speaker_notes with 200-300 words.
AFTER:  CRITICAL: Every slide MUST have speaker_notes with 200-350 words of conversational narration as a spoken monologue.
```

### File 3: `supabase/functions/_shared/ai-narrator.ts`

No structural changes. The CMM_SYSTEM_PROMPT and generateNarration() function remain as a **safety net** -- if for any reason a slide arrives at audio generation with notes < 50 chars, the full CMM narrator still kicks in and generates rich narration. This preserves the fallback architecture.

### File 4: `supabase/functions/generate-lecture-audio/index.ts`

No changes. The `needsNarration()` check at line 162 continues to work correctly:
- Professor AI now generates CMM-quality 200-350 word notes -> `needsNarration()` returns false -> TTS reads them verbatim (correct behavior)
- If notes are somehow missing/short -> `needsNarration()` returns true -> full CMM narrator generates them (safety net)

## What Does NOT Change

| Component | Why |
|-----------|-----|
| `ai-narrator.ts` (CMM system prompt + functions) | Preserved as safety net fallback |
| `generate-lecture-audio/index.ts` | Already correct -- reads notes verbatim via TTS |
| `generate-lecture-slides-v3/index.ts` | Uses shared `PROFESSOR_SYSTEM_PROMPT` and `buildUserPrompt` from slide-prompts.ts |
| Database schema | No changes needed |
| Frontend components | No changes needed |
| Audio generation (TTS, voices, storage) | Untouched |
| Image generation pipeline | Untouched |
| Research agent | Untouched |

## Pipeline After This Change

```text
SLIDE GENERATION (Professor AI + CMM instructions):
  speaker_notes: 200-350 words, conversational mastery style
  - Warm tone, analogies, rhetorical questions
  - No citation markers, no dialogue hallucinations
  - Natural cross-slide transitions

AUDIO GENERATION:
  needsNarration() = FALSE (notes are 200+ words, CMM quality)
  TTS reads notes VERBATIM --> perfectly synced audio
  CMM narrator: available as safety net, rarely triggered

RESULT: Consistent narration quality across:
  - Individual v3 slide generation
  - Batch slide generation
  - Audio generation (verbatim TTS)
  - Regeneration (same prompts)
```

## Consistency Check

| Path | Prompt Source | Speaker Notes Quality |
|------|-------------|----------------------|
| Individual v3 | `PROFESSOR_SYSTEM_PROMPT` + `buildUserPrompt()` (slide-prompts.ts) | CMM-aligned |
| Batch (process-batch-research) | `PROFESSOR_SYSTEM_PROMPT` + local `buildPromptForUnit()` | CMM-aligned |
| Audio fallback | `CMM_SYSTEM_PROMPT` (ai-narrator.ts) | Full CMM (safety net) |
| Regeneration | Same as individual v3 | CMM-aligned |

All four paths now produce consistent, conversational narration optimized for spoken delivery.
