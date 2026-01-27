import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Users, ChevronRight, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { VerificationBanner, useVerificationStatus } from '@/components/instructor/VerificationBanner';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useInstructorCourses, useCreateInstructorCourse, useDeleteInstructorCourse, useDuplicateInstructorCourse } from '@/hooks/useInstructorCourses';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';

export default function InstructorCoursesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const verificationStatus = useVerificationStatus();
  const { data: courses, isLoading } = useInstructorCourses();
  const createCourse = useCreateInstructorCourse();
  const deleteCourse = useDeleteInstructorCourse();
  const duplicateCourse = useDuplicateInstructorCourse();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<{ id: string; title: string } | null>(null);
  
  const [newCourse, setNewCourse] = useState({ 
    title: '', 
    code: '', 
    description: '',
    curation_mode: 'guided_auto' as const,
    verification_threshold: 70,
    is_published: false,
    access_code: null as string | null,
  });

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim()) return;
    await createCourse.mutateAsync({
      title: newCourse.title,
      code: newCourse.code || null,
      description: newCourse.description || null,
      curation_mode: newCourse.curation_mode,
      verification_threshold: newCourse.verification_threshold,
      is_published: newCourse.is_published,
      access_code: newCourse.access_code,
    });
    setIsCreateOpen(false);
    setNewCourse({ 
      title: '', 
      code: '', 
      description: '',
      curation_mode: 'guided_auto',
      verification_threshold: 70,
      is_published: false,
      access_code: null,
    });
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    await deleteCourse.mutateAsync(courseToDelete.id);
    setDeleteDialogOpen(false);
    setCourseToDelete(null);
  };

  const handleDuplicateCourse = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await duplicateCourse.mutateAsync(courseId);
  };

  const openDeleteDialog = (course: { id: string; title: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setCourseToDelete(course);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <LoadingState message="Loading your courses..." />
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        {/* Verification Banner for unverified/pending instructors */}
        {verificationStatus !== 'approved' && (
          <VerificationBanner variant={verificationStatus} className="mb-6" />
        )}

        <p className="text-muted-foreground mb-4">
          Manage your courses, content, and student progress
        </p>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">Your Courses</h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="default" className="gap-2 min-h-11 w-full sm:w-auto" onClick={() => navigate('/instructor/quick-setup')}>
              <Plus className="h-4 w-4" />
              Quick Setup (AI)
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 min-h-11 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Manual Setup
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Course</DialogTitle>
                  <DialogDescription>
                    Enter your course details. You'll add learning objectives and curate video content in the next step.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Course Title <span className="text-destructive">*</span></Label>
                    <Input
                      id="title"
                      placeholder="e.g., Strategic Management"
                      value={newCourse.title}
                      onChange={(e) => setNewCourse(prev => ({ ...prev, title: e.target.value }))}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">The name students will see</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="code">Course Code</Label>
                    <Input
                      id="code"
                      placeholder="e.g., MGT471"
                      value={newCourse.code}
                      onChange={(e) => setNewCourse(prev => ({ ...prev, code: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Optional identifier for your records</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="What will students learn in this course?"
                      value={newCourse.description}
                      onChange={(e) => setNewCourse(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">What happens next?</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Add or paste your syllabus to extract learning objectives</li>
                    <li>Review and curate video content for each objective</li>
                    <li>Publish when ready for students to enroll</li>
                  </ol>
                </div>
                
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleCreateCourse} 
                    disabled={createCourse.isPending || !newCourse.title.trim()}
                  >
                    {createCourse.isPending ? 'Creating...' : 'Create Course'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!courses || courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Create your first course to start managing learning content."
            action={
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Course
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card 
                key={course.id} 
                className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-border/50 relative"
                onClick={() => navigate(`/instructor/courses/${course.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0 pr-2">
                      {course.code && (
                        <Badge variant="secondary" className="mb-2">{course.code}</Badge>
                      )}
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {course.title}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Course actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={(e) => handleDuplicateCourse(course.id, e)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => openDeleteDialog({ id: course.id, title: course.title }, e)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                  {course.description && (
                    <CardDescription className="line-clamp-2">
                      {course.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" />
                      <span>--</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>--</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant={course.is_published ? 'default' : 'outline'}>
                      {course.is_published ? 'Published' : 'Draft'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {course.curation_mode === 'full_control' ? 'Full Control' :
                       course.curation_mode === 'hands_off' ? 'Hands Off' : 'Guided Auto'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Course</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{courseToDelete?.title}"? This action cannot be undone.
                All modules, learning objectives, and content associations will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCourseToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteCourse}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteCourse.isPending}
              >
                {deleteCourse.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppShell>
  );
}
