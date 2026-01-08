import { useNavigate } from "react-router-dom";
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
  coursesAnalyzed: 0,
  dreamJobsTracked: 0,
  capabilitiesIdentified: 0,
  gapsToClose: 0,
  recommendationsCompleted: 0,
  totalRecommendations: 0,
  overallReadiness: 0,
};

const statConfig: Array<{
  key: string;
  label: string;
  description: string;
  icon: typeof BookOpen;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  link: string;
}> = [
  {
    key: 'coursesAnalyzed',
    label: 'Courses Analyzed',
    description: 'Syllabi processed by AI',
    icon: BookOpen,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    link: '/courses',
  },
  {
    key: 'dreamJobsTracked',
    label: 'Dream Jobs',
    description: 'Career paths tracked',
    icon: Target,
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    link: '/dream-jobs',
  },
  {
    key: 'capabilitiesIdentified',
    label: 'Capabilities',
    description: 'Skills identified from courses',
    icon: TrendingUp,
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    link: '/courses',
  },
  {
    key: 'gapsToClose',
    label: 'Gaps to Close',
    description: 'Skills needed for dream jobs',
    icon: AlertTriangle,
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    valueColor: 'text-warning',
    link: '/analysis',
  },
];

export function DashboardOverview({ stats = defaultStats, isLoading }: DashboardOverviewProps) {
  const navigate = useNavigate();
  const progressPercentage = stats.totalRecommendations > 0 
    ? (stats.recommendationsCompleted / stats.totalRecommendations) * 100 
    : 0;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse border-0 shadow-md">
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

  const getStatValue = (key: string) => {
    switch (key) {
      case 'coursesAnalyzed': return stats.coursesAnalyzed;
      case 'dreamJobsTracked': return stats.dreamJobsTracked;
      case 'capabilitiesIdentified': return stats.capabilitiesIdentified;
      case 'gapsToClose': return stats.gapsToClose;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statConfig.map((stat) => {
          const Icon = stat.icon;
          const value = getStatValue(stat.key);
          
          return (
            <Card 
              key={stat.key} 
              className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-card group cursor-pointer"
              onClick={() => navigate(stat.link)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.iconBg} transition-transform group-hover:scale-110`}>
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold tracking-tight ${stat.valueColor || 'text-foreground'}`}>
                  {value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Progress Card */}
      <Card className="border-0 shadow-md bg-card overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Overall Job Readiness</CardTitle>
            <Badge 
              variant={stats.overallReadiness >= 70 ? "default" : "secondary"}
              className={`
                ${stats.overallReadiness >= 70 
                  ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' 
                  : 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
                } 
                border font-medium
              `}
            >
              {stats.overallReadiness >= 70 ? "On Track" : "In Progress"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Readiness Score</span>
              <span className="text-2xl font-bold text-foreground">{stats.overallReadiness}%</span>
            </div>
            <div className="relative">
              <Progress value={stats.overallReadiness} className="h-3 bg-muted" />
              {/* Gradient overlay for better visual */}
              <div 
                className="absolute inset-0 h-3 rounded-full bg-gradient-to-r from-primary via-accent to-success opacity-90"
                style={{ 
                  width: `${stats.overallReadiness}%`,
                  clipPath: 'inset(0 0 0 0 round 9999px)'
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.recommendationsCompleted}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">
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
