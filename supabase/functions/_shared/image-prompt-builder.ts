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

export const IMAGE_PROMPT_WRITER_SYSTEM = `You are an expert at writing image generation prompts for Google's Imagen 4 Ultra model, specifically for university lecture slide visuals.

Your job: Given a slide's complete data (title, content, layout hints, pedagogy, speaker notes, visual directive), write ONE paragraph (80-150 words) describing the exact image to generate.

IMAGEN 4 ULTRA RULES — follow these precisely:

TEXT IN IMAGES:
- Maximum 5 text labels in the entire image
- Each label: maximum 2 common English words (e.g., "Input", "Step One", "Revenue")
- Wrap every label in quotes naturally: 'a box labeled "Revenue"' — not as a rule list
- Place labels inside shapes (boxes, circles, banners). Never floating text
- For terms longer than 2 words: use an icon instead, or shorten (e.g., "Customer Acquisition Cost" → "Acquisition")
- Prefer icons and symbols over text when possible

SPATIAL DESCRIPTION:
- Describe positions concretely: "on the far left", "in the center", "top row"
- For flows: describe left-to-right or top-to-bottom sequence explicitly
- For comparisons: describe "left panel" vs "right panel"
- For hierarchies: describe "at the top" flowing down to children

STYLE (always include):
- Clean flat design, white or light background
- Professional academic educational style
- Widescreen layout (do NOT write "16:9" — Imagen renders that as visible text)
- Blue and gray color palette for shapes. Use accent colors sparingly
- Simple flat icons relevant to each concept

CRITICAL — NEVER INCLUDE:
- Technical instructions like "16:9 aspect ratio", "48pt font", "PNG format"
- Headers, watermarks, or decorative text like "University of..." or course codes
- The word "slide" — describe the diagram/visual itself, not a slide containing it
- Bullet points, numbered lists, or structured formatting — write flowing prose only
- Vague descriptions — be specific about what every element looks like and where it goes

ADAPT TO SLIDE TYPE:
- "process" slides → sequential flowchart with numbered/ordered steps
- "definition" slides → the term prominently centered, with components around it
- "misconception" slides → contrast layout (wrong side vs correct side)
- "comparison" slides → side-by-side panels with contrasting visual treatment
- "example" slides → concrete illustration of the specific scenario mentioned
- "explanation" slides → relationship diagram showing how concepts connect

USE ALL AVAILABLE DATA:
- content.steps[].title → perfect flowchart labels (already short and ordered)
- content.key_points_layout[].segments → AI-optimized labels for flows
- content.key_points_layout[].left_right → comparison panel headings
- content.definition.term → the focal label for definition visuals
- content.misconception → wrong_belief vs correct_understanding for contrast visuals
- content.example.scenario → concrete imagery for illustrations
- speaker_notes → teaching emphasis (what the professor highlights = visual emphasis)
- pedagogy.bloom_action → visual complexity (remember=simple labels, analyze=relationships, evaluate=pros-cons)
- visual.description → the slide generator's intended visual (most important context)
- visual.elements[] → suggested diagram components

Write ONLY the image description paragraph. No preamble, no explanation.`;

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
  const vis = slide.visual_directive || slide.visual;
  const description = vis?.description || (vis as any)?.fallback_description || slide.title;
  const elements = vis?.elements || [];
  const topicContext = domain ? `${lectureTitle} in ${domain}` : lectureTitle;

  const labelText = elements.length > 0
    ? ` Key elements: ${elements.slice(0, 4).map(e => `"${String(e).split(' ').slice(0, 2).join(' ')}"`).join(', ')}.`
    : '';

  return `A clean academic diagram for a university lecture on ${topicContext}. ${description}.${labelText} Professional flat design, white background, blue and gray shapes, widescreen layout.`;
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
      MODELS.FAST,
      IMAGE_PROMPT_WRITER_SYSTEM,
      slideContext,
      {
        temperature: 0.4,
        max_tokens: 350,
        fallbacks: [MODELS.FAST_FALLBACK],
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
      .replace(/\b\d+:\d+\s*(aspect\s*ratio|format)\b/gi, 'widescreen')
      .replace(/\b\d+\s*pt\b/gi, 'large')
      .replace(/\bPNG\b/gi, '')
      .replace(/\bslide\b/gi, 'visual')
      .trim();

    console.log(`${logPrefix} Generated prompt (${cleaned.length} chars): ${cleaned.slice(0, 100)}...`);
    return cleaned;

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} LLM prompt generation failed: ${msg}, using fallback`);
    return buildFallbackPrompt(slide, lectureTitle, domain);
  }
}
