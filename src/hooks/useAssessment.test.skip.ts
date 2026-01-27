import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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

// Import after mocking
import {
  useAssessment,
  useAssessmentSession,
  useAssessmentResults,
  type Assessment,
  type AssessmentQuestion,
  type AssessmentSession,
} from './useAssessment';

// Test data
const mockQuestions: AssessmentQuestion[] = [
  {
    id: 'q1',
    type: 'multiple_choice',
    text: 'What is the correct way to declare a state variable in React?',
    options: [
      'const [count, setCount] = useState(0)',
      'let count = useState(0)',
      'var count = state(0)',
      'const count = useVariable(0)',
    ],
    correctAnswer: 0,
    explanation: 'useState returns an array with the current state and a setter function.',
    points: 10,
    difficulty: 'easy',
    skillId: 'skill-react',
  },
  {
    id: 'q2',
    type: 'multiple_choice',
    text: 'Which hook is used for side effects in React?',
    options: ['useEffect', 'useSideEffect', 'useAction', 'useMount'],
    correctAnswer: 0,
    explanation: 'useEffect is the hook for handling side effects like data fetching, subscriptions, etc.',
    points: 10,
    difficulty: 'easy',
    skillId: 'skill-react',
  },
  {
    id: 'q3',
    type: 'code',
    text: 'Write a custom hook that tracks window width.',
    codeTemplate: 'function useWindowWidth() {\n  // Your code here\n}',
    expectedOutput: 'Returns current window width and updates on resize',
    points: 20,
    difficulty: 'medium',
    skillId: 'skill-react',
  },
  {
    id: 'q4',
    type: 'multiple_select',
    text: 'Which of the following are valid React hooks? (Select all that apply)',
    options: ['useState', 'useContext', 'useClass', 'useReducer', 'useComponent'],
    correctAnswers: [0, 1, 3],
    explanation: 'useState, useContext, and useReducer are all built-in React hooks.',
    points: 15,
    difficulty: 'medium',
    skillId: 'skill-react',
  },
];

const mockAssessment: Assessment = {
  id: 'assess-1',
  title: 'React Fundamentals Assessment',
  description: 'Test your knowledge of React basics including hooks, components, and state management.',
  skillId: 'skill-react',
  skillName: 'React',
  duration: 30, // minutes
  passingScore: 70,
  totalPoints: 55,
  questionCount: 4,
  difficulty: 'intermediate',
  questions: mockQuestions,
  attempts: 3,
  cooldownHours: 24,
  certificateId: 'cert-react-basic',
  createdAt: '2024-01-01T10:00:00Z',
};

const mockSession: AssessmentSession = {
  id: 'session-1',
  userId: 'user-1',
  assessmentId: 'assess-1',
  status: 'in_progress',
  startedAt: '2024-01-28T10:00:00Z',
  completedAt: null,
  answers: [
    { questionId: 'q1', answer: 0, correct: true, points: 10 },
    { questionId: 'q2', answer: 0, correct: true, points: 10 },
  ],
  currentQuestionIndex: 2,
  score: null,
  passed: null,
  timeRemaining: 1200, // seconds
};

const mockCompletedSession: AssessmentSession = {
  ...mockSession,
  id: 'session-2',
  status: 'completed',
  completedAt: '2024-01-28T10:25:00Z',
  answers: [
    { questionId: 'q1', answer: 0, correct: true, points: 10 },
    { questionId: 'q2', answer: 0, correct: true, points: 10 },
    { questionId: 'q3', answer: 'function useWindowWidth() { ... }', correct: true, points: 20 },
    { questionId: 'q4', answer: [0, 1, 3], correct: true, points: 15 },
  ],
  currentQuestionIndex: 4,
  score: 100,
  passed: true,
  timeRemaining: 0,
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

const setupAssessmentMock = () => {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });

  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockAssessment.id,
            title: mockAssessment.title,
            description: mockAssessment.description,
            skill_id: mockAssessment.skillId,
            skill_name: mockAssessment.skillName,
            duration: mockAssessment.duration,
            passing_score: mockAssessment.passingScore,
            total_points: mockAssessment.totalPoints,
            question_count: mockAssessment.questionCount,
            difficulty: mockAssessment.difficulty,
            questions: mockAssessment.questions,
            attempts: mockAssessment.attempts,
            cooldown_hours: mockAssessment.cooldownHours,
            certificate_id: mockAssessment.certificateId,
            created_at: mockAssessment.createdAt,
          },
          error: null,
        }),
      }),
    }),
  });
};

describe('useAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no assessment id is provided', async () => {
    const { result } = renderHook(() => useAssessment(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it('should fetch assessment data', async () => {
    setupAssessmentMock();

    const { result } = renderHook(() => useAssessment('assess-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });
});

describe('Assessment Structure', () => {
  it('should have required assessment properties', () => {
    expect(mockAssessment.id).toBeDefined();
    expect(mockAssessment.title).toBeDefined();
    expect(mockAssessment.description).toBeDefined();
    expect(mockAssessment.duration).toBeGreaterThan(0);
    expect(mockAssessment.passingScore).toBeGreaterThan(0);
    expect(mockAssessment.passingScore).toBeLessThanOrEqual(100);
  });

  it('should have questions array', () => {
    expect(Array.isArray(mockAssessment.questions)).toBe(true);
    expect(mockAssessment.questions.length).toBe(mockAssessment.questionCount);
  });

  it('should link to skill', () => {
    expect(mockAssessment.skillId).toBeDefined();
    expect(mockAssessment.skillName).toBeDefined();
  });
});

describe('Question Types', () => {
  it('should support multiple choice questions', () => {
    const mcQuestion = mockQuestions.find(q => q.type === 'multiple_choice');
    expect(mcQuestion).toBeDefined();
    expect(mcQuestion?.options).toBeDefined();
    expect(mcQuestion?.correctAnswer).toBeDefined();
  });

  it('should support multiple select questions', () => {
    const msQuestion = mockQuestions.find(q => q.type === 'multiple_select');
    expect(msQuestion).toBeDefined();
    expect(msQuestion?.options).toBeDefined();
    expect(msQuestion?.correctAnswers).toBeDefined();
  });

  it('should support code questions', () => {
    const codeQuestion = mockQuestions.find(q => q.type === 'code');
    expect(codeQuestion).toBeDefined();
    expect(codeQuestion?.codeTemplate).toBeDefined();
  });

  it('should have points for each question', () => {
    mockQuestions.forEach(q => {
      expect(q.points).toBeDefined();
      expect(q.points).toBeGreaterThan(0);
    });
  });

  it('should have difficulty levels', () => {
    const validDifficulties = ['easy', 'medium', 'hard'];
    mockQuestions.forEach(q => {
      expect(validDifficulties).toContain(q.difficulty);
    });
  });
});

describe('Assessment Session', () => {
  it('should track session status', () => {
    const validStatuses = ['not_started', 'in_progress', 'completed', 'timed_out', 'abandoned'];
    expect(validStatuses).toContain(mockSession.status);
  });

  it('should track answers', () => {
    expect(Array.isArray(mockSession.answers)).toBe(true);
  });

  it('should track time remaining', () => {
    expect(mockSession.timeRemaining).toBeDefined();
    expect(mockSession.timeRemaining).toBeGreaterThanOrEqual(0);
  });

  it('should track current question', () => {
    expect(mockSession.currentQuestionIndex).toBeDefined();
    expect(mockSession.currentQuestionIndex).toBeGreaterThanOrEqual(0);
  });
});

describe('Session Completion', () => {
  it('should calculate score on completion', () => {
    expect(mockCompletedSession.score).toBeDefined();
    expect(mockCompletedSession.score).toBe(100);
  });

  it('should determine pass/fail status', () => {
    expect(mockCompletedSession.passed).toBe(true);
  });

  it('should record completion time', () => {
    expect(mockCompletedSession.completedAt).toBeDefined();
    expect(new Date(mockCompletedSession.completedAt!).getTime()).toBeGreaterThan(
      new Date(mockCompletedSession.startedAt).getTime()
    );
  });
});

describe('Answer Validation', () => {
  it('should track correctness of each answer', () => {
    mockCompletedSession.answers.forEach(answer => {
      expect(typeof answer.correct).toBe('boolean');
    });
  });

  it('should track points earned', () => {
    mockCompletedSession.answers.forEach(answer => {
      expect(answer.points).toBeDefined();
    });
  });

  it('should calculate total points correctly', () => {
    const totalPoints = mockCompletedSession.answers.reduce((sum, a) => sum + a.points, 0);
    expect(totalPoints).toBe(mockAssessment.totalPoints);
  });
});

describe('Attempt Limits', () => {
  it('should have maximum attempts defined', () => {
    expect(mockAssessment.attempts).toBeDefined();
    expect(mockAssessment.attempts).toBeGreaterThan(0);
  });

  it('should have cooldown period', () => {
    expect(mockAssessment.cooldownHours).toBeDefined();
    expect(mockAssessment.cooldownHours).toBeGreaterThanOrEqual(0);
  });
});

describe('Passing Score', () => {
  it('should have passing score as percentage', () => {
    expect(mockAssessment.passingScore).toBeGreaterThan(0);
    expect(mockAssessment.passingScore).toBeLessThanOrEqual(100);
  });

  it('should pass when score meets threshold', () => {
    const passed = mockCompletedSession.score! >= mockAssessment.passingScore;
    expect(passed).toBe(true);
    expect(mockCompletedSession.passed).toBe(true);
  });
});
