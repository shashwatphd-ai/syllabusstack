import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Target,
  CheckCircle2,
  Clock,
  Award,
  ArrowUp,
  CalendarDays
} from "lucide-react";

interface Recommendation {
  id: string;
  status: string;
  type: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface CareerProgressTrackerProps {
  recommendations: Recommendation[];
  matchScore: number;
  gapsCount: number;
  dreamJobTitle: string;
}

export function CareerProgressTracker({
  recommendations,
  matchScore,
  gapsCount,
  dreamJobTitle
}: CareerProgressTrackerProps) {
  const stats = useMemo(() => {
    const total = recommendations.length;
    const completed = recommendations.filter(r => r.status === 'completed').length;
    const inProgress = recommendations.filter(r => r.status === 'in_progress').length;
    const pending = recommendations.filter(r => r.status === 'pending').length;
    const skipped = recommendations.filter(r => r.status === 'skipped').length;

    // Calculate completion rate
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Calculate by type
    const byType = recommendations.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const completedByType = recommendations
      .filter(r => r.status === 'completed')
      .reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // High priority items
    const highPriorityTotal = recommendations.filter(r => r.priority === 'high').length;
    const highPriorityCompleted = recommendations.filter(
      r => r.priority === 'high' && r.status === 'completed'
    ).length;

    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentlyCompleted = recommendations.filter(r =>
      r.status === 'completed' && new Date(r.updated_at) > weekAgo
    ).length;

    return {
      total,
      completed,
      inProgress,
      pending,
      skipped,
      completionRate,
      byType,
      completedByType,
      highPriorityTotal,
      highPriorityCompleted,
      recentlyCompleted
    };
  }, [recommendations]);

  // Calculate projected completion (rough estimate)
  const projectedWeeks = useMemo(() => {
    if (stats.recentlyCompleted === 0) return null;
    const remaining = stats.pending + stats.inProgress;
    return Math.ceil(remaining / stats.recentlyCompleted);
  }, [stats]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'course': return 'Courses';
      case 'project': return 'Projects';
      case 'certification': return 'Certifications';
      case 'action': return 'Actions';
      case 'skill': return 'Skills';
      case 'experience': return 'Experience';
      case 'reading': return 'Reading';
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Progress Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Career Progress</CardTitle>
              <CardDescription>{dreamJobTitle}</CardDescription>
            </div>
            <Badge
              variant={matchScore >= 60 ? "default" : "secondary"}
              className="text-lg px-3 py-1"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              {matchScore}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Action Plan Progress</span>
              <span className="font-medium">{stats.completionRate}%</span>
            </div>
            <Progress value={stats.completionRate} className="h-3" />
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-4 gap-3 pt-2">
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-[10px] text-muted-foreground">Done</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
              <p className="text-[10px] text-muted-foreground">Active</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-muted-foreground">{stats.pending}</p>
              <p className="text-[10px] text-muted-foreground">To Do</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{gapsCount}</p>
              <p className="text-[10px] text-muted-foreground">Gaps</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* High Priority Progress */}
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {stats.highPriorityCompleted}/{stats.highPriorityTotal}
              </p>
              <p className="text-[10px] text-muted-foreground">High Priority</p>
            </div>
          </div>
        </Card>

        {/* This Week */}
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-green-500/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.recentlyCompleted}</p>
              <p className="text-[10px] text-muted-foreground">This Week</p>
            </div>
          </div>
        </Card>

        {/* Projected Completion */}
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {projectedWeeks ? `${projectedWeeks}w` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">Est. Weeks Left</p>
            </div>
          </div>
        </Card>

        {/* Total Actions */}
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total Actions</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Progress by Type */}
      {Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.byType).map(([type, total]) => {
                const completed = stats.completedByType[type] || 0;
                const progress = Math.round((completed / total) * 100);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs w-24 text-muted-foreground truncate">
                      {getTypeLabel(type)}
                    </span>
                    <div className="flex-1">
                      <Progress value={progress} className="h-2" />
                    </div>
                    <span className="text-xs font-medium w-12 text-right">
                      {completed}/{total}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
