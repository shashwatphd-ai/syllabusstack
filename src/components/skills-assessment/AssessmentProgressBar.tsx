import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

interface Section {
  key: string;
  label: string;
  questionsCount: number;
}

interface AssessmentProgressProps {
  currentSection: string;
  answeredCount: number;
  totalCount: number;
  sections?: Section[];
  className?: string;
}

const DEFAULT_SECTIONS: Section[] = [
  { key: 'holland_riasec', label: 'Interests', questionsCount: 48 },
  { key: 'onet_skills', label: 'Skills', questionsCount: 35 },
  { key: 'work_values', label: 'Values', questionsCount: 20 },
];

export function AssessmentProgressBar({
  currentSection,
  answeredCount,
  totalCount,
  sections = DEFAULT_SECTIONS,
  className,
}: AssessmentProgressProps) {
  const percentage = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  // Calculate which sections are complete
  let runningTotal = 0;
  const sectionStatus = sections.map((section) => {
    const sectionStart = runningTotal;
    const sectionEnd = runningTotal + section.questionsCount;
    runningTotal = sectionEnd;

    if (answeredCount >= sectionEnd) {
      return 'complete';
    } else if (answeredCount >= sectionStart) {
      return 'active';
    }
    return 'pending';
  });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">
            {answeredCount} / {totalCount} ({percentage}%)
          </span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      {/* Section indicators */}
      <div className="flex justify-between gap-2">
        {sections.map((section, index) => (
          <div
            key={section.key}
            className={cn(
              'flex-1 flex items-center gap-2 p-2 rounded-lg border transition-all',
              sectionStatus[index] === 'complete' && 'border-green-500 bg-green-50 dark:bg-green-950',
              sectionStatus[index] === 'active' && 'border-primary bg-primary/5',
              sectionStatus[index] === 'pending' && 'border-border opacity-50'
            )}
          >
            {sectionStatus[index] === 'complete' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <Circle
                className={cn(
                  'h-4 w-4 shrink-0',
                  sectionStatus[index] === 'active' ? 'text-primary' : 'text-muted-foreground'
                )}
              />
            )}
            <span
              className={cn(
                'text-xs font-medium truncate',
                sectionStatus[index] === 'complete' && 'text-green-700 dark:text-green-300',
                sectionStatus[index] === 'active' && 'text-primary',
                sectionStatus[index] === 'pending' && 'text-muted-foreground'
              )}
            >
              {section.label}
            </span>
          </div>
        ))}
      </div>

      {/* Time estimate */}
      <div className="text-center">
        <Badge variant="secondary" className="text-xs">
          ~{Math.ceil((totalCount - answeredCount) * 0.2)} min remaining
        </Badge>
      </div>
    </div>
  );
}
