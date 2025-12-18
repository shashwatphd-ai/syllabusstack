import { AppShell } from "@/components/layout";
import { DashboardOverview, CapabilitySnapshot, DreamJobCards } from "@/components/dashboard";
import { useDashboardOverview, useDashboardStats } from "@/hooks/useDashboard";
import { useDreamJobs } from "@/hooks/useDreamJobs";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: dreamJobs = [], isLoading: jobsLoading } = useDreamJobs();
  const { data: capabilities = [], isLoading: capsLoading } = useCapabilities();

  // Transform dream jobs for DreamJobCards component
  const transformedJobs = dreamJobs.map(job => ({
    id: job.id,
    title: job.title,
    company: job.company_type || undefined,
    location: job.location || undefined,
    salaryRange: job.salary_range || undefined,
    matchScore: job.match_score || 0,
    gapsCount: 0, // Would need gap analysis data
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

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your career progress overview.
          </p>
        </div>

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
          <div>
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
