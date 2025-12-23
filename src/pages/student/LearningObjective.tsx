import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PlayCircle, CheckCircle2, Lock, Clock, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { useLearningObjectiveProgress } from '@/hooks/useStudentCourses';
import { useMicroChecks } from '@/hooks/useAssessment';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerifiedVideoPlayer } from '@/components/player/VerifiedVideoPlayer';
import { useState } from 'react';

export default function LearningObjectivePage() {
  const { loId } = useParams<{ loId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useLearningObjectiveProgress(loId);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

  // Get micro-checks for selected content
  const { data: microChecks } = useMicroChecks(selectedContentId || undefined);

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
            <Button variant="outline" onClick={() => navigate(-1)}>
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

  const handleVideoComplete = (engagementScore: number, isVerified: boolean) => {
    // Refresh data after completion
    if (isVerified) {
      // Could trigger a refetch here
    }
  };

  // Transform micro-checks to the format expected by VerifiedVideoPlayer
  const playerMicroChecks = microChecks?.map(mc => ({
    id: mc.id,
    trigger_time_seconds: mc.trigger_time_seconds,
    question_text: mc.question_text,
    question_type: mc.question_type as 'recall' | 'mcq',
    options: mc.options as { text: string; is_correct?: boolean }[] | undefined,
    correct_answer: mc.correct_answer,
    rewind_target_seconds: mc.rewind_target_seconds || undefined,
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
              onClick={() => navigate(-1)}
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

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Video Player */}
            <div className="lg:col-span-2">
              {selectedContent ? (
                <VerifiedVideoPlayer
                  contentId={selectedContent.id}
                  learningObjectiveId={loId!}
                  videoUrl={selectedContent.source_url || ''}
                  title={selectedContent.title}
                  duration={selectedContent.duration_seconds || 600}
                  microChecks={playerMicroChecks}
                  onComplete={handleVideoComplete}
                />
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <PlayCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Select a Video</h3>
                    <p className="text-muted-foreground">
                      Choose content from the list to begin learning
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Content List */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Available Content</CardTitle>
                  <CardDescription>
                    Complete at least one video to unlock assessment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {matchedContent.length === 0 ? (
                    <div className="text-center py-6">
                      <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No content available yet
                      </p>
                    </div>
                  ) : (
                    matchedContent.map((match) => {
                      const content = match.content;
                      if (!content) return null;

                      const status = getContentStatus(content.id);
                      const StatusIcon = status.icon;
                      const isSelected = selectedContentId === content.id;

                      return (
                        <Card
                          key={content.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-accent/50'
                          }`}
                          onClick={() => setSelectedContentId(content.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex gap-3">
                              {content.thumbnail_url && (
                                <img
                                  src={content.thumbnail_url}
                                  alt={content.title}
                                  className="w-24 h-14 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium line-clamp-2">
                                  {content.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <StatusIcon className={`h-3 w-3 ${status.color}`} />
                                  <span className="text-xs text-muted-foreground">
                                    {content.duration_seconds 
                                      ? `${Math.round(content.duration_seconds / 60)} min`
                                      : 'Duration unknown'
                                    }
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round((match.match_score || 0) * 100)}% match
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Assessment CTA */}
              {learningObjective.verification_state === 'verified' && (
                <Card className="border-primary">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-3">
                      <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                      <div>
                        <h3 className="font-semibold">Content Verified!</h3>
                        <p className="text-sm text-muted-foreground">
                          You can now take the assessment
                        </p>
                      </div>
                      <Button 
                        className="w-full"
                        onClick={() => navigate(`/assess/${loId}`)}
                      >
                        Start Assessment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {learningObjective.verification_state === 'assessment_unlocked' && (
                <Card className="border-primary">
                  <CardContent className="pt-6">
                    <Button 
                      className="w-full"
                      onClick={() => navigate(`/assess/${loId}`)}
                    >
                      Continue Assessment
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
