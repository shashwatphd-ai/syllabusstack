import { useState } from 'react';
import { BookOpen, Plus, CheckCircle2, Trash2, Download, X, CheckSquare } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useStudentEnrollments, useBulkUnenroll, useMarkCoursesCompleted } from '@/hooks/useStudentCourses';
import { StudentCourseCard, EnrollmentDialog } from '@/components/student';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function StudentCoursesPage() {
  const { data: enrollments, isLoading, error } = useStudentEnrollments();
  const bulkUnenroll = useBulkUnenroll();
  const markCompleted = useMarkCoursesCompleted();

  // Selection state
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Selection helpers
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedCourses);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCourses(newSet);
  };

  const selectAll = () => {
    setSelectedCourses(new Set(enrollments?.map(e => e.id) || []));
  };

  const clearSelection = () => {
    setSelectedCourses(new Set());
    setIsSelectionMode(false);
  };

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
  };

  // Actions
  const handleDropCourses = async () => {
    const ids = Array.from(selectedCourses);
    await bulkUnenroll.mutateAsync(ids);
    clearSelection();
    setShowDropConfirm(false);
  };

  const handleMarkCompleted = async () => {
    const ids = Array.from(selectedCourses);
    await markCompleted.mutateAsync(ids);
    clearSelection();
    setShowCompleteConfirm(false);
  };

  const handleExportProgress = () => {
    const selected = enrollments?.filter(e => selectedCourses.has(e.id)) || [];
    const csv = [
      ['Course', 'Code', 'Progress', 'Status', 'Enrolled'].join(','),
      ...selected.map(e => [
        `"${e.instructor_course.title}"`,
        e.instructor_course.code || '',
        `${e.overall_progress || 0}%`,
        e.completed_at ? 'Completed' : 'In Progress',
        new Date(e.enrolled_at).toLocaleDateString()
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-courses-progress.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount = selectedCourses.size;
  const allSelected = enrollments && enrollments.length > 0 && selectedCount === enrollments.length;

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="My Learning"
          description="Track your progress across enrolled courses"
          action={
            <div className="flex items-center gap-2">
              {enrollments && enrollments.length > 0 && !isSelectionMode && (
                <Button variant="outline" onClick={enterSelectionMode}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Select
                </Button>
              )}
              <EnrollmentDialog
                trigger={
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Join Course
                  </Button>
                }
              />
            </div>
          }
        />

        {/* Selection Toolbar */}
        {isSelectionMode && enrollments && enrollments.length > 0 && (
          <Card className="bg-primary/5 border-primary/20 sticky top-0 z-10 mb-6">
            <CardContent className="py-3 px-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => checked ? selectAll() : setSelectedCourses(new Set())}
                  />
                  <span className="text-sm font-medium">
                    {selectedCount} of {enrollments.length} selected
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedCount > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCompleteConfirm(true)}
                        disabled={markCompleted.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark Completed
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportProgress}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDropConfirm(true)}
                        disabled={bulkUnenroll.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Drop ({selectedCount})
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
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
              <StudentCourseCard 
                key={enrollment.id} 
                enrollment={enrollment}
                isSelectionMode={isSelectionMode}
                isSelected={selectedCourses.has(enrollment.id)}
                onToggleSelect={() => toggleSelection(enrollment.id)}
              />
            ))}
          </div>
        )}

        {/* Drop Courses Confirmation */}
        <AlertDialog open={showDropConfirm} onOpenChange={setShowDropConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Drop {selectedCount} Course{selectedCount > 1 ? 's' : ''}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove your enrollment and all progress from the selected course{selectedCount > 1 ? 's' : ''}. 
                You'll need to re-enroll with the access code to rejoin.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDropCourses}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bulkUnenroll.isPending ? 'Dropping...' : 'Drop Course' + (selectedCount > 1 ? 's' : '')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Mark Completed Confirmation */}
        <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark {selectedCount} Course{selectedCount > 1 ? 's' : ''} as Completed?</AlertDialogTitle>
              <AlertDialogDescription>
                This will set the progress to 100% and mark the course{selectedCount > 1 ? 's' : ''} as completed. 
                This action can help you organize your learning history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleMarkCompleted}>
                {markCompleted.isPending ? 'Updating...' : 'Mark Completed'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppShell>
  );
}
