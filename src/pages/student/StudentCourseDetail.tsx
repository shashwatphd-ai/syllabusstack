import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Play, Lock, AlertCircle, ChevronRight } from 'lucide-react';
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
  const allLOs = course.modules.flatMap(m => m.learning_objectives);
  const completedLOs = allLOs.filter(lo =>
    isComplete(lo.verification_state as VerificationState)
  );
  const progressPercent = allLOs.length > 0
    ? (completedLOs.length / allLOs.length) * 100
    : 0;

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-5">
          {/* Header with integrated progress */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/learn?tab=active')}
              className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              My Courses
            </Button>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold leading-tight">{course.title}</h1>
                {course.code && (
                  <p className="text-muted-foreground font-mono text-sm">{course.code}</p>
                )}
              </div>
              <div className="flex items-center gap-3 sm:text-right">
                <div className="flex-1 sm:flex-none">
                  <p className="text-xs text-muted-foreground">
                    {completedLOs.length}/{allLOs.length} objectives
                  </p>
                  <Progress value={progressPercent} className="h-2 w-32 mt-1" />
                </div>
                <span className="text-2xl font-bold text-primary">
                  {Math.round(progressPercent)}%
                </span>
              </div>
            </div>
          </div>

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
                      <div className="space-y-1 pt-2 pb-2">
                        {moduleLOs.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No learning objectives in this module yet
                          </p>
                        ) : (
                          moduleLOs.map((lo) => {
                            const stateConfig = getStateConfig(lo.verification_state as VerificationState);
                            const StateIcon = stateIcons[lo.verification_state as keyof typeof stateIcons] || Clock;
                            const completed = isComplete(lo.verification_state as VerificationState);

                            return (
                              <div
                                key={lo.id}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group ${
                                  completed
                                    ? "bg-green-50 dark:bg-green-500/5 hover:bg-green-100 dark:hover:bg-green-500/10"
                                    : "hover:bg-accent/50"
                                }`}
                                onClick={() => navigate(`/learn/objective/${lo.id}`)}
                              >
                                <div className={`p-1.5 rounded-full shrink-0 ${stateConfig.bgColor} ${stateConfig.color}`}>
                                  <StateIcon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${completed ? "text-muted-foreground line-through" : "font-medium"}`}>
                                    {lo.text}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {!completed && (
                                      <span className={`text-[11px] font-medium ${stateConfig.color}`}>
                                        {stateConfig.label}
                                      </span>
                                    )}
                                    {lo.bloom_level && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                                        {lo.bloom_level}
                                      </Badge>
                                    )}
                                    {lo.expected_duration_minutes && (
                                      <span className="text-[11px] text-muted-foreground">
                                        ~{lo.expected_duration_minutes} min
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
