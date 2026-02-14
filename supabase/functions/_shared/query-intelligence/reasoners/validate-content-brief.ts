/**
 * Shared validation and normalization for ContentBrief responses.
 * Used by both the content-role-reasoner (fallback) and student-search-agent (primary).
 */

import type { ContentBrief } from '../types.ts';

/**
 * Validate and normalize a parsed ContentBrief from any reasoner.
 * Ensures core_explainer is present, caps roles at 5, caps queries at 3 per role.
 *
 * @param parsed - The raw parsed JSON response
 * @param fallbackConcept - Concept string used to generate fallback core_explainer queries
 * @returns Validated ContentBrief or null if structure is invalid
 */
export function validateContentBrief(
  parsed: any,
  fallbackConcept: string
): ContentBrief | null {
  if (!parsed?.roles || !Array.isArray(parsed.roles) || parsed.roles.length === 0) {
    return null;
  }

  // Ensure core_explainer is always first
  const hasExplainer = parsed.roles.some((r: any) => r.role === 'core_explainer');
  if (!hasExplainer) {
    parsed.roles.unshift({
      role: 'core_explainer',
      description: 'Direct tutorial or lecture on the concept',
      target_content_types: ['tutorial', 'lecture'],
      suggested_queries: [`${fallbackConcept} explained`, `${fallbackConcept} tutorial`],
      duration_flexibility: 'strict',
    });
  }

  // Cap at 5 roles
  parsed.roles = parsed.roles.slice(0, 5);

  // Validate each role has suggested_queries
  for (const role of parsed.roles) {
    if (!role.suggested_queries || !Array.isArray(role.suggested_queries)) {
      role.suggested_queries = [];
    }
    // Cap queries per role
    role.suggested_queries = role.suggested_queries.slice(0, 3);
  }

  if (!parsed.real_world_connections || !Array.isArray(parsed.real_world_connections)) {
    parsed.real_world_connections = [];
  }

  return parsed as ContentBrief;
}
