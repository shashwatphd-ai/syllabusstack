import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ContentRating {
  id: string;
  user_id: string;
  content_id: string;
  rating: number;
  difficulty: 'too_easy' | 'just_right' | 'too_hard' | null;
  helpful: boolean | null;
  comment: string | null;
  watch_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface ContentRatingStats {
  average_rating: number | null;
  rating_count: number;
  difficulty_distribution: {
    too_easy: number;
    just_right: number;
    too_hard: number;
  };
}

export interface RatingInput {
  content_id: string;
  rating: number;
  difficulty?: 'too_easy' | 'just_right' | 'too_hard';
  helpful?: boolean;
  comment?: string;
  watch_percentage?: number;
}

// Fetch user's rating for a specific content
export function useUserContentRating(contentId: string | undefined) {
  return useQuery({
    queryKey: ['content-rating', 'user', contentId],
    queryFn: async () => {
      if (!contentId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('content_ratings')
        .select('*')
        .eq('content_id', contentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as ContentRating | null;
    },
    enabled: !!contentId,
  });
}

// Fetch rating stats for a content item
export function useContentRatingStats(contentId: string | undefined) {
  return useQuery({
    queryKey: ['content-rating', 'stats', contentId],
    queryFn: async () => {
      if (!contentId) return null;

      const { data, error } = await supabase
        .from('content')
        .select('average_rating, rating_count, difficulty_distribution')
        .eq('id', contentId)
        .single();

      if (error) throw error;
      return {
        average_rating: data.average_rating,
        rating_count: data.rating_count || 0,
        difficulty_distribution: data.difficulty_distribution || {
          too_easy: 0,
          just_right: 0,
          too_hard: 0,
        },
      } as ContentRatingStats;
    },
    enabled: !!contentId,
  });
}

// Fetch all ratings for a content item (for display)
export function useContentRatings(contentId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['content-ratings', contentId, limit],
    queryFn: async () => {
      if (!contentId) return [];

      const { data, error } = await supabase
        .from('content_ratings')
        .select(`
          *,
          user:user_id(
            full_name
          )
        `)
        .eq('content_id', contentId)
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!contentId,
  });
}

// Submit or update a rating
export function useSubmitRating() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: RatingInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('content_ratings')
        .upsert({
          user_id: user.id,
          content_id: input.content_id,
          rating: input.rating,
          difficulty: input.difficulty || null,
          helpful: input.helpful ?? null,
          comment: input.comment || null,
          watch_percentage: input.watch_percentage || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,content_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data as ContentRating;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['content-rating', 'user', data.content_id] });
      queryClient.invalidateQueries({ queryKey: ['content-rating', 'stats', data.content_id] });
      queryClient.invalidateQueries({ queryKey: ['content-ratings', data.content_id] });
      toast({
        title: 'Rating submitted',
        description: 'Thanks for your feedback!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit rating',
        variant: 'destructive',
      });
    },
  });
}

// Delete a rating
export function useDeleteRating() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('content_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('content_id', contentId);

      if (error) throw error;
      return contentId;
    },
    onSuccess: (contentId) => {
      queryClient.invalidateQueries({ queryKey: ['content-rating', 'user', contentId] });
      queryClient.invalidateQueries({ queryKey: ['content-rating', 'stats', contentId] });
      queryClient.invalidateQueries({ queryKey: ['content-ratings', contentId] });
      toast({
        title: 'Rating removed',
        description: 'Your rating has been deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete rating',
        variant: 'destructive',
      });
    },
  });
}

// Helper to format rating display
export function formatRating(rating: number | null): string {
  if (rating === null) return 'No ratings yet';
  return rating.toFixed(1);
}

// Helper to get star display
export function getStarDisplay(rating: number): { full: number; half: boolean; empty: number } {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return { full, half, empty };
}
