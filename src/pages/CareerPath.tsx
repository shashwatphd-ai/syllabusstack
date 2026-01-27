import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpTooltip, FeatureHelp } from "@/components/common/HelpTooltip";
import { useTour, CAREER_PATH_TOUR } from "@/components/common/ProductTour";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  ExternalLink,
  GraduationCap,
  Leaf,
  Pencil,
  Trash2,
  MoreVertical,
  Star,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDreamJobs, useCreateDreamJob, useDeleteDreamJob, useSetPrimaryDreamJob } from "@/hooks/useDreamJobs";
import { useGapAnalysis, useRefreshGapAnalysis, useGenerateRecommendations } from "@/hooks/useAnalysis";
import { useRecommendations, useAntiRecommendations, useUpdateRecommendationStatus } from "@/hooks/useRecommendations";
import { useCourseSearch } from "@/hooks/useCourseSearch";
import { useStudentEnrollments } from "@/hooks/useStudentCourses";
import { useLinkCourseToRecommendation } from "@/hooks/useLinkCourseToRecommendation";
import { useSkillProfile } from "@/hooks/useSkillProfile";
import { useToast } from "@/hooks/use-toast";
import { AddDreamJobForm } from "@/components/forms";
import { DreamJobDiscovery } from "@/components/dreamjobs/DreamJobDiscovery";
import { SkillsAssessmentWizard } from "@/components/skills-assessment/SkillsAssessmentWizard";
import { CareerMatchesGrid } from "@/components/career-exploration/CareerMatchesGrid";
import { RecommendationsList } from "@/components/recommendations/RecommendationsList";
import { RecommendationsErrorBoundary } from "@/components/recommendations/RecommendationsErrorBoundary";
import { AntiRecommendations } from "@/components/recommendations/AntiRecommendations";
import { CurrentlyLearningPanel } from "@/components/recommendations/CurrentlyLearningPanel";
import { HonestAssessment } from "@/components/analysis/HonestAssessment";
import { GapsList } from "@/components/analysis/GapsList";
import { OverlapsList } from "@/components/analysis/OverlapsList";
import { isPriceFree, countByPriceCategory } from "@/lib/price-utils";

// Typed JSON field interfaces for gap analysis
interface StrongOverlap {
  student_capability: string;
  job_requirement: string;
  assessment: string;
}

interface PartialOverlap {
  area: string;
  foundation: string;
  missing: string;
}

interface CriticalGap {
  job_requirement: string;
  student_status: string;
  impact: string;
}

interface PriorityGap {
  gap: string;
  priority: number;
  reason: string;
}

// Readiness levels must match HonestAssessment component expectations
type ReadinessLevel = 'ready_to_apply' | '3_months_away' | '6_months_away' | '1_year_away' | 'needs_significant_development';

export default function CareerPathPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Product tour for career path page
  const { startTour, TourComponent } = useTour(CAREER_PATH_TOUR);

  // Get active tab from URL or default to "jobs"
  const activeTab = searchParams.get("tab") || "jobs";
  const [showAddJob, setShowAddJob] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showCareerMatches, setShowCareerMatches] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [freeFirst, setFreeFirst] = useState(true);
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid' | 'unknown'>('all');
  const [deleteConfirmJob, setDeleteConfirmJob] = useState<string | null>(null);

  // Skill Profile - check if user has completed assessment
  const { data: skillProfile, isLoading: profileLoading } = useSkillProfile();

  // Dream Jobs
  const { data: dreamJobs = [], isLoading: jobsLoading } = useDreamJobs();
  const createDreamJob = useCreateDreamJob();
  const deleteDreamJob = useDeleteDreamJob();
  const setPrimaryJob = useSetPrimaryDreamJob();

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
  
  // Student Enrollments & Linking
  const { data: enrollments = [] } = useStudentEnrollments();
  const linkCourse = useLinkCourseToRecommendation();

  // Handler for linking courses from CurrentlyLearningPanel
  const handleLinkCourseToRecommendation = async (
    enrollmentId: string, 
    courseId: string, 
    recommendationId: string
  ) => {
    await linkCourse.mutateAsync({ enrollmentId, courseId, recommendationId });
  };

  // Parse gap analysis data
  const strongOverlaps = (analysis?.strong_overlaps as StrongOverlap[] | null) || [];
  const partialOverlaps = (analysis?.partial_overlaps as PartialOverlap[] | null) || [];
  const criticalGaps = (analysis?.critical_gaps as CriticalGap[] | null) || [];
  const priorityGaps = (analysis?.priority_gaps as PriorityGap[] | null) || [];

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

  // Handle generate recommendations - uses BOTH critical and priority gaps
  const handleGenerateRecs = async () => {
    if (!activeDreamJobId || gapsCount === 0) return;
    try {
      // Map critical gaps
      const criticalGapsMapped = criticalGaps.map(gap => ({
        requirement: gap.job_requirement,
        importance: 'critical' as const,
        difficulty: 'challenging' as const,
        time_to_close: '3-6 months',
        suggested_action: gap.impact,
      }));
      
      // Map priority gaps - use 'important' as it's a valid importance value
      const priorityGapsMapped = priorityGaps.map(gap => ({
        requirement: gap.gap,
        importance: 'important' as const,
        difficulty: 'moderate' as const,
        time_to_close: gap.reason || '1-3 months',
        suggested_action: gap.reason || 'Address this skill gap',
      }));
      
      // Combine both gap types
      const gaps = [...criticalGapsMapped, ...priorityGapsMapped];
      
      await generateRecs.mutateAsync({ dreamJobId: activeDreamJobId, gaps });
      toast({
        title: "Recommendations generated",
        description: `Created actions for ${gaps.length} skill gaps (${criticalGapsMapped.length} critical, ${priorityGapsMapped.length} priority).`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate recommendations",
        variant: "destructive",
      });
    }
  };

  // Handle find courses (Firecrawl) - uses BOTH critical and priority gaps
  const handleFindCourses = async () => {
    const allGaps = [...criticalGaps, ...priorityGaps];
    if (!activeDreamJobId || allGaps.length === 0) return;
    try {
      await searchCourses(allGaps, activeDreamJobId, selectedJob?.title || '');
      toast({
        title: "Courses found",
        description: `Found real courses for ${allGaps.length} skill gaps.`,
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm sm:text-base">
              Track your goals, analyze gaps, and take action
            </p>

            {/* Dream Job Selector - full width on mobile */}
            {dreamJobs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Select
                  value={activeDreamJobId}
                  onValueChange={setSelectedJobId}
                >
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Select dream job" />
                  </SelectTrigger>
                  <SelectContent>
                    {dreamJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{job.title}</span>
                          {job.is_primary && <Badge variant="outline" className="text-[10px]">Primary</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedJob && (
                  <HelpTooltip content="Your match score shows how well your current skills align with your dream job requirements. Higher scores mean you're closer to being ready for the role.">
                    <Badge id="match-score-badge" variant={matchScore >= 60 ? "default" : "secondary"} className="shrink-0 self-start sm:self-auto cursor-help">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {matchScore}% Match
                    </Badge>
                  </HelpTooltip>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards - 2 cols on mobile, 3 on sm, 5 on md+ */}
        {selectedJob && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            <Card className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" onClick={() => setActiveTab("gaps")}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{overlapsCount}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Skills Matched</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" onClick={() => setActiveTab("gaps")}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Target className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{gapsCount}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Gaps</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" onClick={() => setActiveTab("actions")}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{pendingRecs}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">To Do</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" onClick={() => setActiveTab("actions")}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{completedRecs}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Done</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Enrolled Courses card */}
            <Card className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all col-span-2 sm:col-span-1" onClick={() => navigate('/learn/courses')}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{enrollments.length}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Enrolled</p>
                  </div>
                  {enrollments.length > 0 && (
                    <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-300 shrink-0">
                      {enrollments.filter(e => e.completed_at).length}✓
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs - Responsive: hide icons on mobile, shorter labels */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList id="career-tabs" className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger id="dream-jobs-tab" value="jobs" className="gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm">
              <Briefcase className="h-4 w-4 hidden sm:block" />
              <span className="sm:hidden">Jobs</span>
              <span className="hidden sm:inline">Dream Jobs</span>
            </TabsTrigger>
            <TabsTrigger id="gap-analysis-tab" value="gaps" className="gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm">
              <Target className="h-4 w-4 hidden sm:block" />
              <span className="sm:hidden">Gaps</span>
              <span className="hidden sm:inline">Gap Analysis</span>
            </TabsTrigger>
            <TabsTrigger id="action-plan-tab" value="actions" className="gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm">
              <Sparkles className="h-4 w-4 hidden sm:block" />
              <span className="sm:hidden">Actions</span>
              <span className="hidden sm:inline">Action Plan</span>
            </TabsTrigger>
            <TabsTrigger value="avoid" className="gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm">
              <AlertTriangle className="h-4 w-4 hidden sm:block" />
              <span className="sm:hidden">Avoid</span>
              <span className="hidden sm:inline">Avoid</span>
            </TabsTrigger>
          </TabsList>

          {/* Dream Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Your career aspirations and match scores
              </p>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {/* Skills Assessment Button - primary action if no profile */}
                {!skillProfile && !profileLoading && (
                  <Button 
                    variant="default" 
                    onClick={() => {
                      setShowAssessment(true);
                      setShowDiscover(false);
                      setShowCareerMatches(false);
                      setShowAddJob(false);
                    }} 
                    className="w-full sm:w-auto min-h-11"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Take Skills Assessment
                  </Button>
                )}
                {/* Show Career Matches only if they have a completed profile with holland_code */}
                {skillProfile && skillProfile.holland_code && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowCareerMatches(!showCareerMatches);
                      setShowAssessment(false);
                      setShowDiscover(false);
                      setShowAddJob(false);
                    }} 
                    className="w-full sm:w-auto min-h-11"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {showCareerMatches ? "Show Jobs" : "View Career Matches"}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDiscover(!showDiscover);
                    setShowAssessment(false);
                    setShowCareerMatches(false);
                    setShowAddJob(false);
                  }} 
                  className="w-full sm:w-auto min-h-11"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {showDiscover ? "Show Jobs" : "Quick Discover"}
                </Button>
                <Button 
                  onClick={() => {
                    setShowAddJob(!showAddJob);
                    setShowAssessment(false);
                    setShowDiscover(false);
                    setShowCareerMatches(false);
                  }} 
                  className="w-full sm:w-auto min-h-11"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dream Job
                </Button>
              </div>
            </div>

            {/* Skills Assessment Wizard */}
            {showAssessment ? (
              <SkillsAssessmentWizard 
                onComplete={() => {
                  setShowAssessment(false);
                  setShowCareerMatches(true);
                  toast({
                    title: "Assessment Complete!",
                    description: "Your career matches are now ready to view.",
                  });
                }}
                onCancel={() => setShowAssessment(false)}
              />
            ) : showCareerMatches && skillProfile ? (
              <CareerMatchesGrid 
                onViewDetails={(match) => {
                  toast({
                    title: match.occupation_title,
                    description: `Match score: ${match.overall_match_score}%`,
                  });
                }}
              />
            ) : showAddJob ? (
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
                    className={`relative group cursor-pointer hover:shadow-md transition-shadow ${job.id === activeDreamJobId ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setActiveTab("gaps");
                    }}
                  >
                    {/* Dropdown menu for actions */}
                    <div className="absolute top-2 right-2 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {!job.is_primary && (
                            <DropdownMenuItem
                              onClick={() => setPrimaryJob.mutate(job.id)}
                            >
                              <Star className="h-4 w-4 mr-2" />
                              Set as Primary
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirmJob(job.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <CardHeader className="pb-2 pr-12">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg truncate">{job.title}</CardTitle>
                          {job.company_type && (
                            <CardDescription className="capitalize">
                              {job.company_type}
                            </CardDescription>
                          )}
                        </div>
                        {job.is_primary && <Badge className="ml-2 shrink-0">Primary</Badge>}
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
                      readinessLevel={analysis.readiness_level as ReadinessLevel}
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="text-lg font-semibold">
                    Action Plan for {selectedJob?.title}
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={handleFindCourses}
                      disabled={isSearching || priorityGaps.length === 0}
                      className="w-full sm:w-auto min-h-11"
                    >
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      <span className="sm:hidden">Find Courses</span>
                      <span className="hidden sm:inline">Find Real Courses</span>
                    </Button>
                    <Button
                      onClick={handleGenerateRecs}
                      disabled={generateRecs.isPending || gapsCount === 0}
                      className="w-full sm:w-auto min-h-11"
                    >
                      {generateRecs.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      <span className="sm:hidden">Generate</span>
                      <span className="hidden sm:inline">Generate Actions</span>
                    </Button>
                  </div>
                </div>

                {/* Course Filters - show when there are course recommendations */}
                {recommendations.filter(r => r.type === 'course').length > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 bg-green-50 px-3 py-2 sm:py-1.5 rounded-lg border border-green-200">
                      <Leaf className="h-4 w-4 text-green-600 shrink-0" />
                      <Switch 
                        id="free-first"
                        checked={freeFirst}
                        onCheckedChange={setFreeFirst}
                      />
                      <Label htmlFor="free-first" className="text-sm text-green-700 cursor-pointer whitespace-nowrap">Free First</Label>
                    </div>
                    <Select value={priceFilter} onValueChange={(v) => setPriceFilter(v as 'all' | 'free' | 'paid' | 'unknown')}>
                      <SelectTrigger className="w-full sm:w-36 h-10 sm:h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Prices</SelectItem>
                        <SelectItem value="free">Free Only</SelectItem>
                        <SelectItem value="paid">Paid Only</SelectItem>
                        <SelectItem value="unknown">Unknown Price</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground sm:ml-auto text-center sm:text-left">
                      {(() => {
                        const courseRecs = recommendations.filter(r => r.type === 'course');
                        const counts = countByPriceCategory(courseRecs);
                        return `${counts.free} free, ${counts.paid} paid, ${counts.unknown} unknown`;
                      })()}
                    </span>
                  </div>
                )}

                {/* Currently Learning section with smart linking */}
                <CurrentlyLearningPanel
                  enrollments={enrollments}
                  recommendations={recommendations}
                  onLinkCourse={handleLinkCourseToRecommendation}
                  isLinking={linkCourse.isPending}
                />

                <RecommendationsErrorBoundary componentName="RecommendationsList">
                  <RecommendationsList 
                    dreamJobId={activeDreamJobId} 
                    dreamJobTitle={selectedJob?.title}
                    freeFirst={freeFirst}
                    priceFilter={priceFilter}
                  />
                </RecommendationsErrorBoundary>
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

        {/* Tour Component */}
        <TourComponent />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmJob} onOpenChange={() => setDeleteConfirmJob(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Dream Job?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this dream job and all associated gap analyses and recommendations. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteConfirmJob) {
                    deleteDreamJob.mutate(deleteConfirmJob);
                    setDeleteConfirmJob(null);
                    if (deleteConfirmJob === activeDreamJobId) {
                      setSelectedJobId(undefined);
                    }
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
