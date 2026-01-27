/**
 * Error Tracking & Monitoring Integration
 *
 * Provides centralized error tracking, reporting, and monitoring.
 * Can be integrated with external services like Sentry, LogRocket, etc.
 */

// Error severity levels
export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

// Error categories for classification
export type ErrorCategory =
  | 'api'
  | 'database'
  | 'auth'
  | 'validation'
  | 'network'
  | 'ui'
  | 'ai'
  | 'payment'
  | 'unknown';

// Error context for additional debugging info
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  route?: string;
  action?: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

// Tracked error structure
export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  timestamp: Date;
  fingerprint?: string;
  handled: boolean;
}

// Error tracking configuration
interface ErrorTrackingConfig {
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of errors to track
  ignorePatterns: RegExp[];
  maxBreadcrumbs: number;
  environment: string;
}

// Default configuration
const defaultConfig: ErrorTrackingConfig = {
  enabled: import.meta.env.PROD,
  sampleRate: 1.0, // Track all errors in production
  ignorePatterns: [
    /ResizeObserver loop/i,
    /Loading chunk \d+ failed/i,
    /Network request failed/i,
  ],
  maxBreadcrumbs: 50,
  environment: import.meta.env.MODE || 'development',
};

// In-memory error buffer (sent in batches or on critical errors)
const errorBuffer: TrackedError[] = [];
const breadcrumbs: Array<{ type: string; message: string; timestamp: Date; data?: unknown }> = [];

let config = { ...defaultConfig };
let isInitialized = false;

/**
 * Initialize error tracking
 */
export function initErrorTracking(customConfig?: Partial<ErrorTrackingConfig>): void {
  if (isInitialized) return;

  config = { ...defaultConfig, ...customConfig };

  // Set up global error handlers
  if (typeof window !== 'undefined') {
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
  }

  isInitialized = true;
  addBreadcrumb('system', 'Error tracking initialized');
}

/**
 * Track an error
 */
export function trackError(
  error: Error | string,
  options: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    context?: ErrorContext;
    handled?: boolean;
  } = {}
): TrackedError | null {
  if (!config.enabled) return null;

  const errorObj = typeof error === 'string' ? new Error(error) : error;

  // Check ignore patterns
  if (config.ignorePatterns.some(pattern => pattern.test(errorObj.message))) {
    return null;
  }

  // Apply sample rate
  if (Math.random() > config.sampleRate) {
    return null;
  }

  const trackedError: TrackedError = {
    id: generateErrorId(),
    message: errorObj.message,
    stack: errorObj.stack,
    severity: options.severity ?? 'error',
    category: options.category ?? categorizeError(errorObj),
    context: {
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      ...options.context,
    },
    timestamp: new Date(),
    fingerprint: generateFingerprint(errorObj),
    handled: options.handled ?? true,
  };

  // Add to buffer
  errorBuffer.push(trackedError);

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('[Error Tracking]', trackedError);
  }

  // For fatal errors, flush immediately
  if (trackedError.severity === 'fatal') {
    flushErrors();
  }

  return trackedError;
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  type: string,
  message: string,
  data?: unknown
): void {
  breadcrumbs.push({
    type,
    message,
    timestamp: new Date(),
    data,
  });

  // Keep only recent breadcrumbs
  while (breadcrumbs.length > config.maxBreadcrumbs) {
    breadcrumbs.shift();
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, metadata?: Record<string, unknown>): void {
  addBreadcrumb('user', `User context set: ${userId}`, metadata);
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  addBreadcrumb('user', 'User context cleared');
}

/**
 * Flush error buffer to reporting service
 */
export async function flushErrors(): Promise<void> {
  if (errorBuffer.length === 0) return;

  const errors = [...errorBuffer];
  errorBuffer.length = 0;

  // In production, send to error reporting service
  if (import.meta.env.PROD) {
    try {
      // Placeholder for external service integration
      // await sendToSentry(errors);
      // await sendToLogRocket(errors);
      console.log('[Error Tracking] Flushed', errors.length, 'errors');
    } catch (e) {
      // Re-add errors if sending fails
      errorBuffer.push(...errors);
      console.error('[Error Tracking] Failed to flush errors:', e);
    }
  }
}

/**
 * Handle global unhandled errors
 */
function handleGlobalError(event: ErrorEvent): void {
  trackError(event.error || event.message, {
    severity: 'error',
    handled: false,
    context: {
      component: 'window',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    },
  });
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const error = event.reason instanceof Error
    ? event.reason
    : new Error(String(event.reason));

  trackError(error, {
    severity: 'error',
    handled: false,
    context: {
      component: 'promise',
    },
  });
}

/**
 * Categorize error based on message and stack
 */
function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';

  if (message.includes('network') || message.includes('fetch') || message.includes('cors')) {
    return 'network';
  }
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('401')) {
    return 'auth';
  }
  if (message.includes('supabase') || message.includes('database') || message.includes('postgres')) {
    return 'database';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation';
  }
  if (message.includes('openai') || message.includes('ai') || message.includes('anthropic')) {
    return 'ai';
  }
  if (message.includes('stripe') || message.includes('payment')) {
    return 'payment';
  }
  if (stack.includes('react') || stack.includes('component')) {
    return 'ui';
  }
  if (message.includes('api') || stack.includes('/api/')) {
    return 'api';
  }

  return 'unknown';
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate error fingerprint for deduplication
 */
function generateFingerprint(error: Error): string {
  const parts = [
    error.name,
    error.message.substring(0, 100),
    error.stack?.split('\n')[1]?.trim() || '',
  ];
  return btoa(parts.join('|')).substring(0, 32);
}

/**
 * React Error Boundary helper
 */
export function captureReactError(
  error: Error,
  errorInfo: { componentStack?: string }
): TrackedError | null {
  return trackError(error, {
    severity: 'error',
    category: 'ui',
    context: {
      component: 'ErrorBoundary',
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    },
  });
}

/**
 * API error helper
 */
export function captureApiError(
  error: Error,
  endpoint: string,
  method: string,
  statusCode?: number
): TrackedError | null {
  return trackError(error, {
    severity: statusCode && statusCode >= 500 ? 'error' : 'warning',
    category: 'api',
    context: {
      action: `${method} ${endpoint}`,
      metadata: {
        endpoint,
        method,
        statusCode,
      },
    },
  });
}

/**
 * Get current error stats
 */
export function getErrorStats(): {
  buffered: number;
  breadcrumbs: number;
  initialized: boolean;
} {
  return {
    buffered: errorBuffer.length,
    breadcrumbs: breadcrumbs.length,
    initialized: isInitialized,
  };
}

/**
 * Get recent breadcrumbs for debugging
 */
export function getRecentBreadcrumbs(limit = 10): typeof breadcrumbs {
  return breadcrumbs.slice(-limit);
}

// Auto-flush errors periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (errorBuffer.length > 0) {
      flushErrors();
    }
  }, 30000); // Flush every 30 seconds
}
