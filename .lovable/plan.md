

# Fix Narration Quality: No Source Reading, No Fake Dialogue Openers

## Problem Summary

Two issues with the current AI-generated narration:
1. **Citations read aloud**: The regex strips `[Source N]` markers, but inline academic citations like `"Sull et al. (2015)"` pass through and get narrated verbatim
2. **Fake dialogue openers**: At slide transitions, the model fabricates reactions like `"Exactly, that is a crucial point"` as if responding to someone -- the student hasn't said anything, so this feels dishonest

## Changes (Prompt Text Only -- Zero Code Logic Changes)

### File 1: `supabase/functions/_shared/ai-narrator.ts`

**A. ABSOLUTE RULES section (line 110-116)** -- expand the banned phrases list and add citation-reading ban:

```
ABSOLUTE RULES:
- You are delivering a CONTINUOUS MONOLOGUE. There is NO audience responding.
- NEVER say "thank you for that question," "great point," "as you mentioned,"
  "great outline," "exactly," "absolutely," "that's a crucial point,"
  "that's a great observation," "you raise an important point," or ANY phrase
  implying someone else is speaking or that you are responding to input.
- NEVER fabricate a reaction to something the student said. The student has said NOTHING.
  You are guiding them through self-directed learning -- not responding to a conversation.
- START each slide by diving directly into the content or building a conceptual bridge
  from the previous idea. Good openers: "Now let's look at...",
  "This brings us to something fascinating...", "Here's where it gets interesting...",
  "Building on that foundation..." Bad openers: "Exactly!", "Great question!",
  "That's a crucial point!", "You're absolutely right!"
- NEVER read academic citations verbatim (e.g., "Sull et al., 2015", "Gallup, 2023").
  Convert to natural speech: "researchers found..." or "a major workplace study showed..."
  The student is LISTENING, not reading -- citations are visual artifacts, not spoken content.
- NEVER include citation markers like [Source 1], [Source 2], or bracketed references.
- NEVER read URLs aloud. Convert to natural references ("research from MIT shows...").
- Rhetorical questions are encouraged ("Have you ever wondered...?") but NEVER answer
  as if someone responded to them.
- Each slide's narration flows from the previous one. Use natural transitions, not fresh
  introductions or re-welcomes.
```

**B. Continuity section (line 193-195)** -- strengthen anti-reaction instruction:

Change from:
```
Continue naturally from where you left off. Do NOT re-introduce the topic, do NOT welcome the student again, do NOT repeat concepts already covered.
```
To:
```
Continue naturally from where you left off. Do NOT re-introduce the topic, do NOT welcome the student again, do NOT repeat concepts already covered. CRITICAL: Do NOT start with a reaction phrase ("Exactly!", "Great point!", "That's crucial!"). The student has not spoken. Start by building a conceptual bridge or diving into the new content directly.
```

**C. Existing notes label (line 207)** -- prevent verbatim reading of source-heavy notes:

Change from:
```
EXISTING NOTES (use as a starting point, expand and enrich): "${stripCitations(...)}"
```
To:
```
EXISTING NOTES (use as raw material -- rephrase, never read verbatim): "${stripCitations(...)}"
```

### File 2: `supabase/functions/generate-lecture-audio/index.ts`

**TTS system prompt (line 192)** -- add citation skip instruction:

Change from:
```
...If you encounter URLs or abbreviations, handle them naturally.
```
To:
```
...If you encounter URLs or abbreviations, handle them naturally. If you encounter academic citations like "Smith et al. (2019)" or "Source 1", skip them entirely -- do not read them aloud.
```

## What Does NOT Change

- All TypeScript code logic (functions, interfaces, continuity mechanism, citation regex)
- Model routing, token limits, function signatures
- Slide generation pipeline (`slide-prompts.ts`, `curriculum-reasoning-agent`)
- Frontend components
- The enriched CMM persona sections (humor, analogies, persona, intellectual commitments) remain intact

## After Deployment

Regenerate audio on the current lecture to verify:
1. No academic citations are spoken aloud
2. Each slide starts with content or a conceptual bridge, never a fake reaction

