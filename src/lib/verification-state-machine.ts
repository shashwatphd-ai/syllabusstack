/**
 * Verification State Machine for Learning Objectives
 *
 * States:
 * - unstarted: Initial state, student hasn't engaged with content
 * - in_progress: Student has started watching content
 * - verified: Student completed content consumption and passed micro-checks
 * - assessment_unlocked: Ready for final assessment (alias for verified in most cases)
 * - passed: Student passed the final assessment
 * - remediation_required: Student failed assessment and needs to review
 *
 * Transitions:
 * unstarted → in_progress (on first content interaction)
 * in_progress → verified (on completing content + passing micro-checks)
 * verified → assessment_unlocked (automatic or on instructor approval)
 * assessment_unlocked → passed (on passing assessment)
 * assessment_unlocked → remediation_required (on failing assessment)
 * remediation_required → in_progress (on re-watching content)
 * remediation_required → assessment_unlocked (after remediation period)
 */

export type VerificationState =
  | 'unstarted'
  | 'in_progress'
  | 'verified'
  | 'assessment_unlocked'
  | 'passed'
  | 'remediation_required';

export interface StateConfig {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  canTakeAssessment: boolean;
  canWatchContent: boolean;
  isComplete: boolean;
}

export const VERIFICATION_STATES: Record<VerificationState, StateConfig> = {
  unstarted: {
    label: 'Not Started',
    description: 'Begin by watching the learning content',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    canTakeAssessment: false,
    canWatchContent: true,
    isComplete: false,
  },
  in_progress: {
    label: 'In Progress',
    description: 'Continue watching to complete verification',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    canTakeAssessment: false,
    canWatchContent: true,
    isComplete: false,
  },
  verified: {
    label: 'Content Verified',
    description: 'Content completed! Ready for assessment',
    color: 'text-success',
    bgColor: 'bg-success/10',
    canTakeAssessment: true,
    canWatchContent: true,
    isComplete: false,
  },
  assessment_unlocked: {
    label: 'Assessment Ready',
    description: 'Take the assessment to demonstrate mastery',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    canTakeAssessment: true,
    canWatchContent: true,
    isComplete: false,
  },
  passed: {
    label: 'Passed',
    description: 'Congratulations! You\'ve mastered this objective',
    color: 'text-success',
    bgColor: 'bg-success/10',
    canTakeAssessment: false,
    canWatchContent: true,
    isComplete: true,
  },
  remediation_required: {
    label: 'Review Required',
    description: 'Review the content and try the assessment again',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    canTakeAssessment: true,
    canWatchContent: true,
    isComplete: false,
  },
};

// Valid state transitions
const VALID_TRANSITIONS: Record<VerificationState, VerificationState[]> = {
  unstarted: ['in_progress'],
  in_progress: ['verified'],
  verified: ['assessment_unlocked'],
  assessment_unlocked: ['passed', 'remediation_required'],
  passed: [], // Terminal state
  remediation_required: ['in_progress', 'assessment_unlocked'],
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  fromState: VerificationState,
  toState: VerificationState
): boolean {
  return VALID_TRANSITIONS[fromState]?.includes(toState) ?? false;
}

/**
 * Get the next valid states from current state
 */
export function getNextValidStates(currentState: VerificationState): VerificationState[] {
  return VALID_TRANSITIONS[currentState] ?? [];
}

/**
 * Check if assessment can be taken in current state
 */
export function canTakeAssessment(state: VerificationState | string | null): boolean {
  if (!state) return false;
  return VERIFICATION_STATES[state as VerificationState]?.canTakeAssessment ?? false;
}

/**
 * Check if content watching is allowed in current state
 */
export function canWatchContent(state: VerificationState | string | null): boolean {
  if (!state) return true;
  return VERIFICATION_STATES[state as VerificationState]?.canWatchContent ?? true;
}

/**
 * Check if the learning objective is complete
 */
export function isComplete(state: VerificationState | string | null): boolean {
  if (!state) return false;
  return VERIFICATION_STATES[state as VerificationState]?.isComplete ?? false;
}

/**
 * Get state configuration
 */
export function getStateConfig(state: VerificationState | string | null): StateConfig {
  if (!state || !(state in VERIFICATION_STATES)) {
    return VERIFICATION_STATES.unstarted;
  }
  return VERIFICATION_STATES[state as VerificationState];
}

/**
 * Determine the next state based on an action
 */
export function getNextState(
  currentState: VerificationState | string | null,
  action: 'start_content' | 'complete_content' | 'unlock_assessment' | 'pass_assessment' | 'fail_assessment' | 'retry_content'
): VerificationState | null {
  const state = (currentState as VerificationState) || 'unstarted';

  switch (action) {
    case 'start_content':
      if (state === 'unstarted') return 'in_progress';
      if (state === 'remediation_required') return 'in_progress';
      return null;

    case 'complete_content':
      if (state === 'in_progress') return 'verified';
      return null;

    case 'unlock_assessment':
      if (state === 'verified') return 'assessment_unlocked';
      if (state === 'remediation_required') return 'assessment_unlocked';
      return null;

    case 'pass_assessment':
      if (state === 'assessment_unlocked' || state === 'verified' || state === 'remediation_required') {
        return 'passed';
      }
      return null;

    case 'fail_assessment':
      if (state === 'assessment_unlocked' || state === 'verified') {
        return 'remediation_required';
      }
      return null;

    case 'retry_content':
      if (state === 'remediation_required') return 'in_progress';
      return null;

    default:
      return null;
  }
}
