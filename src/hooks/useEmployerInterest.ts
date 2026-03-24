import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSubmitEmployerInterest() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (submission: {
      company_name: string;
      contact_name: string;
      contact_email: string;
      contact_phone?: string;
      project_description?: string;
      target_skills?: string[];
      preferred_timeline?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('employer_interest_submissions').insert({
        ...submission,
        submitted_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employer-interest'] });
      toast({ title: 'Interest Submitted', description: 'Your partnership interest has been recorded.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Submission Failed', description: e.message, variant: 'destructive' });
    },
  });
}

export function useEmployerInterestSubmissions() {
  return useQuery({
    queryKey: ['employer-interest', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employer_interest_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpdateEmployerInterest() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('employer_interest_submissions')
        .update({ status, notes, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employer-interest'] });
      toast({ title: 'Submission Updated' });
    },
  });
}
