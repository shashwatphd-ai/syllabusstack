import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
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
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      return createErrorResponse('CONFIG_ERROR', corsHeaders, 'Stripe configuration is missing');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    logInfo('stripe-webhook', 'received');

    // Verify webhook signature
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'No signature');
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logError('stripe-webhook', err instanceof Error ? err : new Error('Signature verification failed'));
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Invalid signature');
    }

    logInfo('stripe-webhook', 'processing', { eventType: event.type });

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(supabase, stripe, session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      default:
        logInfo('stripe-webhook', 'unhandled_event', { eventType: event.type });
    }

    logInfo('stripe-webhook', 'complete', { eventType: event.type });
    return createSuccessResponse({ received: true }, corsHeaders);
  } catch (error: unknown) {
    logError('stripe-webhook', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
};

serve(withErrorHandling(handler, getCorsHeaders));

async function handleCheckoutComplete(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  console.log("Handling checkout.session.completed");

  const productType = session.metadata?.product_type;
  const userId = session.metadata?.user_id;

  // Handle $1 payment gates
  if (productType === "course_creation") {
    console.log(`Course creation payment completed for user ${userId}`);
    // Course creation is handled on the frontend after redirect
    // Just log success
    return;
  }

  if (productType === "course_enrollment") {
    console.log(`Course enrollment payment completed for user ${userId}`);
    const courseId = session.metadata?.instructor_course_id;
    
    if (!userId || !courseId) {
      console.error("Missing user_id or course_id in enrollment metadata");
      return;
    }

    // Create the enrollment record
    const { data: enrollment, error: enrollError } = await supabase
      .from("course_enrollments")
      .insert({
        student_id: userId,
        instructor_course_id: courseId,
      })
      .select('id')
      .single();

    if (enrollError) {
      // Check if it's a duplicate - that's OK
      if (enrollError.code === '23505') {
        console.log(`User ${userId} already enrolled in course ${courseId} - ignoring duplicate`);
        return;
      }
      console.error('CRITICAL PAYMENT ERROR - course_enrollment:', JSON.stringify({
        error: enrollError.message,
        code: enrollError.code,
        userId,
        courseId,
        sessionId: session.id,
        timestamp: new Date().toISOString()
      }));
      throw new Error(`Failed to create enrollment for user ${userId}: ${enrollError.message}`);
    }

    console.log(`CONFIRMED: Enrollment ${enrollment.id} created for user ${userId} in course ${courseId}`);
    return;
  }

  if (productType === "certificate") {
    console.log(`Certificate purchase completed for user ${userId}`);
    const enrollmentId = session.metadata?.enrollment_id;
    const certificateType = session.metadata?.certificate_type;
    
    if (!userId || !enrollmentId || !certificateType) {
      console.error("Missing metadata for certificate purchase");
      return;
    }

    // Trigger certificate issuance
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      const response = await fetch(`${supabaseUrl}/functions/v1/issue-certificate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          enrollment_id: enrollmentId,
          certificate_type: certificateType,
          payment_intent_id: session.payment_intent,
          amount_paid_cents: session.amount_total,
        }),
      });

      if (!response.ok) {
        console.error("Failed to issue certificate:", await response.text());
      } else {
        console.log(`Certificate issued for enrollment ${enrollmentId}`);
      }
    } catch (err) {
      console.error("Error issuing certificate:", err);
    }
    return;
  }

  // Handle subscription checkout (legacy flow)
  const subscriptionUserId = session.subscription
    ? (await stripe.subscriptions.retrieve(session.subscription as string)).metadata?.supabase_user_id
    : session.metadata?.supabase_user_id;

  if (!subscriptionUserId) {
    console.error("No user ID found in session metadata");
    return;
  }

  // Get subscription details
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        subscription_tier: "pro",
        subscription_status: subscription.status,
        stripe_subscription_id: subscription.id,
        subscription_started_at: new Date(subscription.start_date * 1000).toISOString(),
        subscription_ends_at: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      })
      .eq("user_id", subscriptionUserId)
      .select('user_id, subscription_tier')
      .single();

    if (updateError || !updatedProfile) {
      // CRITICAL: Log with context for manual reconciliation
      console.error('CRITICAL PAYMENT ERROR - checkout.session.completed:', JSON.stringify({
        error: updateError?.message,
        code: updateError?.code,
        userId: subscriptionUserId,
        stripeSubscriptionId: subscription.id,
        sessionId: session.id,
        intendedTier: 'pro',
        timestamp: new Date().toISOString()
      }));
      // Throw to return 500, so Stripe retries the webhook
      throw new Error(`Failed to update subscription for user ${subscriptionUserId}: ${updateError?.message}`);
    }

    console.log(`CONFIRMED: User ${subscriptionUserId} upgraded to ${updatedProfile.subscription_tier}`);
  }
}

async function handleSubscriptionUpdate(
  supabase: any,
  subscription: Stripe.Subscription
) {
  console.log("Handling subscription update");

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error("No user ID in subscription metadata");
    return;
  }

  // Determine tier from subscription
  const tier = subscription.metadata?.tier || "pro";

  // Map Stripe status to our status
  let status = "active";
  if (subscription.status === "past_due") status = "past_due";
  else if (subscription.status === "canceled") status = "canceled";
  else if (subscription.status === "trialing") status = "trialing";

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      subscription_tier: tier,
      subscription_status: status,
      stripe_subscription_id: subscription.id,
      subscription_ends_at: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    })
    .eq("user_id", userId)
    .select('user_id, subscription_tier, subscription_status')
    .single();

  if (updateError || !updatedProfile) {
    console.error('CRITICAL PAYMENT ERROR - subscription.updated:', JSON.stringify({
      error: updateError?.message,
      code: updateError?.code,
      userId,
      stripeSubscriptionId: subscription.id,
      intendedTier: tier,
      intendedStatus: status,
      timestamp: new Date().toISOString()
    }));
    throw new Error(`Failed to update subscription for user ${userId}: ${updateError?.message}`);
  }

  console.log(`CONFIRMED: Subscription updated for user ${userId}: ${updatedProfile.subscription_tier} (${updatedProfile.subscription_status})`);
}

async function handleSubscriptionCanceled(
  supabase: any,
  subscription: Stripe.Subscription
) {
  console.log("Handling subscription canceled");

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error("No user ID in subscription metadata");
    return;
  }

  // Downgrade to free tier
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "canceled",
      stripe_subscription_id: null,
      subscription_ends_at: null,
    })
    .eq("user_id", userId)
    .select('user_id, subscription_tier')
    .single();

  if (updateError || !updatedProfile) {
    console.error('CRITICAL PAYMENT ERROR - subscription.canceled:', JSON.stringify({
      error: updateError?.message,
      code: updateError?.code,
      userId,
      stripeSubscriptionId: subscription.id,
      timestamp: new Date().toISOString()
    }));
    throw new Error(`Failed to downgrade subscription for user ${userId}: ${updateError?.message}`);
  }

  console.log(`CONFIRMED: User ${userId} downgraded to ${updatedProfile.subscription_tier}`);
}

async function handlePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice
) {
  console.log("Handling payment failed");

  const customerId = invoice.customer as string;

  // Find user by Stripe customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, email, full_name")
    .eq("stripe_customer_id", customerId)
    .single() as { data: { user_id: string; email: string; full_name: string | null } | null };

  if (!profile) {
    console.error("No profile found for customer:", customerId);
    return;
  }

  // Update subscription status
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ subscription_status: "past_due" })
    .eq("user_id", profile.user_id)
    .select('user_id, subscription_status')
    .single();

  if (updateError || !updatedProfile) {
    console.error('CRITICAL PAYMENT ERROR - invoice.payment_failed:', JSON.stringify({
      error: updateError?.message,
      code: updateError?.code,
      userId: profile.user_id,
      customerId,
      invoiceId: invoice.id,
      timestamp: new Date().toISOString()
    }));
    throw new Error(`Failed to update payment failed status for user ${profile.user_id}: ${updateError?.message}`);
  }

  // Send payment failed email notification
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (resendApiKey && profile.email) {
    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SyllabusStack <noreply@syllabusstack.com>",
          to: [profile.email],
          subject: "Payment Failed - Action Required",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4F46E5;">Payment Failed</h1>
              <p>Hi ${profile.full_name || "there"},</p>
              <p>We were unable to process your recent payment for your SyllabusStack Pro subscription.</p>
              <p>Please update your payment method to avoid service interruption:</p>
              <p style="margin: 24px 0;">
                <a href="https://syllabusstack.com/billing"
                   style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                  Update Payment Method
                </a>
              </p>
              <p>If you have any questions, please contact our support team.</p>
              <p style="color: #666; font-size: 14px; margin-top: 32px;">
                — The SyllabusStack Team
              </p>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        console.error("Failed to send payment failed email:", await emailResponse.text());
      } else {
        console.log(`Payment failed email sent to ${profile.email}`);
      }
    } catch (emailError) {
      console.error("Error sending payment failed email:", emailError);
    }
  }

  console.log(`Payment failed for user ${profile.user_id}`);
}

async function handlePaymentSucceeded(
  supabase: any,
  invoice: Stripe.Invoice
) {
  console.log("Handling payment succeeded");

  const customerId = invoice.customer as string;

  // Find user by Stripe customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single() as { data: { user_id: string } | null };

  if (!profile) {
    console.error("No profile found for customer:", customerId);
    return;
  }

  // Ensure subscription is active
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ subscription_status: "active" })
    .eq("user_id", profile.user_id)
    .select('user_id, subscription_status')
    .single();

  if (updateError || !updatedProfile) {
    console.error('CRITICAL PAYMENT ERROR - invoice.payment_succeeded:', JSON.stringify({
      error: updateError?.message,
      code: updateError?.code,
      userId: profile.user_id,
      customerId,
      invoiceId: invoice.id,
      timestamp: new Date().toISOString()
    }));
    throw new Error(`Failed to update payment success status for user ${profile.user_id}: ${updateError?.message}`);
  }

  console.log(`CONFIRMED: Payment succeeded for user ${profile.user_id}, status: ${updatedProfile.subscription_status}`);
}
