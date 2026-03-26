import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const COURSES_PAGE_SIZE = 10;

interface CoursesPage {
  courses: any[];
  nextCursor: number | null;
  totalCount: number;
}

interface UsePaginatedCoursesOptions {
  instructorId: string | undefined;
  enabled?: boolean;
}

export const usePaginatedCourses = ({ instructorId, enabled = true }: UsePaginatedCoursesOptions) => {
  return useInfiniteQuery<CoursesPage, Error>({
    queryKey: ["paginated-instructor-courses", instructorId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!instructorId) return { courses: [], nextCursor: null, totalCount: 0 };

      const from = pageParam as number;
      const to = from + COURSES_PAGE_SIZE - 1;

      const [{ data, error }, { count }] = await Promise.all([
        supabase
          .from("instructor_courses")
          .select("id, title, course_code, term, status, created_at")
          .eq("instructor_id", instructorId)
          .order("created_at", { ascending: false })
          .range(from, to),
        supabase
          .from("instructor_courses")
          .select("id", { count: "exact", head: true })
          .eq("instructor_id", instructorId),
      ]);

      if (error) throw error;

      const totalCount = count ?? 0;
      const hasMore = from + COURSES_PAGE_SIZE < totalCount;

      return {
        courses: data || [],
        nextCursor: hasMore ? from + COURSES_PAGE_SIZE : null,
        totalCount,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!instructorId && enabled,
    staleTime: 1000 * 60 * 2,
  });
};
