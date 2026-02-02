/**
 * Legacy Assessment Hooks
 *
 * Provides backward compatibility with older hook names.
 * @deprecated Use the new hook names directly instead.
 */

import { useMutation } from '@tanstack/react-query';
import { useStartAssessment, useSubmitAssessmentAnswer, useCompleteAssessment } from './mutations';

/**
 * @deprecated Use useStartAssessment instead
 */
export function useStartSession() {
  return useStartAssessment();
}

/**
 * @deprecated Use useSubmitAssessmentAnswer instead
 */
export function useSubmitAnswer() {
  return useSubmitAssessmentAnswer();
}

/**
 * @deprecated Use useCompleteAssessment instead
 */
export function useCompleteSession() {
  const completeAssessment = useCompleteAssessment();

  return useMutation({
    mutationFn: async ({
      sessionId,
      passed,
    }: {
      sessionId: string;
      passed: boolean;
    }) => {
      const result = await completeAssessment.mutateAsync({ sessionId });
      return result.session;
    },
  });
}
