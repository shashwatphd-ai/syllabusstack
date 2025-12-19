import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UsageStats {
  totalCalls: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byFunction: Record<string, {
    calls: number;
    cost: number;
    inputTokens: number;
    outputTokens: number;
    avgCostPerCall: number;
  }>;
  byModel: Record<string, {
    calls: number;
    cost: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  byDay: Array<{
    date: string;
    calls: number;
    cost: number;
  }>;
  recentActivity: Array<{
    id: string;
    functionName: string;
    modelUsed: string;
    cost: number;
    inputTokens: number;
    outputTokens: number;
    createdAt: string;
  }>;
  cacheStats: {
    totalEntries: number;
    entriesByType: Record<string, number>;
    hitRate: number;
  };
  summary: {
    averageCostPerCall: number;
    averageTokensPerCall: number;
    mostUsedFunction: string | null;
    mostExpensiveFunction: string | null;
    projectedMonthlyCost: number;
  };
}

async function fetchUsageStats(days: number): Promise<UsageStats> {
  const { data, error } = await supabase.functions.invoke("get-usage-stats", {
    body: {},
  });

  if (error) {
    throw new Error(error.message || "Failed to fetch usage stats");
  }

  return data as UsageStats;
}

export function useUsageStats(days: number = 30) {
  return useQuery({
    queryKey: ["usage-stats", days],
    queryFn: () => fetchUsageStats(days),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
