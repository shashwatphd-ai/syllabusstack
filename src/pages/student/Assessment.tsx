import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { AssessmentSession } from '@/components/assessment/AssessmentSession';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Assessment() {
  const { loId } = useParams<{ loId: string }>();
  const navigate = useNavigate();

  const { data: learningObjective, isLoading } = useQuery({
    queryKey: ['learning-objective', loId],
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
