import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  GraduationCap,
  Users,
  TrendingUp,
  CheckCircle2,
  Award,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  useGradebookSummary,
  useCourseAssessments,
  useIssueCertificate,
} from '@/hooks/useGradebook';
import { useCourseAnalytics } from '@/hooks/useInstructorAnalytics';
import { GradebookTable } from '@/components/instructor/GradebookTable';
import { StudentMessageDialog } from '@/components/instructor/StudentMessageDialog';
import { useToast } from '@/hooks/use-toast';

export default function GradebookPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { toast } = useToast();

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const { data: analytics, isLoading: analyticsLoading } = useCourseAnalytics(courseId);
  const { data: summary, isLoading: summaryLoading } = useGradebookSummary(courseId);
  const { data: assessments = [], isLoading: assessmentsLoading } = useCourseAssessments(courseId);
  const issueCertificateMutation = useIssueCertificate(courseId);

  const isLoading = analyticsLoading || summaryLoading || assessmentsLoading;

  const handleSendMessage = (studentIds: string[]) => {
    setSelectedStudentIds(studentIds);
    setMessageDialogOpen(true);
  };

  const handleIssueCertificate = async (studentId: string) => {
    const result = await issueCertificateMutation.mutateAsync(studentId);
    if (result.success) {
      toast({
        title: 'Certificate Issued',
        description: 'The student has been notified of their course completion.',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to issue certificate',
        variant: 'destructive',
      });
    }
  };

  const handleViewStudent = (studentId: string) => {
    // For now, just scroll to or highlight the student
    // In the future, this could open a detailed student view
    toast({
      title: 'Student Details',
      description: 'Detailed student view coming soon.',
    });
  };

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
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
            <GraduationCap className="h-7 w-7 text-primary" />
            Gradebook: {analytics.courseTitle}
          </h1>
          {analytics.courseCode && (
            <p className="text-muted-foreground">{analytics.courseCode}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/instructor/courses/${courseId}`}>
              View Course
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/instructor/courses/${courseId}/analytics`}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={Users}
            label="Total Students"
            value={summary.totalStudents}
            iconColor="text-blue-600"
            bgColor="bg-blue-100"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Average Score"
            value={`${summary.averageScore}%`}
            iconColor="text-purple-600"
            bgColor="bg-purple-100"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Passing Rate"
            value={`${summary.passingRate}%`}
            iconColor="text-green-600"
            bgColor="bg-green-100"
          />
          <SummaryCard
            icon={Award}
            label="Completion Rate"
            value={`${summary.completionRate}%`}
            iconColor="text-amber-600"
            bgColor="bg-amber-100"
          />
        </div>
      )}

      {/* Grade Distribution */}
      {summary && summary.totalStudents > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grade Distribution</CardTitle>
            <CardDescription>
              Breakdown of letter grades across all students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 h-32">
              {(['A', 'B', 'C', 'D', 'F'] as const).map((grade) => {
                const count = summary.gradeDistribution[grade];
                const percentage = summary.totalStudents > 0
                  ? (count / summary.totalStudents) * 100
                  : 0;
                return (
                  <div key={grade} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-muted rounded-t relative" style={{ height: `${Math.max(percentage, 5)}%` }}>
                      <div
                        className={cn(
                          'absolute inset-0 rounded-t transition-all',
                          grade === 'A' && 'bg-green-500',
                          grade === 'B' && 'bg-blue-500',
                          grade === 'C' && 'bg-amber-500',
                          grade === 'D' && 'bg-orange-500',
                          grade === 'F' && 'bg-red-500'
                        )}
                      />
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg">{grade}</div>
                      <div className="text-xs text-muted-foreground">{count} students</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gradebook Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Grades
          </CardTitle>
          <CardDescription>
            View and manage student grades, send messages, and issue certificates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GradebookTable
            courseId={courseId!}
            assessments={assessments}
            onSendMessage={handleSendMessage}
            onIssueCertificate={handleIssueCertificate}
            onViewStudent={handleViewStudent}
          />
        </CardContent>
      </Card>

      {/* Message Dialog */}
      <StudentMessageDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        courseId={courseId!}
        studentIds={selectedStudentIds}
      />
    </div>
  );
}

// Summary card component
function SummaryCard({
  icon: Icon,
  label,
  value,
  iconColor,
  bgColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', bgColor)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
