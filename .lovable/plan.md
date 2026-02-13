
# Balance Bold Claims: Add Epistemic Humility to Speaker Notes Pipeline

## Problem

Speaker notes make definitive, unhedged claims like "I can guarantee that operational costs will climb" and cite statistics as absolute truth. This violates the reference prompt's core principle of **Multi-Perspectival Fairness** ("Never present only one side of a debatable issue as if it were settled truth") and **Conceptual Understanding Over Memorization**.

Two files cause this, compounding each other:

1. **`slide-prompts.ts`** (Professor AI) -- the quality examples on lines 156-163 model bold, citation-heavy assertions as the gold standard (e.g., "outperform peers by 147%")
2. **`ai-narrator.ts`** (CMM Narrator) -- inherits those bold notes as "raw material" and lacks any instruction to soften claims

## Changes

### File 1: `supabase/functions/_shared/slide-prompts.ts`

**A. Rewrite quality examples (lines 152-168) to model epistemic humility:**

Current:
```
GOOD: "Teams with highly engaged leaders outperform peers by 147% in earnings per share, according to Gallup's 2023 State of the Workplace report [Source 1]. The mechanism is psychological safety..."
```

New:
```
GOOD: "Research from Gallup's State of the Workplace report suggests that teams with highly engaged leaders tend to significantly outperform peers in earnings per share [Source 1]. The proposed mechanism is psychological safety..."
```

Similarly for the misconception example -- change "Sull et al. (2015) found strategic messages lose 50-80%" to "Research by Sull and colleagues suggests strategic messages can lose 50-80%".

**B. Add an epistemic humility rule to the QUALITY STANDARDS section (after line 127):**

Add a new rule:
```
EPISTEMIC HUMILITY (CRITICAL):
- Present research findings as evidence, not absolute truth: "research suggests..." not "studies prove..."
- Use hedging language for causal claims: "tends to," "is associated with," "evidence indicates" -- not "will," "always," "guarantees"
- Distinguish between well-established findings and emerging evidence
- When citing statistics, acknowledge they represent specific studies, not universal laws
- Frame correlations as correlations, not causation, unless the research explicitly establishes causation
- Never use "I can guarantee" or "I promise you" for empirical claims
```

**C. Add "GUARANTEE LANGUAGE" as banned pattern #7 (after line 149):**

```
7. GUARANTEE LANGUAGE: "I can guarantee..." / "I promise you that..."
   -> Delete: empirical claims carry uncertainty. Use "evidence strongly suggests..." or "research consistently shows..."
```

### File 2: `supabase/functions/_shared/ai-narrator.ts`

**A. Add epistemic humility rule to the ABSOLUTE RULES section in `CMM_SYSTEM_PROMPT` (after line 213):**

Add before the closing backtick:
```
- EPISTEMIC HUMILITY: Never present research findings as absolute guarantees.
  Use "research suggests...", "evidence indicates...", "studies have found..." 
  instead of "I can guarantee...", "this will always...", "it's a fact that..."
  Present data as evidence supporting a perspective, not as settled universal truth.
  Frame correlations carefully -- "X is associated with Y" not "X causes Y" unless
  causation is explicitly established. You are a scholar who respects the limits
  of evidence, not a pundit making bold predictions.
```

**B. Update the user prompt's EXISTING NOTES instruction (around line 300 in the `generateNarration` function):**

Current:
```
EXISTING NOTES (use as raw material -- rephrase, never read verbatim): "${stripCitations(slide.speaker_notes)}"
```

New:
```
EXISTING NOTES (use as raw material -- rephrase with appropriate nuance. Soften any definitive claims into evidence-based observations. Convert "will" to "tends to", "guarantees" to "suggests", and absolute statistics to qualified findings): "${stripCitations(slide.speaker_notes)}"
```

## What Does NOT Change

- The core CMM persona, teaching philosophy, and Zero-to-Expert arc remain intact
- The ABSOLUTE RULES about monologue format, no audience reactions, citation stripping all stay
- The slide content generation structure (JSON format, slide types, visual directives) is untouched
- No database, schema, or frontend changes
- The research pipeline (Perplexity/Sonar) is unchanged

## Expected Outcome

Speaker notes will shift from:
- "I can guarantee that operational costs will climb" 
- to "evidence consistently shows that operational costs tend to increase"

From:
- "outperform peers by 147% in earnings per share"
- to "research suggests teams tend to significantly outperform peers in earnings"

The tone remains warm, conversational, and confident -- but intellectually honest rather than making bold pundit-style predictions.
