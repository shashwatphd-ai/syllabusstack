import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CohortData {
  cohort: string; // e.g., "Jan 2024"
  users: number;
  retention: number[]; // retention % for each period [week1, week2, ...]
}

interface RetentionCohortProps {
  title: string;
  description?: string;
  data: CohortData[];
  periods: string[]; // e.g., ["Week 1", "Week 2", ...]
  loading?: boolean;
}

export function RetentionCohort({
  title,
  description,
  data,
  periods,
  loading,
}: RetentionCohortProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const getColor = (value: number): string => {
    if (value >= 80) return 'bg-success text-success-foreground';
    if (value >= 60) return 'bg-success/70 text-success-foreground';
    if (value >= 40) return 'bg-warning/70 text-warning-foreground';
    if (value >= 20) return 'bg-warning/50 text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 font-medium text-muted-foreground">Cohort</th>
              <th className="text-center p-2 font-medium text-muted-foreground">Users</th>
              {periods.map((period, i) => (
                <th key={i} className="text-center p-2 font-medium text-muted-foreground">
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td className="p-2 font-medium">{row.cohort}</td>
                <td className="p-2 text-center text-muted-foreground">{row.users}</td>
                {row.retention.map((value, j) => (
                  <td key={j} className="p-1">
                    <div
                      className={cn(
                        "rounded p-2 text-center font-medium text-xs",
                        getColor(value)
                      )}
                    >
                      {value}%
                    </div>
                  </td>
                ))}
                {/* Fill empty cells if retention array is shorter than periods */}
                {Array.from({ length: periods.length - row.retention.length }).map((_, k) => (
                  <td key={`empty-${k}`} className="p-1">
                    <div className="rounded p-2 text-center text-xs text-muted-foreground bg-muted/30">
                      —
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex items-center justify-end gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-success" />
            <span>80%+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-success/70" />
            <span>60-79%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-warning/70" />
            <span>40-59%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-warning/50" />
            <span>20-39%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-muted" />
            <span>&lt;20%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Simple retention summary
interface RetentionSummaryProps {
  day1: number;
  day7: number;
  day30: number;
  loading?: boolean;
}

export function RetentionSummary({ day1, day7, day30, loading }: RetentionSummaryProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-6">
        <Skeleton className="h-16 w-20" />
        <Skeleton className="h-16 w-20" />
        <Skeleton className="h-16 w-20" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <RetentionBadge label="D1" value={day1} />
      <RetentionBadge label="D7" value={day7} />
      <RetentionBadge label="D30" value={day30} />
    </div>
  );
}

function RetentionBadge({ label, value }: { label: string; value: number }) {
  const color =
    value >= 60 ? 'text-success' :
    value >= 40 ? 'text-warning' :
    'text-destructive';

  return (
    <div className="text-center">
      <p className={cn("text-2xl font-bold", color)}>{value}%</p>
      <p className="text-xs text-muted-foreground">{label} Retention</p>
    </div>
  );
}
