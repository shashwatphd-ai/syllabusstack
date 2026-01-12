import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Target, 
  BarChart3, 
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";

interface NextAction {
  title: string;
  description: string;
  action: string;
  priority: "high" | "medium" | "low";
  icon: typeof BookOpen;
}

interface DashboardStats {
  totalCourses: number;
  totalDreamJobs: number;
  hasGapAnalysis: boolean;
  pendingRecommendations: number;
  topRecommendation?: string;
}

interface NextActionBannerProps {
  stats: DashboardStats;
  isLoading?: boolean;
}

function getNextAction(stats: DashboardStats): NextAction {
  if (stats.totalCourses === 0) {
    return {
      title: "Add your first course",
      description: "Upload a syllabus to discover your capabilities",
      action: "/courses",
      priority: "high",
      icon: BookOpen
    };
  }
  if (stats.totalDreamJobs === 0) {
    return {
      title: "Define a dream job",
      description: "See how your skills match up to your career goals",
      action: "/dream-jobs",
      priority: "high",
      icon: Target
    };
  }
  if (!stats.hasGapAnalysis) {
    return {
      title: "Run gap analysis",
      description: "Identify the skills you need to develop",
      action: "/analysis",
      priority: "high",
      icon: BarChart3
    };
  }
  if (stats.pendingRecommendations > 0) {
    return {
      title: `${stats.pendingRecommendations} skills to develop`,
      description: stats.topRecommendation 
        ? `Start with: ${stats.topRecommendation}`
        : "View your personalized recommendations",
      action: "/recommendations",
      priority: "medium",
      icon: Lightbulb
    };
  }
  return {
    title: "You're on track!",
    description: "Keep updating your courses as you progress",
    action: "/courses",
    priority: "low",
    icon: CheckCircle2
  };
}

const priorityStyles = {
  high: "bg-destructive/10 border-destructive/30 text-destructive",
  medium: "bg-primary/10 border-primary/30 text-primary",
  low: "bg-success/10 border-success/30 text-success"
};

const priorityBadgeStyles = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-primary text-primary-foreground",
  low: "bg-success text-success-foreground"
};

export function NextActionBanner({ stats, isLoading }: NextActionBannerProps) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-md animate-pulse">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
            <div className="h-10 bg-muted rounded w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const nextAction = getNextAction(stats);
  const Icon = nextAction.icon;

  return (
    <Card className={`border shadow-md overflow-hidden ${priorityStyles[nextAction.priority]}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-6">
          {/* Icon & Badge row on mobile */}
          <div className="flex items-center gap-3">
            <div className={`p-2.5 sm:p-3 rounded-full shrink-0 ${
              nextAction.priority === 'high' 
                ? 'bg-destructive/20' 
                : nextAction.priority === 'medium' 
                  ? 'bg-primary/20' 
                  : 'bg-success/20'
            }`}>
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            
            {/* Badge visible on mobile next to icon */}
            <Badge className={`sm:hidden ${priorityBadgeStyles[nextAction.priority]}`}>
              <Sparkles className="h-3 w-3 mr-1" />
              Next Step
            </Badge>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-0.5">
            {/* Badge hidden on mobile, visible on desktop */}
            <div className="hidden sm:flex items-center gap-2 mb-1">
              <Badge className={priorityBadgeStyles[nextAction.priority]}>
                <Sparkles className="h-3 w-3 mr-1" />
                Next Step
              </Badge>
            </div>
            <h3 className="font-semibold text-foreground text-sm sm:text-base line-clamp-2 sm:truncate">
              {nextAction.title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:truncate">
              {nextAction.description}
            </p>
          </div>

          {/* CTA Button - full width on mobile */}
          <Button asChild className="w-full sm:w-auto shrink-0 gap-2 min-h-11">
            <Link to={nextAction.action}>
              Take Action
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
