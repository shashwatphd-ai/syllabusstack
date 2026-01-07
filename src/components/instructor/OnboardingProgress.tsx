import { Check, Circle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  description?: string;
  completed: boolean;
  active?: boolean;
}

interface OnboardingProgressProps {
  steps: Step[];
  className?: string;
}

export function OnboardingProgress({ steps, className }: OnboardingProgressProps) {
  // Find the current (first incomplete) step
  const currentStepIndex = steps.findIndex(step => !step.completed);
  
  return (
    <div className={cn("bg-card border rounded-lg p-4", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.completed;
          const isCurrent = index === currentStepIndex;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.label} className="flex items-center flex-1">
              {/* Step indicator */}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isCompleted 
                      ? "bg-success text-success-foreground" 
                      : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="hidden sm:block">
                  <p className={cn(
                    "text-sm font-medium",
                    isCompleted 
                      ? "text-success" 
                      : isCurrent 
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-2 sm:mx-4">
                  <div 
                    className={cn(
                      "h-0.5 transition-colors",
                      isCompleted ? "bg-success" : "bg-muted"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
