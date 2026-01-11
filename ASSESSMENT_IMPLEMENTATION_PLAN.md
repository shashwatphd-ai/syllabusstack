# SyllabusStack Assessment System - Detailed Implementation Plan

> **Document Version:** 1.0
> **Created:** 2026-01-11
> **Purpose:** Step-by-step implementation guide to fix and enhance the assessment system
> **Prerequisite:** Complete after IMPLEMENTATION_PLAN.md Phase 1 (Critical Fixes)

---

## Table of Contents

1. [Phase 0: Testing Foundation](#phase-0-testing-foundation)
2. [Phase 1: Critical Blockers](#phase-1-critical-blockers)
3. [Phase 2: Error Handling Standardization](#phase-2-error-handling-standardization)
4. [Phase 3: Database & Performance](#phase-3-database--performance)
5. [Phase 4: State Machine Enforcement](#phase-4-state-machine-enforcement)
6. [Phase 5: UI Enhancements](#phase-5-ui-enhancements)
7. [Phase 6: Production Hardening](#phase-6-production-hardening)

---

## Prerequisites

Before starting, ensure you have:
- [ ] Access to the Supabase project dashboard
- [ ] Ability to run database migrations
- [ ] Local development environment working (`npm run dev`)
- [ ] Git access to commit changes

---

# Phase 0: Testing Foundation

**Goal:** Set up automated testing before making any code changes.
**Why First:** Tests ensure fixes work and don't break other things.

---

## Task 0.1: Install Testing Dependencies

**File to modify:** `package.json`

**Command to run:**
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

---

## Task 0.2: Create Vitest Configuration

**File to create:** `vitest.config.ts` (in project root)

**Full content:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## Task 0.3: Create Test Setup File

**File to create:** `src/test/setup.ts`

**Full content:**

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    })),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

---

## Task 0.4: Create Test Utilities

**File to create:** `src/test/utils.tsx`

**Full content:**

```typescript
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

interface WrapperProps {
  children: React.ReactNode;
}

function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

---

## Task 0.5: Create Test Factories

**File to create:** `src/test/factories/assessment.ts`

**Full content:**

```typescript
import type { AssessmentQuestion, AssessmentSession } from '@/hooks/useAssessment';

export function createMockQuestion(overrides: Partial<AssessmentQuestion> = {}): AssessmentQuestion {
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

export function createMockSession(overrides: Partial<AssessmentSession> = {}): AssessmentSession {
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

## Task 0.6: Create State Machine Tests

**File to create:** `src/lib/verification-state-machine.test.ts`

**Full content:**

```typescript
import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  getNextValidStates,
  canTakeAssessment,
  canWatchContent,
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

    it('allows verified → assessment_unlocked', () => {
      expect(isValidTransition('verified', 'assessment_unlocked')).toBe(true);
    });

    it('allows assessment_unlocked → passed', () => {
      expect(isValidTransition('assessment_unlocked', 'passed')).toBe(true);
    });

    it('allows assessment_unlocked → remediation_required', () => {
      expect(isValidTransition('assessment_unlocked', 'remediation_required')).toBe(true);
    });

    it('allows remediation_required → in_progress', () => {
      expect(isValidTransition('remediation_required', 'in_progress')).toBe(true);
    });

    it('allows remediation_required → assessment_unlocked', () => {
      expect(isValidTransition('remediation_required', 'assessment_unlocked')).toBe(true);
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

    it('blocks in_progress → passed (skip states)', () => {
      expect(isValidTransition('in_progress', 'passed')).toBe(false);
    });
  });

  describe('getNextValidStates', () => {
    it('returns [in_progress] for unstarted', () => {
      expect(getNextValidStates('unstarted')).toEqual(['in_progress']);
    });

    it('returns empty array for passed (terminal)', () => {
      expect(getNextValidStates('passed')).toEqual([]);
    });

    it('returns [passed, remediation_required] for assessment_unlocked', () => {
      expect(getNextValidStates('assessment_unlocked')).toEqual(['passed', 'remediation_required']);
    });
  });

  describe('canTakeAssessment', () => {
    it('returns false for unstarted', () => {
      expect(canTakeAssessment('unstarted')).toBe(false);
    });

    it('returns false for in_progress', () => {
      expect(canTakeAssessment('in_progress')).toBe(false);
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

    it('handles null input', () => {
      expect(canTakeAssessment(null)).toBe(false);
    });
  });

  describe('isComplete', () => {
    it('returns true only for passed', () => {
      expect(isComplete('passed')).toBe(true);
      expect(isComplete('unstarted')).toBe(false);
      expect(isComplete('in_progress')).toBe(false);
      expect(isComplete('verified')).toBe(false);
      expect(isComplete('assessment_unlocked')).toBe(false);
      expect(isComplete('remediation_required')).toBe(false);
    });
  });

  describe('getNextState', () => {
    it('returns in_progress for start_content from unstarted', () => {
      expect(getNextState('unstarted', 'start_content')).toBe('in_progress');
    });

    it('returns verified for complete_content from in_progress', () => {
      expect(getNextState('in_progress', 'complete_content')).toBe('verified');
    });

    it('returns passed for pass_assessment from assessment_unlocked', () => {
      expect(getNextState('assessment_unlocked', 'pass_assessment')).toBe('passed');
    });

    it('returns remediation_required for fail_assessment from assessment_unlocked', () => {
      expect(getNextState('assessment_unlocked', 'fail_assessment')).toBe('remediation_required');
    });

    it('returns null for invalid action from state', () => {
      expect(getNextState('unstarted', 'pass_assessment')).toBe(null);
    });
  });
});
```

---

## Task 0.7: Add Test Scripts to package.json

**File to modify:** `package.json`

**Find this section:**
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint .",
  "preview": "vite preview"
},
```

**Replace with:**
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

## Task 0.8: Verify Tests Work

**Commands to run:**
```bash
npm run test:run
```

**Expected output:** All tests pass (should see green checkmarks)

---

## Phase 0 Checklist

- [ ] Testing dependencies installed
- [ ] vitest.config.ts created
- [ ] src/test/setup.ts created
- [ ] src/test/utils.tsx created
- [ ] src/test/factories/assessment.ts created
- [ ] src/lib/verification-state-machine.test.ts created
- [ ] Test scripts added to package.json
- [ ] `npm run test:run` passes all tests

---

# Phase 1: Critical Blockers

**Goal:** Fix bugs that completely prevent the assessment system from working.
**MUST complete before any other phases.**

---

## Task 1.1: Fix Question Type Mismatch

**Problem:** AI generator outputs `multiple_choice` but UI expects `mcq`

**File to modify:** `supabase/functions/generate-assessment-questions/index.ts`

**Exact location:** Lines 25-28

**Find this code:**
```typescript
question_type: {
  type: "string",
  enum: ["multiple_choice", "short_answer", "true_false"],
  description: "Type of question"
},
```

**Replace with:**
```typescript
question_type: {
  type: "string",
  enum: ["mcq", "short_answer", "true_false"],
  description: "Type of question (mcq = multiple choice)"
},
```

**Also find (lines 98-101):**
```typescript
QUESTION TYPES:
- multiple_choice: 4 options (A, B, C, D), only one correct
- short_answer: Open response with required keywords for grading
- true_false: Statement to evaluate (use sparingly)
```

**Replace with:**
```typescript
QUESTION TYPES:
- mcq: Multiple choice with 4 options (A, B, C, D), only one correct
- short_answer: Open response with required keywords for grading
- true_false: Statement to evaluate (use sparingly)
```

---

## Task 1.2: Fix MCQ Options Rendering

**Problem:** QuestionCard expects `string[]` but gets `{label, text, is_correct}[]`

**File to modify:** `src/components/assessment/QuestionCard.tsx`

**Exact location:** Line 83

**Find this code:**
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
          label: String.fromCharCode(65 + i), // A, B, C, D
          text,
          is_correct: false,
        }))
      : (rawOptions as MCQOption[]))
  : [];
```

**Also find (lines 129-143):**
```typescript
{question.question_type === 'mcq' && options.length > 0 && (
  <RadioGroup value={answer} onValueChange={setAnswer} className="space-y-3">
    {options.map((option, index) => (
      <div
        key={index}
        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => setAnswer(option)}
      >
        <RadioGroupItem value={option} id={`option-${index}`} />
        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
          {option}
        </Label>
      </div>
    ))}
  </RadioGroup>
)}
```

**Replace with:**
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

**File to create:** `supabase/migrations/20260111000001_fix_assessment_questions_rls.sql`

**Full content:**
```sql
-- Fix RLS policy for assessment_questions
-- Students need to access questions during their active assessment sessions

-- First, drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view questions for their LOs" ON public.assessment_questions;

-- Create new policy that allows:
-- 1. Users to view questions for LOs they own (instructors/creators)
-- 2. Users to view questions that are part of their active assessment sessions (students)
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
  OR
  -- Students can see questions for LOs in syllabi they're enrolled in
  EXISTS (
    SELECT 1 FROM public.learning_objectives lo
    JOIN public.modules m ON m.id = lo.module_id
    JOIN public.syllabi syl ON syl.id = m.syllabus_id
    JOIN public.enrollments e ON e.syllabus_id = syl.id
    WHERE lo.id = assessment_questions.learning_objective_id
    AND e.user_id = auth.uid()
    AND e.status = 'active'
  )
);

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_assessment_questions_learning_objective_id
ON public.assessment_questions(learning_objective_id);
```

**To apply this migration:**
1. Go to Supabase Dashboard → SQL Editor
2. Paste the SQL above
3. Click "Run"

---

## Task 1.4: Fix State Updates in complete-assessment

**Problem:** Sets wrong state on pass (`verified` instead of `passed`), no state update on fail

**File to modify:** `supabase/functions/complete-assessment/index.ts`

**Exact location:** Lines 145-162

**Find this code:**
```typescript
// Update learning objective verification state if passed
if (passed) {
  const { error: loError } = await supabase
    .from('learning_objectives')
    .update({
      verification_state: 'verified',
      updated_at: completedAt,
    })
    .eq('id', session.learning_objective_id)
    .eq('user_id', user.id);

  if (loError) {
    console.error('Error updating learning objective:', loError);
    // Don't fail the request, just log
  } else {
    console.log(`Updated LO ${session.learning_objective_id} to verified`);
  }
}
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
  // Don't fail the request, just log
} else {
  console.log(`Updated LO ${session.learning_objective_id} to ${newState}`);
}
```

---

## Task 1.5: Add Tests for Phase 1 Fixes

**File to create:** `src/components/assessment/QuestionCard.test.tsx`

**Full content:**

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
          { label: 'A', text: 'Option A text', is_correct: false },
          { label: 'B', text: 'Option B text', is_correct: true },
          { label: 'C', text: 'Option C text', is_correct: false },
          { label: 'D', text: 'Option D text', is_correct: false },
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

      expect(screen.getByText(/Option A text/)).toBeInTheDocument();
      expect(screen.getByText(/Option B text/)).toBeInTheDocument();
      expect(screen.getByText(/Option C text/)).toBeInTheDocument();
      expect(screen.getByText(/Option D text/)).toBeInTheDocument();
    });

    it('submits the option label (A, B, C, D) not the full text', () => {
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

      // Click on second option
      fireEvent.click(screen.getByText(/Second option/));

      // Submit
      fireEvent.click(screen.getByText('Submit Answer'));

      expect(mockOnSubmit).toHaveBeenCalledWith('B');
    });
  });

  describe('short answer rendering', () => {
    it('renders textarea for short answer questions', () => {
      const question = createMockQuestion({
        question_type: 'short_answer',
        options: null,
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

      expect(screen.getByPlaceholderText(/Type your answer/)).toBeInTheDocument();
    });
  });

  describe('true/false rendering', () => {
    it('renders True and False options', () => {
      const question = createMockQuestion({
        question_type: 'true_false',
        options: null,
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

      expect(screen.getByText('True')).toBeInTheDocument();
      expect(screen.getByText('False')).toBeInTheDocument();
    });
  });

  describe('feedback display', () => {
    it('shows correct answer when feedback is incorrect', () => {
      const question = createMockQuestion();

      render(
        <QuestionCard
          question={question}
          questionNumber={1}
          totalQuestions={5}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          feedback={{
            isCorrect: false,
            correctAnswer: 'B',
            timeTaken: 15,
          }}
          onNext={mockOnNext}
        />
      );

      expect(screen.getByText('Incorrect')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('shows success message when feedback is correct', () => {
      const question = createMockQuestion();

      render(
        <QuestionCard
          question={question}
          questionNumber={1}
          totalQuestions={5}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          feedback={{
            isCorrect: true,
            correctAnswer: null,
            timeTaken: 10,
          }}
          onNext={mockOnNext}
        />
      );

      expect(screen.getByText('Correct!')).toBeInTheDocument();
    });
  });
});
```

---

## Task 1.6: Verify Phase 1 Fixes

**Commands to run:**
```bash
# Run all tests
npm run test:run

# Deploy the edge function updates (follow your Supabase deployment process)
supabase functions deploy complete-assessment
supabase functions deploy generate-assessment-questions

# Apply the migration via Supabase Dashboard SQL Editor
```

**Manual verification checklist:**
1. [ ] Generate new assessment questions for a learning objective
2. [ ] Verify questions have `question_type: "mcq"` (not `multiple_choice`)
3. [ ] Start an assessment as a student
4. [ ] Verify MCQ options display with A, B, C, D labels
5. [ ] Complete an assessment with passing score (≥70%)
6. [ ] Verify LO state changes to `passed`
7. [ ] Complete an assessment with failing score (<70%)
8. [ ] Verify LO state changes to `remediation_required`

---

## Phase 1 Checklist

- [ ] Task 1.1: Question type enum fixed (`multiple_choice` → `mcq`)
- [ ] Task 1.2: MCQ options rendering fixed
- [ ] Task 1.3: RLS policy migration applied
- [ ] Task 1.4: complete-assessment state updates fixed
- [ ] Task 1.5: QuestionCard tests created and passing
- [ ] Task 1.6: Manual verification complete

---

# Phase 2: Error Handling Standardization

**Goal:** Use the existing error handler consistently across all functions.

---

## Task 2.1: Update start-assessment to Use Shared Error Handler

**File to modify:** `supabase/functions/start-assessment/index.ts`

**Add this import at the top (after line 2):**
```typescript
import {
  createErrorResponse,
  createSuccessResponse,
  logInfo,
  logError
} from '../_shared/error-handler.ts';
```

**Add constant after corsHeaders:**
```typescript
const FUNCTION_NAME = 'start-assessment';
```

**Replace error responses:**

| Find | Replace With |
|------|--------------|
| `return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: {...` | `return createErrorResponse('UNAUTHORIZED', corsHeaders, 'No authorization header');` |
| `return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: {...` | `return createErrorResponse('UNAUTHORIZED', corsHeaders);` |
| `return new Response(JSON.stringify({ error: 'No assessment questions available...' }), { status: 404, headers: {...` | `return createErrorResponse('NOT_FOUND', corsHeaders, 'No assessment questions available for this learning objective');` |
| `return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: {...` | `return createErrorResponse('INTERNAL_ERROR', corsHeaders, errorMessage);` |

**Replace console.log with structured logging:**

| Find | Replace With |
|------|--------------|
| `console.log(\`Starting assessment for LO: ${learning_objective_id}...\`)` | `logInfo(FUNCTION_NAME, 'starting_assessment', { learning_objective_id, user_id: user.id });` |
| `console.log(\`Created session ${session.id}...\`)` | `logInfo(FUNCTION_NAME, 'session_created', { session_id: session.id, question_count: questionIds.length });` |
| `console.error('Error creating session:', sessionError)` | `logError(FUNCTION_NAME, sessionError, { learning_objective_id, user_id: user.id });` |

---

## Task 2.2: Update submit-assessment-answer

**File to modify:** `supabase/functions/submit-assessment-answer/index.ts`

Apply the same pattern as Task 2.1:
1. Add imports from `_shared/error-handler.ts`
2. Add `const FUNCTION_NAME = 'submit-assessment-answer';`
3. Replace all `new Response(JSON.stringify({ error: ... }))` with `createErrorResponse()`
4. Replace all `console.log()` with `logInfo()`
5. Replace all `console.error()` with `logError()`

---

## Task 2.3: Update complete-assessment

**File to modify:** `supabase/functions/complete-assessment/index.ts`

Apply the same pattern as Task 2.1.

---

## Task 2.4: Update generate-assessment-questions

**File to modify:** `supabase/functions/generate-assessment-questions/index.ts`

Apply the same pattern, plus use `handleAIGatewayError()` for AI responses.

**Find this code (lines 220-236):**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error("AI gateway error:", response.status, errorText);
  ...
}
```

**Replace with:**
```typescript
import { handleAIGatewayError } from '../_shared/error-handler.ts';

// Then in the function:
if (!response.ok) {
  logError(FUNCTION_NAME, new Error(`AI gateway error: ${response.status}`));
  const errorResponse = handleAIGatewayError(response, corsHeaders);
  if (errorResponse) return errorResponse;
  throw new Error(`AI gateway error: ${response.status}`);
}
```

---

## Task 2.5: Update generate-micro-checks

**File to modify:** `supabase/functions/generate-micro-checks/index.ts`

Apply the same pattern as Tasks 2.1 and 2.4.

---

## Task 2.6: Add Input Validation with Zod

**File to create:** `supabase/functions/_shared/assessment-schemas.ts`

**Full content:**
```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const StartAssessmentSchema = z.object({
  learning_objective_id: z.string().uuid('Invalid learning objective ID'),
  num_questions: z.number().int().min(1).max(20).default(5),
});

export const SubmitAnswerSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
  question_id: z.string().uuid('Invalid question ID'),
  user_answer: z.string().min(1, 'Answer cannot be empty').max(5000, 'Answer too long'),
  client_question_served_at: z.string().datetime('Invalid timestamp'),
  client_answer_submitted_at: z.string().datetime('Invalid timestamp'),
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

## Task 2.7: Add Validation to start-assessment

**File to modify:** `supabase/functions/start-assessment/index.ts`

**Add import:**
```typescript
import { StartAssessmentSchema, validateRequest } from '../_shared/assessment-schemas.ts';
```

**Find this code:**
```typescript
const body: StartAssessmentRequest = await req.json();
const { learning_objective_id, num_questions = 5 } = body;
```

**Replace with:**
```typescript
const rawBody = await req.json();
const validation = validateRequest(StartAssessmentSchema, rawBody);

if (!validation.success) {
  return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.error);
}

const { learning_objective_id, num_questions } = validation.data;
```

---

## Phase 2 Checklist

- [ ] Task 2.1: start-assessment uses shared error handler
- [ ] Task 2.2: submit-assessment-answer uses shared error handler
- [ ] Task 2.3: complete-assessment uses shared error handler
- [ ] Task 2.4: generate-assessment-questions uses shared error handler
- [ ] Task 2.5: generate-micro-checks uses shared error handler
- [ ] Task 2.6: assessment-schemas.ts created with Zod schemas
- [ ] Task 2.7: Input validation added to all functions
- [ ] All edge functions deployed and tested

---

# Phase 3: Database & Performance

**Goal:** Optimize for scale and extract magic numbers.

---

## Task 3.1: Add Performance Indexes

**File to create:** `supabase/migrations/20260111000002_add_assessment_indexes.sql`

**Full content:**
```sql
-- Performance indexes for assessment system
-- These indexes optimize the most common query patterns

-- Composite index for session lookup (most common query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_user_lo_status
ON public.assessment_sessions(user_id, learning_objective_id, status);

-- Index for answer lookup by session (used in complete-assessment)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_answers_session_id
ON public.assessment_answers(session_id);

-- Index for question lookup by LO (used in start-assessment)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_questions_lo_id
ON public.assessment_questions(learning_objective_id);

-- Index for micro-check lookup by content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_micro_checks_content_id
ON public.micro_checks(content_id);

-- Index for micro-check results by consumption record
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_micro_check_results_consumption
ON public.micro_check_results(consumption_record_id);

-- Analyze tables to update statistics
ANALYZE public.assessment_sessions;
ANALYZE public.assessment_answers;
ANALYZE public.assessment_questions;
ANALYZE public.micro_checks;
ANALYZE public.micro_check_results;
```

---

## Task 3.2: Create Configuration File

**File to create:** `supabase/functions/_shared/assessment-config.ts`

**Full content:**
```typescript
/**
 * Assessment System Configuration
 * Centralizes all magic numbers and configuration values
 */

export const ASSESSMENT_CONFIG = {
  // Scoring
  PASSING_THRESHOLD: 70,          // Percentage required to pass

  // Question counts
  DEFAULT_QUESTIONS: 5,           // Default questions per assessment
  MIN_QUESTIONS: 1,               // Minimum questions allowed
  MAX_QUESTIONS: 20,              // Maximum questions allowed

  // Question distribution (must sum to 1.0)
  DIFFICULTY_DISTRIBUTION: {
    easy: 0.2,                    // 20% easy questions
    medium: 0.5,                  // 50% medium questions
    hard: 0.3,                    // 30% hard questions
  },

  // Timing
  DEFAULT_TIME_LIMIT_SECONDS: 45, // Default time per question
  TIMEOUT_MINUTES_PER_QUESTION: 5, // Session timeout per question
  MIN_ANSWER_TIME_SECONDS: 2,     // Minimum time to answer (anti-cheat)
  TIME_LIMIT_MULTIPLIER: 2,       // Max time = limit * multiplier

  // Rate limiting
  MAX_ATTEMPTS_PER_DAY: 5,        // Maximum assessment attempts per 24 hours
  RATE_LIMIT_WINDOW_HOURS: 24,    // Window for rate limiting

  // AI Evaluation
  AI_CONFIDENCE_THRESHOLD: 0.7,   // Minimum confidence for AI grading
  KEYWORD_MATCH_THRESHOLD: 0.7,   // Percentage of keywords needed
  MIN_ANSWER_LENGTH_FOR_AI: 10,   // Minimum chars to trigger AI evaluation
} as const;

// Type for the config
export type AssessmentConfig = typeof ASSESSMENT_CONFIG;

// Helper to get difficulty distribution counts
export function getDifficultyDistribution(totalQuestions: number): {
  easy: number;
  medium: number;
  hard: number;
} {
  const { DIFFICULTY_DISTRIBUTION } = ASSESSMENT_CONFIG;
  const easy = Math.max(1, Math.floor(totalQuestions * DIFFICULTY_DISTRIBUTION.easy));
  const medium = Math.max(1, Math.floor(totalQuestions * DIFFICULTY_DISTRIBUTION.medium));
  const hard = totalQuestions - easy - medium;

  return { easy, medium, hard };
}
```

---

## Task 3.3: Update Edge Functions to Use Config

**Files to modify:**
- `supabase/functions/start-assessment/index.ts`
- `supabase/functions/complete-assessment/index.ts`
- `supabase/functions/submit-assessment-answer/index.ts`

**Add import to each:**
```typescript
import { ASSESSMENT_CONFIG, getDifficultyDistribution } from '../_shared/assessment-config.ts';
```

**Replace magic numbers with config values** (see specific file locations in Phase 3 section).

---

## Phase 3 Checklist

- [ ] Task 3.1: Performance indexes migration applied
- [ ] Task 3.2: assessment-config.ts created
- [ ] Task 3.3: All edge functions use config values
- [ ] All edge functions redeployed

---

# Phase 4: State Machine Enforcement

**Goal:** Prevent invalid state transitions at the database level.

---

## Task 4.1: Create State Transition Trigger

**File to create:** `supabase/migrations/20260111000003_state_machine_trigger.sql`

**Full content:**
```sql
-- State Machine Enforcement for Learning Objectives
-- This trigger prevents invalid verification_state transitions

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
  -- Allow if no change to verification_state
  IF OLD.verification_state IS NOT DISTINCT FROM NEW.verification_state THEN
    RETURN NEW;
  END IF;

  -- Allow setting initial state from NULL
  IF OLD.verification_state IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get allowed transitions for current state
  allowed_states := valid_transitions -> OLD.verification_state;

  -- Check if the new state is in the allowed list
  IF allowed_states IS NULL OR NOT (allowed_states ? NEW.verification_state) THEN
    RAISE EXCEPTION 'Invalid state transition from "%" to "%". Allowed transitions: %',
      OLD.verification_state,
      NEW.verification_state,
      COALESCE(allowed_states::TEXT, '[]');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_verification_state_transition ON public.learning_objectives;

-- Create the trigger
CREATE TRIGGER enforce_verification_state_transition
BEFORE UPDATE ON public.learning_objectives
FOR EACH ROW
WHEN (OLD.verification_state IS DISTINCT FROM NEW.verification_state)
EXECUTE FUNCTION validate_verification_state_transition();
```

---

## Phase 4 Checklist

- [ ] Task 4.1: State transition trigger migration applied
- [ ] Verified valid transitions work
- [ ] Verified invalid transitions are blocked

---

# Phase 5: UI Enhancements

**Goal:** Complete the student experience with missing UI features.

---

## Task 5.1: Show Session Resume Indicator

**File to modify:** `src/components/assessment/AssessmentSession.tsx`

**Add state after line 65:**
```typescript
const [isResumed, setIsResumed] = useState(false);
```

**Update handleStart to track resume (add before `setSessionState('active')`):**
```typescript
setIsResumed(result.is_resumed);
```

**Update the header in the active state to show resume indicator:**
```typescript
{isResumed && (
  <p className="text-sm text-muted-foreground">
    Resuming previous session
  </p>
)}
```

---

## Task 5.2: Create Attempt History Component

**File to create:** `src/components/assessment/AttemptHistory.tsx`

**Full content:**
```typescript
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useSessionHistory, type AssessmentSession } from '@/hooks/useAssessment';

interface AttemptHistoryProps {
  learningObjectiveId: string;
}

export function AttemptHistory({ learningObjectiveId }: AttemptHistoryProps) {
  const { data: sessions, isLoading } = useSessionHistory(learningObjectiveId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">Loading history...</p>
        </CardContent>
      </Card>
    );
  }

  const completedSessions = sessions?.filter(s => s.status === 'completed') || [];

  if (completedSessions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Previous Attempts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {completedSessions.slice(0, 3).map((session) => (
          <div key={session.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              {session.passed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium">Attempt {session.attempt_number}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {session.completed_at
                    ? format(new Date(session.completed_at), 'MMM d, yyyy')
                    : 'In progress'}
                </p>
              </div>
            </div>
            <Badge variant={session.passed ? 'default' : 'destructive'}>
              {Math.round(session.total_score ?? 0)}%
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## Task 5.3: Integrate Attempt History

**File to modify:** `src/components/assessment/AssessmentSession.tsx`

**Add import:**
```typescript
import { AttemptHistory } from './AttemptHistory';
```

**Update idle state to include AttemptHistory before the card.**

---

## Task 5.4: Create Remediation Banner

**File to create:** `src/components/assessment/RemediationBanner.tsx`

(See full content in the detailed plan above)

---

## Task 5.5: Show Question Explanations

**File to modify:** `src/components/assessment/QuestionCard.tsx`

Add explanation display after correct answer feedback.

---

## Phase 5 Checklist

- [ ] Task 5.1: Session resume indicator added
- [ ] Task 5.2: AttemptHistory component created
- [ ] Task 5.3: Attempt history integrated
- [ ] Task 5.4: RemediationBanner component created
- [ ] Task 5.5: Question explanations displayed

---

# Phase 6: Production Hardening

**Goal:** Add rate limiting, monitoring, and final polish.

---

## Task 6.1: Add Rate Limiting to start-assessment

**File to modify:** `supabase/functions/start-assessment/index.ts`

**Add after user authentication:**
```typescript
const { MAX_ATTEMPTS_PER_DAY, RATE_LIMIT_WINDOW_HOURS } = ASSESSMENT_CONFIG;

const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

const { count: recentAttempts } = await supabase
  .from('assessment_sessions')
  .select('*', { count: 'exact', head: true })
  .eq('learning_objective_id', learning_objective_id)
  .eq('user_id', user.id)
  .gte('started_at', windowStart);

if ((recentAttempts || 0) >= MAX_ATTEMPTS_PER_DAY) {
  return createErrorResponse(
    'RATE_LIMIT_EXCEEDED',
    corsHeaders,
    `Maximum ${MAX_ATTEMPTS_PER_DAY} attempts per ${RATE_LIMIT_WINDOW_HOURS} hours reached.`
  );
}
```

---

## Task 6.2: Create Analytics Tracking

**File to create:** `src/lib/assessment-analytics.ts`

(See full content in the detailed plan above)

---

## Phase 6 Checklist

- [ ] Task 6.1: Rate limiting added
- [ ] Task 6.2: Analytics tracking created
- [ ] All tests passing

---

# Final Deployment Checklist

## Pre-Deployment

- [ ] All tests passing (`npm run test:run`)
- [ ] No TypeScript errors (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Deployment Order

1. **Apply database migrations** (in order):
   - `20260111000001_fix_assessment_questions_rls.sql`
   - `20260111000002_add_assessment_indexes.sql`
   - `20260111000003_state_machine_trigger.sql`

2. **Deploy edge functions**:
   ```bash
   supabase functions deploy start-assessment
   supabase functions deploy submit-assessment-answer
   supabase functions deploy complete-assessment
   supabase functions deploy generate-assessment-questions
   supabase functions deploy generate-micro-checks
   ```

3. **Deploy frontend**:
   ```bash
   npm run build
   ```

## Post-Deployment Verification

- [ ] Generate new assessment questions → `question_type = 'mcq'`
- [ ] Students can start assessments → questions load correctly
- [ ] MCQ options display → A, B, C, D labels visible
- [ ] Pass assessment → state changes to `passed`
- [ ] Fail assessment → state changes to `remediation_required`
- [ ] Rate limiting → blocks after 5 attempts

---

# Summary

| Phase | Priority | Description |
|-------|----------|-------------|
| Phase 0 | Required First | Testing infrastructure |
| Phase 1 | CRITICAL | Fix broken functionality |
| Phase 2 | HIGH | Standardize error handling |
| Phase 3 | MEDIUM | Database optimization |
| Phase 4 | HIGH | State machine enforcement |
| Phase 5 | MEDIUM | UI enhancements |
| Phase 6 | MEDIUM | Production hardening |

**Total new files:** 12
**Total files to modify:** 10
**Database migrations:** 3

---

*Document end. Follow phases in order. Do not skip Phase 0 or Phase 1.*
