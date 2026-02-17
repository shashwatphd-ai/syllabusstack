import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Play, AlertCircle, FileQuestion, Bookmark, LayoutList } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { useEnrolledCourseDetail } from '@/hooks/useStudentCourses';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  getStateConfig,
  isComplete,
  type VerificationState,
} from '@/lib/verification-state-machine';

// Icon mapping for verification states
const stateIcons = {
  unstarted: Clock,
  in_progress: Play,
  verified: CheckCircle2,
  assessment_unlocked: BookOpen,
  passed: CheckCircle2,
  remediation_required: AlertCircle,
};

/** Extract a module number from title like "Module 1: Strategy..." → 1, else null */
function extractModuleNumber(title: string): number | null {
  const match = title.match(/^Module\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export default function StudentCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading, error } = useEnrolledCourseDetail(id);

  // Compute loIds defensively before any conditional returns
  const allLOs = course?.modules.flatMap(m => m.learning_objectives) ?? [];
  const loIds = allLOs.map(lo => lo.id);

  // This hook must be called unconditionally (before any early returns)
  const { data: losWithQuestions } = useQuery({
    queryKey: ['lo-question-availability', loIds.join(',')],
    queryFn: async () => {
      if (loIds.length === 0) return new Set<string>();
      const { data } = await supabase
        .from('assessment_questions')
        .select('learning_objective_id')
        .in('learning_objective_id', loIds);
      return new Set((data || []).map(d => d.learning_objective_id));
    },
    enabled: loIds.length > 0,
  });

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <LoadingState message="Loading course..." />
        </PageContainer>
      </AppShell>
    );
  }

  if (error || !course) {
    return (
      <AppShell>
        <PageContainer>
          <div className="text-center py-12">
            <p className="text-destructive mb-4">
              {error instanceof Error ? error.message : 'Course not found'}
            </p>
            <Button variant="outline" onClick={() => navigate('/learn/courses')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Button>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  // Calculate overall progress using state machine
  const completedLOs = allLOs.filter(lo =>
    isComplete(lo.verification_state as VerificationState)
  );
  const progressPercent = allLOs.length > 0
    ? (completedLOs.length / allLOs.length) * 100
    : 0;

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/learn/courses')}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
            {course.code && (
              <p className="text-muted-foreground font-mono text-sm">{course.code}</p>
            )}
          </div>

          {/* Progress Overview */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Course Progress</h3>
                  <p className="text-sm text-muted-foreground">
                    {completedLOs.length} of {allLOs.length} learning objectives completed
                  </p>
                </div>
                <span className="text-2xl font-bold text-primary">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="relative">
                <Progress value={progressPercent} className="h-3 [&>div]:bg-primary bg-muted/40" />
              </div>
            </CardContent>
          </Card>

          {/* Modules */}
          {course.modules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Course content coming soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  Your instructor is preparing the course materials. Learning modules and objectives will appear here once they're ready.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Check back later for updates</span>
                </div>
              </CardContent>
            </Card>
          ) : allLOs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No learning objectives yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  The course has {course.modules.length} module(s) but no learning objectives have been added yet.
                  Your instructor needs to upload a syllabus or add objectives manually.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Section header */}
              <div className="flex items-center gap-2">
                <LayoutList className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Modules
                </h2>
              </div>

              <Accordion type="multiple" className="space-y-3">
                {course.modules.map((module) => {
                  const moduleLOs = module.learning_objectives;
                  const moduleCompleted = moduleLOs.filter(lo =>
                    isComplete(lo.verification_state as VerificationState)
                  ).length;
                  const moduleProgress = moduleLOs.length > 0
                    ? (moduleCompleted / moduleLOs.length) * 100
                    : 0;

                  // Smart numbering: extract from title or show icon
                  const titleModuleNum = extractModuleNumber(module.title);
                  const isGenericModule = !titleModuleNum; // e.g. "Course Objectives"

                  return (
                    <AccordionItem 
                      key={module.id} 
                      value={module.id}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-4 flex-1 text-left">
                          {/* Module icon/number */}
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                            {isGenericModule ? (
                              <Bookmark className="h-4 w-4" />
                            ) : (
                              <span className="text-sm font-bold">{titleModuleNum}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{module.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {moduleLOs.length} objective{moduleLOs.length !== 1 ? 's' : ''} · {moduleCompleted} completed
                            </p>
                          </div>
                          <div className="w-20 shrink-0">
                            <Progress value={moduleProgress} className="h-1.5 [&>div]:bg-primary bg-muted/40" />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pt-3 pb-2">
                          {moduleLOs.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No learning objectives in this module yet
                            </p>
                          ) : (
                            moduleLOs.map((lo) => {
                              const stateConfig = getStateConfig(lo.verification_state as VerificationState);
                              const StateIcon = stateIcons[lo.verification_state as keyof typeof stateIcons] || Clock;

                              return (
                                <div
                                  key={lo.id}
                                  className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent/10 transition-colors border border-border/50"
                                  onClick={() => navigate(`/learn/objective/${lo.id}`)}
                                >
                                  <div className={`p-1.5 rounded-full ${stateConfig.bgColor} ${stateConfig.color} shrink-0 mt-0.5`}>
                                    <StateIcon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium leading-snug">{lo.text}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                        {stateConfig.label}
                                      </Badge>
                                      {lo.bloom_level && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                                          {lo.bloom_level}
                                        </Badge>
                                      )}
                                      {lo.expected_duration_minutes && (
                                        <span className="text-[10px] text-muted-foreground">
                                          ~{lo.expected_duration_minutes} min
                                        </span>
                                      )}
                                      {losWithQuestions?.has(lo.id) && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-primary border-primary/30">
                                          <FileQuestion className="h-2.5 w-2.5 mr-0.5" />
                                          Quiz
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
