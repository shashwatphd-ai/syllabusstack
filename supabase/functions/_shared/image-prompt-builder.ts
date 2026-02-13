// ============================================================================
// SHARED IMAGE PROMPT BUILDER - AI-powered image prompt generation
// ============================================================================
//
// CANONICAL SOURCE: Extracted from process-batch-images/index.ts
// Used by: process-batch-images, generate-slide-media
//
// Uses a fast cheap LLM (Gemini 2.5 Flash ~$0.00005/call) to write
// optimized prompts for Gemini image generation from full slide context.
//

import { simpleCompletion, MODELS } from './openrouter-client.ts';
import type { StoredSlide } from './slide-types.ts';

// ============================================================================
// IMAGE PROMPT WRITER SYSTEM PROMPT
// ============================================================================

export const IMAGE_PROMPT_WRITER_SYSTEM = `You are an expert academic visual designer who writes image generation prompts for Google Gemini's native image generation model.

Your job: Given a slide's data, write ONE paragraph (100-180 words) describing the single best visual to support this slide in a university lecture.

DECISION PROCESS — read ALL context, then choose:
1. VISUAL DESCRIPTION field (from Professor AI) is your primary signal — it tells you what the instructor envisioned
2. Slide TYPE and CONTENT fields tell you what's being taught
3. DOMAIN and LECTURE TITLE tell you the academic field
4. SPEAKER NOTES tell you what the professor emphasizes

FORMAT SELECTION — match to content, not to a template:
- Frameworks & models (Porter's Five Forces, SWOT, supply/demand) → faithfully reproduce the canonical diagram
- Processes & workflows → sequential flowchart with labeled steps
- Comparisons & contrasts → side-by-side layout with visual differentiation
- Case studies & real-world scenarios → realistic scene depicting the specific situation
- Data & statistics → precise chart or graph
- Equations & formulas → cleanly rendered mathematical notation
- Definitions & concepts → central term with radiating components
- Misconceptions → clear visual contrast between wrong and correct understanding
- Abstract theories → conceptual diagram showing relationships

TEXT LABEL RULES:
- Maximum 6 text labels, each max 3-4 common English words
- Wrap labels in quotes naturally: 'a box labeled "Revenue Growth"'
- Place labels inside shapes or directly adjacent — never floating
- Every label must be a real term from the slide content
- SPELL EVERY LABEL CORRECTLY — double-check against the slide data

SPATIAL PRECISION:
- Describe exactly where each element sits: "on the far left", "center top", "bottom right corner"
- For flows: explicit left-to-right or top-to-bottom sequence
- For comparisons: "left half" vs "right half" with a clear divider

WHAT TO INCLUDE FROM SLIDE DATA:
- visual.description/fallback_description → the intended visual concept (most important)
- visual.elements[] → specific diagram components to depict
- content.misconception → wrong_belief vs correct_understanding for contrast
- content.example.scenario → concrete imagery to illustrate
- content.steps[].title → flowchart node labels
- content.definition.term → the focal concept
- speaker_notes → what the professor emphasizes = what needs visual emphasis

NEVER INCLUDE:
- Technical metadata: "16:9", "PNG", "48pt", aspect ratios
- Decorative text: watermarks, course codes, "University of..."
- The word "slide" — describe the visual itself
- Generic shapes with no connection to the content
- Vague descriptions — every element must represent something specific from the slide

OUTPUT:
- Write a single descriptive paragraph, no preamble
- Be specific about colors, shapes, positions, and labels
- End with a brief style note appropriate to the content (e.g., "Clean diagram style" for frameworks, "Realistic illustration" for scenarios, "Precise technical rendering" for equations)

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
  const skipTypes = ['conclusion', 'recap', 'further_reading', 'title', 'title_slide', 'summary', 'preview'];
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
  let styleHint = 'professional academic visual, clear and well-composed';
  if (slideType === 'misconception') {
    styleHint = 'clear visual contrast between incorrect and correct understanding';
  } else if (slideType === 'comparison' || slideType === 'example') {
    styleHint = 'well-structured layout with distinct visual sections';
  } else if (slideType === 'process' || slideType === 'demonstration') {
    styleHint = 'sequential visual showing connected steps';
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
        temperature: 0.4,
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
