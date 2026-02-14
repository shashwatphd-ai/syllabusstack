import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Play, Lock, AlertCircle, FileQuestion } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { useEnrolledCourseDetail } from '@/hooks/useStudentCourses';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/learn/courses')}
                className="mb-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Courses
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold">{course.title}</h1>
              {course.code && (
                <p className="text-muted-foreground font-mono text-sm">{course.code}</p>
              )}
            </div>
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
              <Progress value={progressPercent} className="h-3" />
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
            <Accordion type="multiple" className="space-y-4">
              {course.modules.map((module, index) => {
                const moduleLOs = module.learning_objectives;
                const moduleCompleted = moduleLOs.filter(lo =>
                  isComplete(lo.verification_state as VerificationState)
                ).length;
                const moduleProgress = moduleLOs.length > 0
                  ? (moduleCompleted / moduleLOs.length) * 100
                  : 0;

                return (
                  <AccordionItem 
                    key={module.id} 
                    value={module.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4 flex-1 text-left">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{module.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {moduleLOs.length} objectives • {moduleCompleted} completed
                          </p>
                        </div>
                        <div className="w-24">
                          <Progress value={moduleProgress} className="h-2" />
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-4 pb-2">
                        {moduleLOs.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No learning objectives in this module yet
                          </p>
                        ) : (
                          moduleLOs.map((lo) => {
                            const stateConfig = getStateConfig(lo.verification_state as VerificationState);
                            const StateIcon = stateIcons[lo.verification_state as keyof typeof stateIcons] || Clock;

                            return (
                              <Card
                                key={lo.id}
                                className="cursor-pointer hover:bg-accent/50 transition-colors"
                                onClick={() => navigate(`/learn/objective/${lo.id}`)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-full ${stateConfig.bgColor} ${stateConfig.color}`}>
                                      <StateIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{lo.text}</p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className="text-xs">
                                          {stateConfig.label}
                                        </Badge>
                                        {lo.bloom_level && (
                                          <Badge variant="secondary" className="text-xs capitalize">
                                            {lo.bloom_level}
                                          </Badge>
                                        )}
                                        {lo.expected_duration_minutes && (
                                          <span className="text-xs text-muted-foreground">
                                            ~{lo.expected_duration_minutes} min
                                          </span>
                                        )}
                                        {losWithQuestions?.has(lo.id) && (
                                          <Badge variant="outline" className="text-xs text-primary border-primary/30">
                                            <FileQuestion className="h-2.5 w-2.5 mr-0.5" />
                                            Quiz
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
