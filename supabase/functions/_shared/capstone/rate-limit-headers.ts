/**
 * Rate Limiting Headers Utility (Capstone)
 *
 * Provides consistent X-RateLimit-* headers for capstone edge functions.
 * Includes an in-memory sliding-window rate limiter and cleanup utilities.
 *
 * Headers included:
 * - X-RateLimit-Limit: Maximum requests per window
 * - X-RateLimit-Remaining: Requests remaining in current window
 * - X-RateLimit-Reset: Unix timestamp when window resets
 */

// ============================================================================
// TYPES
// ============================================================================

export type RateLimitTier =
  | 'PUBLIC_HIGH'
  | 'AUTHENTICATED_STANDARD'
  | 'RESOURCE_INTENSIVE'
  | 'ADMIN_RESTRICTED'
  | 'WEBHOOK';

export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  /** Requests remaining in current window */
  remaining: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Unix timestamp when window resets */
  resetAt?: number;
  /** Whether the request is rate limited */
  isLimited?: boolean;
}

// ============================================================================
// TIER CONFIGURATIONS
// ============================================================================

const RATE_LIMIT_CONFIGS: Record<RateLimitTier, { limit: number; windowSeconds: number }> = {
  PUBLIC_HIGH: { limit: 100, windowSeconds: 60 },
  AUTHENTICATED_STANDARD: { limit: 60, windowSeconds: 60 },
  RESOURCE_INTENSIVE: { limit: 20, windowSeconds: 60 },
  ADMIN_RESTRICTED: { limit: 10, windowSeconds: 60 },
  WEBHOOK: { limit: 50, windowSeconds: 60 },
};

// ============================================================================
// HEADER GENERATION
// ============================================================================

/**
 * Generate X-RateLimit-* headers from a config object.
 */
function getRateLimitHeaders(config: RateLimitConfig): Record<string, string> {
  const resetAt = config.resetAt || Math.floor(Date.now() / 1000) + config.windowSeconds;

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(config.limit),
    'X-RateLimit-Remaining': String(Math.max(0, config.remaining)),
    'X-RateLimit-Reset': String(resetAt),
  };

  if (config.isLimited || config.remaining <= 0) {
    const retryAfter = Math.max(1, resetAt - Math.floor(Date.now() / 1000));
    headers['Retry-After'] = String(retryAfter);
  }

  return headers;
}

/**
 * Create rate limit headers with estimated remaining based on tier.
 * Useful when actual rate limiting state is not available.
 */
export function getEstimatedRateLimitHeaders(
  tier: RateLimitTier = 'AUTHENTICATED_STANDARD',
  estimatedUsage: number = 0,
): Record<string, string> {
  const config = RATE_LIMIT_CONFIGS[tier];
  const remaining = Math.max(0, config.limit - estimatedUsage);

  return getRateLimitHeaders({
    limit: config.limit,
    remaining,
    windowSeconds: config.windowSeconds,
    isLimited: remaining <= 0,
  });
}

// ============================================================================
// IN-MEMORY SLIDING WINDOW RATE LIMITER
// ============================================================================

interface SlidingWindowEntry {
  timestamps: number[];
}

const slidingWindows = new Map<string, SlidingWindowEntry>();

/**
 * Check whether a request should be rate-limited using an in-memory
 * sliding window. Returns an object with the current state.
 *
 * @param key - Unique identifier for the client (e.g., user ID, IP)
 * @param limit - Maximum allowed requests in the window
 * @param windowMs - Window size in milliseconds
 * @returns Object with `allowed`, `remaining`, `resetAt`, and header helpers
 */
export function checkInMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAtMs: number; headers: Record<string, string> } {
  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = slidingWindows.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    slidingWindows.set(key, entry);
  }

  // Prune timestamps outside the window
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

  const count = entry.timestamps.length;
  const allowed = count < limit;

  if (allowed) {
    entry.timestamps.push(now);
  }

  const remaining = Math.max(0, limit - entry.timestamps.length);
  const resetAtMs = entry.timestamps.length > 0
    ? entry.timestamps[0] + windowMs
    : now + windowMs;
  const resetAtSec = Math.ceil(resetAtMs / 1000);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetAtSec),
  };

  if (!allowed) {
    headers['Retry-After'] = String(Math.max(1, resetAtSec - Math.floor(now / 1000)));
  }

  return { allowed, remaining, resetAtMs, headers };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Remove expired sliding-window entries to prevent memory leaks.
 * Call periodically (e.g., every few minutes).
 */
export function cleanupSlidingWindows(maxWindowMs: number = 120_000): void {
  const cutoff = Date.now() - maxWindowMs;

  for (const [key, entry] of slidingWindows.entries()) {
    // Remove entries whose newest timestamp is older than the cutoff
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
      slidingWindows.delete(key);
    }
  }
}

/**
 * Clear all in-memory rate limit state. Primarily for testing.
 */
export function resetAllRateLimits(): void {
  slidingWindows.clear();
}
