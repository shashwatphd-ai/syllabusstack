/**
 * CORS Handler for Edge Functions
 *
 * PURPOSE: Provide environment-based CORS headers instead of wildcard '*'
 *
 * WHY: Using Access-Control-Allow-Origin: '*' is a security vulnerability
 * that allows any website to make requests to our API.
 *
 * USAGE:
 *   import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
 *
 *   const handler = async (req: Request) => {
 *     const preflightResponse = handleCorsPreFlight(req);
 *     if (preflightResponse) return preflightResponse;
 *
 *     const corsHeaders = getCorsHeaders(req);
 *     // ... rest of handler
 *     return new Response(JSON.stringify(data), { headers: corsHeaders });
 *   };
 */

const ALLOWED_ORIGINS: Record<string, string[]> = {
  production: [
    'https://syllabusstack.com',
    'https://app.syllabusstack.com',
    'https://www.syllabusstack.com',
  ],
  staging: [
    'https://staging.syllabusstack.com',
    'https://staging-app.syllabusstack.com',
  ],
  development: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ],
};

/**
 * Get CORS headers based on request origin and environment
 *
 * @param req - The incoming request
 * @returns CORS headers object
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const env = Deno.env.get('ENVIRONMENT') || 'development';
  const allowed = ALLOWED_ORIGINS[env] || ALLOWED_ORIGINS.development;

  // Check if the origin is in the allowed list
  const isAllowed = allowed.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle CORS preflight requests (OPTIONS method)
 *
 * @param req - The incoming request
 * @returns Response for preflight, or null if not a preflight request
 */
export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req)
    });
  }
  return null;
}

/**
 * Legacy CORS headers for backward compatibility during migration
 * WARNING: This uses wildcard origin - only use for functions not yet migrated
 * @deprecated Use getCorsHeaders(req) instead
 */
export const legacyCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
