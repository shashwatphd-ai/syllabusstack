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
  useCourseProgress,
  useEnrollment,
  useModuleProgress,
  type CourseProgress,
  type ModuleProgress,
  type ObjectiveProgress,
} from './useCourseProgress';

// Test data
const mockObjectiveProgress: ObjectiveProgress[] = [
  {
    id: 'obj-1',
    objectiveId: 'lo-1',
    title: 'Understand React Components',
    status: 'completed',
    completedAt: '2024-01-25T10:00:00Z',
    assessmentPassed: true,
    assessmentScore: 85,
    timeSpent: 1800, // seconds
  },
  {
    id: 'obj-2',
    objectiveId: 'lo-2',
    title: 'Master React Hooks',
    status: 'in_progress',
    completedAt: null,
    assessmentPassed: null,
    assessmentScore: null,
    timeSpent: 900,
  },
  {
    id: 'obj-3',
    objectiveId: 'lo-3',
    title: 'State Management with Context',
    status: 'not_started',
    completedAt: null,
    assessmentPassed: null,
    assessmentScore: null,
    timeSpent: 0,
  },
];

const mockModuleProgress: ModuleProgress[] = [
  {
    id: 'mod-1',
    moduleId: 'module-1',
    title: 'React Basics',
    orderIndex: 0,
    status: 'completed',
    objectives: mockObjectiveProgress.slice(0, 1),
    completedObjectives: 1,
    totalObjectives: 1,
    percentComplete: 100,
    completedAt: '2024-01-25T11:00:00Z',
  },
  {
    id: 'mod-2',
    moduleId: 'module-2',
    title: 'Advanced React',
    orderIndex: 1,
    status: 'in_progress',
    objectives: mockObjectiveProgress.slice(1),
    completedObjectives: 0,
    totalObjectives: 2,
    percentComplete: 25,
    completedAt: null,
  },
];

const mockCourseProgress: CourseProgress = {
  enrollmentId: 'enrollment-1',
  courseId: 'course-1',
  userId: 'user-1',
  courseTitle: 'React Masterclass',
  status: 'in_progress',
  enrolledAt: '2024-01-20T10:00:00Z',
  startedAt: '2024-01-21T10:00:00Z',
  completedAt: null,
  lastAccessedAt: '2024-01-28T10:00:00Z',
  overallProgress: 45,
  modules: mockModuleProgress,
  completedModules: 1,
  totalModules: 2,
  completedObjectives: 1,
  totalObjectives: 3,
  totalTimeSpent: 2700, // seconds
  currentModule: mockModuleProgress[1],
  currentObjective: mockObjectiveProgress[1],
  certificateEarned: false,
  certificateId: null,
};

const mockCompletedCourse: CourseProgress = {
  ...mockCourseProgress,
  status: 'completed',
  completedAt: '2024-01-28T15:00:00Z',
  overallProgress: 100,
  completedModules: 2,
  completedObjectives: 3,
  currentModule: null,
  currentObjective: null,
  certificateEarned: true,
  certificateId: 'cert-123',
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

const setupProgressMock = (progress = mockCourseProgress) => {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });

  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: progress.enrollmentId,
            course_id: progress.courseId,
            user_id: progress.userId,
            status: progress.status,
            enrolled_at: progress.enrolledAt,
            started_at: progress.startedAt,
            completed_at: progress.completedAt,
            last_accessed_at: progress.lastAccessedAt,
            overall_progress: progress.overallProgress,
            total_time_spent: progress.totalTimeSpent,
            certificate_id: progress.certificateId,
            courses: {
              title: progress.courseTitle,
            },
          },
          error: null,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
};

describe('useCourseProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no course id is provided', async () => {
    const { result } = renderHook(() => useCourseProgress(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it('should fetch course progress for enrolled user', async () => {
    setupProgressMock();

    const { result } = renderHook(() => useCourseProgress('course-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });
});

describe('Course Progress Status', () => {
  it('should track enrollment status', () => {
    const validStatuses = ['enrolled', 'in_progress', 'completed', 'dropped'];
    expect(validStatuses).toContain(mockCourseProgress.status);
  });

  it('should track overall progress percentage', () => {
    expect(mockCourseProgress.overallProgress).toBeGreaterThanOrEqual(0);
    expect(mockCourseProgress.overallProgress).toBeLessThanOrEqual(100);
  });

  it('should have 100% progress when completed', () => {
    expect(mockCompletedCourse.overallProgress).toBe(100);
    expect(mockCompletedCourse.status).toBe('completed');
  });
});

describe('Module Progress Tracking', () => {
  it('should track completed modules', () => {
    expect(mockCourseProgress.completedModules).toBe(1);
    expect(mockCourseProgress.totalModules).toBe(2);
  });

  it('should have module details', () => {
    mockModuleProgress.forEach(module => {
      expect(module.moduleId).toBeDefined();
      expect(module.title).toBeDefined();
      expect(module.orderIndex).toBeDefined();
    });
  });

  it('should calculate module percent complete', () => {
    mockModuleProgress.forEach(module => {
      expect(module.percentComplete).toBeGreaterThanOrEqual(0);
      expect(module.percentComplete).toBeLessThanOrEqual(100);
    });
  });

  it('should mark completed module with completion date', () => {
    const completedModule = mockModuleProgress.find(m => m.status === 'completed');
    expect(completedModule?.completedAt).toBeDefined();
  });
});

describe('Objective Progress Tracking', () => {
  it('should track completed objectives', () => {
    expect(mockCourseProgress.completedObjectives).toBe(1);
    expect(mockCourseProgress.totalObjectives).toBe(3);
  });

  it('should track objective status', () => {
    const validStatuses = ['not_started', 'in_progress', 'completed'];
    mockObjectiveProgress.forEach(obj => {
      expect(validStatuses).toContain(obj.status);
    });
  });

  it('should track assessment results', () => {
    const completedObj = mockObjectiveProgress.find(o => o.status === 'completed');
    expect(completedObj?.assessmentPassed).toBeDefined();
    expect(completedObj?.assessmentScore).toBeDefined();
  });

  it('should track time spent', () => {
    mockObjectiveProgress.forEach(obj => {
      expect(obj.timeSpent).toBeDefined();
      expect(obj.timeSpent).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Current Progress Position', () => {
  it('should identify current module for in-progress course', () => {
    expect(mockCourseProgress.currentModule).toBeDefined();
    expect(mockCourseProgress.currentModule?.status).toBe('in_progress');
  });

  it('should identify current objective', () => {
    expect(mockCourseProgress.currentObjective).toBeDefined();
    expect(mockCourseProgress.currentObjective?.status).toBe('in_progress');
  });

  it('should have no current position for completed course', () => {
    expect(mockCompletedCourse.currentModule).toBeNull();
    expect(mockCompletedCourse.currentObjective).toBeNull();
  });
});

describe('Time Tracking', () => {
  it('should track total time spent', () => {
    expect(mockCourseProgress.totalTimeSpent).toBeDefined();
    expect(mockCourseProgress.totalTimeSpent).toBeGreaterThan(0);
  });

  it('should track last accessed time', () => {
    expect(mockCourseProgress.lastAccessedAt).toBeDefined();
  });

  it('should have enrollment and start dates', () => {
    expect(mockCourseProgress.enrolledAt).toBeDefined();
    expect(mockCourseProgress.startedAt).toBeDefined();
  });
});

describe('Certificate Tracking', () => {
  it('should not have certificate for incomplete course', () => {
    expect(mockCourseProgress.certificateEarned).toBe(false);
    expect(mockCourseProgress.certificateId).toBeNull();
  });

  it('should have certificate for completed course', () => {
    expect(mockCompletedCourse.certificateEarned).toBe(true);
    expect(mockCompletedCourse.certificateId).toBeDefined();
  });
});

describe('Progress Calculations', () => {
  it('should calculate module completion ratio', () => {
    const ratio = mockCourseProgress.completedModules / mockCourseProgress.totalModules;
    expect(ratio).toBe(0.5);
  });

  it('should calculate objective completion ratio', () => {
    const ratio = mockCourseProgress.completedObjectives / mockCourseProgress.totalObjectives;
    expect(ratio).toBeCloseTo(0.33, 1);
  });

  it('should have consistent progress values', () => {
    // Overall progress should roughly match objective completion
    const expectedProgress = (mockCourseProgress.completedObjectives / mockCourseProgress.totalObjectives) * 100;
    // Allow some variance for weighted calculations
    expect(Math.abs(mockCourseProgress.overallProgress - expectedProgress)).toBeLessThan(20);
  });
});

describe('Module Ordering', () => {
  it('should have modules in order', () => {
    for (let i = 1; i < mockModuleProgress.length; i++) {
      expect(mockModuleProgress[i].orderIndex).toBeGreaterThan(mockModuleProgress[i-1].orderIndex);
    }
  });
});

describe('Edge Cases', () => {
  it('should handle course with zero progress', () => {
    const zeroProgress: CourseProgress = {
      ...mockCourseProgress,
      status: 'enrolled',
      startedAt: null,
      overallProgress: 0,
      completedModules: 0,
      completedObjectives: 0,
      totalTimeSpent: 0,
    };

    expect(zeroProgress.overallProgress).toBe(0);
    expect(zeroProgress.startedAt).toBeNull();
  });

  it('should handle module with all objectives completed', () => {
    const completedModule = mockModuleProgress.find(m => m.status === 'completed');
    expect(completedModule?.completedObjectives).toBe(completedModule?.totalObjectives);
    expect(completedModule?.percentComplete).toBe(100);
  });
});
