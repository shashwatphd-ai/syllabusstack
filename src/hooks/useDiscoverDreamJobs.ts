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

// Get user profile data for auto-discovery - parallelized with Promise.all
async function getUserProfileForDiscovery(): Promise<DiscoverJobsInput> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  // Fetch all data in parallel instead of 4 sequential queries
  const [
    { data: profile },
    { data: courses },
    { data: capabilities },
    { data: dreamJobs }
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, major')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('courses')
      .select('title, key_capabilities')
      .eq('user_id', user.id)
      .limit(5),
    supabase
      .from('capabilities')
      .select('name')
      .eq('user_id', user.id)
      .limit(10),
    supabase
      .from('dream_jobs')
      .select('title, description')
      .eq('user_id', user.id)
      .limit(3)
  ]);

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

// Database-backed discovered career type
export interface DiscoveredCareer {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  why_it_fits: string | null;
  salary_range: string | null;
  growth_outlook: string | null;
  key_skills: string[];
  day_in_life: string | null;
  company_types: string[];
  discovery_input: Record<string, unknown>;
  is_added_to_dream_jobs: boolean;
  created_at: string;
}

// Fetch discovered careers from database
export function useDiscoveredJobs() {
  return useQuery({
    queryKey: ['discovered-jobs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('discovered_careers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DiscoveredCareer[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Add a discovered career to dream jobs
export function useAddDiscoveredToDreamJobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (career: DiscoveredCareer) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create dream job from discovered career
      const { data: dreamJob, error: djError } = await supabase
        .from('dream_jobs')
        .insert({
          user_id: user.id,
          title: career.title,
          description: career.description,
          source_type: 'discovery',
          requirements_keywords: career.key_skills || [],
        })
        .select()
        .single();

      if (djError) throw djError;

      // Mark discovered career as added
      const { error: updateError } = await supabase
        .from('discovered_careers')
        .update({ is_added_to_dream_jobs: true })
        .eq('id', career.id);

      if (updateError) {
        console.error('Failed to update discovered career:', updateError);
      }

      return dreamJob;
    },
    onSuccess: (dreamJob) => {
      queryClient.invalidateQueries({ queryKey: ['discovered-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dream-jobs'] });
      toast({
        title: 'Added to Dream Jobs!',
        description: `${dreamJob.title} is now in your dream jobs`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}
