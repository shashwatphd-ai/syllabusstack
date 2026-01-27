import { Link } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  TrendingUp,
  Target,
  Calendar,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EnrolledCourse {
  id: string;
  instructor_course_id: string;
  enrolled_at: string;
  overall_progress: number;
  instructor_courses: {
    id: string;
    title: string;
    code: string | null;
  };
}

interface LearningStats {
  totalCourses: number;
  completedCourses: number;
  totalObjectives: number;
  completedObjectives: number;
  totalCertificates: number;
  currentStreak: number;
}

export default function ProgressPage() {
  const { user } = useAuth();

  // Fetch enrolled courses with progress
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['student-progress-enrollments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          instructor_course_id,
          enrolled_at,
          overall_progress,
          instructor_courses (
            id,
            title,
            code
          )
        `)
        .eq('student_id', user.id)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;
      return data as EnrolledCourse[];
    },
    enabled: !!user?.id,
  });

  // Fetch learning stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['student-progress-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get enrollments count
      const { count: totalCourses } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', user.id);

      // Get completed courses (100% progress)
      const { count: completedCourses } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', user.id)
        .gte('overall_progress', 100);

      // Certificates count placeholder (certificates table may not exist yet)
      const totalCertificates = 0;

      // Calculate learning objectives progress from consumption_records
      const { data: loProgress } = await supabase
        .from('consumption_records')
        .select('is_verified, learning_objective_id')
        .eq('user_id', user.id);

      const totalObjectives = loProgress?.length ?? 0;
      const completedObjectives = loProgress?.filter(
        (lo) => lo.is_verified === true
      ).length ?? 0;

      // Simple streak calculation based on recent activity
      const { data: recentActivity } = await supabase
        .from('consumption_records')
        .select('updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(30);

      let currentStreak = 0;
      if (recentActivity && recentActivity.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activityDates = new Set(
          recentActivity.map((a) => {
            const d = new Date(a.updated_at);
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
          })
        );

        for (let i = 0; i < 30; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
          if (activityDates.has(checkDate.toISOString())) {
            currentStreak++;
          } else if (i > 0) {
            break;
          }
        }
      }

      return {
        totalCourses: totalCourses ?? 0,
        completedCourses: completedCourses ?? 0,
        totalObjectives,
        completedObjectives,
        totalCertificates: totalCertificates ?? 0,
        currentStreak,
      } as LearningStats;
    },
    enabled: !!user?.id,
  });

  // Fetch recent activity
  const { data: recentActivity } = useQuery({
    queryKey: ['student-recent-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('consumption_records')
        .select(`
          id,
          updated_at,
          is_verified,
          learning_objectives (
            id,
            description,
            modules (
              title,
              instructor_courses (
                title
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const isLoading = enrollmentsLoading || statsLoading;

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Learning Progress
            </h1>
            <p className="text-muted-foreground">
              Track your learning journey and achievements.
            </p>
          </div>

          {/* Stats Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalCourses ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Enrolled Courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.completedObjectives ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Objectives Complete</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Award className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalCertificates ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Certificates Earned</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Flame className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.currentStreak ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Day Streak</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Course Progress */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Course Progress</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/learn?tab=active">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>

              {enrollmentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : enrollments && enrollments.length > 0 ? (
                <div className="space-y-3">
                  {enrollments.slice(0, 5).map((enrollment) => (
                    <Card key={enrollment.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {enrollment.instructor_courses?.code && (
                                <Badge variant="secondary" className="text-xs">
                                  {enrollment.instructor_courses.code}
                                </Badge>
                              )}
                              <Link
                                to={`/learn/course/${enrollment.instructor_course_id}`}
                                className="font-medium hover:text-primary truncate"
                              >
                                {enrollment.instructor_courses?.title || 'Untitled Course'}
                              </Link>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold">
                              {Math.round(enrollment.overall_progress || 0)}%
                            </p>
                          </div>
                        </div>
                        <Progress value={enrollment.overall_progress || 0} className="h-2" />
                        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                          <span>
                            {enrollment.overall_progress >= 100 ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Completed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                In Progress
                              </span>
                            )}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            asChild
                          >
                            <Link to={`/learn/course/${enrollment.instructor_course_id}`}>
                              Continue Learning →
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No Courses Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Enroll in a course to start tracking your progress.
                    </p>
                    <Button asChild>
                      <Link to="/learn">Browse Courses</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Overall Progress */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Overall Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Courses Completed</span>
                          <span className="font-medium">
                            {stats.completedCourses}/{stats.totalCourses}
                          </span>
                        </div>
                        <Progress
                          value={
                            stats.totalCourses > 0
                              ? (stats.completedCourses / stats.totalCourses) * 100
                              : 0
                          }
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Objectives Mastered</span>
                          <span className="font-medium">
                            {stats.completedObjectives}/{stats.totalObjectives}
                          </span>
                        </div>
                        <Progress
                          value={
                            stats.totalObjectives > 0
                              ? (stats.completedObjectives / stats.totalObjectives) * 100
                              : 0
                          }
                          className="h-2"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentActivity && recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((activity: any) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <div
                            className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                              activity.is_verified === true
                                ? 'bg-green-500'
                                : 'bg-yellow-500'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate">
                              {activity.learning_objectives?.description?.slice(0, 50)}...
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/learn?tab=active">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Continue Learning
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/learn?tab=certificates">
                      <Award className="h-4 w-4 mr-2" />
                      View Certificates
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/career">
                      <Target className="h-4 w-4 mr-2" />
                      Career Goals
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
