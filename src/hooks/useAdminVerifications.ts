import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InstructorVerification {
  id: string;
  user_id: string;
  verification_method: string;
  email_domain: string | null;
  edu_domain_verified: boolean | null;
  institution_name: string | null;
  department: string | null;
  title: string | null;
  linkedin_url: string | null;
  document_urls: string[] | null;
  status: string;
  trust_score: number;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewer_id: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

// Fetch all pending verifications for admin review
export function useAdminVerificationQueue() {
  return useQuery({
    queryKey: ['admin-verification-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_verifications')
        .select('*')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = data?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return (data || []).map(v => ({
        ...v,
        profile: profileMap.get(v.user_id) || null,
      })) as InstructorVerification[];
    },
  });
}

// Fetch all verifications (with filtering)
export function useAdminVerifications(status?: string) {
  return useQuery({
    queryKey: ['admin-verifications', status],
    queryFn: async () => {
      let query = supabase
        .from('instructor_verifications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const userIds = data?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return (data || []).map(v => ({
        ...v,
        profile: profileMap.get(v.user_id) || null,
      })) as InstructorVerification[];
    },
  });
}

// Fetch single verification by ID
export function useVerificationDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['verification-detail', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('instructor_verifications')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url, university')
        .eq('user_id', data.user_id)
        .single();

      return { ...data, profile } as InstructorVerification & { profile: { university?: string } };
    },
    enabled: !!id,
  });
}

// Review verification (approve/reject)
export function useReviewVerification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      verification_id,
      action,
      rejection_reason,
      trust_score_adjustment,
    }: {
      verification_id: string;
      action: 'approve' | 'reject';
      rejection_reason?: string;
      trust_score_adjustment?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('review-instructor-verification', {
        body: {
          verification_id,
          action,
          rejection_reason,
          trust_score_adjustment,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-verification-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['verification-detail', variables.verification_id] });
      
      toast({
        title: variables.action === 'approve' ? 'Instructor Approved' : 'Verification Rejected',
        description: variables.action === 'approve' 
          ? 'The instructor has been verified and can now create courses.'
          : 'The verification request has been rejected.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Review Failed',
        description: error instanceof Error ? error.message : 'Failed to review verification',
        variant: 'destructive',
      });
    },
  });
}

// Get verification stats for dashboard
export function useVerificationStats() {
  return useQuery({
    queryKey: ['verification-stats'],
    queryFn: async () => {
      const [pending, approved, rejected] = await Promise.all([
        supabase.from('instructor_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('instructor_verifications').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('instructor_verifications').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);

      return {
        pending: pending.count || 0,
        approved: approved.count || 0,
        rejected: rejected.count || 0,
        total: (pending.count || 0) + (approved.count || 0) + (rejected.count || 0),
      };
    },
  });
}
