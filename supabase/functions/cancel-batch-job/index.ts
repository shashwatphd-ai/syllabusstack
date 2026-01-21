// Cancel a Vertex AI batch prediction job to stop API charges
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { VertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_name } = await req.json();

    if (!job_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'job_name required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Cancel] Cancelling Vertex AI job: ${job_name}`);

    // Initialize Vertex AI auth
    const serviceAccountKey = Deno.env.get('GCP_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      throw new Error('GCP_SERVICE_ACCOUNT_KEY not configured');
    }
    const auth = new VertexAIAuth(serviceAccountKey);
    const batchClient = new VertexAIBatchClient(auth);

    // Cancel the job
    await batchClient.cancelBatchJob(job_name);

    console.log(`[Cancel] Job cancellation requested successfully`);

    return new Response(
      JSON.stringify({ success: true, message: 'Job cancellation requested' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Cancel] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
