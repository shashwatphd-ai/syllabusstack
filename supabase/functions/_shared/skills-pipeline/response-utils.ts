// Enterprise-grade response utilities for Skills Assessment Pipeline
// Provides standardized responses, error handling, and logging

import { ErrorCodes, ValidationError } from './validation.ts';

// Default CORS headers (fallback for backward compatibility)
const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured response format for all pipeline endpoints
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: ValidationError[] | Record<string, unknown>;
  };
  meta?: {
    request_id: string;
    timestamp: string;
    duration_ms?: number;
  };
}

// Generate unique request ID for tracing
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Create success response
export function successResponse<T>(
  data: T,
  requestId: string,
  startTime?: number,
  corsHeaders?: Record<string, string>
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      duration_ms: startTime ? Date.now() - startTime : undefined,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...(corsHeaders || defaultCorsHeaders), 'Content-Type': 'application/json' },
  });
}

// Create error response
export function errorResponse(
  code: string,
  message: string,
  statusCode: number,
  requestId: string,
  details?: ValidationError[] | Record<string, unknown>,
  corsHeaders?: Record<string, string>
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  };

  console.error(`[${requestId}] Error ${code}: ${message}`, details);

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: { ...(corsHeaders || defaultCorsHeaders), 'Content-Type': 'application/json' },
  });
}

// Create validation error response
export function validationErrorResponse(
  errors: ValidationError[],
  requestId: string,
  corsHeaders?: Record<string, string>
): Response {
  return errorResponse(
    ErrorCodes.VALIDATION_REQUIRED_FIELD,
    'Validation failed',
    400,
    requestId,
    errors,
    corsHeaders
  );
}

// Create auth error response
export function authErrorResponse(
  code: string,
  message: string,
  requestId: string,
  corsHeaders?: Record<string, string>
): Response {
  return errorResponse(code, message, 401, requestId, undefined, corsHeaders);
}

// Create not found response
export function notFoundResponse(
  resource: string,
  requestId: string,
  corsHeaders?: Record<string, string>
): Response {
  return errorResponse(
    ErrorCodes.RESOURCE_NOT_FOUND,
    `${resource} not found`,
    404,
    requestId,
    undefined,
    corsHeaders
  );
}

// Create rate limit response
export function rateLimitResponse(
  message: string,
  retryAfter: number,
  requestId: string,
  remaining?: { hourly: number; daily: number; costBudget: number },
  corsHeaders?: Record<string, string>
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message,
      details: { remaining },
    },
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return new Response(JSON.stringify(response), {
    status: 429,
    headers: {
      ...(corsHeaders || defaultCorsHeaders),
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
  });
}

// Create internal error response
export function internalErrorResponse(
  error: unknown,
  requestId: string,
  corsHeaders?: Record<string, string>
): Response {
  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error(`[${requestId}] Internal error:`, error);

  return errorResponse(
    ErrorCodes.INTERNAL_ERROR,
    message,
    500,
    requestId,
    undefined,
    corsHeaders
  );
}

// Create CORS preflight response
export function corsPreflightResponse(corsHeaders?: Record<string, string>): Response {
  return new Response(null, { headers: corsHeaders || defaultCorsHeaders });
}

// Structured logger for edge functions
export class PipelineLogger {
  private requestId: string;
  private functionName: string;
  private startTime: number;

  constructor(functionName: string, requestId: string) {
    this.requestId = requestId;
    this.functionName = functionName;
    this.startTime = Date.now();
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.log(`[${this.requestId}] [${this.functionName}] ${message}`, data ? JSON.stringify(data) : '');
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(`[${this.requestId}] [${this.functionName}] WARN: ${message}`, data ? JSON.stringify(data) : '');
  }

  error(message: string, error?: unknown): void {
    console.error(`[${this.requestId}] [${this.functionName}] ERROR: ${message}`, error);
  }

  duration(): number {
    return Date.now() - this.startTime;
  }

  complete(outcome: 'success' | 'error', data?: Record<string, unknown>): void {
    const duration = this.duration();
    console.log(`[${this.requestId}] [${this.functionName}] COMPLETE: ${outcome} in ${duration}ms`, data ? JSON.stringify(data) : '');
  }
}

// Helper to extract user from auth header
export async function authenticateRequest(
  req: Request,
  supabase: { auth: { getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: Error | null }> } },
  requestId: string,
  corsHeaders?: Record<string, string>
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return authErrorResponse(
      ErrorCodes.AUTH_MISSING_HEADER,
      'Authorization header is required',
      requestId,
      corsHeaders
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    return authErrorResponse(
      ErrorCodes.AUTH_INVALID_TOKEN,
      'Invalid or expired token',
      requestId,
      corsHeaders
    );
  }

  return { userId: authData.user.id };
}

// Track AI usage for billing and analytics
export async function trackAiUsage(
  supabase: { from: (table: string) => { insert: (data: Record<string, unknown>) => Promise<{ error: Error | null }> } },
  userId: string,
  functionName: string,
  modelUsed: string,
  inputTokens?: number,
  outputTokens?: number,
  costUsd?: number
): Promise<void> {
  try {
    await supabase.from('ai_usage').insert({
      user_id: userId,
      function_name: functionName,
      model_used: modelUsed,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to track AI usage:', error);
    // Don't fail the request if tracking fails
  }
}
