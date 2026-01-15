import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface ProficiencySliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showLabels?: boolean;
  disabled?: boolean;
  className?: string;
}

const PROFICIENCY_LABELS = [
  { value: 0, label: 'No Experience' },
  { value: 25, label: 'Beginner' },
  { value: 50, label: 'Intermediate' },
  { value: 75, label: 'Advanced' },
  { value: 100, label: 'Expert' },
];

export function ProficiencySlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showLabels = true,
  disabled = false,
  className,
}: ProficiencySliderProps) {
  const getProficiencyLabel = (val: number): string => {
    if (val < 15) return 'No Experience';
    if (val < 35) return 'Beginner';
    if (val < 60) return 'Intermediate';
    if (val < 85) return 'Advanced';
    return 'Expert';
  };

  const getProficiencyColor = (val: number): string => {
    if (val < 15) return 'text-muted-foreground';
    if (val < 35) return 'text-yellow-500';
    if (val < 60) return 'text-blue-500';
    if (val < 85) return 'text-green-500';
    return 'text-purple-500';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Current value display */}
      <div className="flex items-center justify-between">
        <span className={cn('text-lg font-semibold', getProficiencyColor(value))}>
          {getProficiencyLabel(value)}
        </span>
        <span className="text-2xl font-bold text-foreground">{value}</span>
      </div>

      {/* Slider */}
      <Slider
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="py-2"
      />

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          {PROFICIENCY_LABELS.map((label) => (
            <span
              key={label.value}
              className={cn(
                'text-center',
                value >= label.value - 10 && value <= label.value + 10 && 'text-primary font-medium'
              )}
            >
              {label.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
