/**
 * Instructor Courses Hooks
 *
 * @deprecated Import from '@/hooks/instructorCourses' instead for better tree-shaking.
 *
 * This file re-exports everything from the modular instructorCourses directory
 * for backward compatibility with existing imports.
 */

export {
  // Types
  type InstructorCourse,
  type Module,
  type EnrolledStudent,
  type StudentLOProgress,
  type CourseStudentsProgress,
  // Query hooks
  useInstructorCourses,
  useInstructorCourse,
  useModules,
  // Mutation hooks
  useCreateInstructorCourse,
  useUpdateInstructorCourse,
  useDeleteInstructorCourse,
  useDuplicateInstructorCourse,
  useCreateModule,
  useDeleteModule,
  // Student progress hooks
  useCourseStudents,
} from './instructorCourses';
