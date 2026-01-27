import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  spotlightPadding?: number;
  onEnter?: () => void;
  onExit?: () => void;
}

interface TourContextType {
  startTour: (tourId: string) => void;
  endTour: () => void;
  isActive: boolean;
  currentTourId: string | null;
  completedTours: Set<string>;
  markTourComplete: (tourId: string) => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

// Store completed tours in localStorage
const STORAGE_KEY = 'completed_tours';

function getCompletedTours(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function saveCompletedTours(tours: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(tours)));
  } catch {
    // Ignore storage errors
  }
}

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [completedTours, setCompletedTours] = useState<Set<string>>(getCompletedTours);

  const startTour = useCallback((tourId: string) => {
    setActiveTourId(tourId);
  }, []);

  const endTour = useCallback(() => {
    setActiveTourId(null);
  }, []);

  const markTourComplete = useCallback((tourId: string) => {
    setCompletedTours(prev => {
      const next = new Set(prev);
      next.add(tourId);
      saveCompletedTours(next);
      return next;
    });
  }, []);

  return (
    <TourContext.Provider
      value={{
        startTour,
        endTour,
        isActive: activeTourId !== null,
        currentTourId: activeTourId,
        completedTours,
        markTourComplete,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

interface ProductTourProps {
  tourId: string;
  steps: TourStep[];
  onComplete?: () => void;
  autoStart?: boolean;
  showOnce?: boolean;
}

export function ProductTour({
  tourId,
  steps,
  onComplete,
  autoStart = false,
  showOnce = true,
}: ProductTourProps) {
  const { currentTourId, endTour, completedTours, markTourComplete } = useTour();
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const isActive = currentTourId === tourId;
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Auto-start logic
  useEffect(() => {
    if (autoStart && !isActive && (!showOnce || !completedTours.has(tourId))) {
      // Delay to ensure page is rendered
      const timer = setTimeout(() => {
        const { startTour } = useTour();
        // This won't work in useEffect, need to use context differently
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isActive, showOnce, completedTours, tourId]);

  // Find and highlight target element
  useEffect(() => {
    if (!isActive || !step) return;

    const findTarget = () => {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        step.onEnter?.();
      } else {
        setTargetRect(null);
      }
    };

    findTarget();

    // Re-find on resize
    const observer = new ResizeObserver(findTarget);
    observer.observe(document.body);

    return () => {
      observer.disconnect();
      step.onExit?.();
    };
  }, [isActive, step, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    markTourComplete(tourId);
    endTour();
    setCurrentStep(0);
    onComplete?.();
  };

  const handleSkip = () => {
    endTour();
    setCurrentStep(0);
  };

  if (!isActive || !step) return null;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = step.spotlightPadding ?? 8;
    const placement = step.placement ?? 'bottom';
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = targetRect.top - tooltipHeight - padding - 16;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + padding + 16;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - padding - 16;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + padding + 16;
        break;
    }

    // Keep within viewport
    top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, top));
    left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));

    return {
      position: 'fixed',
      top,
      left,
      width: tooltipWidth,
    };
  };

  return createPortal(
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[9998]">
        {/* Dark overlay with spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - (step.spotlightPadding ?? 8)}
                  y={targetRect.top - (step.spotlightPadding ?? 8)}
                  width={targetRect.width + (step.spotlightPadding ?? 8) * 2}
                  height={targetRect.height + (step.spotlightPadding ?? 8) * 2}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight border */}
        {targetRect && (
          <div
            className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
            style={{
              left: targetRect.left - (step.spotlightPadding ?? 8),
              top: targetRect.top - (step.spotlightPadding ?? 8),
              width: targetRect.width + (step.spotlightPadding ?? 8) * 2,
              height: targetRect.height + (step.spotlightPadding ?? 8) * 2,
            }}
          />
        )}
      </div>

      {/* Tooltip Card */}
      <Card className="z-[9999] shadow-xl" style={getTooltipStyle()}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{step.title}</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="h-1" />
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground">{step.content}</p>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {currentStep + 1} of {steps.length}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {currentStep === steps.length - 1 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>,
    document.body
  );
}

// Pre-built tours for common flows
export const ONBOARDING_TOUR: TourStep[] = [
  {
    id: 'welcome',
    target: '[data-tour="dashboard-header"]',
    title: 'Welcome to SyllabusStack!',
    content: 'Let\'s take a quick tour to help you get started with your learning journey.',
    placement: 'bottom',
  },
  {
    id: 'learn',
    target: '[data-tour="nav-learn"]',
    title: 'Learn',
    content: 'Access your courses, track your progress, and view your learning history here.',
    placement: 'bottom',
  },
  {
    id: 'career',
    target: '[data-tour="nav-career"]',
    title: 'Career Path',
    content: 'Set your dream jobs, analyze skill gaps, and get personalized recommendations.',
    placement: 'bottom',
  },
  {
    id: 'progress',
    target: '[data-tour="nav-progress"]',
    title: 'Progress',
    content: 'Track your achievements, verified skills, and learning milestones.',
    placement: 'bottom',
  },
  {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    title: 'Notifications',
    content: 'Stay updated with course completions, new recommendations, and important updates.',
    placement: 'left',
  },
];

export const CAREER_PATH_TOUR: TourStep[] = [
  {
    id: 'dream-jobs',
    target: '[data-tour="dream-jobs-section"]',
    title: 'Dream Jobs',
    content: 'Add careers you\'re interested in. We\'ll analyze what skills you need.',
    placement: 'bottom',
  },
  {
    id: 'gap-analysis',
    target: '[data-tour="gap-analysis-section"]',
    title: 'Skill Gap Analysis',
    content: 'See which skills you have and which ones you need to develop.',
    placement: 'right',
  },
  {
    id: 'recommendations',
    target: '[data-tour="recommendations-section"]',
    title: 'Personalized Recommendations',
    content: 'Get content suggestions tailored to help you close your skill gaps.',
    placement: 'top',
  },
];

// Hook to trigger tour on first visit
export function useFirstVisitTour(tourId: string, delay = 1000) {
  const { startTour, completedTours } = useTour();

  useEffect(() => {
    if (completedTours.has(tourId)) return;

    const timer = setTimeout(() => {
      startTour(tourId);
    }, delay);

    return () => clearTimeout(timer);
  }, [tourId, delay, startTour, completedTours]);
}
