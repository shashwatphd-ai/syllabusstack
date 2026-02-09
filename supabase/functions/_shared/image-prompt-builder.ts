// ============================================================================
// SHARED IMAGE PROMPT BUILDER - AI-powered Imagen 4 prompt generation
// ============================================================================
//
// CANONICAL SOURCE: Extracted from process-batch-images/index.ts
// Used by: process-batch-images, generate-slide-media
//
// Uses a fast cheap LLM (Gemini Flash Lite ~$0.00005/call) to write
// Imagen 4 Ultra prompts from full slide context.
//

import { simpleCompletion, MODELS } from './openrouter-client.ts';
import type { StoredSlide } from './slide-types.ts';

// ============================================================================
// IMAGE PROMPT WRITER SYSTEM PROMPT
// ============================================================================

export const IMAGE_PROMPT_WRITER_SYSTEM = `You are an expert educational diagram designer who writes image generation prompts for Google Imagen 4 Ultra.

Your job: Given a slide's data, write ONE paragraph (100-180 words) describing a specific, meaningful educational diagram.

CORE PRINCIPLE — CONTENT FIRST:
Every element in the image must directly represent a concept from the slide content. No decorative filler. If the slide discusses "WorldCom fraud vs Timberland sustainability", the image must show those specific companies/concepts, not generic arrows and gears.

IMAGEN 4 TEXT RULES:
- Maximum 4 text labels, each max 2 common English words
- Wrap labels in quotes naturally: 'a box labeled "Revenue"'
- Place labels inside shapes. Never floating text
- Prefer recognizable icons/symbols over text labels when possible

DIAGRAM TYPE — match to slide type:
- "process" → numbered step boxes connected by arrows, left-to-right
- "definition" → the term centered large, components radiating outward
- "misconception" → split layout: red-tinted left ("Wrong") vs green-tinted right ("Correct"), each with concrete imagery for the specific misconception described
- "comparison" → two distinct panels with contrasting visual metaphors specific to what's being compared
- "example" → a concrete scene illustrating the specific scenario from the slide, not abstract shapes
- "explanation" → relationship diagram showing how the specific concepts connect with labeled arrows
- "synthesis" → integration diagram showing how multiple specific ideas merge

VISUAL STYLE — adapt to content:
- Use colors that carry meaning: red/orange for problems/risks, green/blue for solutions/growth, gray for neutral
- For business topics: use building/office/chart metaphors
- For science: use lab/molecule/nature metaphors
- For ethics/philosophy: use scale/balance/people metaphors
- Background: white or very light gray
- Style: clean infographic, NOT clipart or stock icons

SPATIAL PRECISION:
- Describe exactly where each element sits: "on the far left", "center top", "bottom right corner"
- For flows: explicit left-to-right or top-to-bottom sequence
- For comparisons: "left half" vs "right half" with a clear divider

WHAT TO INCLUDE FROM SLIDE DATA:
- visual.description/fallback_description → the intended visual concept (most important)
- visual.elements[] → specific diagram components to depict
- content.misconception → wrong_belief vs correct_understanding for contrast visuals
- content.example.scenario → concrete imagery to illustrate
- content.steps[].title → flowchart node labels
- content.definition.term → the focal concept
- speaker_notes → what the professor emphasizes = what needs visual emphasis

NEVER INCLUDE:
- Technical metadata: "16:9", "PNG", "48pt", aspect ratios
- Decorative text: watermarks, course codes, "University of..."
- The word "slide" — describe the diagram itself
- Generic shapes with no connection to the content (random gears, arrows, circles)
- Vague descriptions — every element must represent something specific from the slide

Write ONLY the image description paragraph. No preamble.`;

// ============================================================================
// SLIDE CONTEXT SERIALIZER
// ============================================================================

export function serializeSlideContext(
  slide: StoredSlide,
  lectureTitle: string,
  domain?: string
): string {
  const parts: string[] = [];

  parts.push(`LECTURE: ${lectureTitle}${domain ? ` (${domain})` : ''}`);
  parts.push(`SLIDE TYPE: ${slide.type}`);
  parts.push(`SLIDE TITLE: ${slide.title}`);

  // Visual directive / visual — the slide generator's intended image
  const vis = slide.visual_directive || slide.visual;
  if (vis) {
    if ('description' in vis && vis.description) {
      parts.push(`VISUAL DESCRIPTION: ${vis.description}`);
    } else if ('fallback_description' in vis && (vis as any).fallback_description) {
      parts.push(`VISUAL DESCRIPTION: ${(vis as any).fallback_description}`);
    }
    if (vis.elements?.length) parts.push(`VISUAL ELEMENTS: ${vis.elements.join(', ')}`);
    if (vis.style) parts.push(`VISUAL STYLE: ${vis.style}`);
    if (vis.educational_purpose) parts.push(`VISUAL PURPOSE: ${vis.educational_purpose}`);
    if ('type' in vis && vis.type) parts.push(`VISUAL TYPE: ${vis.type}`);
  }

  // Content fields
  const c = slide.content || {};
  if (c.main_text) parts.push(`MAIN TEXT: ${c.main_text}`);

  if (c.main_text_layout && c.main_text_layout.type !== 'plain') {
    parts.push(`MAIN TEXT LAYOUT: ${JSON.stringify(c.main_text_layout)}`);
  }

  if (c.key_points?.length) {
    parts.push(`KEY POINTS:\n${c.key_points.map((kp: string, i: number) => `  ${i + 1}. ${kp}`).join('\n')}`);
  }

  if (c.key_points_layout?.length) {
    const meaningful = c.key_points_layout.filter((l: any) => l.type !== 'plain');
    if (meaningful.length > 0) {
      parts.push(`KEY POINTS LAYOUT: ${JSON.stringify(meaningful)}`);
    }
  }

  if (c.steps?.length) {
    parts.push(`STEPS:\n${c.steps.map((s: any) => `  ${s.step}. ${s.title}: ${s.explanation}`).join('\n')}`);
  }

  if (c.definition) {
    parts.push(`DEFINITION: Term="${c.definition.term}" | ${c.definition.formal_definition} | Simple: ${c.definition.simple_explanation}`);
  }

  if (c.example) {
    parts.push(`EXAMPLE: Scenario="${c.example.scenario}" | Walkthrough: ${c.example.walkthrough}`);
  }

  if (c.misconception) {
    parts.push(`MISCONCEPTION: Wrong="${c.misconception.wrong_belief}" | Why Wrong: ${c.misconception.why_wrong} | Correct: ${c.misconception.correct_understanding}`);
  }

  // Pedagogy
  if (slide.pedagogy) {
    const p = slide.pedagogy;
    if (p.bloom_action) parts.push(`BLOOM LEVEL: ${p.bloom_action}`);
    if (p.purpose) parts.push(`PEDAGOGICAL PURPOSE: ${p.purpose}`);
  }

  // Speaker notes — teaching emphasis
  if (slide.speaker_notes) {
    parts.push(`SPEAKER NOTES: ${slide.speaker_notes.slice(0, 500)}`);
  }

  return parts.join('\n');
}

// ============================================================================
// SLIDE IMAGE NEED CHECK
// ============================================================================

export function slideNeedsImage(slide: StoredSlide): boolean {
  // Skip if already has image
  if (slide.visual?.url) return false;

  // Skip types that don't need visuals
  const skipTypes = ['conclusion', 'recap', 'further_reading', 'title'];
  if (skipTypes.includes(slide.type?.toLowerCase() || '')) return false;

  // Has explicit visual directive or visual with a type
  if (slide.visual_directive?.type && slide.visual_directive.type !== 'none') return true;
  if (slide.visual?.type && slide.visual.type !== 'none') return true;

  // Has enough content to generate a meaningful visual
  const c = slide.content || {};
  return !!(c.main_text || c.key_points?.length || c.steps?.length || c.definition);
}

// ============================================================================
// FALLBACK PROMPT (static, when LLM fails)
// ============================================================================

export function buildFallbackPrompt(slide: StoredSlide, lectureTitle: string, domain?: string): string {
  const description = slide.visual_directive?.description
    || slide.visual?.fallback_description
    || slide.title;
  const elements = slide.visual_directive?.elements || slide.visual?.elements || [];
  const topicContext = domain ? `${lectureTitle} in ${domain}` : lectureTitle;
  const slideType = slide.type?.toLowerCase() || 'explanation';

  // Build content-specific details
  const contentDetails: string[] = [];
  const c = slide.content || {};

  if (c.misconception) {
    contentDetails.push(`Split layout: left side in red tones showing "${c.misconception.wrong_belief?.slice(0, 40)}", right side in green tones showing "${c.misconception.correct_understanding?.slice(0, 40)}"`);
  } else if (c.definition) {
    contentDetails.push(`The term "${c.definition.term}" displayed prominently in the center with its components arranged around it`);
  } else if (c.example?.scenario) {
    contentDetails.push(`A concrete illustration of: ${c.example.scenario.slice(0, 80)}`);
  } else if (c.steps?.length) {
    const stepLabels = c.steps.slice(0, 4).map((s: any) => `"${String(s.title).slice(0, 15)}"`).join(', ');
    contentDetails.push(`A sequential flowchart with steps: ${stepLabels}`);
  } else if (elements.length > 0) {
    contentDetails.push(`Key elements: ${elements.slice(0, 4).map(e => `"${String(e).split(' ').slice(0, 3).join(' ')}"`).join(', ')}`);
  }

  // Style based on slide type
  let styleHint = 'clean infographic style, white background';
  if (slideType === 'misconception') {
    styleHint = 'contrast layout with red and green tones, white background';
  } else if (slideType === 'comparison' || slideType === 'example') {
    styleHint = 'side-by-side panel layout with distinct colors per side, white background';
  } else if (slideType === 'process' || slideType === 'demonstration') {
    styleHint = 'horizontal flowchart with connected steps, white background';
  }

  const details = contentDetails.length > 0 ? ` ${contentDetails.join('. ')}.` : '';

  return `An educational diagram for a university lecture on ${topicContext}. ${description}.${details} ${styleHint}, professional academic design.`;
}

// ============================================================================
// AI-POWERED IMAGE PROMPT BUILDER
// ============================================================================

export async function buildImagePrompt(
  slide: StoredSlide,
  lectureTitle: string,
  domain?: string
): Promise<string> {
  if (!slideNeedsImage(slide)) return '';

  const slideContext = serializeSlideContext(slide, lectureTitle, domain);
  const logPrefix = `[PromptGen ${slide.title?.slice(0, 30)}]`;

  try {
    console.log(`${logPrefix} Generating image prompt via LLM...`);

    const prompt = await simpleCompletion(
      MODELS.GEMINI_FLASH,
      IMAGE_PROMPT_WRITER_SYSTEM,
      slideContext,
      {
        temperature: 0.7,
        max_tokens: 500,
        fallbacks: [MODELS.FAST],
      },
      logPrefix,
    );

    const trimmed = prompt.trim();

    // Validate: must be a reasonable paragraph, not empty or error-like
    if (trimmed.length < 30) {
      console.warn(`${logPrefix} LLM returned too-short prompt (${trimmed.length} chars), using fallback`);
      return buildFallbackPrompt(slide, lectureTitle, domain);
    }

    // Safety: strip any meta-instructions the LLM might have accidentally included
    const cleaned = trimmed
      .replace(/\b\d+:\d+\s*(aspect\s*ratio|format)\b/gi, '')
      .replace(/\b\d+\s*pt\b/gi, '')
      .replace(/\bPNG\b/gi, '')
      .replace(/\b(16:9|9:16|4:3|aspect ratio)\b/gi, '')
      .trim();

    console.log(`${logPrefix} Generated prompt (${cleaned.length} chars): ${cleaned.slice(0, 100)}...`);
    return cleaned;

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} LLM prompt generation failed: ${msg}, using fallback`);
    return buildFallbackPrompt(slide, lectureTitle, domain);
  }
}
