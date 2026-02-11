import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  BookOpen, Target, ArrowLeft, Lightbulb, Code, AlertTriangle, 
  CheckCircle, MessageCircle, HelpCircle, FileText, Image, 
  ListOrdered, Maximize2 
} from 'lucide-react';
import type { Slide, EnhancedSlide, ProfessorSlide, KeyPointWithHint, LayoutHint } from '@/hooks/useLectureSlides';
import { AuthenticatedImage } from './AuthenticatedImage';
import SlideContentBlock from './SlideContentBlock';
import ImageLightbox from './ImageLightbox';
import { CitationText } from './CitationText';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Citation } from '@/lib/citationParser';

interface NarratedScrollViewerProps {
  slides: (Slide | EnhancedSlide | ProfessorSlide)[];
  currentAudioSlideIndex: number;
  activeBlockId: string | null;
  isAudioPlaying: boolean;
  citations: Citation[];
  onSlideVisible: (index: number) => void;
}

// Reuse type configs from SlideRenderer
const SLIDE_TYPE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accentColor: string;
  iconBg: string;
}> = {
  title: { icon: BookOpen, label: 'Introduction', accentColor: 'text-primary', iconBg: 'bg-primary/20' },
  objectives: { icon: Target, label: 'Objectives', accentColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-500/20' },
  prerequisites: { icon: ArrowLeft, label: 'Prerequisites', accentColor: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-500/20' },
  concept: { icon: Lightbulb, label: 'Concept', accentColor: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-500/20' },
  definition: { icon: FileText, label: 'Definition', accentColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-500/20' },
  explanation: { icon: Lightbulb, label: 'Explanation', accentColor: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-500/20' },
  example: { icon: Code, label: 'Example', accentColor: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-500/20' },
  process: { icon: ListOrdered, label: 'Process', accentColor: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-500/20' },
  hook: { icon: Target, label: 'Hook', accentColor: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-500/20' },
  recap: { icon: ArrowLeft, label: 'Recap', accentColor: 'text-slate-600 dark:text-slate-400', iconBg: 'bg-slate-500/20' },
  demonstration: { icon: Code, label: 'Demonstration', accentColor: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-500/20' },
  practice: { icon: HelpCircle, label: 'Practice', accentColor: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-500/20' },
  synthesis: { icon: CheckCircle, label: 'Synthesis', accentColor: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-500/20' },
  preview: { icon: Target, label: 'Preview', accentColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-500/20' },
  diagram: { icon: Image, label: 'Diagram', accentColor: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-500/20' },
  worked_problem: { icon: Code, label: 'Worked Problem', accentColor: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-500/20' },
  misconception: { icon: AlertTriangle, label: 'Misconception', accentColor: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-500/20' },
  case_study: { icon: BookOpen, label: 'Case Study', accentColor: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-500/20' },
  summary: { icon: CheckCircle, label: 'Summary', accentColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/20' },
  discussion: { icon: MessageCircle, label: 'Discussion', accentColor: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-500/20' },
  assessment: { icon: HelpCircle, label: 'Assessment', accentColor: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-500/20' },
};

function isEnhanced(slide: Slide | EnhancedSlide | ProfessorSlide): slide is EnhancedSlide | ProfessorSlide {
  return 'content' in slide && typeof slide.content === 'object' && slide.content !== null && 'main_text' in slide.content;
}

function isProfessor(slide: Slide | EnhancedSlide | ProfessorSlide): slide is ProfessorSlide {
  return isEnhanced(slide) && 'pedagogy' in slide;
}

function normalizeKeyPoint(point: string | KeyPointWithHint): { text: string; layoutHint?: LayoutHint } {
  if (typeof point === 'string') return { text: point };
  return { text: point.text, layoutHint: point.layout_hint };
}

export function NarratedScrollViewer({
  slides,
  currentAudioSlideIndex,
  activeBlockId,
  isAudioPlaying,
  citations,
  onSlideVisible,
}: NarratedScrollViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastManualScrollRef = useRef(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState('');
  const [lightboxAlt, setLightboxAlt] = useState('');
  // Track signed URLs per slide for lightbox
  const signedUrlsRef = useRef<Record<number, string>>({});

  // Track user manual scroll to avoid fighting with auto-scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onUserScroll = () => { lastManualScrollRef.current = Date.now(); };
    container.addEventListener('wheel', onUserScroll, { passive: true });
    container.addEventListener('touchmove', onUserScroll, { passive: true });
    return () => {
      container.removeEventListener('wheel', onUserScroll);
      container.removeEventListener('touchmove', onUserScroll);
    };
  }, []);

  // IntersectionObserver for progress tracking
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.slideIndex);
            if (!isNaN(index)) onSlideVisible(index);
          }
        });
      },
      { root: container, threshold: 0.3 }
    );

    const sections = container.querySelectorAll('[data-slide-index]');
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [slides.length, onSlideVisible]);

  // Audio-scroll sync: scroll active block into view
  useEffect(() => {
    if (!activeBlockId || !isAudioPlaying) return;
    const timeSinceManual = Date.now() - lastManualScrollRef.current;
    if (timeSinceManual < 3000) return;

    const el = scrollContainerRef.current?.querySelector(`[data-block-id="${activeBlockId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeBlockId, isAudioPlaying]);

  const renderWithCitations = useCallback((text: string, className?: string) => {
    if (citations.length > 0) {
      return <CitationText text={text} citations={citations} className={className} />;
    }
    return <span className={className}>{text}</span>;
  }, [citations]);

  const getDefinitionText = (slide: EnhancedSlide | ProfessorSlide) => {
    if (!slide.content.definition) return '';
    const def = slide.content.definition as any;
    return def.meaning || def.formal_definition || def.simple_explanation || '';
  };

  const getDefinitionSource = (slide: EnhancedSlide | ProfessorSlide) => {
    if (!slide.content.definition) return null;
    return (slide.content.definition as any).source || null;
  };

  const getExampleExplanation = (slide: EnhancedSlide | ProfessorSlide) => {
    if (!slide.content.example) return '';
    const ex = slide.content.example as any;
    return ex.explanation || ex.walkthrough || ex.connection_to_concept || '';
  };

  const getBullets = (slide: EnhancedSlide | ProfessorSlide) => {
    const content = slide.content as any;
    return content.bullets || content.key_points || [];
  };

  const openLightbox = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
    setLightboxOpen(true);
  };

  return (
    <TooltipProvider>
      <div
        ref={scrollContainerRef}
        data-scroll-container
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-2">
          {slides.map((slide, slideIndex) => {
            const config = SLIDE_TYPE_CONFIG[slide.type] || SLIDE_TYPE_CONFIG.concept;
            const Icon = config.icon;
            const enhanced = isEnhanced(slide);
            const professor = isProfessor(slide);
            const hasVisualUrl = enhanced && slide.visual?.url;
            const isCurrentAudioSlide = slideIndex === currentAudioSlideIndex;

            return (
              <section
                key={slideIndex}
                data-slide-index={slideIndex}
                className="scroll-mt-4"
              >
                {/* Section divider */}
                {slideIndex > 0 && (
                  <div className="flex items-center gap-3 py-6">
                    <div className="flex-1 h-px bg-border" />
                    <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium', config.iconBg, config.accentColor)}>
                      <Icon className="h-3 w-3" />
                      <span>§ {slideIndex + 1} · {config.label}</span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* First slide gets the badge without the divider line */}
                {slideIndex === 0 && (
                  <div className="flex items-center gap-1.5 mb-4">
                    <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium', config.iconBg, config.accentColor)}>
                      <Icon className="h-3 w-3" />
                      <span>§ 1 · {config.label}</span>
                    </div>
                  </div>
                )}

                {/* Hero image */}
                {hasVisualUrl && (
                  <div
                    className="w-full rounded-xl overflow-hidden bg-muted/30 shadow-md mb-6 cursor-pointer group relative"
                    onClick={() => {
                      const url = signedUrlsRef.current[slideIndex];
                      if (url) openLightbox(url, slide.visual?.alt_text || 'Slide visual');
                    }}
                  >
                    <AuthenticatedImage
                      src={slide.visual!.url}
                      alt={slide.visual!.alt_text}
                      className="w-full h-auto max-h-[500px] object-contain group-hover:scale-[1.01] transition-transform"
                      fallbackText={slide.visual!.fallback_description || slide.visual!.alt_text}
                      bucket="lecture-visuals"
                      onSignedUrlReady={(url) => { signedUrlsRef.current[slideIndex] = url; }}
                    />
                    <div className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span className="text-xs">Expand</span>
                    </div>
                    {(slide.visual as any)?.source && (
                      <p className="text-xs text-muted-foreground text-center py-1.5 bg-muted/50">
                        Source: {(slide.visual as any).source}
                      </p>
                    )}
                  </div>
                )}

                {/* Title */}
                <h2
                  data-block-id={`title_${slideIndex}`}
                  className={cn(
                    'font-bold mb-4 leading-tight',
                    slide.type === 'title'
                      ? 'text-3xl sm:text-4xl text-center my-8'
                      : 'text-2xl sm:text-3xl'
                  )}
                >
                  {slide.title}
                </h2>

                {/* Title slide agenda */}
                {enhanced && slide.type === 'title' && getBullets(slide).length > 0 && (
                  <div className="flex flex-col items-center mb-8">
                    <p className="text-base text-muted-foreground mb-4">In this lecture:</p>
                    <div className="space-y-3 max-w-2xl w-full">
                      {getBullets(slide).map((item: string | KeyPointWithHint, index: number) => {
                        const normalized = normalizeKeyPoint(item);
                        const blockId = `key_point_${index}`;
                        const isActive = isCurrentAudioSlide && activeBlockId === blockId;
                        return (
                          <div
                            key={index}
                            data-block-id={isCurrentAudioSlide ? blockId : undefined}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-lg transition-all duration-500',
                              isActive && 'bg-primary/15 ring-2 ring-primary/40 scale-[1.02]',
                              !isActive && 'bg-muted/30'
                            )}
                          >
                            <span className={cn(
                              'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold',
                              isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            )}>
                              {index + 1}
                            </span>
                            <span className={cn(
                              'text-lg leading-relaxed transition-colors duration-300',
                              isActive && 'text-foreground font-medium'
                            )}>
                              {renderWithCitations(normalized.text)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Content for enhanced non-title slides */}
                {enhanced && slide.type !== 'title' && (
                  <div className="space-y-5">
                    {/* Main text */}
                    {slide.content.main_text && (
                      <p
                        data-block-id={isCurrentAudioSlide ? 'main_text' : undefined}
                        className={cn(
                          'text-lg leading-relaxed transition-all duration-500',
                          isCurrentAudioSlide && activeBlockId === 'main_text' && 'bg-primary/10 ring-2 ring-primary/30 rounded-lg p-3 scale-[1.01]'
                        )}
                      >
                        {renderWithCitations(slide.content.main_text)}
                      </p>
                    )}

                    {/* Definition card */}
                    {slide.content.definition && (
                      <div
                        data-block-id={isCurrentAudioSlide ? 'definition' : undefined}
                        className={cn(
                          'p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 transition-all duration-500',
                          isCurrentAudioSlide && activeBlockId === 'definition' && 'ring-2 ring-blue-400/50 scale-[1.01]'
                        )}
                      >
                        <p className="font-semibold text-blue-600 dark:text-blue-400 text-base mb-1">
                          {slide.content.definition.term}
                        </p>
                        <p className="text-base leading-relaxed">{renderWithCitations(getDefinitionText(slide))}</p>
                        {getDefinitionSource(slide) && (
                          <p className="text-sm text-muted-foreground mt-1.5">
                            Source: {getDefinitionSource(slide)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Misconception card */}
                    {professor && (slide.content as any).misconception && (
                      <div
                        data-block-id={isCurrentAudioSlide ? 'misconception' : undefined}
                        className={cn(
                          'p-4 rounded-xl bg-red-500/10 border border-red-500/20 transition-all duration-500',
                          isCurrentAudioSlide && activeBlockId === 'misconception' && 'ring-2 ring-red-400/50 scale-[1.01]'
                        )}
                      >
                        <p className="font-medium text-red-600 dark:text-red-400 text-base mb-2">⚠️ Common Misconception</p>
                        {(() => {
                          const misconception = (slide.content as any).misconception;
                          return typeof misconception === 'string' ? (
                            <p className="text-base">{renderWithCitations(misconception)}</p>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-base"><strong>Wrong belief:</strong> {renderWithCitations(misconception.wrong_belief)}</p>
                              <p className="text-base"><strong>Why it's wrong:</strong> {renderWithCitations(misconception.why_wrong)}</p>
                              <p className="text-base text-green-600 dark:text-green-400"><strong>Correct:</strong> {renderWithCitations(misconception.correct_understanding)}</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Steps */}
                    {slide.content.steps && slide.content.steps.length > 0 && (
                      <ol className="space-y-3">
                        {slide.content.steps.map((step) => {
                          const blockId = `step_${step.step}`;
                          const isActive = isCurrentAudioSlide && activeBlockId === blockId;
                          return (
                            <li
                              key={step.step}
                              data-block-id={isCurrentAudioSlide ? blockId : undefined}
                              className={cn(
                                'flex gap-3 p-3 rounded-lg transition-all duration-500',
                                isActive && 'bg-primary/10 ring-2 ring-primary/30 scale-[1.01]'
                              )}
                            >
                              <span className={cn('font-bold text-lg', config.accentColor)}>
                                {step.step}.
                              </span>
                              <div>
                                <p className="font-medium text-base">{step.title}</p>
                                <p className="text-base text-muted-foreground">{step.explanation}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    {/* Key points / Bullets */}
                    {getBullets(slide).length > 0 && (
                      <div className="space-y-3">
                        {getBullets(slide).map((item: string | KeyPointWithHint, index: number) => {
                          const normalized = normalizeKeyPoint(item);
                          const blockId = `key_point_${index}`;
                          const isActive = isCurrentAudioSlide && activeBlockId === blockId;

                          if (normalized.layoutHint) {
                            return (
                              <div
                                key={index}
                                data-block-id={isCurrentAudioSlide ? blockId : undefined}
                              >
                                <SlideContentBlock
                                  text={normalized.text}
                                  layoutHint={normalized.layoutHint}
                                  isActive={isActive}
                                />
                              </div>
                            );
                          }

                          return (
                            <div
                              key={index}
                              data-block-id={isCurrentAudioSlide ? blockId : undefined}
                              className={cn(
                                'flex items-start gap-3 p-3 rounded-lg transition-all duration-500',
                                isActive && 'bg-primary/15 ring-2 ring-primary/30 scale-[1.02]'
                              )}
                            >
                              <span className={cn('mt-2 h-2 w-2 rounded-full flex-shrink-0', config.iconBg)} />
                              <span className="text-xl leading-relaxed">{renderWithCitations(normalized.text)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Example card */}
                    {slide.content.example && (
                      <div
                        data-block-id={isCurrentAudioSlide ? 'example' : undefined}
                        className={cn(
                          'p-4 rounded-xl bg-green-500/10 border border-green-500/20 transition-all duration-500',
                          isCurrentAudioSlide && activeBlockId === 'example' && 'ring-2 ring-green-400/50 scale-[1.01]'
                        )}
                      >
                        <p className="font-medium text-green-600 dark:text-green-400 text-base mb-2">Example</p>
                        {(() => {
                          const example = slide.content.example;
                          return typeof example === 'string' ? (
                            <p className="text-base">{renderWithCitations(example)}</p>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-base">{renderWithCitations(example.scenario)}</p>
                              <p className="text-base text-muted-foreground">{renderWithCitations(getExampleExplanation(slide))}</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy format */}
                {!enhanced && slide.type !== 'title' && 'content' in slide && Array.isArray(slide.content) && (
                  <ul className="space-y-3">
                    {(slide.content as string[]).map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className={cn('mt-2 h-2 w-2 rounded-full flex-shrink-0', config.iconBg)} />
                        <span className="text-lg leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Visual fallback */}
                {enhanced && !hasVisualUrl && slide.visual && slide.visual.type !== 'none' && (slide.visual.fallback_description || slide.visual.alt_text) && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-dashed">
                    <p className="text-base text-muted-foreground italic">
                      💡 Visual: {slide.visual.fallback_description || slide.visual.alt_text}
                    </p>
                  </div>
                )}
              </section>
            );
          })}

          {/* Bottom spacer */}
          <div className="h-16" />
        </div>

        {/* Global lightbox */}
        <ImageLightbox
          src={lightboxUrl}
          alt={lightboxAlt}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}

export default NarratedScrollViewer;
