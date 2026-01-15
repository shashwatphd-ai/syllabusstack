// SyllabusStack AI Orchestrator
// Centralized AI request handling with model selection, caching, fallback logic, and cost tracking
// Updated to use Google Cloud API directly for cost savings

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { getCachedResponse, setCachedResponse, CACHE_TTL, trackAIUsage } from "./ai-cache.ts";

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

// Google Gemini models (direct API)
export const MODEL_CONFIG = {
  // Fast, cost-effective (default)
  GEMINI_FLASH: 'gemini-2.0-flash',
  // Fastest, cheapest
  GEMINI_FLASH_LITE: 'gemini-2.0-flash-lite',
  // Complex reasoning
  GEMINI_PRO: 'gemini-2.5-pro-preview-06-05',
  // Balanced
  GEMINI_FLASH_THINKING: 'gemini-2.0-flash-thinking-exp',
};

// Task to model mapping with primary and fallback
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
    primary: MODEL_CONFIG.GEMINI_PRO,   // Needs reasoning for accurate requirements
    fallback: MODEL_CONFIG.GEMINI_FLASH 
  },
  gap_analysis: { 
    primary: MODEL_CONFIG.GEMINI_PRO,   // Complex comparison task
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

// Cost per 1M tokens for each model (USD)
// Lovable AI Gateway is CHEAPER for Gemini Flash ($0.075 vs $0.10 input, $0.30 vs $0.40 output)
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Lovable Gateway pricing (cheaper for Flash)
  'gemini-2.0-flash': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-2.5-pro-preview-06-05': { input: 1.25, output: 5.00 },
  'gemini-2.0-flash-thinking-exp': { input: 0.075, output: 0.30 },
};

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
}

/**
 * Calculate cost from token counts for a specific model
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['gemini-2.0-flash'];
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
}

/**
 * Estimate token count from text
 * Rough approximation: ~4 characters per token
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get API key - PREFERS LOVABLE_API_KEY (cheaper for Gemini Flash)
 * Falls back to GOOGLE_CLOUD_API_KEY for specialized APIs or if Lovable is unavailable
 */
function getAPIConfig(): { key: string; useGoogleDirect: boolean } {
  // Prefer Lovable AI Gateway (cheaper for Gemini Flash: $0.075 vs $0.10 input)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return { key: lovableKey, useGoogleDirect: false };
  }
  
  // Fallback to Google Cloud (useful if Lovable is rate-limited)
  const googleKey = Deno.env.get("GOOGLE_CLOUD_API_KEY");
  if (googleKey) {
    return { key: googleKey, useGoogleDirect: true };
  }
  
  throw new Error("No API key configured. Set LOVABLE_API_KEY or GOOGLE_CLOUD_API_KEY.");
}

/**
 * Make a single AI call using Google Gemini API directly
 */
async function makeGeminiCall(
  request: AIRequest,
  model: string,
  apiKey: string
): Promise<{ content: any; usage: { prompt_tokens: number; completion_tokens: number } }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  // Build request body for Gemini API
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

  // Add JSON schema for structured output
  if (request.schema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = request.schema;
  }

  console.log(`Gemini Direct Request: task=${request.task}, model=${model}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error: ${response.status}`, errorText);
    
    if (response.status === 429) {
      throw new Error("RATE_LIMIT: Rate limit exceeded. Please try again later.");
    }
    if (response.status === 403) {
      throw new Error("API_KEY_INVALID: Google Cloud API key is invalid or lacks permissions.");
    }
    throw new Error(`AI_ERROR: Gemini request failed with status ${response.status}`);
  }

  const data = await response.json();
  
  // Extract content from Gemini response
  let content: any;
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  if (request.schema) {
    // Parse JSON response
    try {
      content = JSON.parse(textContent);
    } catch {
      // If JSON parsing fails, return raw text
      content = textContent;
    }
  } else {
    content = textContent;
  }

  // Get usage metadata
  const usageMetadata = data.usageMetadata || {};
  
  return {
    content,
    usage: {
      prompt_tokens: usageMetadata.promptTokenCount || estimateTokens(request.systemPrompt + request.userPrompt),
      completion_tokens: usageMetadata.candidatesTokenCount || estimateTokens(JSON.stringify(content))
    }
  };
}

/**
 * Make a single AI call using Lovable AI Gateway (fallback)
 */
async function makeLovableCall(
  request: AIRequest,
  model: string,
  apiKey: string
): Promise<{ content: any; usage: { prompt_tokens: number; completion_tokens: number } }> {
  // Map Gemini model names to Lovable gateway format
  const lovableModel = model.includes('pro') 
    ? 'google/gemini-2.5-pro' 
    : model.includes('lite')
      ? 'google/gemini-2.5-flash-lite'
      : 'google/gemini-2.5-flash';

  const body: any = {
    model: lovableModel,
    messages: [
      { role: "system", content: request.systemPrompt },
      { role: "user", content: request.userPrompt }
    ],
  };

  // Add function calling for structured output
  if (request.schema && request.functionName) {
    body.tools = [
      {
        type: "function",
        function: {
          name: request.functionName,
          description: `Extract structured data for ${request.task}`,
          parameters: request.schema,
        }
      }
    ];
    body.tool_choice = { type: "function", function: { name: request.functionName } };
  }

  console.log(`Lovable Gateway Request: task=${request.task}, model=${lovableModel}`);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Lovable Gateway error: ${response.status}`, errorText);
    
    if (response.status === 429) {
      throw new Error("RATE_LIMIT: Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("CREDITS_EXHAUSTED: AI credits exhausted. Please add credits to continue.");
    }
    throw new Error(`AI_ERROR: AI request failed with status ${response.status}`);
  }

  const data = await response.json();
  
  // Extract content
  let content: any;
  if (request.schema && data.choices?.[0]?.message?.tool_calls?.[0]) {
    const toolCall = data.choices[0].message.tool_calls[0];
    content = JSON.parse(toolCall.function.arguments);
  } else {
    content = data.choices?.[0]?.message?.content || '';
  }

  return {
    content,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens || estimateTokens(request.systemPrompt + request.userPrompt),
      completion_tokens: data.usage?.completion_tokens || estimateTokens(JSON.stringify(content))
    }
  };
}

/**
 * Make a single AI call with specified model - routes to appropriate API
 */
async function makeAICall(
  request: AIRequest,
  model: string
): Promise<{ content: any; usage: { prompt_tokens: number; completion_tokens: number } }> {
  const { key, useGoogleDirect } = getAPIConfig();
  
  if (useGoogleDirect) {
    return makeGeminiCall(request, model, key);
  } else {
    return makeLovableCall(request, model, key);
  }
}

/**
 * Main AI orchestration function with fallback logic
 * Tries primary model first, falls back on failure
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
      console.log(`Cache HIT for task: ${request.task}`);
      return {
        content: cached,
        model_used: 'cached',
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        cached: true,
        fallback_used: false,
      };
    }
  }

  // Get model configuration
  const modelConfig = TASK_MODEL_MAP[request.task] || { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GEMINI_PRO 
  };
  
  // Allow model override
  const primaryModel = request.model || modelConfig.primary;
  const fallbackModel = modelConfig.fallback;

  let result: { content: any; usage: { prompt_tokens: number; completion_tokens: number } };
  let modelUsed: string;
  let fallbackUsed = false;

  try {
    // Try primary model
    result = await makeAICall(request, primaryModel);
    modelUsed = primaryModel;
    console.log(`Primary model ${primaryModel} succeeded`);
  } catch (primaryError) {
    // Check if it's a non-retryable error
    const errorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
    
    if (errorMessage.startsWith("RATE_LIMIT:") || errorMessage.startsWith("CREDITS_EXHAUSTED:") || errorMessage.startsWith("API_KEY_INVALID:")) {
      throw primaryError;
    }

    console.warn(`Primary model ${primaryModel} failed, trying fallback ${fallbackModel}:`, errorMessage);
    
    try {
      // Try fallback model
      result = await makeAICall(request, fallbackModel);
      modelUsed = fallbackModel;
      fallbackUsed = true;
      console.log(`Fallback model ${fallbackModel} succeeded`);
    } catch (fallbackError) {
      console.error(`Both primary and fallback models failed`);
      throw fallbackError;
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

  // Track usage if user provided
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

  const { useGoogleDirect } = getAPIConfig();
  console.log(`AI Response: model=${modelUsed}, api=${useGoogleDirect ? 'Google Direct' : 'Lovable Gateway'}, tokens=${result.usage.prompt_tokens}/${result.usage.completion_tokens}, cost=$${costUsd.toFixed(6)}, fallback=${fallbackUsed}`);

  return {
    content: result.content,
    model_used: modelUsed,
    input_tokens: result.usage.prompt_tokens,
    output_tokens: result.usage.completion_tokens,
    cost_usd: costUsd,
    cached: false,
    fallback_used: fallbackUsed,
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
  const selectedModel = model || TASK_MODEL_MAP[task]?.primary || MODEL_CONFIG.GEMINI_FLASH;
  
  const result = await makeAICall({
    task,
    systemPrompt,
    userPrompt,
    model: selectedModel
  }, selectedModel);

  return {
    content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
    model_used: selectedModel,
  };
}

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
  return TASK_MODEL_MAP[task] || { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GEMINI_PRO 
  };
}

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
