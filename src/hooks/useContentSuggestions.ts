import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ContentSuggestion {
  id: string;
  user_id: string;
  learning_objective_id: string;
  url: string;
  title: string | null;
  description: string | null;
  source_type: 'youtube' | 'khan_academy' | 'article' | 'course' | 'other';
  votes: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_id: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string | null;
  };
  user_vote?: number;
}

export interface SuggestionInput {
  learning_objective_id: string;
  url: string;
  title?: string;
  description?: string;
  source_type?: 'youtube' | 'khan_academy' | 'article' | 'course' | 'other';
}

// Fetch suggestions for a learning objective
export function useLOSuggestions(learningObjectiveId: string | undefined) {
  return useQuery({
    queryKey: ['content-suggestions', learningObjectiveId],
    queryFn: async () => {
      if (!learningObjectiveId) return [];

      const { data: { user } } = await supabase.auth.getUser();

      const { data: suggestions, error } = await supabase
        .from('content_suggestions')
        .select(`
          *,
          user:user_id(full_name)
        `)
        .eq('learning_objective_id', learningObjectiveId)
        .order('votes', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user's votes
      let userVotes: Record<string, number> = {};
      if (user) {
        const { data: votes } = await supabase
          .from('suggestion_votes')
          .select('suggestion_id, vote')
          .eq('user_id', user.id)
          .in('suggestion_id', suggestions?.map(s => s.id) || []);

        if (votes) {
          userVotes = votes.reduce((acc, v) => {
            acc[v.suggestion_id] = v.vote;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      return (suggestions || []).map(s => {
        let userFullName: string | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userData = s.user as any;
        if (userData && typeof userData === 'object' && 'full_name' in userData) {
          userFullName = userData.full_name;
        }
        
        return {
          ...s,
          source_type: (s.source_type || 'other') as ContentSuggestion['source_type'],
          status: (s.status || 'pending') as ContentSuggestion['status'],
          user: { full_name: userFullName },
          user_vote: userVotes[s.id] || 0,
        };
      }) as ContentSuggestion[];
    },
    enabled: !!learningObjectiveId,
  });
}

// Fetch user's own suggestions
export function useUserSuggestions() {
  return useQuery({
    queryKey: ['content-suggestions', 'user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('content_suggestions')
        .select(`
          *,
          learning_objective:learning_objective_id(
            text,
            module:module_id(
              title,
              course:course_id(title)
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Fetch pending suggestions for review (instructors)
export function usePendingSuggestions(courseId?: string) {
  return useQuery({
    queryKey: ['content-suggestions', 'pending', courseId],
    queryFn: async () => {
      let query = supabase
        .from('content_suggestions')
        .select(`
          *,
          user:user_id(full_name),
          learning_objective:learning_objective_id(
            text,
            module:module_id(
              title,
              course_id
            )
          )
        `)
        .eq('status', 'pending')
        .order('votes', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Filter by course if specified
      if (courseId) {
        return data?.filter(
          s => (s.learning_objective as any)?.module?.course_id === courseId
        );
      }

      return data;
    },
  });
}

// Submit a new suggestion
export function useSubmitSuggestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SuggestionInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Auto-detect source type from URL
      let sourceType = input.source_type || 'other';
      if (input.url.includes('youtube.com') || input.url.includes('youtu.be')) {
        sourceType = 'youtube';
      } else if (input.url.includes('khanacademy.org')) {
        sourceType = 'khan_academy';
      }

      const { data, error } = await supabase
        .from('content_suggestions')
        .insert({
          user_id: user.id,
          learning_objective_id: input.learning_objective_id,
          url: input.url,
          title: input.title || null,
          description: input.description || null,
          source_type: sourceType,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['content-suggestions', data.learning_objective_id]
      });
      queryClient.invalidateQueries({
        queryKey: ['content-suggestions', 'user']
      });
      toast({
        title: 'Suggestion submitted',
        description: 'Your resource suggestion is pending review.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit suggestion',
        variant: 'destructive',
      });
    },
  });
}

// Vote on a suggestion
export function useVoteSuggestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ suggestionId, vote }: { suggestionId: string; vote: 1 | -1 | 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (vote === 0) {
        // Remove vote
        const { error } = await supabase
          .from('suggestion_votes')
          .delete()
          .eq('suggestion_id', suggestionId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Upsert vote
        const { error } = await supabase
          .from('suggestion_votes')
          .upsert({
            suggestion_id: suggestionId,
            user_id: user.id,
            vote,
          }, {
            onConflict: 'suggestion_id,user_id',
          });

        if (error) throw error;
      }

      return { suggestionId, vote };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-suggestions'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to vote',
        variant: 'destructive',
      });
    },
  });
}

// Review a suggestion (approve/reject)
export function useReviewSuggestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      suggestionId,
      status,
      notes,
    }: {
      suggestionId: string;
      status: 'approved' | 'rejected';
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('content_suggestions')
        .update({
          status,
          reviewer_id: user.id,
          reviewer_notes: notes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['content-suggestions'] });
      toast({
        title: `Suggestion ${data.status}`,
        description: data.status === 'approved'
          ? 'The resource has been added to the course.'
          : 'The suggestion has been rejected.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to review suggestion',
        variant: 'destructive',
      });
    },
  });
}

// Delete a suggestion
export function useDeleteSuggestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from('content_suggestions')
        .delete()
        .eq('id', suggestionId);

      if (error) throw error;
      return suggestionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-suggestions'] });
      toast({
        title: 'Suggestion deleted',
        description: 'Your suggestion has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete suggestion',
        variant: 'destructive',
      });
    },
  });
}
