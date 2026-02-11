// ============================================================================
// OPENROUTER CLIENT - Unified AI Gateway for All Providers
// ============================================================================
//
// PURPOSE: Single API client that provides access to OpenAI, Google, Anthropic,
//          and 300+ other models through OpenRouter's unified interface
//
// BENEFITS:
//   - OpenAI-compatible API format for ALL providers
//   - Automatic fallbacks if primary provider fails
//   - Cost optimization with :floor suffix
//   - Response healing for malformed JSON
//   - Unified billing and usage tracking
//
// ENVIRONMENT VARIABLES:
//   - OPENROUTER_API_KEY: OpenRouter API key (required)
//   - AI_PROVIDER: 'openrouter' or 'google' (optional, for rollback)
//
// USAGE:
//   import { callOpenRouter, MODELS } from "../_shared/openrouter-client.ts";
//
//   const response = await callOpenRouter({
//     model: MODELS.FAST,
//     messages: [
//       { role: 'system', content: 'You are helpful.' },
//       { role: 'user', content: 'Hello!' }
//     ],
//     fallbacks: [MODELS.GEMINI_FLASH],
//   });
//
// DOCUMENTATION: https://openrouter.ai/docs
// ============================================================================

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

// ============================================================================
// MODEL DEFINITIONS - Optimized for OpenRouter Consolidation (2026-01-25)
// ============================================================================
//
// ALL AI operations now route through OpenRouter for:
//   - Unified billing and cost tracking
//   - Automatic fallbacks
//   - Consistent API format
//
// TASK → MODEL MAPPING:
//   | Task                    | Model                        | Fallback                   |
//   |-------------------------|------------------------------|----------------------------|
//   | Slide Content           | google/gemini-3-flash-preview| google/gemini-2.5-flash    |
//   | Image Generation        | google/gemini-3-pro-image    | google/gemini-2.5-flash-image |
//   | Research/Grounding      | perplexity/sonar-pro         | perplexity/sonar           |
//   | Syllabus Parsing        | google/gemini-2.5-flash      | google/gemini-flash-1.5    |
//   | Curriculum Reasoning    | deepseek/deepseek-r1         | google/gemini-2.5-pro      |
//   | Fast Extraction         | google/gemini-2.5-flash-lite | openai/gpt-4o-mini         |
// ============================================================================

/**
 * Pre-configured model aliases for easy switching
 * Format: provider/model-name
 *
 * Suffixes:
 *   :floor → Route to cheapest provider
 *   :nitro → Route to fastest provider
 */
export const MODELS = {
  // =========================================================================
  // SLIDE CONTENT GENERATION - Primary text for lecture slides
  // Used by: generate-lecture-slides-v3, Professor AI
  // =========================================================================
  PROFESSOR_AI: 'google/gemini-3-flash-preview',     // Next-gen: Best quality/speed balance
  PROFESSOR_AI_FALLBACK: 'google/gemini-2.5-flash',  // Fallback: Stable 2.5 Flash
  SLIDES: 'google/gemini-3-flash-preview',           // Alias for clarity

  // =========================================================================
  // IMAGE GENERATION - Educational visuals and diagrams
  // Used by: unified-ai-client.ts generateImage()
  // Requires: modalities: ['image', 'text'] in request body
  // =========================================================================
  IMAGE: 'google/gemini-3-pro-image-preview',        // Next-gen image model
  IMAGE_FALLBACK: 'google/gemini-2.5-flash-image',   // Fallback (GA version)
  IMAGE_FREE: 'google/gemini-2.5-flash-image-preview:free',  // Free tier - testing/dev

  // =========================================================================
  // RESEARCH & GROUNDING - Web search with citations
  // Used by: Research Agent (replaces Google Search Grounding)
  // Perplexity provides search grounding via OpenRouter
  // =========================================================================
  RESEARCH: 'perplexity/sonar-pro',                  // Multi-step reasoning + 2x citations
  RESEARCH_FALLBACK: 'perplexity/sonar',             // Faster, lighter research
  RESEARCH_DEEP: 'perplexity/sonar-deep-research',   // Expert research (expensive)

  // =========================================================================
  // CURRICULUM REASONING - Complex pedagogical decomposition
  // Used by: curriculum-reasoning-agent, backward design
  // =========================================================================
  REASONING: 'deepseek/deepseek-r1',                 // Best chain-of-thought reasoning
  REASONING_FALLBACK: 'google/gemini-2.5-pro',       // Fallback: Gemini Pro
  REASONING_CHEAP: 'google/gemini-2.5-flash',        // Budget reasoning

  // =========================================================================
  // SYLLABUS PARSING - Document extraction and analysis
  // Used by: process-syllabus, parse-syllabus-document
  // =========================================================================
  PARSING: 'google/gemini-2.5-flash',                // Best for multimodal docs
  PARSING_FALLBACK: 'google/gemini-flash-1.5',       // Fallback: Stable 1.5

  // =========================================================================
  // FAST EXTRACTION - Simple tasks, high volume
  // Used by: assessments, evaluations, quick extractions
  // =========================================================================
  FAST: 'google/gemini-2.5-flash-lite',              // Fastest Gemini, lowest cost
  FAST_FALLBACK: 'openai/gpt-4o-mini',               // Fallback: OpenAI mini
  FAST_CHEAP: 'google/gemini-2.5-flash-lite:floor',  // Cheapest routing
  FAST_NITRO: 'google/gemini-2.5-flash-lite:nitro',  // Fastest routing

  // =========================================================================
  // LEGACY ALIASES - For backwards compatibility
  // =========================================================================
  GEMINI_FLASH: 'google/gemini-2.5-flash',
  GEMINI_FLASH_FAST: 'google/gemini-flash-1.5',
  GEMINI_PRO: 'google/gemini-2.5-pro',
  CLAUDE_SONNET: 'anthropic/claude-sonnet-4',
  CLAUDE_HAIKU: 'anthropic/claude-3.5-haiku',
  AUTO: 'openrouter/auto',

  // =========================================================================
  // AUDIO GENERATION - Text-to-Speech via GPT Audio
  // Used by: generate-lecture-audio
  // Requires: modalities: ['text', 'audio'] and audio: { voice, format }
  // =========================================================================
  AUDIO: 'openai/gpt-audio-mini',          // Cost-efficient, natural voices
  AUDIO_HD: 'openai/gpt-audio',            // Higher quality, more expensive
} as const;

export type ModelKey = keyof typeof MODELS;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Content part for multimodal messages (text + images)
 */
export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * Chat message format (OpenAI-compatible)
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

/**
 * Tool/function definition for structured outputs
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Tool choice specification
 */
export type ToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };

/**
 * Request options for callOpenRouter
 */
export interface OpenRouterOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;

  // OpenRouter-specific features
  fallbacks?: string[];      // Fallback models if primary fails
  transforms?: string[];     // e.g., ["middle-out"] for context compression
  provider?: {
    order?: string[];        // Provider preference order
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
  };

  // Audio output support (GPT Audio models)
  modalities?: string[];     // e.g., ['text', 'audio']
  audio?: {
    voice: string;           // onyx, nova, echo, alloy, fable, shimmer
    format: string;          // 'wav' or 'pcm16'
  };
}

/**
 * Tool call in response
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Response from callOpenRouter
 */
export interface OpenRouterResponse {
  id: string;
  model: string;  // Actual model that responded (useful for fallbacks)
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
      audio?: {
        id: string;
        data: string;          // base64-encoded audio
        transcript?: string;
        expires_at: number;
      };
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get OpenRouter API key from environment
 */
function getApiKey(): string {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured. Get one at https://openrouter.ai');
  }
  return apiKey;
}

/**
 * Get the app URL for HTTP-Referer header
 * OpenRouter requires this header to match a registered site
 */
function getAppUrl(): string {
  const appUrl = Deno.env.get('APP_URL');
  if (!appUrl) {
    // Fail fast with clear error - prevents auth failures in staging/dev
    throw new Error('APP_URL is not configured. This is required for the OpenRouter HTTP-Referer header.');
  }
  return appUrl;
}

/**
 * Convert Google function schema to OpenAI/OpenRouter tool format
 *
 * Google format:
 *   { name, description, parameters: {...} }
 *
 * OpenRouter format (OpenAI-compatible):
 *   { type: 'function', function: { name, description, parameters: {...} } }
 */
export function convertSchemaToTool(googleSchema: {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: googleSchema.name,
      description: googleSchema.description,
      parameters: googleSchema.parameters,
    },
  };
}

// ============================================================================
// MAIN API FUNCTION
// ============================================================================

/**
 * Make a request to OpenRouter API
 *
 * @param options Request options (model, messages, temperature, etc.)
 * @param logPrefix Optional prefix for log messages
 * @returns OpenRouter API response
 *
 * @example
 * const response = await callOpenRouter({
 *   model: MODELS.FAST,
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   fallbacks: [MODELS.GEMINI_FLASH],
 * });
 */
export async function callOpenRouter(
  options: OpenRouterOptions,
  logPrefix = '[OpenRouter]'
): Promise<OpenRouterResponse> {
  const apiKey = getApiKey();

  console.log(`${logPrefix} Calling ${options.model}`);
  if (options.fallbacks?.length) {
    console.log(`${logPrefix} Fallbacks: ${options.fallbacks.join(', ')}`);
  }

  // Build request body
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
  };

  // Add optional parameters
  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }
  if (options.max_tokens !== undefined) {
    body.max_tokens = options.max_tokens;
  }
  if (options.response_format) {
    body.response_format = options.response_format;
  }
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    if (options.tool_choice) {
      body.tool_choice = options.tool_choice;
    }
  }

  // OpenRouter-specific: fallbacks
  if (options.fallbacks && options.fallbacks.length > 0) {
    body.route = 'fallback';
    body.models = [options.model, ...options.fallbacks];
  }

  // OpenRouter-specific: transforms (e.g., context compression)
  if (options.transforms && options.transforms.length > 0) {
    body.transforms = options.transforms;
  }

  // OpenRouter-specific: provider preferences
  if (options.provider) {
    body.provider = options.provider;
  }

  // Audio output support (GPT Audio models)
  if (options.modalities) {
    body.modalities = options.modalities;
  }
  if (options.audio) {
    body.audio = options.audio;
  }

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': getAppUrl(),
      'X-Title': 'SyllabusStack',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`${logPrefix} Error ${response.status}:`, errText);

    // Handle specific error codes
    if (response.status === 429) {
      throw new Error(`OpenRouter rate limit exceeded: ${errText}`);
    }
    if (response.status === 401) {
      throw new Error('OpenRouter API key is invalid');
    }
    if (response.status === 402) {
      throw new Error('OpenRouter credits exhausted. Add credits at https://openrouter.ai');
    }

    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }

  const data: OpenRouterResponse = await response.json();

  // Log which model actually responded (useful for fallbacks)
  const actualModel = data.model || options.model;
  const usedFallback = actualModel !== options.model;
  const usage = data.usage;
  const contentLength = data.choices[0]?.message?.content?.length || 0;
  const toolCalls = data.choices[0]?.message?.tool_calls?.length || 0;

  console.log(`${logPrefix} Response from ${actualModel}${usedFallback ? ' (fallback)' : ''}: ${contentLength} chars, ${toolCalls} tool calls, ${usage.total_tokens} tokens`);

  return data;
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Simple completion helper - returns just the content string
 *
 * @param model Model name (use MODELS constants)
 * @param systemPrompt System prompt
 * @param userPrompt User prompt
 * @param options Additional options
 * @returns Response content string
 *
 * @example
 * const content = await simpleCompletion(
 *   MODELS.FAST,
 *   'You are a helpful assistant.',
 *   'Summarize this text: ...',
 *   { fallbacks: [MODELS.GEMINI_FLASH] }
 * );
 */
export async function simpleCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: {
    temperature?: number;
    max_tokens?: number;
    json?: boolean;
    fallbacks?: string[];
  } = {},
  logPrefix = '[OpenRouter]'
): Promise<string> {
  const response = await callOpenRouter({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    response_format: options.json ? { type: 'json_object' } : undefined,
    fallbacks: options.fallbacks,
  }, logPrefix);

  return response.choices[0]?.message?.content || '';
}

/**
 * Function calling helper - returns parsed tool call arguments
 *
 * @param model Model name
 * @param systemPrompt System prompt
 * @param userPrompt User prompt
 * @param schema Google-format function schema
 * @param options Additional options
 * @returns Parsed function arguments
 *
 * @example
 * const data = await functionCall<ExtractedData>(
 *   MODELS.FAST,
 *   'Extract structured data.',
 *   'Content to analyze...',
 *   MY_SCHEMA,
 *   { fallbacks: [MODELS.GEMINI_FLASH] }
 * );
 */
export async function functionCall<T>(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  schema: { name: string; description?: string; parameters: Record<string, unknown> },
  options: {
    temperature?: number;
    fallbacks?: string[];
  } = {},
  logPrefix = '[OpenRouter]'
): Promise<T> {
  const response = await callOpenRouter({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature,
    tools: [convertSchemaToTool(schema)],
    tool_choice: { type: 'function', function: { name: schema.name } },
    fallbacks: options.fallbacks,
  }, logPrefix);

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error('No tool call in response');
  }

  return JSON.parse(toolCall.function.arguments) as T;
}

/**
 * Multimodal completion (text + image)
 *
 * @param model Model name (must support vision, e.g., gpt-4o-mini, gemini-2.0-flash)
 * @param systemPrompt System prompt
 * @param textPrompt Text part of the prompt
 * @param imageData Base64-encoded image data
 * @param mimeType Image MIME type (e.g., 'image/png', 'application/pdf')
 * @param options Additional options
 * @returns Response content string
 */
export async function multimodalCompletion(
  model: string,
  systemPrompt: string,
  textPrompt: string,
  imageData: string,
  mimeType: string,
  options: {
    temperature?: number;
    max_tokens?: number;
    fallbacks?: string[];
  } = {},
  logPrefix = '[OpenRouter]'
): Promise<string> {
  const response = await callOpenRouter({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageData}`,
              detail: 'auto',
            },
          },
          {
            type: 'text',
            text: textPrompt,
          },
        ],
      },
    ],
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    fallbacks: options.fallbacks,
  }, logPrefix);

  return response.choices[0]?.message?.content || '';
}

/**
 * Parse JSON from AI response, handling markdown code blocks
 */
export function parseJsonResponse<T>(content: string): T {
  // Try to extract JSON from markdown code block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(jsonStr);
}

// ============================================================================
// PROVIDER SELECTION HELPER
// ============================================================================

/**
 * Check if OpenRouter should be used (based on AI_PROVIDER env var)
 * Useful for gradual rollout and rollback
 */
export function shouldUseOpenRouter(): boolean {
  const provider = Deno.env.get('AI_PROVIDER');
  return provider !== 'google';  // Default to OpenRouter unless explicitly set to google
}

// ============================================================================
// IMAGE GENERATION - VIA UNIFIED-AI-CLIENT
// ============================================================================
// Image generation is handled by unified-ai-client.ts using:
//   - Primary: google/gemini-3-pro-image-preview (MODELS.IMAGE)
//   - Fallback: google/gemini-2.5-flash-image (MODELS.IMAGE_FALLBACK)
//   - Provider: OpenRouter (default) or Vertex AI (IMAGE_PROVIDER=google)
//   - Cost: ~$0.04 per image
// See unified-ai-client.ts generateImage() for implementation.
