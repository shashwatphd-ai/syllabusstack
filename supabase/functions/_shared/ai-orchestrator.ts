// ============================================================================
// AI ORCHESTRATOR - Model Configuration and Utility Functions
// ============================================================================
//
// PURPOSE: Provide model constants and utility functions for AI operations.
//
// NOTE: All AI calls should go through unified-ai-client.ts, NOT this file.
//       This file only exports configuration constants and helper functions.
//
// ROUTING (handled by unified-ai-client.ts):
//   - Text Generation → OpenRouter
//   - Image Generation → OpenRouter
//   - Search Grounding → Google Direct (only option)
//
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

// Task types for model selection (kept for backwards compatibility)
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

// Google Gemini models (used for Vertex AI batch and search grounding)
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

// Vertex AI model paths for batch prediction
export const VERTEX_AI_MODELS = {
  GEMINI_FLASH: 'publishers/google/models/gemini-2.5-flash',
  GEMINI_FLASH_LITE: 'publishers/google/models/gemini-2.5-flash-lite',
  GEMINI_PRO: 'publishers/google/models/gemini-3-pro-preview',
  GEMINI_3_FLASH: 'publishers/google/models/gemini-3-flash-preview',
  GEMINI_IMAGE: 'publishers/google/models/gemini-3-pro-image-preview',
};

// Cost per 1M tokens for each model (USD) - for tracking
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Google models (direct)
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-3-pro-preview': { input: 2.00, output: 12.00 },
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'gemini-3-pro-image-preview': { input: 0.50, output: 3.00 },
  // OpenRouter models
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4.1': { input: 2.00, output: 8.00 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'google/gemini-2.5-flash-image': { input: 0.0003, output: 0.0025 },
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
  'anthropic/claude-3.5-haiku': { input: 0.25, output: 1.25 },
};

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
 * Get Vertex AI model path for batch prediction
 */
export function getVertexAIModelPath(modelId: string): string {
  if (modelId.startsWith('publishers/') || modelId.startsWith('projects/')) {
    return modelId;
  }
  return `publishers/google/models/${modelId}`;
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
