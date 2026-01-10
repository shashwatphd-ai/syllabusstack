// EduThree Server-Side Rate Limiting
// Implements production-grade rate limiting based on ai_usage table

// Using 'any' for SupabaseClient to avoid import issues in Deno edge runtime
type SupabaseClient = any;

export interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  maxCostPerDay: number; // USD
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: {
    hourly: number;
    daily: number;
    costBudget: number;
  };
  retryAfter?: number; // seconds
  reason?: string;
}

// Default limits for free tier users
export const FREE_TIER_LIMITS: RateLimitConfig = {
  maxRequestsPerHour: 20,
  maxRequestsPerDay: 100,
  maxCostPerDay: 2.00, // $2.00 per day (increased for testing)
};

// Pro tier limits
export const PRO_TIER_LIMITS: RateLimitConfig = {
  maxRequestsPerHour: 50,
  maxRequestsPerDay: 500,
  maxCostPerDay: 5.00, // $5 per day
};

// Enterprise limits (effectively unlimited)
export const ENTERPRISE_LIMITS: RateLimitConfig = {
  maxRequestsPerHour: 1000,
  maxRequestsPerDay: 10000,
  maxCostPerDay: 100.00,
};

/**
 * Check if user is within rate limits
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  functionName: string,
  limits: RateLimitConfig = FREE_TIER_LIMITS
): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get hourly usage
    const { count: hourlyCount, error: hourlyError } = await supabase
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', hourAgo.toISOString());

    if (hourlyError) {
      console.error('Rate limit hourly check error:', hourlyError);
      // Fail open - allow the request but log the error
      return { allowed: true, remaining: { hourly: 0, daily: 0, costBudget: 0 } };
    }

    // Get daily usage with cost
    const { data: dailyUsage, error: dailyError } = await supabase
      .from('ai_usage')
      .select('cost_usd')
      .eq('user_id', userId)
      .gte('created_at', dayAgo.toISOString());

    if (dailyError) {
      console.error('Rate limit daily check error:', dailyError);
      return { allowed: true, remaining: { hourly: 0, daily: 0, costBudget: 0 } };
    }

    const dailyCount = dailyUsage?.length || 0;
    const dailyCost = dailyUsage?.reduce((sum: number, u: { cost_usd: number | null }) => sum + (u.cost_usd || 0), 0) || 0;

    const hourlyRemaining = limits.maxRequestsPerHour - (hourlyCount || 0);
    const dailyRemaining = limits.maxRequestsPerDay - dailyCount;
    const costRemaining = limits.maxCostPerDay - dailyCost;

    // Check if any limit is exceeded
    if (hourlyRemaining <= 0) {
      // Calculate retry time (time until oldest hourly request expires)
      const retryAfter = 60 * 60; // 1 hour worst case
      return {
        allowed: false,
        remaining: { hourly: 0, daily: dailyRemaining, costBudget: costRemaining },
        retryAfter,
        reason: `Hourly limit exceeded (${limits.maxRequestsPerHour} requests/hour)`
      };
    }

    if (dailyRemaining <= 0) {
      const retryAfter = 24 * 60 * 60; // 24 hours worst case
      return {
        allowed: false,
        remaining: { hourly: hourlyRemaining, daily: 0, costBudget: costRemaining },
        retryAfter,
        reason: `Daily limit exceeded (${limits.maxRequestsPerDay} requests/day)`
      };
    }

    if (costRemaining <= 0) {
      const retryAfter = 24 * 60 * 60;
      return {
        allowed: false,
        remaining: { hourly: hourlyRemaining, daily: dailyRemaining, costBudget: 0 },
        retryAfter,
        reason: `Daily cost limit exceeded ($${limits.maxCostPerDay.toFixed(2)}/day)`
      };
    }

    console.log(`Rate limit check for ${userId}/${functionName}: ${hourlyRemaining}h/${dailyRemaining}d remaining, $${costRemaining.toFixed(2)} budget`);

    return {
      allowed: true,
      remaining: {
        hourly: hourlyRemaining,
        daily: dailyRemaining,
        costBudget: costRemaining
      }
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open on errors
    return { allowed: true, remaining: { hourly: 0, daily: 0, costBudget: 0 } };
  }
}

/**
 * Get user's subscription tier limits
 */
export async function getUserLimits(
  supabase: SupabaseClient,
  userId: string
): Promise<RateLimitConfig> {
  try {
    // Check subscriptions table for user's plan
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !subscription) {
      // No subscription = free tier
      return FREE_TIER_LIMITS;
    }

    switch (subscription.plan) {
      case 'pro':
        return PRO_TIER_LIMITS;
      case 'enterprise':
        return ENTERPRISE_LIMITS;
      default:
        return FREE_TIER_LIMITS;
    }
  } catch (error) {
    console.error('Error fetching user limits:', error);
    return FREE_TIER_LIMITS;
  }
}

/**
 * Create a rate limit error response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      message: result.reason || 'Too many requests',
      retryAfter: result.retryAfter,
      remaining: result.remaining
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter || 3600),
        'X-RateLimit-Remaining-Hourly': String(result.remaining.hourly),
        'X-RateLimit-Remaining-Daily': String(result.remaining.daily)
      }
    }
  );
}
