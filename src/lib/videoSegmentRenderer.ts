/**
 * Segment-Driven Video Renderer
 *
 * Renders dynamic sub-scenes within each slide based on the audio_segment_map.
 * Each segment gets unique Ken Burns motion and a compact bottom overlay
 * with progressive reveal for key points.
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
  originX: number;
  originY: number;
  panX: number;
  panY: number;
}

function getSegmentKenBurns(segmentIndex: number): KenBurnsParams {
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

export function drawSegmentKenBurns(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  segmentIndex: number,
  _totalSegments: number,
  progress: number
) {
  const kb = getSegmentKenBurns(segmentIndex);
  const scale = kb.startScale + (kb.endScale - kb.startScale) * progress;
  const panX = kb.panX * progress;
  const panY = kb.panY * progress;

  ctx.save();
  const ox = kb.originX * WIDTH;
  const oy = kb.originY * HEIGHT;
  ctx.translate(ox + panX, oy + panY);
  ctx.scale(scale, scale);
  ctx.translate(-ox, -oy);

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

// ─── Compact bottom overlay ─────────────────────────────────────────────────

/** Word-wrap helper */
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

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  bgColor: string, borderColor?: string, borderRadius = 12
) {
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, borderRadius);
  ctx.fill();
  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, borderRadius);
    ctx.stroke();
  }
}

/**
 * Draw a compact bottom overlay for the active segment.
 * Key points use progressive reveal (only show up to active index).
 * All overlays sit at the bottom to avoid covering the slide image.
 */
export function drawSegmentOverlay(
  ctx: CanvasRenderingContext2D,
  segment: VideoSegment,
  content: SlideContent,
  _slideTitle: string,
  fadeProgress: number
) {
  ctx.globalAlpha = Math.min(1, fadeProgress);

  const block = segment.target_block;

  if (block === 'main_text' && content.main_text) {
    drawCompactMainText(ctx, content.main_text);
  } else if (block.startsWith('key_point_')) {
    const idx = parseInt(block.replace('key_point_', ''), 10);
    drawProgressiveKeyPoint(ctx, content.key_points, idx);
  } else if (block === 'definition' && content.definition) {
    drawCompactDefinition(ctx, content.definition);
  } else if (block === 'example' && content.example) {
    drawCompactExample(ctx, content.example);
  } else if (block.startsWith('step_') && content.steps) {
    const stepNum = parseInt(block.replace('step_', ''), 10);
    drawCompactStep(ctx, content.steps, stepNum);
  }

  ctx.globalAlpha = 1;
}

// ─── Individual overlay renderers (compact, bottom-positioned) ──────────────

function drawCompactMainText(ctx: CanvasRenderingContext2D, text: string) {
  const cardW = WIDTH * 0.6;
  const cardX = (WIDTH - cardW) / 2;
  const maxW = cardW - 40;
  const lines = wrapText(ctx, text, maxW, 20);
  const visibleLines = lines.slice(0, 3);
  const cardH = 24 + visibleLines.length * 28;
  const cardY = HEIGHT - 80 - cardH;

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.65)', undefined, 10);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '20px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  visibleLines.forEach((line, i) => {
    ctx.fillText(line, cardX + 20, cardY + 12 + i * 28, maxW);
  });
}

/**
 * Progressive key point: shows only the current active point
 * as a single compact card at the bottom.
 */
function drawProgressiveKeyPoint(
  ctx: CanvasRenderingContext2D,
  keyPoints: SlideContent['key_points'],
  activeIndex: number
) {
  if (!keyPoints?.length) return;

  const point = keyPoints[activeIndex];
  if (!point) return;
  const text = typeof point === 'string' ? point : point.text;
  const total = keyPoints.length;

  const cardW = WIDTH * 0.55;
  const cardX = (WIDTH - cardW) / 2;
  const maxW = cardW - 80;
  const lines = wrapText(ctx, text, maxW, 20, 'normal');
  const visibleLines = lines.slice(0, 3);
  const cardH = 28 + visibleLines.length * 28;
  const cardY = HEIGHT - 80 - cardH;

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.7)', 'rgba(245, 167, 66, 0.4)', 10);

  // Number badge
  const badgeR = 14;
  const badgeCx = cardX + 24 + badgeR;
  const badgeCy = cardY + cardH / 2;

  ctx.fillStyle = '#F5A742';
  ctx.beginPath();
  ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1025';
  ctx.font = 'bold 15px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${activeIndex + 1}`, badgeCx, badgeCy);

  // Text
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px "Inter", system-ui, sans-serif';
  const textX = badgeCx + badgeR + 14;
  visibleLines.forEach((line, i) => {
    ctx.fillText(line, textX, cardY + 14 + i * 28, maxW);
  });

  // Progress dots (right side)
  const dotsStartX = cardX + cardW - 20 - total * 14;
  const dotsY = cardY + cardH / 2;
  for (let d = 0; d < total; d++) {
    ctx.fillStyle = d <= activeIndex ? '#F5A742' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(dotsStartX + d * 14, dotsY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCompactDefinition(
  ctx: CanvasRenderingContext2D,
  def: NonNullable<SlideContent['definition']>
) {
  const meaning = def.simple_explanation || def.formal_definition || def.meaning || '';
  const cardW = WIDTH * 0.55;
  const cardX = (WIDTH - cardW) / 2;
  const maxW = cardW - 40;
  const lines = wrapText(ctx, meaning, maxW, 18);
  const visibleLines = lines.slice(0, 3);
  const cardH = 52 + visibleLines.length * 26;
  const cardY = HEIGHT - 80 - cardH;

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.7)', 'rgba(100, 200, 255, 0.4)', 10);

  // Label + term on one line
  ctx.fillStyle = 'rgba(100, 200, 255, 0.9)';
  ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('DEFINITION', cardX + 20, cardY + 10);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Inter", system-ui, sans-serif';
  ctx.fillText(def.term, cardX + 20, cardY + 28, maxW);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '18px "Inter", system-ui, sans-serif';
  visibleLines.forEach((line, i) => {
    ctx.fillText(line, cardX + 20, cardY + 54 + i * 26, maxW);
  });
}

function drawCompactExample(
  ctx: CanvasRenderingContext2D,
  ex: NonNullable<SlideContent['example']>
) {
  const text = ex.scenario || ex.explanation || ex.walkthrough || '';
  const cardW = WIDTH * 0.55;
  const cardX = (WIDTH - cardW) / 2;
  const maxW = cardW - 40;
  const lines = wrapText(ctx, text, maxW, 18);
  const visibleLines = lines.slice(0, 3);
  const cardH = 36 + visibleLines.length * 26;
  const cardY = HEIGHT - 80 - cardH;

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.7)', 'rgba(245, 167, 66, 0.4)', 10);

  ctx.fillStyle = 'rgba(245, 167, 66, 0.9)';
  ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('EXAMPLE', cardX + 20, cardY + 10);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '18px "Inter", system-ui, sans-serif';
  visibleLines.forEach((line, i) => {
    ctx.fillText(line, cardX + 20, cardY + 32 + i * 26, maxW);
  });
}

function drawCompactStep(
  ctx: CanvasRenderingContext2D,
  steps: NonNullable<SlideContent['steps']>,
  activeStepNum: number
) {
  const activeStep = steps.find((s) => s.step === activeStepNum);
  if (!activeStep) return;

  const cardW = WIDTH * 0.55;
  const cardX = (WIDTH - cardW) / 2;
  const maxW = cardW - 40;
  const lines = wrapText(ctx, activeStep.explanation, maxW, 18);
  const visibleLines = lines.slice(0, 3);
  const cardH = 52 + visibleLines.length * 26;
  const cardY = HEIGHT - 80 - cardH;

  drawCard(ctx, cardX, cardY, cardW, cardH, 'rgba(0, 0, 0, 0.7)', 'rgba(130, 230, 130, 0.4)', 10);

  ctx.fillStyle = 'rgba(130, 230, 130, 0.9)';
  ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`STEP ${activeStep.step} OF ${steps.length}`, cardX + 20, cardY + 10);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Inter", system-ui, sans-serif';
  ctx.fillText(activeStep.title, cardX + 20, cardY + 28, maxW);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '18px "Inter", system-ui, sans-serif';
  visibleLines.forEach((line, i) => {
    ctx.fillText(line, cardX + 20, cardY + 54 + i * 26, maxW);
  });
}

// ─── Segment indicator badge ─────────────────────────────────────────────────

export function drawSegmentIndicator(
  ctx: CanvasRenderingContext2D,
  currentSegment: number,
  totalSegments: number
) {
  if (totalSegments <= 1) return;

  const text = `${currentSegment + 1} / ${totalSegments}`;
  const padX = 12;
  ctx.font = 'bold 14px "Inter", system-ui, sans-serif';
  const tw = ctx.measureText(text).width;
  const bw = tw + padX * 2;
  const bh = 28;
  const bx = WIDTH - bw - 16;
  const by = 16;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + bw / 2, by + bh / 2);
}
