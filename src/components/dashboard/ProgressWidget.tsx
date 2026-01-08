import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  PlayCircle, 
  Circle, 
  SkipForward,
  TrendingUp
} from "lucide-react";
import { Link } from "react-router-dom";

interface RecommendationsByStatus {
  pending: number;
  in_progress: number;
  completed: number;
  skipped: number;
}

interface ProgressWidgetProps {
  recommendations: RecommendationsByStatus;
  isLoading?: boolean;
}

const statusConfig = [
  { 
    key: 'completed' as const, 
    label: 'Completed', 
    icon: CheckCircle2, 
    color: 'text-success',
    bgColor: 'bg-success/10',
    barColor: 'bg-success'
  },
  { 
    key: 'in_progress' as const, 
    label: 'In Progress', 
    icon: PlayCircle, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    barColor: 'bg-blue-500'
  },
  { 
    key: 'pending' as const, 
    label: 'To Do', 
    icon: Circle, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    barColor: 'bg-muted-foreground'
  },
  { 
    key: 'skipped' as const, 
    label: 'Skipped', 
    icon: SkipForward, 
    color: 'text-muted-foreground/50',
    bgColor: 'bg-muted/50',
    barColor: 'bg-muted-foreground/30'
  },
];

export function ProgressWidget({ recommendations, isLoading }: ProgressWidgetProps) {
  const total = recommendations.pending + recommendations.in_progress + recommendations.completed + recommendations.skipped;
  const actionableTotal = total - recommendations.skipped;
  const completionRate = actionableTotal > 0 
    ? Math.round((recommendations.completed / actionableTotal) * 100)
    : 0;

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="h-5 bg-muted rounded w-1/2 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-2 bg-muted rounded w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Progress Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Circle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">No recommendations yet</p>
            <p className="text-sm">Run a gap analysis to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Progress
          </CardTitle>
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
            {completionRate}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{recommendations.completed} of {actionableTotal}</span>
            <span>{recommendations.in_progress} active</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            {recommendations.completed > 0 && (
              <div 
                className="h-full bg-success transition-all" 
                style={{ width: `${(recommendations.completed / total) * 100}%` }} 
              />
            )}
            {recommendations.in_progress > 0 && (
              <div 
                className="h-full bg-blue-500 transition-all" 
                style={{ width: `${(recommendations.in_progress / total) * 100}%` }} 
              />
            )}
            {recommendations.pending > 0 && (
              <div 
                className="h-full bg-muted-foreground/30 transition-all" 
                style={{ width: `${(recommendations.pending / total) * 100}%` }} 
              />
            )}
          </div>
        </div>

        {/* Status breakdown - 2x2 compact grid */}
        <div className="grid grid-cols-2 gap-2">
          {statusConfig.map((status) => {
            const count = recommendations[status.key];
            const Icon = status.icon;
            
            return (
              <div 
                key={status.key}
                className={`flex items-center gap-2 p-2 rounded-md ${status.bgColor}`}
              >
                <Icon className={`h-3.5 w-3.5 ${status.color}`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-none">{count}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{status.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {(recommendations.pending > 0 || recommendations.in_progress > 0) && (
          <Link 
            to="/recommendations"
            className="block text-center text-xs text-primary hover:underline pt-1"
          >
            View all →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
