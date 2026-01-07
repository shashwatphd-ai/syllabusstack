import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import { analyzeDreamJob } from '@/services/dream-job-service';
import { TablesInsert } from '@/integrations/supabase/types';

type DreamJobInsert = Omit<TablesInsert<'dream_jobs'>, 'user_id'>;

interface AddDreamJobParams {
  job: DreamJobInsert;
  triggerAnalysis?: boolean;
}

async function addDreamJobWithAnalysis({ job, triggerAnalysis = true }: AddDreamJobParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Create the dream job
  const { data: newJob, error: jobError } = await supabase
    .from('dream_jobs')
    .insert({ ...job, user_id: user.id })
    .select()
    .single();

  if (jobError) throw jobError;

  // 2. Analyze job requirements if requested
  if (triggerAnalysis) {
    try {
      const analysisResult = await analyzeDreamJob(
        job.title,
        job.company_type || undefined,
        job.location || undefined,
        newJob.id
      );

      // 3. Update dream job with analysis results
      if (analysisResult) {
        await supabase
          .from('dream_jobs')
          .update({
            day_one_capabilities: analysisResult.day_one_capabilities?.slice(0, 10).map(r => r.requirement) || [],
            realistic_bar: analysisResult.realistic_bar || null,
            differentiators: analysisResult.differentiators || [],
            common_misconceptions: analysisResult.common_misconceptions || [],
          })
          .eq('id', newJob.id);

        // 4. Save job requirements
        if (analysisResult.requirements) {
          const requirementsToInsert = analysisResult.requirements.map(req => ({
            dream_job_id: newJob.id,
            skill_name: req.skill_name,
            importance: req.importance || 'important',
            category: req.category || 'General',
          }));

          await supabase.from('job_requirements').insert(requirementsToInsert);
        }
      }
    } catch (analysisError) {
      console.error('Dream job analysis failed:', analysisError);
    }
  }

  return newJob;
}

export function useAddDreamJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addDreamJobWithAnalysis,
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      
      toast({
        title: 'Dream job added',
        description: 'Your dream job has been saved and analyzed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error adding dream job',
        description: error instanceof Error ? error.message : 'Failed to add dream job',
        variant: 'destructive',
      });
    },
  });
}
