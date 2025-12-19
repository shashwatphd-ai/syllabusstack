import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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

const mockCapabilities: Capability[] = [
  { name: "Python Programming", level: 75, maxLevel: 100, trend: "up", category: "Technical" },
  { name: "Data Analysis", level: 60, maxLevel: 100, trend: "up", category: "Technical" },
  { name: "Machine Learning", level: 40, maxLevel: 100, trend: "stable", category: "Technical" },
  { name: "Communication", level: 70, maxLevel: 100, trend: "up", category: "Soft Skills" },
  { name: "Problem Solving", level: 80, maxLevel: 100, trend: "stable", category: "Soft Skills" },
  { name: "Project Management", level: 35, maxLevel: 100, trend: "down", category: "Professional" },
];

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
  if (level >= 80) return "bg-green-500";
  if (level >= 60) return "bg-accent";
  if (level >= 40) return "bg-yellow-500";
  return "bg-red-500";
};

export function CapabilitySnapshot({ capabilities = mockCapabilities, isLoading }: CapabilitySnapshotProps) {
  const groupedCapabilities = capabilities.reduce((acc, cap) => {
    if (!acc[cap.category]) acc[cap.category] = [];
    acc[cap.category].push(cap);
    return acc;
  }, {} as Record<string, Capability[]>);

  if (isLoading) {
    return (
      <Card>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Your Capabilities
          <Badge variant="secondary" className="font-normal">
            {capabilities.length} skills tracked
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedCapabilities).map(([category, caps]) => (
          <div key={category} className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">{category}</h4>
            <div className="space-y-3">
              {caps.map((cap) => (
                <div key={cap.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cap.name}</span>
                      <TrendIcon trend={cap.trend} />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getLevelLabel(cap.level)}
                    </Badge>
                  </div>
                  <div className="relative">
                    <Progress value={cap.level} className="h-2" />
                    <div
                      className={`absolute top-0 left-0 h-2 rounded-full ${getLevelColor(cap.level)} transition-all`}
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
