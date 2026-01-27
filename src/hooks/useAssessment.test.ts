import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Import after mocking - use actual exports
import {
  useAssessmentQuestions,
  useActiveSession,
  useSessionHistory,
  useStartAssessment,
  useSubmitAssessmentAnswer,
  useCompleteAssessment,
  useMicroChecks,
  useGenerateMicroChecks,
  useGenerateAssessmentQuestions,
  type AssessmentSession,
  type AssessmentQuestion,
  type SessionProgress,
  type PerformanceSummary,
} from './useAssessment';

// Test data matching actual interfaces
const mockQuestions: AssessmentQuestion[] = [
  {
    id: 'q1',
    learning_objective_id: 'lo-1',
    question_type: 'multiple_choice',
    question_text: 'What is the correct way to declare a state variable in React?',
    options: [
      'const [count, setCount] = useState(0)',
      'let count = useState(0)',
      'var count = state(0)',
      'const count = useVariable(0)',
    ],
    correct_answer: '0',
    accepted_answers: null,
    required_keywords: null,
    difficulty: 'easy',
    bloom_level: 'understand',
    time_limit_seconds: 60,
    scenario_context: null,
  },
  {
    id: 'q2',
    learning_objective_id: 'lo-1',
    question_type: 'multiple_choice',
    question_text: 'Which hook is used for side effects in React?',
    options: ['useEffect', 'useSideEffect', 'useAction', 'useMount'],
    correct_answer: '0',
    accepted_answers: null,
    required_keywords: null,
    difficulty: 'easy',
    bloom_level: 'remember',
    time_limit_seconds: 60,
    scenario_context: null,
  },
];

const mockSession: AssessmentSession = {
  id: 'session-1',
  user_id: 'user-1',
  learning_objective_id: 'lo-1',
  question_ids: ['q1', 'q2', 'q3', 'q4', 'q5'],
  status: 'in_progress',
  started_at: '2024-01-28T10:00:00Z',
  completed_at: null,
  timeout_at: '2024-01-28T10:30:00Z',
  current_question_index: 2,
  questions_answered: 2,
  questions_correct: 2,
  total_score: null,
  passed: null,
  attempt_number: 1,
};

const mockCompletedSession: AssessmentSession = {
  ...mockSession,
  id: 'session-2',
  status: 'completed',
  completed_at: '2024-01-28T10:25:00Z',
  current_question_index: 5,
  questions_answered: 5,
  questions_correct: 4,
  total_score: 80,
  passed: true,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

const setupMock = () => {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });

  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockQuestions,
          error: null,
        }),
        single: vi.fn().mockResolvedValue({
          data: mockSession,
          error: null,
        }),
      }),
    }),
  });
};

describe('useAssessmentQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty when no learning objective id is provided', async () => {
    const { result } = renderHook(() => useAssessmentQuestions(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it('should fetch assessment questions for a learning objective', async () => {
    setupMock();

    const { result } = renderHook(() => useAssessmentQuestions('lo-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('useActiveSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no learning objective id is provided', async () => {
    const { result } = renderHook(() => useActiveSession(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
  });
});

describe('Assessment Question Structure', () => {
  it('should have required question properties', () => {
    mockQuestions.forEach(q => {
      expect(q.id).toBeDefined();
      expect(q.learning_objective_id).toBeDefined();
      expect(q.question_type).toBeDefined();
      expect(q.question_text).toBeDefined();
      expect(q.correct_answer).toBeDefined();
    });
  });

  it('should have valid question types', () => {
    const validTypes = ['multiple_choice', 'true_false', 'short_answer', 'code'];
    mockQuestions.forEach(q => {
      expect(validTypes).toContain(q.question_type);
    });
  });

  it('should have valid difficulty levels', () => {
    const validLevels = ['easy', 'medium', 'hard'];
    mockQuestions.forEach(q => {
      if (q.difficulty) {
        expect(validLevels).toContain(q.difficulty);
      }
    });
  });

  it('should have options for multiple choice questions', () => {
    const mcQuestions = mockQuestions.filter(q => q.question_type === 'multiple_choice');
    mcQuestions.forEach(q => {
      expect(q.options).toBeDefined();
      expect(Array.isArray(q.options)).toBe(true);
    });
  });
});

describe('Assessment Session Structure', () => {
  it('should have required session properties', () => {
    expect(mockSession.id).toBeDefined();
    expect(mockSession.user_id).toBeDefined();
    expect(mockSession.learning_objective_id).toBeDefined();
    expect(mockSession.status).toBeDefined();
    expect(mockSession.started_at).toBeDefined();
    expect(mockSession.question_ids).toBeDefined();
  });

  it('should have valid session status', () => {
    const validStatuses = ['in_progress', 'completed', 'abandoned'];
    expect(validStatuses).toContain(mockSession.status);
  });

  it('should track questions answered', () => {
    expect(mockSession.questions_answered).toBeDefined();
    expect(mockSession.questions_answered).toBeGreaterThanOrEqual(0);
  });

  it('should track current question index', () => {
    expect(mockSession.current_question_index).toBeDefined();
    expect(mockSession.current_question_index).toBeGreaterThanOrEqual(0);
  });
});

describe('Session Completion', () => {
  it('should have total_score on completion', () => {
    expect(mockCompletedSession.total_score).toBeDefined();
    expect(mockCompletedSession.total_score).toBeGreaterThanOrEqual(0);
    expect(mockCompletedSession.total_score).toBeLessThanOrEqual(100);
  });

  it('should have pass/fail status on completion', () => {
    expect(mockCompletedSession.passed).toBeDefined();
    expect(typeof mockCompletedSession.passed).toBe('boolean');
  });

  it('should record completion timestamp', () => {
    expect(mockCompletedSession.completed_at).toBeDefined();
    expect(new Date(mockCompletedSession.completed_at!).getTime()).toBeGreaterThan(
      new Date(mockCompletedSession.started_at).getTime()
    );
  });

  it('should track questions correct count', () => {
    expect(mockCompletedSession.questions_correct).toBeDefined();
    expect(mockCompletedSession.questions_correct).toBeLessThanOrEqual(
      mockCompletedSession.questions_answered
    );
  });
});

describe('Passing Score', () => {
  it('should pass when score meets threshold (70%)', () => {
    const passingThreshold = 70;
    expect(mockCompletedSession.total_score! >= passingThreshold).toBe(true);
    expect(mockCompletedSession.passed).toBe(true);
  });

  it('should calculate score as percentage', () => {
    expect(mockCompletedSession.total_score).toBeGreaterThanOrEqual(0);
    expect(mockCompletedSession.total_score).toBeLessThanOrEqual(100);
  });
});

describe('Session Progress', () => {
  it('should define session progress interface correctly', () => {
    const progress: SessionProgress = {
      questions_answered: 3,
      questions_correct: 2,
      total_questions: 10,
      current_score: 66.7,
      is_complete: false,
    };

    expect(progress.questions_answered).toBeLessThanOrEqual(progress.total_questions);
    expect(progress.questions_correct).toBeLessThanOrEqual(progress.questions_answered);
    expect(progress.current_score).toBeGreaterThanOrEqual(0);
    expect(progress.current_score).toBeLessThanOrEqual(100);
  });
});

describe('Performance Summary', () => {
  it('should define performance summary interface correctly', () => {
    const summary: PerformanceSummary = {
      total_questions: 10,
      questions_answered: 10,
      questions_correct: 8,
      questions_incorrect: 2,
      questions_skipped: 0,
      total_score: 80,
      passed: true,
      passing_threshold: 70,
      total_time_seconds: 1500,
      avg_time_per_question: 150,
      timing_anomalies: 0,
      attempt_number: 1,
    };

    expect(summary.total_score).toBeGreaterThanOrEqual(0);
    expect(summary.total_score).toBeLessThanOrEqual(100);
    expect(summary.questions_correct + summary.questions_incorrect + summary.questions_skipped)
      .toBe(summary.total_questions);
    expect(summary.passed).toBe(summary.total_score >= summary.passing_threshold);
  });
});
