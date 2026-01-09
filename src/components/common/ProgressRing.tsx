import { cn } from "@/lib/utils";

interface ProgressRingProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  strokeWidth?: number;
  className?: string;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'accent';
}

const sizeConfig = {
  sm: { dimension: 32, fontSize: 'text-[10px]', strokeDefault: 3 },
  md: { dimension: 48, fontSize: 'text-xs', strokeDefault: 4 },
  lg: { dimension: 64, fontSize: 'text-sm', strokeDefault: 5 },
};

const colorConfig = {
  primary: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  destructive: 'stroke-destructive',
  accent: 'stroke-accent',
};

export function ProgressRing({
  progress,
  size = 'md',
  showLabel = true,
  label,
  strokeWidth,
  className,
  color = 'primary',
}: ProgressRingProps) {
  const config = sizeConfig[size];
  const dimension = config.dimension;
  const stroke = strokeWidth ?? config.strokeDefault;
  const radius = (dimension - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const offset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={dimension}
        height={dimension}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(colorConfig[color], "transition-all duration-500 ease-out")}
        />
      </svg>
      {showLabel && (
        <span className={cn(
          "absolute inset-0 flex items-center justify-center font-semibold",
          config.fontSize
        )}>
          {label ?? `${Math.round(clampedProgress)}%`}
        </span>
      )}
    </div>
  );
}

// Convenience component for module progress
interface ModuleProgressRingProps {
  completed: number;
  total: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ModuleProgressRing({
  completed,
  total,
  size = 'md',
  className,
}: ModuleProgressRingProps) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const color = progress === 100 ? 'success' : progress >= 50 ? 'accent' : 'primary';

  return (
    <ProgressRing
      progress={progress}
      size={size}
      label={`${completed}/${total}`}
      color={color}
      className={className}
    />
  );
}

// Gap closure progress ring
interface GapProgressRingProps {
  closedGaps: number;
  totalGaps: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GapProgressRing({
  closedGaps,
  totalGaps,
  size = 'md',
  className,
}: GapProgressRingProps) {
  const progress = totalGaps > 0 ? (closedGaps / totalGaps) * 100 : 0;
  const color = progress >= 80 ? 'success' : progress >= 50 ? 'accent' : progress >= 25 ? 'warning' : 'destructive';

  return (
    <ProgressRing
      progress={progress}
      size={size}
      color={color}
      className={className}
    />
  );
}
