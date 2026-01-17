# Vertex AI Batch Implementation Plan

## Document Purpose

This document provides a complete handover plan for migrating the batch slide generation system from the **Gemini API (`generativelanguage.googleapis.com`)** to **Vertex AI Batch Prediction (`aiplatform.googleapis.com`)**. It is designed for another Claude Code agent to continue implementation in a new session.

---

## Table of Contents

1. [Background & Problem Statement](#1-background--problem-statement)
2. [Current System Architecture](#2-current-system-architecture)
3. [Target System Architecture](#3-target-system-architecture)
4. [Google Cloud Requirements](#4-google-cloud-requirements)
5. [Detailed Implementation Plan](#5-detailed-implementation-plan)
6. [Code Preservation Guide](#6-code-preservation-guide)
7. [Error Mitigation Strategy](#7-error-mitigation-strategy)
8. [Testing & Validation](#8-testing--validation)
9. [Rollback Plan](#9-rollback-plan)

---

## 1. Background & Problem Statement

### 1.1 Current Issue

The batch slide generation system is returning **404 errors** when calling the Gemini API's `batchGenerateContent` endpoint.

**Error Location**: `supabase/functions/submit-batch-slides/index.ts` line 1117

```typescript
const batchEndpoint = `${GOOGLE_API_BASE}/models/${BATCH_MODEL}:batchGenerateContent`;
// Results in: https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:batchGenerateContent
// Returns: 404 Not Found
```

### 1.2 Root Cause Analysis

After extensive research, we determined:

1. **The `batchGenerateContent` endpoint exists** but may have limited model support
2. **`gemini-3-pro-preview` may not support batch operations** on the Gemini API
3. **The proto file** (`generative_service.proto`) does NOT contain `batchGenerateContent` RPC definition
4. **Google recommends Vertex AI** for production batch processing with 50% cost discount

### 1.3 Decision

Migrate to **Vertex AI Batch Prediction** which:
- Has confirmed 50% cost discount
- Full support for Gemini 3 models
- Enterprise-grade reliability
- Cloud Storage integration for large batches

---

## 2. Current System Architecture

### 2.1 Files Overview

| File | Path | Lines | Purpose |
|------|------|-------|---------|
| Submit Batch | `supabase/functions/submit-batch-slides/index.ts` | 1281 | Submits batch to Google API |
| Poll Status | `supabase/functions/poll-batch-status/index.ts` | 493 | Polls job status & processes results |
| AI Orchestrator | `supabase/functions/_shared/ai-orchestrator.ts` | 454 | Model config, shared utilities |
| DB Migration | `supabase/migrations/20260117100000_batch_jobs_table.sql` | 150 | batch_jobs table schema |

### 2.2 Current Flow

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  submit-batch-slides │────▶│   Gemini API    │
│                 │     │                      │     │ batchGenerate   │
└─────────────────┘     └──────────────────────┘     │ Content         │
                                                      └────────┬────────┘
                                                               │ 404 ERROR
                                                               ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Frontend      │◀────│   poll-batch-status  │◀────│   (Fails)       │
│                 │     │                      │     │                 │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

### 2.3 Current API Configuration

```typescript
// submit-batch-slides/index.ts line 48
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// line 54
const BATCH_MODEL = MODEL_CONFIG.GEMINI_PRO; // 'gemini-3-pro-preview'

// line 1117 - The failing endpoint
const batchEndpoint = `${GOOGLE_API_BASE}/models/${BATCH_MODEL}:batchGenerateContent`;
```

### 2.4 Current Authentication

```typescript
// submit-batch-slides/index.ts line 1126
headers: {
  'Content-Type': 'application/json',
  'x-goog-api-key': googleApiKey,  // API Key authentication
}
```

### 2.5 Current Request Body Format

```typescript
// submit-batch-slides/index.ts lines 1128-1138
body: JSON.stringify({
  batch: {
    display_name: `slides-${instructor_course_id}-${Date.now()}`,
    input_config: {
      requests: {
        requests: formattedRequests,  // Array of {request, metadata}
      },
    },
  },
}),
```

### 2.6 Database Schema

```sql
-- batch_jobs table
CREATE TABLE public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_batch_id TEXT NOT NULL,           -- Stores Google's job ID
  instructor_course_id UUID NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'slides',
  total_requests INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted/processing/completed/failed/partial
  succeeded_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  output_uri TEXT,                          -- For file-based batches
  error_message TEXT,
  failed_request_keys JSONB DEFAULT '[]',
  request_mapping JSONB NOT NULL DEFAULT '{}', -- Maps keys to teaching_unit_ids
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- lecture_slides additions
ALTER TABLE public.lecture_slides
  ADD COLUMN batch_job_id UUID REFERENCES public.batch_jobs(id);
```

---

## 3. Target System Architecture

### 3.1 New Flow with Vertex AI

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  submit-batch-slides │────▶│  Cloud Storage  │
│                 │     │                      │     │  (Upload JSONL) │
└─────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                               │
                                                               ▼
                        ┌──────────────────────┐     ┌─────────────────┐
                        │    Vertex AI         │◀────│  Create Batch   │
                        │  Batch Prediction    │     │  Prediction Job │
                        │    (Async)           │     └─────────────────┘
                        └──────────┬───────────┘
                                   │ Processes async (up to 24h)
                                   ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Frontend      │◀────│   poll-batch-status  │◀────│  Cloud Storage  │
│                 │     │                      │     │  (Download      │
└─────────────────┘     └──────────────────────┘     │   Results)      │
                                                      └─────────────────┘
```

### 3.2 New API Configuration

```typescript
// NEW: Vertex AI endpoint
const VERTEX_AI_BASE = `https://${GCP_REGION}-aiplatform.googleapis.com/v1`;
const VERTEX_AI_ENDPOINT = `${VERTEX_AI_BASE}/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/batchPredictionJobs`;

// NEW: Model path format for Vertex AI
const VERTEX_MODEL_PATH = `publishers/google/models/${MODEL_CONFIG.GEMINI_PRO}`;
```

### 3.3 New Authentication

```typescript
// OAuth 2.0 with Service Account
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${accessToken}`,  // OAuth access token
}
```

### 3.4 New Request Body Format

```typescript
// Vertex AI batchPredictionJobs format
{
  "displayName": "slides-{course_id}-{timestamp}",
  "model": "publishers/google/models/gemini-3-pro-preview",
  "inputConfig": {
    "instancesFormat": "jsonl",
    "gcsSource": {
      "uris": ["gs://bucket/inputs/batch_id/requests.jsonl"]
    }
  },
  "outputConfig": {
    "predictionsFormat": "jsonl",
    "gcsDestination": {
      "outputUriPrefix": "gs://bucket/outputs/batch_id/"
    }
  }
}
```

### 3.5 JSONL Input File Format

Each line in the JSONL file is a separate request:

```jsonl
{"request":{"contents":[{"role":"user","parts":[{"text":"...user prompt..."}]}],"systemInstruction":{"parts":[{"text":"...system prompt..."}]},"generationConfig":{"temperature":0.7,"maxOutputTokens":8192}}}
{"request":{"contents":[{"role":"user","parts":[{"text":"...user prompt 2..."}]}],"systemInstruction":{"parts":[{"text":"...system prompt..."}]},"generationConfig":{"temperature":0.7,"maxOutputTokens":8192}}}
```

### 3.6 New File Structure

```
supabase/functions/
├── _shared/
│   ├── ai-orchestrator.ts          # EXISTING - Add Vertex AI model paths
│   ├── vertex-ai-auth.ts           # NEW - Service account OAuth
│   ├── gcs-client.ts               # NEW - Cloud Storage operations
│   └── vertex-ai-batch.ts          # NEW - Batch job operations
├── submit-batch-slides/
│   └── index.ts                    # REWRITE - Use Vertex AI
└── poll-batch-status/
    └── index.ts                    # REWRITE - Use Vertex AI
```

---

## 4. Google Cloud Requirements

### 4.1 APIs to Enable

In Google Cloud Console, enable:
- Vertex AI API
- Cloud Storage API
- IAM Service Account Credentials API

### 4.2 Cloud Storage Bucket

Create bucket: `syllabusstack-batch` (or your chosen name)

Recommended structure:
```
gs://syllabusstack-batch/
├── inputs/
│   └── {batch_job_id}/
│       └── requests.jsonl
└── outputs/
    └── {batch_job_id}/
        └── predictions-*.jsonl
```

### 4.3 Service Account Setup

1. Create service account: `syllabusstack-batch@{project-id}.iam.gserviceaccount.com`

2. Grant roles:
   - `roles/aiplatform.user` - For Vertex AI batch operations
   - `roles/storage.objectAdmin` - For Cloud Storage read/write

3. Create and download JSON key

4. Base64 encode the key for Supabase:
   ```bash
   base64 -i service-account-key.json | tr -d '\n'
   ```

### 4.4 Supabase Environment Variables

Add to Supabase Dashboard → Edge Functions → Secrets:

| Variable | Description | Example |
|----------|-------------|---------|
| `GCP_PROJECT_ID` | Google Cloud Project ID | `syllabusstack-prod` |
| `GCP_REGION` | Vertex AI region | `us-central1` |
| `GCS_BUCKET` | Cloud Storage bucket | `syllabusstack-batch` |
| `GCP_SERVICE_ACCOUNT_KEY` | Base64 encoded JSON key | `eyJ0eXBlIjoi...` |

### 4.5 OAuth Token Generation

The service account JSON key contains:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...@....iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

Token generation flow:
1. Create JWT with claims: `iss`, `scope`, `aud`, `exp`, `iat`
2. Sign JWT with RS256 using `private_key`
3. POST to `https://oauth2.googleapis.com/token` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`
4. Receive access token (valid 1 hour)

---

## 5. Detailed Implementation Plan

### Phase 1: Create Shared Utilities

#### 5.1.1 Create `_shared/vertex-ai-auth.ts`

**Purpose**: Handle service account authentication and OAuth token generation

**Key Components**:
- Parse service account JSON key
- Generate RS256-signed JWT
- Exchange JWT for access token
- Cache token (1 hour validity)

**Implementation**:

```typescript
// supabase/functions/_shared/vertex-ai-auth.ts

import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

interface AccessToken {
  token: string;
  expiresAt: number;
}

/**
 * Handles Google Cloud service account authentication for Vertex AI
 * Uses RS256 JWT signing with the service account private key
 */
export class VertexAIAuth {
  private serviceAccount: ServiceAccountKey;
  private cachedToken: AccessToken | null = null;
  private cryptoKey: CryptoKey | null = null;

  constructor(serviceAccountKeyBase64: string) {
    const keyJson = atob(serviceAccountKeyBase64);
    this.serviceAccount = JSON.parse(keyJson);
  }

  /**
   * Get a valid access token, refreshing if needed
   */
  async getAccessToken(): Promise<string> {
    // Check if cached token is still valid (with 60s buffer)
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.token;
    }

    // Generate new token
    const jwt = await this.createSignedJWT();
    const tokenResponse = await this.exchangeJWTForToken(jwt);

    this.cachedToken = {
      token: tokenResponse.access_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
    };

    return this.cachedToken.token;
  }

  /**
   * Get the project ID from the service account
   */
  get projectId(): string {
    return this.serviceAccount.project_id;
  }

  /**
   * Get the service account email
   */
  get clientEmail(): string {
    return this.serviceAccount.client_email;
  }

  /**
   * Create a signed JWT for token exchange
   */
  private async createSignedJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const header = { alg: "RS256" as const, typ: "JWT" };
    const payload = {
      iss: this.serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600), // 1 hour
      iat: getNumericDate(0),
    };

    // Import private key for signing
    const key = await this.getPrivateKey();

    return await create(header, payload, key);
  }

  /**
   * Import the private key from PEM format
   */
  private async getPrivateKey(): Promise<CryptoKey> {
    if (this.cryptoKey) {
      return this.cryptoKey;
    }

    // Extract the base64 key from PEM format
    const pemContents = this.serviceAccount.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\n/g, '');

    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    this.cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    return this.cryptoKey;
  }

  /**
   * Exchange JWT for access token
   */
  private async exchangeJWTForToken(jwt: string): Promise<{ access_token: string; expires_in: number }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }
}

/**
 * Factory function to create VertexAIAuth from environment
 */
export function createVertexAIAuth(): VertexAIAuth {
  const serviceAccountKey = Deno.env.get('GCP_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY environment variable not set');
  }
  return new VertexAIAuth(serviceAccountKey);
}
```

#### 5.1.2 Create `_shared/gcs-client.ts`

**Purpose**: Handle Cloud Storage operations for JSONL input/output

```typescript
// supabase/functions/_shared/gcs-client.ts

import { VertexAIAuth } from './vertex-ai-auth.ts';

/**
 * Cloud Storage client for batch input/output files
 */
export class GCSClient {
  private auth: VertexAIAuth;
  private bucket: string;

  constructor(auth: VertexAIAuth, bucket: string) {
    this.auth = auth;
    this.bucket = bucket;
  }

  /**
   * Upload JSONL content to Cloud Storage
   * @param path Path within bucket (e.g., "inputs/batch123/requests.jsonl")
   * @param lines Array of objects to write as JSONL
   * @returns Full GCS URI (gs://bucket/path)
   */
  async uploadJsonl(path: string, lines: object[]): Promise<string> {
    const content = lines.map(line => JSON.stringify(line)).join('\n');
    const token = await this.auth.getAccessToken();

    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`;

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

    return `gs://${this.bucket}/${path}`;
  }

  /**
   * Download and parse JSONL file from Cloud Storage
   * @param path Path within bucket or full gs:// URI
   * @returns Array of parsed JSON objects
   */
  async downloadJsonl(path: string): Promise<object[]> {
    // Handle both formats: "path/to/file.jsonl" or "gs://bucket/path/to/file.jsonl"
    let objectPath = path;
    if (path.startsWith('gs://')) {
      const match = path.match(/^gs:\/\/[^\/]+\/(.+)$/);
      if (match) objectPath = match[1];
    }

    const token = await this.auth.getAccessToken();
    const downloadUrl = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(objectPath)}?alt=media`;

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GCS download failed: ${response.status} - ${errorText}`);
    }

    const content = await response.text();
    return content
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));
  }

  /**
   * List files in a GCS directory
   * @param prefix Directory prefix (e.g., "outputs/batch123/")
   * @returns Array of file paths
   */
  async listFiles(prefix: string): Promise<string[]> {
    // Clean prefix from gs:// URI if present
    let cleanPrefix = prefix;
    if (prefix.startsWith('gs://')) {
      const match = prefix.match(/^gs:\/\/[^\/]+\/(.+)$/);
      if (match) cleanPrefix = match[1];
    }

    const token = await this.auth.getAccessToken();
    const listUrl = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o?prefix=${encodeURIComponent(cleanPrefix)}`;

    const response = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GCS list failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return (data.items || []).map((item: { name: string }) => item.name);
  }

  /**
   * Delete a file from Cloud Storage
   */
  async deleteFile(path: string): Promise<void> {
    const token = await this.auth.getAccessToken();
    const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(path)}`;

    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  /**
   * Get the bucket name
   */
  get bucketName(): string {
    return this.bucket;
  }
}

/**
 * Factory function to create GCSClient from environment
 */
export function createGCSClient(auth: VertexAIAuth): GCSClient {
  const bucket = Deno.env.get('GCS_BUCKET');
  if (!bucket) {
    throw new Error('GCS_BUCKET environment variable not set');
  }
  return new GCSClient(auth, bucket);
}
```

#### 5.1.3 Create `_shared/vertex-ai-batch.ts`

**Purpose**: Handle Vertex AI batch prediction job operations

```typescript
// supabase/functions/_shared/vertex-ai-batch.ts

import { VertexAIAuth } from './vertex-ai-auth.ts';

/**
 * Vertex AI batch job state enumeration
 */
export type BatchJobState =
  | 'JOB_STATE_PENDING'
  | 'JOB_STATE_RUNNING'
  | 'JOB_STATE_SUCCEEDED'
  | 'JOB_STATE_FAILED'
  | 'JOB_STATE_CANCELLED'
  | 'JOB_STATE_CANCELLING'
  | 'JOB_STATE_PAUSED'
  | 'JOB_STATE_EXPIRED';

/**
 * Batch job configuration for creation
 */
export interface BatchJobConfig {
  displayName: string;
  model: string;          // e.g., "publishers/google/models/gemini-3-pro-preview"
  inputUri: string;       // gs://bucket/path/to/input.jsonl
  outputUriPrefix: string; // gs://bucket/outputs/batch123/
}

/**
 * Batch job status response from Vertex AI
 */
export interface BatchJobStatus {
  name: string;            // Full resource name
  displayName: string;
  state: BatchJobState;
  createTime: string;
  startTime?: string;
  endTime?: string;
  updateTime: string;
  completionStats?: {
    successfulCount: string;
    failedCount: string;
    incompleteCount: string;
  };
  outputInfo?: {
    gcsOutputDirectory: string;
  };
  error?: {
    code: number;
    message: string;
    details?: any[];
  };
}

/**
 * Vertex AI Batch Prediction client
 */
export class VertexAIBatchClient {
  private auth: VertexAIAuth;
  private region: string;

  constructor(auth: VertexAIAuth, region: string) {
    this.auth = auth;
    this.region = region;
  }

  /**
   * Get the base URL for Vertex AI API
   */
  private get baseUrl(): string {
    return `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.auth.projectId}/locations/${this.region}`;
  }

  /**
   * Create a new batch prediction job
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

    console.log(`[VertexAI] Creating batch job: ${config.displayName}`);
    console.log(`[VertexAI] Input: ${config.inputUri}`);
    console.log(`[VertexAI] Output: ${config.outputUriPrefix}`);
    console.log(`[VertexAI] Model: ${config.model}`);

    const response = await fetch(`${this.baseUrl}/batchPredictionJobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VertexAI] Create job failed: ${response.status} - ${errorText}`);
      throw new Error(`Vertex AI batch job creation failed: ${response.status} - ${errorText}`);
    }

    const jobStatus = await response.json();
    console.log(`[VertexAI] Job created: ${jobStatus.name}`);
    return jobStatus;
  }

  /**
   * Get the status of a batch prediction job
   * @param jobName Full resource name (e.g., projects/.../batchPredictionJobs/123)
   */
  async getBatchJob(jobName: string): Promise<BatchJobStatus> {
    const token = await this.auth.getAccessToken();

    // Handle both formats: full name or just job ID
    const url = jobName.startsWith('projects/')
      ? `https://${this.region}-aiplatform.googleapis.com/v1/${jobName}`
      : `${this.baseUrl}/batchPredictionJobs/${jobName}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI get job failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Cancel a batch prediction job
   */
  async cancelBatchJob(jobName: string): Promise<void> {
    const token = await this.auth.getAccessToken();

    const url = jobName.startsWith('projects/')
      ? `https://${this.region}-aiplatform.googleapis.com/v1/${jobName}:cancel`
      : `${this.baseUrl}/batchPredictionJobs/${jobName}:cancel`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI cancel job failed: ${response.status} - ${errorText}`);
    }

    console.log(`[VertexAI] Job cancelled: ${jobName}`);
  }

  /**
   * List batch prediction jobs
   */
  async listBatchJobs(pageSize: number = 10): Promise<BatchJobStatus[]> {
    const token = await this.auth.getAccessToken();

    const response = await fetch(`${this.baseUrl}/batchPredictionJobs?pageSize=${pageSize}`, {
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
   * Map Vertex AI job state to our internal status
   */
  static mapJobStateToStatus(state: BatchJobState): string {
    const stateMap: Record<BatchJobState, string> = {
      'JOB_STATE_PENDING': 'submitted',
      'JOB_STATE_RUNNING': 'processing',
      'JOB_STATE_SUCCEEDED': 'completed',
      'JOB_STATE_FAILED': 'failed',
      'JOB_STATE_CANCELLED': 'failed',
      'JOB_STATE_CANCELLING': 'processing',
      'JOB_STATE_PAUSED': 'processing',
      'JOB_STATE_EXPIRED': 'failed',
    };
    return stateMap[state] || 'submitted';
  }

  /**
   * Check if job is in a terminal state
   */
  static isTerminalState(state: BatchJobState): boolean {
    return ['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'].includes(state);
  }
}

/**
 * Factory function to create VertexAIBatchClient from environment
 */
export function createVertexAIBatchClient(auth: VertexAIAuth): VertexAIBatchClient {
  const region = Deno.env.get('GCP_REGION') || 'us-central1';
  return new VertexAIBatchClient(auth, region);
}
```

#### 5.1.4 Update `_shared/ai-orchestrator.ts`

Add Vertex AI model paths:

```typescript
// Add to ai-orchestrator.ts after existing MODEL_CONFIG

/**
 * Vertex AI model paths for batch prediction
 * Format: publishers/google/models/{model_id}
 */
export const VERTEX_AI_MODELS = {
  GEMINI_PRO: 'publishers/google/models/gemini-3-pro-preview',
  GEMINI_FLASH: 'publishers/google/models/gemini-2.5-flash',
  GEMINI_3_FLASH: 'publishers/google/models/gemini-3-flash-preview',
  GEMINI_IMAGE: 'publishers/google/models/gemini-3-pro-image-preview',
};

/**
 * Get the Vertex AI model path for a given model config
 */
export function getVertexAIModelPath(modelId: string): string {
  return `publishers/google/models/${modelId}`;
}
```

---

### Phase 2: Rewrite Submit Batch Slides

#### 5.2.1 Key Changes Summary

| Aspect | Current | New |
|--------|---------|-----|
| Lines 1104-1165 | Gemini API batchGenerateContent | Vertex AI batchPredictionJobs |
| Input format | Inline JSON | JSONL in Cloud Storage |
| Auth | API Key | OAuth access token |
| Response | Job name directly | Full job resource name |

#### 5.2.2 Code to PRESERVE (Copy Exactly)

**DO NOT MODIFY these sections** - they ensure quality parity with v3:

- Lines 65-193: `PROFESSOR_SYSTEM_PROMPT`
- Lines 199-291: Type definitions
- Lines 300-360: `buildLectureBrief()`
- Lines 369-414: `mergeResearchIntoBrief()`
- Lines 423-537: `buildUserPrompt()`
- Lines 543-559: `buildPromptForUnit()`
- Lines 569-726: `runResearchAgent()` and `getEmptyResearchContext()`

#### 5.2.3 Code to REPLACE

Replace lines 1075-1165 with Vertex AI submission:

```typescript
// ========================================================================
// 5. UPLOAD REQUESTS TO CLOUD STORAGE
// ========================================================================

// Initialize Vertex AI clients
const auth = createVertexAIAuth();
const gcsClient = createGCSClient(auth);
const batchClient = createVertexAIBatchClient(auth);

// Generate unique batch ID for this submission
const batchId = crypto.randomUUID();
const inputPath = `inputs/${batchId}/requests.jsonl`;
const outputPrefix = `gs://${gcsClient.bucketName}/outputs/${batchId}/`;

// Build JSONL content - one request per line
const jsonlLines = batchRequests.map((req, idx) => ({
  request: {
    contents: req.contents,
    systemInstruction: req.systemInstruction,
    generationConfig: req.generationConfig,
  },
}));

console.log(`[Batch] Uploading ${jsonlLines.length} requests to GCS...`);
const inputUri = await gcsClient.uploadJsonl(inputPath, jsonlLines);
console.log(`[Batch] Uploaded to: ${inputUri}`);

// ========================================================================
// 6. CREATE VERTEX AI BATCH PREDICTION JOB
// ========================================================================

const vertexJob = await batchClient.createBatchJob({
  displayName: `slides-${instructor_course_id}-${Date.now()}`,
  model: getVertexAIModelPath(MODEL_CONFIG.GEMINI_PRO),
  inputUri: inputUri,
  outputUriPrefix: outputPrefix,
});

// Vertex AI returns full resource name: projects/.../batchPredictionJobs/123
const googleBatchId = vertexJob.name;
console.log(`[Batch] Vertex AI job created: ${googleBatchId}`);

// ... rest of the function (database operations) remains the same
```

---

### Phase 3: Rewrite Poll Batch Status

#### 5.3.1 Key Changes Summary

| Aspect | Current | New |
|--------|---------|-----|
| API Endpoint | Gemini API batches/{id} | Vertex AI batchPredictionJobs/{id} |
| Status field | `state` | `state` (same enum) |
| Results | `inlined_responses` | GCS output files |

#### 5.3.2 Code to REPLACE

Replace the Google API polling (lines 78-145) with Vertex AI polling:

```typescript
// Poll Vertex AI for current status
if (googleApiKey && batchJob.google_batch_id) {
  const auth = createVertexAIAuth();
  const batchClient = createVertexAIBatchClient(auth);
  const gcsClient = createGCSClient(auth);

  try {
    const vertexStatus = await batchClient.getBatchJob(batchJob.google_batch_id);
    console.log(`[Poll] Vertex AI job state: ${vertexStatus.state}`);

    // Map Vertex AI state to our status
    const updatedStatus = VertexAIBatchClient.mapJobStateToStatus(vertexStatus.state);

    // Extract counts from completionStats
    const succeededCount = parseInt(vertexStatus.completionStats?.successfulCount || '0', 10);
    const failedCount = parseInt(vertexStatus.completionStats?.failedCount || '0', 10);

    // Update database
    await supabase
      .from('batch_jobs')
      .update({
        status: updatedStatus,
        succeeded_count: succeededCount,
        failed_count: failedCount,
        output_uri: vertexStatus.outputInfo?.gcsOutputDirectory || null,
        ...(VertexAIBatchClient.isTerminalState(vertexStatus.state) ? {
          completed_at: new Date().toISOString(),
        } : {}),
      })
      .eq('id', batch_job_id);

    // If job succeeded, process the results from GCS
    if (vertexStatus.state === 'JOB_STATE_SUCCEEDED' && vertexStatus.outputInfo?.gcsOutputDirectory) {
      await processVertexAIResults(
        supabase,
        batchJob,
        gcsClient,
        vertexStatus.outputInfo.gcsOutputDirectory
      );
    }

    // Calculate progress
    const total = batchJob.total_requests || 1;
    const done = succeededCount + failedCount;
    const progressPercent = Math.round((done / total) * 100);

    return new Response(
      JSON.stringify({
        success: true,
        batch_job: {
          ...batchJob,
          status: updatedStatus,
          succeeded_count: succeededCount,
          failed_count: failedCount,
        },
        vertex_status: vertexStatus.state,
        is_complete: VertexAIBatchClient.isTerminalState(vertexStatus.state),
        progress_percent: progressPercent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Poll] Vertex AI error:', error);
    // Fall through to return current database status
  }
}
```

#### 5.3.3 New Function: Process Vertex AI Results

Add new function to download and process results from GCS:

```typescript
/**
 * Process results from Vertex AI batch job output in Cloud Storage
 */
async function processVertexAIResults(
  supabase: any,
  batchJob: any,
  gcsClient: GCSClient,
  outputDirectory: string
): Promise<void> {
  console.log(`[Poll] Processing Vertex AI results from: ${outputDirectory}`);

  // List output files in the directory
  const outputFiles = await gcsClient.listFiles(outputDirectory);
  console.log(`[Poll] Found ${outputFiles.length} output files`);

  const requestMapping = batchJob.request_mapping || {};
  let succeededCount = 0;
  let failedCount = 0;

  // Process each output file (there may be multiple for large batches)
  for (const filePath of outputFiles) {
    if (!filePath.endsWith('.jsonl')) continue;

    console.log(`[Poll] Processing file: ${filePath}`);
    const results = await gcsClient.downloadJsonl(filePath);

    for (let i = 0; i < results.length; i++) {
      const result = results[i] as any;

      // Vertex AI output format includes the prediction and potentially an error
      const prediction = result.prediction || result.response;
      const error = result.error;

      // Map response back to teaching unit
      // Note: Vertex AI maintains order, so we can use index
      const requestKey = `slide_${succeededCount + failedCount}`;
      const teachingUnitId = requestMapping[requestKey] || requestMapping[i];

      if (!teachingUnitId) {
        console.warn(`[Poll] No mapping for index ${i}`);
        failedCount++;
        continue;
      }

      if (error) {
        console.error(`[Poll] Error for unit ${teachingUnitId}:`, error);
        failedCount++;

        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: error.message || 'Batch generation failed',
          })
          .eq('teaching_unit_id', teachingUnitId);
        continue;
      }

      // Extract content from Vertex AI response
      const content = prediction?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.warn(`[Poll] No content for unit ${teachingUnitId}`);
        failedCount++;
        continue;
      }

      // Parse and save slides (reuse existing logic)
      try {
        const slides = parseSlideContent(content);
        const formattedSlides = formatSlidesForStorage(slides);

        await supabase
          .from('lecture_slides')
          .update({
            slides: formattedSlides,
            total_slides: formattedSlides.length,
            status: 'ready',
            generation_model: MODEL_CONFIG.GEMINI_PRO,
            estimated_duration_minutes: Math.round(formattedSlides.length * 1.5),
            generation_phases: {
              method: 'vertex_ai_batch',
              research_included: true,
              completed_at: new Date().toISOString(),
            },
          })
          .eq('teaching_unit_id', teachingUnitId);

        succeededCount++;
        console.log(`[Poll] Saved ${formattedSlides.length} slides for ${teachingUnitId}`);
      } catch (parseError) {
        console.error(`[Poll] Parse error for ${teachingUnitId}:`, parseError);
        failedCount++;

        await supabase
          .from('lecture_slides')
          .update({
            status: 'failed',
            error_message: 'Failed to parse AI response',
          })
          .eq('teaching_unit_id', teachingUnitId);
      }
    }
  }

  // Update batch job with final counts
  const finalStatus = failedCount === 0 ? 'completed' :
                      succeededCount === 0 ? 'failed' : 'partial';

  await supabase
    .from('batch_jobs')
    .update({
      status: finalStatus,
      succeeded_count: succeededCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchJob.id);

  console.log(`[Poll] Batch complete: ${succeededCount} succeeded, ${failedCount} failed`);
}

/**
 * Parse slide content from AI response
 */
function parseSlideContent(content: string): any[] {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const parsed = JSON.parse(jsonStr);
  return parsed.slides || parsed;
}

/**
 * Format slides for database storage (matches v3 format)
 */
function formatSlidesForStorage(slides: any[]): any[] {
  return slides.map((slide: any) => ({
    order: slide.order,
    type: slide.type,
    title: slide.title,
    content: {
      main_text: slide.content?.main_text || '',
      main_text_layout: slide.content?.main_text_layout || { type: 'plain', emphasis_words: [] },
      key_points: slide.content?.key_points || [],
      key_points_layout: slide.content?.key_points_layout || [],
      definition: slide.content?.definition,
      example: slide.content?.example,
      misconception: slide.content?.misconception,
      steps: slide.content?.steps,
    },
    visual: {
      type: slide.visual_directive?.type || 'none',
      url: null,
      alt_text: slide.visual_directive?.description || '',
      fallback_description: slide.visual_directive?.description || '',
      elements: slide.visual_directive?.elements || [],
      style: slide.visual_directive?.style || '',
      educational_purpose: slide.visual_directive?.educational_purpose || '',
    },
    speaker_notes: slide.speaker_notes || '',
    speaker_notes_duration_seconds: slide.estimated_seconds || 60,
    pedagogy: slide.pedagogy || {},
  }));
}
```

---

## 6. Code Preservation Guide

### 6.1 Quality-Critical Code (DO NOT MODIFY)

These code sections are **identical to v3** and ensure quality parity. **Copy them exactly**:

| File | Component | Lines | Purpose |
|------|-----------|-------|---------|
| submit-batch-slides | `PROFESSOR_SYSTEM_PROMPT` | 65-193 | Full professor persona |
| submit-batch-slides | `TeachingUnitData` interface | 233-277 | Type definitions |
| submit-batch-slides | `buildLectureBrief()` | 300-360 | Context building |
| submit-batch-slides | `mergeResearchIntoBrief()` | 369-414 | Research injection |
| submit-batch-slides | `buildUserPrompt()` | 423-537 | User prompt with schema |
| submit-batch-slides | `runResearchAgent()` | 569-717 | Google Search grounding |
| poll-batch-status | Slide formatting logic | 389-419 | Output formatting |

### 6.2 Code to Remove

- All Gemini API `batchGenerateContent` references
- `x-goog-api-key` authentication for batch operations
- Inline request submission logic
- Inline response processing logic

### 6.3 New Imports Required

```typescript
// submit-batch-slides/index.ts - add these imports
import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { createGCSClient } from '../_shared/gcs-client.ts';
import { createVertexAIBatchClient, VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
import { getVertexAIModelPath } from '../_shared/ai-orchestrator.ts';

// poll-batch-status/index.ts - add these imports
import { createVertexAIAuth } from '../_shared/vertex-ai-auth.ts';
import { createGCSClient, GCSClient } from '../_shared/gcs-client.ts';
import { createVertexAIBatchClient, VertexAIBatchClient } from '../_shared/vertex-ai-batch.ts';
```

---

## 7. Error Mitigation Strategy

### 7.1 Authentication Errors

| Error | Detection | Mitigation |
|-------|-----------|------------|
| Invalid service account key | JSON parse error on init | Validate key format on startup |
| JWT signing failure | Crypto API error | Log details, return 500 |
| Token exchange failure | 400/401 from oauth endpoint | Retry once, log, return 500 |
| Expired token | 401 from Vertex AI | Auto-refresh (built into auth class) |

### 7.2 Storage Errors

| Error | Detection | Mitigation |
|-------|-----------|------------|
| Upload failure | Non-200 from Storage API | Retry 3x with exponential backoff |
| Download failure | Non-200 from Storage API | Retry 3x, fall back to manual check |
| Bucket not found | 404 from Storage API | Log config error, return 500 |
| Permission denied | 403 from Storage API | Log IAM issue, return 500 |

### 7.3 Vertex AI Errors

| Error | Detection | Mitigation |
|-------|-----------|------------|
| Job creation failure | Non-200 from Vertex AI | Log error, return to user |
| Invalid model | 400 with model error | Check model path format |
| Quota exceeded | 429 from Vertex AI | Return rate limit error to user |
| Job timeout | >24h without completion | Mark as failed, notify user |
| Partial failure | failedCount > 0 | Process successful results, retry failed |

### 7.4 Retry Configuration

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

async function withRetry<T>(
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
      console.warn(`[${operationName}] Attempt ${attempt + 1} failed: ${lastError.message}`);

      if (attempt < RETRY_CONFIG.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
      }
    }
  }

  throw lastError;
}
```

---

## 8. Testing & Validation

### 8.1 Unit Tests

| Test | Purpose |
|------|---------|
| `vertex-ai-auth.test.ts` | Verify JWT creation and token exchange |
| `gcs-client.test.ts` | Verify upload/download operations |
| `vertex-ai-batch.test.ts` | Verify job create/get/cancel |

### 8.2 Integration Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Auth flow | Create auth → Get token | Valid access token returned |
| Storage flow | Upload JSONL → Download → Compare | Content matches |
| Batch flow | Create job → Poll → Get results | Job completes, results retrieved |

### 8.3 End-to-End Test

1. Select 3-5 test teaching units
2. Call `submit-batch-slides`
3. Poll `poll-batch-status` until complete
4. Verify:
   - Job status is 'completed'
   - All slides have status 'ready'
   - Slide content is valid JSON
   - Speaker notes are present and >100 chars

### 8.4 Manual Verification Checklist

- [ ] Service account key is correctly base64 encoded
- [ ] GCS bucket exists and is accessible
- [ ] Vertex AI API is enabled in project
- [ ] Service account has correct IAM roles
- [ ] Edge functions deploy without errors
- [ ] Small batch (3 units) completes successfully
- [ ] Large batch (50+ units) completes successfully
- [ ] Failed units are properly marked and can be retried

---

## 9. Rollback Plan

### 9.1 If Issues Occur

1. **Identify the issue** from logs
2. **Revert edge functions**:
   ```bash
   git revert HEAD
   supabase functions deploy submit-batch-slides
   supabase functions deploy poll-batch-status
   ```
3. **Keep database records** - schema is compatible
4. **Investigate and fix** before re-deploying

### 9.2 Backwards Compatibility

The `batch_jobs` table schema is compatible with both systems:
- `google_batch_id` can store either `batches/xxx` (Gemini) or `projects/.../batchPredictionJobs/xxx` (Vertex AI)
- `status` values are the same
- `request_mapping` format is unchanged

### 9.3 Gradual Rollout Option

If desired, implement a feature flag:

```typescript
const USE_VERTEX_AI = Deno.env.get('USE_VERTEX_AI_BATCH') === 'true';

if (USE_VERTEX_AI) {
  // New Vertex AI path
} else {
  // Old Gemini API path (keep as fallback)
}
```

---

## Appendix A: Environment Variables Summary

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLOUD_API_KEY` | Existing Gemini API key | Keep for v3 |
| `GCP_PROJECT_ID` | Google Cloud project ID | NEW |
| `GCP_REGION` | Vertex AI region | NEW (default: us-central1) |
| `GCS_BUCKET` | Cloud Storage bucket name | NEW |
| `GCP_SERVICE_ACCOUNT_KEY` | Base64 encoded JSON key | NEW |
| `SUPABASE_URL` | Supabase project URL | Existing |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role | Existing |

---

## Appendix B: Key API Reference

### Vertex AI Batch Prediction API

**Create Job**:
```
POST https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/batchPredictionJobs
```

**Get Job**:
```
GET https://{REGION}-aiplatform.googleapis.com/v1/{JOB_NAME}
```

**Cancel Job**:
```
POST https://{REGION}-aiplatform.googleapis.com/v1/{JOB_NAME}:cancel
```

### Cloud Storage JSON API

**Upload Object**:
```
POST https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?uploadType=media&name={OBJECT_PATH}
```

**Download Object**:
```
GET https://storage.googleapis.com/storage/v1/b/{BUCKET}/o/{OBJECT_PATH}?alt=media
```

**List Objects**:
```
GET https://storage.googleapis.com/storage/v1/b/{BUCKET}/o?prefix={PREFIX}
```

---

## Appendix C: References

- [Vertex AI Batch Inference Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-gemini)
- [Vertex AI Batch Prediction API Reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/batch-prediction-api)
- [Batch Inference from Cloud Storage](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-from-cloud-storage)
- [Google OAuth 2.0 for Server to Server](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Deno djwt Library](https://deno.land/x/djwt)
- [Cloud Storage JSON API](https://cloud.google.com/storage/docs/json_api)

---

**Document Version**: 1.0
**Created**: 2026-01-17
**Author**: Claude Code Agent
**Status**: Ready for Implementation
