import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DemandSignalFull {
  id: string;
  skill_name: string;
  demand_level: string | null;
  source: string | null;
  region: string | null;
  industry: string | null;
  job_title: string | null;
  salary_range: string | null;
  growth_rate: number | null;
  posting_count: number | null;
  metadata: any | null;
  created_at: string;
}

export interface DemandSignalFilters {
  industry?: string;
  region?: string;
  search?: string;
}

export const useDemandSignalsEnhanced = (filters?: DemandSignalFilters) => {
  return useQuery({
    queryKey: ["demand-signals-enhanced", filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("demand_signals")
        .select("*")
        .order("posting_count", { ascending: false });

      if (filters?.industry) {
        query = query.ilike("industry", `%${filters.industry}%`);
      }
      if (filters?.region) {
        query = query.ilike("region", `%${filters.region}%`);
      }
      if (filters?.search) {
        query = query.ilike("skill_name", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching demand signals:", error);
        throw error;
      }
      return (data ?? []) as DemandSignalFull[];
    },
    staleTime: 1000 * 60 * 5,
  });
};
