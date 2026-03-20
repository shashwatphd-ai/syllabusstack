/**
 * Instructor Courses Type Definitions
 */

export interface InstructorCourse {
  id: string;
  instructor_id: string;
  title: string;
  code: string | null;
  description: string | null;
  curation_mode: 'full_control' | 'guided_auto' | 'hands_off';
  verification_threshold: number;
  is_published: boolean;
  access_code: string | null;
  created_at: string;
  updated_at: string;
  location_city?: string | null;
  location_state?: string | null;
  location_zip?: string | null;
  search_location?: string | null;
  academic_level?: string | null;
  expected_artifacts?: string[] | null;
}

export interface Module {
  id: string;
  instructor_course_id: string;
  title: string;
  description: string | null;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

// Student progress interfaces
export interface EnrolledStudent {
  id: string;
  student_id: string;
  enrolled_at: string;
  overall_progress: number;
  completed_at: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface StudentLOProgress {
  learning_objective_id: string;
  verification_state: string | null;
  content_watched: number;
  micro_checks_passed: number;
}

export interface CourseStudentsProgress {
  enrollments: EnrolledStudent[];
  totalLOs: number;
  loProgress: Record<string, StudentLOProgress[]>; // student_id -> LO progress
}
