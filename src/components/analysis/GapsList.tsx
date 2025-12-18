import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  AlertCircle, 
  ChevronRight, 
  Clock, 
  Lightbulb,
  BookOpen,
  Code,
  Users
} from "lucide-react";

type GapSeverity = "critical" | "important" | "nice-to-have";
type GapCategory = "technical" | "soft-skill" | "experience" | "certification";

interface Gap {
  id: string;
  skill: string;
  currentLevel: number;
  requiredLevel: number;
  severity: GapSeverity;
  category: GapCategory;
  estimatedTimeToClose: string;
  description: string;
}

interface GapsListProps {
  gaps?: Gap[];
  onViewGap?: (gapId: string) => void;
  isLoading?: boolean;
}

const mockGaps: Gap[] = [
  {
    id: "1",
    skill: "Machine Learning Implementation",
    currentLevel: 30,
    requiredLevel: 70,
    severity: "critical",
    category: "technical",
    estimatedTimeToClose: "3-4 months",
    description: "Need hands-on experience building and deploying ML models",
  },
  {
    id: "2",
    skill: "SQL & Database Design",
    currentLevel: 45,
    requiredLevel: 80,
    severity: "critical",
    category: "technical",
    estimatedTimeToClose: "2-3 months",
    description: "Advanced SQL queries, optimization, and database design patterns",
  },
  {
    id: "3",
    skill: "Cloud Platforms (AWS/GCP)",
    currentLevel: 10,
    requiredLevel: 60,
    severity: "important",
    category: "technical",
    estimatedTimeToClose: "2-3 months",
    description: "Experience with cloud-based data tools and services",
  },
  {
    id: "4",
    skill: "Technical Communication",
    currentLevel: 50,
    requiredLevel: 75,
    severity: "important",
    category: "soft-skill",
    estimatedTimeToClose: "Ongoing",
    description: "Presenting technical findings to non-technical stakeholders",
  },
  {
    id: "5",
    skill: "Real-world Project Experience",
    currentLevel: 20,
    requiredLevel: 70,
    severity: "critical",
    category: "experience",
    estimatedTimeToClose: "3-6 months",
    description: "Portfolio of end-to-end data science projects",
  },
];

const getSeverityColor = (severity: GapSeverity): string => {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "important":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    default:
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  }
};

const getCategoryIcon = (category: GapCategory) => {
  switch (category) {
    case "technical":
      return <Code className="h-4 w-4" />;
    case "soft-skill":
      return <Users className="h-4 w-4" />;
    case "experience":
      return <Lightbulb className="h-4 w-4" />;
    case "certification":
      return <BookOpen className="h-4 w-4" />;
  }
};

export function GapsList({ gaps = mockGaps, onViewGap, isLoading }: GapsListProps) {
  const criticalCount = gaps.filter((g) => g.severity === "critical").length;
  const importantCount = gaps.filter((g) => g.severity === "important").length;

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Skill Gaps ({gaps.length})
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="destructive" className="font-normal">
              {criticalCount} Critical
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {importantCount} Important
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {gaps.map((gap) => (
          <div
            key={gap.id}
            className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
            onClick={() => onViewGap?.(gap.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getCategoryIcon(gap.category)}
                <h4 className="font-medium group-hover:text-accent transition-colors">
                  {gap.skill}
                </h4>
              </div>
              <Badge variant="outline" className={getSeverityColor(gap.severity)}>
                {gap.severity}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-3">{gap.description}</p>

            <div className="space-y-2">
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

            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Est. {gap.estimatedTimeToClose}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
