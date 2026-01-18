// ============================================================================
// VERTEX AI AUTHENTICATION - Service Account OAuth for Vertex AI API
// ============================================================================
//
// PURPOSE: Handle Google Cloud service account authentication for Vertex AI
//
// WHY THIS APPROACH:
//   - Vertex AI requires OAuth 2.0 access tokens (not API keys)
//   - Service accounts provide secure server-to-server authentication
//   - JWT signing with RS256 is the standard for GCP authentication
//
// FLOW:
//   1. Parse service account JSON key (base64 encoded in env var)
//   2. Create JWT with required claims (iss, scope, aud, exp, iat)
//   3. Sign JWT with RS256 using service account private key
//   4. Exchange JWT for access token at Google OAuth endpoint
//   5. Cache token (valid for 1 hour) to reduce API calls
//
// ENVIRONMENT VARIABLES:
//   - GCP_SERVICE_ACCOUNT_KEY: Base64 encoded service account JSON key
//
// ============================================================================

/**
 * Service account key structure from Google Cloud
 */
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

/**
 * Cached access token with expiration
 */
interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Token response from Google OAuth endpoint
 */
interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Handles Google Cloud service account authentication for Vertex AI
 * Uses RS256 JWT signing with the service account private key
 */
export class VertexAIAuth {
  private serviceAccount: ServiceAccountKey;
  private cachedToken: CachedToken | null = null;
  private cryptoKey: CryptoKey | null = null;

  /**
   * Create a new VertexAIAuth instance
   * @param serviceAccountKeyBase64 Base64 encoded service account JSON key
   */
  constructor(serviceAccountKeyBase64: string) {
    try {
      const keyJson = atob(serviceAccountKeyBase64);
      this.serviceAccount = JSON.parse(keyJson);

      if (!this.serviceAccount.private_key || !this.serviceAccount.client_email) {
        throw new Error('Invalid service account key: missing required fields');
      }
    } catch (error) {
      throw new Error(`Failed to parse service account key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a valid access token, refreshing if needed
   * Tokens are cached for efficiency (1 hour validity)
   */
  async getAccessToken(): Promise<string> {
    // Check if cached token is still valid (with 60s buffer)
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.token;
    }

    console.log('[VertexAI Auth] Generating new access token...');

    // Generate new token
    const jwt = await this.createSignedJWT();
    const tokenResponse = await this.exchangeJWTForToken(jwt);

    this.cachedToken = {
      token: tokenResponse.access_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
    };

    console.log('[VertexAI Auth] Access token obtained successfully');
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
   * JWT format: header.payload.signature (all base64url encoded)
   */
  private async createSignedJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    // JWT Header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    // JWT Payload (Claims)
    const payload = {
      iss: this.serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, // 1 hour from now
      iat: now,
    };

    // Encode header and payload
    const encodedHeader = this.base64urlEncode(JSON.stringify(header));
    const encodedPayload = this.base64urlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with private key
    const key = await this.getPrivateKey();
    const signature = await this.sign(signatureInput, key);
    const encodedSignature = this.base64urlEncode(signature);

    return `${signatureInput}.${encodedSignature}`;
  }

  /**
   * Import the private key from PEM format for RS256 signing
   */
  private async getPrivateKey(): Promise<CryptoKey> {
    if (this.cryptoKey) {
      return this.cryptoKey;
    }

    // Extract the base64 key from PEM format
    const pemContents = this.serviceAccount.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '');

    // Decode base64 to binary
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    // Import as PKCS#8 private key for RS256
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
   * Sign data with the private key using RS256
   */
  private async sign(data: string, key: CryptoKey): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    return await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, dataBuffer);
  }

  /**
   * Base64url encode (URL-safe base64 without padding)
   */
  private base64urlEncode(data: string | ArrayBuffer): string {
    let base64: string;

    if (typeof data === 'string') {
      base64 = btoa(data);
    } else {
      // ArrayBuffer to base64
      const bytes = new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64 = btoa(binary);
    }

    // Convert to base64url (URL-safe)
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Exchange JWT for access token at Google OAuth endpoint
   */
  private async exchangeJWTForToken(jwt: string): Promise<TokenResponse> {
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
      console.error('[VertexAI Auth] Token exchange failed:', response.status, errorText);
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Invalidate the cached token (useful for testing or forced refresh)
   */
  invalidateCache(): void {
    this.cachedToken = null;
  }
}

/**
 * Factory function to create VertexAIAuth from environment variable
 * @throws Error if GCP_SERVICE_ACCOUNT_KEY is not set
 */
export function createVertexAIAuth(): VertexAIAuth {
  const serviceAccountKey = Deno.env.get('GCP_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY environment variable not set. Please add your base64-encoded service account JSON key to Supabase secrets.');
  }
  return new VertexAIAuth(serviceAccountKey);
}

/**
 * Get the GCP project ID from environment or service account
 */
export function getGCPProjectId(auth?: VertexAIAuth): string {
  // First check environment variable
  const envProjectId = Deno.env.get('GCP_PROJECT_ID');
  if (envProjectId) {
    return envProjectId;
  }

  // Fall back to service account project ID
  if (auth) {
    return auth.projectId;
  }

  throw new Error('GCP_PROJECT_ID environment variable not set and no auth instance provided');
}

/**
 * Get the GCP region for Vertex AI
 */
export function getGCPRegion(): string {
  return Deno.env.get('GCP_REGION') || 'us-central1';
}
