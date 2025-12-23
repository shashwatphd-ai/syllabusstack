import { BookOpen, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useStudentEnrollments } from '@/hooks/useStudentCourses';
import { StudentCourseCard, EnrollmentDialog } from '@/components/student';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

export default function StudentCoursesPage() {
  const { data: enrollments, isLoading, error } = useStudentEnrollments();

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="My Learning"
          description="Track your progress across enrolled courses"
          action={
            <EnrollmentDialog
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Join Course
                </Button>
              }
            />
          }
        />
        
        {isLoading ? (
          <LoadingState message="Loading your courses..." />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Failed to load courses</p>
          </div>
        ) : !enrollments || enrollments.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-8 w-8 text-muted-foreground" />}
            title="No courses yet"
            description="Join your first course using an access code from your instructor"
            action={
              <EnrollmentDialog
                trigger={
                  <Button size="lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Join Course
                  </Button>
                }
              />
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => (
              <StudentCourseCard key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
