import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  employment_type: string;
  experience_level: string | null;
  description: string;
  requirements: string[];
  skills: string[];
  benefits: string[];
  apply_url: string | null;
  company_url: string | null;
  posted_date: string | null;
  source: string;
}

export interface JobSearchParams {
  title: string;
  location?: string;
  skills?: string[];
  limit?: number;
}

export interface JobSearchResult {
  success: boolean;
  jobs: Job[];
  total: number;
  query: JobSearchParams;
  fallback?: boolean;
  error?: string;
}

/**
 * Hook to search for jobs using Active Jobs DB
 *
 * Usage:
 *   const { mutate: searchJobs, data, isPending } = useSearchJobs();
 *   searchJobs({ title: "Software Engineer", location: "Remote" });
 */
export function useSearchJobs() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: JobSearchParams): Promise<JobSearchResult> => {
      const { data, error } = await supabase.functions.invoke("search-jobs", {
        body: params,
      });

      if (error) {
        throw new Error(error.message || "Failed to search jobs");
      }

      // Check if fallback is needed (RAPIDAPI_KEY not configured)
      if (data.fallback) {
        throw new Error(data.message || "Job search not available");
      }

      return data;
    },
    onError: (error) => {
      toast({
        title: "Job Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to create a dream job from a search result
 *
 * Usage:
 *   const { mutate: createFromJob } = useCreateDreamJobFromSearch();
 *   createFromJob(selectedJob);
 */
export function useCreateDreamJobFromSearch() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (job: Job) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Format salary range as string (schema has salary_range, not salary_min/max)
      const salaryRange = job.salary_min && job.salary_max
        ? `$${(job.salary_min / 1000).toFixed(0)}k - $${(job.salary_max / 1000).toFixed(0)}k`
        : job.salary_max
        ? `Up to $${(job.salary_max / 1000).toFixed(0)}k`
        : job.salary_min
        ? `From $${(job.salary_min / 1000).toFixed(0)}k`
        : null;

      // Create dream job from search result
      // Schema: user_id, title, description, location, company_type, salary_range, requirements_keywords
      const { data: dreamJob, error: createError } = await supabase
        .from("dream_jobs")
        .insert({
          user_id: user.id,
          title: `${job.title} at ${job.company}`,
          description: job.description,
          location: job.location,
          salary_range: salaryRange,
          requirements_keywords: job.requirements.slice(0, 10),
        })
        .select()
        .single();

      if (createError) throw createError;

      // Store job requirements
      // Schema: dream_job_id, skill_name (required), category, importance
      if (job.requirements.length > 0) {
        const requirements = job.requirements.map((req, index) => ({
          dream_job_id: dreamJob.id,
          skill_name: req,
          category: "skill",
          importance: index < 3 ? "required" : "preferred",
        }));

        await supabase.from("job_requirements").insert(requirements);
      }

      return dreamJob;
    },
    onSuccess: () => {
      toast({
        title: "Dream Job Added",
        description: "Job added to your career goals. Running gap analysis...",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Add Job",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Check if job search is available (RAPIDAPI_KEY configured)
 */
export function useJobSearchAvailable() {
  return useQuery({
    queryKey: ["jobSearchAvailable"],
    queryFn: async () => {
      try {
        const { data } = await supabase.functions.invoke("search-jobs", {
          body: { title: "test", limit: 1 },
        });
        return !data.fallback;
      } catch {
        return false;
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
}
