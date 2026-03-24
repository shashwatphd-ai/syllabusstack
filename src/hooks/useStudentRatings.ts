import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useStudentRatings() {
  return useQuery({
    queryKey: ['student-ratings', 'own'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('student_ratings')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSubmitStudentRating() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: {
      student_id: string;
      employer_account_id: string;
      capstone_project_id?: string;
      rating: number;
      feedback?: string;
      skills_demonstrated?: string[];
    }) => {
      const { error } = await supabase.from('student_ratings').insert(params);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-ratings'] });
      toast({ title: 'Rating Submitted' });
    },
    onError: (e: Error) => {
      toast({ title: 'Rating Failed', description: e.message, variant: 'destructive' });
    },
  });
}
