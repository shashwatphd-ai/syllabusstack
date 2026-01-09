import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText, ArrowLeft, Download, Calendar, TrendingUp,
  Target, Award, BookOpen, Users, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSubscription } from '@/hooks/useSubscription';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OutcomeStats {
  totalStudents: number;
  activeStudents: number;
  avgGapsIdentified: number;
  avgGapsClosed: number;
  avgCompletionRate: number;
  topSkillGaps: Array<{ skill: string; count: number }>;
  topDreamJobs: Array<{ title: string; count: number }>;
  courseUtilization: Array<{ course: string; students: number; avgProgress: number }>;
}

export default function OutcomesReport() {
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('30');

  if (tier !== 'university') {
    navigate('/dashboard');
    return null;
  }

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'outcomes', timeRange],
    queryFn: async (): Promise<OutcomeStats> => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));

      // Get student counts
      const { count: totalStudents } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: activeStudents } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active_at', daysAgo.toISOString());

      // Get gap analysis stats from gap_analyses table
      const { data: gapAnalyses } = await supabase
        .from('gap_analyses')
        .select('critical_gaps, strong_overlaps')
        .gte('created_at', daysAgo.toISOString());

      // Count gaps and overlaps from JSON arrays
      let totalGaps = 0;
      let closedGaps = 0;
      const skillCounts: Record<string, number> = {};

      gapAnalyses?.forEach((ga: any) => {
        const criticalGaps = ga.critical_gaps || [];
        const overlaps = ga.strong_overlaps || [];
        totalGaps += criticalGaps.length;
        closedGaps += overlaps.length;
        
        criticalGaps.forEach((gap: any) => {
          const skill = gap?.skill || gap?.name || 'Unknown skill';
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        });
      });

      const topSkillGaps = Object.entries(skillCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([skill, count]) => ({ skill, count }));

      // Get top dream jobs from dream_jobs table
      const { data: dreamJobs } = await supabase
        .from('dream_jobs')
        .select('title');

      const jobCounts: Record<string, number> = {};
      dreamJobs?.forEach((j: any) => {
        jobCounts[j.title] = (jobCounts[j.title] || 0) + 1;
      });
      const topDreamJobs = Object.entries(jobCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([title, count]) => ({ title, count }));

      // Get course utilization from course_enrollments
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select(`
          instructor_course_id,
          overall_progress,
          instructor_course:instructor_courses(title)
        `)
        .limit(100);

      // Aggregate by course
      const courseStats: Record<string, { students: number; totalProgress: number; title: string }> = {};
      enrollments?.forEach((e: any) => {
        const courseId = e.instructor_course_id;
        const title = e.instructor_course?.title || 'Unknown Course';
        if (!courseStats[courseId]) {
          courseStats[courseId] = { students: 0, totalProgress: 0, title };
        }
        courseStats[courseId].students++;
        courseStats[courseId].totalProgress += e.overall_progress || 0;
      });

      const courseUtilization = Object.values(courseStats)
        .map(c => ({
          course: c.title,
          students: c.students,
          avgProgress: c.students ? Math.round(c.totalProgress / c.students) : 0,
        }))
        .sort((a, b) => b.students - a.students)
        .slice(0, 5);

      // Get completion rate
      const { data: recommendations } = await supabase
        .from('recommendations')
        .select('status')
        .gte('created_at', daysAgo.toISOString());

      const completed = recommendations?.filter(r => r.status === 'completed').length || 0;
      const avgCompletionRate = recommendations?.length
        ? Math.round((completed / recommendations.length) * 100)
        : 0;

      return {
        totalStudents: totalStudents || 0,
        activeStudents: activeStudents || 0,
        avgGapsIdentified: totalStudents ? Math.round(totalGaps / totalStudents) : 0,
        avgGapsClosed: totalStudents ? Math.round(closedGaps / totalStudents) : 0,
        avgCompletionRate,
        topSkillGaps,
        topDreamJobs,
        courseUtilization,
      };
    },
  });

  const handleExport = () => {
    // Generate PDF report - placeholder
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Outcomes Report
          </h1>
          <p className="text-muted-foreground">
            Student progress and career readiness analytics
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold">{stats?.activeStudents}</p>
                    <p className="text-sm text-muted-foreground">
                      of {stats?.totalStudents} active
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Target className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-3xl font-bold">{stats?.avgGapsIdentified}</p>
                    <p className="text-sm text-muted-foreground">Avg gaps per student</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Award className="h-8 w-8 text-success" />
                  <div>
                    <p className="text-3xl font-bold">{stats?.avgGapsClosed}</p>
                    <p className="text-sm text-muted-foreground">Avg gaps closed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-3xl font-bold">{stats?.avgCompletionRate}%</p>
                    <p className="text-sm text-muted-foreground">Completion rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Reports */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Skill Gaps */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Top Skill Gaps
                </CardTitle>
                <CardDescription>
                  Most common gaps across all students
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.topSkillGaps.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No data yet</p>
                ) : (
                  <div className="space-y-4">
                    {stats?.topSkillGaps.map((gap, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{gap.skill}</span>
                          <span className="text-muted-foreground">{gap.count} students</span>
                        </div>
                        <Progress
                          value={(gap.count / (stats?.totalStudents || 1)) * 100}
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Dream Jobs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Top Career Goals
                </CardTitle>
                <CardDescription>
                  Most popular dream job selections
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.topDreamJobs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats?.topDreamJobs.map((job, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{i + 1}</Badge>
                          <span>{job.title}</span>
                        </div>
                        <span className="text-muted-foreground">{job.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Course Utilization */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Course Utilization
                </CardTitle>
                <CardDescription>
                  Most enrolled courses and average progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.courseUtilization.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No courses yet</p>
                ) : (
                  <div className="space-y-4">
                    {stats?.courseUtilization.map((course, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{course.course}</p>
                          <p className="text-sm text-muted-foreground">
                            {course.students} students enrolled
                          </p>
                        </div>
                        <div className="w-32">
                          <Progress value={course.avgProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground text-right mt-1">
                            {course.avgProgress}% avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
