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
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = step.completed;
          const isCurrent = index === currentStepIndex;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.label} className="flex items-center">
              {/* Step indicator with label */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors shrink-0",
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
                <div className="text-center min-w-[80px]">
                  <p className={cn(
                    "text-xs font-medium leading-tight",
                    isCompleted 
                      ? "text-success" 
                      : isCurrent 
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{step.description}</p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="w-8 sm:w-16 lg:w-24 mx-1">
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
