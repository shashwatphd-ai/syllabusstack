import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ENROLL-IN-COURSE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    const body = await req.json();
    const { access_code, promo_code, success_url, cancel_url } = body;

    if (!access_code) throw new Error("Access code is required");

    // Find course by access code
    const { data: course, error: courseError } = await supabaseAdmin
      .from("instructor_courses")
      .select("id, title, is_published, instructor_id")
      .eq("access_code", access_code.trim().toUpperCase())
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) throw new Error("Invalid access code");
    if (!course.is_published) throw new Error("This course is not yet published");
    logStep("Course found", { courseId: course.id, title: course.title });

    // Check if already enrolled
    const { data: existing } = await supabaseAdmin
      .from("course_enrollments")
      .select("id")
      .eq("student_id", user.id)
      .eq("instructor_course_id", course.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ 
        already_enrolled: true,
        enrollment_id: existing.id,
        course,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check subscription tier
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_tier, stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    const isPro = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'university';
    logStep("Subscription check", { isPro, tier: profile?.subscription_tier });

    // If Pro, enroll immediately (free)
    if (isPro) {
      const { data: enrollment, error: enrollError } = await supabaseAdmin
        .from("course_enrollments")
        .insert({
          student_id: user.id,
          instructor_course_id: course.id,
        })
        .select()
        .single();

      if (enrollError) throw enrollError;
      logStep("Pro enrollment created", { enrollmentId: enrollment.id });

      return new Response(JSON.stringify({ 
        requires_payment: false,
        enrolled: true,
        enrollment_id: enrollment.id,
        course,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
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
      
      await supabaseClient
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }
    logStep("Stripe customer", { customerId });

    const appUrl = Deno.env.get("APP_URL") || "https://syllabusstack.lovable.app";

    // Create checkout session for $1 enrollment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Course Enrollment: ${course.title}`,
              description: "One-time enrollment fee for SyllabusStack course",
            },
            unit_amount: 100, // $1.00 in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        product_type: "course_enrollment",
        instructor_course_id: course.id,
        course_title: course.title,
        access_code: access_code,
      },
      success_url: success_url || `${appUrl}/learn?enrolled=success&course=${course.id}`,
      cancel_url: cancel_url || `${appUrl}/learn?enrolled=cancelled`,
      allow_promotion_codes: true,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ 
      requires_payment: true,
      checkout_url: session.url,
      session_id: session.id,
      course,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
