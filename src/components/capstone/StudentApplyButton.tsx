import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StudentApplyButtonProps {
  projectId: string;
  disabled?: boolean;
}

export function StudentApplyButton({ projectId, disabled }: StudentApplyButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['project-application', projectId, user?.id];

  // Check if already applied
  const { data: existingApplication, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('project_applications')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!projectId,
  });

  const hasApplied = !!existingApplication;

  // Apply mutation with optimistic update
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('project_applications')
        .insert({ project_id: projectId, user_id: user.id, status: 'pending' })
        .select('id, status')
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, { id: 'optimistic', status: 'pending' });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast({
        title: 'Application failed',
        description: 'Could not submit your application. Please try again.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({ title: 'Applied!', description: 'Your application has been submitted.' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  if (isLoading) {
    return (
      <Button size="sm" disabled className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading
      </Button>
    );
  }

  if (hasApplied) {
    return (
      <Button size="sm" disabled variant="secondary" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        Applied
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => applyMutation.mutate()}
      disabled={disabled || applyMutation.isPending}
      className="gap-1.5"
    >
      {applyMutation.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Send className="h-3 w-3" />
      )}
      {applyMutation.isPending ? 'Applying...' : 'Apply'}
    </Button>
  );
}
