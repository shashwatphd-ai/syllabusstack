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
import { useGapAnalysis, useRefreshGapAnalysis } from "@/hooks/useAnalysis";

interface GapAnalysisViewProps {
  dreamJobId?: string;
  dreamJobTitle?: string;
}

export function GapAnalysisView({ 
  dreamJobId, 
  dreamJobTitle = "Dream Job",
}: GapAnalysisViewProps) {
  const { data: analysis, isLoading } = useGapAnalysis(dreamJobId || '');
  const refreshAnalysis = useRefreshGapAnalysis();
  const isRefreshing = refreshAnalysis.isPending;

  const handleRefresh = () => {
    if (!dreamJobId) return;
    refreshAnalysis.mutate(dreamJobId);
  };

  const matchScore = analysis?.match_score || 0;
  
  // Parse JSON fields from database
  const strongOverlaps = (analysis?.strong_overlaps as Array<{student_capability: string; job_requirement: string; assessment: string}>) || [];
  const partialOverlaps = (analysis?.partial_overlaps as Array<{area?: string; foundation?: string; missing?: string}>) || [];
  const criticalGaps = (analysis?.critical_gaps as Array<{job_requirement: string; student_status: string; impact: string}>) || [];
  const priorityGaps = (analysis?.priority_gaps as Array<{gap: string; priority: number; reason: string}>) || [];
  
  const overlapsCount = strongOverlaps.length + partialOverlaps.length;
  const gapsCount = criticalGaps.length + priorityGaps.length;

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
      <div className="flex items-center justify-between flex-wrap gap-4">
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
            {isRefreshing ? 'Analyzing...' : 'Refresh'}
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
          <TabsTrigger value="gaps">Skill Gaps ({gapsCount})</TabsTrigger>
          <TabsTrigger value="comparison">Skills Match ({overlapsCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment">
          {analysis ? (
            <HonestAssessment 
              dreamJobTitle={dreamJobTitle}
              matchScore={matchScore}
              readinessLevel={analysis.readiness_level as any}
              honestAssessment={analysis.honest_assessment || "Run a gap analysis to get personalized feedback."}
              interviewReadiness={analysis.interview_readiness || undefined}
              jobSuccessPrediction={analysis.job_success_prediction || undefined}
              strongOverlaps={strongOverlaps}
              criticalGaps={criticalGaps}
              priorityGaps={priorityGaps}
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
          {gapsCount > 0 ? (
            <GapsList 
              criticalGaps={criticalGaps.map((g, i) => ({
                id: `critical-${i}`,
                job_requirement: g.job_requirement,
                student_status: g.student_status,
                impact: g.impact,
                severity: 'critical' as const,
                estimatedTimeToClose: '3-6 months',
              }))}
              priorityGaps={priorityGaps}
              dreamJobId={dreamJobId}
              dreamJobTitle={dreamJobTitle}
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
          {overlapsCount > 0 ? (
            <OverlapsList 
              overlaps={[
                ...strongOverlaps.map((o, i) => ({
                  id: `strong-${i}`,
                  studentCapability: o.student_capability,
                  jobRequirement: o.job_requirement,
                  strength: 'strong' as const,
                  strengthScore: 90,
                  assessment: o.assessment || '',
                  source: 'Your Courses',
                })),
                ...partialOverlaps.map((o, i) => ({
                  id: `partial-${i}`,
                  studentCapability: o.foundation || '',
                  jobRequirement: o.area || '',
                  strength: 'partial' as const,
                  strengthScore: 50,
                  assessment: o.missing ? `Missing: ${o.missing}` : '',
                  source: 'Your Courses',
                }))
              ]}
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
