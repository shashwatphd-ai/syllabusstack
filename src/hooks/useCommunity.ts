import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_score: number;
  sessions_passed: number;
  total_sessions: number;
  rank: number;
}

export interface QuizChallenge {
  id: string;
  course_id: string;
  learning_objective_id: string;
  challenger_id: string;
  challenged_id: string;
  question_ids: string[];
  status: 'pending' | 'active' | 'completed' | 'expired' | 'declined';
  challenger_score: number;
  challenged_score: number;
  challenger_completed: boolean;
  challenged_completed: boolean;
  winner_id: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
  // Joined fields
  challenger_name?: string | null;
  challenged_name?: string | null;
  lo_text?: string | null;
}

export interface CommunityExplanation {
  id: string;
  course_id: string;
  question_id: string;
  user_id: string;
  explanation_text: string;
  votes: number;
  created_at: string;
  author_name?: string | null;
  user_vote?: number | null;
}

export interface Classmate {
  student_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

// ─── Leaderboard ─────────────────────────────────────────────────────

export function useCourseLeaderboard(courseId: string | undefined, timeRange: 'all' | 'weekly' = 'all') {
  return useQuery({
    queryKey: ['course-leaderboard', courseId, timeRange],
    queryFn: async () => {
      if (!courseId) return [];

      // Get all LO ids for this course
      const { data: los } = await supabase
        .from('learning_objectives')
        .select('id')
        .eq('instructor_course_id', courseId);

      const loIds = (los || []).map(lo => lo.id);
      if (loIds.length === 0) return [];

      // Get assessment sessions for these LOs
      let query = supabase
        .from('assessment_sessions')
        .select('user_id, total_score, passed, completed_at')
        .in('learning_objective_id', loIds)
        .eq('status', 'completed')
        .not('total_score', 'is', null);

      if (timeRange === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('completed_at', weekAgo.toISOString());
      }

      const { data: sessions } = await query;
      if (!sessions || sessions.length === 0) return [];

      // Aggregate by user
      const userMap = new Map<string, { scores: number[]; passed: number; total: number }>();
      for (const s of sessions) {
        const entry = userMap.get(s.user_id) || { scores: [], passed: 0, total: 0 };
        entry.scores.push(s.total_score ?? 0);
        if (s.passed) entry.passed++;
        entry.total++;
        userMap.set(s.user_id, entry);
      }

      // Get profile names
      const userIds = Array.from(userMap.keys());
      const { data: profiles } = await supabase
        .from('profiles_minimal')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      // Build leaderboard
      const entries: LeaderboardEntry[] = userIds.map(uid => {
        const data = userMap.get(uid)!;
        const profile = profileMap.get(uid);
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        return {
          user_id: uid,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          total_score: Math.round(avgScore * 10) / 10,
          sessions_passed: data.passed,
          total_sessions: data.total,
          rank: 0,
        };
      });

      entries.sort((a, b) => b.total_score - a.total_score || b.sessions_passed - a.sessions_passed);
      entries.forEach((e, i) => (e.rank = i + 1));

      return entries;
    },
    enabled: !!courseId,
  });
}

// ─── Classmates ──────────────────────────────────────────────────────

export function useClassmates(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-classmates', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('instructor_course_id', courseId)
        .neq('student_id', user.id);

      if (!enrollments || enrollments.length === 0) return [];

      const ids = enrollments.map(e => e.student_id);
      const { data: profiles } = await supabase
        .from('profiles_minimal')
        .select('user_id, full_name, avatar_url')
        .in('user_id', ids);

      return (profiles || []).map(p => ({
        student_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
      })) as Classmate[];
    },
    enabled: !!courseId,
  });
}

// ─── Challenges ──────────────────────────────────────────────────────

export function useChallenges(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-challenges', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const { data } = await supabase
        .from('quiz_challenges')
        .select('*')
        .eq('course_id', courseId)
        .in('status', ['pending', 'active', 'completed'])
        .order('created_at', { ascending: false })
        .limit(20);

      return (data || []) as unknown as QuizChallenge[];
    },
    enabled: !!courseId,
  });
}

export function useActiveChallenge(challengeId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: async () => {
      if (!challengeId) return null;
      const { data } = await supabase
        .from('quiz_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();
      return data as unknown as QuizChallenge | null;
    },
    enabled: !!challengeId,
    refetchInterval: false,
  });

  // Realtime subscription for live updates
  useEffect(() => {
    if (!challengeId) return;
    const channel = supabase
      .channel(`challenge-${challengeId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'quiz_challenges',
        filter: `id=eq.${challengeId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [challengeId, queryClient]);

  return query;
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      loId: string;
      challengedId: string;
      questionIds: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('quiz_challenges')
        .insert({
          course_id: params.courseId,
          learning_objective_id: params.loId,
          challenger_id: user.id,
          challenged_id: params.challengedId,
          question_ids: params.questionIds,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['course-challenges', vars.courseId] });
      toast({ title: 'Challenge sent!', description: 'Waiting for your classmate to accept.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useRespondToChallenge() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { challengeId: string; accept: boolean }) => {
      const newStatus = params.accept ? 'active' : 'declined';
      const { data, error } = await supabase
        .from('quiz_challenges')
        .update({ status: newStatus as any })
        .eq('id', params.challengeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const d = data as any;
      queryClient.invalidateQueries({ queryKey: ['course-challenges', d.course_id] });
      queryClient.invalidateQueries({ queryKey: ['challenge', d.id] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useSubmitChallengeAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      challengeId: string;
      questionId: string;
      userAnswer: string;
      timeTakenSeconds?: number;
      selectedOptionIndex?: number;
    }) => {
      const { data, error } = await supabase.rpc('evaluate_challenge_answer', {
        p_challenge_id: params.challengeId,
        p_question_id: params.questionId,
        p_user_answer: params.userAnswer,
        p_time_taken_seconds: params.timeTakenSeconds ?? null,
        p_selected_option_index: params.selectedOptionIndex ?? null,
      });

      if (error) throw error;
      return data as { is_correct: boolean };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['challenge', vars.challengeId] });
    },
  });
}

// ─── Peer Explanations ───────────────────────────────────────────────

export function usePeerExplanations(questionId: string | undefined, courseId: string | undefined) {
  return useQuery({
    queryKey: ['peer-explanations', questionId],
    queryFn: async () => {
      if (!questionId || !courseId) return [];

      const { data: { user } } = await supabase.auth.getUser();

      const { data: explanations } = await supabase
        .from('community_explanations')
        .select('*')
        .eq('question_id', questionId)
        .eq('course_id', courseId)
        .order('votes', { ascending: false });

      if (!explanations || explanations.length === 0) return [];

      // Get author names
      const authorIds = [...new Set(explanations.map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles_minimal')
        .select('user_id, full_name')
        .in('user_id', authorIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      // Get user's votes
      let userVotes = new Map<string, number>();
      if (user) {
        const { data: votes } = await supabase
          .from('explanation_votes')
          .select('explanation_id, vote')
          .eq('user_id', user.id)
          .in('explanation_id', explanations.map(e => e.id));

        userVotes = new Map((votes || []).map(v => [v.explanation_id, v.vote]));
      }

      return explanations.map(e => ({
        ...e,
        author_name: profileMap.get(e.user_id) ?? null,
        user_vote: userVotes.get(e.id) ?? null,
      })) as CommunityExplanation[];
    },
    enabled: !!questionId && !!courseId,
  });
}

export function usePostExplanation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      questionId: string;
      courseId: string;
      explanationText: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('community_explanations')
        .upsert({
          question_id: params.questionId,
          course_id: params.courseId,
          user_id: user.id,
          explanation_text: params.explanationText,
        }, { onConflict: 'question_id,user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['peer-explanations', vars.questionId] });
      toast({ title: 'Explanation shared!', description: 'Your classmates can now learn from your insight.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useVoteExplanation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { explanationId: string; vote: 1 | -1; questionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if user already voted
      const { data: existing } = await supabase
        .from('explanation_votes')
        .select('id, vote')
        .eq('explanation_id', params.explanationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.vote === params.vote) {
          // Remove vote (toggle off)
          await supabase.from('explanation_votes').delete().eq('id', existing.id);
        } else {
          // Change vote
          await supabase.from('explanation_votes').update({ vote: params.vote }).eq('id', existing.id);
        }
      } else {
        // New vote
        const { error } = await supabase
          .from('explanation_votes')
          .insert({ explanation_id: params.explanationId, user_id: user.id, vote: params.vote });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['peer-explanations', vars.questionId] });
    },
  });
}
