import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Target,
  Sparkles,
  AlertTriangle,
  Plus,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Circle,
  Loader2,
  Search,
  ExternalLink
} from "lucide-react";
import { useDreamJobs, useCreateDreamJob } from "@/hooks/useDreamJobs";
import { useGapAnalysis, useRefreshGapAnalysis, useGenerateRecommendations } from "@/hooks/useAnalysis";
import { useRecommendations, useAntiRecommendations, useUpdateRecommendationStatus } from "@/hooks/useRecommendations";
import { useCourseSearch } from "@/hooks/useCourseSearch";
import { useToast } from "@/hooks/use-toast";
import { AddDreamJobForm } from "@/components/forms";
import { DreamJobDiscovery } from "@/components/dreamjobs/DreamJobDiscovery";
import { RecommendationsList } from "@/components/recommendations/RecommendationsList";
import { AntiRecommendations } from "@/components/recommendations/AntiRecommendations";
import { HonestAssessment } from "@/components/analysis/HonestAssessment";
import { GapsList } from "@/components/analysis/GapsList";
import { OverlapsList } from "@/components/analysis/OverlapsList";

export default function CareerPathPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Get active tab from URL or default to "jobs"
  const activeTab = searchParams.get("tab") || "jobs";
  const [showAddJob, setShowAddJob] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);

  // Dream Jobs
  const { data: dreamJobs = [], isLoading: jobsLoading } = useDreamJobs();
  const createDreamJob = useCreateDreamJob();

  // Selected dream job
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);
  const activeDreamJobId = selectedJobId || dreamJobs.find(j => j.is_primary)?.id || dreamJobs[0]?.id;
  const selectedJob = dreamJobs.find(j => j.id === activeDreamJobId);

  // Gap Analysis
  const { data: analysis, isLoading: analysisLoading } = useGapAnalysis(activeDreamJobId || '');
  const refreshAnalysis = useRefreshGapAnalysis();

  // Recommendations
  const { data: recommendations = [], isLoading: recsLoading } = useRecommendations(activeDreamJobId);
  const { data: antiRecommendations = [], isLoading: antiLoading } = useAntiRecommendations(activeDreamJobId);
  const generateRecs = useGenerateRecommendations();

  // Course Search (Firecrawl)
  const { searchCourses, isSearching } = useCourseSearch();

  // Parse gap analysis data
  const strongOverlaps = (analysis?.strong_overlaps as any[]) || [];
  const partialOverlaps = (analysis?.partial_overlaps as any[]) || [];
  const criticalGaps = (analysis?.critical_gaps as any[]) || [];
  const priorityGaps = (analysis?.priority_gaps as any[]) || [];

  const overlapsCount = strongOverlaps.length + partialOverlaps.length;
  const gapsCount = criticalGaps.length + priorityGaps.length;
  const pendingRecs = recommendations.filter(r => r.status === 'pending').length;
  const completedRecs = recommendations.filter(r => r.status === 'completed').length;

  // Handle tab change
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // Handle dream job creation
  const handleAddJob = async (data: { jobQuery: string; targetCompanyType?: string; targetLocation?: string }) => {
    setIsCreatingJob(true);
    try {
      await createDreamJob.mutateAsync({
        title: data.jobQuery,
        company_type: data.targetCompanyType || null,
        location: data.targetLocation || null,
      });
      toast({
        title: "Dream job added",
        description: "AI is analyzing requirements in the background.",
      });
      setShowAddJob(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add dream job",
        variant: "destructive",
      });
    } finally {
      setIsCreatingJob(false);
    }
  };

  // Handle refresh analysis
  const handleRefreshAnalysis = () => {
    if (!activeDreamJobId) return;
    refreshAnalysis.mutate(activeDreamJobId);
  };

  // Handle generate recommendations
  const handleGenerateRecs = async () => {
    if (!activeDreamJobId || gapsCount === 0) return;
    try {
      const gaps = criticalGaps.map(gap => ({
        requirement: gap.job_requirement,
        importance: 'critical' as const,
        difficulty: 'challenging' as const,
        time_to_close: '3-6 months',
        suggested_action: gap.impact,
      }));
      await generateRecs.mutateAsync({ dreamJobId: activeDreamJobId, gaps });
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

  // Handle find courses (Firecrawl)
  const handleFindCourses = async () => {
    if (!activeDreamJobId || priorityGaps.length === 0) return;
    try {
      await searchCourses(priorityGaps, activeDreamJobId, selectedJob?.title || '');
      toast({
        title: "Courses found",
        description: "Real course links have been added to your action plan.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search for courses. Please try again.",
        variant: "destructive",
      });
    }
  };

  const matchScore = selectedJob?.match_score || analysis?.match_score || 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-display">Career Path</h1>
            <p className="text-muted-foreground">
              Track your goals, analyze gaps, and take action
            </p>
          </div>

          {/* Dream Job Selector */}
          {dreamJobs.length > 0 && (
            <div className="flex items-center gap-3">
              <Select
                value={activeDreamJobId}
                onValueChange={setSelectedJobId}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select dream job" />
                </SelectTrigger>
                <SelectContent>
                  {dreamJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      <div className="flex items-center gap-2">
                        <span>{job.title}</span>
                        {job.is_primary && <Badge variant="outline" className="text-[10px]">Primary</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedJob && (
                <Badge variant={matchScore >= 60 ? "default" : "secondary"} className="shrink-0">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {matchScore}% Match
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        {selectedJob && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveTab("gaps")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{overlapsCount}</p>
                    <p className="text-xs text-muted-foreground">Skills Matched</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveTab("gaps")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{gapsCount}</p>
                    <p className="text-xs text-muted-foreground">Gaps to Close</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveTab("actions")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Circle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingRecs}</p>
                    <p className="text-xs text-muted-foreground">To Do</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveTab("actions")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completedRecs}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="jobs" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Dream Jobs
            </TabsTrigger>
            <TabsTrigger value="gaps" className="gap-2">
              <Target className="h-4 w-4" />
              Gap Analysis
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Action Plan
            </TabsTrigger>
            <TabsTrigger value="avoid" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Avoid
            </TabsTrigger>
          </TabsList>

          {/* Dream Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Your career aspirations and match scores
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDiscover(!showDiscover)}>
                  <Search className="h-4 w-4 mr-2" />
                  {showDiscover ? "Show Jobs" : "Discover Careers"}
                </Button>
                <Button onClick={() => setShowAddJob(!showAddJob)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dream Job
                </Button>
              </div>
            </div>

            {showAddJob ? (
              <AddDreamJobForm
                onSubmit={handleAddJob}
                onCancel={() => setShowAddJob(false)}
                isSubmitting={isCreatingJob}
              />
            ) : showDiscover ? (
              <DreamJobDiscovery onJobAdded={() => setShowDiscover(false)} />
            ) : jobsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-2 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : dreamJobs.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <Briefcase className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold">No dream jobs yet</h3>
                    <p className="text-muted-foreground">
                      Add your first dream job or discover careers you might love
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => setShowAddJob(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Dream Job
                    </Button>
                    <Button variant="outline" onClick={() => setShowDiscover(true)}>
                      <Search className="h-4 w-4 mr-2" />
                      Discover Careers
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dreamJobs.map((job) => (
                  <Card
                    key={job.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${job.id === activeDreamJobId ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setActiveTab("gaps");
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{job.title}</CardTitle>
                          {job.company_type && (
                            <CardDescription className="capitalize">
                              {job.company_type}
                            </CardDescription>
                          )}
                        </div>
                        {job.is_primary && <Badge>Primary</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Match Score</span>
                          <span className={`font-semibold ${job.match_score >= 60 ? 'text-green-500' : job.match_score >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                            {job.match_score || 0}%
                          </span>
                        </div>
                        <Progress value={job.match_score || 0} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Gap Analysis Tab */}
          <TabsContent value="gaps" className="space-y-4">
            {!activeDreamJobId ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Select a dream job to see gap analysis</p>
              </Card>
            ) : analysisLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Gap Analysis for {selectedJob?.title}
                  </h3>
                  <Button
                    variant="outline"
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
                </div>

                {analysis ? (
                  <>
                    <HonestAssessment
                      dreamJobTitle={selectedJob?.title || ''}
                      matchScore={matchScore}
                      readinessLevel={analysis.readiness_level as any}
                      honestAssessment={analysis.honest_assessment || ''}
                      interviewReadiness={analysis.interview_readiness || undefined}
                      jobSuccessPrediction={analysis.job_success_prediction || undefined}
                      strongOverlaps={strongOverlaps}
                      criticalGaps={criticalGaps}
                      priorityGaps={priorityGaps}
                    />

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Skills You Have ({overlapsCount})
                        </h4>
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
                          <p className="text-sm text-muted-foreground">No skill matches found yet.</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Target className="h-4 w-4 text-amber-500" />
                          Gaps to Close ({gapsCount})
                        </h4>
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
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">No gaps identified.</p>
                        )}
                      </div>
                    </div>
                  </>
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
              </div>
            )}
          </TabsContent>

          {/* Action Plan Tab */}
          <TabsContent value="actions" className="space-y-4">
            {!activeDreamJobId ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Select a dream job to see action plan</p>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <h3 className="text-lg font-semibold">
                    Action Plan for {selectedJob?.title}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleFindCourses}
                      disabled={isSearching || priorityGaps.length === 0}
                    >
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Find Real Courses
                    </Button>
                    <Button
                      onClick={handleGenerateRecs}
                      disabled={generateRecs.isPending || gapsCount === 0}
                    >
                      {generateRecs.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate Actions
                    </Button>
                  </div>
                </div>

                <RecommendationsList dreamJobId={activeDreamJobId} />
              </div>
            )}
          </TabsContent>

          {/* Avoid Tab */}
          <TabsContent value="avoid" className="space-y-4">
            {!activeDreamJobId ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Select a dream job to see what to avoid</p>
              </Card>
            ) : (
              <AntiRecommendations
                antiRecommendations={antiRecommendations}
                dreamJobTitle={selectedJob?.title}
                isLoading={antiLoading}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
