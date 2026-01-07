import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DigestData {
  user_email: string;
  user_name: string;
  pending_recommendations: number;
  completed_recommendations: number;
  days_since_active: number;
  top_recommendation?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const resend = new Resend(resendApiKey);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get users who opted in for weekly digest and haven't been active recently
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, email_preferences, last_active_at')
      .lt('last_active_at', oneWeekAgo.toISOString());

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`Found ${eligibleUsers?.length || 0} potentially eligible users`);

    const emailsSent: string[] = [];
    const errors: string[] = [];

    for (const user of eligibleUsers || []) {
      // Check if user opted in for weekly digest
      const prefs = user.email_preferences as { weekly_digest?: boolean } | null;
      if (!prefs?.weekly_digest) {
        console.log(`User ${user.user_id} has weekly digest disabled, skipping`);
        continue;
      }

      if (!user.email) {
        console.log(`User ${user.user_id} has no email, skipping`);
        continue;
      }

      try {
        // Get user's pending recommendations
        const { data: recommendations, error: recsError } = await supabase
          .from('recommendations')
          .select('title, status')
          .eq('user_id', user.user_id);

        if (recsError) {
          console.error(`Error fetching recommendations for user ${user.user_id}:`, recsError);
          continue;
        }

        const pendingCount = recommendations?.filter(r => r.status === 'pending').length || 0;
        const completedCount = recommendations?.filter(r => r.status === 'completed').length || 0;
        const topRecommendation = recommendations?.find(r => r.status === 'pending')?.title;

        const lastActive = new Date(user.last_active_at);
        const daysSince = Math.ceil((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

        const digestData: DigestData = {
          user_email: user.email,
          user_name: user.full_name || 'there',
          pending_recommendations: pendingCount,
          completed_recommendations: completedCount,
          days_since_active: daysSince,
          top_recommendation: topRecommendation,
        };

        // Send the digest email
        const { error: emailError } = await resend.emails.send({
          from: "EduThree <noreply@resend.dev>",
          to: [user.email],
          subject: `Your Weekly Career Progress Update - ${pendingCount} actions waiting`,
          html: generateDigestHtml(digestData),
        });

        if (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
          errors.push(user.email);
        } else {
          console.log(`Successfully sent digest to ${user.email}`);
          emailsSent.push(user.email);
        }
      } catch (userError) {
        console.error(`Error processing user ${user.user_id}:`, userError);
        errors.push(user.email || user.user_id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: emailsSent.length,
        errors: errors.length,
        details: { sent: emailsSent, failed: errors }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-digest-email function:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateDigestHtml(data: DigestData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Weekly Career Progress</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">EduThree</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">Your Weekly Career Progress Update</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
        <p style="font-size: 18px; margin-top: 0;">Hey ${data.user_name}! 👋</p>
        
        <p>It's been ${data.days_since_active} days since your last visit. Here's what's waiting for you:</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
          <h3 style="margin-top: 0; color: #667eea;">📊 Your Progress Summary</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
              <strong>${data.pending_recommendations}</strong> recommendations waiting
            </li>
            <li style="padding: 8px 0;">
              <strong>${data.completed_recommendations}</strong> recommendations completed
            </li>
          </ul>
        </div>
        
        ${data.top_recommendation ? `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: 500;">💡 Suggested next action:</p>
          <p style="margin: 8px 0 0; color: #92400e;">${data.top_recommendation}</p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://eduthree.lovable.app/recommendations" 
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Continue Your Journey →
          </a>
        </div>
        
        <p style="margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center;">
          You're receiving this because you opted in for weekly digests.<br>
          <a href="https://eduthree.lovable.app/settings" style="color: #667eea;">Update your preferences</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

serve(handler);
