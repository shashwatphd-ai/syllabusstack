# SyllabusStack Assessment System - Implementation Plan

> **Document Version:** 2.0 (Updated)
> **Updated:** 2026-01-12
> **Purpose:** Step-by-step implementation guide to fix and enhance the assessment system
> **Status:** Updated after reviewing Lovable's changes to main branch

---

## Current State Summary

### What's Already Done ✅
- Testing infrastructure (vitest, testing-library) installed
- `vitest.config.ts` configured correctly
- `src/test/setup.ts` with browser mocks
- `src/test/utils.tsx` with render helpers
- `supabase/functions/_shared/error-handler.ts` enhanced with logWarn, logRateLimit, logAnalytics

### What Still Needs to Be Done ❌
- **All 4 critical bugs** from Phase 1 remain unfixed
- Assessment-specific test files not created
- Assessment functions don't use shared error handler
- No config file, no analytics, no rate limiting
- No UI enhancements (AttemptHistory, RemediationBanner)

---

## Revised Phase Overview

| Phase | Status | Priority | Remaining Tasks |
|-------|--------|----------|-----------------|
| Phase 0 | 60% Done | Required First | 3 tasks remaining |
| Phase 1 | 0% Done | CRITICAL | 5 tasks |
| Phase 2 | 10% Done | HIGH | 5 tasks |
| Phase 3 | 0% Done | MEDIUM | 3 tasks |
| Phase 4 | 0% Done | HIGH | 1 task |
| Phase 5 | 0% Done | MEDIUM | 5 tasks |
| Phase 6 | 0% Done | MEDIUM | 2 tasks |

---

# Phase 0: Testing Foundation (Remaining Tasks)

**Already Done:**
- ✅ vitest installed (v4.0.16)
- ✅ vitest.config.ts created
- ✅ src/test/setup.ts created
- ✅ src/test/utils.tsx created

**Still Needed:**

## Task 0.1: Add Test Scripts to package.json

**File to modify:** `package.json`

**Find the scripts section and add:**
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
},
```

---

## Task 0.2: Create Assessment Test Factories

**File to create:** `src/test/factories/assessment.ts`

```typescript
export interface MockAssessmentQuestion {
  id: string;
  learning_objective_id: string;
  question_text: string;
  question_type: 'mcq' | 'short_answer' | 'true_false';
  options: { label: string; text: string; is_correct: boolean }[] | null;
  correct_answer: string;
  accepted_answers: string[] | null;
  required_keywords: string[] | null;
  difficulty: 'easy' | 'medium' | 'hard';
  bloom_level: string;
  time_limit_seconds: number;
  scenario_context: string | null;
}

export interface MockAssessmentSession {
  id: string;
  user_id: string;
  learning_objective_id: string;
  question_ids: string[];
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  completed_at: string | null;
  timeout_at: string;
  current_question_index: number;
  questions_answered: number;
  questions_correct: number;
  total_score: number | null;
  passed: boolean | null;
  attempt_number: number;
}

export function createMockQuestion(overrides: Partial<MockAssessmentQuestion> = {}): MockAssessmentQuestion {
  return {
    id: `question-${Math.random().toString(36).substr(2, 9)}`,
    learning_objective_id: 'lo-123',
    question_text: 'What is the capital of France?',
    question_type: 'mcq',
    options: [
      { label: 'A', text: 'London', is_correct: false },
      { label: 'B', text: 'Paris', is_correct: true },
      { label: 'C', text: 'Berlin', is_correct: false },
      { label: 'D', text: 'Madrid', is_correct: false },
    ],
    correct_answer: 'B',
    accepted_answers: null,
    required_keywords: null,
    difficulty: 'medium',
    bloom_level: 'remember',
    time_limit_seconds: 45,
    scenario_context: null,
    ...overrides,
  };
}

export function createMockSession(overrides: Partial<MockAssessmentSession> = {}): MockAssessmentSession {
  return {
    id: `session-${Math.random().toString(36).substr(2, 9)}`,
    user_id: 'user-123',
    learning_objective_id: 'lo-123',
    question_ids: ['q1', 'q2', 'q3', 'q4', 'q5'],
    status: 'in_progress',
    started_at: new Date().toISOString(),
    completed_at: null,
    timeout_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    current_question_index: 0,
    questions_answered: 0,
    questions_correct: 0,
    total_score: null,
    passed: null,
    attempt_number: 1,
    ...overrides,
  };
}
```

---

## Task 0.3: Create State Machine Tests

**File to create:** `src/lib/verification-state-machine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  getNextValidStates,
  canTakeAssessment,
  isComplete,
  getNextState,
  type VerificationState,
} from './verification-state-machine';

describe('verification-state-machine', () => {
  describe('isValidTransition', () => {
    it('allows unstarted → in_progress', () => {
      expect(isValidTransition('unstarted', 'in_progress')).toBe(true);
    });

    it('allows in_progress → verified', () => {
      expect(isValidTransition('in_progress', 'verified')).toBe(true);
    });

    it('allows assessment_unlocked → passed', () => {
      expect(isValidTransition('assessment_unlocked', 'passed')).toBe(true);
    });

    it('allows assessment_unlocked → remediation_required', () => {
      expect(isValidTransition('assessment_unlocked', 'remediation_required')).toBe(true);
    });

    it('blocks passed → any state (terminal)', () => {
      const allStates: VerificationState[] = [
        'unstarted', 'in_progress', 'verified',
        'assessment_unlocked', 'passed', 'remediation_required'
      ];
      allStates.forEach((state) => {
        expect(isValidTransition('passed', state)).toBe(false);
      });
    });

    it('blocks unstarted → passed (skip states)', () => {
      expect(isValidTransition('unstarted', 'passed')).toBe(false);
    });
  });

  describe('canTakeAssessment', () => {
    it('returns false for unstarted', () => {
      expect(canTakeAssessment('unstarted')).toBe(false);
    });

    it('returns true for verified', () => {
      expect(canTakeAssessment('verified')).toBe(true);
    });

    it('returns true for assessment_unlocked', () => {
      expect(canTakeAssessment('assessment_unlocked')).toBe(true);
    });

    it('returns false for passed', () => {
      expect(canTakeAssessment('passed')).toBe(false);
    });

    it('returns true for remediation_required', () => {
      expect(canTakeAssessment('remediation_required')).toBe(true);
    });
  });

  describe('isComplete', () => {
    it('returns true only for passed', () => {
      expect(isComplete('passed')).toBe(true);
      expect(isComplete('unstarted')).toBe(false);
      expect(isComplete('verified')).toBe(false);
    });
  });

  describe('getNextState', () => {
    it('returns passed for pass_assessment from assessment_unlocked', () => {
      expect(getNextState('assessment_unlocked', 'pass_assessment')).toBe('passed');
    });

    it('returns remediation_required for fail_assessment', () => {
      expect(getNextState('assessment_unlocked', 'fail_assessment')).toBe('remediation_required');
    });
  });
});
```

---

## Phase 0 Checklist

- [x] vitest installed
- [x] vitest.config.ts created
- [x] src/test/setup.ts created
- [x] src/test/utils.tsx created
- [ ] Test scripts added to package.json
- [ ] src/test/factories/assessment.ts created
- [ ] src/lib/verification-state-machine.test.ts created
- [ ] `npm run test:run` passes

---

# Phase 1: Critical Blockers

**Goal:** Fix bugs that completely prevent the assessment system from working.
**MUST complete before any other phases.**

---

## Task 1.1: Fix Question Type Mismatch

**Problem:** AI generator outputs `multiple_choice` but UI expects `mcq`

**File to modify:** `supabase/functions/generate-assessment-questions/index.ts`

**Find (line 27):**
```typescript
enum: ["multiple_choice", "short_answer", "true_false"],
```

**Replace with:**
```typescript
enum: ["mcq", "short_answer", "true_false"],
```

**Also find (around line 98-101) in the prompt:**
```
- multiple_choice: 4 options
```

**Replace with:**
```
- mcq: Multiple choice with 4 options
```

---

## Task 1.2: Fix MCQ Options Rendering

**Problem:** QuestionCard expects `string[]` but gets `{label, text, is_correct}[]`

**File to modify:** `src/components/assessment/QuestionCard.tsx`

**Find (line 83):**
```typescript
const options = (question.options as string[]) || [];
```

**Replace with:**
```typescript
// MCQ options come as objects with label, text, is_correct
interface MCQOption {
  label: string;
  text: string;
  is_correct: boolean;
}

const rawOptions = question.options as MCQOption[] | string[] | null;

// Normalize options to handle both formats
const options: MCQOption[] = rawOptions
  ? (typeof rawOptions[0] === 'string'
      ? (rawOptions as string[]).map((text, i) => ({
          label: String.fromCharCode(65 + i),
          text,
          is_correct: false,
        }))
      : (rawOptions as MCQOption[]))
  : [];
```

**Also find (around lines 129-143) the RadioGroup rendering and update:**
```typescript
{question.question_type === 'mcq' && options.length > 0 && (
  <RadioGroup value={answer} onValueChange={setAnswer} className="space-y-3">
    {options.map((option, index) => (
      <div
        key={index}
        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => setAnswer(option.label)}
      >
        <RadioGroupItem value={option.label} id={`option-${index}`} />
        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
          <span className="font-medium mr-2">{option.label}.</span>
          {option.text}
        </Label>
      </div>
    ))}
  </RadioGroup>
)}
```

---

## Task 1.3: Fix RLS Policy for Students

**Problem:** Students can't fetch questions during their assessment session

**File to create:** `supabase/migrations/20260112000001_fix_assessment_questions_rls.sql`

```sql
-- Fix RLS policy for assessment_questions
-- Students need to access questions during their active assessment sessions

DROP POLICY IF EXISTS "Users can view questions for their LOs" ON public.assessment_questions;

CREATE POLICY "Users can view assessment questions"
ON public.assessment_questions FOR SELECT
USING (
  -- Instructors can see questions for their own LOs
  EXISTS (
    SELECT 1 FROM public.learning_objectives lo
    WHERE lo.id = assessment_questions.learning_objective_id
    AND lo.user_id = auth.uid()
  )
  OR
  -- Students can see questions in their active assessment sessions
  EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    WHERE s.user_id = auth.uid()
    AND s.status = 'in_progress'
    AND assessment_questions.id = ANY(s.question_ids)
  )
);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_learning_objective_id
ON public.assessment_questions(learning_objective_id);
```

---

## Task 1.4: Fix State Updates in complete-assessment

**Problem:** Sets `verified` instead of `passed`, no update on fail

**File to modify:** `supabase/functions/complete-assessment/index.ts`

**Find (around lines 145-162):**
```typescript
if (passed) {
  const { error: loError } = await supabase
    .from('learning_objectives')
    .update({
      verification_state: 'verified',
      updated_at: completedAt,
    })
```

**Replace with:**
```typescript
// Update learning objective verification state based on result
const newState = passed ? 'passed' : 'remediation_required';

const { error: loError } = await supabase
  .from('learning_objectives')
  .update({
    verification_state: newState,
    updated_at: completedAt,
  })
  .eq('id', session.learning_objective_id);

if (loError) {
  console.error('Error updating learning objective:', loError);
} else {
  console.log(`Updated LO ${session.learning_objective_id} to ${newState}`);
}
```

---

## Task 1.5: Add QuestionCard Tests

**File to create:** `src/components/assessment/QuestionCard.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { QuestionCard } from './QuestionCard';
import { createMockQuestion } from '@/test/factories/assessment';

describe('QuestionCard', () => {
  const mockOnSubmit = vi.fn();
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MCQ rendering', () => {
    it('renders MCQ options with label and text format', () => {
      const question = createMockQuestion({
        question_type: 'mcq',
        options: [
          { label: 'A', text: 'Option A', is_correct: false },
          { label: 'B', text: 'Option B', is_correct: true },
        ],
      });

      render(
        <QuestionCard
          question={question}
          questionNumber={1}
          totalQuestions={5}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByText(/Option A/)).toBeInTheDocument();
      expect(screen.getByText(/Option B/)).toBeInTheDocument();
    });

    it('submits the option label not the full text', () => {
      const question = createMockQuestion({
        question_type: 'mcq',
        options: [
          { label: 'A', text: 'First option', is_correct: false },
          { label: 'B', text: 'Second option', is_correct: true },
        ],
      });

      render(
        <QuestionCard
          question={question}
          questionNumber={1}
          totalQuestions={5}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      fireEvent.click(screen.getByText(/Second option/));
      fireEvent.click(screen.getByText('Submit Answer'));

      expect(mockOnSubmit).toHaveBeenCalledWith('B');
    });
  });
});
```

---

## Phase 1 Checklist

- [ ] Task 1.1: Question type enum fixed
- [ ] Task 1.2: MCQ options rendering fixed
- [ ] Task 1.3: RLS policy migration applied
- [ ] Task 1.4: complete-assessment state updates fixed
- [ ] Task 1.5: QuestionCard tests created

---

# Phase 2: Error Handling Standardization

**Goal:** Use the existing error handler consistently across assessment functions.

**Already Done:**
- ✅ `_shared/error-handler.ts` exists with all required functions

**Still Needed:**

## Task 2.1: Update start-assessment

**File to modify:** `supabase/functions/start-assessment/index.ts`

**Add import after line 2:**
```typescript
import {
  createErrorResponse,
  logInfo,
  logError,
  logRateLimit
} from '../_shared/error-handler.ts';
```

**Add constant:**
```typescript
const FUNCTION_NAME = 'start-assessment';
```

**Replace error responses** - change all `return new Response(JSON.stringify({ error: ... }), { status: 4xx ...` to use `createErrorResponse()`.

---

## Task 2.2: Update submit-assessment-answer

Apply same pattern as Task 2.1.

## Task 2.3: Update complete-assessment

Apply same pattern as Task 2.1.

## Task 2.4: Update generate-assessment-questions

Apply same pattern, plus use `handleAIGatewayError()` for AI responses.

## Task 2.5: Create assessment-schemas.ts

**File to create:** `supabase/functions/_shared/assessment-schemas.ts`

```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const StartAssessmentSchema = z.object({
  learning_objective_id: z.string().uuid('Invalid learning objective ID'),
  num_questions: z.number().int().min(1).max(20).default(5),
});

export const SubmitAnswerSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
  question_id: z.string().uuid('Invalid question ID'),
  user_answer: z.string().min(1).max(5000),
  client_question_served_at: z.string().datetime(),
  client_answer_submitted_at: z.string().datetime(),
});

export const CompleteAssessmentSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
});

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => e.message).join(', ');
    return { success: false, error: errors };
  }
  return { success: true, data: result.data };
}
```

---

# Phase 3: Database & Performance

## Task 3.1: Create Configuration File

**File to create:** `supabase/functions/_shared/assessment-config.ts`

```typescript
export const ASSESSMENT_CONFIG = {
  PASSING_THRESHOLD: 70,
  DEFAULT_QUESTIONS: 5,
  MIN_QUESTIONS: 1,
  MAX_QUESTIONS: 20,
  DIFFICULTY_DISTRIBUTION: {
    easy: 0.2,
    medium: 0.5,
    hard: 0.3,
  },
  TIMEOUT_MINUTES_PER_QUESTION: 5,
  MIN_ANSWER_TIME_SECONDS: 2,
  MAX_ATTEMPTS_PER_DAY: 5,
  RATE_LIMIT_WINDOW_HOURS: 24,
  AI_CONFIDENCE_THRESHOLD: 0.7,
  KEYWORD_MATCH_THRESHOLD: 0.7,
} as const;

export function getDifficultyDistribution(total: number) {
  const { DIFFICULTY_DISTRIBUTION: d } = ASSESSMENT_CONFIG;
  const easy = Math.max(1, Math.floor(total * d.easy));
  const medium = Math.max(1, Math.floor(total * d.medium));
  const hard = total - easy - medium;
  return { easy, medium, hard };
}
```

## Task 3.2: Add Performance Indexes

**File to create:** `supabase/migrations/20260112000002_add_assessment_indexes.sql`

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_user_lo_status
ON public.assessment_sessions(user_id, learning_objective_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_answers_session_id
ON public.assessment_answers(session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_micro_checks_content_id
ON public.micro_checks(content_id);

ANALYZE public.assessment_sessions;
ANALYZE public.assessment_answers;
ANALYZE public.assessment_questions;
```

## Task 3.3: Update Edge Functions to Use Config

Replace hardcoded values (70, 5, 0.2, 0.5, 0.3, etc.) with config constants.

---

# Phase 4: State Machine Enforcement

## Task 4.1: Create State Transition Trigger

**File to create:** `supabase/migrations/20260112000003_state_machine_trigger.sql`

```sql
CREATE OR REPLACE FUNCTION validate_verification_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "unstarted": ["in_progress"],
    "in_progress": ["verified"],
    "verified": ["assessment_unlocked", "passed"],
    "assessment_unlocked": ["passed", "remediation_required"],
    "passed": [],
    "remediation_required": ["in_progress", "assessment_unlocked", "passed"]
  }'::JSONB;
  allowed_states JSONB;
BEGIN
  IF OLD.verification_state IS NOT DISTINCT FROM NEW.verification_state THEN
    RETURN NEW;
  END IF;

  IF OLD.verification_state IS NULL THEN
    RETURN NEW;
  END IF;

  allowed_states := valid_transitions -> OLD.verification_state;

  IF allowed_states IS NULL OR NOT (allowed_states ? NEW.verification_state) THEN
    RAISE EXCEPTION 'Invalid state transition from "%" to "%"',
      OLD.verification_state, NEW.verification_state;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS enforce_verification_state_transition ON public.learning_objectives;

CREATE TRIGGER enforce_verification_state_transition
BEFORE UPDATE ON public.learning_objectives
FOR EACH ROW
WHEN (OLD.verification_state IS DISTINCT FROM NEW.verification_state)
EXECUTE FUNCTION validate_verification_state_transition();
```

---

# Phase 5: UI Enhancements

## Task 5.1: Add Session Resume Indicator

**File to modify:** `src/components/assessment/AssessmentSession.tsx`

Add state and display for resumed sessions.

## Task 5.2: Create AttemptHistory Component

**File to create:** `src/components/assessment/AttemptHistory.tsx`

Show previous attempts before starting new assessment.

## Task 5.3: Create RemediationBanner Component

**File to create:** `src/components/assessment/RemediationBanner.tsx`

Show when state is `remediation_required`.

## Task 5.4: Show Question Explanations

**File to modify:** `src/components/assessment/QuestionCard.tsx`

Display explanation after incorrect answer.

## Task 5.5: Update Component Exports

**File to modify:** `src/components/assessment/index.ts`

Add new component exports.

---

# Phase 6: Production Hardening

## Task 6.1: Add Rate Limiting

**File to modify:** `supabase/functions/start-assessment/index.ts`

Check attempts in last 24 hours before allowing new session.

## Task 6.2: Create Analytics Tracking

**File to create:** `src/lib/assessment-analytics.ts`

Track assessment events for monitoring.

---

# Deployment Checklist

## Database Migrations (in order)
1. `20260112000001_fix_assessment_questions_rls.sql`
2. `20260112000002_add_assessment_indexes.sql`
3. `20260112000003_state_machine_trigger.sql`

## Edge Functions to Deploy
```bash
supabase functions deploy start-assessment
supabase functions deploy submit-assessment-answer
supabase functions deploy complete-assessment
supabase functions deploy generate-assessment-questions
```

## Verification Steps
- [ ] Generate questions → `question_type = 'mcq'`
- [ ] MCQ options display with A, B, C, D labels
- [ ] Students can fetch questions during session
- [ ] Pass assessment → state = `passed`
- [ ] Fail assessment → state = `remediation_required`
- [ ] All tests pass: `npm run test:run`

---

# Priority Summary

| Priority | Phase | Action Required |
|----------|-------|-----------------|
| 1 (Critical) | Phase 1 | Fix all 5 blocking bugs |
| 2 (High) | Phase 0 | Complete test infrastructure |
| 3 (High) | Phase 4 | Add state machine DB trigger |
| 4 (Medium) | Phase 2 | Standardize error handling |
| 5 (Medium) | Phase 3 | Add config and indexes |
| 6 (Low) | Phase 5 | UI enhancements |
| 7 (Low) | Phase 6 | Rate limiting and analytics |

**Start with Phase 1** - the system cannot work until these bugs are fixed.
