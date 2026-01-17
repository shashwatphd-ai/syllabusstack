import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Video, CheckCircle2, Clock, AlertCircle, Settings2, Copy, Share2, Loader2, Sparkles, Users, Presentation, RotateCcw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/common/ResponsiveDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useInstructorCourse, useModules, useCreateModule, useUpdateInstructorCourse } from '@/hooks/useInstructorCourses';
import { useLearningObjectives, useSearchYouTubeContent } from '@/hooks/useLearningObjectives';
import { useContentStats } from '@/hooks/useContentStats';
import { useLOContentStatus } from '@/hooks/useContentStats';
import { useCourseLectureSlides, useBulkPublishSlides, useBulkQueueSlides, useQueueStatus, useCleanupStuckSlides, useRetryFailedSlides } from '@/hooks/useLectureSlides';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { UnifiedModuleCard } from '@/components/instructor/UnifiedModuleCard';
import { UnifiedLOCard } from '@/components/instructor/UnifiedLOCard';
import { SyllabusUploader } from '@/components/instructor/SyllabusUploader';
import { OnboardingProgress } from '@/components/instructor/OnboardingProgress';
import { StudentProgressDashboard } from '@/components/instructor/StudentProgressDashboard';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

  // Memoize loIds to prevent unnecessary re-renders and query re-triggers
  const loIds = useMemo(
    () => learningObjectives?.map(lo => lo.id) ?? [],
    [learningObjectives]
  );
  
  // Get content stats for visibility fix - now with proper loading states
  const { data: contentStats, isLoading: contentStatsLoading } = useContentStats(loIds);
  const { data: loContentStatus, isLoading: loStatusLoading } = useLOContentStatus(loIds);

  // Get lecture slides stats
  const { data: lectureSlides } = useCourseLectureSlides(id);
  const bulkPublishSlides = useBulkPublishSlides();
  const bulkQueueSlides = useBulkQueueSlides();
  const { data: queueStatus } = useQueueStatus(id);
  const cleanupStuck = useCleanupStuckSlides();
  const retryFailed = useRetryFailedSlides();
  
  const slidesStats = {
    total: lectureSlides?.length || 0,
    ready: lectureSlides?.filter(s => s.status === 'ready').length || 0,
    published: lectureSlides?.filter(s => s.status === 'published').length || 0,
    pending: lectureSlides?.filter(s => s.status === 'pending').length || 0,
    generating: lectureSlides?.filter(s => s.status === 'generating').length || 0,
    failed: lectureSlides?.filter(s => s.status === 'failed').length || 0,
  };

  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [newModule, setNewModule] = useState({ title: '', description: '' });
  const [bulkSearching, setBulkSearching] = useState(false);
  const [publishValidationDialog, setPublishValidationDialog] = useState(false);

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

  // Validation checks for publishing
  const publishValidation = {
    hasModules: (modules?.length || 0) > 0,
    hasLOs: courseLOs.length > 0,
    hasApprovedContent: (contentStats?.approved || 0) > 0,
    allLOsHaveContent: courseLOs.every(lo => loContentStatus?.[lo.id]?.hasContent),
  };

  const canPublish = publishValidation.hasModules &&
    publishValidation.hasLOs &&
    publishValidation.hasApprovedContent;

  const handlePublishToggle = async () => {
    if (!id) return;

    // If trying to publish, validate first
    if (!course?.is_published && !canPublish) {
      setPublishValidationDialog(true);
      return;
    }

    await updateCourse.mutateAsync({
      courseId: id,
      updates: { is_published: !course?.is_published }
    });
  };

  const handleForcePublish = async () => {
    if (!id) return;
    setPublishValidationDialog(false);
    await updateCourse.mutateAsync({
      courseId: id,
      updates: { is_published: true }
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              className="self-start shrink-0"
              onClick={() => navigate('/instructor/courses')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {course.code && <Badge variant="secondary">{course.code}</Badge>}
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">{course.title}</h1>
                <Badge variant={course.is_published ? 'default' : 'outline'}>
                  {course.is_published ? 'Published' : 'Draft'}
                </Badge>
              </div>
              {course.description && (
                <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button 
                variant={course.is_published ? "outline" : "default"}
                onClick={handlePublishToggle}
                disabled={updateCourse.isPending}
                className="h-9"
              >
                {updateCourse.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                {course.is_published ? 'Unpublish' : 'Publish'}
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Onboarding Progress Banner */}
          {!course.is_published && (
            <OnboardingProgress steps={onboardingSteps} />
          )}

          {/* Access Code Banner - Using custom layout instead of Alert for interactive content */}
          {course.is_published && course.access_code && (
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-primary/50 bg-primary/5">
              <div className="flex items-center gap-3">
                <Share2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Course Published!</p>
                  <p className="text-sm text-muted-foreground">
                    Share this access code with your students: <strong className="font-mono text-base text-foreground">{course.access_code}</strong>
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={copyAccessCode} className="shrink-0">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          )}

          {/* Stats Cards - FIXED: Content counter now shows actual count */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{modules?.length || 0}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Modules</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-accent/10 rounded-lg shrink-0">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{courseLOs.length}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-tight">Learning Objectives</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-success/10 rounded-lg shrink-0">
                    <Video className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{contentStats?.approved || 0}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-tight">
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
              <CardContent className="p-4 sm:pt-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-purple-500/10 rounded-lg shrink-0">
                    <Presentation className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{slidesStats.published + slidesStats.ready}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-tight">
                      Lecture Slides
                    </p>
                    {(slidesStats.published > 0 || slidesStats.ready > 0) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {slidesStats.published > 0 && (
                          <span className="text-green-600">{slidesStats.published} published</span>
                        )}
                        {slidesStats.published > 0 && slidesStats.ready > 0 && ' • '}
                        {slidesStats.ready > 0 && (
                          <span className="text-amber-600">{slidesStats.ready} ready</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Unified View */}
          <Tabs defaultValue="course" className="space-y-4">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="course" className="gap-2 flex-1 sm:flex-none">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Course </span>Structure
              </TabsTrigger>
              <TabsTrigger value="students" className="gap-2 flex-1 sm:flex-none">
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
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h3 className="text-base sm:text-lg font-semibold">Modules & Learning Objectives</h3>
                    <div className="flex flex-wrap gap-2">
                      {/* Bulk Find All Content */}
                      {courseLOs.some(lo => !loContentStatus?.[lo.id]?.hasContent) && (
                        <Button 
                          variant="outline" 
                          className="gap-2 h-9 flex-1 sm:flex-none"
                          onClick={handleFindAllContent}
                          disabled={bulkSearching}
                        >
                          {bulkSearching ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="hidden sm:inline">Finding Content...</span>
                              <span className="sm:hidden">Finding...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              <span className="hidden sm:inline">Find All Content</span>
                              <span className="sm:hidden">Find All</span>
                            </>
                          )}
                        </Button>
                      )}
                      
                      {/* Generate All Slides - queue-based */}
                      {courseLOs.length > 0 && (
                        <Button 
                          variant="outline" 
                          className="gap-2 h-9 flex-1 sm:flex-none"
                          onClick={async () => {
                            if (!id) return;
                            // Fetch all teaching units for this course
                            const { data: allUnits } = await supabase
                              .from('teaching_units')
                              .select('id, learning_objectives!inner(instructor_course_id)')
                              .eq('learning_objectives.instructor_course_id', id);
                            
                            if (allUnits && allUnits.length > 0) {
                              bulkQueueSlides.mutate({
                                instructorCourseId: id,
                                teachingUnitIds: allUnits.map(u => u.id),
                              });
                            }
                          }}
                          disabled={bulkQueueSlides.isPending || (queueStatus?.generating || 0) > 0}
                        >
                          {bulkQueueSlides.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="hidden sm:inline">Queueing...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (queueStatus?.pending || 0) > 0 || (queueStatus?.generating || 0) > 0 ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="hidden sm:inline">
                                Generating ({queueStatus?.generating || 0} active, {queueStatus?.pending || 0} queued)
                              </span>
                              <span className="sm:hidden">
                                {queueStatus?.generating || 0}/{queueStatus?.pending || 0}
                              </span>
                            </>
                          ) : (
                            <>
                              <Presentation className="h-4 w-4" />
                              <span className="hidden sm:inline">Generate All Slides</span>
                              <span className="sm:hidden">Gen Slides</span>
                            </>
                          )}
                        </Button>
                      )}

                      {/* Bulk Publish Slides */}
                      {slidesStats.ready > 0 && (
                        <Button 
                          variant="outline" 
                          className="gap-2 h-9 flex-1 sm:flex-none"
                          onClick={() => id && bulkPublishSlides.mutate(id)}
                          disabled={bulkPublishSlides.isPending}
                        >
                          {bulkPublishSlides.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="hidden sm:inline">Publishing...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (
                          <>
                              <Presentation className="h-4 w-4" />
                              <span className="hidden sm:inline">Publish {slidesStats.ready} Ready Slides</span>
                              <span className="sm:hidden">Publish {slidesStats.ready}</span>
                            </>
                          )}
                        </Button>
                      )}
                      
                      {/* Retry Failed Slides */}
                      {slidesStats.failed > 0 && (
                        <Button 
                          variant="outline" 
                          className="gap-2 h-9 flex-1 sm:flex-none border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => id && retryFailed.mutate(id)}
                          disabled={retryFailed.isPending}
                        >
                          {retryFailed.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="hidden sm:inline">Retrying...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4" />
                              <span className="hidden sm:inline">Retry {slidesStats.failed} Failed</span>
                              <span className="sm:hidden">Retry {slidesStats.failed}</span>
                            </>
                          )}
                        </Button>
                      )}
                      
                      {/* Reset Stuck Slides - visible when generating for extended time */}
                      {slidesStats.generating > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="gap-1 text-muted-foreground"
                          onClick={() => cleanupStuck.mutate()}
                          disabled={cleanupStuck.isPending}
                          title="Reset slides stuck in generating state"
                        >
                          {cleanupStuck.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          <span className="text-xs">Stuck?</span>
                        </Button>
                      )}
                      
                      <ResponsiveDialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
                        <ResponsiveDialogTrigger asChild>
                          <Button className="gap-2 h-9">
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">Add Module</span>
                            <span className="sm:hidden">Add</span>
                          </Button>
                        </ResponsiveDialogTrigger>
                        <ResponsiveDialogContent>
                          <ResponsiveDialogHeader>
                            <ResponsiveDialogTitle>Create New Module</ResponsiveDialogTitle>
                            <ResponsiveDialogDescription>
                              Add a module to organize learning objectives.
                            </ResponsiveDialogDescription>
                          </ResponsiveDialogHeader>
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
                          <ResponsiveDialogFooter>
                            <Button variant="outline" onClick={() => setIsModuleDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleCreateModule} disabled={createModule.isPending}>
                              {createModule.isPending ? 'Creating...' : 'Create Module'}
                            </Button>
                          </ResponsiveDialogFooter>
                        </ResponsiveDialogContent>
                      </ResponsiveDialog>
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
              <StudentProgressDashboard courseId={id!} />
            </TabsContent>
          </Tabs>

          {/* Publish Validation Dialog */}
          <ResponsiveDialog open={publishValidationDialog} onOpenChange={setPublishValidationDialog}>
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  Course Not Ready to Publish
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  Your course is missing some required content. Please complete the following before publishing:
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <div className="space-y-3 py-4">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${publishValidation.hasModules ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {publishValidation.hasModules ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">Modules</p>
                    <p className="text-sm text-muted-foreground">
                      {publishValidation.hasModules
                        ? `${modules?.length} module(s) created`
                        : 'No modules created - upload a syllabus or add modules manually'}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${publishValidation.hasLOs ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {publishValidation.hasLOs ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">Learning Objectives</p>
                    <p className="text-sm text-muted-foreground">
                      {publishValidation.hasLOs
                        ? `${courseLOs.length} objective(s) extracted`
                        : 'No learning objectives - upload a syllabus to extract objectives'}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${publishValidation.hasApprovedContent ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {publishValidation.hasApprovedContent ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">Approved Content</p>
                    <p className="text-sm text-muted-foreground">
                      {publishValidation.hasApprovedContent
                        ? `${contentStats?.approved} video(s) approved`
                        : 'No content approved - find and approve videos for your objectives'}
                    </p>
                  </div>
                </div>

                {!publishValidation.allLOsHaveContent && publishValidation.hasLOs && (
                  <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/50 bg-warning/5">
                    <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-warning text-sm">Some objectives missing content</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Not all learning objectives have content matched. Students won't be able to complete objectives without content.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <ResponsiveDialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setPublishValidationDialog(false)}>
                  Go Back & Fix
                </Button>
                {publishValidation.hasModules && publishValidation.hasLOs && (
                  <Button
                    variant="destructive"
                    onClick={handleForcePublish}
                    disabled={updateCourse.isPending}
                  >
                    {updateCourse.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Publish Anyway
                  </Button>
                )}
              </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </PageContainer>
    </AppShell>
  );
}
