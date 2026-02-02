/**
 * Assessment Hooks - Barrel Export
 *
 * Re-exports all assessment hooks and types for convenient imports.
 */

// Types
export type {
  AssessmentSession,
  AssessmentQuestion,
  AssessmentAnswer,
  SessionProgress,
  PerformanceSummary,
  MicroCheck,
  MicroCheckResult,
  StartAssessmentResponse,
  SubmitAnswerResponse,
  CompleteAssessmentResponse,
  ValidateMicroCheckResponse,
} from './types';

// Query hooks
export {
  useAssessmentQuestions,
  useActiveSession,
  useSessionHistory,
} from './queries';

// Mutation hooks
export {
  useStartAssessment,
  useSubmitAssessmentAnswer,
  useCompleteAssessment,
  useGenerateAssessmentQuestions,
} from './mutations';

// Micro-checks hooks
export {
  useGenerateMicroChecks,
  useMicroChecks,
  validateMicroCheckAnswer,
  useMicroCheckResults,
} from './microChecks';

// Legacy hooks (deprecated)
export {
  useStartSession,
  useSubmitAnswer,
  useCompleteSession,
} from './legacy';
