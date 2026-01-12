/**
 * Persistent Database Quota Tracker
 *
 * Tracks YouTube API quota usage in the database to persist across cold starts.
 * Also supports tracking for Firecrawl and Jina API usage.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// API quota configurations
const API_QUOTAS = {
  youtube: {
    dailyLimit: 10000,
    searchCost: 100,
    videoDetailsCost: 1,
    reservedForHighPriority: 2000,
  },
  firecrawl: {
    dailyLimit: 500,    // Adjust based on plan
    scrapeCost: 1,
    reservedForHighPriority: 50,
  },
  jina: {
    dailyLimit: 1000,   // Adjust based on plan
    readCost: 1,
    reservedForHighPriority: 100,
  },
};

type ApiName = keyof typeof API_QUOTAS;

/**
 * Get the Supabase client
 */
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current quota usage from database
 */
export async function getQuotaUsage(apiName: ApiName): Promise<{
  used: number;
  remaining: number;
  limit: number;
  lastUpdated: string | null;
}> {
  const supabase = getSupabaseClient();
  const today = getTodayDate();
  const config = API_QUOTAS[apiName];

  try {
    // Try to get today's usage from api_usage_tracking table
    const { data, error } = await supabase
      .from('api_usage_tracking')
      .select('units_used, updated_at')
      .eq('api_name', apiName)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error(`[QUOTA] Error fetching usage for ${apiName}:`, error);
    }

    const used = data?.units_used || 0;

    return {
      used,
      remaining: config.dailyLimit - used,
      limit: config.dailyLimit,
      lastUpdated: data?.updated_at || null,
    };
  } catch (error) {
    console.error(`[QUOTA] Failed to get usage for ${apiName}:`, error);
    // Return conservative estimate on error
    return {
      used: 0,
      remaining: config.dailyLimit,
      limit: config.dailyLimit,
      lastUpdated: null,
    };
  }
}

/**
 * Record quota usage in database
 */
export async function recordQuotaUsage(
  apiName: ApiName,
  units: number,
  operationType?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const today = getTodayDate();

  try {
    // Upsert today's usage
    const { error } = await supabase
      .from('api_usage_tracking')
      .upsert({
        api_name: apiName,
        date: today,
        units_used: units,
        operation_type: operationType || 'search',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'api_name,date',
        ignoreDuplicates: false,
      });

    if (error) {
      // If upsert fails, try to increment existing
      const { error: rpcError } = await supabase.rpc('increment_api_usage', {
        p_api_name: apiName,
        p_units: units,
        p_date: today,
      });

      if (rpcError) {
        console.error(`[QUOTA] Failed to record usage for ${apiName}:`, rpcError);
      }
    }

    console.log(`[QUOTA] ${apiName}: +${units} units recorded`);
  } catch (error) {
    console.error(`[QUOTA] Failed to record usage for ${apiName}:`, error);
  }
}

/**
 * Check if we can use an API based on quota
 */
export async function canUseApi(
  apiName: ApiName,
  unitsNeeded: number = 1,
  priority: 'normal' | 'high' = 'normal'
): Promise<boolean> {
  const usage = await getQuotaUsage(apiName);
  const config = API_QUOTAS[apiName];

  if (priority === 'high') {
    // High priority can use all remaining quota
    return usage.remaining >= unitsNeeded;
  }

  // Normal priority leaves some reserved for high priority
  const availableForNormal = usage.remaining - config.reservedForHighPriority;
  return availableForNormal >= unitsNeeded;
}

/**
 * YouTube-specific quota helpers
 */
export async function canUseYouTubeApiDb(priority: 'normal' | 'high' = 'normal'): Promise<boolean> {
  return canUseApi('youtube', API_QUOTAS.youtube.searchCost, priority);
}

export async function getYouTubeQuotaRemainingDb(): Promise<number> {
  const usage = await getQuotaUsage('youtube');
  return usage.remaining;
}

export async function recordYouTubeSearchDb(units: number = 100): Promise<void> {
  await recordQuotaUsage('youtube', units, 'search');
}

/**
 * Firecrawl-specific quota helpers
 */
export async function canUseFirecrawl(priority: 'normal' | 'high' = 'normal'): Promise<boolean> {
  return canUseApi('firecrawl', API_QUOTAS.firecrawl.scrapeCost, priority);
}

export async function recordFirecrawlUsage(units: number = 1): Promise<void> {
  await recordQuotaUsage('firecrawl', units, 'scrape');
}

/**
 * Jina-specific quota helpers
 */
export async function canUseJina(priority: 'normal' | 'high' = 'normal'): Promise<boolean> {
  return canUseApi('jina', API_QUOTAS.jina.readCost, priority);
}

export async function recordJinaUsage(units: number = 1): Promise<void> {
  await recordQuotaUsage('jina', units, 'read');
}

/**
 * Get quota summary for all APIs
 */
export async function getAllQuotaSummary(): Promise<Record<ApiName, {
  used: number;
  remaining: number;
  limit: number;
  percentUsed: number;
}>> {
  const summary: Record<string, any> = {};

  for (const apiName of Object.keys(API_QUOTAS) as ApiName[]) {
    const usage = await getQuotaUsage(apiName);
    summary[apiName] = {
      ...usage,
      percentUsed: Math.round((usage.used / usage.limit) * 100),
    };
  }

  return summary as Record<ApiName, any>;
}

/**
 * Create the api_usage_tracking table if it doesn't exist
 * Run this during deployment or as a migration
 */
export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  units_used INTEGER DEFAULT 0,
  operation_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(api_name, date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_date ON api_usage_tracking(date);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_api_name ON api_usage_tracking(api_name);

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_api_usage(
  p_api_name TEXT,
  p_units INTEGER,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS VOID AS $$
BEGIN
  INSERT INTO api_usage_tracking (api_name, date, units_used, updated_at)
  VALUES (p_api_name, p_date, p_units, NOW())
  ON CONFLICT (api_name, date)
  DO UPDATE SET
    units_used = api_usage_tracking.units_used + p_units,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
`;
