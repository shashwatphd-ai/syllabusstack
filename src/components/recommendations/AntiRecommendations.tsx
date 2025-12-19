// AntiRecommendations Component
// Per Technical Specification v3.0 Part 7
// Displays things a student should AVOID doing

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertOctagon, 
  XCircle,
  Ban,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AntiRecommendation {
  id?: string;
  action: string;
  reason: string;
}

interface AntiRecommendationsProps {
  antiRecommendations: AntiRecommendation[];
  dreamJobTitle?: string;
  isLoading?: boolean;
}

export function AntiRecommendations({ 
  antiRecommendations = [], 
  dreamJobTitle,
  isLoading 
}: AntiRecommendationsProps) {
  if (isLoading) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (antiRecommendations.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertOctagon className="h-5 w-5" />
          Things to Avoid
          {dreamJobTitle && (
            <span className="text-muted-foreground font-normal text-sm ml-2">
              for {dreamJobTitle}
            </span>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Don't waste time or money on these activities
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {antiRecommendations.map((item, index) => (
          <div 
            key={item.id || index} 
            className="flex items-start gap-3 p-4 bg-background rounded-lg border border-destructive/20"
          >
            <div className="p-2 rounded-full bg-destructive/10 flex-shrink-0">
              <Ban className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                {item.action}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {item.reason}
              </p>
            </div>
          </div>
        ))}
        
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mt-4">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            These suggestions help you focus your limited time and resources on what actually matters for your target role.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
