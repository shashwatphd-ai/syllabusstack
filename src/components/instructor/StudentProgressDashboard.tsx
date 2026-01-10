import { Users, TrendingUp, Clock, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCourseStudents } from '@/hooks/useInstructorCourses';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { isComplete, getStateConfig, type VerificationState } from '@/lib/verification-state-machine';

interface StudentProgressDashboardProps {
  courseId: string;
}

export function StudentProgressDashboard({ courseId }: StudentProgressDashboardProps) {
  const { data, isLoading, error } = useCourseStudents(courseId);

  if (isLoading) {
    return <LoadingState message="Loading student progress..." />;
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-destructive">Failed to load student data</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.enrollments.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No students enrolled"
        description="Students will appear here once they enroll using your course access code. Share the access code to get started."
      />
    );
  }

  const { enrollments, totalLOs, loProgress } = data;

  // Calculate overall stats
  const completedStudents = enrollments.filter(e => e.completed_at !== null).length;
  const avgProgress = enrollments.length > 0
    ? enrollments.reduce((sum, e) => sum + (e.overall_progress || 0), 0) / enrollments.length
    : 0;

  // Calculate student progress percentage
  const getStudentProgress = (studentId: string) => {
    const progress = loProgress[studentId] || [];
    if (progress.length === 0 || totalLOs === 0) return 0;

    const completed = progress.filter(p =>
      isComplete(p.verification_state as VerificationState)
    ).length;

    return Math.round((completed / totalLOs) * 100);
  };

  // Get initials from name or email
  const getInitials = (student: typeof enrollments[0]) => {
    const name = student.profile?.full_name || student.profile?.email || 'S';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enrollments.length}</p>
                <p className="text-sm text-muted-foreground">Enrolled Students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedStudents}</p>
                <p className="text-sm text-muted-foreground">Completed Course</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(avgProgress)}%</p>
                <p className="text-sm text-muted-foreground">Avg. Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      <Card>
        <CardHeader>
          <CardTitle>Student Progress</CardTitle>
          <CardDescription>
            Track individual student progress through the course
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {enrollments.map((student) => {
              const progress = getStudentProgress(student.student_id);
              const studentLOProgress = loProgress[student.student_id] || [];
              const completedLOs = studentLOProgress.filter(p =>
                isComplete(p.verification_state as VerificationState)
              ).length;
              const inProgressLOs = studentLOProgress.filter(p =>
                p.verification_state === 'in_progress' || p.verification_state === 'verified'
              ).length;

              return (
                <div
                  key={student.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Avatar>
                    <AvatarFallback>{getInitials(student)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {student.profile?.full_name || 'Anonymous Student'}
                      </p>
                      {student.completed_at && (
                        <Badge variant="default" className="bg-success text-success-foreground">
                          Completed
                        </Badge>
                      )}
                    </div>
                    {student.profile?.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {student.profile.email}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1 max-w-xs">
                        <Progress value={progress} className="h-2" />
                      </div>
                      <span className="text-sm font-medium">{progress}%</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        {completedLOs} completed
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-warning" />
                        {inProgressLOs} in progress
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-muted-foreground" />
                        {totalLOs - completedLOs - inProgressLOs} not started
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-sm text-muted-foreground">
                    <p>Enrolled</p>
                    <p className="font-medium text-foreground">
                      {new Date(student.enrolled_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
