import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PROJECTS_PAGE_SIZE = 20;

interface UsePaginatedProjectsOptions {
  instructorCourseId?: string;
  enabled?: boolean;
}

interface ProjectsPage {
  projects: any[];
  nextCursor: number | null;
  totalCount: number;
}

export const usePaginatedProjects = ({ instructorCourseId, enabled = true }: UsePaginatedProjectsOptions) => {
  return useInfiniteQuery<ProjectsPage, Error>({
    queryKey: ["paginated-capstone-projects", instructorCourseId],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam as number;
      const to = from + PROJECTS_PAGE_SIZE - 1;

      let query = supabase
        .from("capstone_projects")
        .select("*, company_profiles(name, sector, city, organization_logo_url)")
        .order("created_at", { ascending: false })
        .range(from, to);

      let countQuery = supabase
        .from("capstone_projects")
        .select("id", { count: "exact", head: true });

      if (instructorCourseId) {
        query = query.eq("instructor_course_id", instructorCourseId);
        countQuery = countQuery.eq("instructor_course_id", instructorCourseId);
      }

      const [{ data, error }, { count }] = await Promise.all([query, countQuery]);
      if (error) throw error;

      const totalCount = count ?? 0;
      const hasMore = from + PROJECTS_PAGE_SIZE < totalCount;

      return {
        projects: data || [],
        nextCursor: hasMore ? from + PROJECTS_PAGE_SIZE : null,
        totalCount,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
};
