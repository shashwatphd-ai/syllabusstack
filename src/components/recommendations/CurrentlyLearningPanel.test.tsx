import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { CurrentlyLearningPanel } from './CurrentlyLearningPanel';
import { BrowserRouter } from 'react-router-dom';
import { type StudentEnrollment } from '@/hooks/useStudentCourses';
import { type RecommendationWithLinks } from '@/hooks/useRecommendations';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createMockEnrollment = (overrides: Partial<StudentEnrollment> = {}): StudentEnrollment => ({
  id: `enrollment-${Math.random().toString(36).slice(2)}`,
  student_id: 'student-123',
  instructor_course_id: `course-${Math.random().toString(36).slice(2)}`,
  enrolled_at: new Date().toISOString(),
  completed_at: null,
  overall_progress: 45,
  instructor_course: {
    id: `course-${Math.random().toString(36).slice(2)}`,
    title: 'Introduction to React',
    code: 'CS101',
    description: 'Learn React fundamentals',
    instructor_id: 'instructor-123',
    verification_threshold: 80,
    is_published: true,
  },
  ...overrides,
});

const createMockRecommendation = (overrides: Partial<RecommendationWithLinks> = {}): RecommendationWithLinks => ({
  id: `rec-${Math.random().toString(36).slice(2)}`,
  title: 'Learn React Hooks',
  description: 'Master React hooks for state management',
  type: 'course',
  priority: 'high',
  status: 'pending',
  user_id: 'user-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  gap_addressed: 'Frontend Development',
  linked_course_id: null,
  linked_course_title: null,
  enrollment_progress: null,
  cost_usd: null,
  deleted_at: null,
  dream_job_id: null,
  duration: null,
  effort_hours: null,
  evidence_created: null,
  gap_analysis_id: null,
  how_to_demonstrate: null,
  price_known: null,
  provider: null,
  steps: null,
  url: null,
  why_this_matters: null,
  ...overrides,
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('CurrentlyLearningPanel', () => {
  const mockOnLinkCourse = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no enrollments', () => {
    const { container } = renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={[]}
        recommendations={[]}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders enrolled courses when enrollments exist', () => {
    const enrollments = [
      createMockEnrollment({ instructor_course: { id: 'c1', title: 'React Fundamentals', code: 'CS101', description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } }),
      createMockEnrollment({ instructor_course: { id: 'c2', title: 'TypeScript Basics', code: 'CS102', description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } }),
    ];

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={[]}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    expect(screen.getByText('Currently Learning')).toBeInTheDocument();
    expect(screen.getByText('React Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Basics')).toBeInTheDocument();
  });

  it('shows progress for each enrollment', () => {
    const enrollments = [
      createMockEnrollment({ 
        overall_progress: 75,
        instructor_course: { id: 'c1', title: 'Advanced React', code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      }),
    ];

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={[]}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows "Complete" badge for completed enrollments', () => {
    const enrollments = [
      createMockEnrollment({ 
        completed_at: new Date().toISOString(),
        overall_progress: 100,
        instructor_course: { id: 'c1', title: 'Completed Course', code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      }),
    ];

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={[]}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('shows "Linked" badge for courses already linked to recommendations', () => {
    const enrollments = [
      createMockEnrollment({ 
        instructor_course_id: 'linked-course-id',
        instructor_course: { id: 'linked-course-id', title: 'Linked Course', code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      }),
    ];
    const recommendations = [
      createMockRecommendation({ linked_course_id: 'linked-course-id' }),
    ];

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={recommendations}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    expect(screen.getByText('Linked')).toBeInTheDocument();
  });

  it('opens link dialog when clicking unlinked course', () => {
    const enrollments = [
      createMockEnrollment({ 
        instructor_course: { id: 'c1', title: 'Unlinked Course', code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      }),
    ];
    const recommendations = [
      createMockRecommendation({ type: 'course', linked_course_id: null }),
    ];

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={recommendations}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    fireEvent.click(screen.getByText('Unlinked Course'));

    expect(screen.getByText(/Link "Unlinked Course"/)).toBeInTheDocument();
  });

  it('shows suggested matches in the dialog', () => {
    const enrollments = [
      createMockEnrollment({ 
        instructor_course: { id: 'c1', title: 'React Development', code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      }),
    ];
    const recommendations = [
      createMockRecommendation({ 
        title: 'Learn React Fundamentals', 
        gap_addressed: 'React Development',
        type: 'course',
        linked_course_id: null,
      }),
    ];

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={recommendations}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    fireEvent.click(screen.getByText('React Development'));

    // Should show the matching recommendation
    expect(screen.getByText('Learn React Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Matching Recommendations')).toBeInTheDocument();
  });

  it('calls onLinkCourse when linking a recommendation', async () => {
    const enrollments = [
      createMockEnrollment({ 
        id: 'enr-1',
        instructor_course_id: 'course-1',
        instructor_course: { id: 'course-1', title: 'React Course', code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      }),
    ];
    const recommendations = [
      createMockRecommendation({ 
        id: 'rec-1',
        title: 'Learn React', 
        type: 'course',
        linked_course_id: null,
      }),
    ];

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={recommendations}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    // Open dialog
    fireEvent.click(screen.getByText('React Course'));

    // Click on a recommendation to link
    const linkButton = screen.getByRole('button', { name: /Learn React/i });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(mockOnLinkCourse).toHaveBeenCalledWith('enr-1', 'course-1', 'rec-1');
    });
  });

  it('shows "View all" button when more than 5 enrollments', () => {
    const enrollments = Array.from({ length: 7 }, (_, i) => 
      createMockEnrollment({ 
        id: `enr-${i}`,
        instructor_course: { id: `c${i}`, title: `Course ${i}`, code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      })
    );

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={[]}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    expect(screen.getByText('View all 7 →')).toBeInTheDocument();
  });

  it('navigates to courses page when clicking "View all"', () => {
    const enrollments = Array.from({ length: 7 }, (_, i) => 
      createMockEnrollment({ 
        id: `enr-${i}`,
        instructor_course: { id: `c${i}`, title: `Course ${i}`, code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      })
    );

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={[]}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    fireEvent.click(screen.getByText('View all 7 →'));

    expect(mockNavigate).toHaveBeenCalledWith('/learn/courses');
  });

  it('filters out non-course recommendations from link dialog', () => {
    const enrollments = [
      createMockEnrollment({ 
        instructor_course: { id: 'c1', title: 'My Course', code: null, description: null, instructor_id: 'instructor-1', verification_threshold: 80, is_published: true } 
      }),
    ];
    const recommendations = [
      createMockRecommendation({ type: 'course', title: 'Course Rec', linked_course_id: null }),
      createMockRecommendation({ type: 'project', title: 'Project Rec', linked_course_id: null }),
      createMockRecommendation({ type: 'certification', title: 'Cert Rec', linked_course_id: null }),
    ];

    renderWithRouter(
      <CurrentlyLearningPanel
        enrollments={enrollments}
        recommendations={recommendations}
        onLinkCourse={mockOnLinkCourse}
      />
    );

    fireEvent.click(screen.getByText('My Course'));

    // Only course recommendation should appear in the "Other Recommendations" section
    expect(screen.getByText('Course Rec')).toBeInTheDocument();
    expect(screen.queryByText('Project Rec')).not.toBeInTheDocument();
    expect(screen.queryByText('Cert Rec')).not.toBeInTheDocument();
  });
});
