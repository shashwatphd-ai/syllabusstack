import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Maximize2, 
  Minimize2,
  MessageSquare,
  LayoutGrid,
  Upload,
  RefreshCw,
  Loader2,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RectangleHorizontal,
  RectangleVertical,
  Presentation
} from 'lucide-react';
import { SlideRenderer, type SlideLayout } from './SlideRenderer';
import { VoicePicker } from './VoicePicker';
import { PresentationPlayer } from './PresentationPlayer';
import { VideoExportButton } from './VideoExportButton';
import type { Citation } from '@/lib/citationParser';
import { 
  LectureSlide, 
  Slide, 
  usePublishLectureSlides, 
  useUnpublishLectureSlides, 
  useGenerateLectureSlides,
  useGenerateLectureAudio,
  useLectureSlide
} from '@/hooks/useLectureSlides';
import { supabase } from '@/integrations/supabase/client';
import { TeachingUnit } from '@/hooks/useTeachingUnits';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface LectureSlideViewerProps {
  lectureSlide: LectureSlide;
  teachingUnit: TeachingUnit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LectureSlideViewer({ 
  lectureSlide, 
  teachingUnit,
  open,
  onOpenChange 
}: LectureSlideViewerProps) {
  const isMobile = useIsMobile();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(!isMobile);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Charon');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'presentation'>('editor');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [slideLayout, setSlideLayout] = useState<SlideLayout>(() => {
    try { return (localStorage.getItem('slide-layout-pref') as SlideLayout) || 'portrait'; } catch { return 'portrait'; }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch full slide data on-demand (the course-level query omits the slides JSONB)
  const { data: fullSlideData } = useLectureSlide(lectureSlide.id);
  const resolvedSlide = fullSlideData || lectureSlide;

  const publishSlides = usePublishLectureSlides();
  const unpublishSlides = useUnpublishLectureSlides();
  const regenerateSlides = useGenerateLectureSlides();
  const generateAudio = useGenerateLectureAudio();

  const slides = resolvedSlide.slides;
  const currentSlide = slides[currentSlideIndex];
  const hasAudio = resolvedSlide.has_audio;
  const audioStatus = resolvedSlide.audio_status;

  // Detect if audio is out of sync with slide content
  const isAudioOutdated = useMemo(() => {
    if (!hasAudio || !resolvedSlide.audio_generated_at) return false;
    const contentTimestamp = (resolvedSlide as any).slides_updated_at || resolvedSlide.updated_at;
    return new Date(contentTimestamp) > new Date(resolvedSlide.audio_generated_at);
  }, [hasAudio, resolvedSlide.updated_at, resolvedSlide.audio_generated_at]);

  // Extract citations from research_context for rendering
  const citations = useMemo(() => {
    const researchContext = resolvedSlide.research_context as {
      grounded_content?: Array<{
        claim: string;
        source_url: string;
        source_title: string;
        confidence?: number;
      }>;
    } | null;
    
    return researchContext?.grounded_content?.map(item => ({
      claim: item.claim || '',
      source_url: item.source_url || '',
      source_title: item.source_title || '',
      confidence: item.confidence,
    })) || [];
  }, [resolvedSlide.research_context]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToNextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousSlide();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onOpenChange(false);
        }
      } else if (e.key === 'f') {
        setIsFullscreen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentSlideIndex, slides.length, isFullscreen]);

  const goToNextSlide = useCallback(() => {
    setCurrentSlideIndex(prev => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goToPreviousSlide = useCallback(() => {
    setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const handlePublish = () => {
    if (lectureSlide.status === 'published') {
      unpublishSlides.mutate(lectureSlide.id);
    } else {
      publishSlides.mutate(lectureSlide.id);
    }
  };

  const handleRegenerate = () => {
    regenerateSlides.mutate({
      teachingUnitId: lectureSlide.teaching_unit_id,
      style: lectureSlide.slide_style,
      regenerate: true,
    });
    // Don't close the dialog - let user see the toast and stay on current slides
    // The dialog will refresh when the new slides are ready via query invalidation
  };

  const isPublished = lectureSlide.status === 'published';
  const isLoading = publishSlides.isPending || unpublishSlides.isPending || regenerateSlides.isPending || generateAudio.isPending;

  const handleGenerateAudio = () => {
    generateAudio.mutate({ slideId: lectureSlide.id });
  };

  // Stop audio preview when slide changes, dialog closes, or component unmounts
  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPreviewPlaying(false);
  }, []);

  // Auto-play audio when slide changes in presentation mode
  const autoPlayTriggeredRef = useRef<number | null>(null);
  useEffect(() => {
    stopPreview();
  }, [currentSlideIndex, stopPreview]);

  useEffect(() => {
    if (!open) stopPreview();
  }, [open, stopPreview]);

  useEffect(() => {
    return () => stopPreview();
  }, [stopPreview]);

  const toggleAudio = useCallback(() => {
    if (isPreviewPlaying) {
      stopPreview();
    }
    setAudioEnabled(prev => !prev);
  }, [isPreviewPlaying, stopPreview]);

  const handlePreviewToggle = useCallback(async () => {
    if (isPreviewPlaying) {
      stopPreview();
      return;
    }

    // Use audio_urls map with selected voice, falling back to legacy audio_url
    const slideAudioUrls = (currentSlide as any)?.audio_urls as Record<string, string> | undefined;
    const slideAudioUrl = slideAudioUrls?.[selectedVoice] || (currentSlide as any)?.audio_url;
    if (!slideAudioUrl) return;

    // Create Audio element synchronously in gesture context for autoplay-safety
    const audio = new Audio();
    audio.play().catch(() => {}); // Unlock audio context (iOS Safari)
    audioRef.current = audio;

    try {
      const { data: signedUrlData } = await supabase.storage
        .from('lecture-audio')
        .createSignedUrl(slideAudioUrl, 3600);

      if (!signedUrlData?.signedUrl) {
        stopPreview();
        return;
      }

      const cacheBuster = resolvedSlide.audio_generated_at
        ? `&t=${new Date(resolvedSlide.audio_generated_at).getTime()}`
        : '';

      audio.src = signedUrlData.signedUrl + cacheBuster;
      audio.addEventListener('ended', () => {
        setIsPreviewPlaying(false);
        // Auto-advance to next slide when audio ends in presentation mode
        if (viewMode === 'presentation') {
          setCurrentSlideIndex(prev => {
            if (prev < slides.length - 1) return prev + 1;
            return prev;
          });
        }
      });
      await audio.play();
      setIsPreviewPlaying(true);
    } catch (err) {
      console.error('Audio preview failed:', err);
      setIsPreviewPlaying(false);
    }
  }, [isPreviewPlaying, currentSlide, resolvedSlide.audio_generated_at, stopPreview, selectedVoice, viewMode, slides.length]);

  // Auto-play audio when slide changes in presentation mode
  useEffect(() => {
    if (viewMode !== 'presentation' || !open || !audioEnabled || !hasAudio) return;
    if (autoPlayTriggeredRef.current === currentSlideIndex) return;
    
    const slide = slides[currentSlideIndex];
    const slideAudioUrls = (slide as any)?.audio_urls as Record<string, string> | undefined;
    const slideAudioUrl = slideAudioUrls?.[selectedVoice] || (slide as any)?.audio_url;
    if (!slideAudioUrl) return;

    autoPlayTriggeredRef.current = currentSlideIndex;
    const timer = setTimeout(() => {
      handlePreviewToggle();
    }, 150);
    return () => clearTimeout(timer);
  }, [viewMode, open, audioEnabled, hasAudio, currentSlideIndex, selectedVoice, slides, handlePreviewToggle]);

  // If in presentation mode, render PresentationPlayer over the dialog
  if (viewMode === 'presentation' && open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-full h-full rounded-none p-0 gap-0 border-0">
          <VisuallyHidden>
            <DialogTitle>{lectureSlide.title}</DialogTitle>
          </VisuallyHidden>
          <PresentationPlayer
            lectureSlide={resolvedSlide}
            slides={slides}
            currentSlideIndex={currentSlideIndex}
            onSlideChange={(index) => {
              stopPreview();
              setCurrentSlideIndex(index);
            }}
            isAudioPlaying={isPreviewPlaying}
            audioRef={audioRef}
            audioEnabled={audioEnabled}
            onToggleAudio={toggleAudio}
            onPlayPause={handlePreviewToggle}
            selectedVoice={selectedVoice}
            onVoiceChange={(v) => { stopPreview(); setSelectedVoice(v); }}
            hasAudio={hasAudio}
            citations={citations as Citation[]}
            activeBlockId={null}
            onComplete={() => setViewMode('editor')}
            onClose={() => setViewMode('editor')}
            title={lectureSlide.title}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-7xl h-[90vh] p-0 gap-0 flex flex-col",
          isFullscreen && "max-w-full h-full rounded-none"
        )}
      >
        <VisuallyHidden>
          <DialogTitle>{lectureSlide.title}</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h3 className="font-semibold truncate max-w-[40vw] sm:max-w-md text-sm sm:text-base">{lectureSlide.title}</h3>
            <Badge variant={isPublished ? 'default' : 'secondary'} className="text-xs shrink-0">
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Controls hidden on mobile, shown on tablet+ */}
            <div className="hidden md:flex items-center gap-2 mr-4">
              <Switch
                id="speaker-notes"
                checked={showSpeakerNotes}
                onCheckedChange={setShowSpeakerNotes}
              />
              <Label htmlFor="speaker-notes" className="text-sm flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Notes
              </Label>
            </div>
            
            <div className="hidden md:flex items-center gap-2 mr-4">
              <Switch
                id="thumbnails"
                checked={showThumbnails}
                onCheckedChange={setShowThumbnails}
              />
              <Label htmlFor="thumbnails" className="text-sm flex items-center gap-1">
                <LayoutGrid className="h-3 w-3" />
                Thumbnails
              </Label>
            </div>

            {/* Audio Controls */}
            {audioStatus === 'generating' ? (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating Audio...
              </Badge>
            ) : (
              <>
                {isAudioOutdated && (
                  <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="hidden sm:inline">Audio outdated</span>
                  </Badge>
                )}

                {hasAudio && !isAudioOutdated && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Audio Ready
                  </Badge>
                )}

                <VoicePicker value={selectedVoice} onValueChange={(v) => { stopPreview(); setSelectedVoice(v); }} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAudio}
                  disabled={isLoading}
                >
                  {generateAudio.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline ml-1">
                    {hasAudio ? 'Regenerate All Voices' : 'Generate Audio'}
                  </span>
                </Button>
              </>
            )}

            {/* Preview (Presentation mode) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('presentation')}
              disabled={isLoading}
              title="Preview as student (Cinema mode)"
            >
              <Presentation className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Preview</span>
            </Button>

            {/* Video Export */}
            <VideoExportButton
              slides={slides}
              branding={{
                courseTitle: teachingUnit.title || lectureSlide.title,
                unitTitle: lectureSlide.title,
              }}
              selectedVoice={selectedVoice}
              hasAudio={hasAudio}
              disabled={isLoading}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isLoading}
            >
              {regenerateSlides.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline ml-1">Regenerate</span>
            </Button>

            <Button
              variant={isPublished ? 'outline' : 'default'}
              size="sm"
              onClick={handlePublish}
              disabled={isLoading}
            >
              {(publishSlides.isPending || unpublishSlides.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="ml-1">{isPublished ? 'Unpublish' : 'Publish'}</span>
            </Button>

            {/* Layout toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = slideLayout === 'portrait' ? 'landscape' : 'portrait';
                setSlideLayout(next);
                try { localStorage.setItem('slide-layout-pref', next); } catch {}
              }}
              title={slideLayout === 'portrait' ? 'Switch to landscape layout' : 'Switch to portrait layout'}
            >
              {slideLayout === 'portrait' ? (
                <RectangleHorizontal className="h-4 w-4" />
              ) : (
                <RectangleVertical className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(prev => !prev)}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close slide viewer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Thumbnail sidebar - hidden on mobile */}
          {showThumbnails && (
            <ScrollArea className="hidden md:block w-52 flex-shrink-0 border-r bg-muted/30">
              <div className="p-2 space-y-1">
                {slides.map((slide, index) => (
                  <button
                    key={slide.order ?? index}
                    onClick={() => setCurrentSlideIndex(index)}
                    className={cn(
                      "w-full p-2 rounded-lg text-left transition-colors",
                      index === currentSlideIndex
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <p 
                      className={cn(
                        "text-xs font-medium line-clamp-2 leading-tight",
                        index === currentSlideIndex ? "text-primary-foreground" : ""
                      )}
                      title={`${index + 1}. ${slide.title}`}
                    >
                      {index + 1}. {slide.title}
                    </p>
                    <p className={cn(
                      "text-xs capitalize mt-0.5",
                      index === currentSlideIndex 
                        ? "text-primary-foreground/80" 
                        : "text-muted-foreground"
                    )}>
                      {slide.type.replace('_', ' ')}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Slide viewer */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-3 sm:p-6 overflow-hidden">
              {currentSlide && (
                <SlideRenderer
                  slide={currentSlide}
                  slideNumber={currentSlideIndex + 1}
                  totalSlides={slides.length}
                  showSpeakerNotes={showSpeakerNotes}
                  citations={citations}
                  layout={slideLayout}
                  className="h-full"
                />
              )}
            </div>

            {/* Navigation footer */}
            <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-t bg-background/95">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousSlide}
                disabled={currentSlideIndex === 0}
                className="min-w-0 px-2 sm:px-4"
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <div className="flex items-center gap-1 sm:gap-2">
                {hasAudio && ((currentSlide as any)?.audio_urls || (currentSlide as any)?.audio_url) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handlePreviewToggle}
                    aria-label={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
                  >
                    {isPreviewPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {currentSlideIndex + 1} / {slides.length}
                </span>
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  (~{lectureSlide.estimated_duration_minutes || teachingUnit.target_duration_minutes} min)
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={goToNextSlide}
                disabled={currentSlideIndex === slides.length - 1}
                className="min-w-0 px-2 sm:px-4"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LectureSlideViewer;
