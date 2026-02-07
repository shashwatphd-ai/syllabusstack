// ============================================================================
// UNIFIED AI CLIENT - Single Entry Point for All AI Operations
// ============================================================================
//
// PURPOSE: Consolidate ALL AI routing with provider toggles for:
//   1. Unified billing and cost tracking
//   2. Automatic fallbacks
//   3. Consistent API format across all providers
//   4. Single-switch provider routing via environment variables
//
// ARCHITECTURE (Updated 2026-02-06 - Provider Toggle Support):
//   - Text generation → OpenRouter (MODELS.PROFESSOR_AI, MODELS.FAST, etc.)
//   - Image generation → Controlled by IMAGE_PROVIDER env var:
//       • 'openrouter' (default): OpenRouter API
//       • 'google': Native Google Generative Language API
//   - Research/grounding → OpenRouter (MODELS.RESEARCH = perplexity/sonar-pro)
//   - Syllabus parsing → OpenRouter (MODELS.PARSING = gemini-2.5-flash)
//
// PROVIDER TOGGLES:
//   | Env Variable     | Options               | Controls          |
//   |------------------|----------------------|-------------------|
//   | IMAGE_PROVIDER   | 'openrouter' (def)   | Image generation  |
//   |                  | 'google'             | → GCP credits     |
//   | BATCH_PROVIDER   | 'openrouter' (def)   | Batch slides      |
//   |                  | 'vertex'             | → 50% discount    |
//
// ROUTING SUMMARY:
//   | Operation     | Provider         | Model                           |
//   |---------------|------------------|----------------------------------|
//   | Slide Content | OpenRouter/Vertex| google/gemini-3-flash-preview    |
//   | Images        | OpenRouter/Google| gemini-3-pro-image-preview       |
//   | Research      | OpenRouter       | perplexity/sonar-pro             |
//   | Parsing       | OpenRouter       | google/gemini-2.5-flash          |
//   | Reasoning     | OpenRouter       | deepseek/deepseek-r1             |
//   | Fast Tasks    | OpenRouter       | google/gemini-2.5-flash-lite     |
//
// USAGE:
//   import { generateText, generateImage, searchGrounded, MODELS } from '../_shared/unified-ai-client.ts';
//
//   // Text generation
//   const text = await generateText({ prompt: 'Hello', systemPrompt: 'Be helpful' });
//
//   // Image generation (returns structured result or error - never null)
//   // Automatically routes to OpenRouter or Google based on IMAGE_PROVIDER
//   const image = await generateImage({ prompt: 'A diagram of...' });
//   if (!image.success) console.error(image.error.message);
//
//   // Search-grounded research (via Perplexity on OpenRouter)
//   const research = await searchGrounded({ query: 'Latest statistics on...' });
//
// ============================================================================

import { simpleCompletion, functionCall, callOpenRouter, MODELS, parseJsonResponse } from './openrouter-client.ts';
import { createVertexAIAuth, getGCPProjectId, getGCPRegion } from './vertex-ai-auth.ts';

// ============================================================================
// TYPES
// ============================================================================

export type TaskType = 
  | 'text_generation'      // → OpenRouter (Gemini/GPT)
  | 'function_call'        // → OpenRouter with tools
  | 'image_generation'     // → OpenRouter (Gemini Image) or Vertex AI (Google Native)
  | 'search_grounding';    // → OpenRouter (Perplexity)

export type Provider = 'openrouter' | 'google_direct' | 'google' | 'vertex';

// Image provider configuration - read from environment
const IMAGE_PROVIDER = Deno.env.get('IMAGE_PROVIDER') || 'openrouter';

// Vertex AI image models (matches documentation: gemini-3-pro-image-preview)
const VERTEX_IMAGE_MODELS = {
  PRIMARY: 'gemini-3-pro-image-preview',   // Nano Banana Pro 3 - best quality
  FALLBACK: 'gemini-3-pro-image-preview',  // Same model, Vertex AI handles availability
} as const;

export interface AIRequest {
  task: TaskType;
  prompt: string;
  systemPrompt?: string;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
    fallbacks?: string[];
  };
  // For function calls
  schema?: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIResult {
  content: string;
  provider: Provider;
  model: string;
  cost_usd?: number;
  latency_ms: number;
  fallback_used?: boolean;
}

// Success result from image generation
export interface ImageResultSuccess {
  success: true;
  base64: string;
  mimeType: string;
  textResponse?: string;
  provider: 'openrouter' | 'google';
  model: string;
  cost_usd: number;
  latency_ms: number;
}

// Error result from image generation (explicit errors, no silent nulls)
export interface ImageResultError {
  success: false;
  error: {
    code: 'IMAGE_GENERATION_FAILED' | 'OPENROUTER_ERROR' | 'GOOGLE_ERROR' | 'INVALID_RESPONSE' | 'CONFIG_ERROR';
    message: string;
    provider: 'openrouter' | 'google';
    model: string;
    httpStatus?: number;
    rawError?: string;
  };
}

// Union type for all image generation outcomes
export type ImageResult = ImageResultSuccess | ImageResultError;

// DEPRECATED: Old interface kept for backwards compatibility during migration
// Will be removed in future version
export interface ImageResultLegacy {
  base64: string;
  mimeType: string;
  textResponse?: string;
  provider: Provider;
  cost_usd?: number;
  latency_ms: number;
  fallback_used?: boolean;
}

export interface SearchResult {
  topic: string;
  grounded_content: {
    claim: string;
    source_url: string;
    source_title: string;
    confidence: number;
  }[];
  recommended_reading: {
    title: string;
    url: string;
    type: 'Academic' | 'Industry' | 'Case Study' | 'Documentation';
  }[];
  visual_descriptions: {
    framework_name: string;
    description: string;
    elements: string[];
  }[];
  provider: Provider;
  latency_ms: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Cost estimates per 1M tokens (for tracking)
// Source: https://openrouter.ai/docs/models
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  // OpenAI models
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4.1': { input: 2.00, output: 8.00 },
  // Google Gemini text models
  'google/gemini-3-flash-preview': { input: 0.10, output: 0.40 },
  'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-flash-lite': { input: 0.02, output: 0.08 },
  'google/gemini-flash-1.5': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  // Google Gemini image models
  'google/gemini-3-pro-image-preview': { input: 0.50, output: 2.00 },
  'google/gemini-2.5-flash-image': { input: 0.0003, output: 0.0025 },
  // Perplexity research models (per request pricing approximation)
  'perplexity/sonar-pro': { input: 3.00, output: 15.00 },
  'perplexity/sonar': { input: 1.00, output: 5.00 },
  // DeepSeek reasoning
  'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
  // Anthropic models
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
  'anthropic/claude-3.5-haiku': { input: 0.80, output: 4.00 },
};

// Fixed cost per image for Gemini 2.5 Flash Image
const IMAGE_COST_USD = 0.039;

// ============================================================================
// TEXT GENERATION - OpenRouter Primary
// ============================================================================

/**
 * Generate text using OpenRouter with automatic fallbacks
 */
export async function generateText(request: {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  fallbacks?: string[];
  logPrefix?: string;
}): Promise<AIResult> {
  const startTime = Date.now();
  const logPrefix = request.logPrefix || '[UnifiedAI-Text]';
  
  const model = request.model || MODELS.FAST;
  const fallbacks = request.fallbacks || [MODELS.GEMINI_FLASH];

  console.log(`${logPrefix} Generating text via OpenRouter (${model})`);

  try {
    const content = await simpleCompletion(
      model,
      request.systemPrompt || 'You are a helpful assistant.',
      request.prompt,
      {
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        json: request.json,
        fallbacks,
      },
      logPrefix
    );

    const latency_ms = Date.now() - startTime;
    
    return {
      content,
      provider: 'openrouter',
      model,
      latency_ms,
      cost_usd: estimateCost(model, request.prompt.length, content.length),
    };
  } catch (error) {
    console.error(`${logPrefix} OpenRouter failed:`, error);
    throw error;
  }
}

/**
 * Make a function call using OpenRouter
 */
export async function generateStructured<T>(request: {
  prompt: string;
  systemPrompt?: string;
  schema: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
  model?: string;
  temperature?: number;
  fallbacks?: string[];
  logPrefix?: string;
}): Promise<{ data: T; provider: Provider; model: string; latency_ms: number }> {
  const startTime = Date.now();
  const logPrefix = request.logPrefix || '[UnifiedAI-Function]';
  
  const model = request.model || MODELS.FAST;
  const fallbacks = request.fallbacks || [MODELS.GEMINI_FLASH];

  console.log(`${logPrefix} Function call via OpenRouter (${model})`);

  try {
    const data = await functionCall<T>(
      model,
      request.systemPrompt || 'Extract the requested information.',
      request.prompt,
      request.schema,
      { temperature: request.temperature, fallbacks },
      logPrefix
    );

    return {
      data,
      provider: 'openrouter',
      model,
      latency_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`${logPrefix} Function call failed:`, error);
    throw error;
  }
}

// ============================================================================
// IMAGE GENERATION - Provider Toggle (OpenRouter or Google Native)
// ============================================================================
//
// ARCHITECTURE (Updated 2026-02-06 - Provider Toggle):
//   - Controlled by IMAGE_PROVIDER environment variable
//   - 'openrouter' (default): Uses OpenRouter API with Gemini models
//   - 'google': Uses native Google Generative Language API (GCP billing)
//
// BENEFITS OF PROVIDER TOGGLE:
//   - Single switch to change billing destination
//   - Same UI flow regardless of provider
//   - Use GCP credits when OpenRouter is unavailable
//   - Matches BATCH_PROVIDER toggle architecture
//
// ============================================================================

/**
 * Generate an image using the configured provider (OpenRouter or Google Native)
 *
 * Provider is controlled by IMAGE_PROVIDER environment variable:
 * - 'openrouter' (default): Uses OpenRouter API
 * - 'google': Uses native Google Generative Language API
 *
 * @param request.prompt - The image generation prompt
 * @param request.aspectRatio - Optional aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
 * @param request.useFreeModel - Use free tier model for testing (rate limited)
 * @param request.logPrefix - Log prefix for debugging
 *
 * @returns ImageResult - Either success with base64 image or error with details
 *                        NEVER returns null - always explicit success/error
 */
export async function generateImage(request: {
  prompt: string;
  slideTitle?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  useFreeModel?: boolean;
  logPrefix?: string;
}): Promise<ImageResult> {
  const logPrefix = request.logPrefix || '[Image]';
  
  // Route based on IMAGE_PROVIDER environment variable
  console.log(`${logPrefix} Using provider: ${IMAGE_PROVIDER}`);
  
  if (IMAGE_PROVIDER === 'google') {
    return generateImageGoogle(request);
  }
  
  return generateImageOpenRouter(request);
}

/**
 * Generate an image using OpenRouter's Gemini Image models
 * @internal
 */
async function generateImageOpenRouter(request: {
  prompt: string;
  slideTitle?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  useFreeModel?: boolean;
  logPrefix?: string;
}): Promise<ImageResult> {
  const startTime = Date.now();
  const logPrefix = request.logPrefix || '[Image-OpenRouter]';

  // Validate configuration
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  const appUrl = Deno.env.get('APP_URL') || 'https://syllabusstack.com';

  if (!apiKey) {
    console.error(`${logPrefix} OPENROUTER_API_KEY not configured`);
    return {
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'OPENROUTER_API_KEY environment variable is not configured',
        provider: 'openrouter',
        model: 'none',
      },
    };
  }

  // Model selection with fallback chain
  // Primary: Gemini 3 Pro Image Preview (highest quality)
  // Fallback: Gemini 2.5 Flash Image (more reliable, GA version)
  const primaryModel = request.useFreeModel
    ? MODELS.IMAGE_FREE
    : MODELS.IMAGE;
  const fallbackModel = MODELS.IMAGE_FALLBACK;

  // Try primary model first, then fallback if empty content
  for (const model of [primaryModel, fallbackModel]) {
    const isRetry = model === fallbackModel;
    
    if (isRetry) {
      console.log(`${logPrefix} Retrying with fallback model: ${model}`);
    } else {
      console.log(`${logPrefix} Generating image via OpenRouter (${model})`);
    }
    console.log(`${logPrefix} Prompt: ${request.prompt.substring(0, 100)}...`);

    try {
      // Build request body with modalities for image output
      // CRITICAL: modalities: ['image', 'text'] is REQUIRED for OpenRouter image generation
      const body: Record<string, unknown> = {
        model,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        modalities: ['image', 'text'],  // Required for image generation output
      };

      // Add aspect ratio configuration if specified
      if (request.aspectRatio) {
        body.image_config = {
          aspect_ratio: request.aspectRatio,
        };
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': appUrl,
          'X-Title': 'SyllabusStack',
        },
        body: JSON.stringify(body),
      });

      // Handle HTTP errors explicitly
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${logPrefix} OpenRouter error ${response.status}:`, errorText.substring(0, 300));

        // If it's a 5xx error, try fallback
        if (response.status >= 500 && model === primaryModel) {
          console.warn(`${logPrefix} Server error, trying fallback model...`);
          continue;
        }

        return {
          success: false,
          error: {
            code: 'OPENROUTER_ERROR',
            message: `OpenRouter returned HTTP ${response.status}: ${response.statusText}`,
            provider: 'openrouter',
            model,
            httpStatus: response.status,
            rawError: errorText.substring(0, 500),
          },
        };
      }

      const data = await response.json();

      // CRITICAL FIX (2026-02-04): OpenRouter's Gemini 3 Pro Image returns content: null
      // but places the generated image in message.images array.
      // We MUST check message.images FIRST, before bailing on empty content.
      const message = data.choices?.[0]?.message;
      const content = message?.content;

      // Parse the response to extract base64 image - pass full message for images array access
      const extracted = extractImageFromResponse(content, message, logPrefix);

      if (!extracted) {
        // Log detailed response structure for debugging
        const hasImages = Array.isArray(message?.images) && message.images.length > 0;
        console.error(`${logPrefix} Could not extract image from response`);
        console.error(`${logPrefix} Response structure: content=${content === null ? 'null' : typeof content}, isArray=${Array.isArray(content)}, message.images=${hasImages ? message.images.length : 'none'}`);
        
        // If primary model fails extraction, try fallback
        if (model === primaryModel) {
          console.warn(`${logPrefix} Failed extraction from ${model}, trying fallback...`);
          continue;
        }
        
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Could not extract image data from OpenRouter response. Response format may have changed.',
            provider: 'openrouter',
            model,
            rawError: JSON.stringify({ content: typeof content, images: hasImages }).substring(0, 500),
          },
        };
      }

      const latency_ms = Date.now() - startTime;
      console.log(`${logPrefix} ✓ Image generated successfully in ${latency_ms}ms (${Math.round(extracted.base64.length / 1024)}KB)${isRetry ? ' [fallback]' : ''}`);

      return {
        success: true,
        base64: extracted.base64,
        mimeType: extracted.mimeType,
        textResponse: extracted.textResponse,
        provider: 'openrouter',
        model,
        cost_usd: IMAGE_COST_USD,
        latency_ms,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${logPrefix} Exception during image generation with ${model}:`, errorMessage);

      // If primary model throws, try fallback
      if (model === primaryModel) {
        console.warn(`${logPrefix} Exception with ${model}, trying fallback...`);
        continue;
      }

      return {
        success: false,
        error: {
          code: 'IMAGE_GENERATION_FAILED',
          message: `Image generation failed with exception: ${errorMessage}`,
          provider: 'openrouter',
          model,
          rawError: errorMessage,
        },
      };
    }
  }

  // If we get here, all models failed
  return {
    success: false,
    error: {
      code: 'IMAGE_GENERATION_FAILED',
      message: 'All image generation models failed',
      provider: 'openrouter',
      model: primaryModel,
    },
  };
}

/**
 * Generate an image using Vertex AI (Google Cloud)
 * 
 * Uses OAuth authentication via GCP_SERVICE_ACCOUNT_KEY for Vertex AI access.
 * Endpoint: https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent
 * 
 * Model: gemini-3-pro-image-preview (Nano Banana Pro 3)
 * 
 * @internal
 */
async function generateImageGoogle(request: {
  prompt: string;
  slideTitle?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  useFreeModel?: boolean;
  logPrefix?: string;
}): Promise<ImageResult> {
  const startTime = Date.now();
  const logPrefix = request.logPrefix || '[Image-VertexAI]';

  // Validate configuration - uses GCP service account for OAuth
  const serviceAccountKey = Deno.env.get('GCP_SERVICE_ACCOUNT_KEY');

  if (!serviceAccountKey) {
    console.error(`${logPrefix} GCP_SERVICE_ACCOUNT_KEY not configured`);
    return {
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'GCP_SERVICE_ACCOUNT_KEY environment variable is not configured. Set IMAGE_PROVIDER=openrouter to use OpenRouter instead.',
        provider: 'google',
        model: 'none',
      },
    };
  }

  // Model selection - using Gemini 3 Pro Image Preview (Nano Banana Pro 3)
  const model = VERTEX_IMAGE_MODELS.PRIMARY;
  
  console.log(`${logPrefix} Generating image via Vertex AI (${model})`);
  console.log(`${logPrefix} Prompt: ${request.prompt.substring(0, 100)}...`);

  try {
    // Initialize Vertex AI auth and get access token
    const auth = createVertexAIAuth();
    const accessToken = await auth.getAccessToken();
    const projectId = getGCPProjectId(auth);
    const region = getGCPRegion();

    console.log(`${logPrefix} Using project: ${projectId}, region: ${region}`);

    // Build request body for Vertex AI generateContent
    // Reference: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: request.prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        // Optional: Add aspect ratio if supported
        ...(request.aspectRatio && {
          aspectRatio: request.aspectRatio.replace(':', '_'), // Convert 16:9 to 16_9
        }),
      },
    };

    // Vertex AI endpoint format
    // CRITICAL: 'global' location uses https://aiplatform.googleapis.com (no region prefix)
    //           Regional locations use https://{region}-aiplatform.googleapis.com
    // Reference: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
    const baseUrl = region === 'global'
      ? 'https://aiplatform.googleapis.com'
      : `https://${region}-aiplatform.googleapis.com`;
    const endpoint = `${baseUrl}/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
    
    console.log(`${logPrefix} Endpoint: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Handle HTTP errors explicitly
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} Vertex AI error ${response.status}:`, errorText.substring(0, 500));

      return {
        success: false,
        error: {
          code: 'GOOGLE_ERROR',
          message: `Vertex AI returned HTTP ${response.status}: ${response.statusText}`,
          provider: 'google',
          model,
          httpStatus: response.status,
          rawError: errorText.substring(0, 500),
        },
      };
    }

    const data = await response.json();

    // Parse Vertex AI response format (same as Generative Language API)
    // Response structure: { candidates: [{ content: { parts: [{ inlineData: { data, mimeType } }] } }] }
    const extracted = extractImageFromGoogleResponse(data, logPrefix);

    if (!extracted) {
      console.error(`${logPrefix} Could not extract image from Vertex AI response`);
      console.error(`${logPrefix} Response keys:`, Object.keys(data));
      
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'Could not extract image data from Vertex AI response. Response format may have changed.',
          provider: 'google',
          model,
          rawError: JSON.stringify(data).substring(0, 500),
        },
      };
    }

    const latency_ms = Date.now() - startTime;
    console.log(`${logPrefix} ✓ Image generated successfully in ${latency_ms}ms (${Math.round(extracted.base64.length / 1024)}KB)`);

    return {
      success: true,
      base64: extracted.base64,
      mimeType: extracted.mimeType,
      textResponse: extracted.textResponse,
      provider: 'google',
      model,
      cost_usd: IMAGE_COST_USD, // Same cost estimate for now
      latency_ms,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Exception during image generation:`, errorMessage);

    return {
      success: false,
      error: {
        code: 'IMAGE_GENERATION_FAILED',
        message: `Image generation failed with exception: ${errorMessage}`,
        provider: 'google',
        model: VERTEX_IMAGE_MODELS.PRIMARY,
        rawError: errorMessage,
      },
    };
  }
}

/**
 * Extract base64 image from Google Generative Language API response
 * 
 * Google's response format:
 * {
 *   candidates: [{
 *     content: {
 *       parts: [
 *         { text: "..." },
 *         { inlineData: { data: "base64...", mimeType: "image/png" } }
 *       ]
 *     }
 *   }]
 * }
 * 
 * @internal
 */
function extractImageFromGoogleResponse(
  data: Record<string, unknown>,
  logPrefix: string
): { base64: string; mimeType: string; textResponse?: string } | null {
  try {
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates || candidates.length === 0) {
      console.warn(`${logPrefix} No candidates in response`);
      return null;
    }

    const content = candidates[0].content as Record<string, unknown> | undefined;
    if (!content) {
      console.warn(`${logPrefix} No content in first candidate`);
      return null;
    }

    const parts = content.parts as Array<Record<string, unknown>> | undefined;
    if (!parts || parts.length === 0) {
      console.warn(`${logPrefix} No parts in content`);
      return null;
    }

    let base64: string | null = null;
    let mimeType = 'image/png';
    let textResponse: string | undefined;

    // Look through parts for image data and text
    for (const part of parts) {
      // Check for inline image data
      const inlineData = part.inlineData as Record<string, unknown> | undefined;
      if (inlineData?.data && inlineData?.mimeType) {
        base64 = inlineData.data as string;
        mimeType = inlineData.mimeType as string;
        console.log(`${logPrefix} Found inlineData image: ${mimeType}`);
      }

      // Check for text content
      if (typeof part.text === 'string' && part.text.trim()) {
        textResponse = part.text;
      }
    }

    if (!base64) {
      console.warn(`${logPrefix} No inlineData found in any part`);
      console.warn(`${logPrefix} Parts structure:`, parts.map(p => Object.keys(p)));
      return null;
    }

    return { base64, mimeType, textResponse };

  } catch (error) {
    console.error(`${logPrefix} Error parsing Google response:`, error);
    return null;
  }
}

/**
 * Extract base64 image from OpenRouter response
 * Handles multiple response formats from Gemini image models
 *
 * @internal
 */
function extractImageFromResponse(
  content: unknown,
  message: Record<string, unknown> | undefined,
  logPrefix: string
): { base64: string; mimeType: string; textResponse?: string } | null {

  // FORMAT 1 (PRIORITY): images array on message object
  // This is OpenRouter's DOCUMENTED format for image generation models
  // https://openrouter.ai/docs - message.images[].image_url.url contains the base64 data URL
  // CRITICAL: Gemini 3 Pro Image returns content: null but images in message.images
  const images = message?.images as Array<Record<string, unknown>> | undefined;
  if (images?.length && images.length > 0) {
    const imageObj = images[0];
    const imageUrl = (imageObj?.image_url as Record<string, unknown>)?.url || imageObj?.url;

    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
      const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        console.log(`${logPrefix} Extracted image from message.images (OpenRouter format)`);
        return { base64: match[2], mimeType: `image/${match[1]}` };
      }
    }
  }

  // FORMAT 2: content is an array with type: 'image' or 'image_url' items
  // Some models (Gemini 2.5 Flash) may use this format
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'image' || item.type === 'image_url') {
        const imageUrl = item.image_url?.url || item.url;
        if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
          const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
          if (match) {
            console.log(`${logPrefix} Extracted image from content array`);
            return { base64: match[2], mimeType: `image/${match[1]}` };
          }
        }
      }
    }
  }

  // FORMAT 3: content is a string containing inline base64 data URL
  if (typeof content === 'string' && content.includes('data:image/')) {
    const dataMatch = content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
    if (dataMatch) {
      console.log(`${logPrefix} Extracted inline base64 from content string`);
      return { base64: dataMatch[2], mimeType: `image/${dataMatch[1]}` };
    }
  }

  // No image found in any expected format
  const imagesCount = images?.length || 0;
  console.warn(`${logPrefix} No image found. Content type: ${content === null ? 'null' : typeof content}, isArray: ${Array.isArray(content)}, message.images: ${imagesCount}`);
  return null;
}

// ============================================================================
// SEARCH GROUNDING - Perplexity via OpenRouter (Full Consolidation)
// ============================================================================
//
// MIGRATION (2026-01-25):
//   - Previously: Google Direct with googleSearch tool
//   - Now: Perplexity via OpenRouter (perplexity/sonar-pro)
//
// WHY PERPLEXITY:
//   - Native web search with citations
//   - Available via OpenRouter (unified billing)
//   - Better citation quality than Google Search Grounding
//   - Supports structured output for research data
// ============================================================================

/**
 * Research with web search grounding via Perplexity (OpenRouter)
 * 
 * Replaces Google Direct search grounding with Perplexity's sonar-pro model
 * which provides real-time web search with citations.
 */
export async function searchGrounded(request: {
  query: string;
  systemPrompt?: string;
  model?: string;
  logPrefix?: string;
}): Promise<SearchResult> {
  const startTime = Date.now();
  const logPrefix = request.logPrefix || '[UnifiedAI-Research]';
  
  // Use Perplexity for research (has native web search)
  const model = request.model || MODELS.RESEARCH;
  const fallbacks = [MODELS.RESEARCH_FALLBACK];
  
  console.log(`${logPrefix} Research query via OpenRouter Perplexity (${model})`);

  const systemPrompt = request.systemPrompt || `You are a research assistant that provides verified information with citations.
Your responses are grounded in real-time web search results.

Return a JSON object with this EXACT structure:
{
  "topic": "The main topic being researched",
  "grounded_content": [
    {
      "claim": "Verified factual statement with specific data",
      "source_url": "URL from search results",
      "source_title": "Source name/publication",
      "confidence": 0.95
    }
  ],
  "recommended_reading": [
    {
      "title": "Resource title",
      "url": "URL",
      "type": "Academic"
    }
  ],
  "visual_descriptions": [
    {
      "framework_name": "e.g., Porter's Five Forces",
      "description": "Text description of the visual structure",
      "elements": ["Element 1", "Element 2", "Element 3"]
    }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

  try {
    const response = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.query },
      ],
      temperature: 0.3,
      fallbacks,
    }, logPrefix);

    const content = response.choices[0]?.message?.content || '';
    
    // Parse the response
    let parsed: Partial<SearchResult>;
    try {
      parsed = parseJsonResponse<Partial<SearchResult>>(content);
    } catch (parseError) {
      console.warn(`${logPrefix} Failed to parse research response as JSON, extracting manually`);
      parsed = {
        topic: request.query,
        grounded_content: [],
        recommended_reading: [],
        visual_descriptions: [],
      };
    }

    const latency_ms = Date.now() - startTime;
    console.log(`${logPrefix} ✓ Research complete: ${parsed.grounded_content?.length || 0} claims, ${latency_ms}ms`);

    return {
      topic: parsed.topic || request.query,
      grounded_content: parsed.grounded_content || [],
      recommended_reading: parsed.recommended_reading || [],
      visual_descriptions: parsed.visual_descriptions || [],
      provider: 'openrouter',
      latency_ms,
    };

  } catch (error) {
    console.error(`${logPrefix} Research error:`, error);
    
    // Return empty result on failure rather than throwing
    return {
      topic: request.query,
      grounded_content: [],
      recommended_reading: [],
      visual_descriptions: [],
      provider: 'openrouter',
      latency_ms: Date.now() - startTime,
    };
  }
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Track AI usage in the database
 */
export async function trackAIUsage(
  supabase: any,
  userId: string,
  functionName: string,
  provider: Provider,
  model: string,
  inputTokens?: number,
  outputTokens?: number,
  costUsd?: number
): Promise<void> {
  try {
    await supabase.from('ai_usage').insert({
      user_id: userId,
      function_name: functionName,
      model_used: `${provider}/${model}`,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd ?? estimateCost(model, inputTokens || 0, outputTokens || 0),
    });
  } catch (error) {
    console.warn('[TrackAIUsage] Failed to track usage:', error);
    // Don't throw - tracking failure shouldn't break the main flow
  }
}

/**
 * Estimate cost based on model and token counts
 */
function estimateCost(model: string, inputChars: number, outputChars: number): number {
  // Rough conversion: 4 chars ≈ 1 token
  const inputTokens = Math.ceil(inputChars / 4);
  const outputTokens = Math.ceil(outputChars / 4);
  
  const costs = COST_PER_MILLION[model] || { input: 0.10, output: 0.30 };
  
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

// ============================================================================
// BATCH PROCESSING HELPER
// ============================================================================

/**
 * Process multiple items with rate limiting and progress tracking
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number, results: R[]) => void;
    onError?: (error: Error, item: T, index: number) => void;
  } = {}
): Promise<R[]> {
  const { concurrency = 3, delayMs = 500, onProgress, onError } = options;
  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(async (item, batchIndex) => {
        const index = i + batchIndex;
        try {
          return await processor(item, index);
        } catch (error) {
          if (onError) {
            onError(error as Error, item, index);
          }
          throw error;
        }
      })
    );

    results.push(...batchResults);
    completed += batch.length;

    if (onProgress) {
      onProgress(completed, items.length, results);
    }

    // Delay between batches to avoid rate limiting
    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

export { MODELS, parseJsonResponse } from './openrouter-client.ts';
