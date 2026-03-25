/**
 * Embedding Client for Skill Matching
 *
 * Uses Gemini Text Embedding 004 via OpenRouter for generating
 * vector embeddings. Provides cosine similarity computation
 * and caching in skill_embeddings table.
 *
 * USAGE:
 *   import { generateEmbedding, cosineSimilarity, getCachedOrGenerate } from '../_shared/embedding-client.ts';
 *
 *   const vec = await generateEmbedding('Python web development with Flask');
 *   const score = cosineSimilarity(vecA, vecB);
 *   const cached = await getCachedOrGenerate(supabase, 'skill', 'python', 'Python programming');
 */

import { callOpenRouter } from './openrouter-client.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export type Embedding = number[];

export interface EmbeddingResult {
  embedding: Embedding;
  model: string;
  cached: boolean;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

const EMBEDDING_MODEL = 'google/text-embedding-004';
const EMBEDDING_DIMENSIONS = 768;

/**
 * Generate a single text embedding via OpenRouter.
 * Falls back to a simple TF-IDF-like hash if API unavailable.
 */
export async function generateEmbedding(text: string): Promise<Embedding> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not set, using fallback hash embedding');
    return hashEmbedding(text);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://syllabusstack.com',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Embedding API error (${response.status}): ${errorText}`);
      return hashEmbedding(text);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      console.error('Invalid embedding response, using fallback');
      return hashEmbedding(text);
    }

    return embedding;
  } catch (err) {
    console.error('Embedding generation failed, using fallback:', err);
    return hashEmbedding(text);
  }
}

/**
 * Generate embeddings for multiple texts in a single batch call.
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<Embedding[]> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    return texts.map(hashEmbedding);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://syllabusstack.com',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      return texts.map(hashEmbedding);
    }

    const data = await response.json();
    return (data.data || [])
      .sort((a: any, b: any) => a.index - b.index)
      .map((item: any) => item.embedding || hashEmbedding(texts[item.index]));
  } catch (err) {
    console.error('Batch embedding failed, using fallback:', err);
    return texts.map(hashEmbedding);
  }
}

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal).
 */
export function cosineSimilarity(a: Embedding, b: Embedding): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Find top-N most similar items from a list of candidates.
 */
export function findTopMatches(
  queryEmbedding: Embedding,
  candidates: Array<{ id: string; embedding: Embedding; metadata?: any }>,
  topN: number = 10
): Array<{ id: string; score: number; metadata?: any }> {
  const scored = candidates.map(candidate => ({
    id: candidate.id,
    score: cosineSimilarity(queryEmbedding, candidate.embedding),
    metadata: candidate.metadata,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// ============================================================================
// CACHING
// ============================================================================

/**
 * Get a cached embedding or generate + cache a new one.
 */
export async function getCachedOrGenerate(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  text: string
): Promise<EmbeddingResult> {
  // Check cache
  const { data: cached } = await supabase
    .from('skill_embeddings')
    .select('embedding, embedding_model')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('embedding_model', 'text-embedding-004')
    .single();

  if (cached?.embedding) {
    return {
      embedding: cached.embedding as Embedding,
      model: cached.embedding_model,
      cached: true,
    };
  }

  // Generate new embedding
  const embedding = await generateEmbedding(text);

  // Cache it (fire-and-forget)
  supabase
    .from('skill_embeddings')
    .upsert({
      entity_type: entityType,
      entity_id: entityId,
      embedding_model: 'text-embedding-004',
      embedding,
      metadata: { text_preview: text.slice(0, 200) },
    }, { onConflict: 'entity_type,entity_id,embedding_model' })
    .then(() => {})
    .then(() => {}, (err: any) => console.warn('Failed to cache embedding:', err));

  return {
    embedding,
    model: EMBEDDING_MODEL,
    cached: false,
  };
}

// ============================================================================
// FALLBACK: Hash-based pseudo-embedding
// ============================================================================

/**
 * Deterministic pseudo-embedding for when the API is unavailable.
 * Uses character-level hashing to produce consistent vectors.
 * NOT suitable for production matching — only for graceful degradation.
 */
function hashEmbedding(text: string): Embedding {
  const normalized = text.toLowerCase().trim();
  const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0);

  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = (charCode * 31 + i * 7) % EMBEDDING_DIMENSIONS;
    embedding[idx] += 1.0 / (1 + Math.floor(i / 10));
  }

  // L2 normalize
  const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}
