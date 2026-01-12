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
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {statConfig.map((stat) => {
        const Icon = stat.icon;
        const value = getStatValue(stat.key);
        
        return (
          <Card 
            key={stat.key} 
            className="border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-card group cursor-pointer"
            onClick={() => navigate(stat.link)}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-lg ${stat.iconBg} transition-transform group-hover:scale-110 flex-shrink-0`}>
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xl sm:text-2xl font-bold tracking-tight ${stat.valueColor || 'text-foreground'}`}>
                    {value}
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                    {stat.label}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
