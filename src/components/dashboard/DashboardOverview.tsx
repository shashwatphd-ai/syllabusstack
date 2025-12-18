import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  Target, 
  TrendingUp, 
  CheckCircle2,
  Clock,
  AlertTriangle
} from "lucide-react";

interface OverviewStats {
  coursesAnalyzed: number;
  dreamJobsTracked: number;
  capabilitiesIdentified: number;
  gapsToClose: number;
  recommendationsCompleted: number;
  totalRecommendations: number;
  overallReadiness: number;
}

interface DashboardOverviewProps {
  stats?: OverviewStats;
  isLoading?: boolean;
}

const defaultStats: OverviewStats = {
  coursesAnalyzed: 8,
  dreamJobsTracked: 3,
  capabilitiesIdentified: 24,
  gapsToClose: 7,
  recommendationsCompleted: 12,
  totalRecommendations: 20,
  overallReadiness: 65,
};

export function DashboardOverview({ stats = defaultStats, isLoading }: DashboardOverviewProps) {
  const progressPercentage = stats.totalRecommendations > 0 
    ? (stats.recommendationsCompleted / stats.totalRecommendations) * 100 
    : 0;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Courses Analyzed
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.coursesAnalyzed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Syllabi processed by AI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dream Jobs
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dreamJobsTracked}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Career paths tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Capabilities
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.capabilitiesIdentified}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Skills identified from courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gaps to Close
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.gapsToClose}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Skills needed for dream jobs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Overall Job Readiness</CardTitle>
            <Badge variant={stats.overallReadiness >= 70 ? "default" : "secondary"}>
              {stats.overallReadiness >= 70 ? "On Track" : "In Progress"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Readiness Score</span>
              <span className="font-semibold">{stats.overallReadiness}%</span>
            </div>
            <Progress value={stats.overallReadiness} className="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">{stats.recommendationsCompleted}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {stats.totalRecommendations - stats.recommendationsCompleted}
                </p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
