/**
 * Lecture Slides Hooks
 *
 * @deprecated Import from '@/hooks/lectureSlides' instead for better tree-shaking.
 *
 * This file re-exports everything from the modular lectureSlides directory
 * for backward compatibility with existing imports.
 */

export {
  // Types
  type Slide,
  type EnhancedSlide,
  type LayoutHint,
  type KeyPointWithHint,
  type ProfessorSlide,
  type LectureSlide,
  type QueueStatus,
  type GenerationProgress,
  // Type guards
  isProfessorSlide,
  isEnhancedSlide,
  // Query hooks
  useLectureSlides,
  useLectureSlide,
  useCourseLectureSlides,
  usePublishedLectureSlides,
  // Mutation hooks
  useGenerateLectureSlides,
  usePublishLectureSlides,
  useUnpublishLectureSlides,
  useUpdateLectureSlide,
  useDeleteLectureSlides,
  // Audio hooks
  useGenerateLectureAudio,
  // Queue/Bulk operation hooks
  useBulkPublishSlides,
  useBulkQueueSlides,
  useQueueStatus,
  useCleanupStuckSlides,
  useRetryFailedSlides,
} from './lectureSlides';
