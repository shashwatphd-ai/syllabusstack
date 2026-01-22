// ============================================================================
// UNIFIED AI CLIENT - Single Entry Point for All AI Operations
// ============================================================================
//
// PURPOSE: Consolidate all AI routing into a single, intelligent gateway that:
//   1. Routes text generation through OpenRouter (MODELS.PROFESSOR_AI)
//   2. Routes image generation through OpenRouter (MODELS.IMAGE = gemini-2.5-flash-image)
//   3. Routes search grounding through Google Direct (only option - not on OpenRouter)
//   4. Provides explicit error handling (no silent failures)
//
// ARCHITECTURE DECISIONS (Updated 2026-01-22):
//   - OpenRouter for TEXT: Best cost optimization, fallbacks, and model variety
//   - OpenRouter for IMAGES: Using google/gemini-2.5-flash-image ("Nano Banana")
//     * Cost: ~$0.039 per image
//     * NO FALLBACK: Returns explicit error on failure (no silent null returns)
//   - Google Direct for SEARCH: Search grounding not available on OpenRouter
//
// ROUTING SUMMARY:
//   | Operation     | Provider   | Model                           |
//   |---------------|------------|----------------------------------|
//   | Text (slides) | OpenRouter | google/gemini-2.5-flash          |
//   | Images        | OpenRouter | google/gemini-2.5-flash-image    |
//   | Research      | Google     | gemini-2.5-flash + googleSearch  |
//
// USAGE:
//   import { generateText, generateImage, searchGrounded } from '../_shared/unified-ai-client.ts';
//
//   // Text generation
//   const text = await generateText({ prompt: 'Hello', systemPrompt: 'Be helpful' });
//
//   // Image generation (returns structured result or error - never null)
//   const image = await generateImage({ prompt: 'A diagram of...' });
//   if (!image.success) console.error(image.error.message);
//
//   // Search-grounded research
//   const research = await searchGrounded({ query: 'Latest statistics on...' });
//
// ============================================================================

import { simpleCompletion, functionCall, MODELS, parseJsonResponse } from './openrouter-client.ts';

// ============================================================================
// TYPES
// ============================================================================

export type TaskType = 
  | 'text_generation'      // → OpenRouter
  | 'function_call'        // → OpenRouter with tools
  | 'image_generation'     // → Google Direct (primary), OpenRouter (fallback)
  | 'search_grounding';    // → Google Direct only

export type Provider = 'openrouter' | 'google_direct';

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
  provider: 'openrouter';
  model: string;
  cost_usd: number;
  latency_ms: number;
}

// Error result from image generation (explicit errors, no silent nulls)
export interface ImageResultError {
  success: false;
  error: {
    code: 'IMAGE_GENERATION_FAILED' | 'OPENROUTER_ERROR' | 'INVALID_RESPONSE' | 'CONFIG_ERROR';
    message: string;
    provider: 'openrouter';
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

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Cost estimates per 1M tokens (for tracking)
// Source: https://openrouter.ai/docs/models
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  // OpenAI models
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4.1': { input: 2.00, output: 8.00 },
  // Google Gemini text models
  'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'google/gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  // Google Gemini image model (Nano Banana)
  // Cost: ~$0.039 per image (1290 output tokens at $0.0025/1K + input)
  'google/gemini-2.5-flash-image': { input: 0.0003, output: 0.0025 },
  // Legacy models (kept for backwards compatibility)
  'google/gemini-3-flash-preview': { input: 0.10, output: 0.40 },
  'google/gemini-3-pro-preview': { input: 1.25, output: 5.00 },
  'gemini-3-pro-image-preview': { input: 0.50, output: 2.00 },
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
// IMAGE GENERATION - OpenRouter Only (Gemini 2.5 Flash Image)
// ============================================================================
//
// ARCHITECTURE (Updated 2026-01-22):
//   - Provider: OpenRouter only (no Google Direct)
//   - Model: google/gemini-2.5-flash-image ("Nano Banana")
//   - Cost: ~$0.039 per image
//   - Fallback: NONE - returns explicit error on failure
//
// WHY NO FALLBACK:
//   - User preference: explicit errors over silent degradation
//   - Debugging: easier to identify issues when errors are explicit
//   - Cost control: prevents unexpected model switches
//
// ============================================================================

/**
 * Generate an image using OpenRouter's Gemini 2.5 Flash Image model
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
  const startTime = Date.now();
  const logPrefix = request.logPrefix || '[Image]';

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

  // Select model: free tier for testing, paid for production
  const model = request.useFreeModel
    ? MODELS.IMAGE_FREE    // 'google/gemini-2.5-flash-image-preview:free'
    : MODELS.IMAGE;        // 'google/gemini-2.5-flash-image'

  console.log(`${logPrefix} Generating image via OpenRouter (${model})`);
  console.log(`${logPrefix} Prompt: ${request.prompt.substring(0, 100)}...`);

  try {
    // Build request body
    const body: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
    };

    // Add aspect ratio configuration if specified
    // OpenRouter supports image_config for Gemini image models
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

    // Extract image from response
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`${logPrefix} OpenRouter returned empty content`);
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'OpenRouter returned empty content in response',
          provider: 'openrouter',
          model,
        },
      };
    }

    // Parse the response to extract base64 image
    const extracted = extractImageFromResponse(content, data.choices?.[0]?.message, logPrefix);

    if (!extracted) {
      console.error(`${logPrefix} Could not extract image from response`);
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'Could not extract image data from OpenRouter response. Response format may have changed.',
          provider: 'openrouter',
          model,
          rawError: JSON.stringify(content).substring(0, 500),
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
      provider: 'openrouter',
      model,
      cost_usd: IMAGE_COST_USD,
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
        provider: 'openrouter',
        model,
        rawError: errorMessage,
      },
    };
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

  // Format 1: content is an array with type: 'image' or 'image_url' items
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

  // Format 2: images array on message object (legacy format)
  const images = message?.images as Array<Record<string, unknown>> | undefined;
  if (images?.length && images.length > 0) {
    const imageObj = images[0];
    const imageUrl = (imageObj?.image_url as Record<string, unknown>)?.url || imageObj?.url;

    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
      const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        console.log(`${logPrefix} Extracted image from images array`);
        return { base64: match[2], mimeType: `image/${match[1]}` };
      }
    }
  }

  // Format 3: content is a string containing inline base64 data URL
  if (typeof content === 'string' && content.includes('data:image/')) {
    const dataMatch = content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
    if (dataMatch) {
      console.log(`${logPrefix} Extracted inline base64 from content string`);
      return { base64: dataMatch[2], mimeType: `image/${dataMatch[1]}` };
    }
  }

  // No image found in any expected format
  console.warn(`${logPrefix} No image found. Content type: ${typeof content}, isArray: ${Array.isArray(content)}`);
  return null;
}

// ============================================================================
// SEARCH GROUNDING - Google Direct Only
// ============================================================================

/**
 * Research with Google Search grounding (Google Direct only - not on OpenRouter)
 */
export async function searchGrounded(request: {
  query: string;
  systemPrompt?: string;
  model?: string;
  logPrefix?: string;
}): Promise<SearchResult> {
  const startTime = Date.now();
  const logPrefix = request.logPrefix || '[UnifiedAI-Search]';
  
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY not configured for search grounding');
  }

  const model = request.model || 'gemini-2.5-flash';
  console.log(`${logPrefix} Search grounded query via Google Direct (${model})`);

  const url = `${GOOGLE_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt = request.systemPrompt || `You are a research assistant that provides verified information with citations.
Return a JSON object with:
- topic: The main topic being researched
- grounded_content: Array of { claim, source_url, source_title, confidence }
- recommended_reading: Array of { title, url, type }
- visual_descriptions: Array of { framework_name, description, elements }`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: request.query }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`${logPrefix} Search grounding failed:`, response.status, errText);
      throw new Error(`Search grounding failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the response
    const parsed = parseJsonResponse<Partial<SearchResult>>(content);

    return {
      topic: parsed.topic || request.query,
      grounded_content: parsed.grounded_content || [],
      recommended_reading: parsed.recommended_reading || [],
      visual_descriptions: parsed.visual_descriptions || [],
      provider: 'google_direct',
      latency_ms: Date.now() - startTime,
    };

  } catch (error) {
    console.error(`${logPrefix} Search grounding error:`, error);
    
    // Return empty result on failure rather than throwing
    return {
      topic: request.query,
      grounded_content: [],
      recommended_reading: [],
      visual_descriptions: [],
      provider: 'google_direct',
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
