import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PlayCircle, CheckCircle2, Clock, ChevronDown, ChevronRight, ClipboardCheck, XCircle, Presentation, Award, AlertTriangle, Eye, BookOpen, GraduationCap, Lightbulb } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLearningObjectiveProgress } from '@/hooks/useStudentCourses';
import { useMicroChecks, useMicroCheckResults } from '@/hooks/useAssessment';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerifiedVideoPlayer } from '@/components/player/VerifiedVideoPlayer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StudentSlideViewer } from '@/components/slides/StudentSlideViewer';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTeachingUnits } from '@/hooks/useTeachingUnits';
import type { TeachingUnit } from '@/hooks/useTeachingUnits';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { LectureSlide, Slide } from '@/hooks/useLectureSlides';
import type { VerificationState } from '@/lib/verification-state-machine';

// Step indicator configuration
const PIPELINE_STEPS = [
  { key: 'watch', label: 'Watch', icon: Eye },
  { key: 'verify', label: 'Verify', icon: CheckCircle2 },
  { key: 'assess', label: 'Assess', icon: BookOpen },
  { key: 'mastered', label: 'Mastered', icon: GraduationCap },
] as const;

function getActiveStep(state: string | null | undefined): number {
  switch (state) {
    case 'unstarted': return 0;
    case 'in_progress': return 0;
    case 'verified': return 2;
    case 'assessment_unlocked': return 2;
    case 'passed': return 3;
    case 'remediation_required': return 1;
    default: return 0;
  }
}

function getCompletedSteps(state: string | null | undefined): Set<number> {
  const s = new Set<number>();
  switch (state) {
    case 'passed': s.add(0); s.add(1); s.add(2); s.add(3); break;
    case 'assessment_unlocked': s.add(0); s.add(1); break;
    case 'verified': s.add(0); s.add(1); break;
    case 'in_progress': break;
    case 'remediation_required': s.add(0); break;
  }
  return s;
}

/** Match score badge with color coding */
function MatchBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let classes = 'text-[11px] px-1.5 py-0.5 font-semibold rounded-md ';
  if (pct >= 70) classes += 'bg-success/15 text-success border border-success/30';
  else if (pct >= 50) classes += 'bg-warning/15 text-warning border border-warning/30';
  else classes += 'bg-muted/30 text-muted-foreground border border-border';
  return <span className={classes}>{pct}% match</span>;
}

export default function LearningObjectivePage() {
  const { loId } = useParams<{ loId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, error } = useLearningObjectiveProgress(loId);
  const { data: teachingUnits } = useTeachingUnits(loId);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingSlide, setViewingSlide] = useState<LectureSlide | null>(null);

  // State recovery: fix verification_state if slides were completed before state-tracking was deployed
  useEffect(() => {
    if (!data || !user || !loId) return;
    const currentState = data.learningObjective.verification_state || 'unstarted';
    if (currentState !== 'unstarted' && currentState !== 'in_progress') return;

    const checkAndRecover = async () => {
      const { data: completions } = await supabase
        .from('slide_completions')
        .select('watch_percentage')
        .eq('user_id', user.id)
        .eq('learning_objective_id', loId)
        .gte('watch_percentage', 80)
        .limit(1);

      if (completions && completions.length > 0) {
        await supabase
          .from('learning_objectives')
          .update({ verification_state: 'verified', updated_at: new Date().toISOString() })
          .eq('id', loId);
        queryClient.invalidateQueries({ queryKey: ['lo-progress', loId] });
      }
    };
    checkAndRecover();
  }, [data, user, loId, queryClient]);

  // Fetch course + module context for breadcrumb
  const { data: breadcrumbContext } = useQuery({
    queryKey: ['lo-breadcrumb', data?.learningObjective?.instructor_course_id, data?.learningObjective?.module_id],
    queryFn: async () => {
      const lo = data!.learningObjective;
      const courseId = lo.instructor_course_id;
      const moduleId = lo.module_id;
      let courseName = '';
      let moduleName = '';
      if (courseId) {
        const { data: c } = await supabase.from('instructor_courses').select('title').eq('id', courseId).single();
        courseName = c?.title || '';
      }
      if (moduleId) {
        const { data: m } = await supabase.from('modules').select('title').eq('id', moduleId).single();
        moduleName = m?.title || '';
      }
      return { courseName, moduleName, courseId };
    },
    enabled: !!data?.learningObjective?.instructor_course_id,
  });

  // Fetch published slides for this learning objective, ordered by teaching unit sequence
  const { data: lectureSlides } = useQuery({
    queryKey: ['lo-published-slides', loId],
    queryFn: async () => {
      if (!loId) return [];
      
      const { data, error } = await supabase
        .from('lecture_slides')
        .select(`
          *,
          teaching_unit:teaching_units!teaching_unit_id (
            sequence_order
          )
        `)
        .eq('learning_objective_id', loId)
        .eq('status', 'published');
      
      if (error) throw error;
      
      const sortedData = (data || []).sort((a, b) => {
        const aOrder = (a.teaching_unit as any)?.sequence_order ?? 999;
        const bOrder = (b.teaching_unit as any)?.sequence_order ?? 999;
        return aOrder - bOrder;
      });
      
      return sortedData.map(slide => ({
        ...slide,
        slides: (slide.slides as unknown as Slide[]) || [],
      })) as LectureSlide[];
    },
    enabled: !!loId,
  });

  // Get micro-checks for selected content
  const { data: microChecks } = useMicroChecks(selectedContentId || undefined);
  
  // Get current consumption record for selected content
  const selectedConsumptionRecord = data?.consumptionRecords.find(
    r => r.content_id === selectedContentId
  );
  
  // Get micro-check results for this consumption record
  const { data: microCheckResults } = useMicroCheckResults(selectedConsumptionRecord?.id);

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <LoadingState message="Loading learning objective..." />
        </PageContainer>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <PageContainer>
          <div className="text-center py-12">
            <p className="text-destructive mb-4">
              {error instanceof Error ? error.message : 'Learning objective not found'}
            </p>
            <Button variant="outline" onClick={() => navigate('/learn')}>
              Go Back
            </Button>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  const { learningObjective, matchedContent, consumptionRecords } = data;
  const selectedContent = matchedContent.find(m => m.content?.id === selectedContentId)?.content;

  // Sort matched content by match_score descending for ranked display
  const rankedContent = [...matchedContent].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

  // Group content by teaching unit
  const contentByUnit = (() => {
    const map = new Map<string | null, { videos: typeof rankedContent; slides: typeof lectureSlides }>();

    for (const match of rankedContent) {
      const tuId = match.teaching_unit_id || null;
      if (!map.has(tuId)) map.set(tuId, { videos: [], slides: [] });
      map.get(tuId)!.videos.push(match);
    }

    for (const slide of (lectureSlides || [])) {
      const tuId = (slide as any).teaching_unit_id || null;
      if (!map.has(tuId)) map.set(tuId, { videos: [], slides: [] });
      map.get(tuId)!.slides.push(slide);
    }

    return map;
  })();

  const hasTeachingUnits = teachingUnits && teachingUnits.length > 0;
  const unlinkedContent = contentByUnit.get(null);

  // Video type labels for badges
  const VIDEO_TYPE_LABELS: Record<string, string> = {
    explainer: 'Explainer',
    tutorial: 'Tutorial',
    case_study: 'Case Study',
    worked_example: 'Worked Example',
    lecture: 'Lecture',
    demonstration: 'Demo',
  };

  // Get consumption status for each content
  const getContentStatus = (contentId: string) => {
    const record = consumptionRecords.find(r => r.content_id === contentId);
    if (!record) return { status: 'not_started', icon: PlayCircle, color: 'text-muted-foreground' };
    if (record.is_verified) return { status: 'verified', icon: CheckCircle2, color: 'text-success' };
    if (record.watch_percentage && record.watch_percentage > 0) {
      return { status: 'in_progress', icon: Clock, color: 'text-warning' };
    }
    return { status: 'not_started', icon: PlayCircle, color: 'text-muted-foreground' };
  };

  const handleVideoComplete = async (engagementScore: number, isVerified: boolean) => {
    if (isVerified) {
      await queryClient.invalidateQueries({ queryKey: ['lo-progress', loId] });
      if (selectedConsumptionRecord?.id) {
        await queryClient.invalidateQueries({ queryKey: ['micro-check-results', selectedConsumptionRecord.id] });
      }
      await queryClient.invalidateQueries({ queryKey: ['skill-profile'] });
    }
  };

  const playerMicroChecks = microChecks?.map(mc => ({
    id: mc.id,
    trigger_time_seconds: mc.trigger_time_seconds,
    question_text: mc.question_text,
    question_type: mc.question_type as 'recall' | 'mcq',
    options: mc.options as { text: string }[] | undefined,
    rewind_target_seconds: mc.rewind_target_seconds || undefined,
    time_limit_seconds: mc.time_limit_seconds || undefined,
  })) || [];

  // Step indicator state
  const activeStep = getActiveStep(learningObjective.verification_state);
  const completedSteps = getCompletedSteps(learningObjective.verification_state);

  // Module number for hierarchical slide numbering
  const moduleNumMatch = breadcrumbContext?.moduleName?.match(/Module\s+(\d+)/i);
  const moduleNum = moduleNumMatch ? parseInt(moduleNumMatch[1], 10) : null;

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbContext?.courseName && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      asChild
                      className="cursor-pointer text-xs"
                    >
                      <span onClick={() => navigate(`/learn/course/${breadcrumbContext.courseId}`)}>
                        {breadcrumbContext.courseName}
                      </span>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-3 w-3" />
                  </BreadcrumbSeparator>
                </>
              )}
              {breadcrumbContext?.moduleName && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink className="text-xs">
                      {breadcrumbContext.moduleName}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-3 w-3" />
                  </BreadcrumbSeparator>
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage className="text-xs font-medium truncate max-w-[200px]">
                  Current Objective
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Title + badges */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">{learningObjective.text}</h1>
            <div className="flex items-center gap-2 mt-2">
              {learningObjective.bloom_level && (
                <Badge variant="secondary" className="capitalize text-xs">
                  {learningObjective.bloom_level}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {learningObjective.verification_state?.replace('_', ' ') || 'Not Started'}
              </Badge>
            </div>
          </div>

          {/* Progress Flow Indicator */}
          <div className="flex items-center gap-0 w-full overflow-x-auto pb-1">
            {PIPELINE_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isCompleted = completedSteps.has(i);
              const isActive = activeStep === i && !isCompleted;
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCompleted
                        ? 'bg-success border-success text-success-foreground'
                        : isActive
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-muted/30 border-border text-muted-foreground'
                    }`}>
                      <StepIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${
                      isCompleted ? 'text-success' : isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mt-[-14px] ${
                      completedSteps.has(i) && (completedSteps.has(i + 1) || activeStep > i)
                        ? 'bg-success'
                        : 'bg-border'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Video Player (full width, only when selected) */}
          {selectedContent && (
            <div className="space-y-4">
              <div className="relative">
                <VerifiedVideoPlayer
                  contentId={selectedContent.id}
                  learningObjectiveId={loId!}
                  videoUrl={selectedContent.source_url || ''}
                  title={selectedContent.title}
                  duration={selectedContent.duration_seconds || 600}
                  microChecks={playerMicroChecks}
                  onComplete={handleVideoComplete}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm"
                  onClick={() => setSelectedContentId(null)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </div>
              
              {/* Micro-Check History */}
              {microCheckResults && microCheckResults.length > 0 && (
                <Card>
                  <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-sm font-medium">
                              Micro-Check History ({microCheckResults.length})
                            </CardTitle>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-2">
                        {microCheckResults.map((result: any) => (
                          <div 
                            key={result.id} 
                            className="flex items-start justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {result.micro_check?.question_text || 'Question'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Your answer: {result.user_answer || 'N/A'}
                              </p>
                            </div>
                            <Badge variant={result.is_correct ? 'default' : 'destructive'} className="ml-2">
                              {result.is_correct ? 'Correct' : 'Incorrect'}
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}
            </div>
          )}

          {/* Content Sections */}
          <div className="space-y-4">
            {hasTeachingUnits ? (
              <>
                {/* Learning Path Header with total time */}
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Learning Path
                  </h2>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {teachingUnits!.length} units · ~{teachingUnits!.reduce((sum, u) => sum + (u.target_duration_minutes || 0), 0)} min total
                  </span>
                </div>

                {/* Teaching Unit Cards */}
                {teachingUnits!.map((unit) => {
                  const unitContent = contentByUnit.get(unit.id);
                  const unitVideos = unitContent?.videos || [];
                  const unitSlides = unitContent?.slides || [];
                  const totalItems = unitVideos.length + unitSlides.length;

                  // Per-unit progress
                  const watchedCount = unitVideos.filter(v => {
                    const s = v.content ? getContentStatus(v.content.id) : null;
                    return s?.status === 'verified';
                  }).length;
                  const isUnitComplete = totalItems > 0 && watchedCount === unitVideos.length && unitVideos.length > 0;

                  return (
                    <Collapsible key={unit.id} defaultOpen={!isUnitComplete}>
                      <div className={`border rounded-lg overflow-hidden transition-colors ${isUnitComplete ? 'border-success/40' : 'border-border'}`}>
                        {/* Unit Header — clickable to expand/collapse */}
                        <CollapsibleTrigger asChild>
                          <div className={`border-l-4 ${isUnitComplete ? 'border-l-success' : 'border-l-primary'} p-3 sm:p-4 bg-card cursor-pointer hover:bg-accent/5 transition-colors group`}>
                            <div className="flex items-start gap-3">
                              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0 mt-0.5 ${
                                isUnitComplete ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'
                              }`}>
                                {isUnitComplete ? <CheckCircle2 className="h-4 w-4" /> : unit.sequence_order}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-sm font-semibold leading-tight">{unit.title}</h3>
                                  <Badge variant="outline" className="text-[10px] capitalize">
                                    {VIDEO_TYPE_LABELS[unit.target_video_type] || unit.target_video_type}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-muted-foreground">~{unit.target_duration_minutes} min</span>
                                  {totalItems > 0 && (
                                    <>
                                      <span className="text-[10px] text-muted-foreground">·</span>
                                      <span className={`text-[10px] font-medium ${isUnitComplete ? 'text-success' : 'text-muted-foreground'}`}>
                                        {watchedCount}/{unitVideos.length} watched
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform group-data-[state=open]:rotate-180" />
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          {/* Pedagogical context */}
                          <div className="px-4 pt-2 pb-3 bg-card border-t border-border/50">
                            {unit.what_to_teach && (
                              <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                                {unit.what_to_teach}
                              </p>
                            )}

                            <div className="pl-10 flex flex-wrap gap-x-4">
                              {unit.why_this_matters && (
                                <Collapsible>
                                  <CollapsibleTrigger className="flex items-center gap-1.5 mt-2 text-xs font-medium text-primary hover:underline">
                                    <Lightbulb className="h-3 w-3" />
                                    Why This Matters
                                    <ChevronDown className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-180" />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <p className="text-xs text-muted-foreground mt-1.5 pl-4 leading-relaxed">
                                      {unit.why_this_matters}
                                    </p>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {unit.common_misconceptions && unit.common_misconceptions.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger className="flex items-center gap-1.5 mt-2 text-xs font-medium text-warning hover:underline">
                                    <AlertTriangle className="h-3 w-3" />
                                    Misconceptions ({unit.common_misconceptions.length})
                                    <ChevronDown className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-180" />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <ul className="text-xs text-muted-foreground mt-1.5 pl-4 space-y-1 list-disc list-inside">
                                      {unit.common_misconceptions.map((m, i) => (
                                        <li key={i}>{m}</li>
                                      ))}
                                    </ul>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          </div>

                          {/* Unified content list: Videos + Slides interleaved */}
                          {totalItems > 0 && (
                            <div className="px-4 pb-3 space-y-1.5 bg-muted/10">
                              {unitVideos.map((match, rank) => {
                                const content = match.content;
                                if (!content) return null;
                                const status = getContentStatus(content.id);
                                const StatusIcon = status.icon;
                                const isSelected = selectedContentId === content.id;
                                return (
                                  <div
                                    key={content.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${
                                      isSelected
                                        ? 'bg-primary/10 border-primary shadow-sm'
                                        : status.status === 'verified'
                                          ? 'border-success/30 bg-success/5 hover:bg-success/10'
                                          : 'border-transparent hover:bg-accent/10 hover:border-border/50'
                                    }`}
                                    onClick={() => setSelectedContentId(content.id)}
                                  >
                                    <StatusIcon className={`h-4 w-4 ${status.color} shrink-0`} />
                                    {content.thumbnail_url && (
                                      <img src={content.thumbnail_url} alt="" className="w-16 h-10 object-cover rounded shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium line-clamp-1 leading-tight">{content.title}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[11px] text-muted-foreground">
                                          {content.duration_seconds ? `${Math.round(content.duration_seconds / 60)} min` : ''}
                                        </span>
                                        {content.channel_name && (
                                          <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{content.channel_name}</span>
                                        )}
                                      </div>
                                    </div>
                                    <MatchBadge score={match.match_score || 0} />
                                  </div>
                                );
                              })}

                              {unitSlides.length > 0 && unitVideos.length > 0 && (
                                <div className="border-t border-border/30 my-1" />
                              )}

                              {unitSlides.map((slide, index) => (
                                <div
                                  key={slide.id}
                                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all hover:bg-accent/10 hover:border-border/50 border border-transparent"
                                  onClick={() => setViewingSlide(slide)}
                                >
                                  <Presentation className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="flex items-center justify-center w-7 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                                    {moduleNum ? `${moduleNum}.${index + 1}` : index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium line-clamp-1">{slide.title}</p>
                                    <span className="text-[11px] text-muted-foreground">{slide.total_slides} slides · ~{slide.estimated_duration_minutes || 10} min</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}

                {/* General Resources (unlinked content) */}
                {unlinkedContent && (unlinkedContent.videos.length > 0 || (unlinkedContent.slides && unlinkedContent.slides.length > 0)) && (
                  <div className="border border-border/50 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border/30">
                      <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Additional Resources
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {unlinkedContent.videos.map((match) => {
                        const content = match.content;
                        if (!content) return null;
                        const status = getContentStatus(content.id);
                        const StatusIcon = status.icon;
                        const isSelected = selectedContentId === content.id;
                        return (
                          <div
                            key={content.id}
                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${
                              isSelected
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'border-transparent hover:bg-accent/10 hover:border-border/50'
                            }`}
                            onClick={() => setSelectedContentId(content.id)}
                          >
                            <StatusIcon className={`h-4 w-4 ${status.color} shrink-0`} />
                            {content.thumbnail_url && (
                              <img src={content.thumbnail_url} alt="" className="w-16 h-10 object-cover rounded shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-1 leading-tight">{content.title}</p>
                              <span className="text-[11px] text-muted-foreground">
                                {content.duration_seconds ? `${Math.round(content.duration_seconds / 60)} min` : ''}
                              </span>
                            </div>
                            <MatchBadge score={match.match_score || 0} />
                          </div>
                        );
                      })}
                      {unlinkedContent.slides?.map((slide, index) => (
                        <div
                          key={slide.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all hover:bg-accent/10 hover:border-border/50 border border-transparent"
                          onClick={() => setViewingSlide(slide)}
                        >
                          <Presentation className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex items-center justify-center w-7 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                            {moduleNum ? `${moduleNum}.${index + 1}` : index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-1">{slide.title}</p>
                            <span className="text-[11px] text-muted-foreground">{slide.total_slides} slides · ~{slide.estimated_duration_minutes || 10} min</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Fallback: flat layout when no teaching units exist */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <PlayCircle className="h-4 w-4 text-primary" />
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Videos
                    </h2>
                    <span className="text-xs text-muted-foreground ml-auto">Watch to unlock assessment</span>
                  </div>
                  {rankedContent.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No videos available yet.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {rankedContent.map((match, rank) => {
                        const content = match.content;
                        if (!content) return null;
                        const status = getContentStatus(content.id);
                        const StatusIcon = status.icon;
                        const isSelected = selectedContentId === content.id;
                        return (
                          <div
                            key={content.id}
                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                              isSelected ? 'bg-primary/10 border-primary' : 'border-border/50 hover:bg-accent/10'
                            }`}
                            onClick={() => setSelectedContentId(content.id)}
                          >
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                              {rank + 1}
                            </div>
                            {content.thumbnail_url && (
                              <img src={content.thumbnail_url} alt="" className="w-20 h-12 object-cover rounded shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2 leading-tight">{content.title}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                                <span className="text-xs text-muted-foreground">
                                  {content.duration_seconds ? `${Math.round(content.duration_seconds / 60)} min` : '?'}
                                </span>
                                <MatchBadge score={match.match_score || 0} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {lectureSlides && lectureSlides.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Presentation className="h-4 w-4 text-primary" />
                      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Lecture Slides
                      </h2>
                      <span className="text-xs text-muted-foreground ml-auto">Self-paced materials</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {lectureSlides.map((slide, index) => (
                        <div
                          key={slide.id}
                          className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/10 border border-border/50"
                          onClick={() => setViewingSlide(slide)}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                            {moduleNum ? `${moduleNum}.${index + 1}` : index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-1">{slide.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{slide.total_slides} slides</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">~{slide.estimated_duration_minutes || 10} min</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Assessment CTA */}
            {learningObjective.verification_state === 'verified' && (
              <Card className="border-success/50 bg-success/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Ready!</p>
                      <p className="text-xs text-muted-foreground">Take the assessment</p>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => navigate(`/learn/objective/${loId}/assess`)}
                    >
                      Start Assessment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {learningObjective.verification_state === 'assessment_unlocked' && (
              <Card className="border-primary">
                <CardContent className="py-4">
                  <Button 
                    className="w-full"
                    size="sm"
                    onClick={() => navigate(`/learn/objective/${loId}/assess`)}
                  >
                    Continue Assessment
                  </Button>
                </CardContent>
              </Card>
            )}

            {learningObjective.verification_state === 'passed' && (
              <Card className="border-success/50 bg-success/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Award className="h-8 w-8 text-success shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Assessment Passed!</p>
                      <p className="text-xs text-muted-foreground">You've demonstrated mastery</p>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/learn/objective/${loId}/assess`)}
                    >
                      Retake
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {learningObjective.verification_state === 'remediation_required' && (
              <Card className="border-warning/50 bg-warning/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-warning shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Review & Retry</p>
                      <p className="text-xs text-muted-foreground">Review the material and try again</p>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => navigate(`/learn/objective/${loId}/assess`)}
                    >
                      Retry Assessment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Slide Viewer Modal */}
        {viewingSlide && (
          <StudentSlideViewer
            lectureSlide={viewingSlide}
            unitTitle={viewingSlide.title}
            onClose={() => setViewingSlide(null)}
            onComplete={async (watchPercentage) => {
              if (user && viewingSlide) {
                try {
                  await supabase
                    .from('slide_completions')
                    .upsert({
                      user_id: user.id,
                      lecture_slides_id: viewingSlide.id,
                      learning_objective_id: viewingSlide.learning_objective_id || loId,
                      watch_percentage: Math.round(watchPercentage),
                      highest_slide_viewed: viewingSlide.total_slides || (viewingSlide.slides?.length ?? 0),
                      total_slides: viewingSlide.total_slides || (viewingSlide.slides?.length ?? 0),
                      completed_at: watchPercentage >= 80 ? new Date().toISOString() : null,
                      updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,lecture_slides_id' });

                  const currentState = learningObjective.verification_state || 'unstarted';
                  let newState: string | null = null;

                  if (watchPercentage >= 80 && (currentState === 'unstarted' || currentState === 'in_progress')) {
                    newState = 'verified';
                  } else if (watchPercentage > 0 && currentState === 'unstarted') {
                    newState = 'in_progress';
                  }

                  if (newState) {
                    await supabase
                      .from('learning_objectives')
                      .update({ verification_state: newState, updated_at: new Date().toISOString() })
                      .eq('id', loId);
                  }

                  await queryClient.invalidateQueries({ queryKey: ['lo-progress', loId] });
                  await queryClient.invalidateQueries({ queryKey: ['skill-profile'] });
                } catch (err) {
                  console.error('Error persisting slide completion:', err);
                }
              }
              setViewingSlide(null);
            }}
          />
        )}
      </PageContainer>
    </AppShell>
  );
}
