// SyllabusStack AI Cache Utilities
// Implements caching strategy from Technical Specification v3.0

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

export interface CacheEntry {
  cache_key: string;
  cache_type: string;
  response_data: any;
  model_used: string;
  expires_at: string | null;
}

// Cache TTL configurations (in hours)
export const CACHE_TTL = {
  job_requirements: 168,  // 7 days - job requirements don't change frequently
  capability_analysis: 24, // 1 day - can change as courses are added
  gap_analysis: 1,        // 1 hour - should be fresh for decision making
  recommendations: 24,     // 1 day - can be regenerated on demand
};

/**
 * Get cached response from ai_cache table
 */
export async function getCachedResponse(
  supabase: SupabaseClient,
  cacheKey: string
): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('ai_cache')
      .select('response_data, expires_at')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Delete expired entry
      await supabase.from('ai_cache').delete().eq('cache_key', cacheKey);
      return null;
    }

    console.log(`Cache HIT for key: ${cacheKey}`);
    return data.response_data;
  } catch (e) {
    console.error('Cache lookup error:', e);
    return null;
  }
}

/**
 * Store response in ai_cache table
 */
export async function setCachedResponse(
  supabase: SupabaseClient,
  cacheKey: string,
  cacheType: string,
  responseData: any,
  modelUsed: string,
  ttlHours?: number
): Promise<void> {
  try {
    const expiresAt = ttlHours 
      ? new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
      : null;

    await supabase
      .from('ai_cache')
      .upsert({
        cache_key: cacheKey,
        cache_type: cacheType,
        response_data: responseData,
        model_used: modelUsed,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      }, { onConflict: 'cache_key' });

    console.log(`Cache SET for key: ${cacheKey}, TTL: ${ttlHours || 'forever'} hours`);
  } catch (e) {
    console.error('Cache write error:', e);
  }
}

/**
 * Track AI usage for cost monitoring
 */
export async function trackAIUsage(
  supabase: SupabaseClient,
  userId: string,
  functionName: string,
  modelUsed: string,
  inputTokens?: number,
  outputTokens?: number
): Promise<void> {
  try {
    // Rough cost estimation (adjust based on actual model pricing)
    const costPerInputToken = 0.00001;  // $0.01 per 1K tokens
    const costPerOutputToken = 0.00003; // $0.03 per 1K tokens
    
    const estimatedCost = 
      (inputTokens || 0) * costPerInputToken + 
      (outputTokens || 0) * costPerOutputToken;

    await supabase
      .from('ai_usage')
      .insert({
        user_id: userId,
        function_name: functionName,
        model_used: modelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: estimatedCost
      });
  } catch (e) {
    console.error('AI usage tracking error:', e);
  }
}

/**
 * Create a service role Supabase client for cache operations
 * (needed because ai_cache table has permissive RLS for service operations)
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}
