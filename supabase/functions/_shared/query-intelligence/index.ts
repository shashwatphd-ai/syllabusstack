/**
 * Query Intelligence Layer
 *
 * A SOLID-designed module for generating intelligent search queries
 * from syllabus-extracted learning objectives.
 *
 * IMPORTANT: All search terms are derived from the instructor's syllabus.
 * Nothing is hardcoded. The system dynamically extracts and expands terms.
 *
 * Usage:
 * ```typescript
 * import { generateSearchQueries } from './_shared/query-intelligence/index.ts';
 *
 * const queries = await generateSearchQueries(
 *   learningObjective,  // From syllabus extraction
 *   module,             // Optional module context
 *   course              // Optional course context
 * );
 * ```
 */

// Types
export * from './types.ts';

// Extractors
export { ConceptExtractor, ModuleContextExtractor } from './extractors/concept-extractor.ts';

// Expanders
export {
  BaseTermExpander,
  RuleBasedExpander,
  OpenLLMExpander,
  CompositeExpander,
  createDefaultExpander,
} from './expanders/base-expander.ts';

// Builders
export {
  DirectSyllabusBuilder,
  BloomQueryBuilder,
  ModuleContextBuilder,
  createDefaultBuilders,
} from './builders/query-builders.ts';

// Orchestrator
export {
  QueryIntelligenceOrchestrator,
  createQueryIntelligence,
  generateSearchQueries,
} from './orchestrator.ts';
