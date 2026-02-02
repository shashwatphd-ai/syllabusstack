/**
 * Edge Function Monitoring & Metrics
 *
 * Provides structured logging for performance metrics, health checks,
 * and operational monitoring. Outputs in JSON format for log aggregation.
 *
 * Designed to work with Supabase Edge Function logs and external
 * monitoring services like Datadog, New Relic, or CloudWatch.
 */

export interface MetricEvent {
  type: 'metric';
  name: string;
  value: number;
  unit: MetricUnit;
  tags?: Record<string, string>;
  timestamp: string;
}

export type MetricUnit = 'ms' | 'count' | 'bytes' | 'percent' | 'requests';

/**
 * Log a metric value
 */
export function logMetric(
  name: string,
  value: number,
  unit: MetricUnit = 'count',
  tags?: Record<string, string>
): void {
  const event: MetricEvent = {
    type: 'metric',
    name,
    value,
    unit,
    tags,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(event));
}

/**
 * Measure and log function execution duration
 */
export function logDuration(
  functionName: string,
  startTime: number,
  success: boolean = true,
  additionalTags?: Record<string, string>
): void {
  const duration = Date.now() - startTime;
  logMetric('function_duration_ms', duration, 'ms', {
    function: functionName,
    success: String(success),
    ...additionalTags,
  });
}

/**
 * Log AI model usage for cost tracking
 */
export function logAIUsage(
  functionName: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number
): void {
  console.log(JSON.stringify({
    type: 'ai_usage',
    function: functionName,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log database operation metrics
 */
export function logDbOperation(
  functionName: string,
  operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc',
  table: string,
  durationMs: number,
  rowCount?: number
): void {
  console.log(JSON.stringify({
    type: 'db_operation',
    function: functionName,
    operation,
    table,
    duration_ms: durationMs,
    row_count: rowCount,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log HTTP request/response for external API calls
 */
export function logExternalApiCall(
  functionName: string,
  service: string,
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number
): void {
  console.log(JSON.stringify({
    type: 'external_api',
    function: functionName,
    service,
    endpoint,
    method,
    status_code: statusCode,
    duration_ms: durationMs,
    success: statusCode >= 200 && statusCode < 400,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log cache hit/miss events
 */
export function logCacheEvent(
  functionName: string,
  cacheKey: string,
  hit: boolean,
  ttlSeconds?: number
): void {
  console.log(JSON.stringify({
    type: 'cache',
    function: functionName,
    cache_key: cacheKey,
    hit,
    ttl_seconds: ttlSeconds,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log queue/job processing events
 */
export function logJobEvent(
  functionName: string,
  jobId: string,
  event: 'started' | 'completed' | 'failed' | 'retrying',
  durationMs?: number,
  error?: string
): void {
  console.log(JSON.stringify({
    type: 'job',
    function: functionName,
    job_id: jobId,
    event,
    duration_ms: durationMs,
    error,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Performance timing helper
 * Returns a function to call when operation completes
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * Health check response for monitoring endpoints
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_ms: number;
  checks: Record<string, {
    status: 'pass' | 'fail';
    message?: string;
    duration_ms?: number;
  }>;
  timestamp: string;
}

/**
 * Create a health check response
 */
export function createHealthCheck(
  version: string,
  checks: HealthCheckResult['checks']
): HealthCheckResult {
  const allPassing = Object.values(checks).every(c => c.status === 'pass');
  const anyFailing = Object.values(checks).some(c => c.status === 'fail');

  return {
    status: anyFailing ? 'unhealthy' : allPassing ? 'healthy' : 'degraded',
    version,
    uptime_ms: Date.now(), // In production, track actual uptime
    checks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Alerting thresholds for monitoring
 */
export const ALERT_THRESHOLDS = {
  // Response time thresholds (ms)
  response_time_warning: 2000,
  response_time_critical: 5000,

  // Error rate thresholds (percentage)
  error_rate_warning: 1,
  error_rate_critical: 5,

  // Rate limit thresholds
  rate_limit_warning: 80, // 80% of limit used
  rate_limit_critical: 95,

  // AI token thresholds (per request)
  ai_tokens_warning: 50000,
  ai_tokens_critical: 100000,
};

/**
 * Check if a metric exceeds thresholds and log alert
 */
export function checkThreshold(
  metricName: keyof typeof ALERT_THRESHOLDS,
  value: number,
  functionName: string
): 'ok' | 'warning' | 'critical' {
  const warningKey = `${metricName}_warning` as keyof typeof ALERT_THRESHOLDS;
  const criticalKey = `${metricName}_critical` as keyof typeof ALERT_THRESHOLDS;

  const warning = ALERT_THRESHOLDS[warningKey] || ALERT_THRESHOLDS[metricName];
  const critical = ALERT_THRESHOLDS[criticalKey];

  let status: 'ok' | 'warning' | 'critical' = 'ok';

  if (critical && value >= critical) {
    status = 'critical';
  } else if (warning && value >= warning) {
    status = 'warning';
  }

  if (status !== 'ok') {
    console.log(JSON.stringify({
      type: 'alert',
      level: status,
      metric: metricName,
      value,
      threshold: status === 'critical' ? critical : warning,
      function: functionName,
      timestamp: new Date().toISOString(),
    }));
  }

  return status;
}
