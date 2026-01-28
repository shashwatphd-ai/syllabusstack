/**
 * useGapAnalysis.ts
 *
 * PURPOSE: Re-export gap analysis hook from useAnalysis.ts
 *
 * WHY THIS FILE EXISTS:
 * - Test file useGapAnalysis.test.ts imports from './useGapAnalysis'
 * - Actual implementation is in useAnalysis.ts
 * - This redirect maintains expected import path
 * - Part of MASTER_IMPLEMENTATION_PLAN.md Task 1.1.2
 *
 * WHAT THIS DOES:
 * - Re-exports useGapAnalysis hook from useAnalysis.ts
 * - Re-exports SkillGap type for type-safe gap analysis
 * - Provides useGapAnalysisForJob as alias (same functionality)
 *
 * EXPECTED BEHAVIOR:
 * - import { useGapAnalysis, SkillGap } from './useGapAnalysis'
 *   resolves correctly
 * - Tests pass without modifying import paths
 */

// Re-export the main hook and type from useAnalysis.ts
export { useGapAnalysis } from './useAnalysis';
export type { SkillGap } from './useAnalysis';

// Import for re-export as alias
import { useGapAnalysis as _useGapAnalysis } from './useAnalysis';

/**
 * Alias for useGapAnalysis.
 *
 * WHY THIS EXISTS:
 * - Test file imports useGapAnalysisForJob (line 22)
 * - Same functionality as useGapAnalysis
 * - "ForJob" clarifies it analyzes gaps for a specific dream job
 *
 * @param dreamJobId - The dream job to analyze skill gaps for
 * @returns Gap analysis data including skill gaps, match score, recommendations
 */
export const useGapAnalysisForJob = _useGapAnalysis;
