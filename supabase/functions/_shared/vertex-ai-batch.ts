// ============================================================================
// VERTEX AI BATCH CLIENT - Batch Prediction Job Operations
// ============================================================================
//
// PURPOSE: Handle Vertex AI batch prediction job operations
//
// WHY THIS APPROACH:
//   - Vertex AI batch prediction provides 50% cost discount
//   - Enterprise-grade reliability and monitoring
//   - Full support for Gemini 3 models
//   - Async processing for large-scale operations
//
// API ENDPOINTS:
//   - POST /batchPredictionJobs - Create new batch job
//   - GET /batchPredictionJobs/{id} - Get job status
//   - POST /batchPredictionJobs/{id}:cancel - Cancel job
//
// ENVIRONMENT VARIABLES:
//   - GCP_PROJECT_ID: Google Cloud project ID
//   - GCP_REGION: Vertex AI region (default: us-central1)
//
// ============================================================================

import { VertexAIAuth, getGCPRegion } from './vertex-ai-auth.ts';

/**
 * Vertex AI batch job state enumeration
 * See: https://cloud.google.com/vertex-ai/docs/reference/rest/v1/JobState
 */
export type BatchJobState =
  | 'JOB_STATE_UNSPECIFIED'
  | 'JOB_STATE_QUEUED'
  | 'JOB_STATE_PENDING'
  | 'JOB_STATE_RUNNING'
  | 'JOB_STATE_SUCCEEDED'
  | 'JOB_STATE_FAILED'
  | 'JOB_STATE_CANCELLING'
  | 'JOB_STATE_CANCELLED'
  | 'JOB_STATE_PAUSED'
  | 'JOB_STATE_EXPIRED'
  | 'JOB_STATE_UPDATING'
  | 'JOB_STATE_PARTIALLY_SUCCEEDED';

/**
 * Batch job configuration for creation
 */
export interface BatchJobConfig {
  displayName: string;
  model: string;           // e.g., "publishers/google/models/gemini-3-pro-preview"
  inputUri: string;        // gs://bucket/path/to/input.jsonl
  outputUriPrefix: string; // gs://bucket/outputs/batch123/
}

/**
 * Completion statistics from batch job
 */
export interface CompletionStats {
  successfulCount: string;
  failedCount: string;
  incompleteCount: string;
  successfulForecastPointCount?: string;
  failedForecastPointCount?: string;
}

/**
 * Output info from completed batch job
 */
export interface OutputInfo {
  gcsOutputDirectory: string;
  bigqueryOutputDataset?: string;
  bigqueryOutputTable?: string;
}

/**
 * Error details from failed batch job
 */
export interface BatchJobError {
  code: number;
  message: string;
  details?: any[];
}

/**
 * Batch job status response from Vertex AI
 */
export interface BatchJobStatus {
  name: string;             // Full resource name: projects/.../batchPredictionJobs/123
  displayName: string;
  model: string;
  state: BatchJobState;
  createTime: string;
  startTime?: string;
  endTime?: string;
  updateTime: string;
  completionStats?: CompletionStats;
  outputInfo?: OutputInfo;
  error?: BatchJobError;
  partialFailures?: BatchJobError[];
  resourcesConsumed?: {
    replicaHours: number;
  };
}

/**
 * Check if a model requires the global endpoint
 * Gemini 3 preview models are only available via the global endpoint
 * @param modelPath Model path (e.g., "publishers/google/models/gemini-3-pro-preview")
 * @returns true if the model requires the global endpoint
 */
function requiresGlobalEndpoint(modelPath: string): boolean {
  // Extract model ID from path
  const modelId = modelPath.includes('/')
    ? modelPath.split('/').pop() || ''
    : modelPath;

  // Gemini 3 preview models require global endpoint
  return modelId.includes('gemini-3') && modelId.includes('preview');
}

/**
 * Vertex AI Batch Prediction client
 */
export class VertexAIBatchClient {
  private auth: VertexAIAuth;
  private region: string;

  /**
   * Create a new VertexAIBatchClient
   * @param auth VertexAIAuth instance for authentication
   * @param region GCP region for Vertex AI (default: us-central1)
   */
  constructor(auth: VertexAIAuth, region?: string) {
    this.auth = auth;
    this.region = region || getGCPRegion();
  }

  /**
   * Get the base URL for Vertex AI API (regional endpoint)
   */
  private get baseUrl(): string {
    return `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.auth.projectId}/locations/${this.region}`;
  }

  /**
   * Get the base URL for Vertex AI API using the global endpoint
   * Required for Gemini 3 preview models
   */
  private get globalBaseUrl(): string {
    return `https://aiplatform.googleapis.com/v1/projects/${this.auth.projectId}/locations/global`;
  }

  /**
   * Get the appropriate base URL for a given model
   * Uses global endpoint for Gemini 3 preview models, regional for others
   */
  private getBaseUrlForModel(modelPath: string): string {
    if (requiresGlobalEndpoint(modelPath)) {
      console.log(`[VertexAI Batch] Using global endpoint for model: ${modelPath}`);
      return this.globalBaseUrl;
    }
    return this.baseUrl;
  }

  /**
   * Create a new batch prediction job
   *
   * @param config Job configuration (displayName, model, inputUri, outputUriPrefix)
   * @returns Created job status
   */
  async createBatchJob(config: BatchJobConfig): Promise<BatchJobStatus> {
    const token = await this.auth.getAccessToken();

    const requestBody = {
      displayName: config.displayName,
      model: config.model,
      inputConfig: {
        instancesFormat: 'jsonl',
        gcsSource: {
          uris: [config.inputUri],
        },
      },
      outputConfig: {
        predictionsFormat: 'jsonl',
        gcsDestination: {
          outputUriPrefix: config.outputUriPrefix,
        },
      },
    };

    // Determine the appropriate endpoint (global for Gemini 3 preview models)
    const endpointBaseUrl = this.getBaseUrlForModel(config.model);

    console.log(`[VertexAI Batch] Creating job: ${config.displayName}`);
    console.log(`[VertexAI Batch] Model: ${config.model}`);
    console.log(`[VertexAI Batch] Input: ${config.inputUri}`);
    console.log(`[VertexAI Batch] Output: ${config.outputUriPrefix}`);
    console.log(`[VertexAI Batch] Endpoint: ${endpointBaseUrl}/batchPredictionJobs`);

    const response = await fetch(`${endpointBaseUrl}/batchPredictionJobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VertexAI Batch] Create job failed: ${response.status}`, errorText);
      throw new Error(`Vertex AI batch job creation failed: ${response.status} - ${errorText}`);
    }

    const jobStatus: BatchJobStatus = await response.json();
    console.log(`[VertexAI Batch] Job created: ${jobStatus.name}`);
    console.log(`[VertexAI Batch] Initial state: ${jobStatus.state}`);

    return jobStatus;
  }

  /**
   * Get the status of a batch prediction job
   *
   * @param jobName Full resource name or job ID
   * @returns Current job status
   */
  async getBatchJob(jobName: string): Promise<BatchJobStatus> {
    const token = await this.auth.getAccessToken();

    // Handle both formats: full name or just job ID
    let url: string;
    if (jobName.startsWith('projects/')) {
      // Full resource name - determine if it's a global or regional endpoint
      // Job name format: projects/{project}/locations/{location}/batchPredictionJobs/{job_id}
      if (jobName.includes('/locations/global/')) {
        // Global endpoint job
        url = `https://aiplatform.googleapis.com/v1/${jobName}`;
      } else {
        // Regional endpoint job - extract region from job name or use configured region
        const locationMatch = jobName.match(/locations\/([^/]+)/);
        const jobRegion = locationMatch ? locationMatch[1] : this.region;
        url = `https://${jobRegion}-aiplatform.googleapis.com/v1/${jobName}`;
      }
    } else {
      // Just the job ID - use configured region
      url = `${this.baseUrl}/batchPredictionJobs/${jobName}`;
    }

    console.log(`[VertexAI Batch] Getting job status from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VertexAI Batch] Get job failed: ${response.status}`, errorText);
      throw new Error(`Vertex AI get job failed: ${response.status} - ${errorText}`);
    }

    const jobStatus: BatchJobStatus = await response.json();
    console.log(`[VertexAI Batch] Job ${this.extractJobId(jobName)} state: ${jobStatus.state}`);

    return jobStatus;
  }

  /**
   * Cancel a batch prediction job
   *
   * @param jobName Full resource name or job ID
   */
  async cancelBatchJob(jobName: string): Promise<void> {
    const token = await this.auth.getAccessToken();

    let url: string;
    if (jobName.startsWith('projects/')) {
      // Full resource name - determine if it's a global or regional endpoint
      if (jobName.includes('/locations/global/')) {
        url = `https://aiplatform.googleapis.com/v1/${jobName}:cancel`;
      } else {
        const locationMatch = jobName.match(/locations\/([^/]+)/);
        const jobRegion = locationMatch ? locationMatch[1] : this.region;
        url = `https://${jobRegion}-aiplatform.googleapis.com/v1/${jobName}:cancel`;
      }
    } else {
      url = `${this.baseUrl}/batchPredictionJobs/${jobName}:cancel`;
    }

    console.log(`[VertexAI Batch] Cancelling job: ${jobName}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VertexAI Batch] Cancel job failed: ${response.status}`, errorText);
      throw new Error(`Vertex AI cancel job failed: ${response.status} - ${errorText}`);
    }

    console.log(`[VertexAI Batch] Job cancellation requested`);
  }

  /**
   * List batch prediction jobs
   *
   * @param pageSize Number of jobs to return (default: 10)
   * @param filter Optional filter expression
   * @returns Array of job statuses
   */
  async listBatchJobs(pageSize: number = 10, filter?: string): Promise<BatchJobStatus[]> {
    const token = await this.auth.getAccessToken();

    let url = `${this.baseUrl}/batchPredictionJobs?pageSize=${pageSize}`;
    if (filter) {
      url += `&filter=${encodeURIComponent(filter)}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI list jobs failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.batchPredictionJobs || [];
  }

  /**
   * Wait for a batch job to complete (with timeout)
   *
   * @param jobName Full resource name or job ID
   * @param pollIntervalMs Polling interval in milliseconds (default: 30000)
   * @param timeoutMs Maximum wait time in milliseconds (default: 3600000 = 1 hour)
   * @returns Final job status
   */
  async waitForCompletion(
    jobName: string,
    pollIntervalMs: number = 30000,
    timeoutMs: number = 3600000
  ): Promise<BatchJobStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getBatchJob(jobName);

      if (VertexAIBatchClient.isTerminalState(status.state)) {
        return status;
      }

      console.log(`[VertexAI Batch] Job still running, waiting ${pollIntervalMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Batch job timed out after ${timeoutMs / 1000}s`);
  }

  /**
   * Extract job ID from full resource name
   */
  private extractJobId(jobName: string): string {
    if (jobName.startsWith('projects/')) {
      const parts = jobName.split('/');
      return parts[parts.length - 1];
    }
    return jobName;
  }

  /**
   * Get the region this client is configured for
   */
  get configuredRegion(): string {
    return this.region;
  }

  /**
   * Get the project ID this client is configured for
   */
  get projectId(): string {
    return this.auth.projectId;
  }

  // ============================================================================
  // STATIC UTILITY METHODS
  // ============================================================================

  /**
   * Map Vertex AI job state to internal status string
   */
  static mapJobStateToStatus(state: BatchJobState): string {
    const stateMap: Record<BatchJobState, string> = {
      'JOB_STATE_UNSPECIFIED': 'submitted',
      'JOB_STATE_QUEUED': 'submitted',
      'JOB_STATE_PENDING': 'submitted',
      'JOB_STATE_RUNNING': 'processing',
      'JOB_STATE_SUCCEEDED': 'completed',
      'JOB_STATE_FAILED': 'failed',
      'JOB_STATE_CANCELLING': 'processing',
      'JOB_STATE_CANCELLED': 'failed',
      'JOB_STATE_PAUSED': 'processing',
      'JOB_STATE_EXPIRED': 'failed',
      'JOB_STATE_UPDATING': 'processing',
      'JOB_STATE_PARTIALLY_SUCCEEDED': 'partial',
    };
    return stateMap[state] || 'submitted';
  }

  /**
   * Check if job is in a terminal state (no more updates expected)
   */
  static isTerminalState(state: BatchJobState): boolean {
    return [
      'JOB_STATE_SUCCEEDED',
      'JOB_STATE_FAILED',
      'JOB_STATE_CANCELLED',
      'JOB_STATE_EXPIRED',
      'JOB_STATE_PARTIALLY_SUCCEEDED',
    ].includes(state);
  }

  /**
   * Check if job completed successfully
   */
  static isSuccessState(state: BatchJobState): boolean {
    return state === 'JOB_STATE_SUCCEEDED';
  }

  /**
   * Check if job failed
   */
  static isFailedState(state: BatchJobState): boolean {
    return [
      'JOB_STATE_FAILED',
      'JOB_STATE_CANCELLED',
      'JOB_STATE_EXPIRED',
    ].includes(state);
  }

  /**
   * Extract counts from completion stats (handles string to number conversion)
   */
  static extractCounts(stats?: CompletionStats): { succeeded: number; failed: number; incomplete: number } {
    return {
      succeeded: parseInt(stats?.successfulCount || '0', 10),
      failed: parseInt(stats?.failedCount || '0', 10),
      incomplete: parseInt(stats?.incompleteCount || '0', 10),
    };
  }

  /**
   * Build the Vertex AI model path from model ID
   * @param modelId Model ID (e.g., "gemini-3-pro-preview")
   * @returns Full model path (e.g., "publishers/google/models/gemini-3-pro-preview")
   */
  static buildModelPath(modelId: string): string {
    // If already a full path, return as-is
    if (modelId.startsWith('publishers/') || modelId.startsWith('projects/')) {
      return modelId;
    }
    return `publishers/google/models/${modelId}`;
  }
}

/**
 * Factory function to create VertexAIBatchClient from environment
 */
export function createVertexAIBatchClient(auth: VertexAIAuth): VertexAIBatchClient {
  const region = getGCPRegion();
  return new VertexAIBatchClient(auth, region);
}
