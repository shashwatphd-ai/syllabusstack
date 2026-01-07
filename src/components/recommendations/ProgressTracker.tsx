import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Target,
  TrendingUp,
  Rocket
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Milestone {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  completedDate?: string;
  targetDate?: string;
}

interface ProgressTrackerProps {
  dreamJobTitle?: string;
  currentProgress?: number;
  milestones?: Milestone[];
  isLoading?: boolean;
}

export function ProgressTracker({ 
  dreamJobTitle = "Your Goal",
  currentProgress = 0,
  milestones = [],
  isLoading 
}: ProgressTrackerProps) {
  const navigate = useNavigate();
  const completedCount = milestones.filter((m) => m.isCompleted).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (milestones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Progress Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Rocket className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            Add dream jobs and complete recommendations to track your progress.
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/dream-jobs')}
          >
            Add Dream Job
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Progress to {dreamJobTitle}
          </CardTitle>
          <Badge variant="outline" className="font-normal">
            {completedCount}/{milestones.length} milestones
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              Overall Progress
            </span>
            <span className="font-semibold">{currentProgress}%</span>
          </div>
          <Progress value={currentProgress} className="h-3" />
        </div>

        {/* Milestones Timeline */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
          
          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div key={milestone.id} className="relative flex gap-4 pl-10">
                {/* Status Icon */}
                <div className="absolute left-0 p-1 bg-background">
                  {milestone.isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-4 ${index === milestones.length - 1 ? "" : "border-b"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className={`font-medium ${milestone.isCompleted ? "text-muted-foreground" : ""}`}>
                        {milestone.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {milestone.description}
                      </p>
                    </div>
                    {milestone.isCompleted ? (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Completed
                      </Badge>
                    ) : milestone.targetDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(milestone.targetDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
