import { useParams, Link } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  BarChart3,
  Clock,
  Target,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Activity,
  BookOpen,
  Award,
  GraduationCap,
  UserCheck,
  UserX,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  useCourseAnalytics,
  useFilteredStudents,
  StudentProgress,
} from '@/hooks/useInstructorAnalytics';
import { useState } from 'react';

export default function CourseAnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [studentFilter, setStudentFilter] = useState<'all' | 'active' | 'inactive' | 'completed' | 'struggling'>('all');

  const { data: analytics, isLoading: analyticsLoading } = useCourseAnalytics(courseId);
  const { students, isLoading: studentsLoading, counts } = useFilteredStudents(courseId, studentFilter);

  const isLoading = analyticsLoading || studentsLoading;

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Course Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This course doesn't exist or you don't have access to it.
            </p>
            <Button asChild>
              <Link to="/instructor/courses">Back to Courses</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Button asChild variant="ghost" size="sm" className="h-auto p-0">
              <Link to="/instructor/courses" className="flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to Courses
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            {analytics.courseTitle}
          </h1>
          {analytics.courseCode && (
            <p className="text-muted-foreground">{analytics.courseCode}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/instructor/courses/${courseId}`}>
              <BookOpen className="h-4 w-4 mr-2" />
              View Course
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/instructor/courses/${courseId}/gradebook`}>
              <GraduationCap className="h-4 w-4 mr-2" />
              Gradebook
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          label="Total Enrolled"
          value={analytics.totalEnrollments}
          trend={null}
          iconColor="text-blue-600"
          bgColor="bg-blue-100"
        />
        <MetricCard
          icon={Activity}
          label="Active (7 days)"
          value={analytics.activeStudents}
          trend={analytics.totalEnrollments > 0
            ? Math.round((analytics.activeStudents / analytics.totalEnrollments) * 100)
            : 0}
          trendLabel="% of total"
          iconColor="text-green-600"
          bgColor="bg-green-100"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Completed"
          value={analytics.completedStudents}
          trend={analytics.totalEnrollments > 0
            ? Math.round((analytics.completedStudents / analytics.totalEnrollments) * 100)
            : 0}
          trendLabel="% completion"
          iconColor="text-emerald-600"
          bgColor="bg-emerald-100"
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Progress"
          value={`${analytics.averageProgress}%`}
          trend={null}
          iconColor="text-purple-600"
          bgColor="bg-purple-100"
        />
      </div>

      {/* Assessment & Content Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              Assessment Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold">{analytics.totalAssessmentAttempts}</div>
                <div className="text-sm text-muted-foreground">Total Attempts</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold">{analytics.averageAssessmentScore}%</div>
                <div className="text-sm text-muted-foreground">Average Score</div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Pass Rate</span>
                <span className="text-sm text-muted-foreground">{analytics.passRate}%</span>
              </div>
              <Progress value={analytics.passRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Content Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold">{analytics.totalContentViews}</div>
                <div className="text-sm text-muted-foreground">Content Views</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold">
                  {analytics.lastActivityAt
                    ? new Date(analytics.lastActivityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">Last Activity</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Student Progress
              </CardTitle>
              <CardDescription>
                Track individual student progress and engagement
              </CardDescription>
            </div>
            <Tabs value={studentFilter} onValueChange={(v) => setStudentFilter(v as typeof studentFilter)}>
              <TabsList>
                <TabsTrigger value="all" className="gap-1">
                  All
                  <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
                </TabsTrigger>
                <TabsTrigger value="active" className="gap-1">
                  <Activity className="h-3 w-3" />
                  Active
                  <Badge variant="secondary" className="ml-1">{counts.active}</Badge>
                </TabsTrigger>
                <TabsTrigger value="struggling" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  At Risk
                  <Badge variant="secondary" className="ml-1">{counts.struggling}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Done
                  <Badge variant="secondary" className="ml-1">{counts.completed}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No students match this filter</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <StudentRow key={student.id} student={student} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Metric card component
function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  iconColor,
  bgColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend: number | null;
  trendLabel?: string;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn('p-2 rounded-lg', bgColor)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
          {trend !== null && (
            <Badge variant="outline" className="text-xs">
              {trend}% {trendLabel}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Student row component
function StudentRow({ student }: { student: StudentProgress }) {
  const statusConfig = getStatusConfig(student.status);

  return (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{student.studentName}</div>
          <div className="text-xs text-muted-foreground">{student.studentEmail}</div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('gap-1', statusConfig.className)}>
          <statusConfig.icon className="h-3 w-3" />
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={student.overallProgress} className="w-20 h-2" />
          <span className="text-sm text-muted-foreground">{student.overallProgress}%</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {student.lastActivityAt
            ? new Date(student.lastActivityAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : 'Never'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm">
          View Details
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Status configuration
function getStatusConfig(status: StudentProgress['status']) {
  switch (status) {
    case 'active':
      return {
        icon: Activity,
        label: 'Active',
        className: 'bg-green-50 border-green-200 text-green-700',
      };
    case 'completed':
      return {
        icon: CheckCircle2,
        label: 'Completed',
        className: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      };
    case 'struggling':
      return {
        icon: AlertTriangle,
        label: 'At Risk',
        className: 'bg-amber-50 border-amber-200 text-amber-700',
      };
    default:
      return {
        icon: UserX,
        label: 'Inactive',
        className: 'bg-gray-50 border-gray-200 text-gray-700',
      };
  }
}
