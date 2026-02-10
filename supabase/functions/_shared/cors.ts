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
    'https://syllabusstack.lovable.app',
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

// Lovable preview domain patterns (always allowed for development/testing)
const LOVABLE_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
];

/**
 * Check if origin matches Lovable preview domain patterns
 */
function isLovableOrigin(origin: string): boolean {
  return LOVABLE_PATTERNS.some(pattern => pattern.test(origin));
}

/**
 * Get CORS headers based on request origin and environment
 *
 * @param req - The incoming request
 * @returns CORS headers object
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';

  // Check ALL allowed origins across all environments (avoids ENVIRONMENT var misconfiguration)
  const allAllowed = Object.values(ALLOWED_ORIGINS).flat();
  const isAllowed = allAllowed.includes(origin) || isLovableOrigin(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS.production[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
