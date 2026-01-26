import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  BookOpen,
  Briefcase,
  TrendingUp,
  Zap,
  Clock,
  DollarSign,
  Brain,
  FileText,
  LucideIcon
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

// Type aliases for database tables
type Course = Tables<'courses'>;
type DreamJob = Tables<'dream_jobs'>;
type CapabilityRecord = Tables<'capabilities'>;
type JobRequirement = Tables<'job_requirements'>;
type GapAnalysis = Tables<'gap_analyses'>;
type Recommendation = Tables<'recommendations'>;
type AIUsage = Tables<'ai_usage'>;

// Typed JSON field interfaces
interface DayOneCapability {
  requirement: string;
  importance: 'critical' | 'important' | 'nice_to_have';
}

interface StrongOverlap {
  student_capability: string;
  job_requirement: string;
  assessment: string;
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

interface TestData {
  courses: Course[];
  dreamJobs: DreamJob[];
  capabilities: CapabilityRecord[];
  jobRequirements: JobRequirement[];
  gapAnalyses: GapAnalysis[];
  recommendations: Recommendation[];
  aiUsage: AIUsage[];
}

export default function TestResultsPage() {
  const [data, setData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTestData() {
      try {
        const [
          { data: courses },
          { data: dreamJobs },
          { data: capabilities },
          { data: jobRequirements },
          { data: gapAnalyses },
          { data: recommendations },
          { data: aiUsage }
        ] = await Promise.all([
          supabase.from("courses").select("*").order("created_at", { ascending: false }),
          supabase.from("dream_jobs").select("*").order("created_at", { ascending: false }),
          supabase.from("capabilities").select("*").order("created_at", { ascending: false }),
          supabase.from("job_requirements").select("*").order("created_at", { ascending: false }),
          supabase.from("gap_analyses").select("*").order("created_at", { ascending: false }),
          supabase.from("recommendations").select("*").order("created_at", { ascending: false }),
          supabase.from("ai_usage").select("*").order("created_at", { ascending: false })
        ]);

        setData({
          courses: courses || [],
          dreamJobs: dreamJobs || [],
          capabilities: capabilities || [],
          jobRequirements: jobRequirements || [],
          gapAnalyses: gapAnalyses || [],
          recommendations: recommendations || [],
          aiUsage: aiUsage || []
        });
      } catch (error) {
        console.error("Error fetching test data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTestData();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppShell>
    );
  }

  const latestGapAnalysis = data?.gapAnalyses[0];
  const latestCourse = data?.courses[0];
  const latestDreamJob = data?.dreamJobs[0];

  const totalAICost = data?.aiUsage.reduce((sum, u) => sum + (u.cost_usd || 0), 0) || 0;
  const totalTokens = data?.aiUsage.reduce((sum, u) => sum + (u.input_tokens || 0) + (u.output_tokens || 0), 0) || 0;

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Test Results Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              End-to-end edge function output report
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            All Systems Operational
          </Badge>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Courses Analyzed"
            value={data?.courses.length || 0}
            icon={BookOpen}
            color="text-blue-500"
          />
          <StatCard
            title="Capabilities Extracted"
            value={data?.capabilities.length || 0}
            icon={Zap}
            color="text-purple-500"
          />
          <StatCard
            title="Dream Jobs"
            value={data?.dreamJobs.length || 0}
            icon={Briefcase}
            color="text-amber-500"
          />
          <StatCard
            title="AI Calls Made"
            value={data?.aiUsage.length || 0}
            icon={Brain}
            color="text-emerald-500"
          />
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="syllabus" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="syllabus">Syllabus Analysis</TabsTrigger>
            <TabsTrigger value="dreamjob">Dream Job Analysis</TabsTrigger>
            <TabsTrigger value="gap">Gap Analysis</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="usage">AI Usage</TabsTrigger>
          </TabsList>

          {/* Syllabus Analysis Tab */}
          <TabsContent value="syllabus" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  analyze-syllabus Edge Function Output
                </CardTitle>
                <CardDescription>
                  Extracted capabilities, themes, and tools from course syllabi
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {latestCourse ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <span className="text-sm text-muted-foreground">Course Title</span>
                        <p className="font-semibold">{latestCourse.title}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Course Code</span>
                        <p className="font-semibold">{latestCourse.code || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">AI Model</span>
                        <p className="font-mono text-sm">{latestCourse.ai_model_used || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Keywords Generated</span>
                        <p className="font-semibold">{latestCourse.capability_keywords?.length || 0}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-500" />
                        Extracted Capabilities ({data?.capabilities.filter(c => c.course_id === latestCourse.id).length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {data?.capabilities
                          .filter(c => c.course_id === latestCourse.id)
                          .map((cap, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                              <Badge variant="outline" className="shrink-0">
                                {cap.category}
                              </Badge>
                              <div className="flex-1">
                                <p className="font-medium">{cap.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Level: {cap.proficiency_level}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Tools & Methods</h4>
                      <div className="flex flex-wrap gap-2">
                        {((latestCourse.tools_methods as unknown as string[]) || []).map((tool: string, i: number) => (
                          <Badge key={i} variant="secondary">{tool}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Capability Keywords</h4>
                      <div className="flex flex-wrap gap-1">
                        {(latestCourse.capability_keywords || []).slice(0, 30).map((kw: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                        ))}
                        {(latestCourse.capability_keywords?.length || 0) > 30 && (
                          <Badge variant="outline" className="text-xs">
                            +{latestCourse.capability_keywords.length - 30} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState message="No course data available" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dream Job Analysis Tab */}
          <TabsContent value="dreamjob" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  analyze-dream-job Edge Function Output
                </CardTitle>
                <CardDescription>
                  Generated job requirements, realistic bar, and differentiators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {latestDreamJob ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <span className="text-sm text-muted-foreground">Job Title</span>
                        <p className="font-semibold">{latestDreamJob.title}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Company Type</span>
                        <p className="font-semibold capitalize">{latestDreamJob.company_type || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Match Score</span>
                        <p className="font-semibold text-lg">{latestDreamJob.match_score || 0}%</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Requirements Keywords</span>
                        <p className="font-semibold">{latestDreamJob.requirements_keywords?.length || 0}</p>
                      </div>
                    </div>

                    {latestDreamJob.description && (
                      <div>
                        <h4 className="font-semibold mb-2">Job Description</h4>
                        <p className="text-muted-foreground">{latestDreamJob.description}</p>
                      </div>
                    )}

                    {latestDreamJob.realistic_bar && (
                      <div className="p-4 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Target className="w-4 h-4 text-amber-600" />
                          Realistic Hiring Bar
                        </h4>
                        <p className="text-sm">{latestDreamJob.realistic_bar}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold mb-3">Job Requirements ({data?.jobRequirements.filter(r => r.dream_job_id === latestDreamJob.id).length})</h4>
                      <div className="grid gap-2">
                        {data?.jobRequirements
                          .filter(r => r.dream_job_id === latestDreamJob.id)
                          .map((req, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                              <Badge 
                                variant={req.importance === 'required' ? 'destructive' : req.importance === 'preferred' ? 'default' : 'outline'}
                                className="shrink-0 w-24 justify-center"
                              >
                                {req.importance}
                              </Badge>
                              <span className="flex-1">{req.skill_name}</span>
                              <Badge variant="outline">{req.category}</Badge>
                            </div>
                          ))}
                      </div>
                    </div>

                    {latestDreamJob.day_one_capabilities && (
                      <div>
                        <h4 className="font-semibold mb-3">Day-One Capabilities</h4>
                        <div className="space-y-2">
                          {((latestDreamJob.day_one_capabilities as unknown as DayOneCapability[] | null) || []).map((cap, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 bg-muted/30 rounded">
                              <Badge variant={cap.importance === 'critical' ? 'destructive' : 'secondary'} className="shrink-0">
                                {cap.importance}
                              </Badge>
                              <span className="text-sm">{cap.requirement}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {latestDreamJob.differentiators && (
                      <div>
                        <h4 className="font-semibold mb-3">Differentiators</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {((latestDreamJob.differentiators as unknown as string[]) || []).map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {latestDreamJob.common_misconceptions && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Common Misconceptions
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {((latestDreamJob.common_misconceptions as unknown as string[]) || []).map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState message="No dream job data available" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gap Analysis Tab */}
          <TabsContent value="gap" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  gap-analysis Edge Function Output
                </CardTitle>
                <CardDescription>
                  Skill overlaps, gaps, and readiness assessment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {latestGapAnalysis ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg text-center">
                        <span className="text-4xl font-bold">{latestGapAnalysis.match_score || 0}%</span>
                        <p className="text-sm text-muted-foreground mt-1">Match Score</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg text-center">
                        <Badge className="text-sm" variant={
                          latestGapAnalysis.readiness_level === 'ready' ? 'default' :
                          latestGapAnalysis.readiness_level === 'almost_ready' ? 'secondary' :
                          'destructive'
                        }>
                          {latestGapAnalysis.readiness_level?.replace(/_/g, ' ')}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-2">Readiness Level</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg text-center">
                        <span className="text-2xl font-bold text-green-500">
                          {(latestGapAnalysis.strong_overlaps as unknown as StrongOverlap[] | null)?.length || 0}
                        </span>
                        <p className="text-sm text-muted-foreground mt-1">Strong Overlaps</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg text-center">
                        <span className="text-2xl font-bold text-red-500">
                          {(latestGapAnalysis.critical_gaps as unknown as CriticalGap[] | null)?.length || 0}
                        </span>
                        <p className="text-sm text-muted-foreground mt-1">Critical Gaps</p>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg bg-muted/20">
                      <h4 className="font-semibold mb-2">Honest Assessment</h4>
                      <p className="text-sm">{latestGapAnalysis.honest_assessment}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Strong Overlaps
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {((latestGapAnalysis.strong_overlaps as unknown as StrongOverlap[] | null) || []).map((overlap, i) => (
                            <div key={i} className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                              <p className="font-medium text-sm">{overlap.job_requirement}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                ✓ {overlap.student_capability}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-500" />
                          Critical Gaps
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {((latestGapAnalysis.critical_gaps as unknown as CriticalGap[] | null) || []).map((gap, i) => (
                            <div key={i} className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <p className="font-medium text-sm">{gap.job_requirement}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Status: {gap.student_status}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Priority Gaps (Action Order)</h4>
                      <div className="space-y-2">
                        {((latestGapAnalysis.priority_gaps as unknown as PriorityGap[] | null) || []).map((gap, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                              {gap.priority}
                            </span>
                            <div>
                              <p className="font-medium">{gap.gap}</p>
                              <p className="text-sm text-muted-foreground mt-1">{gap.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {latestGapAnalysis.interview_readiness && (
                      <div className="p-4 border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 rounded-lg">
                        <h4 className="font-semibold mb-2">Interview Readiness</h4>
                        <p className="text-sm">{latestGapAnalysis.interview_readiness}</p>
                      </div>
                    )}

                    {latestGapAnalysis.job_success_prediction && (
                      <div className="p-4 border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 rounded-lg">
                        <h4 className="font-semibold mb-2">Job Success Prediction</h4>
                        <p className="text-sm">{latestGapAnalysis.job_success_prediction}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState message="No gap analysis data available" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  generate-recommendations Edge Function Output
                </CardTitle>
                <CardDescription>
                  Personalized learning recommendations and action items
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.recommendations.length ? (
                  <div className="space-y-4">
                    <div className="flex gap-4 mb-4">
                      <Badge variant="outline">
                        Total: {data.recommendations.length}
                      </Badge>
                      <Badge variant="default">
                        Pending: {data.recommendations.filter(r => r.status === 'pending').length}
                      </Badge>
                      <Badge variant="secondary">
                        Completed: {data.recommendations.filter(r => r.status === 'completed').length}
                      </Badge>
                    </div>
                    <ScrollArea className="h-96">
                      <div className="space-y-3">
                        {data.recommendations.map((rec, i) => (
                          <div key={i} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'outline'}>
                                    {rec.priority}
                                  </Badge>
                                  <Badge variant="outline">{rec.type}</Badge>
                                  {rec.status === 'completed' && (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  )}
                                </div>
                                <h4 className="font-semibold">{rec.title}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                                  {rec.duration && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {rec.duration}
                                    </span>
                                  )}
                                  {rec.cost_usd !== null && (
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="w-3 h-3" /> ${rec.cost_usd}
                                    </span>
                                  )}
                                  {rec.provider && (
                                    <span>Provider: {rec.provider}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <EmptyState message="No recommendations generated yet" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Usage Tab */}
          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Usage Statistics
                </CardTitle>
                <CardDescription>
                  Token consumption and cost tracking across all edge functions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <span className="text-2xl font-bold">{data?.aiUsage.length || 0}</span>
                    <p className="text-sm text-muted-foreground mt-1">Total AI Calls</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <span className="text-2xl font-bold">{totalTokens.toLocaleString()}</span>
                    <p className="text-sm text-muted-foreground mt-1">Total Tokens</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <span className="text-2xl font-bold">${totalAICost.toFixed(4)}</span>
                    <p className="text-sm text-muted-foreground mt-1">Estimated Cost</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <span className="text-2xl font-bold font-mono text-xs">gemini-2.5-flash</span>
                    <p className="text-sm text-muted-foreground mt-1">Primary Model</p>
                  </div>
                </div>

                {data?.aiUsage.length ? (
                  <div>
                    <h4 className="font-semibold mb-3">Recent AI Calls</h4>
                    <div className="space-y-2">
                      {data.aiUsage.slice(0, 10).map((usage, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{usage.function_name}</Badge>
                            <span className="text-sm font-mono">{usage.model_used}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{(usage.input_tokens || 0) + (usage.output_tokens || 0)} tokens</span>
                            <span>${(usage.cost_usd || 0).toFixed(4)}</span>
                            <span>{new Date(usage.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No AI usage data recorded" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: LucideIcon; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileText className="w-12 h-12 mb-4 opacity-50" />
      <p>{message}</p>
    </div>
  );
}
