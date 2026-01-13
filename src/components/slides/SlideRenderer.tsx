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
import type { Slide, EnhancedSlide, isEnhancedSlide } from '@/hooks/useLectureSlides';

interface SlideRendererProps {
  slide: Slide | EnhancedSlide;
  slideNumber: number;
  totalSlides: number;
  showSpeakerNotes?: boolean;
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

// Check if slide is enhanced format
function isEnhanced(slide: Slide | EnhancedSlide): slide is EnhancedSlide {
  return 'content' in slide && typeof slide.content === 'object' && slide.content !== null && 'main_text' in slide.content;
}

export function SlideRenderer({ 
  slide, 
  slideNumber, 
  totalSlides, 
  showSpeakerNotes = false,
  className 
}: SlideRendererProps) {
  const config = SLIDE_TYPE_CONFIG[slide.type] || SLIDE_TYPE_CONFIG.concept;
  const Icon = config.icon;
  const enhanced = isEnhanced(slide);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Main slide content */}
      <div className={cn(
        'flex-1 rounded-xl border bg-gradient-to-br p-8 flex flex-col overflow-hidden',
        config.bgGradient
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', config.iconBg)}>
              <Icon className={cn('h-5 w-5', config.accentColor)} />
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
          'text-2xl md:text-3xl font-bold mb-6',
          slide.type === 'title' && 'text-4xl md:text-5xl text-center my-auto'
        )}>
          {slide.title}
        </h2>

        {/* Content - Enhanced format */}
        {enhanced && slide.type !== 'title' && (
          <div className="flex-1 overflow-auto space-y-4">
            {/* Main text */}
            {slide.content.main_text && (
              <p className="text-lg leading-relaxed">{slide.content.main_text}</p>
            )}
            
            {/* Definition box */}
            {slide.content.definition && (
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">
                  {slide.content.definition.term}
                </p>
                <p className="text-base">{slide.content.definition.meaning}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Source: {slide.content.definition.source}
                </p>
              </div>
            )}
            
            {/* Steps */}
            {slide.content.steps && slide.content.steps.length > 0 && (
              <ol className="space-y-3">
                {slide.content.steps.map((step) => (
                  <li key={step.step} className="flex gap-3">
                    <span className={cn('font-bold text-lg', config.accentColor)}>
                      {step.step}.
                    </span>
                    <div>
                      <p className="font-medium">{step.title}</p>
                      <p className="text-muted-foreground">{step.explanation}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            
            {/* Example */}
            {slide.content.example && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="font-medium text-green-600 dark:text-green-400 mb-2">Example</p>
                <p className="mb-1">{slide.content.example.scenario}</p>
                <p className="text-muted-foreground">{slide.content.example.explanation}</p>
              </div>
            )}
            
            {/* Bullets */}
            {slide.content.bullets && slide.content.bullets.length > 0 && (
              <ul className="space-y-2">
                {slide.content.bullets.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className={cn('mt-1.5 h-2 w-2 rounded-full flex-shrink-0', config.iconBg)} />
                    <span className="text-lg leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Content - Legacy format */}
        {!enhanced && slide.type !== 'title' && 'content' in slide && Array.isArray(slide.content) && (
          <div className="flex-1 overflow-auto">
            <ul className="space-y-4">
              {(slide.content as string[]).map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className={cn('mt-1.5 h-2 w-2 rounded-full flex-shrink-0', config.iconBg)} />
                  <span className="text-lg leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Visual - Enhanced */}
        {enhanced && slide.visual && slide.visual.type !== 'none' && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
            {slide.visual.url ? (
              <div className="text-center">
                <img 
                  src={slide.visual.url} 
                  alt={slide.visual.alt_text}
                  className="max-h-48 mx-auto rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {slide.visual.source && (
                  <p className="text-xs text-muted-foreground mt-2">Source: {slide.visual.source}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                💡 Visual: {slide.visual.fallback_description || slide.visual.alt_text}
              </p>
            )}
          </div>
        )}

        {/* Visual suggestion - Legacy */}
        {!enhanced && 'visual_suggestion' in slide && slide.visual_suggestion && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed">
            <p className="text-sm text-muted-foreground italic">
              💡 Visual: {slide.visual_suggestion}
            </p>
          </div>
        )}
        
        {/* Citations - Enhanced only */}
        {enhanced && slide.citations && slide.citations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-1">References:</p>
            <div className="flex flex-wrap gap-2">
              {slide.citations.map((citation, i) => (
                <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                  [{i + 1}] {citation.source}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Speaker notes panel */}
      {showSpeakerNotes && slide.speaker_notes && (
        <div className="mt-4 p-4 rounded-lg bg-muted/50 border max-h-32 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground mb-1">Speaker Notes</p>
          <p className="text-sm leading-relaxed">{slide.speaker_notes}</p>
        </div>
      )}
    </div>
  );
}

export default SlideRenderer;
