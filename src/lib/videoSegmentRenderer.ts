/**
 * Segment-Driven Video Renderer
 *
 * Renders dynamic sub-scenes within each slide based on the audio_segment_map.
 * Each segment gets unique Ken Burns motion, animated text overlays, and
 * cross-fade transitions — producing professional educational video output.
 */

const WIDTH = 1920;
const HEIGHT = 1080;

export interface SlideContent {
  main_text?: string;
  key_points?: (string | { text: string; hint?: string })[];
  definition?: {
    term: string;
    formal_definition?: string;
    simple_explanation?: string;
    meaning?: string;
  };
  example?: {
    scenario: string;
    walkthrough?: string;
    connection_to_concept?: string;
    explanation?: string;
  };
  steps?: { step: number; title: string; explanation: string }[];
}

export interface VideoSegment {
  target_block: string;
  start_percent: number;
  end_percent: number;
}

// ─── Ken Burns per-segment variety ───────────────────────────────────────────

interface KenBurnsParams {
  startScale: number;
  endScale: number;
  originX: number; // 0–1 normalized
  originY: number; // 0–1 normalized
  panX: number; // pixels to pan
  panY: number;
}

/** Deterministic variety — each segment index yields a different motion */
function getSegmentKenBurns(segmentIndex: number, totalSegments: number): KenBurnsParams {
  const presets: KenBurnsParams[] = [
    { startScale: 1.0, endScale: 1.06, originX: 0.5, originY: 0.5, panX: 0, panY: 0 },
    { startScale: 1.04, endScale: 1.04, originX: 0.5, originY: 0.5, panX: -30, panY: 0 },
    { startScale: 1.0, endScale: 1.07, originX: 0.7, originY: 0.3, panX: 0, panY: 0 },
    { startScale: 1.04, endScale: 1.04, originX: 0.5, originY: 0.5, panX: 20, panY: -10 },
    { startScale: 1.0, endScale: 1.05, originX: 0.3, originY: 0.7, panX: 0, panY: 0 },
    { startScale: 1.05, endScale: 1.05, originX: 0.5, originY: 0.5, panX: 0, panY: 15 },
    { startScale: 1.0, endScale: 1.06, originX: 0.6, originY: 0.4, panX: -15, panY: 5 },
    { startScale: 1.04, endScale: 1.04, originX: 0.5, originY: 0.5, panX: 25, panY: 0 },
  ];
  return presets[segmentIndex % presets.length];
}

/**
 * Draw the slide image with per-segment Ken Burns motion.
 */
export function drawSegmentKenBurns(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  segmentIndex: number,
  totalSegments: number,
  progress: number // 0–1 within this segment
) {
  const kb = getSegmentKenBurns(segmentIndex, totalSegments);

  const scale = kb.startScale + (kb.endScale - kb.startScale) * progress;
  const panX = kb.panX * progress;
  const panY = kb.panY * progress;

  ctx.save();

  // Translate to zoom origin, scale, translate back, then apply pan
  const ox = kb.originX * WIDTH;
  const oy = kb.originY * HEIGHT;
  ctx.translate(ox + panX, oy + panY);
  ctx.scale(scale, scale);
  ctx.translate(-ox, -oy);

  // Draw image covering the canvas (same logic as existing drawSlideFrame)
  const imgAspect = img.width / img.height;
  const canvasAspect = WIDTH / HEIGHT;
  let drawW: number, drawH: number, drawX: number, drawY: number;

  if (imgAspect > canvasAspect) {
    drawH = HEIGHT;
    drawW = HEIGHT * imgAspect;
    drawX = (WIDTH - drawW) / 2;
    drawY = 0;
  } else {
    drawW = WIDTH;
    drawH = WIDTH / imgAspect;
    drawX = 0;
    drawY = (HEIGHT - drawH) / 2;
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

// ─── Text overlay cards ─────────────────────────────────────────────────────

/** Word-wrap helper returning lines */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  fontWeight = 'normal'
): string[] {
  ctx.font = `${fontWeight} ${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draw a rounded-rect card with semi-transparent background */
function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bgColor: string,
  borderColor?: string
) {
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();

  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.stroke();
  }
}

/**
 * Draw the text overlay for the currently active segment.
 * fadeProgress: 0→1 for fade-in
 */
export function drawSegmentOverlay(
  ctx: CanvasRenderingContext2D,
  segment: VideoSegment,
  content: SlideContent,
  slideTitle: string,
  fadeProgress: number
) {
  ctx.globalAlpha = Math.min(1, fadeProgress);

  const block = segment.target_block;
  const cardX = WIDTH * 0.55;
  const cardW = WIDTH * 0.40;
  const cardY = HEIGHT * 0.12;

  if (block === 'main_text' && content.main_text) {
    drawMainTextOverlay(ctx, slideTitle, content.main_text, fadeProgress);
  } else if (block.startsWith('key_point_')) {
    const idx = parseInt(block.replace('key_point_', ''), 10);
    drawKeyPointOverlay(ctx, content.key_points, idx, cardX, cardY, cardW);
  } else if (block === 'definition' && content.definition) {
    drawDefinitionOverlay(ctx, content.definition, cardX, cardY, cardW);
  } else if (block === 'example' && content.example) {
    drawExampleOverlay(ctx, content.example, cardX, cardY, cardW);
  } else if (block.startsWith('step_') && content.steps) {
    const stepNum = parseInt(block.replace('step_', ''), 10);
    drawStepOverlay(ctx, content.steps, stepNum, cardX, cardY, cardW);
  }

  ctx.globalAlpha = 1;
}

function drawMainTextOverlay(
  ctx: CanvasRenderingContext2D,
  title: string,
  mainText: string,
  _fade: number
) {
  // Bottom-center overlay for title + main text
  const cardW = WIDTH * 0.7;
  const cardX = (WIDTH - cardW) / 2;
  const maxTextW = cardW - 48;

  const lines = wrapText(ctx, mainText, maxTextW, 22);
  const cardH = Math.min(280, 80 + lines.length * 30);
  const cardY = HEIGHT - cardH - 80;

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.7)', 'rgba(245, 167, 66, 0.4)');

  // Title
  ctx.fillStyle = '#F5A742';
  ctx.font = 'bold 26px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, cardX + 24, cardY + 20, maxTextW);

  // Main text
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px "Inter", system-ui, sans-serif';
  lines.forEach((line, i) => {
    if (i < 6) {
      ctx.fillText(line, cardX + 24, cardY + 56 + i * 30, maxTextW);
    }
  });
}

function drawKeyPointOverlay(
  ctx: CanvasRenderingContext2D,
  keyPoints: SlideContent['key_points'],
  activeIndex: number,
  cardX: number,
  cardY: number,
  cardW: number
) {
  if (!keyPoints?.length) return;

  const lineHeight = 36;
  const padding = 24;
  const cardH = Math.min(400, padding * 2 + keyPoints.length * (lineHeight + 12) + 20);

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.75)', 'rgba(245, 167, 66, 0.3)');

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  keyPoints.forEach((point, i) => {
    const text = typeof point === 'string' ? point : point.text;
    const yPos = cardY + padding + i * (lineHeight + 12);
    const isActive = i === activeIndex;

    // Bullet badge
    const badgeR = 14;
    const badgeCx = cardX + padding + badgeR;
    const badgeCy = yPos + lineHeight / 2;

    ctx.fillStyle = isActive ? '#F5A742' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isActive ? '#1a1025' : '#999999';
    ctx.font = 'bold 14px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, badgeCx, badgeCy);

    // Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255,255,255,0.4)';
    ctx.font = `${isActive ? 'bold' : 'normal'} 20px "Inter", system-ui, sans-serif`;

    const maxW = cardW - padding * 2 - badgeR * 2 - 16;
    const truncated = truncateText(ctx, text, maxW);
    ctx.fillText(truncated, badgeCx + badgeR + 12, yPos + 6, maxW);
  });
}

function drawDefinitionOverlay(
  ctx: CanvasRenderingContext2D,
  def: NonNullable<SlideContent['definition']>,
  cardX: number,
  cardY: number,
  cardW: number
) {
  const meaning = def.simple_explanation || def.formal_definition || def.meaning || '';
  const lines = wrapText(ctx, meaning, cardW - 48, 20);
  const cardH = Math.min(320, 100 + lines.length * 28);

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.8)', 'rgba(100, 200, 255, 0.5)');

  // "DEFINITION" label
  ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
  ctx.font = 'bold 14px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('DEFINITION', cardX + 24, cardY + 16);

  // Term
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Inter", system-ui, sans-serif';
  ctx.fillText(def.term, cardX + 24, cardY + 40, cardW - 48);

  // Meaning
  ctx.fillStyle = '#dddddd';
  ctx.font = '20px "Inter", system-ui, sans-serif';
  lines.forEach((line, i) => {
    if (i < 8) ctx.fillText(line, cardX + 24, cardY + 76 + i * 28, cardW - 48);
  });
}

function drawExampleOverlay(
  ctx: CanvasRenderingContext2D,
  ex: NonNullable<SlideContent['example']>,
  cardX: number,
  cardY: number,
  cardW: number
) {
  const text = ex.scenario || ex.explanation || ex.walkthrough || '';
  const lines = wrapText(ctx, text, cardW - 48, 20);
  const cardH = Math.min(340, 90 + lines.length * 28);

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.8)', 'rgba(245, 167, 66, 0.5)');

  ctx.fillStyle = 'rgba(245, 167, 66, 0.8)';
  ctx.font = 'bold 14px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('EXAMPLE', cardX + 24, cardY + 16);

  ctx.fillStyle = '#ffffff';
  ctx.font = '20px "Inter", system-ui, sans-serif';
  lines.forEach((line, i) => {
    if (i < 9) ctx.fillText(line, cardX + 24, cardY + 48 + i * 28, cardW - 48);
  });
}

function drawStepOverlay(
  ctx: CanvasRenderingContext2D,
  steps: NonNullable<SlideContent['steps']>,
  activeStepNum: number,
  cardX: number,
  cardY: number,
  cardW: number
) {
  const activeStep = steps.find((s) => s.step === activeStepNum);
  if (!activeStep) return;

  const lines = wrapText(ctx, activeStep.explanation, cardW - 48, 20);
  const cardH = Math.min(280, 100 + lines.length * 28);

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.8)', 'rgba(130, 230, 130, 0.4)');

  // Step badge
  ctx.fillStyle = 'rgba(130, 230, 130, 0.9)';
  ctx.font = 'bold 14px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`STEP ${activeStep.step} OF ${steps.length}`, cardX + 24, cardY + 16);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Inter", system-ui, sans-serif';
  ctx.fillText(activeStep.title, cardX + 24, cardY + 42, cardW - 48);

  // Explanation
  ctx.fillStyle = '#dddddd';
  ctx.font = '20px "Inter", system-ui, sans-serif';
  lines.forEach((line, i) => {
    if (i < 7) ctx.fillText(line, cardX + 24, cardY + 76 + i * 28, cardW - 48);
  });
}

// ─── Segment indicator badge ─────────────────────────────────────────────────

/** Draw "2 of 5" indicator in top-right corner */
export function drawSegmentIndicator(
  ctx: CanvasRenderingContext2D,
  currentSegment: number,
  totalSegments: number
) {
  if (totalSegments <= 1) return;

  const text = `${currentSegment + 1} / ${totalSegments}`;
  const padX = 16;
  const padY = 8;

  ctx.font = 'bold 16px "Inter", system-ui, sans-serif';
  const tw = ctx.measureText(text).width;
  const bw = tw + padX * 2;
  const bh = 32;
  const bx = WIDTH - bw - 20;
  const by = 20;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + bw / 2, by + bh / 2);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}
