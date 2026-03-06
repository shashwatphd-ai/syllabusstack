/**
 * Client-side Video Exporter
 *
 * Composites lecture slide images + audio into a branded WebM video
 * using OffscreenCanvas and MediaRecorder. Includes SyllabusStack branding,
 * Ken Burns motion, and YouTube chapter markers.
 */

import { supabase } from '@/integrations/supabase/client';
import { parseSegmentMap } from '@/hooks/useSlideSync';
import {
  drawSegmentKenBurns,
  drawSegmentOverlay,
  drawSegmentIndicator,
  type SlideContent,
  type VideoSegment,
} from '@/lib/videoSegmentRenderer';

export interface VideoSlide {
  title: string;
  imageUrl: string; // relative storage path in lecture-visuals
  audioUrl?: string; // relative storage path in lecture-audio
  durationSeconds: number;
  speakerNotes?: string;
  /** Optional structured content for segment-driven overlays */
  content?: {
    main_text?: string;
    key_points?: (string | { text: string; hint?: string })[];
    definition?: { term: string; formal_definition?: string; simple_explanation?: string; meaning?: string };
    example?: { scenario: string; walkthrough?: string; connection_to_concept?: string; explanation?: string };
    steps?: { step: number; title: string; explanation: string }[];
  };
  /** Optional segment map for visual scene sequencing */
  segmentMap?: { target_block: string; start_percent: number; end_percent: number }[];
}

export interface VideoBranding {
  courseTitle: string;
  unitTitle: string;
  instructorName?: string;
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'encoding' | 'done';
  currentSlide: number;
  totalSlides: number;
  percent: number;
}

export interface ExportResult {
  videoBlob: Blob;
  chapterMarkers: string;
  filename: string;
}

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const INTRO_DURATION = 3; // seconds
const OUTRO_DURATION = 4;

/** Fetch a signed URL for a storage path */
async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  if (!path || path.trim() === '') return null;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) {
      console.warn(`[VideoExport] Signed URL error for ${bucket}/${path}:`, error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (err) {
    console.warn(`[VideoExport] Exception getting signed URL for ${bucket}/${path}:`, err);
    return null;
  }
}

/** Create a placeholder image for slides without visuals */
function createPlaceholderImage(title: string): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const pCtx = canvas.getContext('2d')!;
  const grad = pCtx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, '#1a1025');
  grad.addColorStop(1, '#2d1f3d');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, WIDTH, HEIGHT);
  pCtx.fillStyle = '#ffffff';
  pCtx.font = 'bold 48px "Inter", system-ui, sans-serif';
  pCtx.textAlign = 'center';
  pCtx.textBaseline = 'middle';
  pCtx.fillText(title, WIDTH / 2, HEIGHT / 2);
  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

/** Load an image from URL into an ImageBitmap */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Draw text centered on canvas */
function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  fontSize: number,
  color: string,
  maxWidth = WIDTH - 200
) {
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Word wrap
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.3;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, WIDTH / 2, startY + i * lineHeight, maxWidth);
  });
}

/** Draw branded intro frame */
function drawIntroFrame(
  ctx: CanvasRenderingContext2D,
  branding: VideoBranding,
  _frame: number,
  totalFrames: number
) {
  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, '#1a1025');
  grad.addColorStop(0.5, '#2d1b4e');
  grad.addColorStop(1, '#1a1025');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Fade in
  const alpha = Math.min(1, _frame / (totalFrames * 0.3));
  ctx.globalAlpha = alpha;

  // SyllabusStack logo text
  drawCenteredText(ctx, 'SyllabusStack', HEIGHT * 0.32, 72, '#F5A742');

  // Course title
  drawCenteredText(ctx, branding.courseTitle, HEIGHT * 0.48, 48, '#ffffff');

  // Unit title
  drawCenteredText(ctx, branding.unitTitle, HEIGHT * 0.58, 36, '#cccccc');

  // Instructor
  if (branding.instructorName) {
    drawCenteredText(ctx, `by ${branding.instructorName}`, HEIGHT * 0.68, 28, '#999999');
  }

  ctx.globalAlpha = 1;
}

/** Draw branded outro frame */
function drawOutroFrame(ctx: CanvasRenderingContext2D, branding: VideoBranding) {
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, '#1a1025');
  grad.addColorStop(1, '#0d0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawCenteredText(ctx, 'SyllabusStack', HEIGHT * 0.35, 64, '#F5A742');
  drawCenteredText(ctx, 'Created with SyllabusStack', HEIGHT * 0.48, 32, '#cccccc');
  drawCenteredText(ctx, branding.courseTitle, HEIGHT * 0.58, 28, '#999999');

  // Subscribe CTA
  ctx.fillStyle = '#F5A742';
  const ctaW = 340;
  const ctaH = 56;
  const ctaX = (WIDTH - ctaW) / 2;
  const ctaY = HEIGHT * 0.72;
  ctx.beginPath();
  ctx.roundRect(ctaX, ctaY, ctaW, ctaH, 28);
  ctx.fill();

  ctx.fillStyle = '#1a1025';
  ctx.font = 'bold 22px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Subscribe for more', WIDTH / 2, ctaY + ctaH / 2);
}

/** Draw a slide frame with Ken Burns effect */
function drawSlideFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slideIndex: number,
  frameInSlide: number,
  totalFramesInSlide: number,
  slideTitle: string,
  slideNumber: number,
  totalSlides: number,
  totalElapsedSeconds: number,
  totalVideoSeconds: number
) {
  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Ken Burns: alternate between zoom-in and pan
  const progress = frameInSlide / totalFramesInSlide;
  const isZoom = slideIndex % 2 === 0;

  ctx.save();
  if (isZoom) {
    // Slow zoom from 1.0 to 1.06
    const scale = 1 + progress * 0.06;
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(scale, scale);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);
  } else {
    // Slow pan left to right
    const panX = -20 + progress * 40;
    ctx.translate(panX, 0);
    const scale = 1.04;
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(scale, scale);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);
  }

  // Draw image covering the canvas
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

  // Watermark - bottom right
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#F5A742';
  ctx.font = 'bold 18px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('SyllabusStack', WIDTH - 24, HEIGHT - 20);
  ctx.globalAlpha = 1;

  // Lower-third branded bar with current topic
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, HEIGHT - 60, WIDTH, 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = '20px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${slideNumber}/${totalSlides}  •  ${slideTitle}`, 24, HEIGHT - 30);

  // Progress bar at very bottom
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(0, HEIGHT - 4, WIDTH, 4);
  ctx.fillStyle = '#F5A742';
  const progressWidth = (totalElapsedSeconds / totalVideoSeconds) * WIDTH;
  ctx.fillRect(0, HEIGHT - 4, progressWidth, 4);
}

/** Generate YouTube chapter markers text */
function generateChapterMarkers(
  slides: VideoSlide[],
  introDuration: number
): string {
  let elapsed = 0;
  const lines: string[] = [];

  // Intro
  lines.push(`0:00 Introduction`);
  elapsed += introDuration;

  for (const slide of slides) {
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const ts = `${mins}:${secs.toString().padStart(2, '0')}`;
    lines.push(`${ts} ${slide.title}`);
    elapsed += slide.durationSeconds;
  }

  return lines.join('\n');
}

/**
 * Main export function: renders slides + audio into a branded video.
 */
export async function renderLectureVideo(
  slides: VideoSlide[],
  branding: VideoBranding,
  selectedVoice: string,
  onProgress: (progress: ExportProgress) => void
): Promise<ExportResult> {
  const totalSlides = slides.length;

  onProgress({ phase: 'preparing', currentSlide: 0, totalSlides, percent: 0 });

  // 1. Pre-load all slide images
  const slideImages: (HTMLImageElement | null)[] = [];
  for (let i = 0; i < slides.length; i++) {
    const imgPath = slides[i].imageUrl;
    if (!imgPath) {
      console.warn(`[VideoExport] Slide ${i + 1} has no image path, using placeholder`);
      slideImages.push(null);
    } else {
      const signedUrl = await getSignedUrl('lecture-visuals', imgPath);
      if (!signedUrl) {
        console.warn(`[VideoExport] Failed to get signed URL for slide ${i + 1}, path: "${imgPath}"`);
        slideImages.push(null);
      } else {
        const img = await loadImage(signedUrl);
        slideImages.push(img);
      }
    }
    onProgress({ phase: 'preparing', currentSlide: i + 1, totalSlides, percent: ((i + 1) / totalSlides) * 30 });
  }

  // 2. Pre-load audio files
  const audioBuffers: ArrayBuffer[] = [];
  const audioContext = new AudioContext();
  for (let i = 0; i < slides.length; i++) {
    const audioPath = slides[i].audioUrl;
    if (audioPath) {
      const signedUrl = await getSignedUrl('lecture-audio', audioPath);
      if (signedUrl) {
        const resp = await fetch(signedUrl);
        const buf = await resp.arrayBuffer();
        audioBuffers.push(buf);
      } else {
        audioBuffers.push(new ArrayBuffer(0));
      }
    } else {
      audioBuffers.push(new ArrayBuffer(0));
    }
  }

  onProgress({ phase: 'rendering', currentSlide: 0, totalSlides, percent: 30 });

  // 3. Set up canvas + MediaRecorder
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Use captureStream(0) for manual frame control — no automatic sampling
  const canvasStream = canvas.captureStream(0);
  const videoTrack = canvasStream.getVideoTracks()[0] as any;

  // Mix in audio via AudioContext → MediaStreamDestination
  const audioDest = audioContext.createMediaStreamDestination();
  canvasStream.addTrack(audioDest.stream.getAudioTracks()[0]);

  const recorder = new MediaRecorder(canvasStream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm',
    videoBitsPerSecond: 5_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // 4. Calculate total video duration
  const totalSlideDuration = slides.reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalVideoSeconds = INTRO_DURATION + totalSlideDuration + OUTRO_DURATION;

  // 5. Start recording and render frames
  recorder.start();

  // Frame interval in ms for target FPS timing in the output file
  const FRAME_INTERVAL_MS = 1000 / FPS;

  /**
   * Render frames for a segment, explicitly requesting each frame capture.
   * Uses a controlled delay per frame so the encoder processes every frame
   * and the output video plays at the correct speed.
   */
  const renderFrames = async (
    durationSeconds: number,
    drawFn: (frame: number, totalFrames: number) => void
  ): Promise<void> => {
    const totalFrames = Math.ceil(durationSeconds * FPS);
    for (let frame = 0; frame < totalFrames; frame++) {
      drawFn(frame, totalFrames);
      // Explicitly request the encoder to capture this exact frame
      if (videoTrack.requestFrame) {
        videoTrack.requestFrame();
      }
      // Wait one frame interval so encoder timestamps are correct
      await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
    }
  };

  // Intro
  await renderFrames(INTRO_DURATION, (frame, totalFrames) => {
    drawIntroFrame(ctx, branding, frame, totalFrames);
  });

  let elapsedSeconds = INTRO_DURATION;

  // Each slide
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const img = slideImages[i] || createPlaceholderImage(slide.title);

    // Play audio for this slide
    const audioBuf = audioBuffers[i];
    if (audioBuf.byteLength > 0) {
      try {
        const decoded = await audioContext.decodeAudioData(audioBuf.slice(0));
        const source = audioContext.createBufferSource();
        source.buffer = decoded;
        source.connect(audioDest);
        source.start();
      } catch (e) {
        console.warn(`Audio decode failed for slide ${i}:`, e);
      }
    }

    // Determine segment map: explicit, fallback from content, or none
    const segments: VideoSegment[] | null = (() => {
      if (slide.segmentMap?.length) return slide.segmentMap as VideoSegment[];
      if (slide.content) {
        const parsed = parseSegmentMap({
          content: slide.content as any,
        });
        return parsed.length > 1 ? parsed : null;
      }
      return null;
    })();

    if (segments && segments.length > 1 && slide.content) {
      // ── Segment-driven rendering ──
      const FADE_FRAMES = 15; // 0.5s cross-fade
      const totalFramesForSlide = Math.ceil(slide.durationSeconds * FPS);

      for (let si = 0; si < segments.length; si++) {
        const seg = segments[si];
        const segStartFrame = Math.floor((seg.start_percent / 100) * totalFramesForSlide);
        const segEndFrame = si === segments.length - 1
          ? totalFramesForSlide
          : Math.floor((seg.end_percent / 100) * totalFramesForSlide);
        const segFrameCount = segEndFrame - segStartFrame;

        for (let f = 0; f < segFrameCount; f++) {
          const globalFrame = segStartFrame + f;
          const segProgress = segFrameCount > 0 ? f / segFrameCount : 0;
          const currentElapsed = elapsedSeconds + (globalFrame / totalFramesForSlide) * slide.durationSeconds;

          // Black background
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, 1920, 1080);

          // Segment-varied Ken Burns on the base image
          drawSegmentKenBurns(ctx, img, si, segments.length, segProgress);

          // Fade-in for overlay (first FADE_FRAMES of each segment)
          const fadeProgress = Math.min(1, f / FADE_FRAMES);

          // Draw text overlay for this segment
          drawSegmentOverlay(ctx, seg, slide.content as SlideContent, slide.title, fadeProgress);

          // Segment indicator ("2 / 5")
          drawSegmentIndicator(ctx, si, segments.length);

          // Watermark
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#F5A742';
          ctx.font = 'bold 18px "Inter", system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText('SyllabusStack', 1920 - 24, 1080 - 20);
          ctx.globalAlpha = 1;

          // Lower-third bar
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(0, 1080 - 60, 1920, 60);
          ctx.fillStyle = '#ffffff';
          ctx.font = '20px "Inter", system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${i + 1}/${totalSlides}  •  ${slide.title}`, 24, 1080 - 30);

          // Progress bar
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(0, 1080 - 4, 1920, 4);
          ctx.fillStyle = '#F5A742';
          ctx.fillRect(0, 1080 - 4, (currentElapsed / totalVideoSeconds) * 1920, 4);

          if (videoTrack.requestFrame) videoTrack.requestFrame();
          await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
        }
      }
    } else {
      // ── Fallback: original single-image Ken Burns ──
      await renderFrames(slide.durationSeconds, (frame, totalFrames) => {
        const currentElapsed = elapsedSeconds + (frame / totalFrames) * slide.durationSeconds;
        drawSlideFrame(
          ctx, img, i, frame, totalFrames,
          slide.title, i + 1, totalSlides,
          currentElapsed, totalVideoSeconds
        );
      });
    }

    elapsedSeconds += slide.durationSeconds;

    onProgress({
      phase: 'rendering',
      currentSlide: i + 1,
      totalSlides,
      percent: 30 + ((i + 1) / totalSlides) * 60,
    });
  }

  // Outro
  await renderFrames(OUTRO_DURATION, () => {
    drawOutroFrame(ctx, branding);
  });

  onProgress({ phase: 'encoding', currentSlide: totalSlides, totalSlides, percent: 95 });

  // 6. Stop recording and get blob
  const videoBlob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
    recorder.stop();
  });

  await audioContext.close();

  const chapterMarkers = generateChapterMarkers(slides, INTRO_DURATION);
  const safeName = branding.unitTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 60);
  const filename = `SyllabusStack_${safeName}.webm`;

  onProgress({ phase: 'done', currentSlide: totalSlides, totalSlides, percent: 100 });

  return { videoBlob, chapterMarkers, filename };
}
