// Cancel a Vertex AI batch prediction job to stop API charges
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { VertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { job_name } = await req.json();

    if (!job_name) {
      return createErrorResponse('BAD_REQUEST', corsHeaders, 'job_name required');
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

    return createSuccessResponse({ success: true, message: 'Job cancellation requested' }, corsHeaders);
  } catch (error: unknown) {
    logError('cancel-batch-job', error);
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : String(error));
  }
});
