/**
 * Assessment Hooks
 *
 * @deprecated Import from '@/hooks/assessment' instead for better tree-shaking.
 *
 * This file re-exports everything from the modular assessment directory
 * for backward compatibility with existing imports.
 */

export {
  // Types
  type AssessmentSession,
  type AssessmentQuestion,
  type AssessmentAnswer,
  type SessionProgress,
  type PerformanceSummary,
  type MicroCheck,
  type MicroCheckResult,
  type StartAssessmentResponse,
  type SubmitAnswerResponse,
  type CompleteAssessmentResponse,
  type ValidateMicroCheckResponse,
  // Query hooks
  useAssessmentQuestions,
  useActiveSession,
  useSessionHistory,
  // Mutation hooks
  useStartAssessment,
  useSubmitAssessmentAnswer,
  useCompleteAssessment,
  useGenerateAssessmentQuestions,
  // Micro-checks hooks
  useGenerateMicroChecks,
  useMicroChecks,
  validateMicroCheckAnswer,
  useMicroCheckResults,
  // Legacy hooks
  useStartSession,
  useSubmitAnswer,
  useCompleteSession,
} from './assessment';