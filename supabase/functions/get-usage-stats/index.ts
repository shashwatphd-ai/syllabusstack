import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

interface UsageStats {
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
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Authorization required');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
    }

    // Parse query parameters
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "30", 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    logInfo('get-usage-stats', 'starting', { userId: user.id, days });

    // Fetch AI usage data
    const { data: usageData, error: usageError } = await supabase
      .from("ai_usage")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });

    if (usageError) {
      logError('get-usage-stats', new Error(`Failed to fetch usage data: ${usageError.message}`));
      throw new Error("Failed to fetch usage data");
    }

    // Calculate aggregated stats
    const stats: UsageStats = {
      totalCalls: 0,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byFunction: {},
      byModel: {},
      byDay: [],
      recentActivity: [],
      cacheStats: {
        totalEntries: 0,
        entriesByType: {},
        hitRate: 0,
      },
    };

    const dailyStats: Record<string, { calls: number; cost: number }> = {};

    for (const entry of usageData || []) {
      stats.totalCalls++;
      stats.totalCost += entry.cost_usd || 0;
      stats.totalInputTokens += entry.input_tokens || 0;
      stats.totalOutputTokens += entry.output_tokens || 0;

      // By function
      const fn = entry.function_name;
      if (!stats.byFunction[fn]) {
        stats.byFunction[fn] = {
          calls: 0,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          avgCostPerCall: 0,
        };
      }
      stats.byFunction[fn].calls++;
      stats.byFunction[fn].cost += entry.cost_usd || 0;
      stats.byFunction[fn].inputTokens += entry.input_tokens || 0;
      stats.byFunction[fn].outputTokens += entry.output_tokens || 0;

      // By model
      const model = entry.model_used;
      if (!stats.byModel[model]) {
        stats.byModel[model] = {
          calls: 0,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      }
      stats.byModel[model].calls++;
      stats.byModel[model].cost += entry.cost_usd || 0;
      stats.byModel[model].inputTokens += entry.input_tokens || 0;
      stats.byModel[model].outputTokens += entry.output_tokens || 0;

      // By day
      const day = entry.created_at.split("T")[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { calls: 0, cost: 0 };
      }
      dailyStats[day].calls++;
      dailyStats[day].cost += entry.cost_usd || 0;
    }

    // Calculate average cost per call for each function
    for (const fn of Object.keys(stats.byFunction)) {
      const fnStats = stats.byFunction[fn];
      fnStats.avgCostPerCall = fnStats.calls > 0 ? fnStats.cost / fnStats.calls : 0;
    }

    // Convert daily stats to array sorted by date
    stats.byDay = Object.entries(dailyStats)
      .map(([date, data]) => ({
        date,
        calls: data.calls,
        cost: data.cost,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get recent activity (last 20 entries)
    stats.recentActivity = (usageData || []).slice(0, 20).map((entry) => ({
      id: entry.id,
      functionName: entry.function_name,
      modelUsed: entry.model_used,
      cost: entry.cost_usd || 0,
      inputTokens: entry.input_tokens || 0,
      outputTokens: entry.output_tokens || 0,
      createdAt: entry.created_at,
    }));

    // Fetch cache stats using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: cacheData, error: cacheError } = await serviceClient
      .from("ai_cache")
      .select("cache_type, created_at, expires_at");

    if (!cacheError && cacheData) {
      stats.cacheStats.totalEntries = cacheData.length;

      const now = new Date();
      let validEntries = 0;

      for (const entry of cacheData) {
        // Count by type
        if (!stats.cacheStats.entriesByType[entry.cache_type]) {
          stats.cacheStats.entriesByType[entry.cache_type] = 0;
        }
        stats.cacheStats.entriesByType[entry.cache_type]++;

        // Check if still valid
        if (!entry.expires_at || new Date(entry.expires_at) > now) {
          validEntries++;
        }
      }

      // Estimate hit rate based on valid entries vs total calls
      stats.cacheStats.hitRate = stats.totalCalls > 0
        ? Math.min(100, (validEntries / stats.totalCalls) * 100)
        : 0;
    }

    // Add summary metrics
    const summary = {
      averageCostPerCall: stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0,
      averageTokensPerCall: stats.totalCalls > 0
        ? (stats.totalInputTokens + stats.totalOutputTokens) / stats.totalCalls
        : 0,
      mostUsedFunction: Object.entries(stats.byFunction)
        .sort((a, b) => b[1].calls - a[1].calls)[0]?.[0] || null,
      mostExpensiveFunction: Object.entries(stats.byFunction)
        .sort((a, b) => b[1].cost - a[1].cost)[0]?.[0] || null,
      projectedMonthlyCost: stats.totalCost * (30 / days),
    };

    logInfo('get-usage-stats', 'complete', { totalCalls: stats.totalCalls, totalCost: stats.totalCost.toFixed(4) });

    return createSuccessResponse({ ...stats, summary }, corsHeaders);
  } catch (error) {
    logError('get-usage-stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
