import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { RecommendationCard, type Recommendation } from './RecommendationCard';
import { 
  createFreeRecommendation, 
  createPaidRecommendation, 
  createUnknownPriceRecommendation 
} from '@/test/factories/recommendation';

// Mock the useSingleCourseSearch hook
vi.mock('@/hooks/useSingleCourseSearch', () => ({
  useSingleCourseSearch: () => ({
    searchForCourse: vi.fn(),
    isSearching: false,
    searchingId: null,
  }),
}));

describe('RecommendationCard', () => {
  const mockOnStatusChange = vi.fn().mockResolvedValue(undefined);
  const mockOnSearchCourse = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Actionability States', () => {
    it('shows "Start Learning" for course with URL', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: 'https://coursera.com/test',
        status: 'pending',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByRole('button', { name: /start learning/i })).toBeInTheDocument();
    });

    it('shows "Search Courses" for course without URL', () => {
      const rec = createUnknownPriceRecommendation({
        type: 'course',
        url: undefined,
        status: 'pending',
        gap_addressed: 'Python programming',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
          onSearchCourse={mockOnSearchCourse}
        />
      );

      expect(screen.getByRole('button', { name: /search courses/i })).toBeInTheDocument();
    });

    it('shows "Continue Learning" for linked course', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: undefined,
        status: 'pending',
        linked_course_id: 'course-123',
        linked_course_title: 'Test Course',
        enrollment_progress: 45,
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByRole('button', { name: /continue learning/i })).toBeInTheDocument();
      expect(screen.getByText('Test Course')).toBeInTheDocument();
    });

    it('shows "Start" for non-course types (project)', () => {
      const rec = createFreeRecommendation({
        type: 'project',
        url: 'https://github.com/project',
        status: 'pending',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
    });

    it('shows "Mark Complete" for in_progress status', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: 'https://coursera.com/test',
        status: 'in_progress',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByRole('button', { name: /mark complete/i })).toBeInTheDocument();
    });

    it('shows "Undo" for completed status', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: 'https://coursera.com/test',
        status: 'completed',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });

    it('shows "Restore" for skipped status', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: 'https://coursera.com/test',
        status: 'skipped',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    });
  });

  describe('Actionability Badges', () => {
    it('shows "Ready to Learn" badge for course with URL', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: 'https://coursera.com/test',
        status: 'pending',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Ready to Learn')).toBeInTheDocument();
    });

    it('shows "Find Course" badge for course without URL', () => {
      const rec = createUnknownPriceRecommendation({
        type: 'course',
        url: undefined,
        status: 'pending',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Find Course')).toBeInTheDocument();
    });

    it('shows linked course title as badge for linked_learning state', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: undefined,
        status: 'pending',
        linked_course_id: 'course-123',
        linked_course_title: 'Advanced Python',
        enrollment_progress: 60,
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Advanced Python')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  describe('Price Display', () => {
    it('displays "Free" for free courses', () => {
      const rec = createFreeRecommendation({ type: 'course' }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    it('displays price for paid courses', () => {
      const rec = createPaidRecommendation({ 
        type: 'course',
        cost_usd: 49,
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('$49')).toBeInTheDocument();
    });

    it('displays "Check pricing" for unknown price', () => {
      const rec = createUnknownPriceRecommendation({ type: 'course' }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      expect(screen.getByText('Check pricing')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onStatusChange with "in_progress" when Start Learning is clicked', async () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: 'https://coursera.com/test',
        status: 'pending',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /start learning/i }));

      expect(mockOnStatusChange).toHaveBeenCalledWith(rec.id, 'in_progress');
    });

    it('calls onSearchCourse when Search Courses is clicked', async () => {
      const rec = createUnknownPriceRecommendation({
        type: 'course',
        url: undefined,
        status: 'pending',
        gap_addressed: 'Machine Learning',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
          onSearchCourse={mockOnSearchCourse}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /search courses/i }));

      expect(mockOnSearchCourse).toHaveBeenCalledWith(rec.id, 'Machine Learning');
    });

    it('calls onStatusChange with "skipped" when Skip is clicked', async () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: 'https://coursera.com/test',
        status: 'pending',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /skip/i }));

      expect(mockOnStatusChange).toHaveBeenCalledWith(rec.id, 'skipped');
    });

    it('expands card when clicking on main content', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        description: 'This is a detailed description',
        why_this_matters: 'Very important skill',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
        />
      );

      // Initially description should not be visible in expanded section
      expect(screen.queryByText('What To Do')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText(rec.title));

      // Now expanded content should be visible
      expect(screen.getByText('What To Do')).toBeInTheDocument();
      expect(screen.getByText('This is a detailed description')).toBeInTheDocument();
    });
  });

  describe('Link Course Option', () => {
    it('shows Link Course button when showLinkOption is true and no linked course', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: 'https://coursera.com/test',
        status: 'pending',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
          showLinkOption={true}
        />
      );

      expect(screen.getByRole('button', { name: /link course/i })).toBeInTheDocument();
    });

    it('hides Link Course button when already linked', () => {
      const rec = createFreeRecommendation({
        type: 'course',
        url: undefined,
        status: 'pending',
        linked_course_id: 'course-123',
        linked_course_title: 'Test Course',
      }) as Recommendation;

      render(
        <RecommendationCard 
          recommendation={rec} 
          onStatusChange={mockOnStatusChange}
          showLinkOption={true}
        />
      );

      expect(screen.queryByRole('button', { name: /link course/i })).not.toBeInTheDocument();
    });
  });
});
