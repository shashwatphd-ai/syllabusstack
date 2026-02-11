import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  X, 
  Play,
  Pause,
  MessageSquare,
  Volume2,
  VolumeX,
  ScrollText,
  LayoutGrid
} from 'lucide-react';
import { SlideRenderer } from './SlideRenderer';
import { NarratedScrollViewer } from './NarratedScrollViewer';
import type { LectureSlide, Slide, ProfessorSlide, EnhancedSlide } from '@/hooks/useLectureSlides';
import type { Citation } from '@/lib/citationParser';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useSlideSync, parseSegmentMap, type AudioSegment } from '@/hooks/useSlideSync';

interface StudentSlideViewerProps {
  lectureSlide: LectureSlide;
  unitTitle: string;
  onClose: () => void;
  onComplete?: (watchPercentage: number) => void;
}

// Type guard to check if slide has audio_url
function hasAudioUrl(slide: Slide | EnhancedSlide | ProfessorSlide): slide is (Slide | EnhancedSlide | ProfessorSlide) & { audio_url: string } {
  return 'audio_url' in slide && typeof slide.audio_url === 'string' && slide.audio_url.length > 0;
}

export function StudentSlideViewer({ 
  lectureSlide, 
  unitTitle,
  onClose,
  onComplete
}: StudentSlideViewerProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'scroll' | 'slides'>('scroll');
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [highestSlideViewed, setHighestSlideViewed] = useState(0);
  const [visibleScrollSlideIndex, setVisibleScrollSlideIndex] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const slides = lectureSlide.slides;
  const currentSlide = slides[currentSlideIndex];
  const progress = ((highestSlideViewed + 1) / slides.length) * 100;
  const hasAudio = lectureSlide.has_audio && audioEnabled;

  // Parse segment map for current slide (for audio-visual sync)
  const currentSegmentMap = parseSegmentMap(currentSlide as any);
  const currentAudioDuration = (currentSlide as any)?.audio_duration_seconds || 0;

  // Audio-visual sync highlighting
  const { activeBlockId, setAudioRef } = useSlideSync({
    audioDuration: currentAudioDuration,
    segmentMap: currentSegmentMap,
    enabled: hasAudio && isAudioPlaying,
  });

  // Extract citations from research_context.grounded_content for [Source N] rendering
  const citations = useMemo((): Citation[] => {
    const researchContext = lectureSlide.research_context as any;
    if (!researchContext?.grounded_content) return [];
    
    return researchContext.grounded_content.map((item: any) => ({
      claim: item.claim || '',
      source_url: item.source_url || '',
      source_title: item.source_title || '',
      confidence: item.confidence,
    }));
  }, [lectureSlide.research_context]);
  useEffect(() => {
    if (currentSlideIndex > highestSlideViewed) {
      setHighestSlideViewed(currentSlideIndex);
    }
  }, [currentSlideIndex, highestSlideViewed]);

  // Audio playback for current slide
  useEffect(() => {
    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!hasAudio || !currentSlide || !hasAudioUrl(currentSlide)) {
      setIsAudioPlaying(false);
      return;
    }

    // Get signed URL for audio from private bucket
    const audioUrl = currentSlide.audio_url;
    let isMounted = true;
    
    // Define event handlers outside for proper cleanup
    const handlePlay = () => { if (isMounted) setIsAudioPlaying(true); };
    const handlePause = () => { if (isMounted) setIsAudioPlaying(false); };
    const handleEnded = () => {
      if (!isMounted) return;
      setIsAudioPlaying(false);
      setAudioRef(null); // Disconnect sync
      // Auto-advance to next slide when audio ends
      if (currentSlideIndex < slides.length - 1) {
        setCurrentSlideIndex(prev => prev + 1);
      } else {
        handleComplete();
      }
    };
    const handleError = (e: Event) => {
      console.error('Audio playback error:', e);
      if (!isMounted) return;
      setIsAudioPlaying(false);
      setAudioRef(null); // Disconnect sync
    };
    
    async function playAudioWithSignedUrl() {
      // Resolve audio path to a signed URL
      // Supports: relative paths (new), legacy public URLs, and already-signed URLs
      let urlToPlay = audioUrl;
      
      if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
        // New format: plain relative path (e.g. "slideId/slide_0.mp3")
        try {
          const { data, error } = await supabase.storage
            .from('lecture-audio')
            .createSignedUrl(audioUrl, 3600); // 1 hour expiry
          if (!error && data?.signedUrl) {
            urlToPlay = data.signedUrl;
          }
        } catch (err) {
          console.error('Error creating signed URL for audio:', err);
        }
      } else {
        // Legacy: full URL that may need re-signing
        const bucketPattern = '/storage/v1/object/public/lecture-audio/';
        const signedPattern = '/storage/v1/object/sign/lecture-audio/';
        
        if (audioUrl.includes(bucketPattern)) {
          const storagePath = audioUrl.split(bucketPattern)[1];
          if (storagePath) {
            try {
              const { data, error } = await supabase.storage
                .from('lecture-audio')
                .createSignedUrl(storagePath, 3600);
              if (!error && data?.signedUrl) {
                urlToPlay = data.signedUrl;
              }
            } catch (err) {
              console.error('Error creating signed URL for audio:', err);
            }
          }
        } else if (audioUrl.includes(signedPattern)) {
          // Already signed — use as-is (may be expired, error handler will catch it)
          urlToPlay = audioUrl;
        }
      }
      
      if (!isMounted) return;
      
      const audio = new Audio(urlToPlay);
      audioRef.current = audio;
      
      // Connect to sync hook for highlighting
      setAudioRef(audio);

      // Use addEventListener for proper cleanup (fixes memory leak)
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      // Auto-play audio for current slide
      audio.play().catch(e => {
        console.log('Audio autoplay blocked:', e);
        if (isMounted) setIsAudioPlaying(false);
      });
    }
    
    playAudioWithSignedUrl();

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        // Properly remove event listeners to prevent memory leaks
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
        audioRef.current = null;
      }
    };
  }, [currentSlideIndex, hasAudio, currentSlide, slides.length]);

  // Auto-advance timer (fallback when no audio)
  useEffect(() => {
    if (!isAutoPlaying || hasAudio) return;

    const slideTime = (lectureSlide.estimated_duration_minutes || 10) / slides.length * 60 * 1000;
    const timer = setTimeout(() => {
      if (currentSlideIndex < slides.length - 1) {
        setCurrentSlideIndex(prev => prev + 1);
      } else {
        setIsAutoPlaying(false);
        handleComplete();
      }
    }, slideTime);

    return () => clearTimeout(timer);
  }, [isAutoPlaying, currentSlideIndex, slides.length, hasAudio]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToNextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousSlide();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, slides.length]);

  const goToNextSlide = useCallback(() => {
    // Stop current audio before moving
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentSlideIndex, slides.length]);

  const goToPreviousSlide = useCallback(() => {
    // Stop current audio before moving
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const handleComplete = () => {
    const watchPercentage = ((highestSlideViewed + 1) / slides.length) * 100;
    onComplete?.(watchPercentage);
  };

  const handleClose = () => {
    // Stop audio on close
    if (audioRef.current) {
      audioRef.current.pause();
    }
    handleComplete();
    onClose();
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying(prev => !prev);
  };

  const toggleAudio = () => {
    if (audioRef.current && audioEnabled) {
      audioRef.current.pause();
    }
    setAudioEnabled(prev => !prev);
  };

  // Callback from NarratedScrollViewer when a section becomes visible
  const handleScrollSlideVisible = useCallback((index: number) => {
    setVisibleScrollSlideIndex(index);
    if (index > highestSlideViewed) {
      setHighestSlideViewed(index);
    }
  }, [highestSlideViewed]);

  // Scroll-mode section jump
  const jumpToSection = useCallback((direction: 'up' | 'down') => {
    const container = document.querySelector('[data-scroll-container]');
    if (!container) return;
    const targetIndex = direction === 'up'
      ? Math.max(0, visibleScrollSlideIndex - 1)
      : Math.min(slides.length - 1, visibleScrollSlideIndex + 1);
    const section = container.querySelector(`[data-slide-index="${targetIndex}"]`);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [visibleScrollSlideIndex, slides.length]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h3 className="font-semibold truncate max-w-[35vw] sm:max-w-md text-sm sm:text-base">{unitTitle}</h3>
          <span className="hidden sm:inline text-sm text-muted-foreground">
            {lectureSlide.total_slides} slides • ~{lectureSlide.estimated_duration_minutes || 10} min
          </span>
          <span className="sm:hidden text-xs text-muted-foreground">
            {lectureSlide.total_slides} slides
          </span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Progress */}
          <div className="flex items-center gap-1 sm:gap-2 w-20 sm:w-48">
            <Progress value={progress} className="h-2" />
            <span className="text-xs text-muted-foreground w-8 sm:w-12">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Auto-play only shown when no audio - hidden on mobile */}
            {!lectureSlide.has_audio && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAutoPlay}
                className="hidden sm:flex gap-1"
              >
                {isAutoPlaying ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Auto-play
                  </>
                )}
              </Button>
            )}

            {/* Audio toggle */}
            {lectureSlide.has_audio && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAudio}
                className="gap-1 px-2 sm:px-3"
              >
                {audioEnabled ? (
                  <>
                    <Volume2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Audio On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-4 w-4" />
                    <span className="hidden sm:inline">Audio Off</span>
                  </>
                )}
              </Button>
            )}

            {/* View mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(prev => prev === 'scroll' ? 'slides' : 'scroll')}
              className="gap-1 px-2 sm:px-3"
              title={viewMode === 'scroll' ? 'Switch to slide view' : 'Switch to scroll view'}
            >
              {viewMode === 'scroll' ? (
                <>
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Slides</span>
                </>
              ) : (
                <>
                  <ScrollText className="h-4 w-4" />
                  <span className="hidden sm:inline">Scroll</span>
                </>
              )}
            </Button>

            {/* Transcript toggle - only in slides mode, hidden on mobile */}
            {viewMode === 'slides' && (
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l">
                <Switch
                  id="student-notes"
                  checked={showSpeakerNotes}
                  onCheckedChange={setShowSpeakerNotes}
                />
                <Label htmlFor="student-notes" className="text-sm flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Transcript
                </Label>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'scroll' ? (
          /* Narrated Scroll Mode */
          <NarratedScrollViewer
            slides={slides}
            currentAudioSlideIndex={currentSlideIndex}
            activeBlockId={activeBlockId}
            isAudioPlaying={isAudioPlaying}
            citations={citations}
            onSlideVisible={handleScrollSlideVisible}
          />
        ) : (
          /* Classic Slides Mode */
          <div className="flex-1 p-3 sm:p-8 overflow-hidden max-w-5xl mx-auto w-full">
            {currentSlide && (
              <SlideRenderer
                slide={currentSlide}
                slideNumber={currentSlideIndex + 1}
                totalSlides={slides.length}
                showSpeakerNotes={showSpeakerNotes}
                activeBlockId={activeBlockId}
                citations={citations}
                className="h-full"
              />
            )}
          </div>
        )}

        {/* Audio playing indicator */}
        {isAudioPlaying && (
          <div className="flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary text-sm">
            <Volume2 className="h-4 w-4 animate-pulse" />
            <span>Professor narration playing...</span>
          </div>
        )}

        {/* Navigation footer */}
        {viewMode === 'slides' ? (
          /* Classic slide navigation */
          <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-t bg-background/95">
            <Button
              variant="outline"
              size="default"
              onClick={goToPreviousSlide}
              disabled={currentSlideIndex === 0}
              className="min-w-16 sm:min-w-32 px-2 sm:px-4"
            >
              <ChevronLeft className="h-5 w-5 sm:mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center gap-1 max-w-[40vw] sm:max-w-md overflow-x-auto py-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (audioRef.current) audioRef.current.pause();
                    setCurrentSlideIndex(index);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all shrink-0",
                    index === currentSlideIndex
                      ? "w-4 sm:w-6 bg-primary"
                      : index <= highestSlideViewed
                      ? "bg-primary/50 hover:bg-primary/70"
                      : "bg-muted hover:bg-muted-foreground/30"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <Button
              variant={currentSlideIndex === slides.length - 1 ? "default" : "outline"}
              size="default"
              onClick={goToNextSlide}
              className="min-w-16 sm:min-w-32 px-2 sm:px-4"
            >
              {currentSlideIndex === slides.length - 1 ? (
                <>
                  <span className="hidden sm:inline">Complete</span>
                  <span className="sm:hidden">Done</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-5 w-5 sm:ml-1" />
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Scroll mode footer */
          <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-t bg-background/95">
            <span className="text-sm text-muted-foreground">
              § {visibleScrollSlideIndex + 1} of {slides.length}
            </span>
            <span className="hidden sm:inline text-sm text-muted-foreground">
              ~{Math.max(1, Math.round(((slides.length - visibleScrollSlideIndex - 1) / slides.length) * (lectureSlide.estimated_duration_minutes || 10)))} min remaining
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => jumpToSection('up')}
                disabled={visibleScrollSlideIndex === 0}
                className="h-8 w-8"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => jumpToSection('down')}
                disabled={visibleScrollSlideIndex === slides.length - 1}
                className="h-8 w-8"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentSlideViewer;