
# Root Cause Analysis: Edge Function "Failed to fetch" Error

## Problem Identified

The error "Failed to send a request to the Edge Function" with underlying "Failed to fetch" is caused by **CORS rejection**. The request origin (`id-preview--*.lovable.app` and `*.lovableproject.com`) is not in the allowed origins list in `supabase/functions/_shared/cors.ts`.

## Evidence

1. **Console logs** show:
   - `FunctionsFetchError: Failed to send a request to the Edge Function`
   - Inner error: `TypeError: Failed to fetch`

2. **Network requests** originate from:
   - `https://99730e5c-7950-4097-8601-0fd29fb1f3ef.lovableproject.com`
   - `https://id-preview--99730e5c-7950-4097-8601-0fd29fb1f3ef.lovable.app`

3. **Edge function logs** show no incoming requests for `submit-batch-slides` or `generate-lecture-slides-v3`, confirming the request is blocked at the CORS preflight stage (never reaches the function).

4. **CORS configuration** (`supabase/functions/_shared/cors.ts`) only allows:
   ```typescript
   production: ['https://syllabusstack.com', 'https://app.syllabusstack.com', 'https://www.syllabusstack.com'],
   staging: ['https://staging.syllabusstack.com', 'https://staging-app.syllabusstack.com'],
   development: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
   ```
   
   **Missing:** Lovable preview domains (`*.lovable.app`, `*.lovableproject.com`)

## Why This Matters

When the browser makes a cross-origin request to an Edge Function, it first sends an OPTIONS preflight request. If the returned `Access-Control-Allow-Origin` header doesn't match the request's origin, the browser blocks the actual request entirely—hence "Failed to fetch" with no logs on the server.

---

## Solution: Add Lovable Preview Domains to CORS Allowlist

### File to Modify

`supabase/functions/_shared/cors.ts`

### Changes

Add Lovable preview patterns to the development/staging origins and update the matching logic to handle dynamic subdomains:

```typescript
const ALLOWED_ORIGINS: Record<string, string[]> = {
  production: [
    'https://syllabusstack.com',
    'https://app.syllabusstack.com',
    'https://www.syllabusstack.com',
    'https://syllabusstack.lovable.app', // Published Lovable URL
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

// Lovable preview domain patterns (always allowed)
const LOVABLE_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,       // id.lovable.app
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/, // id-preview--*.lovable.app
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, // *.lovableproject.com
];

function isLovableOrigin(origin: string): boolean {
  return LOVABLE_PATTERNS.some(pattern => pattern.test(origin));
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const env = Deno.env.get('ENVIRONMENT') || 'development';
  const allowed = ALLOWED_ORIGINS[env] || ALLOWED_ORIGINS.development;

  // Allow Lovable preview origins (dynamic subdomains)
  const isAllowed = allowed.includes(origin) || isLovableOrigin(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

---

## Technical Details

### Why This Solution

| Approach | Pros | Cons |
|----------|------|------|
| **Wildcard `*`** | Simple | Security vulnerability, doesn't work with credentials |
| **Static list** | Secure | Can't handle dynamic Lovable subdomains |
| **Regex patterns** ✓ | Secure + flexible | Slightly more complex |

The regex pattern approach safely allows all Lovable preview domains while maintaining strict control over production origins.

### Deployment

After modifying `cors.ts`, all edge functions automatically pick up the change since they import from the shared module. No individual function changes needed.

---

## Testing Plan

1. After deployment, visit the Instructor Portal
2. Click "Retry" on a teaching unit with failed status
3. Verify the request succeeds (no CORS error)
4. Check edge function logs show the incoming request
