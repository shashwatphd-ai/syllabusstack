/**
 * Query Intelligence Layer - Type Definitions
 *
 * Following SOLID principles:
 * - Interface Segregation: Small, focused interfaces
 * - Dependency Inversion: Code depends on abstractions
 */

// ============================================================================
// INPUT TYPES (What we receive from syllabus extraction)
// ============================================================================

/**
 * Learning objective data extracted from the instructor's syllabus
 * All terms are dynamically extracted - NEVER hardcoded
 */
export interface ExtractedLearningObjective {
  id: string;
  text: string;                    // Full LO text from syllabus
  core_concept: string;            // AI-extracted 2-4 word summary
  action_verb: string;             // Bloom's taxonomy verb
  bloom_level: BloomLevel;         // Cognitive level classification
  domain: Domain;                  // Subject domain classification
  specificity: Specificity;        // Depth level
  search_keywords: string[];       // AI-extracted keywords (3+)
  expected_duration_minutes: number;
}

/**
 * Module context from the syllabus
 */
export interface ModuleContext {
  title: string;                   // e.g., "Week 5: Financial Analysis"
  description?: string;            // Module description if available
  sequence_order: number;
}

/**
 * Course context from the syllabus
 */
export interface CourseContext {
  title: string;                   // e.g., "MBA 502 - Corporate Finance"
  description?: string;
  code?: string;                   // e.g., "MBA 502"
}

/**
 * Complete context for query generation
 */
export interface QueryGenerationContext {
  learningObjective: ExtractedLearningObjective;
  module?: ModuleContext;
  course?: CourseContext;
}

// ============================================================================
// BLOOM'S TAXONOMY & DOMAIN TYPES
// ============================================================================

export type BloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

export type Domain =
  | 'business'
  | 'science'
  | 'humanities'
  | 'technical'
  | 'arts'
  | 'other';

export type Specificity =
  | 'introductory'
  | 'intermediate'
  | 'advanced';

// ============================================================================
// EXTRACTION RESULT TYPES
// ============================================================================

/**
 * Result of concept extraction from LO text
 */
export interface ExtractedConcepts {
  primaryConcept: string;          // Main concept from syllabus
  secondaryConcepts: string[];     // Supporting concepts
  actionContext: string;           // What the student should do
  impliedConcepts: string[];       // Concepts implied by context
  nGrams: string[];                // Multi-word phrases extracted
}

/**
 * Result of module context extraction
 */
export interface ExtractedModuleTerms {
  topicKeywords: string[];         // Keywords from module title
  weekNumber?: number;             // If module is week-based
  impliedTerms: string[];          // Terms implied by module context
}

// ============================================================================
// EXPANSION RESULT TYPES
// ============================================================================

/**
 * Result of term expansion (synonyms, variations)
 */
export interface ExpandedTerms {
  original: string;                // Original term from syllabus
  synonyms: string[];              // Academic synonyms
  variations: string[];            // Phrasing variations
  relatedTerms: string[];          // Related concepts
}

// ============================================================================
// QUERY GENERATION TYPES
// ============================================================================

/**
 * A generated search query with metadata
 */
export interface GeneratedQuery {
  query: string;                   // The actual search query
  source: QuerySource;             // How it was generated
  priority: number;                // 1-10, higher = more likely to find content
  expectedType: VideoType;         // What type of content expected
  derivedFrom: string;             // Which syllabus term it came from
}

export type QuerySource =
  | 'syllabus_direct'              // Direct from syllabus keywords
  | 'module_context'               // Derived from module title
  | 'bloom_template'               // Bloom's level template
  | 'llm_enriched';                // Enhanced by open LLM

export type VideoType =
  | 'lecture'
  | 'tutorial'
  | 'explanation'
  | 'demonstration'
  | 'case_study'
  | 'worked_example'
  | 'animation'
  | 'discussion';

// ============================================================================
// INTERFACE CONTRACTS (Dependency Inversion)
// ============================================================================

/**
 * Interface for concept extractors
 * Single Responsibility: Extract concepts from text
 */
export interface IConceptExtractor {
  extract(text: string, context?: QueryGenerationContext): ExtractedConcepts;
}

/**
 * Interface for term expanders
 * Open/Closed: New expanders can be added without modifying existing code
 */
export interface ITermExpander {
  readonly name: string;
  expand(term: string, domain: Domain): Promise<ExpandedTerms>;
  isAvailable(): Promise<boolean>;
}

/**
 * Interface for query builders
 * Single Responsibility: Build queries from a specific source
 */
export interface IQueryBuilder {
  readonly name: string;
  readonly priority: number;
  build(context: QueryGenerationContext, expandedTerms: ExpandedTerms[]): GeneratedQuery[];
}

/**
 * Interface for the orchestrator
 * Dependency Inversion: Depends on abstractions (interfaces)
 */
export interface IQueryIntelligenceOrchestrator {
  generateQueries(context: QueryGenerationContext): Promise<GeneratedQuery[]>;
  registerExpander(expander: ITermExpander): void;
  registerBuilder(builder: IQueryBuilder): void;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for the query intelligence layer
 */
export interface QueryIntelligenceConfig {
  maxQueries: number;              // Maximum queries to return (default: 12)
  enableLLMExpansion: boolean;     // Whether to use open LLM for expansion
  llmTimeoutMs: number;            // Timeout for LLM calls (default: 3000)
  minQueryDiversity: number;       // Minimum diversity score (0-1)
  preferredSources: QuerySource[]; // Priority order for query sources
}

export const DEFAULT_CONFIG: QueryIntelligenceConfig = {
  maxQueries: 8,
  enableLLMExpansion: true,
  llmTimeoutMs: 3000,
  minQueryDiversity: 0.3,
  preferredSources: [
    'syllabus_direct',
    'module_context',
    'bloom_template',
  ],
};
