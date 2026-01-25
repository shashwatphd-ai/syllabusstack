import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface IDVStatus {
  verification_id?: string;
  status: 'none' | 'pending' | 'processing' | 'verified' | 'failed' | 'expired';
  provider?: string;
  verified_name?: string;
  document_type?: string;
  selfie_match_score?: number;
  liveness_passed?: boolean;
  failure_reason?: string;
  created_at?: string;
  completed_at?: string;
  expires_at?: string;
}

interface InitiateResult {
  verification_id: string;
  session_token: string;
  inquiry_id: string;
  status: string;
  expires_at: string;
  message: string;
}

export function useIdentityVerification() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current IDV status
  const { data: idvStatus, isLoading, refetch } = useQuery<IDVStatus>({
    queryKey: ['identity-verification-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('identity-verification-status');
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    enabled: !!user,
    refetchInterval: (query) => {
      // Poll every 5 seconds while processing
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'processing') {
        return 5000;
      }
      return false;
    },
  });

  // Initiate verification
  const initiateVerification = useMutation({
    mutationFn: async (): Promise<InitiateResult> => {
      const { data, error } = await supabase.functions.invoke('initiate-identity-verification');
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (result) => {
      toast({
        title: 'Verification Started',
        description: result.message,
      });
      
      queryClient.invalidateQueries({ queryKey: ['identity-verification-status'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Simulate verification completion (for demo mode)
  const simulateCompletion = useMutation({
    mutationFn: async (verificationId: string) => {
      // This would be called by webhook in production
      // For demo, directly update the record
      const { error } = await supabase
        .from('identity_verifications')
        .update({
          status: 'verified',
          verified_full_name: profile?.full_name || 'Demo User',
          selfie_match_score: 0.98,
          liveness_check_passed: true,
          document_type: 'drivers_license',
          completed_at: new Date().toISOString(),
        })
        .eq('id', verificationId);

      if (error) throw error;

      // Update profile
      await supabase
        .from('profiles')
        .update({
          is_identity_verified: true,
          identity_verification_id: verificationId,
        })
        .eq('user_id', user?.id);
    },
    onSuccess: async () => {
      toast({
        title: 'Identity Verified!',
        description: 'Your identity has been successfully verified.',
      });
      
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['identity-verification-status'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    idvStatus,
    isLoading,
    isVerified: profile?.is_identity_verified ?? false,
    initiateVerification,
    simulateCompletion,
    refetch,
  };
}
