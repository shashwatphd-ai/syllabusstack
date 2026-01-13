import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  Loader2
} from 'lucide-react';
import { SlideRenderer } from './SlideRenderer';
import { 
  LectureSlide, 
  Slide, 
  usePublishLectureSlides, 
  useUnpublishLectureSlides, 
  useGenerateLectureSlides 
} from '@/hooks/useLectureSlides';
import { TeachingUnit } from '@/hooks/useTeachingUnits';
import { cn } from '@/lib/utils';

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
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const publishSlides = usePublishLectureSlides();
  const unpublishSlides = useUnpublishLectureSlides();
  const regenerateSlides = useGenerateLectureSlides();

  const slides = lectureSlide.slides;
  const currentSlide = slides[currentSlideIndex];

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
      style: (lectureSlide.slide_style === 'professional' ? 'detailed' : lectureSlide.slide_style) as any,
      regenerate: true,
    });
    onOpenChange(false);
  };

  const isPublished = lectureSlide.status === 'published';
  const isLoading = publishSlides.isPending || unpublishSlides.isPending || regenerateSlides.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-7xl h-[90vh] p-0 gap-0 flex flex-col",
          isFullscreen && "max-w-full h-full rounded-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold truncate max-w-md">{lectureSlide.title}</h3>
            <Badge variant={isPublished ? 'default' : 'secondary'}>
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4">
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
            
            <div className="flex items-center gap-2 mr-4">
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

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(prev => !prev)}
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
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Thumbnail sidebar */}
          {showThumbnails && (
            <ScrollArea className="w-48 border-r bg-muted/30">
              <div className="p-2 space-y-2">
                {slides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlideIndex(index)}
                    className={cn(
                      "w-full p-2 rounded-lg text-left transition-colors",
                      index === currentSlideIndex
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <p className="text-xs font-medium truncate">{index + 1}. {slide.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {slide.type.replace('_', ' ')}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Slide viewer */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-6 overflow-hidden">
              {currentSlide && (
                <SlideRenderer
                  slide={currentSlide}
                  slideNumber={currentSlideIndex + 1}
                  totalSlides={slides.length}
                  showSpeakerNotes={showSpeakerNotes}
                  className="h-full"
                />
              )}
            </div>

            {/* Navigation footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t bg-background/95">
              <Button
                variant="outline"
                onClick={goToPreviousSlide}
                disabled={currentSlideIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Slide {currentSlideIndex + 1} of {slides.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  (~{lectureSlide.estimated_duration_minutes || teachingUnit.target_duration_minutes} min)
                </span>
              </div>

              <Button
                variant="outline"
                onClick={goToNextSlide}
                disabled={currentSlideIndex === slides.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LectureSlideViewer;
