// EduThree AI Orchestrator
// Centralized AI request handling with model selection, caching, and cost tracking
// Per Technical Specification v3.0 Part 4

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

// Model configuration
const MODEL_CONFIG = {
  // Default model for most tasks
  default: 'google/gemini-2.5-flash',
  // Model for complex reasoning tasks
  reasoning: 'google/gemini-2.5-pro',
  // Model for simple/fast tasks
  fast: 'google/gemini-2.5-flash-lite',
};

// Task to model mapping
const TASK_MODEL_MAP: Record<AITaskType, string> = {
  syllabus_extraction: MODEL_CONFIG.default,
  capability_analysis: MODEL_CONFIG.default,
  job_requirements: MODEL_CONFIG.reasoning,
  gap_analysis: MODEL_CONFIG.reasoning,
  recommendations: MODEL_CONFIG.default,
  embedding: MODEL_CONFIG.fast,
};

// Cost per 1K tokens (estimates)
const COST_PER_1K_TOKENS = {
  input: 0.00015,
  output: 0.0006,
};

export interface AIRequest {
  task: AITaskType;
  systemPrompt: string;
  userPrompt: string;
  schema?: object; // For structured output via function calling
  functionName?: string; // Name for the function call
  cacheKey?: string; // Optional cache key
  cacheTTLHours?: number; // Optional cache TTL
}

export interface AIResponse {
  content: any;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cached: boolean;
}

/**
 * Main AI orchestration function
 * Handles model selection, caching, and cost tracking
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
      return {
        content: cached,
        model_used: 'cached',
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        cached: true,
      };
    }
  }

  // Select model based on task
  const model = TASK_MODEL_MAP[request.task] || MODEL_CONFIG.default;

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

  // Make API call
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
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue.");
    }
    throw new Error(`AI request failed: ${response.status}`);
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

  // Calculate tokens and cost
  const inputTokens = data.usage?.prompt_tokens || estimateTokens(request.systemPrompt + request.userPrompt);
  const outputTokens = data.usage?.completion_tokens || estimateTokens(JSON.stringify(content));
  const costUsd = calculateCost(inputTokens, outputTokens);

  // Cache response if key provided
  if (request.cacheKey && supabase) {
    const ttl = request.cacheTTLHours || CACHE_TTL[request.task as keyof typeof CACHE_TTL] || 24;
    await setCachedResponse(
      supabase,
      request.cacheKey,
      request.task,
      content,
      model,
      ttl
    );
  }

  // Track usage if user provided
  if (supabase && userId) {
    await trackAIUsage(supabase, userId, request.task, model, inputTokens, outputTokens);
  }

  console.log(`AI Response: tokens=${inputTokens}/${outputTokens}, cost=$${costUsd.toFixed(4)}`);

  return {
    content,
    model_used: model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    cached: false,
  };
}

/**
 * Estimate token count from text
 * Rough approximation: ~4 characters per token
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost from token counts
 */
function calculateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1000) * COST_PER_1K_TOKENS.input +
    (outputTokens / 1000) * COST_PER_1K_TOKENS.output
  );
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
 * Generate embedding for text using AI
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  // For now, we'll skip actual embedding generation
  // This would require a separate embedding model call
  // Return null to indicate embeddings not yet implemented
  console.log('Embedding generation not yet implemented');
  return null;
}
