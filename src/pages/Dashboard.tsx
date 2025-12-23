import { AppShell } from "@/components/layout";
import { DashboardOverview, CapabilitySnapshot, DreamJobCards, NextActionBanner, ProgressWidget } from "@/components/dashboard";
import { WelcomeBackBanner } from "@/components/dashboard/WelcomeBackBanner";
import { useDashboardOverview, useDashboardStats } from "@/hooks/useDashboard";
import { useDreamJobs, useGapAnalysesForJobs } from "@/hooks/useDreamJobs";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useNavigate } from "react-router-dom";
import { useSEO, pageSEO } from "@/hooks/useSEO";
import { useActivityTracking } from "@/hooks/useActivityTracking";

export default function DashboardPage() {
  useSEO(pageSEO.dashboard);
  useActivityTracking(); // Track user activity for re-engagement
  
  const navigate = useNavigate();
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: dreamJobs = [], isLoading: jobsLoading } = useDreamJobs();
  const { data: capabilities = [], isLoading: capsLoading } = useCapabilities();
  const { data: gapAnalyses = [], isLoading: gapsLoading } = useGapAnalysesForJobs();

  // Create a map of job id to gap count
  const gapCountsByJobId = gapAnalyses.reduce((acc, ga) => {
    const criticalCount = Array.isArray(ga.critical_gaps) ? ga.critical_gaps.length : 0;
    const priorityCount = Array.isArray(ga.priority_gaps) ? ga.priority_gaps.length : 0;
    acc[ga.dream_job_id] = criticalCount + priorityCount;
    return acc;
  }, {} as Record<string, number>);

  // Transform dream jobs for DreamJobCards component
  const transformedJobs = dreamJobs.map(job => ({
    id: job.id,
    title: job.title,
    company: job.company_type || undefined,
    location: job.location || undefined,
    salaryRange: job.salary_range || undefined,
    matchScore: job.match_score || 0,
    gapsCount: gapCountsByJobId[job.id] || 0,
    status: job.is_primary ? 'active' as const : 'active' as const,
  }));

  // Transform capabilities for CapabilitySnapshot
  const transformedCapabilities = capabilities.slice(0, 10).map(cap => ({
    name: cap.name,
    level: cap.proficiency_level === 'expert' ? 90 :
           cap.proficiency_level === 'advanced' ? 75 :
           cap.proficiency_level === 'intermediate' ? 55 : 35,
    maxLevel: 100,
    trend: 'stable' as const,
    category: cap.category || 'Other',
  }));

  // Create overview stats from real data
  const overviewStats = {
    coursesAnalyzed: overview?.totalCourses || 0,
    dreamJobsTracked: overview?.totalDreamJobs || 0,
    capabilitiesIdentified: overview?.totalCapabilities || 0,
    gapsToClose: overview?.topGaps?.length || 0,
    recommendationsCompleted: overview?.progressSummary?.completedRecommendations || 0,
    totalRecommendations: overview?.progressSummary?.totalRecommendations || 0,
    overallReadiness: overview?.averageMatchScore || 0,
  };

  // Stats for NextActionBanner
  const nextActionStats = {
    totalCourses: overview?.totalCourses || 0,
    totalDreamJobs: overview?.totalDreamJobs || 0,
    hasGapAnalysis: overview?.hasGapAnalysis || false,
    pendingRecommendations: overview?.progressSummary?.pendingRecommendations || 0,
    topRecommendation: overview?.topRecommendation,
  };

  // Stats for ProgressWidget
  const progressStats = {
    pending: overview?.progressSummary?.pendingRecommendations || 0,
    in_progress: overview?.progressSummary?.inProgressRecommendations || 0,
    completed: overview?.progressSummary?.completedRecommendations || 0,
    skipped: overview?.progressSummary?.skippedRecommendations || 0,
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your career progress overview.
          </p>
        </div>

        {/* Welcome Back Banner for returning users */}
        <WelcomeBackBanner />

        {/* Smart Next Action Banner */}
        <NextActionBanner 
          stats={nextActionStats}
          isLoading={overviewLoading}
        />

        <DashboardOverview 
          stats={overviewStats}
          isLoading={overviewLoading || statsLoading}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DreamJobCards 
              jobs={transformedJobs.length > 0 ? transformedJobs : undefined}
              isLoading={jobsLoading}
              onViewJob={(jobId) => navigate(`/dream-jobs/${jobId}`)}
              onAddJob={() => navigate('/dream-jobs')}
            />
          </div>
          <div className="space-y-6">
            {/* Progress Widget */}
            <ProgressWidget 
              recommendations={progressStats}
              isLoading={overviewLoading}
            />
            <CapabilitySnapshot 
              capabilities={transformedCapabilities.length > 0 ? transformedCapabilities : undefined}
              isLoading={capsLoading}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
