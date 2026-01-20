// ============================================================================
// UNIFIED AI CLIENT - Single Entry Point for All AI Operations
// ============================================================================
//
// PURPOSE: Consolidate all AI routing into a single, intelligent gateway that:
//   1. Routes text generation through OpenRouter (primary)
//   2. Routes image generation through Google Direct (more reliable than OpenRouter)
//   3. Routes search grounding through Google Direct (only option)
//   4. Provides automatic fallbacks and cost tracking
//
// ARCHITECTURE DECISIONS:
//   - OpenRouter for TEXT: Best cost optimization, fallbacks, and model variety
//   - Google Direct for IMAGES: More reliable than OpenRouter's gemini-2.5-flash-image-preview
//   - Google Direct for SEARCH: Search grounding not available on OpenRouter
//
// USAGE:
//   import { generateText, generateImage, searchGrounded, trackAIUsage } from '../_shared/unified-ai-client.ts';
//
//   // Text generation
//   const text = await generateText({ prompt: 'Hello', systemPrompt: 'Be helpful' });
//
//   // Image generation (with automatic fallback)
//   const image = await generateImage({ prompt: 'A diagram of...' });
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

export interface ImageResult {
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
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4.1': { input: 2.00, output: 8.00 },
  'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'google/gemini-3-flash-preview': { input: 0.10, output: 0.40 },
  'google/gemini-3-pro-preview': { input: 1.25, output: 5.00 },
  'gemini-3-pro-image-preview': { input: 0.50, output: 2.00 },
};

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
// IMAGE GENERATION - Google Direct Primary (more reliable)
// ============================================================================

/**
 * Generate an image using Google Direct API (primary) with OpenRouter fallback
 * 
 * RATIONALE: OpenRouter's google/gemini-2.5-flash-image-preview returns empty
 * images array ~40% of the time. Google Direct gemini-3-pro-image-preview is
 * more reliable.
 */
export async function generateImage(request: {
  prompt: string;
  slideTitle?: string;
  maxRetries?: number;
  useFallback?: boolean;
  logPrefix?: string;
}): Promise<ImageResult | null> {
  const startTime = Date.now();
  const logPrefix = request.logPrefix || '[UnifiedAI-Image]';
  const maxRetries = request.maxRetries ?? 2;

  console.log(`${logPrefix} Generating image via Google Direct (gemini-3-pro-image-preview)`);

  // Try Google Direct first (more reliable)
  const googleResult = await generateImageGoogleDirect(request.prompt, maxRetries, logPrefix);
  
  if (googleResult) {
    return {
      ...googleResult,
      provider: 'google_direct',
      latency_ms: Date.now() - startTime,
      cost_usd: 0.002, // Estimate for image generation
    };
  }

  // Fallback to OpenRouter if enabled
  if (request.useFallback !== false) {
    console.log(`${logPrefix} Google Direct failed, trying OpenRouter fallback...`);
    
    const openRouterResult = await generateImageOpenRouter(request.prompt, maxRetries, logPrefix);
    
    if (openRouterResult) {
      return {
        ...openRouterResult,
        provider: 'openrouter',
        latency_ms: Date.now() - startTime,
        fallback_used: true,
        cost_usd: 0.002,
      };
    }
  }

  console.error(`${logPrefix} All image generation attempts failed`);
  return null;
}

/**
 * Google Direct image generation using gemini-3-pro-image-preview
 */
async function generateImageGoogleDirect(
  prompt: string,
  maxRetries: number,
  logPrefix: string
): Promise<{ base64: string; mimeType: string; textResponse?: string } | null> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) {
    console.warn(`${logPrefix} GOOGLE_CLOUD_API_KEY not configured`);
    return null;
  }

  const model = 'gemini-3-pro-image-preview';
  const url = `${GOOGLE_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });

      if (response.status === 429) {
        const waitMs = 2000 * Math.pow(2, attempt);
        console.warn(`${logPrefix} Rate limited (429). Waiting ${waitMs}ms...`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        return null;
      }

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`${logPrefix} Attempt ${attempt + 1} failed: ${response.status}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
          continue;
        }
        return null;
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];

      let text: string | undefined;
      let base64: string | undefined;

      for (const part of parts) {
        if (part.text) text = part.text;
        if (part.inlineData) base64 = part.inlineData.data;
      }

      if (base64) {
        console.log(`${logPrefix} ✓ Google Direct image generated (${Math.round(base64.length / 1024)}KB)`);
        return { base64, mimeType: 'image/png', textResponse: text };
      }

      console.warn(`${logPrefix} No image data in response, attempt ${attempt + 1}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return null;

    } catch (error) {
      console.error(`${logPrefix} Google Direct error:`, error);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * OpenRouter image generation fallback
 */
async function generateImageOpenRouter(
  prompt: string,
  maxRetries: number,
  logPrefix: string
): Promise<{ base64: string; mimeType: string; textResponse?: string } | null> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  const appUrl = Deno.env.get('APP_URL');
  
  if (!apiKey || !appUrl) {
    console.warn(`${logPrefix} OpenRouter not configured`);
    return null;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': appUrl,
          'X-Title': 'SyllabusStack',
        },
        body: JSON.stringify({
          model: MODELS.GEMINI_IMAGE,
          messages: [{ role: 'user', content: prompt }],
          modalities: ['image', 'text'],
        }),
      });

      if (response.status === 429 || response.status === 503) {
        const waitMs = 2000 * Math.pow(2, attempt);
        console.warn(`${logPrefix} OpenRouter ${response.status}. Waiting ${waitMs}ms...`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        return null;
      }

      if (!response.ok) {
        console.warn(`${logPrefix} OpenRouter failed: ${response.status}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
          continue;
        }
        return null;
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const images = message?.images;
      const textContent = message?.content;

      if (images && images.length > 0) {
        const imageUrl = images[0]?.image_url?.url;
        
        if (imageUrl?.startsWith('data:image/')) {
          const commaIndex = imageUrl.indexOf(',');
          if (commaIndex === -1) return null;

          const header = imageUrl.substring(0, commaIndex);
          const base64 = imageUrl.substring(commaIndex + 1);
          const mimeMatch = header.match(/data:(image\/[^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

          console.log(`${logPrefix} ✓ OpenRouter image generated (${Math.round(base64.length / 1024)}KB)`);
          return { base64, mimeType, textResponse: textContent || undefined };
        }
      }

      console.warn(`${logPrefix} OpenRouter returned no image data`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return null;

    } catch (error) {
      console.error(`${logPrefix} OpenRouter error:`, error);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }

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
