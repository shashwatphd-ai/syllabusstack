// EduThree AI Orchestrator
// Centralized AI request handling with model selection, caching, fallback logic, and cost tracking
// Per Technical Specification v3.0 Part 4 + AI Orchestration Implementation Plan Phase 2

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCachedResponse, setCachedResponse, CACHE_TTL, trackAIUsage } from "./ai-cache.ts";

// Task types for model selection
export type AITaskType = 
  | 'syllabus_extraction'
  | 'capability_analysis'
  | 'job_requirements'
  | 'gap_analysis'
  | 'recommendations'
  | 'embedding';

// Lovable AI Gateway models
export const MODEL_CONFIG = {
  // Fast, cost-effective (default)
  GEMINI_FLASH: 'google/gemini-2.5-flash',
  // Fastest, cheapest
  GEMINI_FLASH_LITE: 'google/gemini-2.5-flash-lite',
  // Complex reasoning
  GEMINI_PRO: 'google/gemini-2.5-pro',
  // Premium quality
  GPT5: 'openai/gpt-5',
  // Balanced cost/performance
  GPT5_MINI: 'openai/gpt-5-mini',
  // Fast and cheap
  GPT5_NANO: 'openai/gpt-5-nano',
};

// Task to model mapping with primary and fallback
export const TASK_MODEL_MAP: Record<AITaskType, { primary: string; fallback: string }> = {
  syllabus_extraction: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GPT5_MINI 
  },
  capability_analysis: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GPT5_MINI 
  },
  job_requirements: { 
    primary: MODEL_CONFIG.GEMINI_PRO,   // Needs reasoning for accurate requirements
    fallback: MODEL_CONFIG.GPT5 
  },
  gap_analysis: { 
    primary: MODEL_CONFIG.GEMINI_PRO,   // Complex comparison task
    fallback: MODEL_CONFIG.GPT5 
  },
  recommendations: { 
    primary: MODEL_CONFIG.GEMINI_FLASH, 
    fallback: MODEL_CONFIG.GPT5_MINI 
  },
  embedding: { 
    primary: MODEL_CONFIG.GEMINI_FLASH_LITE, 
    fallback: MODEL_CONFIG.GEMINI_FLASH 
  }
};

// Cost per 1M tokens for each model (USD)
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-flash-lite': { input: 0.0375, output: 0.15 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'openai/gpt-5': { input: 5.00, output: 15.00 },
  'openai/gpt-5-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-5-nano': { input: 0.10, output: 0.40 },
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
  const costs = MODEL_COSTS[model] || MODEL_COSTS['google/gemini-2.5-flash'];
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
 * Make a single AI call with specified model
 */
async function makeAICall(
  request: AIRequest,
  model: string,
  LOVABLE_API_KEY: string
): Promise<{ content: any; usage: { prompt_tokens: number; completion_tokens: number } }> {
  // Build request body
  const body: any = {
    model,
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

  console.log(`AI Request: task=${request.task}, model=${model}`);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI Gateway error: ${response.status}`, errorText);
    
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
    // Parse function call response
    const toolCall = data.choices[0].message.tool_calls[0];
    content = JSON.parse(toolCall.function.arguments);
  } else {
    // Plain text response
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
 * Main AI orchestration function with fallback logic
 * Tries primary model first, falls back on failure
 */
export async function callAI(
  request: AIRequest,
  supabase?: SupabaseClient,
  userId?: string
): Promise<AIResponse> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

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
    fallback: MODEL_CONFIG.GPT5_MINI 
  };
  
  // Allow model override
  const primaryModel = request.model || modelConfig.primary;
  const fallbackModel = modelConfig.fallback;

  let result: { content: any; usage: { prompt_tokens: number; completion_tokens: number } };
  let modelUsed: string;
  let fallbackUsed = false;

  try {
    // Try primary model
    result = await makeAICall(request, primaryModel, LOVABLE_API_KEY);
    modelUsed = primaryModel;
    console.log(`Primary model ${primaryModel} succeeded`);
  } catch (primaryError) {
    // Check if it's a non-retryable error
    const errorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
    
    if (errorMessage.startsWith("RATE_LIMIT:") || errorMessage.startsWith("CREDITS_EXHAUSTED:")) {
      // Don't retry on rate limit or credits - these affect all models
      throw primaryError;
    }

    console.warn(`Primary model ${primaryModel} failed, trying fallback ${fallbackModel}:`, errorMessage);
    
    try {
      // Try fallback model
      result = await makeAICall(request, fallbackModel, LOVABLE_API_KEY);
      modelUsed = fallbackModel;
      fallbackUsed = true;
      console.log(`Fallback model ${fallbackModel} succeeded`);
    } catch (fallbackError) {
      // Both models failed
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

  console.log(`AI Response: model=${modelUsed}, tokens=${result.usage.prompt_tokens}/${result.usage.completion_tokens}, cost=$${costUsd.toFixed(6)}, fallback=${fallbackUsed}`);

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
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const selectedModel = model || TASK_MODEL_MAP[task]?.primary || MODEL_CONFIG.GEMINI_FLASH;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
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
    fallback: MODEL_CONFIG.GPT5_MINI 
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
