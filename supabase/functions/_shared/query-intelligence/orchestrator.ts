/**
 * Query Intelligence Orchestrator
 *
 * Dependency Inversion: Depends on abstractions (interfaces), not concretions
 * Single Responsibility: Coordinates the query generation pipeline
 *
 * This orchestrator:
 * 1. (NEW) Calls content-role-reasoner for creative role-based queries
 * 2. Receives syllabus-extracted learning objective data
 * 3. Extracts additional concepts from the text
 * 4. Expands terms with synonyms/variations
 * 5. Builds diverse search queries
 * 6. Ranks and deduplicates results
 *
 * ALL TERMS ORIGINATE FROM THE INSTRUCTOR'S SYLLABUS
 */

import {
  IQueryIntelligenceOrchestrator,
  ITermExpander,
  IQueryBuilder,
  QueryGenerationContext,
  GeneratedQuery,
  QueryIntelligenceConfig,
  DEFAULT_CONFIG,
  ExpandedTerms,
  ContentBrief,
} from './types.ts';

import { ConceptExtractor, ModuleContextExtractor } from './extractors/concept-extractor.ts';
import { createDefaultExpander } from './expanders/base-expander.ts';
import { createDefaultBuilders } from './builders/query-builders.ts';
import { RoleAwareBuilder } from './builders/role-aware-builder.ts';
import { generateContentBrief } from './reasoners/content-role-reasoner.ts';

/**
 * Main orchestrator implementation
 */
export class QueryIntelligenceOrchestrator implements IQueryIntelligenceOrchestrator {
  private expanders: ITermExpander[] = [];
  private builders: IQueryBuilder[] = [];
  private config: QueryIntelligenceConfig;
  private conceptExtractor: ConceptExtractor;
  private moduleExtractor: ModuleContextExtractor;
  private roleAwareBuilder: RoleAwareBuilder;

  constructor(config: Partial<QueryIntelligenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.conceptExtractor = new ConceptExtractor();
    this.moduleExtractor = new ModuleContextExtractor();

    // Initialize with defaults
    this.expanders.push(createDefaultExpander());
    this.builders = createDefaultBuilders();

    // Add role-aware builder (highest priority)
    this.roleAwareBuilder = new RoleAwareBuilder();
    this.builders.push(this.roleAwareBuilder);
    this.builders.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Register additional term expander
   */
  registerExpander(expander: ITermExpander): void {
    this.expanders.push(expander);
  }

  /**
   * Register additional query builder
   */
  registerBuilder(builder: IQueryBuilder): void {
    this.builders.push(builder);
    this.builders.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Main query generation method
   */
  async generateQueries(context: QueryGenerationContext): Promise<GeneratedQuery[]> {
    const startTime = Date.now();
    const lo = context.learningObjective;

    console.log(`[QueryIntelligence] Generating queries for: "${lo.core_concept}" (${lo.bloom_level})`);

    // Step 0: Content Role Reasoning (NEW — LLM creative reasoning)
    let contentBrief: ContentBrief | null = null;
    try {
      contentBrief = await generateContentBrief(context);
      if (contentBrief) {
        this.roleAwareBuilder.setContentBrief(contentBrief);
        console.log(`[QueryIntelligence] Content brief: ${contentBrief.roles.map(r => r.role).join(', ')}`);
      }
    } catch (e) {
      console.log('[QueryIntelligence] Content role reasoning failed (using fallback):', e);
    }

    // Step 1: Extract additional concepts from LO text
    const extractedConcepts = this.conceptExtractor.extract(lo.text, context);

    // Step 2: Collect all terms to expand
    const termsToExpand = this.collectTermsToExpand(context, extractedConcepts);

    // Step 3: Expand terms with synonyms/variations
    const expandedTerms = await this.expandTerms(termsToExpand, lo.domain);

    // Step 4: Build queries from all builders
    const allQueries = this.buildQueries(context, expandedTerms);
    console.log(`[QueryIntelligence] Generated ${allQueries.length} raw queries`);

    // Step 5: Deduplicate and rank
    const rankedQueries = this.deduplicateAndRank(allQueries);

    // Step 6: Apply diversity filter with role awareness
    const finalQueries = this.applyDiversityAndLimit(rankedQueries, contentBrief);

    const elapsed = Date.now() - startTime;
    console.log(`[QueryIntelligence] Final: ${finalQueries.length} queries in ${elapsed}ms`);

    return finalQueries;
  }

  /**
   * Get the last generated content brief (for downstream use)
   */
  getLastContentBrief(): ContentBrief | null {
    return this.roleAwareBuilder['contentBrief'] || null;
  }

  private collectTermsToExpand(
    context: QueryGenerationContext,
    extractedConcepts: { primaryConcept: string; secondaryConcepts: string[]; impliedConcepts: string[] }
  ): string[] {
    const terms: string[] = [];
    const lo = context.learningObjective;

    if (lo.core_concept) terms.push(lo.core_concept);
    terms.push(...lo.search_keywords);

    if (extractedConcepts.primaryConcept !== lo.core_concept) {
      terms.push(extractedConcepts.primaryConcept);
    }
    terms.push(...extractedConcepts.secondaryConcepts.slice(0, 2));

    if (context.module) {
      const moduleTerms = this.moduleExtractor.extractFromModule(context.module);
      terms.push(...moduleTerms.slice(0, 2));
    }

    return [...new Set(terms.map(t => t.toLowerCase()))].slice(0, 8);
  }

  private async expandTerms(terms: string[], domain: string): Promise<ExpandedTerms[]> {
    const results: ExpandedTerms[] = [];

    for (const term of terms) {
      for (const expander of this.expanders) {
        try {
          if (await expander.isAvailable()) {
            const expanded = await expander.expand(term, domain as any);
            if (expanded.synonyms.length > 0 || expanded.variations.length > 0) {
              results.push(expanded);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!results.some(r => r.original.toLowerCase() === term.toLowerCase())) {
        results.push({
          original: term,
          synonyms: [],
          variations: [],
          relatedTerms: [],
        });
      }
    }

    return results;
  }

  private buildQueries(context: QueryGenerationContext, expandedTerms: ExpandedTerms[]): GeneratedQuery[] {
    const allQueries: GeneratedQuery[] = [];

    for (const builder of this.builders) {
      try {
        const queries = builder.build(context, expandedTerms);
        allQueries.push(...queries);
      } catch (e) {
        console.log(`[QueryIntelligence] Builder ${builder.name} failed:`, e);
        continue;
      }
    }

    return allQueries;
  }

  private deduplicateAndRank(queries: GeneratedQuery[]): GeneratedQuery[] {
    const seen = new Map<string, GeneratedQuery>();

    for (const query of queries) {
      const normalized = this.normalizeQuery(query.query);

      if (!seen.has(normalized)) {
        seen.set(normalized, query);
      } else {
        const existing = seen.get(normalized)!;
        if (query.priority > existing.priority) {
          seen.set(normalized, query);
        }
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.priority - a.priority);
  }

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Apply diversity filter with role awareness
   * Ensures at least 1 query per role (up to first 5 roles), then fills remaining
   */
  private applyDiversityAndLimit(queries: GeneratedQuery[], brief: ContentBrief | null): GeneratedQuery[] {
    const result: GeneratedQuery[] = [];
    const usedSources = new Map<string, number>();
    const filledRoles = new Set<string>();

    if (brief) {
      // Pass 1: Best query per role (ensure role diversity)
      for (const role of brief.roles) {
        const roleQuery = queries.find(q =>
          q.content_role === role.role && !result.includes(q)
        );
        if (roleQuery) {
          result.push(roleQuery);
          filledRoles.add(role.role);
          usedSources.set(roleQuery.source, (usedSources.get(roleQuery.source) || 0) + 1);
        }
      }
    }

    // Pass 2: Fill remaining slots
    for (const query of queries) {
      if (result.length >= this.config.maxQueries) break;
      if (result.includes(query)) continue;

      const sourceCount = usedSources.get(query.source) || 0;
      if (sourceCount >= 4) continue;

      result.push(query);
      usedSources.set(query.source, sourceCount + 1);
    }

    return result;
  }
}

/**
 * Create a configured orchestrator instance
 */
export function createQueryIntelligence(config?: Partial<QueryIntelligenceConfig>): QueryIntelligenceOrchestrator {
  return new QueryIntelligenceOrchestrator(config);
}

/**
 * Simplified function for direct use in edge functions
 * Returns just query strings for backward compatibility
 */
export async function generateSearchQueries(
  learningObjective: {
    id: string;
    text: string;
    core_concept: string;
    action_verb?: string;
    bloom_level: string;
    domain: string;
    specificity?: string;
    search_keywords: string[];
    expected_duration_minutes: number;
  },
  module?: { title: string; description?: string; sequence_order?: number },
  course?: { title: string; description?: string; code?: string }
): Promise<string[]> {
  const orchestrator = createQueryIntelligence();

  const context: QueryGenerationContext = {
    learningObjective: {
      id: learningObjective.id,
      text: learningObjective.text,
      core_concept: learningObjective.core_concept,
      action_verb: learningObjective.action_verb || 'understand',
      bloom_level: (learningObjective.bloom_level || 'understand') as any,
      domain: (learningObjective.domain || 'other') as any,
      specificity: (learningObjective.specificity || 'intermediate') as any,
      search_keywords: learningObjective.search_keywords || [],
      expected_duration_minutes: learningObjective.expected_duration_minutes || 15,
    },
    module: module ? {
      title: module.title,
      description: module.description,
      sequence_order: module.sequence_order || 0,
    } : undefined,
    course: course ? {
      title: course.title,
      description: course.description,
      code: course.code,
    } : undefined,
  };

  const queries = await orchestrator.generateQueries(context);
  return queries.map(q => q.query);
}

/**
 * Enhanced version that also returns the ContentBrief and role-tagged queries
 * Used by search-youtube-content for role-aware scoring
 */
export async function generateSearchQueriesWithBrief(
  learningObjective: {
    id: string;
    text: string;
    core_concept: string;
    action_verb?: string;
    bloom_level: string;
    domain: string;
    specificity?: string;
    search_keywords: string[];
    expected_duration_minutes: number;
  },
  module?: { title: string; description?: string; sequence_order?: number },
  course?: { title: string; description?: string; code?: string }
): Promise<{ queries: GeneratedQuery[]; contentBrief: ContentBrief | null }> {
  const orchestrator = createQueryIntelligence();

  const context: QueryGenerationContext = {
    learningObjective: {
      id: learningObjective.id,
      text: learningObjective.text,
      core_concept: learningObjective.core_concept,
      action_verb: learningObjective.action_verb || 'understand',
      bloom_level: (learningObjective.bloom_level || 'understand') as any,
      domain: (learningObjective.domain || 'other') as any,
      specificity: (learningObjective.specificity || 'intermediate') as any,
      search_keywords: learningObjective.search_keywords || [],
      expected_duration_minutes: learningObjective.expected_duration_minutes || 15,
    },
    module: module ? {
      title: module.title,
      description: module.description,
      sequence_order: module.sequence_order || 0,
    } : undefined,
    course: course ? {
      title: course.title,
      description: course.description,
      code: course.code,
    } : undefined,
  };

  const queries = await orchestrator.generateQueries(context);
  const contentBrief = orchestrator.getLastContentBrief();

  return { queries, contentBrief };
}

/**
 * Simplified function for direct use in edge functions
 *
 * @param learningObjective - The LO from syllabus extraction
 * @param module - Optional module context
 * @param course - Optional course context
 * @returns Array of search query strings
 */
export async function generateSearchQueries(
  learningObjective: {
    id: string;
    text: string;
    core_concept: string;
    action_verb?: string;
    bloom_level: string;
    domain: string;
    specificity?: string;
    search_keywords: string[];
    expected_duration_minutes: number;
  },
  module?: { title: string; description?: string; sequence_order?: number },
  course?: { title: string; description?: string; code?: string }
): Promise<string[]> {
  const result = await generateSearchQueriesWithBrief(learningObjective, module, course);
  return result.queries.map(q => q.query);
}

/**
 * Full query generation that also returns the ContentBrief and GeneratedQuery objects.
 * Used by search-youtube-content for role-aware pipeline.
 */
export async function generateSearchQueriesWithBrief(
  learningObjective: {
    id: string;
    text: string;
    core_concept: string;
    action_verb?: string;
    bloom_level: string;
    domain: string;
    specificity?: string;
    search_keywords: string[];
    expected_duration_minutes: number;
  },
  module?: { title: string; description?: string; sequence_order?: number },
  course?: { title: string; description?: string; code?: string }
): Promise<QueryGenerationResult> {
  const orchestrator = new QueryIntelligenceOrchestrator();

  const context: QueryGenerationContext = {
    learningObjective: {
      id: learningObjective.id,
      text: learningObjective.text,
      core_concept: learningObjective.core_concept,
      action_verb: learningObjective.action_verb || 'understand',
      bloom_level: (learningObjective.bloom_level || 'understand') as any,
      domain: (learningObjective.domain || 'other') as any,
      specificity: (learningObjective.specificity || 'intermediate') as any,
      search_keywords: learningObjective.search_keywords || [],
      expected_duration_minutes: learningObjective.expected_duration_minutes || 15,
    },
    module: module ? {
      title: module.title,
      description: module.description,
      sequence_order: module.sequence_order || 0,
    } : undefined,
    course: course ? {
      title: course.title,
      description: course.description,
      code: course.code,
    } : undefined,
  };

  const queries = await orchestrator.generateQueries(context);

  return {
    queries,
    contentBrief: orchestrator.getContentBrief(),
  };
}
