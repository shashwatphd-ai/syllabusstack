import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { AssessmentSession } from '@/components/assessment/AssessmentSession';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Lock, PlayCircle } from 'lucide-react';

// Valid states for taking assessment
const ASSESSMENT_ALLOWED_STATES = ['verified', 'assessment_unlocked', 'passed', 'remediation_required'];

export default function Assessment() {
  const { loId } = useParams<{ loId: string }>();
  const navigate = useNavigate();

  const { data: learningObjective, isLoading } = useQuery({
    queryKey: ['learning-objective-assessment', loId],
    queryFn: async () => {
      if (!loId) return null;

      const { data, error } = await supabase
        .from('learning_objectives')
        .select('*')
        .eq('id', loId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!loId,
  });

  // Check if prerequisites are met (content has been verified)
  const canTakeAssessment = learningObjective &&
    ASSESSMENT_ALLOWED_STATES.includes(learningObjective.verification_state || '');

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <LoadingState message="Loading assessment..." />
        </PageContainer>
      </AppShell>
    );
  }

  if (!learningObjective) {
    return (
      <AppShell>
        <PageContainer>
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Learning objective not found</p>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  // Show prerequisites not met screen
  if (!canTakeAssessment) {
    return (
      <AppShell>
        <PageContainer>
          <div className="max-w-lg mx-auto py-12">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 rounded-full bg-muted w-fit">
                  <Lock className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle>Assessment Locked</CardTitle>
                <CardDescription>
                  You need to complete content verification before taking the assessment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Current Status</h4>
                  <p className="text-sm text-muted-foreground">
                    {learningObjective.verification_state === 'unstarted' && (
                      'You haven\'t started watching content for this learning objective yet.'
                    )}
                    {learningObjective.verification_state === 'in_progress' && (
                      'You\'re making progress! Complete watching the content and pass the micro-checks to unlock the assessment.'
                    )}
                    {!learningObjective.verification_state && (
                      'Please watch the learning content first.'
                    )}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => navigate(`/learn/objective/${loId}`)}
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Watch Content
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        <div className="max-w-3xl mx-auto py-8">
          <AssessmentSession
            learningObjectiveId={learningObjective.id}
            learningObjectiveText={learningObjective.text}
            onClose={() => navigate(`/learn/objective/${loId}`)}
          />
        </div>
      </PageContainer>
    </AppShell>
  );
}
