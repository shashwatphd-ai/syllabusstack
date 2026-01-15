// Query key factory for consistent cache keys across the application
export const queryKeys = {
  // User related
  user: ['user'] as const,
  userProfile: () => [...queryKeys.user, 'profile'] as const,
  
  // Capabilities
  capabilities: ['capabilities'] as const,
  
  // Courses
  courses: ['courses'] as const,
  coursesList: () => [...queryKeys.courses, 'list'] as const,
  courseDetail: (id: string) => [...queryKeys.courses, 'detail', id] as const,
  courseCapabilities: (id: string) => [...queryKeys.courses, 'capabilities', id] as const,
  
  // Dream Jobs
  dreamJobs: ['dreamJobs'] as const,
  dreamJobsList: () => [...queryKeys.dreamJobs, 'list'] as const,
  dreamJobDetail: (id: string) => [...queryKeys.dreamJobs, 'detail', id] as const,
  dreamJobRequirements: (id: string) => [...queryKeys.dreamJobs, 'requirements', id] as const,
  
  // Analysis
  analysis: ['analysis'] as const,
  gapAnalysis: (dreamJobId: string) => [...queryKeys.analysis, 'gap', dreamJobId] as const,
  capabilityProfile: () => [...queryKeys.analysis, 'capability-profile'] as const,
  overlaps: (dreamJobId: string) => [...queryKeys.analysis, 'overlaps', dreamJobId] as const,
  
  // Recommendations
  recommendations: ['recommendations'] as const,
  recommendationsList: (dreamJobId?: string) => 
    dreamJobId 
      ? [...queryKeys.recommendations, 'list', dreamJobId] as const
      : [...queryKeys.recommendations, 'list'] as const,
  recommendationDetail: (id: string) => [...queryKeys.recommendations, 'detail', id] as const,
  
  // Anti-Recommendations
  antiRecommendations: (dreamJobId?: string) => 
    dreamJobId 
      ? ['anti-recommendations', dreamJobId] as const
      : ['anti-recommendations'] as const,
  
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    overview: ['dashboard', 'overview'] as const,
    stats: ['dashboard', 'stats'] as const,
  },

  // Instructor Courses
  instructorCourses: {
    all: ['instructor-courses'] as const,
    list: () => ['instructor-courses', 'list'] as const,
    detail: (id: string) => ['instructor-courses', 'detail', id] as const,
  },

  // Modules
  modules: {
    all: ['modules'] as const,
    list: (courseId: string) => ['modules', 'list', courseId] as const,
  },

  // Teaching Units
  teachingUnits: {
    all: ['teaching-units'] as const,
    list: (loId?: string) => loId 
      ? ['teaching-units', 'list', loId] as const 
      : ['teaching-units', 'list'] as const,
  },

  // Content Matches
  contentMatches: {
    all: ['content-matches'] as const,
    list: (unitId?: string) => unitId
      ? ['content-matches', 'list', unitId] as const
      : ['content-matches', 'list'] as const,
  },

  // Learning Objectives
  learningObjectives: {
    all: ['learning-objectives'] as const,
    list: (courseId?: string) => courseId
      ? ['learning-objectives', 'list', courseId] as const
      : ['learning-objectives', 'list'] as const,
    detail: (id: string) => ['learning-objectives', 'detail', id] as const,
  },

  // Course Students
  courseStudents: (courseId: string) => ['course-students', courseId] as const,

  // Admin
  admin: {
    stats: ['admin', 'stats'] as const,
  },
};
