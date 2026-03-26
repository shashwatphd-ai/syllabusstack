import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useNewJobMatchCount = () => {
  return useQuery({
    queryKey: ["new-job-match-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from("job_matches")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active");

      if (error) {
        console.error("Error fetching job match count:", error);
        return 0;
      }
      return count || 0;
    },
    staleTime: 1000 * 30,
    refetchInterval: 60000,
  });
};
