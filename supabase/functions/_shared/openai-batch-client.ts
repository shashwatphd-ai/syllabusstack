// ============================================================================
// OPENAI BATCH CLIENT - Batch API Operations
// ============================================================================
//
// PURPOSE: Handle OpenAI Batch API operations for large-scale processing
//          with 50% cost discount (same as Vertex AI Batch)
//
// MIGRATION: This replaces vertex-ai-batch.ts for batch operations
//
// API FLOW:
//   1. Build JSONL with batch requests
//   2. Upload JSONL to OpenAI Files API
//   3. Create batch with POST /v1/batches
//   4. Poll GET /v1/batches/{id} for completion
//   5. Download results from output_file_id
//
// ENVIRONMENT VARIABLES:
//   - OPENAI_API_KEY: OpenAI API key (required)
//
// USAGE:
//   import { OpenAIBatchClient } from "../_shared/openai-batch-client.ts";
//
//   const client = new OpenAIBatchClient();
//   const batch = await client.createBatch({
//     displayName: 'curriculum-batch-123',
//     requests: [
//       { custom_id: 'lo-1', method: 'POST', url: '/v1/chat/completions', body: {...} },
//       { custom_id: 'lo-2', method: 'POST', url: '/v1/chat/completions', body: {...} },
//     ]
//   });
//
// ============================================================================

const OPENAI_API_BASE = 'https://api.openai.com/v1';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Batch job status enumeration
 */
export type BatchJobStatus =
  | 'validating'
  | 'failed'
  | 'in_progress'
  | 'finalizing'
  | 'completed'
  | 'expired'
  | 'cancelling'
  | 'cancelled';

/**
 * Individual batch request (JSONL line format)
 */
export interface BatchRequest {
  custom_id: string;
  method: 'POST';
  url: '/v1/chat/completions';
  body: {
    model: string;
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string };
    tools?: Array<{
      type: 'function';
      function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
      };
    }>;
    tool_choice?: unknown;
  };
}

/**
 * Batch job configuration for creation
 */
export interface BatchJobConfig {
  displayName: string;        // For logging/tracking (stored in metadata)
  requests: BatchRequest[];   // Array of requests to process
}

/**
 * Request counts in batch
 */
export interface RequestCounts {
  total: number;
  completed: number;
  failed: number;
}

/**
 * Batch job response from API
 */
export interface BatchJob {
  id: string;
  object: 'batch';
  endpoint: string;
  errors: {
    object: string;
    data: Array<{
      code: string;
      message: string;
      param: string | null;
      line: number | null;
    }>;
  } | null;
  input_file_id: string;
  completion_window: string;
  status: BatchJobStatus;
  output_file_id: string | null;
  error_file_id: string | null;
  created_at: number;
  in_progress_at: number | null;
  expires_at: number | null;
  finalizing_at: number | null;
  completed_at: number | null;
  failed_at: number | null;
  expired_at: number | null;
  cancelling_at: number | null;
  cancelled_at: number | null;
  request_counts: RequestCounts;
  metadata: Record<string, string> | null;
}

/**
 * Individual result from completed batch
 */
export interface BatchResult {
  id: string;
  custom_id: string;
  response: {
    status_code: number;
    request_id: string;
    body: {
      id: string;
      object: string;
      created: number;
      model: string;
      choices: Array<{
        index: number;
        message: {
          role: 'assistant';
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: {
              name: string;
              arguments: string;
            };
          }>;
        };
        finish_reason: string;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

/**
 * File upload response
 */
interface FileObject {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

// ============================================================================
// OPENAI BATCH CLIENT CLASS
// ============================================================================

export class OpenAIBatchClient {
  private apiKey: string;

  constructor() {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.apiKey = apiKey;
  }

  // ==========================================================================
  // FILE OPERATIONS
  // ==========================================================================

  /**
   * Upload JSONL file to OpenAI Files API
   */
  private async uploadFile(jsonlContent: string, filename: string): Promise<FileObject> {
    console.log(`[OpenAI Batch] Uploading file: ${filename} (${jsonlContent.length} bytes)`);

    // Create form data with file
    const formData = new FormData();
    const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
    formData.append('file', blob, filename);
    formData.append('purpose', 'batch');

    const response = await fetch(`${OPENAI_API_BASE}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenAI Batch] File upload failed: ${response.status}`, errorText);
      throw new Error(`OpenAI file upload failed: ${response.status} - ${errorText}`);
    }

    const fileObj: FileObject = await response.json();
    console.log(`[OpenAI Batch] File uploaded: ${fileObj.id}`);
    return fileObj;
  }

  /**
   * Download file content from OpenAI Files API
   */
  private async downloadFile(fileId: string): Promise<string> {
    console.log(`[OpenAI Batch] Downloading file: ${fileId}`);

    const response = await fetch(`${OPENAI_API_BASE}/files/${fileId}/content`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI file download failed: ${response.status} - ${errorText}`);
    }

    const content = await response.text();
    console.log(`[OpenAI Batch] File downloaded: ${content.length} bytes`);
    return content;
  }

  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================

  /**
   * Create a new batch job
   *
   * @param config Job configuration (displayName, requests)
   * @returns Created batch job
   */
  async createBatch(config: BatchJobConfig): Promise<BatchJob> {
    // Build JSONL content
    const jsonlLines = config.requests.map(req => JSON.stringify(req));
    const jsonlContent = jsonlLines.join('\n');

    console.log(`[OpenAI Batch] Creating batch: ${config.displayName}`);
    console.log(`[OpenAI Batch] Requests: ${config.requests.length}`);

    // Upload input file
    const timestamp = Date.now();
    const filename = `batch-${config.displayName}-${timestamp}.jsonl`;
    const inputFile = await this.uploadFile(jsonlContent, filename);

    // Create batch
    const response = await fetch(`${OPENAI_API_BASE}/batches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_file_id: inputFile.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
        metadata: {
          display_name: config.displayName,
          created_by: 'syllabusstack',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenAI Batch] Create batch failed: ${response.status}`, errorText);
      throw new Error(`OpenAI batch creation failed: ${response.status} - ${errorText}`);
    }

    const batch: BatchJob = await response.json();
    console.log(`[OpenAI Batch] Batch created: ${batch.id}`);
    console.log(`[OpenAI Batch] Initial status: ${batch.status}`);

    return batch;
  }

  /**
   * Get the status of a batch job
   *
   * @param batchId Batch ID
   * @returns Current batch status
   */
  async getBatch(batchId: string): Promise<BatchJob> {
    const response = await fetch(`${OPENAI_API_BASE}/batches/${batchId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI get batch failed: ${response.status} - ${errorText}`);
    }

    const batch: BatchJob = await response.json();
    console.log(`[OpenAI Batch] Batch ${batchId} status: ${batch.status}`);

    if (batch.request_counts) {
      console.log(`[OpenAI Batch] Progress: ${batch.request_counts.completed}/${batch.request_counts.total} completed, ${batch.request_counts.failed} failed`);
    }

    return batch;
  }

  /**
   * Cancel a batch job
   *
   * @param batchId Batch ID to cancel
   */
  async cancelBatch(batchId: string): Promise<BatchJob> {
    console.log(`[OpenAI Batch] Cancelling batch: ${batchId}`);

    const response = await fetch(`${OPENAI_API_BASE}/batches/${batchId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI cancel batch failed: ${response.status} - ${errorText}`);
    }

    const batch: BatchJob = await response.json();
    console.log(`[OpenAI Batch] Batch cancellation requested, status: ${batch.status}`);

    return batch;
  }

  /**
   * Get results from a completed batch
   *
   * @param outputFileId Output file ID from completed batch
   * @returns Array of batch results
   */
  async getResults(outputFileId: string): Promise<BatchResult[]> {
    const content = await this.downloadFile(outputFileId);
    const lines = content.trim().split('\n');
    const results: BatchResult[] = lines.map(line => JSON.parse(line));

    console.log(`[OpenAI Batch] Retrieved ${results.length} results`);
    return results;
  }

  /**
   * Get error details from a failed/partially failed batch
   *
   * @param errorFileId Error file ID from batch
   * @returns Array of error entries
   */
  async getErrors(errorFileId: string): Promise<BatchResult[]> {
    const content = await this.downloadFile(errorFileId);
    const lines = content.trim().split('\n');
    return lines.map(line => JSON.parse(line));
  }

  /**
   * Wait for a batch job to complete (with timeout)
   *
   * @param batchId Batch ID to wait for
   * @param pollIntervalMs Polling interval in milliseconds (default: 30000)
   * @param timeoutMs Maximum wait time in milliseconds (default: 3600000 = 1 hour)
   * @returns Final batch status
   */
  async waitForCompletion(
    batchId: string,
    pollIntervalMs: number = 30000,
    timeoutMs: number = 3600000
  ): Promise<BatchJob> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const batch = await this.getBatch(batchId);

      if (OpenAIBatchClient.isTerminalState(batch.status)) {
        return batch;
      }

      console.log(`[OpenAI Batch] Batch still ${batch.status}, waiting ${pollIntervalMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Batch job timed out after ${timeoutMs / 1000}s`);
  }

  /**
   * List recent batch jobs
   *
   * @param limit Number of jobs to return (default: 20)
   * @returns Array of batch jobs
   */
  async listBatches(limit: number = 20): Promise<BatchJob[]> {
    const response = await fetch(`${OPENAI_API_BASE}/batches?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI list batches failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  // ==========================================================================
  // STATIC UTILITY METHODS
  // ==========================================================================

  /**
   * Map OpenAI batch status to internal status string
   * (Compatible with existing batch_jobs table)
   */
  static mapStatusToInternal(status: BatchJobStatus): string {
    const statusMap: Record<BatchJobStatus, string> = {
      'validating': 'submitted',
      'in_progress': 'processing',
      'finalizing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'expired': 'failed',
      'cancelling': 'processing',
      'cancelled': 'failed',
    };
    return statusMap[status] || 'submitted';
  }

  /**
   * Check if batch is in a terminal state (no more updates expected)
   */
  static isTerminalState(status: BatchJobStatus): boolean {
    return ['completed', 'failed', 'expired', 'cancelled'].includes(status);
  }

  /**
   * Check if batch completed successfully
   */
  static isSuccessState(status: BatchJobStatus): boolean {
    return status === 'completed';
  }

  /**
   * Check if batch failed
   */
  static isFailedState(status: BatchJobStatus): boolean {
    return ['failed', 'expired', 'cancelled'].includes(status);
  }

  /**
   * Extract counts from batch request_counts
   */
  static extractCounts(counts?: RequestCounts): { succeeded: number; failed: number; total: number } {
    return {
      succeeded: counts?.completed || 0,
      failed: counts?.failed || 0,
      total: counts?.total || 0,
    };
  }

  /**
   * Build a batch request for a chat completion
   *
   * @param customId Unique ID for correlating response
   * @param model OpenAI model ID
   * @param systemPrompt System prompt
   * @param userPrompt User prompt
   * @param options Additional options
   * @returns BatchRequest object
   */
  static buildChatRequest(
    customId: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      max_tokens?: number;
      json?: boolean;
    } = {}
  ): BatchRequest {
    const body: BatchRequest['body'] = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.max_tokens !== undefined) {
      body.max_tokens = options.max_tokens;
    }
    if (options.json) {
      body.response_format = { type: 'json_object' };
    }

    return {
      custom_id: customId,
      method: 'POST',
      url: '/v1/chat/completions',
      body,
    };
  }

  /**
   * Build a batch request with function calling
   *
   * @param customId Unique ID for correlating response
   * @param model OpenAI model ID
   * @param systemPrompt System prompt
   * @param userPrompt User prompt
   * @param schema Function schema (Google format)
   * @param options Additional options
   * @returns BatchRequest object
   */
  static buildFunctionRequest(
    customId: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: { name: string; description?: string; parameters: Record<string, unknown> },
    options: { temperature?: number } = {}
  ): BatchRequest {
    return {
      custom_id: customId,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: options.temperature,
        tools: [{
          type: 'function',
          function: {
            name: schema.name,
            description: schema.description,
            parameters: schema.parameters,
          },
        }],
        tool_choice: { type: 'function', function: { name: schema.name } },
      },
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create OpenAIBatchClient
 */
export function createOpenAIBatchClient(): OpenAIBatchClient {
  return new OpenAIBatchClient();
}
