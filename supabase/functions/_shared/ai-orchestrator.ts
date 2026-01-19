// SyllabusStack AI Orchestrator
// Centralized AI request handling with model selection, caching, fallback logic, and cost tracking
//
// ============================================================================
// ROUTING STRATEGY: OpenRouter → Google Cloud
// ============================================================================
//
// PRIMARY: OpenRouter (unified gateway for OpenAI, Google, Anthropic)
// FALLBACK: Direct Google Cloud API (if OpenRouter fails)
//
// This provides:
// - Access to best-in-class models from multiple providers
// - Automatic fallbacks within OpenRouter
// - Final fallback to direct Google if OpenRouter is unavailable
// - Unified cost tracking and billing through OpenRouter
//
// Environment Variables:
// - OPENROUTER_API_KEY: OpenRouter API key (required for primary)
// - GOOGLE_CLOUD_API_KEY: Google Cloud API key (required for fallback)
// - AI_PROVIDER: 'google' to bypass OpenRouter entirely (optional)
// - APP_URL: Application URL for OpenRouter HTTP-Referer header
//
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { getCachedResponse, setCachedResponse, CACHE_TTL, trackAIUsage } from "./ai-cache.ts";
import { 
  callOpenRouter, 
  functionCall as openRouterFunctionCall,
  simpleCompletion as openRouterSimpleCompletion,
  MODELS as OPENROUTER_MODELS,
  shouldUseOpenRouter,
  type OpenRouterResponse,
} from "./openrouter-client.ts";

// Task types for model selection
export type AITaskType = 
  | 'syllabus_extraction'
  | 'capability_analysis'
  | 'job_requirements'
  | 'gap_analysis'
  | 'recommendations'
  | 'embedding'
  | 'question_generation'
  | 'answer_evaluation'
  | 'content_search';

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

// Google Gemini models (direct API via generativelanguage.googleapis.com)
// Used as fallback when OpenRouter is unavailable
export const MODEL_CONFIG = {
  // Fast, cost-effective (default)
  GEMINI_FLASH: 'gemini-2.5-flash',
  // Fastest, cheapest
  GEMINI_FLASH_LITE: 'gemini-2.5-flash-lite',
  // Complex reasoning (Gemini 3)
  GEMINI_PRO: 'gemini-3-pro-preview',
  // Frontier speed (Gemini 3)
  GEMINI_3_FLASH: 'gemini-3-flash-preview',
  // Image generation (Gemini 3)
  GEMINI_IMAGE: 'gemini-3-pro-image-preview',
};

// OpenRouter model mapping for each task
// Maps our task types to OpenRouter model names with fallbacks
const OPENROUTER_TASK_MODELS: Record<AITaskType, { primary: string; fallback: string }> = {
  syllabus_extraction: { 
    primary: OPENROUTER_MODELS.FAST,           // gpt-4o-mini - fast extraction
    fallback: OPENROUTER_MODELS.GEMINI_FLASH,  // google/gemini-2.5-flash
  },
  capability_analysis: { 
    primary: OPENROUTER_MODELS.FAST, 
    fallback: OPENROUTER_MODELS.GEMINI_FLASH,
  },
  job_requirements: { 
    primary: OPENROUTER_MODELS.REASONING,      // gpt-4.1 - needs reasoning
    fallback: OPENROUTER_MODELS.CLAUDE_SONNET, // claude-sonnet-4
  },
  gap_analysis: { 
    primary: OPENROUTER_MODELS.REASONING,      // Complex comparison
    fallback: OPENROUTER_MODELS.CLAUDE_SONNET,
  },
  recommendations: { 
    primary: OPENROUTER_MODELS.FAST, 
    fallback: OPENROUTER_MODELS.GEMINI_FLASH,
  },
  embedding: { 
    primary: OPENROUTER_MODELS.FAST_CHEAP,     // Cost-optimized
    fallback: OPENROUTER_MODELS.GEMINI_FLASH,
  },
  question_generation: {
    primary: OPENROUTER_MODELS.FAST,
    fallback: OPENROUTER_MODELS.GEMINI_FLASH,
  },
  answer_evaluation: {
    primary: OPENROUTER_MODELS.FAST,
    fallback: OPENROUTER_MODELS.GEMINI_FLASH,
  },
  content_search: {
    primary: OPENROUTER_MODELS.FAST_CHEAP,
    fallback: OPENROUTER_MODELS.GEMINI_FLASH,
  }
};

// Vertex AI model paths for batch prediction (unchanged - these bypass OpenRouter)
export const VERTEX_AI_MODELS = {
  GEMINI_FLASH: 'publishers/google/models/gemini-2.5-flash',
  GEMINI_FLASH_LITE: 'publishers/google/models/gemini-2.5-flash-lite',
  GEMINI_PRO: 'publishers/google/models/gemini-3-pro-preview',
  GEMINI_3_FLASH: 'publishers/google/models/gemini-3-flash-preview',
  GEMINI_IMAGE: 'publishers/google/models/gemini-3-pro-image-preview',
};

// Task to model mapping for direct Google calls (fallback)
export const TASK_MODEL_MAP: Record<AITaskType, { primary: string; fallback: string }> = {
  syllabus_extraction: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GEMINI_PRO 
  },
  capability_analysis: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GEMINI_PRO 
  },
  job_requirements: { 
    primary: MODEL_CONFIG.GEMINI_PRO,
    fallback: MODEL_CONFIG.GEMINI_FLASH 
  },
  gap_analysis: { 
    primary: MODEL_CONFIG.GEMINI_PRO,
    fallback: MODEL_CONFIG.GEMINI_FLASH 
  },
  recommendations: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GEMINI_PRO 
  },
  embedding: { 
    primary: MODEL_CONFIG.GEMINI_FLASH_LITE, 
    fallback: MODEL_CONFIG.GEMINI_FLASH 
  },
  question_generation: {
    primary: MODEL_CONFIG.GEMINI_FLASH,
    fallback: MODEL_CONFIG.GEMINI_PRO
  },
  answer_evaluation: {
    primary: MODEL_CONFIG.GEMINI_FLASH,
    fallback: MODEL_CONFIG.GEMINI_PRO
  },
  content_search: {
    primary: MODEL_CONFIG.GEMINI_FLASH_LITE,
    fallback: MODEL_CONFIG.GEMINI_FLASH
  }
};

// Cost per 1M tokens for each model (USD) - for tracking
// OpenRouter uses pay-as-you-go with similar pricing
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Google models (direct)
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-3-pro-preview': { input: 2.00, output: 12.00 },
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'gemini-3-pro-image-preview': { input: 0.50, output: 3.00 },
  // OpenRouter models (approximate)
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4.1': { input: 2.00, output: 8.00 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
  'anthropic/claude-3.5-haiku': { input: 0.25, output: 1.25 },
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface AIRequest {
  task: AITaskType;
  systemPrompt: string;
  userPrompt: string;
  schema?: object; // For structured output via function calling
  functionName?: string; // Name for the function call
  cacheKey?: string; // Optional cache key
  cacheTTLHours?: number; // Optional cache TTL
  model?: string; // Optional model override
}

export interface AIResponse {
  content: any;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cached: boolean;
  fallback_used: boolean;
  provider: 'openrouter' | 'google';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate cost from token counts for a specific model
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['gemini-2.5-flash'];
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
}

/**
 * Estimate token count from text (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get Vertex AI model path for batch prediction
 */
export function getVertexAIModelPath(modelId: string): string {
  if (modelId.startsWith('publishers/') || modelId.startsWith('projects/')) {
    return modelId;
  }
  return `publishers/google/models/${modelId}`;
}

// ============================================================================
// OPENROUTER AI CALL
// ============================================================================

/**
 * Make AI call through OpenRouter
 */
async function makeOpenRouterCall(
  request: AIRequest,
  primaryModel: string,
  fallbackModel: string
): Promise<{ content: any; usage: { prompt_tokens: number; completion_tokens: number }; model: string }> {
  console.log(`[OpenRouter] Task: ${request.task}, Primary: ${primaryModel}, Fallback: ${fallbackModel}`);

  // If schema provided, use function calling
  if (request.schema && request.functionName) {
    const result = await openRouterFunctionCall<any>(
      primaryModel,
      request.systemPrompt,
      request.userPrompt,
      {
        name: request.functionName,
        description: `Extract ${request.task} data`,
        parameters: request.schema as Record<string, unknown>,
      },
      { fallbacks: [fallbackModel] },
      `[OpenRouter:${request.task}]`
    );
    
    // Estimate tokens for function calls (OpenRouter doesn't always return usage for tool calls)
    const inputTokens = estimateTokens(request.systemPrompt + request.userPrompt);
    const outputTokens = estimateTokens(JSON.stringify(result));
    
    return {
      content: result,
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
      model: primaryModel,
    };
  }

  // Simple completion
  const response = await callOpenRouter({
    model: primaryModel,
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ],
    fallbacks: [fallbackModel],
    temperature: 0.7,
    max_tokens: 8192,
  }, `[OpenRouter:${request.task}]`);

  let content: any = response.choices[0]?.message?.content || '';
  
  // Try to parse as JSON if it looks like JSON
  if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
    try {
      content = JSON.parse(content);
    } catch {
      // Keep as string
    }
  }

  return {
    content,
    usage: {
      prompt_tokens: response.usage?.prompt_tokens || estimateTokens(request.systemPrompt + request.userPrompt),
      completion_tokens: response.usage?.completion_tokens || estimateTokens(JSON.stringify(content)),
    },
    model: response.model || primaryModel,
  };
}

// ============================================================================
// GOOGLE CLOUD DIRECT CALL (FALLBACK)
// ============================================================================

/**
 * Get Google Cloud API key
 */
function getGoogleAPIKey(): string {
  const googleKey = Deno.env.get("GOOGLE_CLOUD_API_KEY");
  if (googleKey) {
    return googleKey;
  }
  throw new Error("GOOGLE_CLOUD_API_KEY is not configured.");
}

/**
 * Make a direct call to Google Gemini API (fallback)
 */
async function makeGeminiCall(
  request: AIRequest,
  model: string,
  apiKey: string
): Promise<{ content: any; usage: { prompt_tokens: number; completion_tokens: number } }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const body: any = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${request.systemPrompt}\n\n${request.userPrompt}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    }
  };

  if (request.schema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = request.schema;
  }

  console.log(`[GoogleDirect] Fallback request: task=${request.task}, model=${model}`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[GoogleDirect] Error ${response.status}:`, errorText);
    
    if (response.status === 429) {
      throw new Error("RATE_LIMIT: Rate limit exceeded");
    }
    if (response.status === 403) {
      throw new Error("API_KEY_INVALID: Google Cloud API key is invalid");
    }
    throw new Error(`AI_ERROR: Gemini request failed with status ${response.status}`);
  }

  const data = await response.json();
  
  let content: any;
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  if (request.schema) {
    try {
      content = JSON.parse(textContent);
    } catch {
      content = textContent;
    }
  } else {
    content = textContent;
  }

  const usageMetadata = data.usageMetadata || {};
  
  return {
    content,
    usage: {
      prompt_tokens: usageMetadata.promptTokenCount || estimateTokens(request.systemPrompt + request.userPrompt),
      completion_tokens: usageMetadata.candidatesTokenCount || estimateTokens(JSON.stringify(content))
    }
  };
}

// ============================================================================
// MAIN ORCHESTRATION FUNCTION
// ============================================================================

/**
 * Main AI orchestration function
 * Routes through OpenRouter first, falls back to direct Google on failure
 */
export async function callAI(
  request: AIRequest,
  supabase?: SupabaseClient,
  userId?: string
): Promise<AIResponse> {
  // Check cache if key provided
  if (request.cacheKey && supabase) {
    const cached = await getCachedResponse(supabase, request.cacheKey);
    if (cached) {
      console.log(`[AI] Cache HIT for task: ${request.task}`);
      return {
        content: cached,
        model_used: 'cached',
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        cached: true,
        fallback_used: false,
        provider: 'openrouter',
      };
    }
  }

  let result: { content: any; usage: { prompt_tokens: number; completion_tokens: number }; model?: string };
  let modelUsed: string;
  let fallbackUsed = false;
  let provider: 'openrouter' | 'google' = 'openrouter';

  const useOpenRouter = shouldUseOpenRouter();

  if (useOpenRouter) {
    // === PRIMARY: OpenRouter ===
    const openRouterModels = OPENROUTER_TASK_MODELS[request.task];
    const primaryModel = request.model || openRouterModels.primary;
    const fallbackModel = openRouterModels.fallback;

    try {
      result = await makeOpenRouterCall(request, primaryModel, fallbackModel);
      modelUsed = result.model || primaryModel;
      provider = 'openrouter';
      console.log(`[AI] OpenRouter succeeded: ${modelUsed}`);
    } catch (openRouterError) {
      const errorMessage = openRouterError instanceof Error ? openRouterError.message : String(openRouterError);
      console.warn(`[AI] OpenRouter failed, falling back to Google Direct:`, errorMessage);
      
      // === FALLBACK: Direct Google ===
      try {
        const googleModels = TASK_MODEL_MAP[request.task];
        const googleApiKey = getGoogleAPIKey();
        
        result = await makeGeminiCall(request, googleModels.primary, googleApiKey);
        modelUsed = googleModels.primary;
        fallbackUsed = true;
        provider = 'google';
        console.log(`[AI] Google Direct fallback succeeded: ${modelUsed}`);
      } catch (googleError) {
        console.error(`[AI] Both OpenRouter and Google Direct failed`);
        throw googleError;
      }
    }
  } else {
    // === BYPASS: Direct Google (AI_PROVIDER=google) ===
    const googleModels = TASK_MODEL_MAP[request.task];
    const primaryModel = request.model || googleModels.primary;
    const fallbackModel = googleModels.fallback;
    const googleApiKey = getGoogleAPIKey();
    
    try {
      result = await makeGeminiCall(request, primaryModel, googleApiKey);
      modelUsed = primaryModel;
      provider = 'google';
    } catch (primaryError) {
      const errorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      
      if (errorMessage.startsWith("RATE_LIMIT:") || errorMessage.startsWith("API_KEY_INVALID:")) {
        throw primaryError;
      }

      console.warn(`[AI] Primary Google model failed, trying fallback:`, errorMessage);
      
      result = await makeGeminiCall(request, fallbackModel, googleApiKey);
      modelUsed = fallbackModel;
      fallbackUsed = true;
      provider = 'google';
    }
  }

  // Calculate cost
  const costUsd = calculateCost(modelUsed, result.usage.prompt_tokens, result.usage.completion_tokens);

  // Cache response if key provided
  if (request.cacheKey && supabase) {
    const ttl = request.cacheTTLHours || CACHE_TTL[request.task as keyof typeof CACHE_TTL] || 24;
    await setCachedResponse(
      supabase,
      request.cacheKey,
      request.task,
      result.content,
      modelUsed,
      ttl
    );
  }

  // Track usage in database
  if (supabase && userId) {
    await trackAIUsage(
      supabase, 
      userId, 
      request.task, 
      modelUsed, 
      result.usage.prompt_tokens, 
      result.usage.completion_tokens
    );
  }

  console.log(`[AI] Response: provider=${provider}, model=${modelUsed}, tokens=${result.usage.prompt_tokens}/${result.usage.completion_tokens}, cost=$${costUsd.toFixed(6)}, fallback=${fallbackUsed}`);

  return {
    content: result.content,
    model_used: modelUsed,
    input_tokens: result.usage.prompt_tokens,
    output_tokens: result.usage.completion_tokens,
    cost_usd: costUsd,
    cached: false,
    fallback_used: fallbackUsed,
    provider,
  };
}

/**
 * Simple AI call without fallback (for when you want specific model behavior)
 */
export async function callAISimple(
  task: AITaskType,
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<{ content: string; model_used: string }> {
  const useOpenRouter = shouldUseOpenRouter();
  
  if (useOpenRouter) {
    const openRouterModels = OPENROUTER_TASK_MODELS[task];
    const selectedModel = model || openRouterModels.primary;
    
    const content = await openRouterSimpleCompletion(
      selectedModel,
      systemPrompt,
      userPrompt,
      { fallbacks: [openRouterModels.fallback] },
      `[OpenRouter:${task}]`
    );
    
    return { content, model_used: selectedModel };
  }

  // Direct Google fallback
  const googleModels = TASK_MODEL_MAP[task];
  const selectedModel = model || googleModels.primary;
  const googleApiKey = getGoogleAPIKey();
  
  const result = await makeGeminiCall({
    task,
    systemPrompt,
    userPrompt,
    model: selectedModel
  }, selectedModel, googleApiKey);

  return {
    content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
    model_used: selectedModel,
  };
}

// ============================================================================
// SUPABASE CLIENT HELPERS
// ============================================================================

/**
 * Create a service role Supabase client
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

/**
 * Create a user-authenticated Supabase client from request
 */
export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );
}

/**
 * Get model for a specific task (useful for edge functions)
 */
export function getModelForTask(task: AITaskType): { primary: string; fallback: string } {
  if (shouldUseOpenRouter()) {
    return OPENROUTER_TASK_MODELS[task];
  }
  return TASK_MODEL_MAP[task];
}

// ============================================================================
// KEYWORD-BASED SIMILARITY (LOCAL ALTERNATIVE TO EMBEDDINGS)
// ============================================================================

/**
 * Generate keyword-based representation for similarity matching
 * (Alternative to vector embeddings - no additional AI cost)
 */
export function generateKeywordVector(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'under', 
    'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'so', 
    'yet', 'both', 'either', 'neither', 'not', 'only', 'own', 'same', 
    'than', 'too', 'very', 'just', 'this', 'that', 'these', 'those',
    'such', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why'
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 100);
}

/**
 * Calculate Jaccard similarity between two keyword arrays
 */
export function calculateSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;
  
  return union > 0 ? intersection / union : 0;
}
