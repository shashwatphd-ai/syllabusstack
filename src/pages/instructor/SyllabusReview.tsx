import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Edit2, Save, GraduationCap, Loader2, ArrowRight, FileText } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useInstructorCourse, useModules, useUpdateInstructorCourse } from '@/hooks/useInstructorCourses';
import { useLearningObjectives } from '@/hooks/useLearningObjectives';

const bloomColors: Record<string, string> = {
  remember: 'bg-blue-100 text-blue-800 border-blue-200',
  understand: 'bg-green-100 text-green-800 border-green-200',
  apply: 'bg-amber-100 text-amber-800 border-amber-200',
  analyze: 'bg-orange-100 text-orange-800 border-orange-200',
  evaluate: 'bg-red-100 text-red-800 border-red-200',
  create: 'bg-purple-100 text-purple-800 border-purple-200',
};

export default function SyllabusReviewPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading: loadingCourse } = useInstructorCourse(courseId);
  const { data: modules, isLoading: loadingModules } = useModules(courseId);
  const { data: los, isLoading: loadingLOs } = useLearningObjectives(courseId);
  const updateCourse = useUpdateInstructorCourse();

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (course) {
      setEditTitle(course.title || '');
      setEditDescription(course.description || '');
    }
  }, [course]);

  const handleSave = () => {
    if (!courseId) return;
    updateCourse.mutate(
      { courseId, updates: { title: editTitle, description: editDescription } },
      { onSuccess: () => setEditing(false) }
    );
  };

  const isLoading = loadingCourse || loadingModules || loadingLOs;

  // Group LOs by module
  const losByModule = (los || []).reduce<Record<string, typeof los>>((acc, lo) => {
    const key = (lo as any).module_id || 'unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(lo);
    return acc;
  }, {});

  // Bloom distribution
  const bloomDist = (los || []).reduce<Record<string, number>>((acc, lo) => {
    const level = ((lo as any).bloom_level || 'unknown').toLowerCase();
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell>
        <PageContainer>
          <p className="text-muted-foreground py-10 text-center">Course not found.</p>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Review Parsed Syllabus</h1>
              <p className="text-sm text-muted-foreground">Verify and edit the extracted course data before proceeding</p>
            </div>
            <Button onClick={() => navigate(`/instructor/courses/${courseId}`)} className="gap-2">
              <ArrowRight className="h-4 w-4" /> Continue to Course
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 flex flex-col items-center gap-1">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{modules?.length || 0}</span>
                <span className="text-xs text-muted-foreground">Modules</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex flex-col items-center gap-1">
                <BookOpen className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{los?.length || 0}</span>
                <span className="text-xs text-muted-foreground">Learning Objectives</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex flex-col items-center gap-1">
                <GraduationCap className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{Object.keys(bloomDist).length}</span>
                <span className="text-xs text-muted-foreground">Bloom Levels</span>
              </CardContent>
            </Card>
          </div>

          {/* Course Title & Description */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Course Information</CardTitle>
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setEditing(!editing)}>
                  {editing ? <Save className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
                  {editing ? 'Cancel' : 'Edit'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="mt-1" rows={3} />
                  </div>
                  <Button size="sm" onClick={handleSave} disabled={updateCourse.isPending} className="gap-1">
                    {updateCourse.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold">{course.title}</h3>
                  {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
                  {course.code && <Badge variant="outline" className="text-xs">{course.code}</Badge>}
                </>
              )}
            </CardContent>
          </Card>

          {/* Bloom Level Distribution */}
          {Object.keys(bloomDist).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bloom's Taxonomy Distribution</CardTitle>
                <CardDescription className="text-xs">Cognitive complexity of extracted learning objectives</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(bloomDist)
                    .sort(([, a], [, b]) => b - a)
                    .map(([level, count]) => (
                      <Badge key={level} variant="outline" className={`text-xs capitalize ${bloomColors[level] || ''}`}>
                        {level}: {count}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Modules & Learning Objectives */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Course Structure
            </h2>

            {modules && modules.length > 0 ? (
              modules.map((mod, idx) => {
                const moduleLOs = losByModule[mod.id] || [];
                return (
                  <Card key={mod.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">M{idx + 1}</Badge>
                        <CardTitle className="text-sm">{mod.title}</CardTitle>
                      </div>
                      {mod.description && (
                        <CardDescription className="text-xs">{mod.description}</CardDescription>
                      )}
                    </CardHeader>
                    {moduleLOs.length > 0 && (
                      <CardContent className="pt-0">
                        <ul className="space-y-2">
                          {moduleLOs.map((lo: any, loIdx: number) => (
                            <li key={lo.id} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <span className="text-muted-foreground">{lo.text || lo.objective_text}</span>
                                {lo.bloom_level && (
                                  <Badge variant="outline" className={`ml-2 text-[10px] capitalize ${bloomColors[lo.bloom_level?.toLowerCase()] || ''}`}>
                                    {lo.bloom_level}
                                  </Badge>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No modules extracted. The syllabus may need re-processing.
                </CardContent>
              </Card>
            )}

            {/* Unassigned LOs */}
            {losByModule['unassigned'] && losByModule['unassigned'].length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Unassigned Objectives</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {losByModule['unassigned'].map((lo: any) => (
                      <li key={lo.id} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{lo.text || lo.objective_text}</span>
                        {lo.bloom_level && (
                          <Badge variant="outline" className={`text-[10px] capitalize ${bloomColors[lo.bloom_level?.toLowerCase()] || ''}`}>
                            {lo.bloom_level}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
