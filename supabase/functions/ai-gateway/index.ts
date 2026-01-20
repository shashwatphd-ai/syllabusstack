// ============================================================================
// AI GATEWAY - Unified Entry Point for All AI Operations
// ============================================================================
//
// PURPOSE: Central routing function for all AI calls with:
//   1. Intelligent provider routing (OpenRouter vs Google Direct)
//   2. Automatic fallbacks on failure
//   3. Unified cost and usage tracking
//   4. Rate limit handling
//
// ROUTES:
//   - text: OpenRouter (primary) → Google Direct (fallback)
//   - image: Google Direct (primary) → OpenRouter (fallback)
//   - function_call: OpenRouter with tools
//   - search: Google Direct only (search grounding not on OpenRouter)
//
// USAGE:
//   POST /ai-gateway
//   {
//     "task": "text" | "image" | "function_call" | "search",
//     "prompt": "...",
//     "system_prompt": "...",
//     "options": { ... }
//   }
//
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import {
  generateText,
  generateImage,
  generateStructured,
  searchGrounded,
  trackAIUsage,
  MODELS,
} from '../_shared/unified-ai-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================

type TaskType = 'text' | 'image' | 'function_call' | 'search' | 'unknown';

interface GatewayRequest {
  task: TaskType;
  prompt: string;
  system_prompt?: string;
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    json?: boolean;
    fallbacks?: string[];
    // For function calls
    schema?: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
    // For images
    slide_title?: string;
    max_retries?: number;
  };
}

interface GatewayResponse {
  success: boolean;
  task: TaskType;
  result?: {
    content?: string;
    data?: unknown;
    base64?: string;
    mimeType?: string;
  };
  metadata?: {
    provider: string;
    model: string;
    latency_ms: number;
    cost_usd?: number;
    fallback_used?: boolean;
  };
  error?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = '[ai-gateway]';
  const startTime = Date.now();

  try {
    // Parse request
    const body: GatewayRequest = await req.json();
    const { task, prompt, system_prompt, options } = body;

    if (!task || !prompt) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: task and prompt',
        } as GatewayResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${functionName} Task: ${task}, Prompt length: ${prompt.length}`);

    // Initialize Supabase for usage tracking
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user ID from auth header if present
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        userId = user?.id || null;
      } catch {
        // Continue without user ID
      }
    }

    let response: GatewayResponse;

    switch (task) {
      // ======================================================================
      // TEXT GENERATION
      // ======================================================================
      case 'text': {
        const result = await generateText({
          prompt,
          systemPrompt: system_prompt,
          model: options?.model,
          temperature: options?.temperature,
          maxTokens: options?.max_tokens,
          json: options?.json,
          fallbacks: options?.fallbacks,
          logPrefix: functionName,
        });

        // Track usage
        if (userId) {
          await trackAIUsage(
            supabase,
            userId,
            'ai-gateway/text',
            result.provider,
            result.model,
            Math.ceil(prompt.length / 4),
            Math.ceil(result.content.length / 4),
            result.cost_usd
          );
        }

        response = {
          success: true,
          task,
          result: { content: result.content },
          metadata: {
            provider: result.provider,
            model: result.model,
            latency_ms: result.latency_ms,
            cost_usd: result.cost_usd,
            fallback_used: result.fallback_used,
          },
        };
        break;
      }

      // ======================================================================
      // IMAGE GENERATION
      // ======================================================================
      case 'image': {
        const result = await generateImage({
          prompt,
          slideTitle: options?.slide_title,
          maxRetries: options?.max_retries,
          useFallback: true,
          logPrefix: functionName,
        });

        if (!result) {
          response = {
            success: false,
            task,
            error: 'Image generation failed after all retries',
          };
          break;
        }

        // Track usage
        if (userId) {
          await trackAIUsage(
            supabase,
            userId,
            'ai-gateway/image',
            result.provider,
            'gemini-3-pro-image-preview',
            0,
            0,
            result.cost_usd
          );
        }

        response = {
          success: true,
          task,
          result: {
            base64: result.base64,
            mimeType: result.mimeType,
            content: result.textResponse,
          },
          metadata: {
            provider: result.provider,
            model: 'gemini-3-pro-image-preview',
            latency_ms: result.latency_ms,
            cost_usd: result.cost_usd,
            fallback_used: result.fallback_used,
          },
        };
        break;
      }

      // ======================================================================
      // FUNCTION CALL (Structured Output)
      // ======================================================================
      case 'function_call': {
        if (!options?.schema) {
          return new Response(
            JSON.stringify({
              success: false,
              task,
              error: 'Function call requires options.schema',
            } as GatewayResponse),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await generateStructured({
          prompt,
          systemPrompt: system_prompt,
          schema: options.schema,
          model: options.model,
          temperature: options.temperature,
          fallbacks: options.fallbacks,
          logPrefix: functionName,
        });

        // Track usage
        if (userId) {
          await trackAIUsage(
            supabase,
            userId,
            'ai-gateway/function_call',
            result.provider,
            result.model
          );
        }

        response = {
          success: true,
          task,
          result: { data: result.data },
          metadata: {
            provider: result.provider,
            model: result.model,
            latency_ms: result.latency_ms,
          },
        };
        break;
      }

      // ======================================================================
      // SEARCH GROUNDING (Google Direct Only)
      // ======================================================================
      case 'search': {
        const result = await searchGrounded({
          query: prompt,
          systemPrompt: system_prompt,
          logPrefix: functionName,
        });

        // Track usage
        if (userId) {
          await trackAIUsage(
            supabase,
            userId,
            'ai-gateway/search',
            result.provider,
            'gemini-2.5-flash'
          );
        }

        response = {
          success: true,
          task,
          result: { data: result },
          metadata: {
            provider: result.provider,
            model: 'gemini-2.5-flash',
            latency_ms: result.latency_ms,
          },
        };
        break;
      }

      default:
        response = {
          success: false,
          task,
          error: `Unknown task type: ${task}. Valid types: text, image, function_call, search`,
        };
    }

    const totalLatency = Date.now() - startTime;
    console.log(`${functionName} Completed in ${totalLatency}ms`);

    return new Response(
      JSON.stringify(response),
      { 
        status: response.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${functionName} Error:`, errorMessage);

    // Handle specific error types
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return new Response(
        JSON.stringify({
          success: false,
          task: 'unknown',
          error: 'Rate limit exceeded. Please try again in a moment.',
        } as GatewayResponse),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (errorMessage.includes('402') || errorMessage.includes('credits')) {
      return new Response(
        JSON.stringify({
          success: false,
          task: 'unknown',
          error: 'AI credits exhausted. Please add credits to continue.',
        } as GatewayResponse),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        task: 'unknown',
        error: errorMessage,
      } as GatewayResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
