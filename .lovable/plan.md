

# Conversational Mastery Agent: Full Implementation Plan with Cross-Slide Continuity

## Overview

Two backend files are modified. No frontend changes. No new files. The narration pipeline gains three capabilities: (1) citation stripping, (2) the Conversational Mastery Method persona, and (3) cross-slide continuity via a rolling narration tail.

---

## File 1: `supabase/functions/_shared/ai-narrator.ts` (Full Rewrite of Core Logic)

### A. Add citation stripping helper (top of file, after imports)

```typescript
function stripCitations(text: string): string {
  return text.replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();
}
```

Applied to every content part string AND to existing `speaker_notes` before they enter the prompt.

### B. Expand `NarrationContext` interface (lines 43-48)

Add two optional fields for continuity:

```typescript
export interface NarrationContext {
  slideIndex: number;
  totalSlides: number;
  unitTitle: string;
  domain: string;
  previousNarrationTail?: string;  // Last ~100 words of previous slide narration
  allSlideTitles?: string[];       // Full lecture outline for structure awareness
}
```

### C. Replace system prompt (line 140)

The current single sentence:
> "You are an expert university professor who gives engaging, clear lectures."

Becomes the full Conversational Mastery Method persona (~400 words, condensed from the 8-section blueprint):

```text
You are a master educator delivering a continuous lecture monologue. Your teaching
philosophy is the "Zero-to-Expert" method: start from zero assumed knowledge, build
brick by brick, anchor every new idea to something already understood, and end with
mastery-level synthesis.

DELIVERY STYLE:
- Conversational, never lecturing. Use direct address: "Now, you might wonder..."
- Think aloud: "If we look at it this way... but wait, that creates a problem..."
- Warm, intelligent humor timed for cognitive breaks -- never at anyone's expense
- For EVERY abstract concept, find a concrete analogy from everyday life: family
  dynamics, household economics, popular culture, common human experiences
- Calm, unhurried pace. Let insights breathe before moving on.
- Belief in the student: radiate the assumption they CAN understand this

INTELLECTUAL COMMITMENTS:
- Multi-perspectival fairness: present all sides of debatable topics with their
  strongest arguments. Never force your conclusion.
- "Why" before "What" -- conceptual understanding over memorization
- Cross-disciplinary connections where natural (philosophy, history, sociology,
  economics, daily life)
- Historical-contextual grounding: how did this idea emerge? Who were the thinkers?

ABSOLUTE RULES:
- You are delivering a CONTINUOUS MONOLOGUE. There is NO audience responding.
- NEVER say "thank you for that question," "great point," "as you mentioned,"
  "great outline," or ANY phrase implying someone else is speaking.
- NEVER include citation markers like [Source 1], [Source 2], or bracketed references.
- NEVER read URLs aloud. Convert to natural references ("research from MIT shows...").
- Rhetorical questions are encouraged ("Have you ever wondered...?") but NEVER
  answer as if someone responded to them.
- Each slide's narration flows from the previous one. Use natural transitions,
  not fresh introductions or re-welcomes.
```

### D. Rewrite the user prompt (lines 110-137)

The new prompt includes the lecture outline, continuity tail, and position-aware instructions:

```text
Generate narration for slide ${slideIndex + 1} of ${totalSlides} in a lecture on
"${unitTitle}" (domain: ${domain}).

LECTURE OUTLINE:
${allSlideTitles?.map((t, i) => `  ${i + 1}. ${t}`).join('\n') || '  (outline not available)'}

CURRENT SLIDE:
- Type: ${slide.type || 'concept'}
- Title: "${slide.title || 'Untitled'}"
- Content:
${contentParts.join('\n') || '  No structured content available.'}

${previousNarrationTail
  ? `CONTINUITY -- your previous narration ended with:
"...${previousNarrationTail}"
Continue naturally from where you left off. Do NOT re-introduce the topic, do NOT
welcome the student again, do NOT repeat concepts already covered.`
  : 'This is the FIRST slide. Open with a warm, conversational welcome. Preview
what the lecture will cover. Set the "journey" frame.'}

${isLastSlide
  ? 'This is the LAST slide. Synthesize the full journey, connect back to the
opening hook, and encourage the student to explore further.'
  : ''}

${slide.speaker_notes ? `EXISTING NOTES (use as a starting point, expand and enrich): "${stripCitations(slide.speaker_notes)}"` : ''}

Write 200-350 words. Return ONLY the narration text, nothing else.
```

### E. Apply `stripCitations()` to all content parts

Every string that goes into `contentParts` is wrapped:

```typescript
if (content?.main_text) {
  contentParts.push(`Main text: "${stripCitations(content.main_text)}"`);
}
// same for key_points, definition, example, misconception, steps
```

### F. Model and token upgrade

```typescript
const narration = await simpleCompletion(
  MODELS.PROFESSOR_AI,        // was: MODELS.FAST
  systemPrompt,
  prompt,
  {
    max_tokens: 1200,          // was: 800
    fallbacks: [MODELS.PROFESSOR_AI_FALLBACK],  // was: MODELS.GEMINI_FLASH
  },
  '[AI Narrator]'
);
```

### G. Update `batchGenerateNarration()` for continuity

The batch function (lines 167-206) also needs to track `previousNarrationTail` and pass `allSlideTitles`:

```typescript
const allSlideTitles = slides.map(s => s.title || 'Untitled');
let previousNarrationTail = '';

// Inside the loop, after successful narration:
const words = narration.split(/\s+/);
previousNarrationTail = words.slice(Math.max(0, words.length - 100)).join(' ');
```

---

## File 2: `supabase/functions/generate-lecture-audio/index.ts`

### A. Build slide titles and continuity tracker (after line 129)

```typescript
const allSlideTitles = slides.map(s => s.title || 'Untitled');
let previousNarrationTail = '';
```

### B. Pass continuity context to `generateNarration()` (lines 140-154)

```typescript
narrationText = await generateNarration(
  {
    type: slide.type,
    title: slide.title,
    content: slide.content,
    speaker_notes: slide.speaker_notes,
  },
  {
    slideIndex: i,
    totalSlides,
    unitTitle,
    domain,
    previousNarrationTail,
    allSlideTitles,
  },
  OPENROUTER_API_KEY
);
```

### C. Strip citations from finalized narration (after all narration paths converge, before Phase 3)

```typescript
// Clean citation markers from narration text (regardless of source)
narrationText = narrationText.replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();
```

### D. Update continuity tail (after narration is finalized, before Phase 3)

```typescript
const words = narrationText.split(/\s+/);
previousNarrationTail = words.slice(Math.max(0, words.length - 100)).join(' ');
```

### E. Update TTS system prompt (line 181)

Replace the current prompt:

```text
You are a master educator delivering a continuous lecture monologue. Read the
following narration naturally with warmth, intellectual generosity, and calm,
unhurried pacing. Do not add any commentary, greetings, dialogue, or
acknowledgments. This is a one-way narration -- never say "thank you," never
respond as if someone spoke, never add your own introduction or sign-off.
If you encounter URLs or abbreviations, handle them naturally.
```

### F. Clean fallback output (line 68)

```typescript
return parts.join(' ').replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();
```

---

## What Does NOT Change

| Component | Reason |
|---|---|
| `citationParser.ts` | Still renders `[Source N]` as clickable badges in slide *content* |
| `NarratedScrollViewer.tsx` | Renders `speaker_notes` as-is -- now automatically cleaner |
| `StudentSlideViewer.tsx` | Audio playback is format-agnostic |
| `openrouter-client.ts` | No API changes needed |
| `segment-mapper.ts` | Works on whatever narration text it receives |
| `VoicePicker.tsx` | Independent of narration content |

---

## How Cross-Slide Continuity Works

```text
Slide 1 (title):     No tail --> warm welcome, journey preview
Slide 2 (definition): Tail from slide 1 --> "Now that we have the big picture, let's define..."
Slide 3 (example):    Tail from slide 2 --> "To make this concrete, imagine..."
Slide 4 (misconception): Tail from slide 3 --> "Now here's where many people get tripped up..."
Slide 5 (summary):    Tail from slide 4 --> "So let's step back and see what we've built..."
```

Each slide receives the last ~100 words of the previous narration. This prevents re-introductions, ensures natural transitions, and maintains a consistent voice thread without blowing up the context window.

---

## Implementation Order

1. Update `ai-narrator.ts` -- interface, citation helper, CMM system prompt, continuity-aware user prompt, model upgrade, batch function update
2. Update `generate-lecture-audio/index.ts` -- slide titles array, continuity tracker, citation stripping, TTS prompt, fallback cleanup
3. Deploy `generate-lecture-audio` edge function
4. Test by regenerating audio on an existing lecture

