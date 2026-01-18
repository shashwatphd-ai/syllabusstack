// ============================================================================
// CLOUD STORAGE CLIENT - GCS Operations for Vertex AI Batch
// ============================================================================
//
// PURPOSE: Handle Cloud Storage operations for batch input/output files
//
// WHY THIS APPROACH:
//   - Vertex AI batch prediction requires input/output in Cloud Storage
//   - JSONL format is required for batch inference
//   - Separate client provides clean separation of concerns
//
// OPERATIONS:
//   - uploadJsonl(): Upload array of objects as JSONL file
//   - downloadJsonl(): Download and parse JSONL file
//   - listFiles(): List files in a directory
//   - deleteFile(): Clean up processed files
//
// ENVIRONMENT VARIABLES:
//   - GCS_BUCKET: Cloud Storage bucket name
//
// ============================================================================

import { VertexAIAuth } from './vertex-ai-auth.ts';

/**
 * Retry configuration for GCS operations
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Cloud Storage client for batch input/output files
 */
export class GCSClient {
  private auth: VertexAIAuth;
  private bucket: string;

  /**
   * Create a new GCSClient
   * @param auth VertexAIAuth instance for authentication
   * @param bucket Cloud Storage bucket name
   */
  constructor(auth: VertexAIAuth, bucket: string) {
    this.auth = auth;
    this.bucket = bucket;
  }

  /**
   * Upload JSONL content to Cloud Storage
   * Each object in the array becomes one line in the JSONL file
   *
   * @param path Path within bucket (e.g., "inputs/batch123/requests.jsonl")
   * @param lines Array of objects to write as JSONL
   * @returns Full GCS URI (gs://bucket/path)
   */
  async uploadJsonl(path: string, lines: object[]): Promise<string> {
    // Convert array to JSONL (one JSON object per line)
    const content = lines.map(line => JSON.stringify(line)).join('\n');

    console.log(`[GCS] Uploading ${lines.length} lines to gs://${this.bucket}/${path}`);

    await this.withRetry(async () => {
      const token = await this.auth.getAccessToken();

      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: content,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GCS upload failed: ${response.status} - ${errorText}`);
      }

      return response.json();
    }, 'GCS upload');

    const uri = `gs://${this.bucket}/${path}`;
    console.log(`[GCS] Upload complete: ${uri}`);
    return uri;
  }

  /**
   * Download and parse JSONL file from Cloud Storage
   *
   * @param path Path within bucket or full gs:// URI
   * @returns Array of parsed JSON objects
   */
  async downloadJsonl(path: string): Promise<object[]> {
    // Handle both formats: "path/to/file.jsonl" or "gs://bucket/path/to/file.jsonl"
    let objectPath = path;
    let targetBucket = this.bucket;

    if (path.startsWith('gs://')) {
      const match = path.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (match) {
        targetBucket = match[1];
        objectPath = match[2];
      }
    }

    console.log(`[GCS] Downloading gs://${targetBucket}/${objectPath}`);

    const content = await this.withRetry(async () => {
      const token = await this.auth.getAccessToken();

      const downloadUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(targetBucket)}/o/${encodeURIComponent(objectPath)}?alt=media`;

      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GCS download failed: ${response.status} - ${errorText}`);
      }

      return response.text();
    }, 'GCS download');

    // Parse JSONL (one JSON object per line)
    const lines = content
      .trim()
      .split('\n')
      .filter((line: string) => line.length > 0);

    const results: object[] = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        results.push(JSON.parse(lines[i]));
      } catch (parseError) {
        console.warn(`[GCS] Failed to parse line ${i + 1}: ${parseError}`);
        // Continue with other lines
      }
    }

    console.log(`[GCS] Downloaded and parsed ${results.length} lines`);
    return results;
  }

  /**
   * List files in a GCS directory
   *
   * @param prefix Directory prefix (e.g., "outputs/batch123/")
   * @returns Array of file paths (relative to bucket)
   */
  async listFiles(prefix: string): Promise<string[]> {
    // Clean prefix from gs:// URI if present
    let cleanPrefix = prefix;
    let targetBucket = this.bucket;

    if (prefix.startsWith('gs://')) {
      const match = prefix.match(/^gs:\/\/([^\/]+)\/(.*)$/);
      if (match) {
        targetBucket = match[1];
        cleanPrefix = match[2];
      }
    }

    console.log(`[GCS] Listing files in gs://${targetBucket}/${cleanPrefix}`);

    const data = await this.withRetry(async () => {
      const token = await this.auth.getAccessToken();

      const listUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(targetBucket)}/o?prefix=${encodeURIComponent(cleanPrefix)}`;

      const response = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GCS list failed: ${response.status} - ${errorText}`);
      }

      return response.json();
    }, 'GCS list');

    const files = (data.items || []).map((item: { name: string }) => item.name);
    console.log(`[GCS] Found ${files.length} files`);
    return files;
  }

  /**
   * Delete a file from Cloud Storage
   *
   * @param path Path within bucket or full gs:// URI
   */
  async deleteFile(path: string): Promise<void> {
    // Handle both formats
    let objectPath = path;
    let targetBucket = this.bucket;

    if (path.startsWith('gs://')) {
      const match = path.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (match) {
        targetBucket = match[1];
        objectPath = match[2];
      }
    }

    console.log(`[GCS] Deleting gs://${targetBucket}/${objectPath}`);

    const token = await this.auth.getAccessToken();

    const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(targetBucket)}/o/${encodeURIComponent(objectPath)}`;

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // 404 is acceptable (file already deleted)
    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`GCS delete failed: ${response.status} - ${errorText}`);
    }

    console.log(`[GCS] Delete complete`);
  }

  /**
   * Check if a file exists in Cloud Storage
   *
   * @param path Path within bucket or full gs:// URI
   * @returns true if file exists
   */
  async fileExists(path: string): Promise<boolean> {
    let objectPath = path;
    let targetBucket = this.bucket;

    if (path.startsWith('gs://')) {
      const match = path.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (match) {
        targetBucket = match[1];
        objectPath = match[2];
      }
    }

    const token = await this.auth.getAccessToken();

    const metadataUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(targetBucket)}/o/${encodeURIComponent(objectPath)}`;

    const response = await fetch(metadataUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.ok;
  }

  /**
   * Get the bucket name
   */
  get bucketName(): string {
    return this.bucket;
  }

  /**
   * Build a GCS URI from bucket and path
   */
  buildUri(path: string): string {
    return `gs://${this.bucket}/${path}`;
  }

  /**
   * Execute an operation with retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = RETRY_CONFIG.initialDelayMs;

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on 4xx errors (except 429)
        const is4xxError = lastError.message.includes(': 4') &&
                          !lastError.message.includes(': 429');
        if (is4xxError) {
          throw lastError;
        }

        if (attempt < RETRY_CONFIG.maxRetries) {
          console.warn(`[GCS] ${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        }
      }
    }

    throw lastError;
  }
}

/**
 * Factory function to create GCSClient from environment
 * @throws Error if GCS_BUCKET is not set
 */
export function createGCSClient(auth: VertexAIAuth): GCSClient {
  const bucket = Deno.env.get('GCS_BUCKET');
  if (!bucket) {
    throw new Error('GCS_BUCKET environment variable not set. Please add your Cloud Storage bucket name to Supabase secrets.');
  }
  return new GCSClient(auth, bucket);
}

/**
 * Get the GCS bucket name from environment
 */
export function getGCSBucket(): string {
  const bucket = Deno.env.get('GCS_BUCKET');
  if (!bucket) {
    throw new Error('GCS_BUCKET environment variable not set');
  }
  return bucket;
}
