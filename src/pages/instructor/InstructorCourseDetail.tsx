import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Video, CheckCircle2, Clock, AlertCircle, Settings2 } from 'lucide-react';
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
import { useInstructorCourse, useCreateModule } from '@/hooks/useInstructorCourses';
import { useLearningObjectives, useExtractLearningObjectives } from '@/hooks/useLearningObjectives';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ModuleCard } from '@/components/instructor/ModuleCard';
import { ContentCurationPanel } from '@/components/instructor/ContentCurationPanel';

export default function InstructorCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading } = useInstructorCourse(id);
  const { data: learningObjectives } = useLearningObjectives();
  const createModule = useCreateModule();
  const extractLOs = useExtractLearningObjectives();

  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [newModule, setNewModule] = useState({ title: '', description: '' });
  const [syllabusText, setSyllabusText] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const handleCreateModule = async () => {
    if (!newModule.title.trim() || !id) return;
    await createModule.mutateAsync({
      instructor_course_id: id,
      title: newModule.title,
      description: newModule.description,
      sequence_order: (course?.modules?.length || 0) + 1,
    });
    setIsModuleDialogOpen(false);
    setNewModule({ title: '', description: '' });
  };

  const handleExtractLOs = async () => {
    if (!syllabusText.trim()) return;
    await extractLOs.mutateAsync({
      syllabusText,
      moduleId: selectedModuleId || undefined,
    });
    setIsSyllabusDialogOpen(false);
    setSyllabusText('');
    setSelectedModuleId(null);
  };

  // Filter LOs for this course's modules
  const courseLOs = learningObjectives?.filter(lo => 
    course?.modules?.some(m => m.id === lo.module_id)
  ) || [];

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
            <Button variant="outline" size="icon">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{course.modules?.length || 0}</p>
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
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Content Items</p>
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

          {/* Main Content */}
          <Tabs defaultValue="modules" className="space-y-4">
            <TabsList>
              <TabsTrigger value="modules">Modules & LOs</TabsTrigger>
              <TabsTrigger value="content">Content Curation</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
            </TabsList>

            <TabsContent value="modules" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Course Modules</h3>
                <div className="flex gap-2">
                  <Dialog open={isSyllabusDialogOpen} onOpenChange={setIsSyllabusDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Extract from Syllabus
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Extract Learning Objectives</DialogTitle>
                        <DialogDescription>
                          Paste your syllabus text to automatically extract learning objectives.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {course.modules && course.modules.length > 0 && (
                          <div className="space-y-2">
                            <Label>Assign to Module (Optional)</Label>
                            <select 
                              className="w-full p-2 border rounded-md bg-background"
                              value={selectedModuleId || ''}
                              onChange={(e) => setSelectedModuleId(e.target.value || null)}
                            >
                              <option value="">No module (course-level)</option>
                              {course.modules.map(m => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Syllabus Text</Label>
                          <Textarea
                            placeholder="Paste your syllabus content here..."
                            className="min-h-[200px]"
                            value={syllabusText}
                            onChange={(e) => setSyllabusText(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSyllabusDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleExtractLOs} disabled={extractLOs.isPending}>
                          {extractLOs.isPending ? 'Extracting...' : 'Extract LOs'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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

              {!course.modules || course.modules.length === 0 ? (
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
              ) : (
                <div className="space-y-4">
                  {course.modules
                    .sort((a, b) => a.sequence_order - b.sequence_order)
                    .map((module) => (
                      <ModuleCard 
                        key={module.id} 
                        module={module}
                        learningObjectives={learningObjectives?.filter(lo => lo.module_id === module.id) || []}
                      />
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="content">
              <ContentCurationPanel 
                courseId={id!}
                learningObjectives={courseLOs}
                curationMode={course.curation_mode || 'guided_auto'}
              />
            </TabsContent>

            <TabsContent value="students">
              <EmptyState
                icon={AlertCircle}
                title="No students enrolled"
                description="Students will appear here once they enroll in your course."
              />
            </TabsContent>
          </Tabs>
        </div>
      </PageContainer>
    </AppShell>
  );
}
