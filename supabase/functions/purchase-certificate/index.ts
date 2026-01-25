import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseRequest {
  enrollment_id: string;
  certificate_type: "verified" | "assessed";
  success_url?: string;
  cancel_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { enrollment_id, certificate_type, success_url, cancel_url }: PurchaseRequest = await req.json();

    if (!enrollment_id || !certificate_type) {
      return new Response(
        JSON.stringify({ error: "enrollment_id and certificate_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["verified", "assessed"].includes(certificate_type)) {
      return new Response(
        JSON.stringify({ error: "certificate_type must be 'verified' or 'assessed'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify enrollment exists and belongs to user
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select(`
        id,
        student_id,
        completed_at,
        overall_progress,
        instructor_course_id,
        instructor_courses (
          id,
          title,
          instructor_id,
          profiles!instructor_courses_instructor_id_fkey (
            full_name
          )
        )
      `)
      .eq("id", enrollment_id)
      .single();

    if (enrollmentError || !enrollment) {
      return new Response(
        JSON.stringify({ error: "Enrollment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (enrollment.student_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You can only purchase certificates for your own enrollments" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if course is completed (at least 80% progress or completed_at is set)
    if (!enrollment.completed_at && (enrollment.overall_progress || 0) < 80) {
      return new Response(
        JSON.stringify({ error: "You must complete at least 80% of the course to purchase a certificate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if certificate already exists
    const { data: existingCert } = await supabase
      .from("certificates")
      .select("id, certificate_type")
      .eq("enrollment_id", enrollment_id)
      .in("certificate_type", ["verified", "assessed"])
      .single();

    if (existingCert) {
      return new Response(
        JSON.stringify({ error: `You already have a ${existingCert.certificate_type} certificate for this course` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email, full_name")
      .eq("user_id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name || undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    // Define pricing
    const pricing = {
      verified: { amount: 2500, label: "Verified Certificate" },
      assessed: { amount: 4900, label: "Assessed Certificate" },
    };

    const { amount, label } = pricing[certificate_type];
    const course = enrollment.instructor_courses as any;
    const courseTitle = course?.title || "Course";

    // Create Stripe checkout session
    const appUrl = Deno.env.get("APP_URL") || "https://syllabusstack.lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${label}: ${courseTitle}`,
              description: certificate_type === "assessed" 
                ? "Includes proctored assessment and skill verification"
                : "Includes identity verification and course completion",
              metadata: {
                enrollment_id,
                certificate_type,
                course_title: courseTitle,
              },
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        enrollment_id,
        certificate_type,
        product_type: "certificate",
      },
      success_url: success_url || `${appUrl}/student/courses/${enrollment.instructor_course_id}?certificate=success`,
      cancel_url: cancel_url || `${appUrl}/student/courses/${enrollment.instructor_course_id}?certificate=cancelled`,
    });

    console.log(`[purchase-certificate] Created checkout session ${session.id} for ${certificate_type} certificate`);

    return new Response(
      JSON.stringify({ 
        checkout_url: session.url,
        session_id: session.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[purchase-certificate] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
