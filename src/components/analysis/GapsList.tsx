import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  ChevronRight, 
  Clock, 
  Code,
  Users,
  Lightbulb,
  BookOpen,
  Flame,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";

type GapSeverity = "critical" | "important" | "nice_to_have" | "nice-to-have";
type GapCategory = "technical" | "soft_skill" | "soft-skill" | "experience" | "certification";

interface Gap {
  id?: string;
  job_requirement?: string;
  skill?: string;
  student_status?: string;
  currentLevel?: number;
  requiredLevel?: number;
  severity?: GapSeverity;
  importance?: string;
  impact?: string;
  category?: GapCategory;
  estimatedTimeToClose?: string;
  time_to_close?: string;
  description?: string;
  priority?: number;
  reason?: string;
}

interface GapsListProps {
  gaps?: Gap[];
  criticalGaps?: Gap[];
  priorityGaps?: Array<{ gap: string; priority: number; reason: string }>;
  onViewGap?: (gapId: string) => void;
  isLoading?: boolean;
  variant?: 'full' | 'compact';
}

const getSeverityColor = (severity?: GapSeverity | string): string => {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "important":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    default:
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  }
};

const getCategoryIcon = (category?: GapCategory | string) => {
  switch (category) {
    case "technical":
      return <Code className="h-4 w-4" />;
    case "soft_skill":
    case "soft-skill":
      return <Users className="h-4 w-4" />;
    case "experience":
      return <Lightbulb className="h-4 w-4" />;
    case "certification":
      return <BookOpen className="h-4 w-4" />;
    default:
      return <Target className="h-4 w-4" />;
  }
};

export function GapsList({ 
  gaps = [], 
  criticalGaps = [],
  priorityGaps = [],
  onViewGap, 
  isLoading,
  variant = 'full'
}: GapsListProps) {
  // Merge gaps from different sources
  const allGaps = [
    ...criticalGaps.map((g, i) => ({ ...g, id: g.id || `critical-${i}`, severity: 'critical' as GapSeverity })),
    ...gaps.filter(g => !criticalGaps.find(cg => cg.job_requirement === g.job_requirement)),
  ];

  const criticalCount = allGaps.filter((g) => g.severity === "critical").length;
  const importantCount = allGaps.filter((g) => g.severity === "important").length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (allGaps.length === 0 && priorityGaps.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Target className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No skill gaps identified. Run a gap analysis to see where you stand.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Skill Gaps ({allGaps.length})
          </CardTitle>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="font-normal">
                <Flame className="h-3 w-3 mr-1" />
                {criticalCount} Critical
              </Badge>
            )}
            {importantCount > 0 && (
              <Badge variant="secondary" className="font-normal">
                {importantCount} Important
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Priority Gaps Section */}
        {priorityGaps.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Priority Order</h4>
            <div className="space-y-2">
              {priorityGaps.map((pg, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {pg.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{pg.gap}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pg.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Gaps */}
        {allGaps.map((gap, index) => {
          const gapId = gap.id || `gap-${index}`;
          const gapTitle = gap.job_requirement || gap.skill || 'Unknown Gap';
          const gapDescription = gap.student_status || gap.description || gap.impact;
          
          return (
            <div
              key={gapId}
              className={cn(
                "border rounded-lg p-4 transition-colors",
                onViewGap && "hover:bg-muted/50 cursor-pointer group"
              )}
              onClick={() => onViewGap?.(gapId)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(gap.category)}
                  <h4 className={cn(
                    "font-medium",
                    onViewGap && "group-hover:text-accent transition-colors"
                  )}>
                    {gapTitle}
                  </h4>
                </div>
                <Badge variant="outline" className={getSeverityColor(gap.severity || gap.importance)}>
                  {gap.severity || gap.importance || 'gap'}
                </Badge>
              </div>

              {gapDescription && (
                <p className="text-sm text-muted-foreground mb-3">{gapDescription}</p>
              )}

              {gap.currentLevel !== undefined && gap.requiredLevel !== undefined && (
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span>Current: {gap.currentLevel}%</span>
                    <span>Required: {gap.requiredLevel}%</span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-muted-foreground/30 rounded-full"
                      style={{ width: `${gap.requiredLevel}%` }}
                    />
                    <div
                      className="absolute h-full bg-accent rounded-full"
                      style={{ width: `${gap.currentLevel}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Est. {gap.estimatedTimeToClose || gap.time_to_close || 'TBD'}
                </span>
                {onViewGap && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
