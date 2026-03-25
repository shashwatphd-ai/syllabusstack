/**
 * Safe JSON Parsing Utilities for Capstone Edge Functions
 * Ported from EduThree — provides safe parsing with proper error handling
 */

import { getCorsHeaders } from '../cors.ts';

export interface ParseSuccess<T> {
  success: true;
  data: T;
}

export interface ParseError {
  success: false;
  error: string;
  response: Response;
}

export type ParseResult<T> = ParseSuccess<T> | ParseError;

export function createBadRequestResponse(req: Request, message: string = 'Invalid JSON in request body'): Response {
  console.error('[JSON Parser] Bad request:', message);
  return new Response(
    JSON.stringify({ error: message, code: 'INVALID_JSON' }),
    { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
  );
}

export function safeParse<T = unknown>(jsonString: string, req: Request): ParseResult<T> {
  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown JSON parse error';
    return {
      success: false,
      error: errorMessage,
      response: createBadRequestResponse(req, `Invalid JSON: ${errorMessage}`)
    };
  }
}

export async function safeParseRequestBody<T = unknown>(req: Request): Promise<ParseResult<T>> {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return { success: true, data: {} as T };
    }
    const text = await req.text();
    if (!text || text.trim() === '') {
      return { success: true, data: {} as T };
    }
    return safeParse<T>(text, req);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to read request body';
    return {
      success: false,
      error: errorMessage,
      response: createBadRequestResponse(req, `Failed to read request body: ${errorMessage}`)
    };
  }
}

export function validateRequiredFields<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[],
  req: Request
): { valid: true } | { valid: false; response: Response; missingFields: string[] } {
  const missingFields: string[] = [];
  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(String(field));
    }
  }
  if (missingFields.length > 0) {
    return {
      valid: false,
      missingFields,
      response: new Response(
        JSON.stringify({ error: `Missing required fields: ${missingFields.join(', ')}`, code: 'MISSING_FIELDS', missing: missingFields }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    };
  }
  return { valid: true };
}

export async function parseAndValidate<T extends Record<string, unknown>>(
  req: Request,
  requiredFields: (keyof T)[]
): Promise<ParseResult<T>> {
  const parseResult = await safeParseRequestBody<T>(req);
  if (!parseResult.success) return parseResult;
  const validation = validateRequiredFields(parseResult.data, requiredFields, req);
  if (!validation.valid) {
    return { success: false, error: `Missing required fields: ${validation.missingFields.join(', ')}`, response: validation.response };
  }
  return parseResult;
}
