/**
 * PresentationPlayer — Cinema-style lecture video player
 * 
 * Renders slides + audio as a video-like experience with:
 * - Video-style seekable progress bar with chapter markers
 * - Reader On/Off toggle (audio narration)
 * - Auto-advance through slides
 * - Minimal chrome, dark immersive background
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SlideRenderer } from './SlideRenderer';
import { VoicePicker } from './VoicePicker';
import type { LectureSlide, Slide, EnhancedSlide, ProfessorSlide } from '@/hooks/useLectureSlides';
import type { Citation } from '@/lib/citationParser';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface PresentationPlayerProps {
  lectureSlide: LectureSlide;
  slides: (Slide | EnhancedSlide | ProfessorSlide)[];
  currentSlideIndex: number;
  onSlideChange: (index: number) => void;
  isAudioPlaying: boolean;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  hasAudio: boolean;
  citations: Citation[];
  activeBlockId: string | null;
  onComplete: () => void;
}

export function PresentationPlayer({
  lectureSlide,
  slides,
  currentSlideIndex,
  onSlideChange,
  isAudioPlaying,
  audioRef,
  audioEnabled,
  onToggleAudio,
  selectedVoice,
  onVoiceChange,
  hasAudio,
  citations,
  activeBlockId,
  onComplete,
}: PresentationPlayerProps) {
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Slide durations from metadata
  const slideDurations = useMemo(() => {
    return slides.map((s: any) => {
      return s.audio_duration_seconds || s.estimated_seconds || 
        ((lectureSlide.estimated_duration_minutes || 10) * 60 / slides.length);
    });
  }, [slides, lectureSlide.estimated_duration_minutes]);

  const totalDuration = useMemo(() => slideDurations.reduce((a, b) => a + b, 0), [slideDurations]);

  // Cumulative start times for each slide
  const slideStartTimes = useMemo(() => {
    const starts: number[] = [0];
    for (let i = 1; i < slideDurations.length; i++) {
      starts.push(starts[i - 1] + slideDurations[i - 1]);
    }
    return starts;
  }, [slideDurations]);

  // Current audio progress within slide
  const [slideAudioProgress, setSlideAudioProgress] = useState(0);

  useEffect(() => {
    if (!audioRef.current || !isAudioPlaying) {
      setSlideAudioProgress(0);
      return;
    }

    const interval = setInterval(() => {
      if (audioRef.current && slideDurations[currentSlideIndex] > 0) {
        const progress = audioRef.current.currentTime / slideDurations[currentSlideIndex];
        setSlideAudioProgress(Math.min(progress, 1));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isAudioPlaying, currentSlideIndex, slideDurations]);

  // Overall progress percentage
  const overallProgress = useMemo(() => {
    if (totalDuration === 0) return 0;
    const elapsed = slideStartTimes[currentSlideIndex] + 
      (slideAudioProgress * slideDurations[currentSlideIndex]);
    return (elapsed / totalDuration) * 100;
  }, [currentSlideIndex, slideAudioProgress, slideStartTimes, slideDurations, totalDuration]);

  // Keep controls always visible (no auto-hide)
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // Fullscreen handling
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Click on progress bar to seek to slide
  const handleProgressBarClick = useCallback((e: React.MouseEvent) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const targetTime = (clickPercent / 100) * totalDuration;

    // Find which slide this maps to
    let targetSlide = 0;
    for (let i = slideStartTimes.length - 1; i >= 0; i--) {
      if (targetTime >= slideStartTimes[i]) {
        targetSlide = i;
        break;
      }
    }

    if (audioRef.current) audioRef.current.pause();
    onSlideChange(targetSlide);
  }, [slideStartTimes, totalDuration, onSlideChange]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [isAudioPlaying]);

  const handlePrev = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    onSlideChange(Math.max(0, currentSlideIndex - 1));
  }, [currentSlideIndex, onSlideChange]);

  const handleNext = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    if (currentSlideIndex < slides.length - 1) {
      onSlideChange(currentSlideIndex + 1);
    } else {
      onComplete();
    }
  }, [currentSlideIndex, slides.length, onSlideChange, onComplete]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentTime = slideStartTimes[currentSlideIndex] + 
    (slideAudioProgress * slideDurations[currentSlideIndex]);

  const currentSlide = slides[currentSlideIndex];

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col bg-black relative select-none"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* Slide content — centered in dark background */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
        {currentSlide && (
          <div className="w-full max-w-4xl">
            <SlideRenderer
              slide={currentSlide}
              slideNumber={currentSlideIndex + 1}
              totalSlides={slides.length}
              showSpeakerNotes={false}
              activeBlockId={activeBlockId}
              citations={citations}
              layout="landscape"
              className="rounded-lg shadow-2xl"
            />
          </div>
        )}
      </div>

      {/* Chapter markers overlay on progress bar */}
      {/* Video-style bottom controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Gradient fade */}
        <div className="h-24 bg-gradient-to-t from-black/80 to-transparent" />

        <div className="bg-black/80 backdrop-blur-sm px-4 pb-4 -mt-1">
          {/* Progress bar */}
          <div
            ref={progressBarRef}
            className="relative h-2 bg-white/20 rounded-full cursor-pointer mb-3 group hover:h-3 transition-all"
            onClick={handleProgressBarClick}
          >
            {/* Filled progress */}
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-100"
              style={{ width: `${overallProgress}%` }}
            />

            {/* Chapter markers (slide boundaries) */}
            {slideStartTimes.slice(1).map((start, i) => {
              const percent = (start / totalDuration) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 w-0.5 h-full bg-white/40 group-hover:bg-white/60"
                  style={{ left: `${percent}%` }}
                  title={`Slide ${i + 2}: ${(slides[i + 1] as any)?.title || ''}`}
                />
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${overallProgress}% - 6px)` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-white/20 h-9 w-9"
                onClick={handlePlayPause}
                disabled={!hasAudio || !audioEnabled}
              >
                {isAudioPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>

              {/* Skip back/forward */}
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/20 h-8 w-8"
                onClick={handlePrev}
                disabled={currentSlideIndex === 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/20 h-8 w-8"
                onClick={handleNext}
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              {/* Time display */}
              <span className="text-white/70 text-sm font-mono ml-2">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>

              {/* Slide counter */}
              <span className="text-white/50 text-sm ml-3">
                Slide {currentSlideIndex + 1} of {slides.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Reader On/Off (Audio toggle) */}
              {hasAudio && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-sm gap-1.5 h-8",
                    audioEnabled
                      ? "text-white hover:text-white hover:bg-white/20"
                      : "text-white/40 hover:text-white/60 hover:bg-white/20"
                  )}
                  onClick={onToggleAudio}
                >
                  {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  <span className="hidden sm:inline">
                    {audioEnabled ? 'Reader On' : 'Reader Off'}
                  </span>
                </Button>
              )}

              {/* Voice picker */}
              {hasAudio && audioEnabled && (
                <VoicePicker value={selectedVoice} onValueChange={onVoiceChange} />
              )}

              {/* Fullscreen */}
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/20 h-8 w-8"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
