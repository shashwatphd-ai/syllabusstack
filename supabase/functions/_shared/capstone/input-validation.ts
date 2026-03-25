/**
 * Input Validation Utilities for Capstone Pipeline
 * Ported from EduThree — provides consistent validation patterns
 */

import { getCorsHeaders } from '../../cors.ts';

// UUID validation
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown, strict: boolean = false): value is string {
  if (typeof value !== 'string') return false;
  return strict ? UUID_V4_REGEX.test(value) : UUID_REGEX.test(value);
}

export function sanitizeUUID(value: unknown): string | null {
  if (!isValidUUID(value)) return null;
  return value.toLowerCase().trim();
}

export function areValidUUIDs(values: unknown): values is string[] {
  if (!Array.isArray(values)) return false;
  return values.every(v => isValidUUID(v));
}

// SQL injection detection
const SQL_INJECTION_PATTERNS = [
  /--/, /;/, /'/, /\bOR\b.*=/i, /\bAND\b.*=/i, /\bUNION\b/i,
  /\bSELECT\b/i, /\bDROP\b/i, /\bDELETE\b/i, /\bINSERT\b/i,
  /\bUPDATE\b/i, /\bEXEC\b/i,
];

export function hasSQLInjectionPatterns(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
}

export function sanitizeString(value: unknown, maxLength: number = 1000): string {
  if (typeof value !== 'string') return '';
  let sanitized = value.trim().slice(0, maxLength);
  sanitized = sanitized.replace(/\0/g, '');
  sanitized = sanitized.normalize('NFKC');
  return sanitized;
}

export function sanitizeForLog(value: unknown, maxLength: number = 200): string {
  if (typeof value !== 'string') {
    return typeof value === 'object' ? '[Object]' : String(value).slice(0, maxLength);
  }
  return value.replace(/[\n\r\t]/g, ' ').replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength);
}

// Email validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length > 255) return false;
  return EMAIL_REGEX.test(value);
}

export function sanitizeEmail(value: unknown): string | null {
  if (!isValidEmail(value)) return null;
  return value.toLowerCase().trim();
}

// Numeric validation
export function isPositiveInteger(value: unknown, max?: number): value is number {
  if (typeof value !== 'number') return false;
  if (!Number.isInteger(value)) return false;
  if (value < 1) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export function isInRange(value: unknown, min: number, max: number): value is number {
  if (typeof value !== 'number') return false;
  if (Number.isNaN(value)) return false;
  return value >= min && value <= max;
}

// Validation error responses
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export function createValidationErrorResponse(errors: ValidationError[], req: Request): Response {
  console.warn('[Validation] Validation failed:', errors);
  return new Response(
    JSON.stringify({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: errors }),
    { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
  );
}

export function createInvalidUUIDResponse(fieldName: string, req: Request): Response {
  return createValidationErrorResponse([{
    field: fieldName, message: `Invalid ${fieldName} format. Expected a valid UUID.`, code: 'INVALID_UUID'
  }], req);
}

export function createMissingFieldResponse(fieldName: string, req: Request): Response {
  return createValidationErrorResponse([{
    field: fieldName, message: `${fieldName} is required`, code: 'REQUIRED_FIELD'
  }], req);
}

export function validateUUIDField(body: Record<string, unknown>, fieldName: string, req: Request, required: boolean = true): string | null | Response {
  const value = body[fieldName];
  if (value === undefined || value === null) {
    if (required) return createMissingFieldResponse(fieldName, req);
    return null;
  }
  if (!isValidUUID(value)) return createInvalidUUIDResponse(fieldName, req);
  return sanitizeUUID(value);
}

export function detectAndLogSQLInjection(fieldName: string, value: string): boolean {
  if (hasSQLInjectionPatterns(value)) {
    console.warn(`[SECURITY] Potential SQL injection detected in ${fieldName}:`, sanitizeForLog(value, 50));
    return true;
  }
  return false;
}
