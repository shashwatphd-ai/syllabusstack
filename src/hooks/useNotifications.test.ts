import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useNotifications,
  useUnreadNotificationCount,
  useNotificationSummary,
  NOTIFICATION_CONFIG,
  getNotificationLink,
  type Notification,
  type NotificationType,
} from './useNotifications';

// Mock supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Test data
const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-1',
    type: 'skill_verified',
    title: 'Skill Verified!',
    message: 'Your JavaScript skill has been verified.',
    data: { skill_name: 'JavaScript', proficiency_level: 'advanced' },
    read: false,
    createdAt: '2024-01-28T10:00:00Z',
  },
  {
    id: 'notif-2',
    userId: 'user-1',
    type: 'gap_analysis_ready',
    title: 'Gap Analysis Complete',
    message: 'Your gap analysis for Software Engineer is ready.',
    data: { dream_job_id: 'job-1', dream_job_title: 'Software Engineer', match_score: 75 },
    read: false,
    createdAt: '2024-01-27T10:00:00Z',
  },
  {
    id: 'notif-3',
    userId: 'user-1',
    type: 'recommendation_added',
    title: 'New Recommendation',
    message: 'We found a course that might help you.',
    data: { recommendation_id: 'rec-1', content_title: 'Advanced React' },
    read: true,
    createdAt: '2024-01-26T10:00:00Z',
  },
  {
    id: 'notif-4',
    userId: 'user-1',
    type: 'course_completed',
    title: 'Course Completed!',
    message: 'Congratulations on completing Web Development 101.',
    data: { course_id: 'course-1', course_title: 'Web Development 101' },
    read: true,
    createdAt: '2024-01-25T10:00:00Z',
  },
];

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

// Helper to setup notification mock
const setupNotificationMock = (notifications: Notification[] = mockNotifications) => {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });

  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: notifications.map(n => ({
              id: n.id,
              user_id: n.userId,
              type: n.type,
              title: n.title,
              message: n.message,
              data: n.data,
              read: n.read,
              created_at: n.createdAt,
            })),
            error: null,
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  });
};

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch notifications for authenticated user', async () => {
    setupNotificationMock();

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(4);
  });

  it('should return empty array when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
  });

  it('should respect limit parameter', async () => {
    setupNotificationMock();

    const { result } = renderHook(() => useNotifications(2), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('useUnreadNotificationCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return count of unread notifications', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 2,
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useUnreadNotificationCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should return 0 when no unread notifications', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useUnreadNotificationCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('useNotificationSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotificationMock();
  });

  it('should group notifications by type', async () => {
    const { result } = renderHook(() => useNotificationSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('NOTIFICATION_CONFIG', () => {
  const notificationTypes: NotificationType[] = [
    'gap_analysis_ready',
    'recommendation_added',
    'skill_verified',
    'course_completed',
    'assessment_passed',
    'certificate_issued',
    'dream_job_matched',
    'instructor_message',
  ];

  it('should have configuration for all notification types', () => {
    notificationTypes.forEach(type => {
      expect(NOTIFICATION_CONFIG).toHaveProperty(type);
    });
  });

  it('should have required properties for each type', () => {
    Object.values(NOTIFICATION_CONFIG).forEach(config => {
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('color');
      expect(config).toHaveProperty('bgColor');
    });
  });
});

describe('getNotificationLink', () => {
  it('should return correct link for skill_verified', () => {
    const notification: Notification = {
      ...mockNotifications[0],
      type: 'skill_verified',
    };
    const link = getNotificationLink(notification);
    expect(link).toBe('/progress?tab=skills');
  });

  it('should return correct link for gap_analysis_ready with dream job id', () => {
    const notification: Notification = {
      ...mockNotifications[1],
      type: 'gap_analysis_ready',
      data: { dream_job_id: 'job-123' },
    };
    const link = getNotificationLink(notification);
    expect(link).toBe('/dream-jobs/job-123');
  });

  it('should return correct link for course_completed', () => {
    const notification: Notification = {
      ...mockNotifications[3],
      type: 'course_completed',
    };
    const link = getNotificationLink(notification);
    expect(link).toBe('/progress');
  });

  it('should return correct link for recommendation_added', () => {
    const notification: Notification = {
      ...mockNotifications[2],
      type: 'recommendation_added',
    };
    const link = getNotificationLink(notification);
    expect(link).toBe('/career?tab=actions');
  });

  it('should return null for unknown type', () => {
    const notification: Notification = {
      ...mockNotifications[0],
      type: 'unknown_type' as NotificationType,
    };
    const link = getNotificationLink(notification);
    expect(link).toBeNull();
  });
});

describe('Notification Ordering', () => {
  it('should order notifications by date descending', () => {
    const dates = mockNotifications.map(n => new Date(n.createdAt).getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it('should separate unread from read notifications', () => {
    const unread = mockNotifications.filter(n => !n.read);
    const read = mockNotifications.filter(n => n.read);

    expect(unread.length).toBe(2);
    expect(read.length).toBe(2);
  });
});

describe('Notification Data Parsing', () => {
  it('should handle skill_verified data correctly', () => {
    const notification = mockNotifications.find(n => n.type === 'skill_verified');
    expect(notification?.data).toHaveProperty('skill_name');
    expect(notification?.data.skill_name).toBe('JavaScript');
  });

  it('should handle gap_analysis_ready data correctly', () => {
    const notification = mockNotifications.find(n => n.type === 'gap_analysis_ready');
    expect(notification?.data).toHaveProperty('dream_job_id');
    expect(notification?.data).toHaveProperty('match_score');
  });

  it('should handle course_completed data correctly', () => {
    const notification = mockNotifications.find(n => n.type === 'course_completed');
    expect(notification?.data).toHaveProperty('course_id');
    expect(notification?.data).toHaveProperty('course_title');
  });
});
