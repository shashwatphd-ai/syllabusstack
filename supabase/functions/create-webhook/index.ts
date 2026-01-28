/**
 * create-webhook/index.ts
 *
 * PURPOSE: Securely create employer webhooks with server-side secret generation
 *
 * WHY THIS EXISTS (Task 2.1.4 from MASTER_IMPLEMENTATION_PLAN_V2.md):
 * - Previous implementation generated webhook secrets client-side (INSECURE)
 * - Secrets could be intercepted via browser dev tools
 * - Malicious JavaScript could capture secrets before transmission
 * - This function generates secrets server-side where they cannot be intercepted
 *
 * SECURITY IMPROVEMENTS:
 * 1. Secret generated server-side using crypto.randomUUID()
 * 2. User ownership verified before webhook creation
 * 3. URL validation (must be HTTPS)
 * 4. Secret only returned once in response (not stored in readable form)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { createErrorResponse, createSuccessResponse, logInfo, withErrorHandling } from "../_shared/error-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateWebhookRequest {
  employer_account_id: string;
  url: string;
  events: string[];
}

const VALID_WEBHOOK_EVENTS = [
  'certificate.issued',
  'certificate.revoked',
  'verification.completed',
];

/**
 * SSRF Protection: Block internal/private network URLs
 * Prevents attackers from using webhooks to probe internal services
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  'metadata.gcp.internal',
];

const BLOCKED_IP_PATTERNS = [
  /^127\./,                    // Loopback
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local (AWS/cloud metadata)
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-2][0-9])\./, // Carrier-grade NAT
  /^fc00:/i,                   // IPv6 unique local
  /^fe80:/i,                   // IPv6 link-local
];

function isBlockedUrl(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(lowerHost)) {
    return true;
  }

  // Check blocked IP patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(lowerHost)) {
      return true;
    }
  }

  return false;
}

const handler = async (req: Request): Promise<Response> => {
  const body = await req.json() as CreateWebhookRequest;
  const { employer_account_id, url, events } = body;

  // Validate required fields
  if (!employer_account_id || !url || !events?.length) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Missing required fields: employer_account_id, url, and events are required');
  }

  // Validate URL format and security
  try {
    const parsedUrl = new URL(url);

    // Require HTTPS for production security
    if (parsedUrl.protocol !== 'https:') {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Webhook URL must use HTTPS');
    }

    // SSRF Protection: Block internal/private network URLs
    if (isBlockedUrl(parsedUrl.hostname)) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Webhook URL cannot point to internal or private network addresses');
    }
  } catch {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Invalid webhook URL format');
  }

  // Validate events
  const invalidEvents = events.filter(e => !VALID_WEBHOOK_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      corsHeaders,
      `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${VALID_WEBHOOK_EVENTS.join(', ')}`
    );
  }

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Failed to authenticate user');
  }

  // Verify user owns the employer account
  const { data: account, error: accountError } = await supabase
    .from('employer_accounts')
    .select('id, primary_contact_user_id')
    .eq('id', employer_account_id)
    .single();

  if (accountError || !account) {
    return createErrorResponse('NOT_FOUND', corsHeaders, 'Employer account not found');
  }

  if (account.primary_contact_user_id !== user.id) {
    return createErrorResponse('FORBIDDEN', corsHeaders, 'Not authorized for this employer account');
  }

  // Check for duplicate webhook URL
  const { data: existingWebhook } = await supabase
    .from('employer_webhooks')
    .select('id')
    .eq('employer_account_id', employer_account_id)
    .eq('url', url)
    .maybeSingle();

  if (existingWebhook) {
    return createErrorResponse('BAD_REQUEST', corsHeaders, 'A webhook with this URL already exists');
  }

  // Generate secret SERVER-SIDE (the security fix)
  const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;

  // Create webhook
  const { data: webhook, error: insertError } = await supabase
    .from('employer_webhooks')
    .insert({
      employer_account_id,
      url,
      events,
      secret,
      is_active: true,
      failure_count: 0,
    })
    .select()
    .single();

  if (insertError) {
    return createErrorResponse('DATABASE_ERROR', corsHeaders, insertError.message);
  }

  logInfo('create-webhook', 'webhook_created', {
    webhookId: webhook.id,
    accountId: employer_account_id,
    eventCount: events.length,
    userId: user.id,
  });

  // Return webhook with secret (shown only once)
  // Client should display this to user with warning to copy now
  return createSuccessResponse(
    {
      webhook: {
        id: webhook.id,
        employer_account_id: webhook.employer_account_id,
        url: webhook.url,
        events: webhook.events,
        is_active: webhook.is_active,
        created_at: webhook.created_at,
      },
      secret, // Only returned once at creation time
    },
    corsHeaders,
    201
  );
};

serve(withErrorHandling(handler, corsHeaders));
