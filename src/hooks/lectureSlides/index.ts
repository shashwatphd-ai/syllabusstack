/**
 * Lecture Slides Hooks - Barrel Export
 *
 * This module re-exports all lecture slides hooks and types for convenient imports.
 * Maintains backward compatibility with existing imports from useLectureSlides.ts.
 */

// Types
export type {
  Slide,
  EnhancedSlide,
  LayoutHint,
  KeyPointWithHint,
  ProfessorSlide,
  LectureSlide,
  QueueStatus,
  GenerationProgress,
} from './types';

export { isProfessorSlide, isEnhancedSlide } from './types';

// Query hooks
export {
  useLectureSlides,
  useLectureSlide,
  useCourseLectureSlides,
  usePublishedLectureSlides,
} from './queries';

// Mutation hooks - Slide management
export {
  useGenerateLectureSlides,
  usePublishLectureSlides,
  useUnpublishLectureSlides,
  useUpdateLectureSlide,
  useDeleteLectureSlides,
  useCancelQueuedSlide,
} from './mutations';

// Audio hooks
export { useGenerateLectureAudio, useBatchGenerateAudio, useRetryStuckAudio } from './audio';

// Queue/Bulk operation hooks
export {
  useBulkPublishSlides,
  useBulkQueueSlides,
  useQueueStatus,
  useCleanupStuckSlides,
  useRetryFailedSlides,
} from './queue';
