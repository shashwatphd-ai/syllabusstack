import { createClient } from "@supabase/supabase-js";
import Stripe from "npm:stripe@^18.5.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return createErrorResponse('CONFIG_ERROR', corsHeaders, 'STRIPE_SECRET_KEY is not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
    }

    logInfo('get-invoices', 'starting', { userId: user.id });

    // Get user's Stripe customer ID
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return createSuccessResponse({ invoices: [] }, corsHeaders);
    }

    // Get request body for limit
    const { limit = 10 } = await req.json().catch(() => ({}));

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit: Math.min(limit, 100),
    });

    const formattedInvoices = invoices.data.map((invoice: Stripe.Invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000).toISOString(),
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      pdf_url: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
    }));

    logInfo('get-invoices', 'complete', { count: formattedInvoices.length });

    return createSuccessResponse({ invoices: formattedInvoices }, corsHeaders);
  } catch (error: unknown) {
    logError('get-invoices', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
