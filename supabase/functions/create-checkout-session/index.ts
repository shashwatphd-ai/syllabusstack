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

// Stripe price IDs for SyllabusStack Pro
const STRIPE_PRICES = {
  pro_monthly: "price_1SnXUZRsfnRI3vWDGdLskq3C", // $9.99/month
};

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
      apiVersion: "2025-08-27.basil",
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

    logInfo('create-checkout-session', 'starting', { userId: user.id });

    // Get request body
    const { tier, isAnnual, successUrl, cancelUrl } = await req.json();

    if (tier !== "pro") {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, "Invalid tier. Only 'pro' is available for self-service.");
    }

    // Get or create Stripe customer
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id, email, full_name")
      .eq("user_id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email || profile?.email,
        name: profile?.full_name || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    // Use Pro monthly price
    const priceId = STRIPE_PRICES.pro_monthly;

    // Get origin for redirect URLs - use provided URLs or fallback
    const origin = req.headers.get("origin") || 
                   req.headers.get("referer")?.replace(/\/[^/]*$/, '') ||
                   Deno.env.get("PUBLIC_APP_URL") ||
                   "https://syllabusstack.lovable.app";
    
    console.log(`Using origin: ${origin} for checkout redirects`);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${origin}/billing?success=true`,
      cancel_url: cancelUrl || `${origin}/billing?canceled=true`,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          tier: tier,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      customer_update: {
        address: "auto",
        name: "auto",
      },
    });

    logInfo('create-checkout-session', 'complete', { sessionId: session.id });

    return createSuccessResponse({ url: session.url, sessionId: session.id }, corsHeaders);
  } catch (error: unknown) {
    logError('create-checkout-session', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

Deno.serve(withErrorHandling(handler, getCorsHeaders));
