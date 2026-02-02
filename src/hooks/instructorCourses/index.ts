/**
 * Instructor Courses Hooks - Barrel Export
 *
 * Re-exports all instructor courses hooks and types for convenient imports.
 */

// Types
export type {
  InstructorCourse,
  Module,
  EnrolledStudent,
  StudentLOProgress,
  CourseStudentsProgress,
} from './types';

// Query hooks
export {
  useInstructorCourses,
  useInstructorCourse,
  useModules,
} from './queries';

// Mutation hooks
export {
  useCreateInstructorCourse,
  useUpdateInstructorCourse,
  useDeleteInstructorCourse,
  useDuplicateInstructorCourse,
  useCreateModule,
  useDeleteModule,
} from './mutations';

// Student progress hooks
export { useCourseStudents } from './students';
