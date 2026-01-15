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
  ListOrdered
} from 'lucide-react';
import type { Slide, EnhancedSlide, ProfessorSlide } from '@/hooks/useLectureSlides';
import { AuthenticatedImage } from './AuthenticatedImage';

interface SlideRendererProps {
  slide: Slide | EnhancedSlide | ProfessorSlide;
  slideNumber: number;
  totalSlides: number;
  showSpeakerNotes?: boolean;
  showPedagogy?: boolean;
  className?: string;
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
  className 
}: SlideRendererProps) {
  const config = SLIDE_TYPE_CONFIG[slide.type] || SLIDE_TYPE_CONFIG.concept;
  const Icon = config.icon;
  const enhanced = isEnhanced(slide);
  const professor = isProfessor(slide);

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

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Main slide content */}
      <div className={cn(
        'flex-1 rounded-xl border bg-gradient-to-br p-6 flex flex-col overflow-hidden',
        config.bgGradient
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-lg', config.iconBg)}>
              <Icon className={cn('h-4 w-4', config.accentColor)} />
            </div>
            <span className={cn('text-sm font-medium capitalize', config.accentColor)}>
              {slide.type.replace('_', ' ')}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {slideNumber} / {totalSlides}
          </span>
        </div>

        {/* Title */}
        <h2 className={cn(
          'text-xl md:text-2xl font-bold mb-4',
          slide.type === 'title' && 'text-3xl md:text-4xl text-center my-auto'
        )}>
          {slide.title}
        </h2>

        {/* Content area - side-by-side layout when visual exists */}
        {enhanced && slide.type !== 'title' && (
          <div className={cn(
            'flex-1 overflow-auto',
            hasVisualUrl ? 'flex gap-4' : ''
          )}>
            {/* Text content */}
            <div className={cn(
              'space-y-3',
              hasVisualUrl ? 'flex-1 min-w-0' : ''
            )}>
              {/* Main text */}
              {slide.content.main_text && (
                <p className="text-base leading-relaxed">{slide.content.main_text}</p>
              )}
              
              {/* Definition box */}
              {slide.content.definition && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm mb-1">
                    {slide.content.definition.term}
                  </p>
                  <p className="text-sm">{getDefinitionText()}</p>
                  {getDefinitionSource() && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Source: {getDefinitionSource()}
                    </p>
                  )}
                </div>
              )}

              {/* V3 Misconception box */}
              {professor && (slide.content as any).misconception && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="font-medium text-red-600 dark:text-red-400 text-sm mb-1">⚠️ Common Misconception</p>
                  <p className="text-sm mb-1"><strong>Wrong belief:</strong> {(slide.content as any).misconception.wrong_belief}</p>
                  <p className="text-sm mb-1"><strong>Why it's wrong:</strong> {(slide.content as any).misconception.why_wrong}</p>
                  <p className="text-sm text-green-600 dark:text-green-400"><strong>Correct:</strong> {(slide.content as any).misconception.correct_understanding}</p>
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
              
              {/* Example */}
              {slide.content.example && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="font-medium text-green-600 dark:text-green-400 text-sm mb-1">Example</p>
                  <p className="text-sm mb-1">{slide.content.example.scenario}</p>
                  <p className="text-sm text-muted-foreground">{getExampleExplanation()}</p>
                </div>
              )}
              
              {/* Bullets / Key Points */}
              {getBullets().length > 0 && (
                <ul className="space-y-1.5">
                  {getBullets().map((item: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', config.iconBg)} />
                      <span className="text-base leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Visual - side by side when URL exists */}
            {hasVisualUrl && (
              <div className="w-2/5 flex-shrink-0 flex items-center justify-center">
                <div className="w-full rounded-lg overflow-hidden bg-muted/30">
                  <AuthenticatedImage 
                    src={slide.visual!.url} 
                    alt={slide.visual!.alt_text}
                    className="w-full h-auto max-h-[280px] object-contain"
                    fallbackText={slide.visual!.fallback_description || slide.visual!.alt_text}
                    bucket="lecture-visuals"
                  />
                  {(slide.visual as any).source && (
                    <p className="text-xs text-muted-foreground text-center py-1">Source: {(slide.visual as any).source}</p>
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
        <div className="mt-3 p-3 rounded-lg bg-muted/50 border max-h-28 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground mb-1">Speaker Notes</p>
          <p className="text-sm leading-relaxed">{slide.speaker_notes}</p>
        </div>
      )}
    </div>
  );
}

export default SlideRenderer;
