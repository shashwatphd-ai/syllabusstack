import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DiscoveredJob {
  title: string;
  description: string;
  whyItFits: string;
  salaryRange: string;
  growthOutlook: string;
  keySkills: string[];
  dayInLife: string;
  companyTypes: string[];
}

export interface DiscoverJobsInput {
  interests?: string;
  skills?: string;
  major?: string;
  careerGoals?: string;
  workStyle?: string;
}

export interface DiscoverJobsResult {
  jobs: DiscoveredJob[];
  insights: string;
}

// Get user profile data for auto-discovery
async function getUserProfileForDiscovery(): Promise<DiscoverJobsInput> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, major')
    .eq('user_id', user.id)
    .single();

  // Get user's courses to infer major/field
  const { data: courses } = await supabase
    .from('courses')
    .select('title, key_capabilities')
    .eq('user_id', user.id)
    .limit(5);

  // Get user's capabilities to infer skills
  const { data: capabilities } = await supabase
    .from('capabilities')
    .select('name')
    .eq('user_id', user.id)
    .limit(10);

  // Get user's dream jobs for career goals context
  const { data: dreamJobs } = await supabase
    .from('dream_jobs')
    .select('title, description')
    .eq('user_id', user.id)
    .limit(3);

  return {
    interests: profile?.major || '',
    skills: capabilities?.map(c => c.name).join(', ') || '',
    major: courses?.[0]?.title || '',
    careerGoals: dreamJobs?.map(j => j.title).join(', ') || '',
  };
}

// Discover dream jobs using AI
async function discoverDreamJobs(input: DiscoverJobsInput): Promise<DiscoverJobsResult> {
  const { data, error } = await supabase.functions.invoke('discover-dream-jobs', {
    body: input,
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error || 'Failed to discover jobs');

  return {
    jobs: data.jobs || [],
    insights: data.insights || '',
  };
}

// Hook to discover dream jobs with custom input
export function useDiscoverDreamJobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: discoverDreamJobs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-jobs'] });
      toast({
        title: 'Career paths discovered!',
        description: 'Check out your personalized job suggestions.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Discovery failed',
        description: error instanceof Error ? error.message : 'Failed to discover career paths',
        variant: 'destructive',
      });
    },
  });
}

// Hook to auto-discover jobs based on user's profile
export function useAutoDiscoverDreamJobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const profileData = await getUserProfileForDiscovery();
      return discoverDreamJobs(profileData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovered-jobs'] });
      toast({
        title: 'Career paths discovered!',
        description: 'Based on your profile and courses.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Discovery failed',
        description: error instanceof Error ? error.message : 'Failed to discover career paths',
        variant: 'destructive',
      });
    },
  });
}

// Cache discovered jobs in local state (could be extended to store in DB)
export function useDiscoveredJobs() {
  return useQuery({
    queryKey: ['discovered-jobs'],
    queryFn: async () => {
      // For now, return empty - jobs are fetched via mutation
      // Could be extended to store/retrieve from database
      return [] as DiscoveredJob[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
