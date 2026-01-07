// EduThree Standardized Error Handling
// Provides consistent error responses across all edge functions

export interface StandardError {
  error: string;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export type ErrorCode = 
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PAYMENT_REQUIRED'
  | 'AI_GATEWAY_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface ErrorConfig {
  code: ErrorCode;
  status: number;
  message: string;
}

// Predefined error configurations
export const ERRORS: Record<ErrorCode, ErrorConfig> = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401, message: 'Authentication required' },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403, message: 'Access denied' },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404, message: 'Resource not found' },
  BAD_REQUEST: { code: 'BAD_REQUEST', status: 400, message: 'Invalid request' },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400, message: 'Validation failed' },
  RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', status: 429, message: 'Too many requests' },
  PAYMENT_REQUIRED: { code: 'PAYMENT_REQUIRED', status: 402, message: 'Payment required' },
  AI_GATEWAY_ERROR: { code: 'AI_GATEWAY_ERROR', status: 502, message: 'AI service temporarily unavailable' },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500, message: 'Database operation failed' },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', status: 503, message: 'Service temporarily unavailable' }
};

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  corsHeaders: Record<string, string>,
  customMessage?: string,
  details?: Record<string, unknown>
): Response {
  const config = ERRORS[code];
  const requestId = crypto.randomUUID();
  
  const errorBody: StandardError = {
    error: config.message,
    code: config.code,
    message: customMessage || config.message,
    details,
    timestamp: new Date().toISOString(),
    requestId
  };

  // Log error for debugging
  console.error(`[${requestId}] ${code}: ${customMessage || config.message}`, details);

  return new Response(
    JSON.stringify(errorBody),
    {
      status: config.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Request-Id': requestId
      }
    }
  );
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  corsHeaders: Record<string, string>,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Handle AI gateway response errors
 */
export function handleAIGatewayError(
  response: Response,
  corsHeaders: Record<string, string>
): Response | null {
  if (response.ok) return null;

  if (response.status === 429) {
    return createErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      corsHeaders,
      'AI rate limit exceeded. Please try again later.'
    );
  }

  if (response.status === 402) {
    return createErrorResponse(
      'PAYMENT_REQUIRED',
      corsHeaders,
      'AI credits exhausted. Please add credits to continue.'
    );
  }

  if (response.status >= 500) {
    return createErrorResponse(
      'AI_GATEWAY_ERROR',
      corsHeaders,
      'AI service temporarily unavailable. Please try again.'
    );
  }

  return createErrorResponse(
    'AI_GATEWAY_ERROR',
    corsHeaders,
    `AI gateway error: ${response.status}`
  );
}

/**
 * Wrap an edge function handler with error handling
 */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response>,
  corsHeaders: Record<string, string>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      return await handler(req);
    } catch (error) {
      console.error('Unhandled error:', error);
      
      // Check for specific error types
      if (error instanceof Error) {
        // Database errors
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          return createErrorResponse(
            'BAD_REQUEST',
            corsHeaders,
            'A record with this value already exists'
          );
        }

        // Foreign key errors
        if (error.message.includes('foreign key') || error.message.includes('violates foreign key')) {
          return createErrorResponse(
            'BAD_REQUEST',
            corsHeaders,
            'Referenced record not found'
          );
        }

        // Generic database errors
        if (error.message.includes('PGRST') || error.message.includes('database')) {
          return createErrorResponse(
            'DATABASE_ERROR',
            corsHeaders,
            'Database operation failed'
          );
        }

        return createErrorResponse(
          'INTERNAL_ERROR',
          corsHeaders,
          error.message
        );
      }

      return createErrorResponse(
        'INTERNAL_ERROR',
        corsHeaders,
        'An unexpected error occurred'
      );
    }
  };
}

/**
 * Log structured info for monitoring
 */
export function logInfo(
  functionName: string,
  action: string,
  data?: Record<string, unknown>
): void {
  console.log(JSON.stringify({
    level: 'info',
    function: functionName,
    action,
    ...data,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Log structured error for monitoring
 */
export function logError(
  functionName: string,
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  console.error(JSON.stringify({
    level: 'error',
    function: functionName,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
    timestamp: new Date().toISOString()
  }));
}
