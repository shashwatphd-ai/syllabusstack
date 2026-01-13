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
  HelpCircle
} from 'lucide-react';
import type { Slide } from '@/hooks/useLectureSlides';

interface SlideRendererProps {
  slide: Slide;
  slideNumber: number;
  totalSlides: number;
  showSpeakerNotes?: boolean;
  className?: string;
}

const SLIDE_TYPE_CONFIG: Record<Slide['type'], {
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
  example: {
    icon: Code,
    bgGradient: 'from-green-500/10 via-background to-background',
    accentColor: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-500/20',
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

export function SlideRenderer({ 
  slide, 
  slideNumber, 
  totalSlides, 
  showSpeakerNotes = false,
  className 
}: SlideRendererProps) {
  const config = SLIDE_TYPE_CONFIG[slide.type] || SLIDE_TYPE_CONFIG.concept;
  const Icon = config.icon;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Main slide content */}
      <div className={cn(
        'flex-1 rounded-xl border bg-gradient-to-br p-8 flex flex-col',
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

        {/* Content */}
        {slide.type !== 'title' && (
          <div className="flex-1 overflow-auto">
            <ul className="space-y-4">
              {slide.content.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className={cn(
                    'mt-1.5 h-2 w-2 rounded-full flex-shrink-0',
                    config.iconBg
                  )} />
                  <span className="text-lg leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Visual suggestion (if present) */}
        {slide.visual_suggestion && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed">
            <p className="text-sm text-muted-foreground italic">
              💡 Visual: {slide.visual_suggestion}
            </p>
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
