import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  BookOpen, 
  Target, 
  ArrowLeft, 
  Lightbulb, 
  Code, 
  AlertTriangle, 
  CheckCircle, 
  MessageCircle,
  HelpCircle,
  FileText,
  Image,
  ListOrdered,
  Maximize2
} from 'lucide-react';
import type { Slide, EnhancedSlide, ProfessorSlide, KeyPointWithHint, LayoutHint } from '@/hooks/useLectureSlides';
import { AuthenticatedImage } from './AuthenticatedImage';
import SlideContentBlock from './SlideContentBlock';
import ImageLightbox from './ImageLightbox';
import { CitationText } from './CitationText';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Citation } from '@/lib/citationParser';

export type SlideLayout = 'portrait' | 'landscape';

interface SlideRendererProps {
  slide: Slide | EnhancedSlide | ProfessorSlide;
  slideNumber: number;
  totalSlides: number;
  showSpeakerNotes?: boolean;
  showPedagogy?: boolean;
  className?: string;
  activeBlockId?: string | null; // For audio-visual sync highlighting
  citations?: Citation[]; // Research context citations for [Source N] rendering
  layout?: SlideLayout; // Portrait = side-by-side, Landscape = stacked 16:9 image
  interactiveVisuals?: boolean; // Disable image lightbox/zoom controls in presentation mode
}

// Helper to normalize key_points to always have text and optional layout_hint
function normalizeKeyPoint(point: string | KeyPointWithHint): { text: string; layoutHint?: LayoutHint } {
  if (typeof point === 'string') {
    return { text: point };
  }
  return { text: point.text, layoutHint: point.layout_hint };
}

const SLIDE_TYPE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  bgGradient: string;
  accentColor: string;
  iconBg: string;
}> = {
  title: {
    icon: BookOpen,
    bgGradient: 'from-primary/10 via-background to-background',
    accentColor: 'text-primary',
    iconBg: 'bg-primary/20',
  },
  objectives: {
    icon: Target,
    bgGradient: 'from-blue-500/10 via-background to-background',
    accentColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
  prerequisites: {
    icon: ArrowLeft,
    bgGradient: 'from-amber-500/10 via-background to-background',
    accentColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/20',
  },
  concept: {
    icon: Lightbulb,
    bgGradient: 'from-purple-500/10 via-background to-background',
    accentColor: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-500/20',
  },
  definition: {
    icon: FileText,
    bgGradient: 'from-blue-500/10 via-background to-background',
    accentColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
  explanation: {
    icon: Lightbulb,
    bgGradient: 'from-purple-500/10 via-background to-background',
    accentColor: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-500/20',
  },
  example: {
    icon: Code,
    bgGradient: 'from-green-500/10 via-background to-background',
    accentColor: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-500/20',
  },
  process: {
    icon: ListOrdered,
    bgGradient: 'from-indigo-500/10 via-background to-background',
    accentColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-500/20',
  },
  // V3 Professor AI slide types
  hook: {
    icon: Target,
    bgGradient: 'from-orange-500/10 via-background to-background',
    accentColor: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-500/20',
  },
  recap: {
    icon: ArrowLeft,
    bgGradient: 'from-slate-500/10 via-background to-background',
    accentColor: 'text-slate-600 dark:text-slate-400',
    iconBg: 'bg-slate-500/20',
  },
  demonstration: {
    icon: Code,
    bgGradient: 'from-violet-500/10 via-background to-background',
    accentColor: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-500/20',
  },
  practice: {
    icon: HelpCircle,
    bgGradient: 'from-amber-500/10 via-background to-background',
    accentColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/20',
  },
  synthesis: {
    icon: CheckCircle,
    bgGradient: 'from-teal-500/10 via-background to-background',
    accentColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-500/20',
  },
  preview: {
    icon: Target,
    bgGradient: 'from-blue-500/10 via-background to-background',
    accentColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
  diagram: {
    icon: Image,
    bgGradient: 'from-teal-500/10 via-background to-background',
    accentColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-500/20',
  },
  worked_problem: {
    icon: Code,
    bgGradient: 'from-indigo-500/10 via-background to-background',
    accentColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-500/20',
  },
  misconception: {
    icon: AlertTriangle,
    bgGradient: 'from-red-500/10 via-background to-background',
    accentColor: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-500/20',
  },
  case_study: {
    icon: BookOpen,
    bgGradient: 'from-cyan-500/10 via-background to-background',
    accentColor: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-500/20',
  },
  summary: {
    icon: CheckCircle,
    bgGradient: 'from-emerald-500/10 via-background to-background',
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/20',
  },
  discussion: {
    icon: MessageCircle,
    bgGradient: 'from-cyan-500/10 via-background to-background',
    accentColor: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-500/20',
  },
  assessment: {
    icon: HelpCircle,
    bgGradient: 'from-orange-500/10 via-background to-background',
    accentColor: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-500/20',
  },
};

// Check if slide is enhanced format (v2 or v3)
function isEnhanced(slide: Slide | EnhancedSlide | ProfessorSlide): slide is EnhancedSlide | ProfessorSlide {
  return 'content' in slide && typeof slide.content === 'object' && slide.content !== null && 'main_text' in slide.content;
}

// Check if slide is Professor AI format (v3)
function isProfessor(slide: Slide | EnhancedSlide | ProfessorSlide): slide is ProfessorSlide {
  return isEnhanced(slide) && 'pedagogy' in slide;
}

export function SlideRenderer({ 
  slide, 
  slideNumber, 
  totalSlides, 
  showSpeakerNotes = false,
  showPedagogy = false,
  className,
  activeBlockId = null,
  citations = [],
  layout = 'portrait',
  interactiveVisuals = true,
}: SlideRendererProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [signedImageUrl, setSignedImageUrl] = useState('');
  
  const config = SLIDE_TYPE_CONFIG[slide.type] || SLIDE_TYPE_CONFIG.concept;
  const Icon = config.icon;
  const enhanced = isEnhanced(slide);
  const professor = isProfessor(slide);
  
  // Helper to render text with citation support
  const renderWithCitations = (text: string, className?: string) => {
    if (citations.length > 0) {
      return <CitationText text={text} citations={citations} className={className} />;
    }
    return <span className={className}>{text}</span>;
  };

  // Helper to get definition text (handles both v2 and v3 formats)
  const getDefinitionText = () => {
    if (!enhanced || !slide.content.definition) return null;
    const def = slide.content.definition as any;
    return def.meaning || def.formal_definition || def.simple_explanation || '';
  };

  // Helper to get definition source
  const getDefinitionSource = () => {
    if (!enhanced || !slide.content.definition) return null;
    const def = slide.content.definition as any;
    return def.source || null;
  };

  // Helper to get example explanation (handles both v2 and v3 formats)
  const getExampleExplanation = () => {
    if (!enhanced || !slide.content.example) return '';
    const ex = slide.content.example as any;
    return ex.explanation || ex.walkthrough || ex.connection_to_concept || '';
  };

  // Helper to get bullets/key_points
  const getBullets = () => {
    if (!enhanced) return [];
    const content = slide.content as any;
    return content.bullets || content.key_points || [];
  };

  // Check if slide has visual content
  const hasVisual = enhanced && slide.visual && slide.visual.type !== 'none' && (slide.visual.url || slide.visual.fallback_description || slide.visual.alt_text);
  const hasVisualUrl = enhanced && slide.visual?.url;

  // Reference to text content scroll container
  const textContentRef = useRef<HTMLDivElement>(null);

  // Check if scroll indicator should be shown (only when content overflows)
  useEffect(() => {
    const checkScrollable = () => {
      const el = textContentRef.current;
      const indicator = el?.parentElement?.querySelector('.scroll-indicator') as HTMLElement;
      if (el && indicator) {
        const isScrollable = el.scrollHeight > el.clientHeight + 20;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
        indicator.style.opacity = (isScrollable && !atBottom) ? '1' : '0';
      }
    };
    
    // Check on mount and when slide changes
    checkScrollable();
    // Re-check after a brief delay for images to load
    const timeout = setTimeout(checkScrollable, 300);
    return () => clearTimeout(timeout);
  }, [slide, slideNumber]);

  // Open lightbox with signed image URL
  const openLightbox = () => {
    if (!interactiveVisuals) return;
    if (signedImageUrl) {
      setLightboxOpen(true);
    }
  };

  return (
    <TooltipProvider>
    <div className={cn('flex flex-col h-full', className)}>
      {/* Main slide content */}
      <div className={cn(
        'flex-1 rounded-xl border bg-gradient-to-br p-4 flex flex-col overflow-hidden',
        config.bgGradient
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn('p-1 rounded-lg', config.iconBg)}>
              <Icon className={cn('h-3.5 w-3.5', config.accentColor)} />
            </div>
            <span className={cn('text-xs font-medium capitalize', config.accentColor)}>
              {slide.type.replace('_', ' ')}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {slideNumber} / {totalSlides}
          </span>
        </div>

        {/* Title */}
        <h2 className={cn(
          'text-xl md:text-2xl font-bold mb-4',
          slide.type === 'title' && 'text-3xl md:text-4xl text-center mt-8'
        )}>
          {slide.title}
        </h2>

        {/* Title slide - show agenda/key points if available for progressive reveal during narration */}
        {enhanced && slide.type === 'title' && getBullets().length > 0 && (
          <div className="flex-1 flex flex-col items-center justify-center mt-4">
            <p className="text-sm text-muted-foreground mb-4">In this lecture:</p>
            <div className="space-y-3 max-w-2xl">
              {getBullets().map((item: string | KeyPointWithHint, index: number) => {
                const normalized = normalizeKeyPoint(item);
                const blockId = `key_point_${index}`;
                const isActive = activeBlockId === blockId;
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg transition-all duration-500",
                      isActive && "bg-primary/15 ring-2 ring-primary/40 scale-[1.02]",
                      !isActive && "bg-muted/30"
                    )}
                  >
                    <span className={cn(
                      'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      {index + 1}
                    </span>
                    <span className={cn(
                      "text-base leading-relaxed transition-colors duration-300",
                      isActive && "text-foreground font-medium"
                    )}>
                      {renderWithCitations(normalized.text)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content area - side-by-side on desktop, stacked on mobile when visual exists */}
        {enhanced && slide.type !== 'title' && (
          <div className={cn(
            'flex-1 min-h-0',
            hasVisualUrl
              ? layout === 'landscape'
                ? 'flex flex-col gap-3 overflow-y-auto'
                : 'flex flex-col sm:flex-row gap-3'
              : 'overflow-y-auto'
          )}>
            {/* Visual - shown FIRST in landscape mode (full-width 16:9) */}
            {hasVisualUrl && layout === 'landscape' && (
              <div className="w-full flex-shrink-0">
                <div 
                  className="w-full rounded-lg overflow-hidden bg-muted/30 shadow-md cursor-pointer group relative aspect-video"
                  onClick={openLightbox}
                >
                  <AuthenticatedImage 
                    src={slide.visual!.url} 
                    alt={slide.visual!.alt_text}
                    className="w-full h-full object-contain group-hover:scale-[1.01] transition-transform"
                    fallbackText={slide.visual!.fallback_description || slide.visual!.alt_text}
                    bucket="lecture-visuals"
                    onSignedUrlReady={setSignedImageUrl}
                  />
                  {interactiveVisuals && (
                    <div className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span className="text-xs">Click to expand</span>
                    </div>
                  )}
                  {(slide.visual as any).source && (
                    <p className="text-[10px] text-muted-foreground text-center py-1 bg-muted/50">Source: {(slide.visual as any).source}</p>
                  )}
                </div>
              </div>
            )}

            {/* Text content - with scroll indicator */}
            <div className={cn(
              'relative',
              hasVisualUrl && layout === 'portrait' ? 'sm:w-2/5 sm:flex-shrink-0' : ''
            )}>
              {/* Scrollable content area */}
              <div
                ref={textContentRef}
                className="space-y-2 overflow-y-auto max-h-full pr-2 scroll-smooth"
                style={{ maxHeight: hasVisualUrl && layout === 'portrait' ? '340px' : 'auto' }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
                  const indicator = el.parentElement?.querySelector('.scroll-indicator') as HTMLElement;
                  if (indicator) {
                    indicator.style.opacity = atBottom ? '0' : '1';
                  }
                }}
              >
              {/* Main text */}
              {slide.content.main_text && (
                <p className="text-sm leading-relaxed">{renderWithCitations(slide.content.main_text)}</p>
              )}
              
              {/* Definition box */}
              {slide.content.definition && (
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="font-semibold text-blue-600 dark:text-blue-400 text-xs mb-0.5">
                    {slide.content.definition.term}
                  </p>
                  <p className="text-xs">{renderWithCitations(getDefinitionText() || '')}</p>
                  {getDefinitionSource() && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Source: {getDefinitionSource()}
                    </p>
                  )}
                </div>
              )}

              {/* V3 Misconception box - handles both string and object formats */}
              {professor && (slide.content as any).misconception && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="font-medium text-red-600 dark:text-red-400 text-sm mb-1">⚠️ Common Misconception</p>
                  {(() => {
                    const misconception = (slide.content as any).misconception;
                    return typeof misconception === 'string' ? (
                      // Legacy string format
                      <p className="text-sm">{renderWithCitations(misconception)}</p>
                    ) : (
                      // V3 object format
                      <>
                        <p className="text-sm mb-1"><strong>Wrong belief:</strong> {renderWithCitations(misconception.wrong_belief)}</p>
                        <p className="text-sm mb-1"><strong>Why it's wrong:</strong> {renderWithCitations(misconception.why_wrong)}</p>
                        <p className="text-sm text-green-600 dark:text-green-400"><strong>Correct:</strong> {renderWithCitations(misconception.correct_understanding)}</p>
                      </>
                    );
                  })()}
                </div>
              )}
              
              {/* Steps */}
              {slide.content.steps && slide.content.steps.length > 0 && (
                <ol className="space-y-2">
                  {slide.content.steps.map((step) => (
                    <li key={step.step} className="flex gap-2">
                      <span className={cn('font-bold', config.accentColor)}>
                        {step.step}.
                      </span>
                      <div>
                        <p className="font-medium text-sm">{step.title}</p>
                        <p className="text-sm text-muted-foreground">{step.explanation}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              
              {/* Example - handles both string and object formats */}
              {slide.content.example && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="font-medium text-green-600 dark:text-green-400 text-sm mb-1">Example</p>
                  {(() => {
                    const example = slide.content.example;
                    return typeof example === 'string' ? (
                      // Legacy string format
                      <p className="text-sm">{renderWithCitations(example)}</p>
                    ) : (
                      // V3 object format
                      <>
                        <p className="text-sm mb-1">{renderWithCitations(example.scenario)}</p>
                        <p className="text-sm text-muted-foreground">{renderWithCitations(getExampleExplanation())}</p>
                      </>
                    );
                  })()}
                </div>
              )}
              
              {/* Bullets / Key Points - with adaptive layout support */}
              {getBullets().length > 0 && (
                <div className="space-y-2">
                  {getBullets().map((item: string | KeyPointWithHint, index: number) => {
                    const normalized = normalizeKeyPoint(item);
                    const blockId = `key_point_${index}`;
                    const isActive = activeBlockId === blockId;
                    
                    // If has layout_hint, use SlideContentBlock for adaptive rendering
                    if (normalized.layoutHint) {
                      return (
                        <SlideContentBlock
                          key={index}
                          text={normalized.text}
                          layoutHint={normalized.layoutHint}
                          isActive={isActive}
                        />
                      );
                    }
                    
                    // Default bullet rendering for plain text
                    return (
                      <div
                        key={index}
                        className={cn(
                          "flex items-start gap-2 p-1.5 rounded-md transition-all duration-300",
                          isActive && "bg-primary/10 ring-2 ring-primary/30"
                        )}
                      >
                        <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', config.iconBg)} />
                        <span className="text-base leading-relaxed">{renderWithCitations(normalized.text)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
              {/* Scroll indicator - shows when content is scrollable */}
              <div 
                className="scroll-indicator absolute bottom-0 left-0 right-2 h-8 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none flex items-end justify-center pb-1 transition-opacity duration-200"
                style={{ opacity: 1 }}
              >
                <div className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                  <span>↓</span>
                  <span>scroll for more</span>
                </div>
              </div>
            </div>

            {/* Visual - LARGE clickable for lightbox (portrait mode only; landscape renders above) */}
            {hasVisualUrl && layout === 'portrait' && (
              <div className="flex-1 min-w-0 flex items-start justify-center">
                <div 
                  className="w-full rounded-lg overflow-hidden bg-muted/30 shadow-md cursor-pointer group relative"
                  onClick={openLightbox}
                >
                  <AuthenticatedImage 
                    src={slide.visual!.url} 
                    alt={slide.visual!.alt_text}
                    className="w-full h-auto max-h-[380px] object-contain group-hover:scale-[1.01] transition-transform"
                    fallbackText={slide.visual!.fallback_description || slide.visual!.alt_text}
                    bucket="lecture-visuals"
                    onSignedUrlReady={setSignedImageUrl}
                  />
                  {interactiveVisuals && (
                    <div className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span className="text-xs">Click to expand</span>
                    </div>
                  )}
                  {(slide.visual as any).source && (
                    <p className="text-[10px] text-muted-foreground text-center py-1 bg-muted/50">Source: {(slide.visual as any).source}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Visual fallback - shown below when no URL */}
        {enhanced && slide.type !== 'title' && hasVisual && !hasVisualUrl && (
          <div className="mt-3 p-2 rounded-lg bg-muted/50 border border-dashed">
            <p className="text-sm text-muted-foreground italic">
              💡 Visual: {slide.visual!.fallback_description || slide.visual!.alt_text}
            </p>
          </div>
        )}

        {/* Content - Legacy format */}
        {!enhanced && slide.type !== 'title' && 'content' in slide && Array.isArray(slide.content) && (
          <div className="flex-1 overflow-auto">
            <ul className="space-y-3">
              {(slide.content as string[]).map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', config.iconBg)} />
                  <span className="text-base leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Visual suggestion - Legacy */}
        {!enhanced && 'visual_suggestion' in slide && slide.visual_suggestion && (
          <div className="mt-4 p-2 rounded-lg bg-muted/50 border border-dashed">
            <p className="text-sm text-muted-foreground italic">
              💡 Visual: {slide.visual_suggestion}
            </p>
          </div>
        )}
        
        {/* Citations - v2 Enhanced only */}
        {enhanced && !professor && (slide as any).citations && (slide as any).citations.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-1">References:</p>
            <div className="flex flex-wrap gap-1">
              {(slide as any).citations.map((citation: any, i: number) => (
                <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  [{i + 1}] {citation.source}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pedagogy hint - v3 only */}
        {professor && showPedagogy && (slide as ProfessorSlide).pedagogy && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            <p><strong>Purpose:</strong> {(slide as ProfessorSlide).pedagogy?.purpose}</p>
            <p><strong>Next:</strong> {(slide as ProfessorSlide).pedagogy?.transition_to_next}</p>
          </div>
        )}
      </div>

      {/* Speaker notes panel */}
      {showSpeakerNotes && slide.speaker_notes && (
        <div className="mt-2 p-2 rounded-lg bg-muted/50 border max-h-20 overflow-y-auto">
          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Speaker Notes</p>
          <p className="text-xs leading-relaxed">{slide.speaker_notes}</p>
        </div>
      )}

      {/* Image Lightbox */}
      {interactiveVisuals && (
        <ImageLightbox
          src={signedImageUrl}
          alt={enhanced && slide.visual?.alt_text || 'Slide visual'}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
    </TooltipProvider>
  );
}

export default SlideRenderer;
