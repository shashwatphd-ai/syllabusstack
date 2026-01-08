import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Building2, MapPin, Clock, TrendingUp, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { HonestAssessment } from '@/components/analysis/HonestAssessment';
import { GapsList } from '@/components/analysis/GapsList';
import { OverlapsList } from '@/components/analysis/OverlapsList';
import { RecommendationsList } from '@/components/recommendations/RecommendationsList';
import { useDreamJob } from '@/hooks/useDreamJobs';
import { useGapAnalysis, useRefreshGapAnalysis, useGenerateRecommendations, SkillGap } from '@/hooks/useAnalysis';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useToast } from '@/hooks/use-toast';

export default function DreamJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: job, isLoading: jobLoading } = useDreamJob(jobId || '');
  const { data: analysis, isLoading: analysisLoading } = useGapAnalysis(jobId || '');
  const { data: recommendations = [], isLoading: recsLoading } = useRecommendations(jobId);
  const refreshAnalysis = useRefreshGapAnalysis();
  const generateRecs = useGenerateRecommendations();

  const handleRefreshAnalysis = () => {
    if (!jobId) return;
    refreshAnalysis.mutate(jobId);
  };

  // Parse the JSON fields from database
  const strongOverlaps = (analysis?.strong_overlaps as Array<{student_capability: string; job_requirement: string; assessment: string}>) || [];
  const partialOverlaps = (analysis?.partial_overlaps as Array<{area?: string; foundation?: string; missing?: string}>) || [];
  const criticalGaps = (analysis?.critical_gaps as Array<{job_requirement: string; student_status: string; impact: string}>) || [];
  const priorityGaps = (analysis?.priority_gaps as Array<{gap: string; priority: number; reason: string}>) || [];

  const overlapsCount = strongOverlaps.length + partialOverlaps.length;
  const gapsCount = criticalGaps.length + priorityGaps.length;

  const handleGenerateRecommendations = async () => {
    if (!jobId || gapsCount === 0) return;
    try {
      // Convert gaps to SkillGap format
      const gaps: SkillGap[] = criticalGaps.map(gap => ({
        requirement: gap.job_requirement,
        importance: 'critical' as const,
        difficulty: 'challenging' as const,
        time_to_close: '3-6 months',
        suggested_action: gap.impact,
      }));
      
      await generateRecs.mutateAsync({ dreamJobId: jobId, gaps });
      toast({
        title: "Recommendations generated",
        description: "New recommendations have been created based on your gaps.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate recommendations",
        variant: "destructive",
      });
    }
  };

  const getMatchBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'outline';
  };

  if (jobLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Dream job not found</h2>
          <Button variant="link" onClick={() => navigate('/dream-jobs')}>
            Go back to Dream Jobs
          </Button>
        </div>
      </AppShell>
    );
  }

  const matchScore = job.match_score || analysis?.match_score || 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back Button & Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dream-jobs')}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {job.company_type && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      <span className="capitalize">{job.company_type}</span>
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {job.location}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefreshAnalysis}
                  disabled={refreshAnalysis.isPending}
                >
                  {refreshAnalysis.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Analysis
                </Button>
                <Badge variant={getMatchBadgeVariant(matchScore)} className="text-lg px-3 py-1">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {matchScore}% Match
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards - Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => document.querySelector('[value="overlaps"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overlapsCount}</p>
                  <p className="text-sm text-muted-foreground">Skills Aligned</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => document.querySelector('[value="gaps"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{gapsCount}</p>
                  <p className="text-sm text-muted-foreground">Gaps Identified</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => document.querySelector('[value="recommendations"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recommendations.length}</p>
                  <p className="text-sm text-muted-foreground">Recommendations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="assessment" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="assessment">Assessment</TabsTrigger>
            <TabsTrigger value="overlaps">Matches ({overlapsCount})</TabsTrigger>
            <TabsTrigger value="gaps">Gaps ({gapsCount})</TabsTrigger>
            <TabsTrigger value="recommendations">Actions ({recommendations.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="assessment">
            {analysisLoading ? (
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </CardContent>
              </Card>
            ) : analysis ? (
              <HonestAssessment 
                dreamJobTitle={job.title}
                matchScore={matchScore}
                readinessLevel={analysis.readiness_level as any}
                honestAssessment={analysis.honest_assessment || "Complete a gap analysis to get personalized feedback."}
                interviewReadiness={analysis.interview_readiness || undefined}
                jobSuccessPrediction={analysis.job_success_prediction || undefined}
                strongOverlaps={strongOverlaps}
                criticalGaps={criticalGaps}
                priorityGaps={priorityGaps}
              />
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No analysis available yet. Click "Refresh Analysis" to generate insights.
                </p>
                <Button onClick={handleRefreshAnalysis} disabled={refreshAnalysis.isPending}>
                  {refreshAnalysis.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Run Gap Analysis
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="overlaps">
            {analysisLoading ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ) : overlapsCount > 0 ? (
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
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No skill matches found yet. Add more courses or run a gap analysis.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="gaps">
            {analysisLoading ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ) : gapsCount > 0 ? (
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
              />
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No skill gaps identified. Run a gap analysis to discover areas for improvement.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations">
            {recsLoading ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ) : recommendations.length > 0 ? (
              <RecommendationsList dreamJobId={jobId} />
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No recommendations yet. Generate personalized recommendations based on your skill gaps.
                </p>
                <Button 
                  onClick={handleGenerateRecommendations}
                  disabled={generateRecs.isPending || gapsCount === 0}
                >
                  {generateRecs.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Recommendations
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
