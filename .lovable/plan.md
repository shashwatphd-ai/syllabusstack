

# Upgrade CMM System Prompt to Full Master Educator Blueprint

## What This Changes

Replace the current condensed ~60-line `CMM_SYSTEM_PROMPT` in `supabase/functions/_shared/ai-narrator.ts` with the full Master Educator Blueprint you provided. The current prompt captures the spirit but is abbreviated. The full blueprint adds significantly more depth in every dimension.

## What Gets Added (Compared to Current)

| Section | Current State | After Upgrade |
|---|---|---|
| Core Identity | 1 sentence ("Zero-to-Expert method") | Full paragraph: warm, intellectually generous, "Culture of Discourses" philosophy |
| Zero-to-Expert Arc | 1 sentence summary | 4 detailed steps with reasoning for each |
| Delivery Style | 4 bullet points | 4 subsections with multiple bullets each (conversational, humor, analogies, pacing) |
| Intellectual Commitments | 4 bullet points | 4 subsections: multi-perspectival fairness, conceptual understanding, cross-disciplinary, historical-contextual |
| Lesson Structure | Not present | Full 5-phase arc: Opening/Hook, Foundation, Build, Perspectives, Synthesis |
| Persona Boundaries | 4 bullets | 6 detailed persona commitments |
| What You Never Do | 5 bullets | 8 bullets including "never present one side as settled truth" and "never treat memorization as understanding" |

## What Stays the Same

The **ABSOLUTE RULES** section (no fake dialogue, no citations read aloud, no URLs, conceptual bridges as openers) remains exactly as it is. These are technical narration constraints, not pedagogical philosophy -- they sit on top of the blueprint.

## Implementation

### File: `supabase/functions/_shared/ai-narrator.ts`

Replace `CMM_SYSTEM_PROMPT` (lines 71-131) with the full blueprint, structured as:

1. **Core Identity** -- warm, intellectually generous, "Culture of Discourses"
2. **Teaching Method: Zero-to-Expert Arc** -- 4 steps with full descriptions
3. **Delivery Style** -- Conversational tone, Humor guidelines, Analogy engine, Calm pacing (with `[SUBJECT]` replaced by the dynamic `domain` value from the narration context... see Technical Note below)
4. **Intellectual Commitments** -- Multi-perspectival fairness, conceptual understanding over memorization, cross-disciplinary connections, historical-contextual grounding
5. **Lesson Structure** -- Opening/Hook, Foundation, Build, Perspectives, Synthesis
6. **Persona Boundaries** -- 6 commitments
7. **What You Never Do** -- 8 prohibitions
8. **Absolute Rules** -- kept verbatim from current version (no fake dialogue, no citations, etc.)

### Technical Note: `[SUBJECT]` Placeholder

The blueprint uses `[SUBJECT]` and `[SUBJECT DOMAIN]` as placeholders. Since the narration system already passes `domain` (e.g., "Business Management", "Computer Science") in the user prompt, the system prompt will use a generic reference like "your subject domain" rather than a literal placeholder. The domain-specific grounding happens naturally through the per-slide user prompt which already includes `(domain: ${context.domain})`.

### File: `supabase/functions/generate-lecture-audio/index.ts`

No changes needed. The TTS prompt is a separate concern (voice delivery, not content generation) and was already updated in the previous edit.

## Token Budget Consideration

The current system prompt is ~530 tokens. The full blueprint will be ~1200 tokens. This is well within budget given the 1200 max_tokens output limit and the model's context window. The per-generation cost increase is negligible compared to the quality improvement.

## After Deployment

Regenerate audio on a lecture to verify the narration now exhibits:
- Zero-to-Expert scaffolding (starts from basics, builds up)
- Everyday analogies for abstract concepts
- Warm humor at cognitive load peaks
- Multi-perspectival fairness on debatable topics
- No fake dialogue openers or citation reading (preserved from previous fix)

