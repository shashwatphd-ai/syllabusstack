import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Users, Settings2, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useInstructorCourses, useCreateInstructorCourse } from '@/hooks/useInstructorCourses';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';

export default function InstructorCoursesPage() {
  const navigate = useNavigate();
  const { data: courses, isLoading } = useInstructorCourses();
  const createCourse = useCreateInstructorCourse();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <PageHeader title="Instructor Dashboard" />
          <LoadingState message="Loading your courses..." />
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader 
          title="Instructor Dashboard"
          description="Manage your courses, content, and student progress"
        />
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">Your Courses</h2>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Course
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
                className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-border/50"
                onClick={() => navigate(`/instructor/courses/${course.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      {course.code && (
                        <Badge variant="secondary" className="mb-2">{course.code}</Badge>
                      )}
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {course.title}
                      </CardTitle>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
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
      </PageContainer>
    </AppShell>
  );
}