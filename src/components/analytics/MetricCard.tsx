import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label?: string;
  };
  className?: string;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  loading,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
      ? TrendingDown
      : Minus
    : null;

  const trendColor = trend
    ? trend.value > 0
      ? 'text-success'
      : trend.value < 0
      ? 'text-destructive'
      : 'text-muted-foreground'
    : '';

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon && (
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
        <div className="mt-2">
          <p className="text-3xl font-bold">{value}</p>
          <div className="flex items-center gap-2 mt-1">
            {trend && TrendIcon && (
              <span className={cn("flex items-center text-xs font-medium", trendColor)}>
                <TrendIcon className="h-3 w-3 mr-0.5" />
                {Math.abs(trend.value)}%
              </span>
            )}
            {(description || trend?.label) && (
              <span className="text-xs text-muted-foreground">
                {trend?.label || description}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for inline display
interface CompactMetricProps {
  label: string;
  value: string | number;
  trend?: number;
}

export function CompactMetric({ label, value, trend }: CompactMetricProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium">{value}</span>
        {trend !== undefined && (
          <span className={cn(
            "text-xs",
            trend > 0 && "text-success",
            trend < 0 && "text-destructive"
          )}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  );
}
