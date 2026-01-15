import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Play,
  Pause,
  MessageSquare,
  Volume2,
  VolumeX
} from 'lucide-react';
import { SlideRenderer } from './SlideRenderer';
import type { LectureSlide, Slide, ProfessorSlide, EnhancedSlide } from '@/hooks/useLectureSlides';
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
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [highestSlideViewed, setHighestSlideViewed] = useState(0);
  
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

  // Track highest slide viewed
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
    
    async function playAudioWithSignedUrl() {
      let urlToPlay = audioUrl;
      
      // Check if this is a Supabase storage URL that needs signing
      const bucketPattern = '/storage/v1/object/public/lecture-audio/';
      if (audioUrl.includes(bucketPattern)) {
        const storagePath = audioUrl.split(bucketPattern)[1];
        if (storagePath) {
          try {
            const { data, error } = await supabase.storage
              .from('lecture-audio')
              .createSignedUrl(storagePath, 3600); // 1 hour expiry
            
            if (!error && data?.signedUrl) {
              urlToPlay = data.signedUrl;
            }
          } catch (err) {
            console.error('Error creating signed URL for audio:', err);
          }
        }
      }
      
      const audio = new Audio(urlToPlay);
      audioRef.current = audio;
      
      // Connect to sync hook for highlighting
      setAudioRef(audio);

      audio.onplay = () => setIsAudioPlaying(true);
      audio.onpause = () => setIsAudioPlaying(false);
      audio.onended = () => {
        setIsAudioPlaying(false);
        setAudioRef(null); // Disconnect sync
        // Auto-advance to next slide when audio ends
        if (currentSlideIndex < slides.length - 1) {
          setCurrentSlideIndex(prev => prev + 1);
        } else {
          handleComplete();
        }
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsAudioPlaying(false);
        setAudioRef(null); // Disconnect sync
      };

      // Auto-play audio for current slide
      audio.play().catch(e => {
        console.log('Audio autoplay blocked:', e);
        setIsAudioPlaying(false);
      });
    }
    
    playAudioWithSignedUrl();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onplay = null;
        audioRef.current.onpause = null;
        audioRef.current.onerror = null;
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

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold truncate max-w-md">{unitTitle}</h3>
          <span className="text-sm text-muted-foreground">
            {lectureSlide.total_slides} slides • ~{lectureSlide.estimated_duration_minutes || 10} min
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="flex items-center gap-2 w-48">
            <Progress value={progress} className="h-2" />
            <span className="text-xs text-muted-foreground w-12">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Auto-play only shown when no audio */}
            {!lectureSlide.has_audio && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAutoPlay}
                className="gap-1"
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
                className="gap-1"
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

            <div className="flex items-center gap-2 pl-2 border-l">
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
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main slide content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-8 overflow-hidden max-w-5xl mx-auto w-full">
          {currentSlide && (
            <SlideRenderer
              slide={currentSlide}
              slideNumber={currentSlideIndex + 1}
              totalSlides={slides.length}
              showSpeakerNotes={showSpeakerNotes}
              activeBlockId={activeBlockId}
              className="h-full"
            />
          )}
        </div>

        {/* Audio playing indicator */}
        {isAudioPlaying && (
          <div className="flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary text-sm">
            <Volume2 className="h-4 w-4 animate-pulse" />
            <span>Professor narration playing...</span>
          </div>
        )}

        {/* Navigation footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-background/95">
          <Button
            variant="outline"
            size="lg"
            onClick={goToPreviousSlide}
            disabled={currentSlideIndex === 0}
            className="min-w-32"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous
          </Button>

          {/* Slide dots */}
          <div className="flex items-center gap-1 max-w-md overflow-x-auto py-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  if (audioRef.current) audioRef.current.pause();
                  setCurrentSlideIndex(index);
                }}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentSlideIndex
                    ? "w-6 bg-primary"
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
            size="lg"
            onClick={goToNextSlide}
            className="min-w-32"
          >
            {currentSlideIndex === slides.length - 1 ? (
              'Complete'
            ) : (
              <>
                Next
                <ChevronRight className="h-5 w-5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StudentSlideViewer;