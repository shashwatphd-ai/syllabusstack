/**
 * Rate Limiter for YouTube Search Sources
 *
 * Implements token bucket rate limiting for Firecrawl, Jina, and other APIs.
 * Prevents hitting rate limits during high-volume batch searches.
 */

interface RateLimiterConfig {
  maxRequests: number;      // Max requests per window
  windowMs: number;         // Window size in milliseconds
  minDelayMs?: number;      // Minimum delay between requests
}

interface RateLimiterState {
  tokens: number;
  lastRefill: number;
  queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }>;
  processing: boolean;
}

// Rate limit configurations for each source
const RATE_LIMITS: Record<string, RateLimiterConfig> = {
  firecrawl: {
    maxRequests: 20,        // 20 requests per minute
    windowMs: 60000,
    minDelayMs: 3000,       // 3 seconds between requests
  },
  jina: {
    maxRequests: 40,        // 40 requests per minute
    windowMs: 60000,
    minDelayMs: 1500,       // 1.5 seconds between requests
  },
  invidious: {
    maxRequests: 60,        // No strict limit, but be nice
    windowMs: 60000,
    minDelayMs: 1000,
  },
  youtube_api: {
    maxRequests: 100,       // Quota-based, not rate-based
    windowMs: 60000,
    minDelayMs: 100,
  },
};

// State for each limiter (in-memory, resets on cold start)
const limiterStates: Map<string, RateLimiterState> = new Map();

/**
 * Get or create rate limiter state for a source
 */
function getState(source: string): RateLimiterState {
  if (!limiterStates.has(source)) {
    const config = RATE_LIMITS[source] || RATE_LIMITS.invidious;
    limiterStates.set(source, {
      tokens: config.maxRequests,
      lastRefill: Date.now(),
      queue: [],
      processing: false,
    });
  }
  return limiterStates.get(source)!;
}

/**
 * Refill tokens based on elapsed time
 */
function refillTokens(source: string): void {
  const state = getState(source);
  const config = RATE_LIMITS[source] || RATE_LIMITS.invidious;
  const now = Date.now();
  const elapsed = now - state.lastRefill;

  if (elapsed >= config.windowMs) {
    // Full refill
    state.tokens = config.maxRequests;
    state.lastRefill = now;
  } else {
    // Partial refill based on time elapsed
    const refillAmount = Math.floor((elapsed / config.windowMs) * config.maxRequests);
    state.tokens = Math.min(config.maxRequests, state.tokens + refillAmount);
    if (refillAmount > 0) {
      state.lastRefill = now;
    }
  }
}

/**
 * Process queued requests
 */
async function processQueue(source: string): Promise<void> {
  const state = getState(source);
  const config = RATE_LIMITS[source] || RATE_LIMITS.invidious;

  if (state.processing) return;
  state.processing = true;

  while (state.queue.length > 0) {
    refillTokens(source);

    if (state.tokens > 0) {
      const request = state.queue.shift();
      if (request) {
        state.tokens--;
        request.resolve();

        // Add minimum delay between requests
        if (config.minDelayMs && state.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, config.minDelayMs));
        }
      }
    } else {
      // Wait for token refill
      const waitTime = Math.ceil(config.windowMs / config.maxRequests);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  state.processing = false;
}

/**
 * Acquire a rate limit token for a source
 * Returns a promise that resolves when it's safe to make a request
 */
export async function acquireToken(source: string, timeoutMs: number = 30000): Promise<void> {
  const state = getState(source);

  refillTokens(source);

  // If tokens available, use one immediately
  if (state.tokens > 0) {
    state.tokens--;
    return;
  }

  // Otherwise, queue the request
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = state.queue.findIndex(r => r.resolve === resolve);
      if (index >= 0) {
        state.queue.splice(index, 1);
      }
      reject(new Error(`Rate limit timeout for ${source}`));
    }, timeoutMs);

    state.queue.push({
      resolve: () => {
        clearTimeout(timeout);
        resolve();
      },
      reject,
    });

    processQueue(source);
  });
}

/**
 * Execute a function with rate limiting
 */
export async function withRateLimit<T>(
  source: string,
  fn: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  await acquireToken(source, timeoutMs);
  return fn();
}

/**
 * Get current rate limiter status for a source
 */
export function getRateLimiterStatus(source: string): {
  availableTokens: number;
  queueLength: number;
  maxRequests: number;
} {
  const state = getState(source);
  const config = RATE_LIMITS[source] || RATE_LIMITS.invidious;

  refillTokens(source);

  return {
    availableTokens: state.tokens,
    queueLength: state.queue.length,
    maxRequests: config.maxRequests,
  };
}

/**
 * Batch execute with rate limiting
 * Processes items with concurrency control and rate limiting
 */
export async function batchWithRateLimit<T, R>(
  source: string,
  items: T[],
  fn: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    timeoutMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const {
    concurrency = 3,
    timeoutMs = 30000,
    onProgress,
  } = options;

  const results: R[] = [];
  const errors: Error[] = [];
  let completed = 0;

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(item =>
        withRateLimit(source, () => fn(item), timeoutMs)
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(result.reason);
      }
      completed++;
    }

    if (onProgress) {
      onProgress(completed, items.length);
    }
  }

  if (errors.length > 0) {
    console.log(`[RATE_LIMITER] ${source}: ${errors.length} errors in batch of ${items.length}`);
  }

  return results;
}

/**
 * Reset rate limiter for a source (for testing)
 */
export function resetRateLimiter(source: string): void {
  limiterStates.delete(source);
}
