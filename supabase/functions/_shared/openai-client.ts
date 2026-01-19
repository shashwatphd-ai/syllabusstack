// ============================================================================
// OPENAI CLIENT - Chat Completions API Wrapper
// ============================================================================
//
// PURPOSE: Provide a consistent interface for OpenAI Chat Completions API
//          that mirrors the existing google-ai-gateway.ts patterns
//
// MIGRATION: This replaces direct Google API calls for 10 edge functions
//
// ENVIRONMENT VARIABLES:
//   - OPENAI_API_KEY: OpenAI API key (required)
//   - AI_PROVIDER: 'openai' or 'google' (optional, for rollback)
//
// USAGE:
//   import { callOpenAI, simpleCompletion } from "../_shared/openai-client.ts";
//
//   const response = await callOpenAI({
//     model: 'gpt-4o-mini',
//     messages: [
//       { role: 'system', content: systemPrompt },
//       { role: 'user', content: userPrompt }
//     ],
//     temperature: 0.7
//   });
//
// ============================================================================

const OPENAI_API_BASE = 'https://api.openai.com/v1';

// Model mapping: internal names -> OpenAI model IDs
const MODEL_MAP: Record<string, string> = {
  // Complex reasoning models
  'gpt-4.1': 'gpt-4.1-2025-04-14',
  'gpt-4o': 'gpt-4o-2024-11-20',

  // Fast/cost-effective models
  'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
  'gpt-4.1-mini': 'gpt-4.1-mini-2025-04-14',

  // Aliases for clarity
  'reasoning': 'gpt-4.1-2025-04-14',
  'fast': 'gpt-4o-mini-2024-07-18',
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Chat message format (OpenAI native format)
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

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
 * Request options for callOpenAI
 */
export interface OpenAIRequestOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
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
 * Response from callOpenAI
 */
export interface OpenAIResponse {
  choices: {
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  id: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get OpenAI API key from environment
 */
function getApiKey(): string {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return apiKey;
}

/**
 * Map internal model name to OpenAI model ID
 */
function mapModel(modelName: string): string {
  return MODEL_MAP[modelName] || modelName;
}

/**
 * Convert Google function schema to OpenAI tool format
 *
 * Google format:
 *   { name, description, parameters: {...} }
 *
 * OpenAI format:
 *   { type: 'function', function: { name, description, parameters: {...} } }
 */
export function convertSchemaToOpenAI(googleSchema: {
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
 * Make a request to OpenAI Chat Completions API
 *
 * @param options Request options (model, messages, temperature, etc.)
 * @param logPrefix Optional prefix for log messages
 * @returns OpenAI API response
 */
export async function callOpenAI(
  options: OpenAIRequestOptions,
  logPrefix = '[OpenAI]'
): Promise<OpenAIResponse> {
  const apiKey = getApiKey();
  const modelId = mapModel(options.model);

  console.log(`${logPrefix} Calling ${modelId} (mapped from ${options.model})`);

  // Build request body
  const body: Record<string, unknown> = {
    model: modelId,
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

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`${logPrefix} Error ${response.status}:`, errText);

    // Handle specific error codes
    if (response.status === 429) {
      throw new Error(`OpenAI rate limit exceeded: ${errText}`);
    }
    if (response.status === 401) {
      throw new Error('OpenAI API key is invalid');
    }

    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data: OpenAIResponse = await response.json();

  // Log usage
  const usage = data.usage;
  const contentLength = data.choices[0]?.message?.content?.length || 0;
  const toolCalls = data.choices[0]?.message?.tool_calls?.length || 0;

  console.log(`${logPrefix} Success: ${contentLength} chars, ${toolCalls} tool calls, ${usage.total_tokens} tokens`);

  return data;
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Simple completion helper - returns just the content string
 *
 * @param model Model name
 * @param systemPrompt System prompt
 * @param userPrompt User prompt
 * @param options Additional options
 * @param logPrefix Optional log prefix
 * @returns Response content string
 */
export async function simpleCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: {
    temperature?: number;
    max_tokens?: number;
    json?: boolean;
  } = {},
  logPrefix = '[OpenAI]'
): Promise<string> {
  const response = await callOpenAI({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    response_format: options.json ? { type: 'json_object' } : undefined,
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
 * @param logPrefix Optional log prefix
 * @returns Parsed function arguments
 */
export async function functionCall<T>(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  schema: { name: string; description?: string; parameters: Record<string, unknown> },
  options: {
    temperature?: number;
  } = {},
  logPrefix = '[OpenAI]'
): Promise<T> {
  const response = await callOpenAI({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature,
    tools: [convertSchemaToOpenAI(schema)],
    tool_choice: { type: 'function', function: { name: schema.name } },
  }, logPrefix);

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error('No tool call in response');
  }

  return JSON.parse(toolCall.function.arguments) as T;
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
 * Check if OpenAI should be used (based on AI_PROVIDER env var)
 * Useful for gradual rollout and rollback
 */
export function shouldUseOpenAI(): boolean {
  const provider = Deno.env.get('AI_PROVIDER');
  return provider !== 'google';  // Default to OpenAI unless explicitly set to google
}
