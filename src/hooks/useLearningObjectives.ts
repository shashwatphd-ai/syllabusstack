import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LearningObjective {
  id: string;
  module_id: string | null;
  course_id: string | null;
  instructor_course_id: string | null;
  user_id: string;
  text: string;
  core_concept: string | null;
  action_verb: string | null;
  bloom_level: string | null;
  domain: string | null;
  specificity: string | null;
  search_keywords: string[] | null;
  expected_duration_minutes: number | null;
  verification_state: string;
  decomposition_status: string | null;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContentMatch {
  id: string;
  learning_objective_id: string;
  content_id: string;
  teaching_unit_id: string | null;  // NEW: Link to teaching unit
  match_score: number;
  duration_fit_score: number | null;
  semantic_similarity_score: number | null;
  engagement_quality_score: number | null;
  channel_authority_score: number | null;
  recency_score: number | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  content?: Content;
  // AI evaluation fields
  ai_reasoning: string | null;
  ai_relevance_score: number | null;
  ai_pedagogy_score: number | null;
  ai_quality_score: number | null;
  ai_recommendation: string | null;
  ai_concern: string | null;
}

export interface Content {
  id: string;
  source_type: string;
  source_id: string | null;
  source_url: string | null;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  view_count: number | null;
  like_count: number | null;
  quality_score: number | null;
  is_available: boolean;
}

// Fetch learning objectives for an instructor course
export function useLearningObjectives(instructorCourseId?: string) {
  return useQuery({
    queryKey: ['learning-objectives', instructorCourseId],
    queryFn: async () => {
      let query = supabase
        .from('learning_objectives')
        .select('*')
        .order('sequence_order', { ascending: true });

      if (instructorCourseId) {
        query = query.eq('instructor_course_id', instructorCourseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LearningObjective[];
    },
    enabled: !!instructorCourseId,
  });
}

// Fetch content matches for a learning objective
export function useContentMatches(learningObjectiveId?: string) {
  return useQuery({
    queryKey: ['content-matches', learningObjectiveId],
    queryFn: async () => {
      if (!learningObjectiveId) return [];

      const { data, error } = await supabase
        .from('content_matches')
        .select(`
          *,
          content:content_id(*)
        `)
        .eq('learning_objective_id', learningObjectiveId)
        .order('match_score', { ascending: false });

      if (error) throw error;
      return data as ContentMatch[];
    },
    enabled: !!learningObjectiveId,
  });
}

// Extract learning objectives from syllabus
export function useExtractLearningObjectives() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ syllabusText, courseId, moduleId }: { 
      syllabusText: string; 
      courseId?: string; 
      moduleId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('extract-learning-objectives', {
        body: { 
          syllabus_text: syllabusText,
          course_id: courseId,
          module_id: moduleId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['learning-objectives'] });
      toast({
        title: 'Learning Objectives Extracted',
        description: `Found ${data.count} learning objectives`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to extract learning objectives',
        variant: 'destructive',
      });
    },
  });
}

// Search YouTube content for a learning objective
export function useSearchYouTubeContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (learningObjective: LearningObjective) => {
      const { data, error } = await supabase.functions.invoke('search-youtube-content', {
        body: {
          learning_objective_id: learningObjective.id,
          core_concept: learningObjective.core_concept,
          bloom_level: learningObjective.bloom_level,
          domain: learningObjective.domain,
          search_keywords: learningObjective.search_keywords,
          expected_duration_minutes: learningObjective.expected_duration_minutes,
          lo_text: learningObjective.text,
          use_ai_evaluation: true,
          force_sync: true,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['content-matches', variables.id] });
      const saved = data.content_matches?.length ?? 0;
      const autoApproved = data.auto_approved_count ?? 0;
      const totalDiscovered = data.total_found ?? 0;
      if (data.batch_evaluation_pending) {
        toast({ title: 'Content Found', description: `Discovered ${totalDiscovered} videos, queued for evaluation` });
      } else if (saved > 0) {
        const desc = autoApproved > 0
          ? `${saved} videos saved (${autoApproved} auto-approved)`
          : `${saved} videos saved for review`;
        toast({ title: 'Content Found', description: desc });
      } else {
        toast({ 
          title: 'No Matches', 
          description: `Scanned ${totalDiscovered} videos but none met quality thresholds. Try manual search.`,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to search YouTube content',
        variant: 'destructive',
      });
    },
  });
}

// Approve or reject a content match
export function useUpdateContentMatchStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      matchId, 
      status, 
      rejectionReason 
    }: { 
      matchId: string; 
      status: 'approved' | 'rejected';
      rejectionReason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates: Record<string, unknown> = {
        status,
        approved_by: status === 'approved' ? user.id : null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
      };

      if (status === 'rejected' && rejectionReason) {
        updates.rejection_reason = rejectionReason;
      }

      const { data, error } = await supabase
        .from('content_matches')
        .update(updates)
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all content-related queries to ensure UI consistency
      queryClient.invalidateQueries({ queryKey: ['content-matches'] });
      queryClient.invalidateQueries({ queryKey: ['lo-content-status'] });
      queryClient.invalidateQueries({ queryKey: ['content-stats'] });

      toast({
        title: data.status === 'approved' ? 'Content Approved' : 'Content Removed',
        description: data.status === 'approved'
          ? 'This content is now available to students'
          : 'This content has been removed from the course',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update content status',
        variant: 'destructive',
      });
    },
  });
}
