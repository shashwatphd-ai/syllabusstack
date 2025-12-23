import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Play, Lock } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { useEnrolledCourseDetail } from '@/hooks/useStudentCourses';
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

const verificationStateConfig = {
  unstarted: { label: 'Not Started', color: 'bg-muted text-muted-foreground', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-warning/10 text-warning', icon: Play },
  verified: { label: 'Verified', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  assessment_unlocked: { label: 'Ready for Assessment', color: 'bg-primary/10 text-primary', icon: BookOpen },
  passed: { label: 'Passed', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  remediation_required: { label: 'Review Required', color: 'bg-destructive/10 text-destructive', icon: Lock },
};

export default function StudentCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading, error } = useEnrolledCourseDetail(id);

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

  // Calculate overall progress
  const allLOs = course.modules.flatMap(m => m.learning_objectives);
  const completedLOs = allLOs.filter(lo => 
    lo.verification_state === 'passed' || lo.verification_state === 'verified'
  );
  const progressPercent = allLOs.length > 0 
    ? (completedLOs.length / allLOs.length) * 100 
    : 0;

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
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
              <h1 className="text-2xl font-bold">{course.title}</h1>
              {course.code && (
                <p className="text-muted-foreground font-mono">{course.code}</p>
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
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No modules yet</h3>
                <p className="text-muted-foreground">
                  Your instructor hasn't added any modules to this course yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-4">
              {course.modules.map((module, index) => {
                const moduleLOs = module.learning_objectives;
                const moduleCompleted = moduleLOs.filter(lo => 
                  lo.verification_state === 'passed' || lo.verification_state === 'verified'
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
                            const stateConfig = verificationStateConfig[lo.verification_state as keyof typeof verificationStateConfig] 
                              || verificationStateConfig.unstarted;
                            const StateIcon = stateConfig.icon;

                            return (
                              <Card 
                                key={lo.id} 
                                className="cursor-pointer hover:bg-accent/50 transition-colors"
                                onClick={() => navigate(`/learn/objective/${lo.id}`)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-full ${stateConfig.color}`}>
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
