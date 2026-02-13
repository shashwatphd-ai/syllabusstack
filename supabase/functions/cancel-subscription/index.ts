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

    logInfo('cancel-subscription', 'starting', { userId: user.id });

    // Get user's subscription ID
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_subscription_id) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'No active subscription found');
    }

    // Cancel subscription at period end (don't immediately revoke access)
    const subscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      { cancel_at_period_end: true }
    );

    // Update profile
    await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: "canceling",
        subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq("user_id", user.id);

    logInfo('cancel-subscription', 'complete', { userId: user.id, endsAt: subscription.current_period_end });

    return createSuccessResponse({
      success: true,
      endsAt: new Date(subscription.current_period_end * 1000).toISOString(),
    }, corsHeaders);
  } catch (error: unknown) {
    logError('cancel-subscription', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
