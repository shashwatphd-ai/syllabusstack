/**
 * Google Cloud AI Gateway
 *
 * Direct replacement for Lovable AI Gateway.
 * Uses Google Cloud Generative Language API (generativelanguage.googleapis.com).
 *
 * Required env var: GOOGLE_CLOUD_API_KEY
 *
 * Model mapping:
 * - google/gemini-2.5-flash → gemini-2.5-flash
 * - google/gemini-2.5-flash-lite → gemini-2.5-flash-lite
 * - google/gemini-2.5-pro → gemini-2.5-pro
 * - google/gemini-3-flash-preview → gemini-3-flash-preview
 * - google/gemini-3-pro-preview → gemini-3-pro-preview
 * - google/gemini-3-pro-image-preview → gemini-3-pro-image-preview
 * - openai/gpt-5.2 → gemini-3-pro-preview
 * - openai/gpt-5 → gemini-3-pro-preview
 * - openai/gpt-5-mini → gemini-3-flash-preview
 * - openai/gpt-5-nano → gemini-2.5-flash-lite
 */

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Map Lovable model names to Google Cloud model names
const MODEL_MAP: Record<string, string> = {
  // Gemini 2.5 family
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  'google/gemini-2.5-pro': 'gemini-2.5-pro',

  // Gemini 3 family
  'google/gemini-3-flash-preview': 'gemini-3-flash-preview',
  'google/gemini-3-pro-preview': 'gemini-3-pro-preview',
  'google/gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',

  // OpenAI equivalents → Gemini 3
  'openai/gpt-5.2': 'gemini-3-pro-preview',
  'openai/gpt-5': 'gemini-3-pro-preview',
  'openai/gpt-5-mini': 'gemini-3-flash-preview',
  'openai/gpt-5-nano': 'gemini-2.5-flash-lite',
};

/**
 * Get the Google Cloud API key from environment
 */
function getApiKey(): string {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY is not configured');
  }
  return apiKey;
}

/**
 * Map a Lovable model name to Google Cloud model name
 */
function mapModel(lovableModel: string): string {
  return MODEL_MAP[lovableModel] || lovableModel;
}

/**
 * Message format (matches Lovable/OpenAI format)
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

/**
 * Tool definition for Google Search grounding
 */
export interface Tool {
  googleSearch?: Record<string, never>;
  type?: string;
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Request options (matches Lovable API format)
 */
export interface GoogleAIRequestOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  tools?: Tool[];
  tool_choice?: unknown;
  modalities?: string[];  // ['text'] or ['image', 'text'] for image generation
}

/**
 * Response format (matches Lovable API format)
 */
export interface GoogleAIResponse {
  choices: {
    message: {
      content: string;
      tool_calls?: {
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }[];
      images?: { image_url: { url: string } }[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * Convert Lovable/OpenAI message format to Google API format
 */
function convertMessages(messages: ChatMessage[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: string; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }[];
} {
  const systemMessage = messages.find(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const contents = nonSystemMessages.map(msg => {
    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];

    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text' && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url' && part.image_url?.url) {
          // Handle base64 images
          const url = part.image_url.url;
          if (url.startsWith('data:')) {
            const matches = url.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              parts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              });
            }
          }
        }
      }
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const result: {
    systemInstruction?: { parts: { text: string }[] };
    contents: typeof contents;
  } = { contents };

  if (systemMessage) {
    const systemText = typeof systemMessage.content === 'string'
      ? systemMessage.content
      : systemMessage.content.map(p => p.text || '').join('\n');
    result.systemInstruction = { parts: [{ text: systemText }] };
  }

  return result;
}

/**
 * Convert Google Search tool to Google API format
 */
function convertTools(tools?: Tool[]): { googleSearch?: Record<string, never> }[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  const googleTools: { googleSearch?: Record<string, never> }[] = [];

  for (const tool of tools) {
    if (tool.googleSearch) {
      googleTools.push({ googleSearch: {} });
    }
  }

  return googleTools.length > 0 ? googleTools : undefined;
}

/**
 * Make a request to Google Cloud Generative Language API
 *
 * This function provides a drop-in replacement for Lovable AI Gateway calls.
 * It accepts the same request format and returns the same response format.
 */
export async function callGoogleAI(
  options: GoogleAIRequestOptions,
  logPrefix = '[GoogleAI]'
): Promise<GoogleAIResponse> {
  const apiKey = getApiKey();
  const googleModel = mapModel(options.model);

  console.log(`${logPrefix} Calling ${googleModel} (mapped from ${options.model})`);

  // Build request body
  const { systemInstruction, contents } = convertMessages(options.messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.max_tokens ?? 8192,
    },
  };

  // Add system instruction if present
  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  // Add JSON response format if requested
  if (options.response_format?.type === 'json_object') {
    (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
  }

  // Add tools (Google Search grounding)
  const googleTools = convertTools(options.tools);
  if (googleTools) {
    body.tools = googleTools;
  }

  // Handle image generation modalities
  if (options.modalities && options.modalities.includes('image')) {
    (body.generationConfig as Record<string, unknown>).responseModalities = ['TEXT', 'IMAGE'];
  }

  const url = `${GOOGLE_API_BASE}/models/${googleModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`${logPrefix} Error ${response.status}:`, errText);
    throw new Error(`Google AI ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Convert Google response to Lovable/OpenAI format
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let textContent = '';
  const images: { image_url: { url: string } }[] = [];

  for (const part of parts) {
    if (part.text) {
      textContent += part.text;
    }
    if (part.inlineData) {
      // Convert to data URL format matching Lovable response
      const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      images.push({ image_url: { url: dataUrl } });
    }
  }

  const usage = data.usageMetadata || {};
  const promptTokens = usage.promptTokenCount || 0;
  const completionTokens = usage.candidatesTokenCount || 0;

  console.log(`${logPrefix} Success: ${textContent.length} chars, ${images.length} images, ${promptTokens + completionTokens} tokens`);

  const result: GoogleAIResponse = {
    choices: [{
      message: {
        content: textContent,
      },
      finish_reason: candidate?.finishReason || 'stop',
    }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
    model: googleModel,
  };

  // Add images if present
  if (images.length > 0) {
    result.choices[0].message.images = images;
  }

  return result;
}

/**
 * Helper function to make a simple text completion call
 * Returns just the content string for convenience
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
  logPrefix = '[GoogleAI]'
): Promise<string> {
  const response = await callGoogleAI({
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
 * Helper function to parse JSON from AI response
 * Handles markdown code blocks if present
 */
export function parseJsonResponse<T>(content: string): T {
  // Try to extract JSON from markdown code block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(jsonStr);
}
