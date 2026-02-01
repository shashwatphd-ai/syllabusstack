import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return createErrorResponse('CONFIG_ERROR', corsHeaders, 'STRIPE_SECRET_KEY is not set');
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Invalid authentication');
    }

    const user = userData.user;
    if (!user?.email) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders, 'User email not available');
    }

    logInfo('create-course-payment', 'starting', { userId: user.id });

    const body = await req.json();
    const { course_title, course_code, file_name, success_url, cancel_url } = body;

    // Check if user is Pro subscriber (free course creation)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_tier, stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    const isPro = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'university';

    // If Pro, return immediate success (no payment needed)
    if (isPro) {
      logInfo('create-course-payment', 'pro_subscriber', { userId: user.id });
      return createSuccessResponse({
        requires_payment: false,
        message: "Pro subscribers get unlimited course creation"
      }, corsHeaders);
    }

    // Non-Pro users need to pay $1
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get or create Stripe customer
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
      }

      // Update profile with customer ID
      await supabaseClient
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const appUrl = Deno.env.get("APP_URL") || "https://syllabusstack.lovable.app";

    // Create checkout session for $1 course creation
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Course Creation: ${course_title || file_name || "New Course"}`,
              description: "One-time fee to create and publish a course on SyllabusStack",
            },
            unit_amount: 100, // $1.00 in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        product_type: "course_creation",
        course_title: course_title || "",
        course_code: course_code || "",
        file_name: file_name || "",
      },
      success_url: success_url || `${appUrl}/instructor/quick-setup?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${appUrl}/instructor/quick-setup?payment=cancelled`,
      allow_promotion_codes: true,
    });

    logInfo('create-course-payment', 'checkout_created', { sessionId: session.id });

    return createSuccessResponse({
      requires_payment: true,
      checkout_url: session.url,
      session_id: session.id,
    }, corsHeaders);

  } catch (error) {
    logError('create-course-payment', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
