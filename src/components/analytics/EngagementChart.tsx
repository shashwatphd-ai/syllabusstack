import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DataPoint {
  date: string;
  value: number;
  label?: string;
}

interface EngagementChartProps {
  title: string;
  description?: string;
  data: DataPoint[];
  loading?: boolean;
  height?: number;
  color?: string;
}

export function EngagementChart({
  title,
  description,
  data,
  loading,
  height = 200,
  color = 'bg-primary',
}: EngagementChartProps) {
  const { max, bars } = useMemo(() => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const bars = data.map(d => ({
      ...d,
      height: (d.value / maxValue) * 100,
    }));
    return { max: maxValue, bars };
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-1" style={{ height }}>
          {bars.map((bar, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full relative group"
                style={{ height: `${height - 24}px` }}
              >
                <div
                  className={cn(
                    "absolute bottom-0 w-full rounded-t transition-all",
                    color,
                    "opacity-80 hover:opacity-100"
                  )}
                  style={{ height: `${bar.height}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {bar.label || bar.date}: {bar.value}
                </div>
              </div>
              <span className="text-xs text-muted-foreground truncate max-w-full">
                {bar.date}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Simple sparkline for inline use
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 100, height = 24, color = '#8884d8' }: SparklineProps) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
