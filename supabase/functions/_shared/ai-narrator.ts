/**
 * AI-Driven Narration Generator — Conversational Mastery Method (CMM)
 * Generates natural, continuous lecture narration using the Zero-to-Expert arc.
 *
 * Key capabilities:
 * - Citation stripping: removes [Source N] markers before narration
 * - CMM persona: warm, conversational, intellectually generous monologue
 * - Cross-slide continuity: rolling 100-word tail prevents re-introductions
 *
 * Uses OpenRouter with PROFESSOR_AI model (gemini-3-flash-preview)
 */

import { simpleCompletion, MODELS } from './openrouter-client.ts';

// ---------------------------------------------------------------------------
// Citation stripping helper
// ---------------------------------------------------------------------------

function stripCitations(text: string): string {
  return text.replace(/\[Source\s*\d+\]/gi, '').replace(/\s{2,}/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SlideForNarration {
  order?: number;
  type?: string;
  title?: string;
  content?: {
    main_text?: string;
    key_points?: (string | { text: string })[];
    definition?: {
      term?: string;
      formal_definition?: string;
      simple_explanation?: string;
    };
    example?: {
      scenario?: string;
      walkthrough?: string;
      connection_to_concept?: string;
    };
    misconception?: {
      wrong_belief?: string;
      why_wrong?: string;
      correct_understanding?: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
  };
  speaker_notes?: string;
}

export interface NarrationContext {
  slideIndex: number;
  totalSlides: number;
  unitTitle: string;
  domain: string;
  previousNarrationTail?: string;
  allSlideTitles?: string[];
}

// ---------------------------------------------------------------------------
// CMM System Prompt
// ---------------------------------------------------------------------------

const CMM_SYSTEM_PROMPT = `You are a master educator delivering a continuous lecture monologue. Your teaching philosophy is the "Zero-to-Expert" method: start from zero assumed knowledge, build brick by brick, anchor every new idea to something already understood, and end with mastery-level synthesis. Your goal is to foster understanding through free, constructive discourse -- not enforced consensus, herd mentality, or rote memorization.

DELIVERY STYLE:
- Conversational, never lecturing. Use direct address: "Now, you might wonder..."
- Think aloud: "If we look at it this way... but wait, that creates a problem..."
- Calm, unhurried pace. Let insights breathe before moving on.
- Belief in the student: radiate the assumption they CAN understand this

HUMOR -- WARM, WELL-TIMED, STRUCTURAL:
- Observational humor from daily life: find genuinely funny parallels between abstract concepts and everyday situations
- Self-deprecating touches welcome: acknowledge when something is confusing even for experts
- Ironic juxtaposition: place grand ideas next to mundane realities to illuminate both
- Time humor for when cognitive load is heaviest -- it acts as a mental breather before the next idea
- NEVER mock the student, any group, or any perspective

ANALOGIES -- YOUR MOST POWERFUL TOOL:
- For EVERY abstract concept, find a concrete analogy from everyday life
- Draw from: family dynamics, household economics, popular culture, common human experiences, historical stories, cross-cultural parallels
- The best analogy is one where the student thinks "Oh! Now I get it."

INTELLECTUAL COMMITMENTS:
- Multi-perspectival fairness: present all sides of debatable topics with their strongest arguments. Never force your conclusion.
- "Why" before "What" -- conceptual understanding over memorization
- Cross-disciplinary connections where natural (philosophy, history, sociology, economics, daily life)
- Historical-contextual grounding: how did this idea emerge? How has it evolved? Who were the key thinkers? Why does it matter NOW?

YOUR PERSONA:
- Deeply knowledgeable but never arrogant. Carry your learning lightly.
- Champion accessibility: knowledge should not be gatekept by jargon or elitism.
- Give honest, sometimes uncomfortable perspectives -- but always with warmth and care.
- Patient: if the student doesn't understand, the problem is the explanation, not their intelligence.

WHAT YOU NEVER DO:
- Never give dry, textbook-style narration devoid of personality
- Never assume the student "should already know this"
- Never use jargon without explaining it in plain terms
- Never rush through foundational concepts to reach advanced material
- Never sacrifice clarity for impressiveness

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
  introductions or re-welcomes.`;

// ---------------------------------------------------------------------------
// Check if speaker notes need AI-generated narration
// ---------------------------------------------------------------------------

export function needsNarration(speakerNotes: string | undefined): boolean {
  if (!speakerNotes) return true;
  const trimmed = speakerNotes.trim();
  return trimmed.length < 50 ||
         trimmed === 'No notes' ||
         trimmed.toLowerCase().includes('[placeholder]');
}

// ---------------------------------------------------------------------------
// Build content summary with citation stripping
// ---------------------------------------------------------------------------

function buildContentParts(content: SlideForNarration['content']): string[] {
  const parts: string[] = [];

  if (content?.main_text) {
    parts.push(`Main text: "${stripCitations(content.main_text)}"`);
  }

  if (content?.key_points?.length) {
    const points = content.key_points.map((p, i) => {
      const text = typeof p === 'string' ? p : p.text;
      return `\n  ${i + 1}. ${stripCitations(text)}`;
    });
    parts.push(`Key points: ${points.join('')}`);
  }

  if (content?.definition) {
    const def = content.definition;
    const defText = stripCitations(def.formal_definition || def.simple_explanation || '');
    parts.push(`Definition of "${def.term || 'term'}": ${defText}`);
  }

  if (content?.example) {
    const ex = content.example;
    parts.push(`Example: ${stripCitations(ex.scenario || '')}. ${stripCitations(ex.walkthrough || '')}`);
  }

  if (content?.misconception) {
    const mis = content.misconception;
    parts.push(`Misconception addressed: Wrong belief "${stripCitations(mis.wrong_belief || '')}" - Why wrong: ${stripCitations(mis.why_wrong || '')} - Correct: ${stripCitations(mis.correct_understanding || '')}`);
  }

  if (content?.steps?.length) {
    const steps = content.steps.map(s => `\n  ${s.step}. ${stripCitations(s.title)}: ${stripCitations(s.explanation)}`);
    parts.push(`Steps: ${steps.join('')}`);
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Generate narration for a single slide
// ---------------------------------------------------------------------------

export async function generateNarration(
  slide: SlideForNarration,
  context: NarrationContext,
  _apiKey?: string
): Promise<string> {
  const isLastSlide = context.slideIndex === context.totalSlides - 1;
  const contentParts = buildContentParts(slide.content);

  // Build lecture outline
  const outlineSection = context.allSlideTitles?.length
    ? context.allSlideTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')
    : '  (outline not available)';

  // Build continuity section
  let continuitySection: string;
  if (context.previousNarrationTail) {
    continuitySection = `CONTINUITY -- your previous narration ended with:
"...${context.previousNarrationTail}"
Continue naturally from where you left off. Do NOT re-introduce the topic, do NOT welcome the student again, do NOT repeat concepts already covered. CRITICAL: Do NOT start with a reaction phrase ("Exactly!", "Great point!", "That's crucial!"). The student has not spoken. Start by building a conceptual bridge or diving into the new content directly.`;
  } else {
    continuitySection = 'This is the FIRST slide. Open with a warm, conversational welcome. Preview what the lecture will cover. Set the "journey" frame.';
  }

  // Build last-slide section
  const lastSlideSection = isLastSlide
    ? 'This is the LAST slide. Synthesize the full journey, connect back to the opening hook, and encourage the student to explore further.'
    : '';

  // Build existing notes section
  const existingNotesSection = slide.speaker_notes
    ? `EXISTING NOTES (use as raw material -- rephrase, never read verbatim): "${stripCitations(slide.speaker_notes)}"`
    : '';

  const prompt = `Generate narration for slide ${context.slideIndex + 1} of ${context.totalSlides} in a lecture on "${context.unitTitle}" (domain: ${context.domain}).

LECTURE OUTLINE:
${outlineSection}

CURRENT SLIDE:
- Type: ${slide.type || 'concept'}
- Title: "${slide.title || 'Untitled'}"
- Content:
${contentParts.join('\n') || '  No structured content available.'}

${continuitySection}

${lastSlideSection}

${existingNotesSection}

Write 200-350 words. Return ONLY the narration text, nothing else.`;

  try {
    const narration = await simpleCompletion(
      MODELS.PROFESSOR_AI,
      CMM_SYSTEM_PROMPT,
      prompt,
      {
        max_tokens: 1200,
        fallbacks: [MODELS.PROFESSOR_AI_FALLBACK],
      },
      '[AI Narrator]'
    );

    if (!narration || narration.length < 50) {
      throw new Error('Generated narration too short');
    }

    // Final safety: strip any citations the model may have included
    return stripCitations(narration);
  } catch (error) {
    console.error('AI narration generation failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Batch generate narration with cross-slide continuity
// ---------------------------------------------------------------------------

export async function batchGenerateNarration(
  slides: SlideForNarration[],
  unitTitle: string,
  domain: string,
  _apiKey?: string
): Promise<Map<number, string>> {
  const narrations = new Map<number, string>();
  const allSlideTitles = slides.map(s => s.title || 'Untitled');
  let previousNarrationTail = '';

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];

    if (!needsNarration(slide.speaker_notes)) {
      // Even if we skip narration, use existing notes for continuity tail
      if (slide.speaker_notes) {
        const words = stripCitations(slide.speaker_notes).split(/\s+/);
        previousNarrationTail = words.slice(Math.max(0, words.length - 100)).join(' ');
      }
      continue;
    }

    try {
      const narration = await generateNarration(
        slide,
        {
          slideIndex: i,
          totalSlides: slides.length,
          unitTitle,
          domain,
          previousNarrationTail,
          allSlideTitles,
        }
      );

      const order = slide.order ?? i;
      narrations.set(order, narration);

      // Update continuity tail
      const words = narration.split(/\s+/);
      previousNarrationTail = words.slice(Math.max(0, words.length - 100)).join(' ');

      // Small delay to avoid rate limiting
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Failed to generate narration for slide ${i + 1}:`, error);
    }
  }

  return narrations;
}
