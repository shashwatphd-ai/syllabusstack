import { cn } from '@/lib/utils';

interface LikertScaleProps {
  value: number | null;
  onChange: (value: number) => void;
  points?: 5 | 7;
  labels?: string[];
  disabled?: boolean;
  className?: string;
}

const DEFAULT_5_LABELS = [
  'Strongly Disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly Agree',
];

const DEFAULT_7_LABELS = [
  'Strongly Disagree',
  'Disagree',
  'Somewhat Disagree',
  'Neutral',
  'Somewhat Agree',
  'Agree',
  'Strongly Agree',
];

export function LikertScale({
  value,
  onChange,
  points = 5,
  labels,
  disabled = false,
  className,
}: LikertScaleProps) {
  const defaultLabels = points === 5 ? DEFAULT_5_LABELS : DEFAULT_7_LABELS;
  const displayLabels = labels || defaultLabels;
  const options = Array.from({ length: points }, (_, i) => i + 1);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Scale buttons */}
      <div className="flex justify-between gap-2">
        {options.map((optionValue) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => !disabled && onChange(optionValue)}
            disabled={disabled}
            className={cn(
              'flex-1 h-12 rounded-lg border-2 font-medium transition-all',
              'hover:border-primary hover:bg-primary/5',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              value === optionValue
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {optionValue}
          </button>
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span className="max-w-[100px] text-left">{displayLabels[0]}</span>
        {points >= 5 && (
          <span className="max-w-[80px] text-center">{displayLabels[Math.floor(points / 2)]}</span>
        )}
        <span className="max-w-[100px] text-right">{displayLabels[points - 1]}</span>
      </div>
    </div>
  );
}
