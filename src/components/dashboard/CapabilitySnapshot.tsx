import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Capability {
  name: string;
  level: number;
  maxLevel: number;
  trend: "up" | "down" | "stable";
  category: string;
}

interface CapabilitySnapshotProps {
  capabilities?: Capability[];
  isLoading?: boolean;
}

const TrendIcon = React.forwardRef<SVGSVGElement, { trend: "up" | "down" | "stable" }>(
  ({ trend }, ref) => {
    switch (trend) {
      case "up":
        return <TrendingUp ref={ref} className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown ref={ref} className="h-4 w-4 text-red-500" />;
      default:
        return <Minus ref={ref} className="h-4 w-4 text-muted-foreground" />;
    }
  }
);
TrendIcon.displayName = "TrendIcon";

const getLevelLabel = (level: number): string => {
  if (level >= 80) return "Advanced";
  if (level >= 60) return "Intermediate";
  if (level >= 40) return "Developing";
  return "Beginner";
};

const getLevelColor = (level: number): string => {
  if (level >= 80) return "bg-success";
  if (level >= 60) return "bg-accent";
  if (level >= 40) return "bg-warning";
  return "bg-destructive";
};

const getLevelBadgeStyle = (level: number): string => {
  if (level >= 80) return "bg-success/10 text-success border-success/20";
  if (level >= 60) return "bg-accent/10 text-accent border-accent/20";
  if (level >= 40) return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
};

export function CapabilitySnapshot({ capabilities = [], isLoading }: CapabilitySnapshotProps) {
  const navigate = useNavigate();
  const groupedCapabilities = capabilities.reduce((acc, cap) => {
    if (!acc[cap.category]) acc[cap.category] = [];
    acc[cap.category].push(cap);
    return acc;
  }, {} as Record<string, Capability[]>);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Your Capabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                <div className="h-2 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (capabilities.length === 0) {
    return (
      <Card className="border-0 shadow-md bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Your Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            No capabilities tracked yet. Add courses to extract your skills.
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/courses')}
          >
            Add Courses
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md bg-card h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg font-semibold">Your Capabilities</span>
          <Badge 
            variant="secondary" 
            className="font-medium text-xs bg-accent/10 text-accent border border-accent/20"
          >
            {capabilities.length} tracked
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-80 overflow-y-auto overflow-x-hidden">
        {Object.entries(groupedCapabilities).map(([category, caps]) => (
          <div key={category} className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{category}</h4>
            <div className="space-y-2">
              {caps.map((cap) => (
                <div
                  key={cap.name}
                  className="space-y-1.5 group cursor-pointer hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors"
                  onClick={() => navigate(`/analysis?skill=${encodeURIComponent(cap.name)}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/analysis?skill=${encodeURIComponent(cap.name)}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-1">
                    <span 
                      className="font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2 sm:truncate sm:flex-1 text-[13px] sm:text-xs leading-snug"
                      title={cap.name}
                    >
                      {cap.name}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0 border w-fit flex-shrink-0 ${getLevelBadgeStyle(cap.level)}`}
                    >
                      {getLevelLabel(cap.level)}
                    </Badge>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getLevelColor(cap.level)}`}
                      style={{ width: `${cap.level}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
