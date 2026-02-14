/**
 * Role-Aware Query Builder
 *
 * Builds search queries from a ContentBrief, where each query is tagged
 * with the content role it serves (core_explainer, curiosity_spark, etc.).
 *
 * Priority 11 (highest) — these queries come from LLM reasoning about
 * what makes the topic interesting, not just keyword variations.
 */

import {
  IQueryBuilder,
  QueryGenerationContext,
  ExpandedTerms,
  GeneratedQuery,
  ContentBrief,
} from '../types.ts';

/**
 * Builds queries from LLM-generated ContentBrief
 * Each query is tagged with its content_role for downstream scoring
 */
export class RoleAwareBuilder implements IQueryBuilder {
  readonly name = 'role_aware';
  readonly priority = 11; // Highest priority

  private contentBrief: ContentBrief | null = null;

  /**
   * Set the content brief before building queries
   */
  setContentBrief(brief: ContentBrief | null): void {
    this.contentBrief = brief;
  }

  build(context: QueryGenerationContext, _expandedTerms: ExpandedTerms[]): GeneratedQuery[] {
    if (!this.contentBrief || !this.contentBrief.roles) {
      return []; // No brief available — other builders will handle it
    }

    const queries: GeneratedQuery[] = [];

    for (const role of this.contentBrief.roles) {
      if (!role.suggested_queries) continue;

      for (let i = 0; i < role.suggested_queries.length; i++) {
        const query = role.suggested_queries[i];
        if (!query || query.trim().length === 0) continue;

        queries.push({
          query: query.trim(),
          source: 'role_reasoning',
          // First query per role gets highest priority, subsequent get slightly lower
          priority: role.role === 'core_explainer' ? 11 : (10 - i),
          expectedType: this.getExpectedType(role.role),
          derivedFrom: `role:${role.role}`,
          content_role: role.role,
        });
      }
    }

    // Also add queries from real_world_connections if available
    if (this.contentBrief.real_world_connections) {
      for (const connection of this.contentBrief.real_world_connections.slice(0, 2)) {
        if (!connection || connection.trim().length === 0) continue;
        queries.push({
          query: connection.trim(),
          source: 'role_reasoning',
          priority: 6,
          expectedType: 'case_study',
          derivedFrom: 'role:real_world_case',
          content_role: 'real_world_case',
        });
      }
    }

    return queries;
  }

  private getExpectedType(role: string): GeneratedQuery['expectedType'] {
    switch (role) {
      case 'core_explainer': return 'tutorial';
      case 'curiosity_spark': return 'explanation';
      case 'real_world_case': return 'case_study';
      case 'practitioner_perspective': return 'discussion';
      case 'debate_or_analysis': return 'discussion';
      case 'adjacent_insight': return 'explanation';
      default: return 'explanation';
    }
  }
}
