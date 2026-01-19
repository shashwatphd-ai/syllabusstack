// ============================================================================
// MULTI-PROVIDER AI CLIENT
// ============================================================================
//
// Provides fallback routing between providers:
// 1. Google Gemini (primary - for grounding/search features)
// 2. OpenAI (fallback - better JSON reliability)
// 3. DeepSeek (budget fallback - 90% cheaper)
//
// Usage:
//   import { callMultiProvider, PROVIDERS } from '../_shared/multi-provider-client.ts';
//   const result = await callMultiProvider({ messages, jsonMode: true });
//
// ============================================================================

// Provider configurations
export const PROVIDERS = {
  GOOGLE: 'google',
  OPENAI: 'openai',
  DEEPSEEK: 'deepseek',
} as const;

type Provider = typeof PROVIDERS[keyof typeof PROVIDERS];

// Model mappings per provider
export const PROVIDER_MODELS = {
  [PROVIDERS.GOOGLE]: {
    fast: 'gemini-2.5-flash',
    reasoning: 'gemini-2.5-pro',
    image: 'gemini-3-pro-image-preview',
  },
  [PROVIDERS.OPENAI]: {
    fast: 'gpt-4o-mini',
    reasoning: 'gpt-4.1-mini',
    image: 'dall-e-3',
  },
  [PROVIDERS.DEEPSEEK]: {
    fast: 'deepseek-chat',
    reasoning: 'deepseek-chat',
    image: null, // No image support
  },
} as const;

// Cost per 1M tokens (USD)
export const PROVIDER_COSTS = {
  [PROVIDERS.GOOGLE]: {
    'gemini-2.5-flash': { input: 0.15, output: 0.60 },
    'gemini-2.5-pro': { input: 1.25, output: 5.00 },
    'gemini-3-pro-image-preview': { input: 0.50, output: 3.00 },
  },
  [PROVIDERS.OPENAI]: {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 },
    'gpt-4.1': { input: 2.00, output: 8.00 },
  },
  [PROVIDERS.DEEPSEEK]: {
    'deepseek-chat': { input: 0.27, output: 1.10 },
  },
};

// Provider fallback order for different task types
export const TASK_PROVIDER_PRIORITY = {
  // Research needs Google (has grounding/search)
  research: [PROVIDERS.GOOGLE],
  // JSON tasks prefer OpenAI (better structured output)
  curriculum: [PROVIDERS.OPENAI, PROVIDERS.GOOGLE, PROVIDERS.DEEPSEEK],
  evaluation: [PROVIDERS.OPENAI, PROVIDERS.GOOGLE, PROVIDERS.DEEPSEEK],
  slides: [PROVIDERS.OPENAI, PROVIDERS.GOOGLE, PROVIDERS.DEEPSEEK],
  // Default
  default: [PROVIDERS.GOOGLE, PROVIDERS.OPENAI, PROVIDERS.DEEPSEEK],
} as const;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MultiProviderRequest {
  messages: Message[];
  taskType?: keyof typeof TASK_PROVIDER_PRIORITY;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  preferredProvider?: Provider;
  modelTier?: 'fast' | 'reasoning';
}

interface MultiProviderResponse {
  content: string;
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  fallbacksUsed: number;
}

// ============================================================================
// PROVIDER IMPLEMENTATIONS
// ============================================================================

async function callGoogleGemini(
  messages: Message[],
  model: string,
  options: { jsonMode?: boolean; temperature?: number; maxTokens?: number }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_CLOUD_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Combine messages into Gemini format
  const systemContent = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const userContent = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n');

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: `${systemContent}\n\n${userContent}` }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 8192,
    },
  };

  if (options.jsonMode) {
    body.generationConfig = {
      ...(body.generationConfig as Record<string, unknown>),
      responseMimeType: 'application/json',
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};

  return {
    content,
    inputTokens: usage.promptTokenCount || Math.ceil((systemContent + userContent).length / 4),
    outputTokens: usage.candidatesTokenCount || Math.ceil(content.length / 4),
  };
}

async function callOpenAI(
  messages: Message[],
  model: string,
  options: { jsonMode?: boolean; temperature?: number; maxTokens?: number }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const url = 'https://api.openai.com/v1/chat/completions';

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 8192,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const usage = data.usage || {};

  return {
    content,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
  };
}

async function callDeepSeek(
  messages: Message[],
  model: string,
  options: { jsonMode?: boolean; temperature?: number; maxTokens?: number }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const url = 'https://api.deepseek.com/v1/chat/completions';

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 8192,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const usage = data.usage || {};

  return {
    content,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
  };
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

function getProviderModel(provider: Provider, tier: 'fast' | 'reasoning'): string {
  return PROVIDER_MODELS[provider]?.[tier] || PROVIDER_MODELS[PROVIDERS.GOOGLE].fast;
}

function calculateCost(provider: Provider, model: string, inputTokens: number, outputTokens: number): number {
  const costs = PROVIDER_COSTS[provider]?.[model as keyof (typeof PROVIDER_COSTS)[typeof provider]];
  if (!costs) return 0;
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
}

function isProviderConfigured(provider: Provider): boolean {
  switch (provider) {
    case PROVIDERS.GOOGLE:
      return !!Deno.env.get('GOOGLE_CLOUD_API_KEY');
    case PROVIDERS.OPENAI:
      return !!Deno.env.get('OPENAI_API_KEY');
    case PROVIDERS.DEEPSEEK:
      return !!Deno.env.get('DEEPSEEK_API_KEY');
    default:
      return false;
  }
}

/**
 * Call AI with automatic provider fallback
 */
export async function callMultiProvider(request: MultiProviderRequest): Promise<MultiProviderResponse> {
  const {
    messages,
    taskType = 'default',
    jsonMode = false,
    temperature = 0.7,
    maxTokens = 8192,
    preferredProvider,
    modelTier = 'fast',
  } = request;

  // Get provider priority for this task
  let providers = TASK_PROVIDER_PRIORITY[taskType] || TASK_PROVIDER_PRIORITY.default;

  // If preferred provider specified and configured, put it first
  if (preferredProvider && isProviderConfigured(preferredProvider)) {
    providers = [preferredProvider, ...providers.filter(p => p !== preferredProvider)];
  }

  // Filter to only configured providers
  const configuredProviders = providers.filter(isProviderConfigured);

  if (configuredProviders.length === 0) {
    throw new Error('No AI providers configured. Set GOOGLE_CLOUD_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY.');
  }

  const options = { jsonMode, temperature, maxTokens };
  let lastError: Error | null = null;
  let fallbacksUsed = 0;

  for (const provider of configuredProviders) {
    const model = getProviderModel(provider, modelTier);
    console.log(`[MultiProvider] Trying ${provider} with model ${model}`);

    try {
      let result: { content: string; inputTokens: number; outputTokens: number };

      switch (provider) {
        case PROVIDERS.GOOGLE:
          result = await callGoogleGemini(messages, model, options);
          break;
        case PROVIDERS.OPENAI:
          result = await callOpenAI(messages, model, options);
          break;
        case PROVIDERS.DEEPSEEK:
          result = await callDeepSeek(messages, model, options);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      const costUsd = calculateCost(provider, model, result.inputTokens, result.outputTokens);

      console.log(`[MultiProvider] Success: provider=${provider}, model=${model}, tokens=${result.inputTokens}/${result.outputTokens}, cost=$${costUsd.toFixed(6)}, fallbacks=${fallbacksUsed}`);

      return {
        content: result.content,
        provider,
        model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd,
        fallbacksUsed,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[MultiProvider] ${provider} failed: ${lastError.message}`);
      fallbacksUsed++;

      // Don't fallback on certain errors
      if (lastError.message.includes('API key') || lastError.message.includes('not configured')) {
        continue; // Try next provider
      }
      if (lastError.message.includes('429') || lastError.message.includes('rate limit')) {
        continue; // Try next provider
      }
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError?.message}`);
}

/**
 * Check which providers are available
 */
export function getAvailableProviders(): Provider[] {
  return Object.values(PROVIDERS).filter(isProviderConfigured);
}

/**
 * Get recommended provider for a task
 */
export function getRecommendedProvider(taskType: keyof typeof TASK_PROVIDER_PRIORITY): Provider {
  const providers = TASK_PROVIDER_PRIORITY[taskType] || TASK_PROVIDER_PRIORITY.default;
  const configured = providers.filter(isProviderConfigured);
  return configured[0] || PROVIDERS.GOOGLE;
}
