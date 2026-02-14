import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PlayCircle, CheckCircle2, Clock, ChevronDown, ClipboardCheck, XCircle, Presentation, Award, AlertTriangle } from 'lucide-react';
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
import type { LectureSlide, Slide } from '@/hooks/useLectureSlides';

export default function LearningObjectivePage() {
  const { loId } = useParams<{ loId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, error } = useLearningObjectiveProgress(loId);
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

  // Fetch published slides for this learning objective, ordered by teaching unit sequence
  const { data: lectureSlides } = useQuery({
    queryKey: ['lo-published-slides', loId],
    queryFn: async () => {
      if (!loId) return [];
      
      // Join with teaching_units to get sequence_order for proper ordering
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
      
      // Sort by teaching unit sequence order
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
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  const { learningObjective, matchedContent, consumptionRecords } = data;
  const selectedContent = matchedContent.find(m => m.content?.id === selectedContentId)?.content;

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
    // Refresh data after video completion
    if (isVerified) {
      // Invalidate learning objective progress to update UI
      await queryClient.invalidateQueries({
        queryKey: ['lo-progress', loId]
      });

      // Invalidate micro-check results if we have a consumption record
      if (selectedConsumptionRecord?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['micro-check-results', selectedConsumptionRecord.id]
        });
      }

      // Invalidate skill profile to reflect newly verified skills
      await queryClient.invalidateQueries({
        queryKey: ['skill-profile']
      });
    }
  };

  // Transform micro-checks to the format expected by VerifiedVideoPlayer
  // Note: correct_answer is no longer exposed from the secure view
  const playerMicroChecks = microChecks?.map(mc => ({
    id: mc.id,
    trigger_time_seconds: mc.trigger_time_seconds,
    question_text: mc.question_text,
    question_type: mc.question_type as 'recall' | 'mcq',
    options: mc.options as { text: string }[] | undefined,
    rewind_target_seconds: mc.rewind_target_seconds || undefined,
    time_limit_seconds: mc.time_limit_seconds || undefined,
  })) || [];

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/learn/course/${learningObjective.instructor_course_id}`)}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Course
            </Button>
            <h1 className="text-xl font-bold">{learningObjective.text}</h1>
            <div className="flex items-center gap-2 mt-2">
              {learningObjective.bloom_level && (
                <Badge variant="secondary" className="capitalize">
                  {learningObjective.bloom_level}
                </Badge>
              )}
              <Badge variant="outline">
                {learningObjective.verification_state?.replace('_', ' ') || 'Not Started'}
              </Badge>
            </div>
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

          {/* Content Sections - single column */}
          <div className="space-y-4">
            {/* Videos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-primary" />
                  Videos
                </CardTitle>
                <CardDescription className="text-xs">
                  Watch to unlock assessment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {matchedContent.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No videos available yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {matchedContent.map((match) => {
                      const content = match.content;
                      if (!content) return null;

                      const status = getContentStatus(content.id);
                      const StatusIcon = status.icon;
                      const isSelected = selectedContentId === content.id;

                      return (
                        <div
                          key={content.id}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                            isSelected 
                              ? 'bg-primary/10 border-primary' 
                              : 'border-border/50 hover:bg-accent/50'
                          }`}
                          onClick={() => setSelectedContentId(content.id)}
                        >
                          {content.thumbnail_url && (
                            <img
                              src={content.thumbnail_url}
                              alt=""
                              className="w-20 h-12 object-cover rounded shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2 leading-tight">
                              {content.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                              <span className="text-xs text-muted-foreground">
                                {content.duration_seconds 
                                  ? `${Math.round(content.duration_seconds / 60)} min`
                                  : '?'
                                }
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {Math.round((match.match_score || 0) * 100)}% match
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lecture Slides */}
            {lectureSlides && lectureSlides.length > 0 && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Presentation className="h-4 w-4 text-primary" />
                    Lecture Slides
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Self-paced learning materials
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {lectureSlides.map((slide, index) => (
                      <div
                        key={slide.id}
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 border border-border/50"
                        onClick={() => setViewingSlide(slide)}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">
                            {slide.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {slide.total_slides} slides
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              ~{slide.estimated_duration_minutes || 10} min
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
                  // 1. Upsert slide completion
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

                  // 2. Update verification_state based on progress
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

                  // 3. Invalidate queries to refresh UI
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
