
# Conversational Mastery Agent: Expanded Plan with Continuity

## The Continuity Problem

The current `generateNarration()` function calls the AI model **independently for each slide** with zero knowledge of what was narrated on previous slides. This causes three specific failures:

1. **Repeated introductions**: Slide 3 says "Welcome! Today we'll explore..." because it doesn't know slide 1 already welcomed the student.
2. **Dialogue hallucination**: The model, told to be "conversational," invents an interlocutor ("Thank you for that question!") because it has no actual conversational thread to continue.
3. **Broken transitions**: Each slide starts from scratch instead of flowing naturally ("As we just saw..." or "Building on that foundation...").

The fix requires passing a **narration history** through the slide loop so each AI call knows what came before.

## Architecture: Continuity via Rolling Context

```text
Slide 1: [system prompt + slide content] --> narration_1
Slide 2: [system prompt + slide content + "Previous narration ended with: ...narration_1 last 100 words..."] --> narration_2
Slide 3: [system prompt + slide content + "Previous narration ended with: ...narration_2 last 100 words..."] --> narration_3
...
```

Each slide receives a **tail excerpt** (last ~100 words) of the previous slide's narration. This is enough for the model to:
- Avoid repeating the welcome/introduction
- Create natural transitions ("Now that we understand X, let's look at Y...")
- Maintain a consistent voice and thread throughout the lecture

We do NOT pass the full history (all previous narrations) because that would blow up the context window and cost. A 100-word tail is sufficient for continuity.

## File-by-File Changes

### File 1: `supabase/functions/_shared/ai-narrator.ts`

This file gets the largest transformation.

**A. Update `NarrationContext` interface** -- Add optional field for continuity:

```typescript
export interface NarrationContext {
  slideIndex: number;
  totalSlides: number;
  unitTitle: string;
  domain: string;
  previousNarrationTail?: string;  // Last ~100 words of previous slide's narration
  allSlideTitles?: string[];       // All slide titles for lecture outline awareness
}
```

**B. Add citation stripping helper** at the top of the file:

```typescript
function stripCitations(text: string): string {
  return text.replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();
}
```

Applied to ALL content parts before they enter the prompt, and to existing `speaker_notes` if present.

**C. Replace the system prompt** (line 140) with the Conversational Mastery Method agent persona (~400 words, condensed from the user's 6-section blueprint):

```text
You are a master educator delivering a continuous lecture monologue. Your teaching 
philosophy is the "Zero-to-Expert" method: start from zero assumed knowledge, build 
brick by brick, and end with mastery-level synthesis.

DELIVERY STYLE:
- Conversational, never lecturing. Use direct address: "Now, you might wonder..."
- Think aloud: "If we look at it this way... but wait, that creates a problem..."
- Warm, intelligent humor timed for cognitive breaks -- never at anyone's expense
- For EVERY abstract concept, find a concrete analogy from everyday life
- Calm, unhurried pace. Let insights breathe before moving on.

INTELLECTUAL COMMITMENTS:
- Multi-perspectival fairness: present all sides of debatable topics
- "Why" before "What" -- conceptual understanding over memorization
- Cross-disciplinary connections where natural
- Historical-contextual grounding: how did this idea emerge?

ABSOLUTE RULES:
- You are delivering a CONTINUOUS MONOLOGUE. There is no audience responding.
- NEVER say "thank you for that question," "great point," "as you mentioned,"
  or any phrase implying someone else is speaking.
- NEVER include citation markers like [Source 1], [Source 2], or any bracketed references.
- NEVER read URLs aloud. Convert them to natural references.
- Rhetorical questions are fine ("Have you ever wondered...?") but NEVER answer 
  as if someone responded.
- Each slide's narration flows from the previous one. Use natural transitions,
  not fresh introductions.
```

**D. Rewrite the user prompt** to include continuity context and slide-position awareness:

```text
Generate narration for slide ${slideIndex + 1} of ${totalSlides} in a lecture on "${unitTitle}" (${domain}).

LECTURE OUTLINE:
${allSlideTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}

CURRENT SLIDE:
- Type: ${slide.type}
- Title: "${slide.title}"
- Content: [cleaned content parts, citations stripped]

${previousNarrationTail 
  ? `CONTINUITY (your previous narration ended with): "...${previousNarrationTail}"\nContinue naturally from where you left off. Do NOT re-introduce the topic or welcome the student.`
  : 'This is the FIRST slide. Open with a warm welcome and preview what the lecture will cover.'}

${isLastSlide ? 'This is the LAST slide. Synthesize the journey, connect back to the opening, and encourage further exploration.' : ''}

Write 200-350 words of narration. Return ONLY the narration text.
```

**E. Model and token changes:**
- Model: `MODELS.PROFESSOR_AI` (`google/gemini-3-flash-preview`) instead of `MODELS.FAST`
- Fallback: `MODELS.PROFESSOR_AI_FALLBACK` (`google/gemini-2.5-flash`)
- `max_tokens`: 1200 (up from 800) to accommodate richer narration

**F. Update `generateNarration()` signature** -- The function signature stays the same (it already accepts `NarrationContext`), but the new optional fields (`previousNarrationTail`, `allSlideTitles`) are used when present.

### File 2: `supabase/functions/generate-lecture-audio/index.ts`

**A. Build slide titles array** before the loop (after line 121):

```typescript
const allSlideTitles = slides.map(s => s.title || 'Untitled');
```

**B. Track narration history** -- Add a variable before the loop:

```typescript
let previousNarrationTail = '';
```

**C. Pass continuity context** in the `generateNarration()` call (lines 140-153):

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

**D. Update the tail after each successful narration** (after narrationText is finalized, before Phase 3):

```typescript
// Extract last ~100 words for continuity with next slide
const words = narrationText.split(/\s+/);
previousNarrationTail = words.slice(Math.max(0, words.length - 100)).join(' ');
```

**E. Strip citations from narrationText** before passing to TTS -- after narrationText is finalized (whether from AI, existing speaker_notes, or fallback):

```typescript
narrationText = narrationText.replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();
```

**F. Update TTS system prompt** (line 181) to reinforce monologue discipline:

```text
You are a master educator delivering a continuous lecture monologue. Read the 
following narration naturally with warmth, intellectual generosity, and appropriate 
pacing. Do not add any commentary, greetings, dialogue, or acknowledgments. This 
is a one-way narration -- never say "thank you" or respond as if someone spoke. 
If you encounter URLs or abbreviations, handle them naturally.
```

**G. Strip citations from `generateSimpleFallback()` output** (line 68):

```typescript
return parts.join(' ').replace(/\[Source\s*\d+\]/gi, '').trim();
```

### File 3: No other files change

| Component | Why unchanged |
|-----------|---------------|
| `openrouter-client.ts` | No API changes needed |
| `segment-mapper.ts` | Works on whatever narration text it receives |
| `validators/index.ts` | Schema already updated in previous migration |
| `VoicePicker.tsx` | Voice selection is independent of narration content |
| `LectureSlideViewer.tsx` | Already passes voiceId correctly |
| `StudentSlideViewer.tsx` | Audio playback is format-agnostic |
| `NarratedScrollViewer.tsx` | Renders speaker_notes as-is (now cleaner) |
| `citationParser.ts` | Still used for slide *content* citations (not narration) |

## How Continuity Works Across Slide Types

| Slide Type | Continuity Behavior |
|------------|-------------------|
| Title (slide 1) | No previous tail. Opens with warm welcome, previews the lecture arc. |
| Definition (mid-lecture) | Receives tail from previous slide. "Now that we've seen X in action, let's give it a proper name..." |
| Example (after definition) | "To make this concrete, picture this scenario..." -- flows from definition without re-explaining. |
| Misconception | "Now here's where many people get tripped up..." -- doesn't say "great question about misconceptions." |
| Summary/Recap (last) | Receives full context. "So let's step back and see what we've built today..." Connects to opening. |

## Cost Impact

| Phase | Before | After |
|-------|--------|-------|
| Narration (Phase 1) | gemini-2.5-flash-lite, 800 tokens | gemini-3-flash-preview, 1200 tokens |
| SSML (Phase 2) | gemini-2.5-flash-lite (removed) | -- |
| TTS (Phase 3) | Google Cloud TTS | GPT Audio Mini (already changed) |
| Segment Map (Phase 4) | gemini-2.5-flash-lite | unchanged |

Net: +1 model tier for narration, -1 entire phase (SSML). The per-slide cost is roughly neutral. The continuity tail adds ~100 words to each prompt's input, which is negligible.

## Implementation Order

1. Update `ai-narrator.ts` -- new interface fields, citation stripping, CMM system prompt, continuity-aware user prompt, model upgrade
2. Update `generate-lecture-audio/index.ts` -- build slide titles, track narration tail, pass continuity context, strip citations before TTS, update TTS prompt, clean fallback output
3. Deploy edge function
4. Test by regenerating audio for an existing lecture with 5+ slides to verify cross-slide continuity
