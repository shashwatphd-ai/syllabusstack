// ============================================================================
// SHARED QUALITY METRICS - Slide quality scoring (logging only, not a gate)
// ============================================================================
//
// CANONICAL SOURCE: Extracted from generate-lecture-slides-v3/index.ts
// Used by: generate-lecture-slides-v3, generate-batch-slides
//

import type { ProfessorSlide } from './slide-types.ts';

export interface QualityResult {
  score: number;
  metrics: Record<string, number>;
  warnings: string[];
}

export function calculateQualityMetrics(slides: ProfessorSlide[]): QualityResult {
  const warnings: string[] = [];
  const metrics: Record<string, number> = {
    avgMainTextWords: 0,
    avgSpeakerNotesWords: 0,
    avgKeyPointsPerSlide: 0,
    citationCount: 0,
    slidesWithMisconception: 0,
    slidesWithDefinition: 0,
    shortVisualDescriptions: 0,
  };

  let totalMainTextWords = 0;
  let totalSpeakerNotesWords = 0;
  let totalKeyPoints = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const slideLabel = `Slide ${i + 1} (${slide.type})`;

    // Main text length
    const mainTextWords = (slide.content?.main_text || '').split(/\s+/).filter(Boolean).length;
    totalMainTextWords += mainTextWords;
    if (mainTextWords < 30) {
      warnings.push(`${slideLabel}: main_text only ${mainTextWords} words (target: 50+)`);
    }

    // Speaker notes length
    const speakerNotesWords = (slide.speaker_notes || '').split(/\s+/).filter(Boolean).length;
    totalSpeakerNotesWords += speakerNotesWords;
    if (speakerNotesWords < 150) {
      warnings.push(`${slideLabel}: speaker_notes only ${speakerNotesWords} words (target: 200+)`);
    }

    // Key points count
    const keyPointsCount = slide.content?.key_points?.length || 0;
    totalKeyPoints += keyPointsCount;

    // Visual directive length
    const visualDescWords = (slide.visual_directive?.description || '').split(/\s+/).filter(Boolean).length;
    if (slide.visual_directive?.type && slide.visual_directive.type !== 'none' && visualDescWords < 50) {
      metrics.shortVisualDescriptions++;
      warnings.push(`${slideLabel}: visual description only ${visualDescWords} words (target: 50+)`);
    }

    // Misconception/definition presence
    if (slide.content?.misconception) metrics.slidesWithMisconception++;
    if (slide.content?.definition) metrics.slidesWithDefinition++;

    // Check for N/A placeholders
    const jsonStr = JSON.stringify(slide.content);
    if (jsonStr.includes('"N/A"') || jsonStr.includes('"Not applicable"') || jsonStr.includes('"n/a"')) {
      warnings.push(`${slideLabel}: Contains N/A placeholder`);
    }
  }

  // Citation count across all content
  const allContent = slides.map(s => JSON.stringify(s.content)).join(' ');
  const citationMatches = allContent.match(/\[Source \d+\]/g) || [];
  metrics.citationCount = citationMatches.length;

  // Calculate averages
  metrics.avgMainTextWords = Math.round(totalMainTextWords / slides.length);
  metrics.avgSpeakerNotesWords = Math.round(totalSpeakerNotesWords / slides.length);
  metrics.avgKeyPointsPerSlide = Math.round((totalKeyPoints / slides.length) * 10) / 10;

  // Score calculation
  let score = 70; // Base score

  // Content depth bonuses
  if (metrics.avgMainTextWords >= 50) score += 5;
  if (metrics.avgSpeakerNotesWords >= 200) score += 10;
  if (metrics.avgKeyPointsPerSlide >= 3) score += 5;

  // Structure bonuses
  if (metrics.slidesWithMisconception > 0) score += 5;
  if (metrics.slidesWithDefinition > 0) score += 5;

  // Citation bonus
  if (metrics.citationCount >= 3) score += 5;

  // Penalties
  score -= warnings.length * 2; // 2 points per warning

  return {
    score: Math.max(0, Math.min(100, score)),
    metrics,
    warnings,
  };
}
