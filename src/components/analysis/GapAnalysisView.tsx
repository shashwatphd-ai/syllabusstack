import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HonestAssessment } from "./HonestAssessment";
import { GapsList } from "./GapsList";
import { OverlapsList } from "./OverlapsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Target, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  Loader2
} from "lucide-react";
import { useGapAnalysis } from "@/hooks/useAnalysis";
import { performGapAnalysis } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface GapAnalysisViewProps {
  dreamJobId?: string;
  dreamJobTitle?: string;
  isLoading?: boolean;
}

export function GapAnalysisView({ 
  dreamJobId, 
  dreamJobTitle = "Dream Job",
}: GapAnalysisViewProps) {
  const { data: analysis, isLoading } = useGapAnalysis(dreamJobId || '');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!dreamJobId) return;
    setIsRefreshing(true);
    try {
      await performGapAnalysis(dreamJobId);
      queryClient.invalidateQueries({ queryKey: queryKeys.gapAnalysis(dreamJobId) });
      toast({
        title: "Analysis refreshed",
        description: "Gap analysis has been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh analysis",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const matchScore = analysis?.match_score || 0;
  const overlapsCount = analysis?.overlaps?.length || 0;
  const gapsCount = analysis?.gaps?.length || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gap Analysis</h2>
          <p className="text-muted-foreground">
            Detailed analysis for {dreamJobTitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || !dreamJobId}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Badge variant="outline" className="text-base px-4 py-2">
            <Target className="h-4 w-4 mr-2" />
            {matchScore}% Ready
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overlapsCount}</p>
                <p className="text-sm text-muted-foreground">Skills Aligned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{gapsCount}</p>
                <p className="text-sm text-muted-foreground">Gaps Identified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/10">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{matchScore >= 80 ? '1-2' : matchScore >= 50 ? '3-6' : '6+'} mo</p>
                <p className="text-sm text-muted-foreground">Est. Time to Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assessment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assessment">Honest Assessment</TabsTrigger>
          <TabsTrigger value="gaps">Skill Gaps</TabsTrigger>
          <TabsTrigger value="comparison">Skills Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment">
          {analysis ? (
            <HonestAssessment 
              dreamJobTitle={dreamJobTitle}
              matchScore={matchScore}
              strengths={analysis.top_strengths || []}
              weaknesses={analysis.critical_gaps || []}
              honestFeedback={analysis.honest_assessment || "Run a gap analysis to get personalized feedback."}
            />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                No analysis available. Click "Refresh" to generate insights.
              </p>
              <Button onClick={handleRefresh} disabled={isRefreshing || !dreamJobId}>
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Run Gap Analysis
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gaps">
          {analysis?.gaps && analysis.gaps.length > 0 ? (
            <GapsList 
              gaps={analysis.gaps.map((g, i) => ({
                id: String(i),
                skill: g.requirement,
                currentLevel: 20,
                requiredLevel: g.importance === 'critical' ? 90 : g.importance === 'important' ? 70 : 50,
                severity: g.importance === 'critical' ? 'critical' : g.importance === 'important' ? 'important' : 'nice-to-have',
                category: 'technical',
                estimatedTimeToClose: g.time_to_close,
                description: g.suggested_action || `Develop ${g.requirement} skills`,
              }))}
            />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No skill gaps identified yet. Run a gap analysis to discover areas for improvement.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comparison">
          {analysis?.overlaps && analysis.overlaps.length > 0 ? (
            <OverlapsList 
              overlaps={analysis.overlaps.map((o, i) => ({
                id: String(i),
                studentCapability: o.capability,
                jobRequirement: o.requirement,
                strength: o.strength,
                strengthScore: o.strength === 'strong' ? 90 : o.strength === 'moderate' ? 70 : 50,
                assessment: o.notes || '',
                source: 'Your Courses',
              }))}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Skills Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  No skill comparisons available. Add courses and run gap analysis.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
