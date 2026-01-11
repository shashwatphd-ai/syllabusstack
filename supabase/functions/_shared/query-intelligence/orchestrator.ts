/**
 * Query Intelligence Orchestrator
 *
 * Dependency Inversion: Depends on abstractions (interfaces), not concretions
 * Single Responsibility: Coordinates the query generation pipeline
 *
 * This orchestrator:
 * 1. Receives syllabus-extracted learning objective data
 * 2. Extracts additional concepts from the text
 * 3. Expands terms with synonyms/variations
 * 4. Builds diverse search queries
 * 5. Ranks and deduplicates results
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
} from './types.ts';

import { ConceptExtractor, ModuleContextExtractor } from './extractors/concept-extractor.ts';
import { createDefaultExpander } from './expanders/base-expander.ts';
import { createDefaultBuilders } from './builders/query-builders.ts';

/**
 * Main orchestrator implementation
 */
export class QueryIntelligenceOrchestrator implements IQueryIntelligenceOrchestrator {
  private expanders: ITermExpander[] = [];
  private builders: IQueryBuilder[] = [];
  private config: QueryIntelligenceConfig;
  private conceptExtractor: ConceptExtractor;
  private moduleExtractor: ModuleContextExtractor;

  constructor(config: Partial<QueryIntelligenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.conceptExtractor = new ConceptExtractor();
    this.moduleExtractor = new ModuleContextExtractor();

    // Initialize with defaults
    this.expanders.push(createDefaultExpander());
    this.builders = createDefaultBuilders();
  }

  /**
   * Register additional term expander
   * Open/Closed: Can add new expanders without modifying existing code
   */
  registerExpander(expander: ITermExpander): void {
    this.expanders.push(expander);
  }

  /**
   * Register additional query builder
   * Open/Closed: Can add new builders without modifying existing code
   */
  registerBuilder(builder: IQueryBuilder): void {
    this.builders.push(builder);
    // Keep builders sorted by priority (highest first)
    this.builders.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Main query generation method
   *
   * @param context - Learning objective and context FROM THE SYLLABUS
   * @returns Ranked list of search queries
   */
  async generateQueries(context: QueryGenerationContext): Promise<GeneratedQuery[]> {
    const startTime = Date.now();
    const lo = context.learningObjective;

    console.log(`[QueryIntelligence] Generating queries for: "${lo.core_concept}" (${lo.bloom_level})`);

    // Step 1: Extract additional concepts from LO text
    const extractedConcepts = this.conceptExtractor.extract(lo.text, context);
    console.log(`[QueryIntelligence] Extracted concepts:`, extractedConcepts.primaryConcept);

    // Step 2: Collect all terms to expand (from syllabus extraction)
    const termsToExpand = this.collectTermsToExpand(context, extractedConcepts);
    console.log(`[QueryIntelligence] Terms to expand: ${termsToExpand.length}`);

    // Step 3: Expand terms with synonyms/variations
    const expandedTerms = await this.expandTerms(termsToExpand, lo.domain);
    console.log(`[QueryIntelligence] Expanded ${expandedTerms.length} terms`);

    // Step 4: Build queries from all builders
    const allQueries = this.buildQueries(context, expandedTerms);
    console.log(`[QueryIntelligence] Generated ${allQueries.length} raw queries`);

    // Step 5: Deduplicate and rank
    const rankedQueries = this.deduplicateAndRank(allQueries);
    console.log(`[QueryIntelligence] After dedup: ${rankedQueries.length} queries`);

    // Step 6: Apply diversity filter and limit
    const finalQueries = this.applyDiversityAndLimit(rankedQueries);

    const elapsed = Date.now() - startTime;
    console.log(`[QueryIntelligence] Final: ${finalQueries.length} queries in ${elapsed}ms`);

    return finalQueries;
  }

  /**
   * Collect all terms that should be expanded
   * These all come from the syllabus extraction
   */
  private collectTermsToExpand(
    context: QueryGenerationContext,
    extractedConcepts: { primaryConcept: string; secondaryConcepts: string[]; impliedConcepts: string[] }
  ): string[] {
    const terms: string[] = [];
    const lo = context.learningObjective;

    // From syllabus LO extraction
    if (lo.core_concept) {
      terms.push(lo.core_concept);
    }

    // From syllabus search_keywords
    terms.push(...lo.search_keywords);

    // From text analysis of syllabus LO
    if (extractedConcepts.primaryConcept !== lo.core_concept) {
      terms.push(extractedConcepts.primaryConcept);
    }
    terms.push(...extractedConcepts.secondaryConcepts.slice(0, 2));

    // From module context (syllabus structure)
    if (context.module) {
      const moduleTerms = this.moduleExtractor.extractFromModule(context.module);
      terms.push(...moduleTerms.slice(0, 2));
    }

    // Deduplicate
    return [...new Set(terms.map(t => t.toLowerCase()))].slice(0, 8);
  }

  /**
   * Expand all terms using registered expanders
   */
  private async expandTerms(terms: string[], domain: string): Promise<ExpandedTerms[]> {
    const results: ExpandedTerms[] = [];

    for (const term of terms) {
      // Try each expander
      for (const expander of this.expanders) {
        try {
          if (await expander.isAvailable()) {
            const expanded = await expander.expand(term, domain as any);
            if (expanded.synonyms.length > 0 || expanded.variations.length > 0) {
              results.push(expanded);
              break; // Use first successful expansion
            }
          }
        } catch (e) {
          console.log(`[QueryIntelligence] Expander ${expander.name} failed for "${term}":`, e);
          continue;
        }
      }

      // If no expansion, add empty result to preserve original term
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

  /**
   * Build queries using all registered builders
   */
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

  /**
   * Deduplicate queries and rank by priority
   */
  private deduplicateAndRank(queries: GeneratedQuery[]): GeneratedQuery[] {
    const seen = new Map<string, GeneratedQuery>();

    for (const query of queries) {
      const normalized = this.normalizeQuery(query.query);

      if (!seen.has(normalized)) {
        seen.set(normalized, query);
      } else {
        // Keep the higher priority version
        const existing = seen.get(normalized)!;
        if (query.priority > existing.priority) {
          seen.set(normalized, query);
        }
      }
    }

    // Sort by priority (highest first)
    return Array.from(seen.values())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Normalize query for deduplication
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Apply diversity filter and limit results
   */
  private applyDiversityAndLimit(queries: GeneratedQuery[]): GeneratedQuery[] {
    const result: GeneratedQuery[] = [];
    const usedSources = new Map<string, number>();
    const usedDerivations = new Set<string>();

    for (const query of queries) {
      if (result.length >= this.config.maxQueries) break;

      // Ensure source diversity
      const sourceCount = usedSources.get(query.source) || 0;
      if (sourceCount >= 3) continue; // Max 3 queries per source

      // Ensure term diversity
      const derivedLower = query.derivedFrom.toLowerCase();
      const similarExists = Array.from(usedDerivations).some(d =>
        d.includes(derivedLower) || derivedLower.includes(d)
      );

      if (similarExists && result.length >= 6) {
        // Allow some repetition for top 6, then enforce diversity
        continue;
      }

      result.push(query);
      usedSources.set(query.source, sourceCount + 1);
      usedDerivations.add(derivedLower);
    }

    return result;
  }
}

/**
 * Create a configured orchestrator instance
 */
export function createQueryIntelligence(config?: Partial<QueryIntelligenceConfig>): IQueryIntelligenceOrchestrator {
  return new QueryIntelligenceOrchestrator(config);
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

  // Return just the query strings for backward compatibility
  return queries.map(q => q.query);
}
