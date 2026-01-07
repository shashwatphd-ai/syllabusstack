import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Video, CheckCircle2, Clock, AlertCircle, Settings2, Copy, Share2, Loader2, Sparkles, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useInstructorCourse, useModules, useCreateModule, useUpdateInstructorCourse } from '@/hooks/useInstructorCourses';
import { useLearningObjectives, useSearchYouTubeContent } from '@/hooks/useLearningObjectives';
import { useContentStats } from '@/hooks/useContentStats';
import { useLOContentStatus } from '@/hooks/useContentStats';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { UnifiedModuleCard } from '@/components/instructor/UnifiedModuleCard';
import { UnifiedLOCard } from '@/components/instructor/UnifiedLOCard';
import { SyllabusUploader } from '@/components/instructor/SyllabusUploader';
import { OnboardingProgress } from '@/components/instructor/OnboardingProgress';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function InstructorCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: course, isLoading: courseLoading } = useInstructorCourse(id);
  const { data: modules, isLoading: modulesLoading, refetch: refetchModules } = useModules(id);
  const { data: learningObjectives, refetch: refetchLOs } = useLearningObjectives(id);
  const createModule = useCreateModule();
  const updateCourse = useUpdateInstructorCourse();
  const searchContent = useSearchYouTubeContent();

  // Get content stats for visibility fix
  const loIds = learningObjectives?.map(lo => lo.id) || [];
  const { data: contentStats } = useContentStats(loIds);
  const { data: loContentStatus } = useLOContentStatus(loIds);

  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [newModule, setNewModule] = useState({ title: '', description: '' });
  const [bulkSearching, setBulkSearching] = useState(false);

  const isLoading = courseLoading || modulesLoading;

  const handleCreateModule = async () => {
    if (!newModule.title.trim() || !id) return;
    await createModule.mutateAsync({
      instructor_course_id: id,
      title: newModule.title,
      description: newModule.description,
      sequence_order: (modules?.length || 0) + 1,
    });
    setIsModuleDialogOpen(false);
    setNewModule({ title: '', description: '' });
  };

  // Bulk find content for all LOs without content
  const handleFindAllContent = async () => {
    const losWithoutContent = courseLOs.filter(lo => 
      !loContentStatus?.[lo.id]?.hasContent
    );
    
    if (losWithoutContent.length === 0) return;
    
    setBulkSearching(true);
    
    for (const lo of losWithoutContent) {
      try {
        await searchContent.mutateAsync(lo);
      } catch (e) {
        console.error('Error searching content for LO:', e);
      }
    }
    
    setBulkSearching(false);
  };

  const handleSyllabusProcessed = () => {
    refetchModules();
    refetchLOs();
    queryClient.invalidateQueries({ queryKey: ['content-stats'] });
  };

  // All LOs for this course (including those without a module)
  const courseLOs = learningObjectives || [];
  const unassignedLOs = courseLOs.filter(lo => !lo.module_id);
  const hasModulesOrLOs = (modules?.length || 0) > 0 || courseLOs.length > 0;

  // Onboarding steps calculation
  const onboardingSteps = [
    { 
      label: 'Upload Syllabus', 
      description: hasModulesOrLOs ? `${modules?.length || 0} modules` : undefined,
      completed: hasModulesOrLOs 
    },
    { 
      label: 'Review LOs', 
      description: courseLOs.length > 0 ? `${courseLOs.length} objectives` : undefined,
      completed: courseLOs.length > 0 
    },
    { 
      label: 'Find Content', 
      description: (contentStats?.total || 0) > 0 ? `${contentStats?.total || 0} videos found` : undefined,
      completed: (contentStats?.total || 0) > 0 
    },
    { 
      label: 'Approve Content', 
      description: (contentStats?.approved || 0) > 0 ? `${contentStats?.approved} approved` : undefined,
      completed: (contentStats?.approved || 0) > 0 
    },
    { 
      label: 'Publish', 
      completed: course?.is_published || false 
    },
  ];

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <LoadingState message="Loading course..." />
        </PageContainer>
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell>
        <PageContainer>
          <EmptyState
            icon={AlertCircle}
            title="Course not found"
            description="The course you're looking for doesn't exist."
            action={
              <Button onClick={() => navigate('/instructor/courses')}>
                Back to Courses
              </Button>
            }
          />
        </PageContainer>
      </AppShell>
    );
  }

  const handlePublishToggle = async () => {
    if (!id) return;
    await updateCourse.mutateAsync({
      courseId: id,
      updates: { is_published: !course?.is_published }
    });
  };

  const copyAccessCode = () => {
    if (course?.access_code) {
      navigator.clipboard.writeText(course.access_code);
      toast({
        title: "Copied!",
        description: "Access code copied to clipboard",
      });
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/instructor/courses')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {course.code && <Badge variant="secondary">{course.code}</Badge>}
                <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>
                <Badge variant={course.is_published ? 'default' : 'outline'}>
                  {course.is_published ? 'Published' : 'Draft'}
                </Badge>
              </div>
              {course.description && (
                <p className="text-muted-foreground mt-1">{course.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant={course.is_published ? "outline" : "default"}
                onClick={handlePublishToggle}
                disabled={updateCourse.isPending}
              >
                {updateCourse.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                {course.is_published ? 'Unpublish' : 'Publish'}
              </Button>
              <Button variant="outline" size="icon">
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Onboarding Progress Banner */}
          {!course.is_published && (
            <OnboardingProgress steps={onboardingSteps} />
          )}

          {/* Access Code Banner */}
          {course.is_published && course.access_code && (
            <Alert className="border-primary/50 bg-primary/5">
              <Share2 className="h-4 w-4" />
              <AlertTitle>Course Published!</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Share this access code with your students: <strong className="font-mono text-lg">{course.access_code}</strong>
                </span>
                <Button variant="outline" size="sm" onClick={copyAccessCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Stats Cards - FIXED: Content counter now shows actual count */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{modules?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Modules</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{courseLOs.length}</p>
                    <p className="text-sm text-muted-foreground">Learning Objectives</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <Video className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{contentStats?.approved || 0}</p>
                    <p className="text-sm text-muted-foreground">
                      Approved Content
                      {(contentStats?.pending || 0) > 0 && (
                        <span className="text-warning ml-1">({contentStats?.pending} pending)</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{course.verification_threshold}%</p>
                    <p className="text-sm text-muted-foreground">Pass Threshold</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Unified View */}
          <Tabs defaultValue="course" className="space-y-4">
            <TabsList>
              <TabsTrigger value="course" className="gap-2">
                <FileText className="h-4 w-4" />
                Course Structure
              </TabsTrigger>
              <TabsTrigger value="students" className="gap-2">
                <Users className="h-4 w-4" />
                Students
              </TabsTrigger>
            </TabsList>

            <TabsContent value="course" className="space-y-4">
              {/* Show syllabus uploader when no modules/LOs exist */}
              {!hasModulesOrLOs && (
                <SyllabusUploader 
                  courseId={id!} 
                  onSuccess={handleSyllabusProcessed}
                />
              )}

              {hasModulesOrLOs && (
                <>
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Modules & Learning Objectives</h3>
                    <div className="flex gap-2">
                      {/* Bulk Find All Content */}
                      {courseLOs.some(lo => !loContentStatus?.[lo.id]?.hasContent) && (
                        <Button 
                          variant="outline" 
                          className="gap-2"
                          onClick={handleFindAllContent}
                          disabled={bulkSearching}
                        >
                          {bulkSearching ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Finding Content...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Find All Content
                            </>
                          )}
                        </Button>
                      )}
                      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Module
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create New Module</DialogTitle>
                            <DialogDescription>
                              Add a module to organize learning objectives.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="module-title">Module Title</Label>
                              <Input
                                id="module-title"
                                placeholder="Module 1: Introduction"
                                value={newModule.title}
                                onChange={(e) => setNewModule(prev => ({ ...prev, title: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="module-desc">Description (Optional)</Label>
                              <Textarea
                                id="module-desc"
                                placeholder="Brief description of this module..."
                                value={newModule.description}
                                onChange={(e) => setNewModule(prev => ({ ...prev, description: e.target.value }))}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsModuleDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleCreateModule} disabled={createModule.isPending}>
                              {createModule.isPending ? 'Creating...' : 'Create Module'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Unassigned Learning Objectives - Using Unified Cards */}
                  {unassignedLOs.length > 0 && (
                    <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          Unassigned Learning Objectives ({unassignedLOs.length})
                        </CardTitle>
                        <CardDescription className="text-xs">
                          These objectives are not assigned to any module
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {unassignedLOs.map((lo) => (
                            <UnifiedLOCard
                              key={lo.id}
                              learningObjective={lo}
                              contentStatus={loContentStatus?.[lo.id] || {
                                hasContent: false,
                                pendingCount: 0,
                                approvedCount: 0,
                              }}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Modules with Unified Cards */}
                  {modules && modules.length > 0 ? (
                    <div className="space-y-4">
                      {modules
                        .sort((a, b) => a.sequence_order - b.sequence_order)
                        .map((module) => (
                          <UnifiedModuleCard 
                            key={module.id} 
                            module={module}
                            learningObjectives={learningObjectives?.filter(lo => lo.module_id === module.id) || []}
                          />
                        ))}
                    </div>
                  ) : unassignedLOs.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No modules yet"
                      description="Create modules to organize your learning objectives."
                      action={
                        <Button onClick={() => setIsModuleDialogOpen(true)} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Add Module
                        </Button>
                      }
                    />
                  ) : null}
                </>
              )}
            </TabsContent>

            <TabsContent value="students">
              <EmptyState
                icon={Users}
                title="No students enrolled"
                description="Students will appear here once they enroll using your course access code."
              />
            </TabsContent>
          </Tabs>
        </div>
      </PageContainer>
    </AppShell>
  );
}
