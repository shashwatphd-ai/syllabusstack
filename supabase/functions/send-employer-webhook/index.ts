import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
// Note: Using crypto.subtle for HMAC signature generation (Deno native)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-EMPLOYER-WEBHOOK] ${step}${detailsStr}`);
};

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Generate HMAC-SHA256 signature for webhook verification
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Send webhook with retry logic
async function sendWebhookWithRetry(
  url: string,
  payload: WebhookPayload,
  secret: string,
  maxRetries = 3
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payloadString = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = `${timestamp}.${payloadString}`;
  const signature = await generateSignature(signaturePayload, secret);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Signature': `v1=${signature}`,
          'User-Agent': 'SyllabusStack-Webhook/1.0',
        },
        body: payloadString,
      });

      if (response.ok) {
        return { success: true, statusCode: response.status };
      }

      // If we get a 4xx error (except 429), don't retry
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return {
          success: false,
          statusCode: response.status,
          error: `Client error: ${response.statusText}`,
        };
      }

      // For 5xx or 429, retry with backoff
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        logStep(`Retry attempt ${attempt}`, { backoffMs, statusCode: response.status });
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        return {
          success: false,
          statusCode: response.status,
          error: `Server error after ${maxRetries} attempts`,
        };
      }
    } catch (err) {
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        logStep(`Network error, retrying`, { attempt, backoffMs });
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        return {
          success: false,
          error: `Network error: ${err instanceof Error ? err.message : 'Unknown'}`,
        };
      }
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { event, employer_account_id, data } = body;

    if (!event || !employer_account_id) {
      throw new Error("event and employer_account_id are required");
    }

    logStep("Processing webhook event", { event, employer_account_id });

    // Get active webhooks for this employer that subscribe to this event
    const { data: webhooks, error: webhookError } = await supabaseAdmin
      .from('employer_webhooks')
      .select('*')
      .eq('employer_account_id', employer_account_id)
      .eq('is_active', true)
      .contains('events', [event]);

    if (webhookError) {
      throw new Error(`Failed to fetch webhooks: ${webhookError.message}`);
    }

    if (!webhooks || webhooks.length === 0) {
      logStep("No active webhooks for this event");
      return new Response(JSON.stringify({
        success: true,
        message: "No webhooks configured for this event",
        webhooks_sent: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`Found ${webhooks.length} webhooks to send`);

    // Prepare payload
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: data || {},
    };

    // Send to all matching webhooks
    const results = await Promise.all(
      webhooks.map(async (webhook) => {
        const result = await sendWebhookWithRetry(
          webhook.url,
          payload,
          webhook.secret
        );

        // Update webhook status
        const updateData: Record<string, unknown> = {
          last_triggered_at: new Date().toISOString(),
        };

        if (!result.success) {
          updateData.failure_count = (webhook.failure_count || 0) + 1;

          // Disable webhook after 10 consecutive failures
          if ((webhook.failure_count || 0) >= 9) {
            updateData.is_active = false;
            logStep("Disabling webhook due to repeated failures", { webhookId: webhook.id });
          }
        } else {
          // Reset failure count on success
          updateData.failure_count = 0;
        }

        await supabaseAdmin
          .from('employer_webhooks')
          .update(updateData)
          .eq('id', webhook.id);

        // Log the delivery attempt
        await supabaseAdmin
          .from('webhook_delivery_logs')
          .insert({
            webhook_id: webhook.id,
            event,
            payload,
            response_status: result.statusCode,
            success: result.success,
            error_message: result.error,
          })
          .maybeSingle();

        return {
          webhook_id: webhook.id,
          url: webhook.url,
          ...result,
        };
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logStep("Webhook delivery complete", { successCount, failCount });

    return new Response(JSON.stringify({
      success: true,
      webhooks_sent: successCount,
      webhooks_failed: failCount,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
