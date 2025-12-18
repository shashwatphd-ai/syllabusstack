import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Target,
  TrendingUp
} from "lucide-react";

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

const mockMilestones: Milestone[] = [
  {
    id: "1",
    title: "Complete Python Fundamentals",
    description: "Master core Python programming concepts",
    isCompleted: true,
    completedDate: "2024-01-15",
  },
  {
    id: "2",
    title: "Learn SQL Basics",
    description: "Complete SQL foundation course",
    isCompleted: true,
    completedDate: "2024-02-01",
  },
  {
    id: "3",
    title: "Start ML Specialization",
    description: "Begin machine learning coursework",
    isCompleted: true,
    completedDate: "2024-02-20",
  },
  {
    id: "4",
    title: "Complete First ML Project",
    description: "Build and deploy an end-to-end ML project",
    isCompleted: false,
    targetDate: "2024-04-15",
  },
  {
    id: "5",
    title: "Master Advanced SQL",
    description: "Complete advanced database course",
    isCompleted: false,
    targetDate: "2024-05-01",
  },
  {
    id: "6",
    title: "Get AWS Certification",
    description: "Pass AWS Cloud Practitioner exam",
    isCompleted: false,
    targetDate: "2024-06-15",
  },
  {
    id: "7",
    title: "Build Portfolio",
    description: "Complete 3 portfolio projects",
    isCompleted: false,
    targetDate: "2024-07-01",
  },
  {
    id: "8",
    title: "Ready for Job Applications",
    description: "Meet all requirements for entry-level positions",
    isCompleted: false,
    targetDate: "2024-08-01",
  },
];

export function ProgressTracker({ 
  dreamJobTitle = "Data Scientist",
  currentProgress = 37,
  milestones = mockMilestones,
  isLoading 
}: ProgressTrackerProps) {
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
