/**
 * AI Provider Abstraction
 *
 * Provides unified interface for AI calls with multiple providers:
 * 1. Gemini (via Google Cloud API) - default for complex tasks
 * 2. OpenLLM (via RapidAPI) - cheaper alternative for simpler tasks
 *
 * ============================================================================
 * MIGRATION NOTES: Lovable AI Gateway → Google Cloud Generative Language API
 * ============================================================================
 *
 * WHAT CHANGED:
 * - callGemini() now uses Google Cloud API directly instead of Lovable gateway
 * - API endpoint: generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * - Request format: Uses Google's native format (systemInstruction, contents, generationConfig)
 * - Response parsing: candidates[0].content.parts[0].text
 * - Environment variable: GOOGLE_CLOUD_API_KEY (was LOVABLE_API_KEY)
 *
 * EXPECTED OUTCOMES:
 * - Same functionality with direct Google Cloud control
 * - Fallback to Gemini still works when OpenLLM fails
 * - Cost estimation updated for Google Cloud pricing
 * - JSON response mode uses responseMimeType: 'application/json'
 *
 * NOTE: This abstraction is for simple text/JSON responses.
 * For structured output with tool calling, use direct API calls with
 * tools/tool_choice parameters (see analyze-dream-job as example).
 *
 * Required env vars:
 * - GOOGLE_CLOUD_API_KEY: Required for Gemini calls
 * - RAPIDAPI_KEY: Optional, enables OpenLLM for cost savings
 *
 * Usage:
 *   import { makeAICall, AITask } from "../_shared/ai-provider.ts";
 *   const result = await makeAICall({
 *     task: 'gap_analysis',
 *     systemPrompt: '...',
 *     userPrompt: '...',
 *   });
 */

// Task types and their recommended providers
export type AITask =
  | 'syllabus_parsing'      // Complex - Gemini
  | 'content_evaluation'    // Simple - OpenLLM
  | 'gap_analysis'          // Medium - OpenLLM or Gemini
  | 'recommendations'       // Simple - OpenLLM
  | 'assessment_grading'    // Simple - OpenLLM
  | 'question_generation'   // Medium - Gemini
  | 'job_analysis'          // Medium - OpenLLM or Gemini
  | 'career_discovery';     // Simple - OpenLLM

export interface AIRequest {
  task: AITask;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface AIResponse {
  content: string;
  provider: 'gemini' | 'openllm';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

// Map tasks to preferred providers
const TASK_PROVIDER_MAP: Record<AITask, 'gemini' | 'openllm'> = {
  syllabus_parsing: 'gemini',      // Complex document understanding
  content_evaluation: 'openllm',   // Simple scoring
  gap_analysis: 'openllm',         // Comparison task
  recommendations: 'openllm',      // Generation task
  assessment_grading: 'openllm',   // Simple evaluation
  question_generation: 'gemini',   // Needs quality
  job_analysis: 'openllm',         // Extraction task
  career_discovery: 'openllm',     // Simple suggestions
};

// OpenLLM model selection per task
const OPENLLM_MODEL_MAP: Record<AITask, string> = {
  syllabus_parsing: 'deepseek-r1',      // Not used, falls back to Gemini
  content_evaluation: 'llama-3.1-70b',
  gap_analysis: 'deepseek-r1',
  recommendations: 'llama-3.1-70b',
  assessment_grading: 'llama-3.1-70b',
  question_generation: 'deepseek-r1',   // Not used, falls back to Gemini
  job_analysis: 'llama-3.1-70b',
  career_discovery: 'llama-3.1-70b',
};

/**
 * Make an AI call with automatic provider selection and fallback
 */
export async function makeAICall(request: AIRequest): Promise<AIResponse> {
  const preferredProvider = TASK_PROVIDER_MAP[request.task];
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

  // Try OpenLLM first if preferred and configured
  if (preferredProvider === 'openllm' && RAPIDAPI_KEY) {
    try {
      return await callOpenLLM(request, RAPIDAPI_KEY);
    } catch (error) {
      console.warn(`OpenLLM failed for ${request.task}, falling back to Gemini:`, error);
    }
  }

  // Use Gemini (via Lovable Gateway)
  return await callGemini(request);
}

/**
 * Call OpenLLM via RapidAPI
 */
async function callOpenLLM(request: AIRequest, apiKey: string): Promise<AIResponse> {
  const model = OPENLLM_MODEL_MAP[request.task];

  const response = await fetch("https://open-llm.p.rapidapi.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "open-llm.p.rapidapi.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      ...(request.responseFormat === 'json' && {
        response_format: { type: "json_object" },
      }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenLLM error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice?.message?.content) {
    throw new Error("OpenLLM returned empty response");
  }

  return {
    content: choice.message.content,
    provider: 'openllm',
    model,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    costUsd: estimateOpenLLMCost(model, data.usage),
  };
}

/**
 * Call Gemini via Google Cloud API
 */
async function callGemini(request: AIRequest): Promise<AIResponse> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
  const model = "gemini-2.5-flash";

  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
  }

  // Build Google API request format
  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: request.userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: request.systemPrompt }],
    },
    generationConfig: {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 4096,
    },
  };

  if (request.responseFormat === 'json') {
    (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error("Gemini returned empty response");
  }

  const usage = data.usageMetadata || {};

  return {
    content,
    provider: 'gemini',
    model,
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
    costUsd: estimateGeminiCost({ prompt_tokens: usage.promptTokenCount, completion_tokens: usage.candidatesTokenCount }),
  };
}

/**
 * Estimate OpenLLM cost based on model and token usage
 */
function estimateOpenLLMCost(model: string, usage?: { prompt_tokens?: number; completion_tokens?: number }): number {
  if (!usage) return 0;

  // Approximate costs per 1K tokens (varies by model)
  const costs: Record<string, { input: number; output: number }> = {
    'deepseek-r1': { input: 0.0005, output: 0.002 },
    'llama-3.1-70b': { input: 0.0003, output: 0.001 },
    'mixtral-8x22b': { input: 0.0002, output: 0.0006 },
  };

  const modelCost = costs[model] || costs['llama-3.1-70b'];
  const inputCost = ((usage.prompt_tokens || 0) / 1000) * modelCost.input;
  const outputCost = ((usage.completion_tokens || 0) / 1000) * modelCost.output;

  return inputCost + outputCost;
}

/**
 * Estimate Gemini cost based on token usage
 */
function estimateGeminiCost(usage?: { prompt_tokens?: number; completion_tokens?: number }): number {
  if (!usage) return 0;

  // Gemini 2.5 Flash pricing (approximate)
  const inputCostPer1K = 0.001;
  const outputCostPer1K = 0.004;

  const inputCost = ((usage.prompt_tokens || 0) / 1000) * inputCostPer1K;
  const outputCost = ((usage.completion_tokens || 0) / 1000) * outputCostPer1K;

  return inputCost + outputCost;
}

/**
 * Parse JSON response safely
 */
export function parseAIResponse<T>(response: AIResponse): T {
  try {
    return JSON.parse(response.content);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}
