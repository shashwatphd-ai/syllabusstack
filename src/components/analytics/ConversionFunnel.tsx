import { ArrowDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FunnelStep {
  label: string;
  value: number;
  color?: string;
}

interface ConversionFunnelProps {
  title: string;
  description?: string;
  steps: FunnelStep[];
  loading?: boolean;
}

export function ConversionFunnel({
  title,
  description,
  steps,
  loading,
}: ConversionFunnelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-3/4 mx-auto" />
            <Skeleton className="h-16 w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = steps[0]?.value || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, i) => {
          const width = (step.value / maxValue) * 100;
          const dropoff = i > 0
            ? Math.round((1 - step.value / steps[i - 1].value) * 100)
            : 0;
          const conversionFromStart = Math.round((step.value / maxValue) * 100);

          return (
            <div key={i}>
              {i > 0 && (
                <div className="flex items-center justify-center py-1 text-muted-foreground">
                  <ArrowDown className="h-4 w-4" />
                  <span className="text-xs ml-1">-{dropoff}%</span>
                </div>
              )}
              <div className="relative">
                <div
                  className={cn(
                    "h-14 rounded-lg flex items-center justify-between px-4 mx-auto transition-all",
                    step.color || "bg-primary/80"
                  )}
                  style={{ width: `${Math.max(width, 30)}%` }}
                >
                  <span className="text-sm font-medium text-primary-foreground truncate">
                    {step.label}
                  </span>
                  <div className="text-right text-primary-foreground">
                    <p className="font-bold">{step.value.toLocaleString()}</p>
                    <p className="text-xs opacity-80">{conversionFromStart}%</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Horizontal funnel variant
interface HorizontalFunnelProps {
  steps: Array<{
    label: string;
    value: number;
    icon?: React.ReactNode;
  }>;
  loading?: boolean;
}

export function HorizontalFunnel({ steps, loading }: HorizontalFunnelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-between gap-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-20 flex-1" />
        ))}
      </div>
    );
  }

  const maxValue = steps[0]?.value || 1;

  return (
    <div className="flex items-stretch gap-2">
      {steps.map((step, i) => {
        const rate = i > 0
          ? Math.round((step.value / steps[i - 1].value) * 100)
          : 100;

        return (
          <div key={i} className="flex-1 flex flex-col">
            <div className="text-center mb-2">
              <p className="text-2xl font-bold">{step.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{step.label}</p>
            </div>
            <div className="flex-1 flex items-center">
              <div
                className="w-full bg-primary/20 rounded relative overflow-hidden"
                style={{ height: `${(step.value / maxValue) * 60 + 20}px` }}
              >
                <div
                  className="absolute inset-0 bg-primary transition-all"
                  style={{ width: `${rate}%` }}
                />
              </div>
              {i < steps.length - 1 && (
                <div className="px-2 text-xs text-muted-foreground whitespace-nowrap">
                  {rate}%→
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
