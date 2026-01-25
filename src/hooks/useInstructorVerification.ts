import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface VerificationRequest {
  email?: string;
  institution_name?: string;
  department?: string;
  title?: string;
  linkedin_url?: string;
  document_urls?: string[];
}

interface VerificationResult {
  verification_id: string;
  status: 'pending' | 'approved' | 'rejected';
  trust_score: number;
  edu_domain_verified?: boolean;
  auto_approved?: boolean;
  message: string;
}

interface InviteCodeResult {
  verification_id: string;
  status: 'pending' | 'approved';
  trust_score: number;
  message: string;
}

export function useInstructorVerification() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current verification status
  const { data: verification, isLoading } = useQuery({
    queryKey: ['instructor-verification', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('instructor_verifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Submit verification via email/.edu domain
  const submitVerification = useMutation({
    mutationFn: async (request: VerificationRequest): Promise<VerificationResult> => {
      const { data, error } = await supabase.functions.invoke('verify-instructor-email', {
        body: request,
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (result) => {
      toast({
        title: result.status === 'approved' ? 'Verified!' : 'Request Submitted',
        description: result.message,
      });
      
      queryClient.invalidateQueries({ queryKey: ['instructor-verification'] });
      
      if (result.status === 'approved') {
        await refreshProfile();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Use invite code
  const useInviteCode = useMutation({
    mutationFn: async (code: string): Promise<InviteCodeResult> => {
      const { data, error } = await supabase.functions.invoke('use-invite-code', {
        body: { code },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (result) => {
      toast({
        title: result.status === 'approved' ? 'Verified!' : 'Code Accepted',
        description: result.message,
      });
      
      queryClient.invalidateQueries({ queryKey: ['instructor-verification'] });
      
      if (result.status === 'approved') {
        await refreshProfile();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Invalid Code',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    verification,
    isLoading,
    isVerified: profile?.is_instructor_verified ?? false,
    trustScore: profile?.instructor_trust_score ?? 0,
    submitVerification,
    useInviteCode,
  };
}
