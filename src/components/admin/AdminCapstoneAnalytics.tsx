/**
 * AdminCapstoneAnalytics — Project quality analytics for admin dashboard.
 * Shows pipeline metrics, score distributions, and partnership stats.
 */

import { BarChart3, Building2, Target, Users, TrendingUp, Briefcase, CheckCircle2, Handshake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function useCapstoneAnalytics() {
  return useQuery({
    queryKey: ['admin', 'capstone-analytics'],
    queryFn: async () => {
      const [projectsRes, companiesRes, applicationsRes, proposalsRes, submissionsRes] = await Promise.all([
        supabase.from('capstone_projects').select('id, final_score, lo_alignment_score, feasibility_score, status, tier'),
        supabase.from('company_profiles').select('id, composite_signal_score'),
        (supabase as any).from('capstone_applications').select('id, status'),
        (supabase as any).from('partnership_proposals').select('id, status, channel'),
        supabase.from('employer_interest_submissions').select('id, status'),
      ]);

      const projects = projectsRes.data || [];
      const companies = companiesRes.data || [];
      const applications = applicationsRes.data || [];
      const proposals = proposalsRes.data || [];
      const submissions = submissionsRes.data || [];

      // Score distributions
      const scores = projects
        .map((p: any) => p.final_score)
        .filter((s: any) => s != null)
        .map((s: number) => Math.round(s * 100));

      const avgScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      const highQuality = scores.filter((s: number) => s >= 70).length;
      const mediumQuality = scores.filter((s: number) => s >= 40 && s < 70).length;
      const lowQuality = scores.filter((s: number) => s < 40).length;

      // Status breakdown
      const statusCounts: Record<string, number> = {};
      projects.forEach((p: any) => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });

      // Tier breakdown
      const tierCounts: Record<string, number> = {};
      projects.forEach((p: any) => {
        if (p.tier) tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
      });

      // Company signal avg
      const signalScores = companies
        .map((c: any) => c.composite_signal_score)
        .filter((s: any) => s != null);
      const avgSignal = signalScores.length
        ? Math.round(signalScores.reduce((a: number, b: number) => a + b, 0) / signalScores.length)
        : 0;

      return {
        totalProjects: projects.length,
        totalCompanies: companies.length,
        totalApplications: applications.length,
        totalProposals: proposals.length,
        totalSubmissions: submissions.length,
        avgScore,
        avgSignal,
        highQuality,
        mediumQuality,
        lowQuality,
        statusCounts,
        tierCounts,
        pendingSubmissions: submissions.filter((s: any) => s.status === 'pending').length,
        proposalsSent: proposals.filter((p: any) => p.status === 'sent').length,
        applicationsAccepted: applications.filter((a: any) => a.status === 'accepted').length,
      };
    },
  });
}

export function AdminCapstoneAnalytics() {
  const { data: stats, isLoading } = useCapstoneAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Capstone Pipeline Analytics
      </h3>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.totalProjects}</p>
                <p className="text-[10px] text-muted-foreground">AI Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Building2 className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.totalCompanies}</p>
                <p className="text-[10px] text-muted-foreground">Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Handshake className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.totalProposals}</p>
                <p className="text-[10px] text-muted-foreground">Proposals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Users className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.totalApplications}</p>
                <p className="text-[10px] text-muted-foreground">Applications</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Distribution + Scores */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" /> Project Quality Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600 font-medium">High Quality (70%+)</span>
                <span className="font-bold">{stats.highQuality}</span>
              </div>
              <Progress value={stats.totalProjects ? (stats.highQuality / stats.totalProjects) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-600 font-medium">Medium Quality (40-69%)</span>
                <span className="font-bold">{stats.mediumQuality}</span>
              </div>
              <Progress value={stats.totalProjects ? (stats.mediumQuality / stats.totalProjects) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-500 font-medium">Low Quality (&lt;40%)</span>
                <span className="font-bold">{stats.lowQuality}</span>
              </div>
              <Progress value={stats.totalProjects ? (stats.lowQuality / stats.totalProjects) * 100 : 0} className="h-2" />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">Average Score</span>
              <span className="text-lg font-bold text-primary">{stats.avgScore}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Status breakdown */}
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">{status.replace('_', ' ')}</span>
                <div className="flex items-center gap-2">
                  <Progress value={stats.totalProjects ? ((count as number) / stats.totalProjects) * 100 : 0} className="h-1.5 w-24" />
                  <span className="font-medium w-6 text-right">{count as number}</span>
                </div>
              </div>
            ))}

            {Object.keys(stats.tierCounts).length > 0 && (
              <>
                <div className="text-xs text-muted-foreground font-medium pt-2">Tier Breakdown</div>
                {Object.entries(stats.tierCounts).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between text-xs">
                    <Badge variant="outline" className="text-[10px] capitalize">{tier}</Badge>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))}
              </>
            )}

            {/* Key metrics */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Avg Signal Score</span>
                <span className="font-bold">{stats.avgSignal}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pending Employer Leads</span>
                <span className="font-bold text-amber-600">{stats.pendingSubmissions}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Proposals Sent</span>
                <span className="font-bold text-blue-600">{stats.proposalsSent}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Applications Accepted</span>
                <span className="font-bold text-green-600">{stats.applicationsAccepted}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
