/**
 * Query Builders
 *
 * Interface Segregation: Each builder has a focused responsibility
 * Single Responsibility: One builder per query source type
 *
 * ALL QUERIES ARE BUILT FROM SYLLABUS-EXTRACTED TERMS
 */

import {
  IQueryBuilder,
  QueryGenerationContext,
  ExpandedTerms,
  GeneratedQuery,
  BloomLevel,
  VideoType,
} from '../types.ts';

/**
 * Direct Syllabus Query Builder
 *
 * Builds queries directly from the syllabus-extracted keywords
 * Priority: Highest (these are the instructor's own terms)
 */
export class DirectSyllabusBuilder implements IQueryBuilder {
  readonly name = 'direct_syllabus';
  readonly priority = 10;

  build(context: QueryGenerationContext, _expandedTerms: ExpandedTerms[]): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];
    const lo = context.learningObjective;

    // 1. Use core_concept directly from syllabus extraction
    if (lo.core_concept) {
      queries.push({
        query: `${lo.core_concept} explained`,
        source: 'syllabus_direct',
        priority: 10,
        expectedType: this.getVideoTypeForBloom(lo.bloom_level),
        derivedFrom: lo.core_concept,
      });

      queries.push({
        query: `${lo.core_concept} tutorial`,
        source: 'syllabus_direct',
        priority: 9,
        expectedType: 'tutorial',
        derivedFrom: lo.core_concept,
      });
    }

    // 2. Use search_keywords from syllabus extraction
    for (const keyword of lo.search_keywords.slice(0, 3)) {
      queries.push({
        query: `${keyword} explained`,
        source: 'syllabus_direct',
        priority: 8,
        expectedType: 'explanation',
        derivedFrom: keyword,
      });
    }

    return queries;
  }

  private getVideoTypeForBloom(bloom: BloomLevel): VideoType {
    const mapping: Record<BloomLevel, VideoType> = {
      remember: 'explanation',
      understand: 'explanation',
      apply: 'tutorial',
      analyze: 'case_study',
      evaluate: 'discussion',
      create: 'demonstration',
    };
    return mapping[bloom] || 'explanation';
  }
}

/**
 * Bloom's Taxonomy Query Builder
 *
 * Adds pedagogically appropriate modifiers based on Bloom's level
 * Uses YOUR syllabus terms + appropriate learning action modifiers
 */
export class BloomQueryBuilder implements IQueryBuilder {
  readonly name = 'bloom_template';
  readonly priority = 8;

  private readonly bloomModifiers: Record<BloomLevel, { prefixes: string[]; suffixes: string[]; types: VideoType[] }> = {
    remember: {
      prefixes: ['what is', 'introduction to', 'basics of'],
      suffixes: ['definition', 'overview', 'fundamentals'],
      types: ['explanation', 'lecture'],
    },
    understand: {
      prefixes: ['understanding', 'how does', 'why'],
      suffixes: ['explained', 'concepts', 'meaning'],
      types: ['explanation', 'lecture'],
    },
    apply: {
      prefixes: ['how to', 'using', 'applying'],
      suffixes: ['tutorial', 'step by step', 'example'],
      types: ['tutorial', 'worked_example', 'demonstration'],
    },
    analyze: {
      prefixes: ['analyzing', 'comparing', 'examining'],
      suffixes: ['analysis', 'deep dive', 'breakdown'],
      types: ['case_study', 'lecture'],
    },
    evaluate: {
      prefixes: ['evaluating', 'comparing', 'assessing'],
      suffixes: ['review', 'comparison', 'pros and cons'],
      types: ['discussion', 'case_study'],
    },
    create: {
      prefixes: ['creating', 'building', 'designing'],
      suffixes: ['project', 'from scratch', 'complete guide'],
      types: ['tutorial', 'demonstration'],
    },
  };

  build(context: QueryGenerationContext, _expandedTerms: ExpandedTerms[]): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];
    const lo = context.learningObjective;
    const modifiers = this.bloomModifiers[lo.bloom_level] || this.bloomModifiers.understand;
    const concept = lo.core_concept;

    if (!concept) return queries;

    // Add prefix-based queries
    for (const prefix of modifiers.prefixes.slice(0, 2)) {
      queries.push({
        query: `${prefix} ${concept}`,
        source: 'bloom_template',
        priority: 7,
        expectedType: modifiers.types[0],
        derivedFrom: concept,
      });
    }

    // Add suffix-based queries
    for (const suffix of modifiers.suffixes.slice(0, 2)) {
      queries.push({
        query: `${concept} ${suffix}`,
        source: 'bloom_template',
        priority: 6,
        expectedType: modifiers.types[0],
        derivedFrom: concept,
      });
    }

    return queries;
  }
}

/**
 * Module Context Query Builder
 *
 * Builds queries using module and course context from the syllabus
 * Helps find content specific to this module's topic
 */
export class ModuleContextBuilder implements IQueryBuilder {
  readonly name = 'module_context';
  readonly priority = 7;

  build(context: QueryGenerationContext, _expandedTerms: ExpandedTerms[]): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];
    const lo = context.learningObjective;

    // Use module title terms if available
    if (context.module?.title) {
      // Extract key terms from module title (remove week/unit numbers)
      const cleanTitle = context.module.title
        .replace(/^(week|unit|module|chapter)\s*\d+[:\s-]*/i, '')
        .trim();

      if (cleanTitle && cleanTitle.toLowerCase() !== lo.core_concept.toLowerCase()) {
        queries.push({
          query: `${cleanTitle} ${lo.core_concept}`,
          source: 'module_context',
          priority: 7,
          expectedType: 'lecture',
          derivedFrom: `module: ${context.module.title}`,
        });

        queries.push({
          query: `${cleanTitle} lecture`,
          source: 'module_context',
          priority: 6,
          expectedType: 'lecture',
          derivedFrom: `module: ${context.module.title}`,
        });
      }
    }

    // Use course context if available
    if (context.course?.title) {
      // Extract course subject from title
      const courseSubject = context.course.title
        .replace(/^[A-Z]{2,4}\s*\d{3,4}[:\s-]*/i, '')
        .trim();

      if (courseSubject && lo.core_concept) {
        queries.push({
          query: `${lo.core_concept} ${courseSubject}`,
          source: 'module_context',
          priority: 5,
          expectedType: 'lecture',
          derivedFrom: `course: ${context.course.title}`,
        });
      }
    }

    return queries;
  }
}

/**
 * Platform Optimized Query Builder
 *
 * Builds queries optimized for YouTube/educational platform search
 * Uses YOUR syllabus terms + platform-specific patterns
 */
export class PlatformOptimizedBuilder implements IQueryBuilder {
  readonly name = 'platform_optimized';
  readonly priority = 6;

  private readonly educationalChannelPatterns = [
    'Khan Academy',
    'MIT OpenCourseWare',
    'Crash Course',
    'professor',
    'university lecture',
  ];

  private readonly durationPatterns = [
    'in 10 minutes',
    'in 5 minutes',
    'quick',
    'crash course',
    'complete guide',
  ];

  build(context: QueryGenerationContext, _expandedTerms: ExpandedTerms[]): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];
    const lo = context.learningObjective;
    const concept = lo.core_concept;

    if (!concept) return queries;

    // Educational channel targeting
    for (const channel of this.educationalChannelPatterns.slice(0, 2)) {
      queries.push({
        query: `${channel} ${concept}`,
        source: 'platform_optimized',
        priority: 6,
        expectedType: 'lecture',
        derivedFrom: concept,
      });
    }

    // Duration-based queries (for appropriate content length)
    const expectedMinutes = lo.expected_duration_minutes;
    if (expectedMinutes <= 10) {
      queries.push({
        query: `${concept} in 5 minutes`,
        source: 'platform_optimized',
        priority: 5,
        expectedType: 'explanation',
        derivedFrom: concept,
      });
    } else if (expectedMinutes <= 20) {
      queries.push({
        query: `${concept} quick tutorial`,
        source: 'platform_optimized',
        priority: 5,
        expectedType: 'tutorial',
        derivedFrom: concept,
      });
    } else {
      queries.push({
        query: `${concept} complete guide`,
        source: 'platform_optimized',
        priority: 5,
        expectedType: 'tutorial',
        derivedFrom: concept,
      });
    }

    return queries;
  }
}

/**
 * Concept Expansion Query Builder
 *
 * Uses expanded terms (synonyms, variations) to build diverse queries
 * Still derived from YOUR syllabus terms, just expanded
 */
export class ConceptExpansionBuilder implements IQueryBuilder {
  readonly name = 'concept_expansion';
  readonly priority = 7;

  build(context: QueryGenerationContext, expandedTerms: ExpandedTerms[]): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];
    const lo = context.learningObjective;

    for (const expanded of expandedTerms) {
      // Use synonyms
      for (const synonym of expanded.synonyms.slice(0, 2)) {
        queries.push({
          query: `${synonym} explained`,
          source: 'concept_expansion',
          priority: 7,
          expectedType: 'explanation',
          derivedFrom: `${expanded.original} → ${synonym}`,
        });
      }

      // Use variations
      for (const variation of expanded.variations.slice(0, 2)) {
        queries.push({
          query: `${variation} tutorial`,
          source: 'concept_expansion',
          priority: 6,
          expectedType: 'tutorial',
          derivedFrom: `${expanded.original} → ${variation}`,
        });
      }
    }

    return queries;
  }
}

/**
 * Factory function to create all default builders
 */
export function createDefaultBuilders(): IQueryBuilder[] {
  return [
    new DirectSyllabusBuilder(),      // Highest priority - direct syllabus terms
    new BloomQueryBuilder(),          // Pedagogically appropriate modifiers
    new ModuleContextBuilder(),       // Module/course context
    new ConceptExpansionBuilder(),    // Expanded terms
    new PlatformOptimizedBuilder(),   // Platform optimization
  ];
}
