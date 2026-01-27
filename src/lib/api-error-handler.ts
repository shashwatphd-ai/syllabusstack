import { PostgrestError } from '@supabase/supabase-js';

// Error types for better categorization
export type ErrorType =
  | 'network'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'not_found'
  | 'rate_limit'
  | 'server'
  | 'unknown';

export interface APIError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: string;
  retryable: boolean;
  suggestedAction?: string;
}

// User-friendly error messages
const ERROR_MESSAGES: Record<string, { message: string; suggestion?: string }> = {
  // Auth errors
  'PGRST301': { message: 'Authentication required', suggestion: 'Please sign in to continue' },
  'PGRST302': { message: 'Session expired', suggestion: 'Please sign in again' },
  '23505': { message: 'This record already exists', suggestion: 'Try updating instead of creating' },
  '23503': { message: 'Referenced record not found', suggestion: 'The related item may have been deleted' },
  '42501': { message: 'You don\'t have permission to do this', suggestion: 'Contact support if you need access' },
  '42P01': { message: 'Data not available yet', suggestion: 'Try refreshing the page' },
  '23514': { message: 'Invalid data provided', suggestion: 'Please check your input' },
  '22P02': { message: 'Invalid format', suggestion: 'Please check the data format' },
  '54000': { message: 'Too many results', suggestion: 'Try narrowing your search' },

  // Network errors
  'NETWORK_ERROR': { message: 'Connection problem', suggestion: 'Check your internet connection' },
  'TIMEOUT': { message: 'Request timed out', suggestion: 'Please try again' },

  // Rate limiting
  '429': { message: 'Too many requests', suggestion: 'Please wait a moment and try again' },

  // Server errors
  '500': { message: 'Server error', suggestion: 'We\'re working on it. Please try again later' },
  '503': { message: 'Service temporarily unavailable', suggestion: 'Please try again in a few minutes' },
};

/**
 * Parse and categorize API errors
 */
export function parseAPIError(error: unknown): APIError {
  // Handle Supabase PostgrestError
  if (isPostgrestError(error)) {
    return parsePostgrestError(error);
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return parseStandardError(error);
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      type: 'unknown',
      message: error,
      retryable: false,
    };
  }

  // Handle object errors with message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return {
      type: 'unknown',
      message: String((error as { message: unknown }).message),
      retryable: false,
    };
  }

  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    retryable: true,
    suggestedAction: 'Please try again',
  };
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

function parsePostgrestError(error: PostgrestError): APIError {
  const code = error.code;
  const knownError = ERROR_MESSAGES[code];

  // Determine error type
  let type: ErrorType = 'unknown';
  if (code.startsWith('PGRST30') || code === '42501') {
    type = 'auth';
  } else if (code === '42P01') {
    type = 'not_found';
  } else if (code.startsWith('23')) {
    type = 'validation';
  } else if (code.startsWith('5') || code.startsWith('54')) {
    type = 'server';
  }

  return {
    type,
    message: knownError?.message || error.message,
    code,
    details: error.details || error.hint || undefined,
    retryable: type === 'server' || type === 'network',
    suggestedAction: knownError?.suggestion,
  };
}

function parseStandardError(error: Error): APIError {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return {
      type: 'network',
      message: 'Connection problem',
      retryable: true,
      suggestedAction: 'Check your internet connection and try again',
    };
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      type: 'network',
      message: 'Request timed out',
      retryable: true,
      suggestedAction: 'Please try again',
    };
  }

  // Auth errors
  if (message.includes('unauthorized') || message.includes('unauthenticated') || message.includes('auth')) {
    return {
      type: 'auth',
      message: 'Authentication required',
      retryable: false,
      suggestedAction: 'Please sign in to continue',
    };
  }

  // Permission errors
  if (message.includes('forbidden') || message.includes('permission')) {
    return {
      type: 'permission',
      message: 'Access denied',
      retryable: false,
      suggestedAction: 'You don\'t have permission to do this',
    };
  }

  return {
    type: 'unknown',
    message: error.message,
    retryable: false,
  };
}

/**
 * Get a user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  const parsed = parseAPIError(error);
  return parsed.message;
}

/**
 * Get error with suggested action
 */
export function getErrorWithAction(error: unknown): { message: string; action?: string } {
  const parsed = parseAPIError(error);
  return {
    message: parsed.message,
    action: parsed.suggestedAction,
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const parsed = parseAPIError(error);
  return parsed.retryable;
}

/**
 * Create a retry wrapper for API calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      onRetry?.(attempt, error);
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }

  throw lastError;
}

/**
 * Error boundary helper - creates error info for display
 */
export function createErrorInfo(error: unknown, componentStack?: string) {
  const parsed = parseAPIError(error);

  return {
    ...parsed,
    componentStack,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };
}

/**
 * Log error to console with formatting
 */
export function logError(context: string, error: unknown) {
  const parsed = parseAPIError(error);

  console.group(`🔴 Error: ${context}`);
  console.error('Type:', parsed.type);
  console.error('Message:', parsed.message);
  if (parsed.code) console.error('Code:', parsed.code);
  if (parsed.details) console.error('Details:', parsed.details);
  console.error('Retryable:', parsed.retryable);
  console.error('Raw error:', error);
  console.groupEnd();
}
