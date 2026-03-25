import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { CircuitBreaker, CircuitState, type CircuitBreakerResult } from '../_shared/capstone/circuit-breaker.ts';

const emailCircuit = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60000, successThreshold: 1, name: 'email-resend' });
async function withEmailCircuit<T>(op: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
  return emailCircuit.execute(op);
}
import { safeParseRequestBody } from '../_shared/capstone/json-parser.ts';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface ApprovalEmailRequest {
  email: string;
  name?: string;
}

interface ResendResponse {
  id?: string;
  error?: { message: string };
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const parseResult = await safeParseRequestBody<ApprovalEmailRequest>(req);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error || 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, name } = parseResult.data;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("📧 Sending faculty approval email to:", email);

    // Use circuit breaker wrapped request
    const result = await withEmailCircuit<ResendResponse>(async () => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SyllabusStack <noreply@yourdomain.com>",
          to: [email],
          subject: "Welcome to SyllabusStack - Faculty Access Approved! 🎉",
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
                  .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                  .features { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
                  .feature-item { margin: 15px 0; padding-left: 25px; position: relative; }
                  .feature-item:before { content: "✓"; position: absolute; left: 0; color: #667eea; font-weight: bold; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🎓 Faculty Access Approved!</h1>
                  </div>
                  <div class="content">
                    <p>Hi${name ? ` ${name}` : ''},</p>

                    <p>Great news! Your faculty account has been approved by the SyllabusStack admin team.</p>

                    <p><strong>You now have access to all instructor features:</strong></p>

                    <div class="features">
                      <div class="feature-item">Upload course syllabi and generate project opportunities</div>
                      <div class="feature-item">Review AI-generated industry projects tailored to your curriculum</div>
                      <div class="feature-item">Connect students with real companies and opportunities</div>
                      <div class="feature-item">Access the Instructor Dashboard with course analytics</div>
                      <div class="feature-item">Manage projects and track student engagement</div>
                    </div>

                    <center>
                      <a href="https://projectify-syllabus.lovable.app/upload" class="button">
                        Get Started - Upload Your First Syllabus
                      </a>
                    </center>

                    <p style="margin-top: 30px;">
                      <strong>Next Steps:</strong><br>
                      1. Log in to your account<br>
                      2. Navigate to the "Upload Syllabus" page<br>
                      3. Upload your course syllabus (PDF format)<br>
                      4. Our AI will analyze your curriculum and generate relevant industry projects
                    </p>

                    <p style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
                      Questions? Need help getting started? Reply to this email and our team will be happy to assist you.
                    </p>

                    <p style="color: #666; font-size: 14px;">
                      Best regards,<br>
                      <strong>The SyllabusStack Team</strong>
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Resend API error: ${response.status} - ${errorData}`);
      }

      return await response.json();
    });

    // Handle circuit breaker result
    if (!result.success) {
      console.error("❌ Email service failure:", result.error);
      const statusCode = result.circuitState === CircuitState.OPEN ? 503 : 500;
      return new Response(
        JSON.stringify({ error: result.error || 'Email service failed' }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("✅ Faculty approval email sent successfully:", result.data);

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("❌ Error sending faculty approval email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
