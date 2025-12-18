import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import type { AddDreamJobFormValues } from '@/components/forms/AddDreamJobForm';

// Types
export interface DreamJob {
  id: string;
  user_id: string;
  job_query: string;
  target_company_type?: string;
  target_location?: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  match_score?: number;
  created_at: string;
  updated_at: string;
}

export interface JobRequirement {
  id: string;
  dream_job_id: string;
  requirement_name: string;
  importance_level: 'required' | 'preferred' | 'nice-to-have';
  category: string;
  description: string;
}

// Mock data
const mockDreamJobs: DreamJob[] = [
  {
    id: '1',
    user_id: 'mock-user',
    job_query: 'Product Manager',
    target_company_type: 'tech',
    target_location: 'San Francisco, CA',
    status: 'complete',
    match_score: 72,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: 'mock-user',
    job_query: 'Business Analyst',
    target_company_type: 'consulting',
    target_location: 'New York, NY',
    status: 'complete',
    match_score: 65,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// API functions (will be replaced with Supabase calls)
const fetchDreamJobs = async (): Promise<DreamJob[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockDreamJobs;
};

const fetchDreamJobById = async (id: string): Promise<DreamJob | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockDreamJobs.find(j => j.id === id) || null;
};

const createDreamJob = async (data: AddDreamJobFormValues): Promise<DreamJob> => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const newJob: DreamJob = {
    id: Date.now().toString(),
    user_id: 'mock-user',
    job_query: data.jobQuery,
    target_company_type: data.targetCompanyType,
    target_location: data.targetLocation,
    status: 'complete',
    match_score: Math.floor(Math.random() * 30) + 50, // Random 50-80
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockDreamJobs.push(newJob);
  return newJob;
};

const deleteDreamJob = async (id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockDreamJobs.findIndex(j => j.id === id);
  if (index > -1) {
    mockDreamJobs.splice(index, 1);
  }
};

// Hooks
export function useDreamJobs() {
  return useQuery({
    queryKey: queryKeys.dreamJobsList(),
    queryFn: fetchDreamJobs,
  });
}

export function useDreamJob(id: string) {
  return useQuery({
    queryKey: queryKeys.dreamJobDetail(id),
    queryFn: () => fetchDreamJobById(id),
    enabled: !!id,
  });
}

export function useCreateDreamJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createDreamJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobsList() });
      toast({
        title: 'Dream job added',
        description: 'AI analysis has been completed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add dream job.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDreamJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteDreamJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobsList() });
      toast({
        title: 'Dream job removed',
        description: 'The dream job has been removed from your list.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove dream job.',
        variant: 'destructive',
      });
    },
  });
}
