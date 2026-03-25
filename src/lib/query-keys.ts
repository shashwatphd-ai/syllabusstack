// Query key factory for consistent cache keys across the application
export const queryKeys = {
  // User related
  user: ['user'] as const,
  userProfile: () => [...queryKeys.user, 'profile'] as const,
  userPreferences: () => [...queryKeys.user, 'preferences'] as const,
  userRoles: () => ['user-roles'] as const,

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
  allGapAnalyses: () => [...queryKeys.analysis, 'all-gap-analyses'] as const,

  // Recommendations
  recommendations: ['recommendations'] as const,
  recommendationsList: (dreamJobId?: string) =>
    dreamJobId
      ? [...queryKeys.recommendations, 'list', dreamJobId] as const
      : [...queryKeys.recommendations, 'list'] as const,
  recommendationDetail: (id: string) => [...queryKeys.recommendations, 'detail', id] as const,
  recommendationsWithLinks: (dreamJobId?: string) =>
    dreamJobId
      ? [...queryKeys.recommendations, 'with-links', dreamJobId] as const
      : [...queryKeys.recommendations, 'with-links'] as const,

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
    byLo: (loId: string) => ['content-matches', loId] as const,
  },

  // Learning Objectives
  learningObjectives: {
    all: ['learning-objectives'] as const,
    list: (courseId?: string) => courseId
      ? ['learning-objectives', 'list', courseId] as const
      : ['learning-objectives', 'list'] as const,
    detail: (id: string) => ['learning-objectives', 'detail', id] as const,
    byCourse: (courseId: string) => ['learning-objectives', courseId] as const,
  },

  // Course Students
  courseStudents: (courseId: string) => ['course-students', courseId] as const,

  // Admin
  admin: {
    stats: ['admin', 'stats'] as const,
    verificationQueue: () => ['admin-verification-queue'] as const,
    verifications: (status?: string) => status
      ? ['admin-verifications', status] as const
      : ['admin-verifications'] as const,
    verificationDetail: (id: string) => ['verification-detail', id] as const,
    verificationStats: () => ['verification-stats'] as const,
  },

  // Identity Verification
  identityVerification: {
    status: (userId?: string) => userId
      ? ['identity-verification-status', userId] as const
      : ['identity-verification-status'] as const,
  },

  // Instructor Verification
  instructorVerification: {
    status: (userId?: string) => userId
      ? ['instructor-verification', userId] as const
      : ['instructor-verification'] as const,
  },

  // Assessments
  assessments: {
    questions: (loId: string) => ['assessment-questions', loId] as const,
    activeSession: (loId?: string) => loId
      ? ['active-session', loId] as const
      : ['active-session'] as const,
    sessionHistory: (loId?: string) => loId
      ? ['session-history', loId] as const
      : ['session-history'] as const,
    microChecks: (contentId: string) => ['micro-checks', contentId] as const,
    microCheckResults: (recordId: string) => ['micro-check-results', recordId] as const,
  },

  // Skills Assessment
  skillsAssessment: {
    session: () => ['skills-assessment-session'] as const,
    activeSession: () => ['skills-assessment-session', 'active'] as const,
    profile: () => ['skill-profile'] as const,
  },

  // Content Stats
  contentStats: {
    stats: (loIds: string[]) => ['content-stats', loIds] as const,
    loStatus: (loIds: string[]) => ['lo-content-status', loIds] as const,
  },

  // Content Suggestions
  contentSuggestions: {
    byLo: (loId: string) => ['content-suggestions', loId] as const,
    user: () => ['content-suggestions', 'user'] as const,
    pending: (courseId?: string) => courseId
      ? ['content-suggestions', 'pending', courseId] as const
      : ['content-suggestions', 'pending'] as const,
  },

  // Content Ratings
  contentRatings: {
    user: (contentId: string) => ['content-rating', 'user', contentId] as const,
    stats: (contentId: string) => ['content-rating', 'stats', contentId] as const,
    list: (contentId: string, limit?: number) => limit
      ? ['content-ratings', contentId, limit] as const
      : ['content-ratings', contentId] as const,
  },

  // Certificates
  certificates: {
    user: (userId?: string) => userId
      ? ['certificates', userId] as const
      : ['certificates'] as const,
  },

  // Student Courses
  studentCourses: {
    enrollments: () => ['student-enrollments'] as const,
    detail: (courseId: string) => ['enrolled-course-detail', courseId] as const,
    loProgress: (loId: string) => ['lo-progress', loId] as const,
    availableForLinking: () => ['available-courses-for-linking'] as const,
  },

  // Generated Curriculum
  generatedCurriculum: {
    all: () => ['generated-curricula'] as const,
    detail: (id: string) => ['generated-curriculum', id] as const,
  },

  // Lecture Slides
  lectureSlides: {
    byUnit: (unitId: string) => ['lecture-slides', unitId] as const,
    detail: (slideId: string) => ['lecture-slide', slideId] as const,
    byCourse: (courseId: string) => ['course-lecture-slides', courseId] as const,
    published: (courseId: string) => ['published-lecture-slides', courseId] as const,
    queueStatus: (courseId: string) => ['lecture-queue-status', courseId] as const,
  },

  // Batch Operations
  batch: {
    status: (batchId: string) => ['batch-status', batchId] as const,
    slideStatus: (courseId: string) => ['course-slide-status', courseId] as const,
    imageStatus: (courseId: string) => ['image-generation-status', courseId] as const,
  },

  // Career Matches
  careerMatches: {
    list: (filters?: Record<string, unknown>) => filters
      ? ['career-matches', filters] as const
      : ['career-matches'] as const,
    saved: () => ['career-matches', 'saved'] as const,
    onetOccupation: (socCode: string) => ['onet-occupation', socCode] as const,
  },

  // Discovered Jobs
  discoveredJobs: {
    all: () => ['discovered-jobs'] as const,
  },

  // Usage Stats
  usageStats: {
    byDays: (days: number) => ['usage-stats', days] as const,
  },

  // Subscription
  subscription: {
    user: (userId?: string) => userId
      ? ['subscription', userId] as const
      : ['subscription'] as const,
    tierLimits: () => ['tier_limits'] as const,
  },

  // Organization
  organization: {
    current: () => ['organization'] as const,
    members: (orgId: string) => ['organization-members', orgId] as const,
    invitations: (orgId: string) => ['organization-invitations', orgId] as const,
    role: (orgId: string) => ['organization-role', orgId] as const,
  },

  // Employer Account
  employer: {
    account: () => ['employer-account'] as const,
    apiKeys: (accountId: string) => ['employer-api-keys', accountId] as const,
    apiRequests: (accountId: string) => ['employer-api-requests', accountId] as const,
  },

  // Achievements
  achievements: {
    all: () => ['achievements', 'all'] as const,
    user: (userId?: string) => userId
      ? ['achievements', 'user', userId] as const
      : ['achievements', 'user'] as const,
    unnotified: (userId?: string) => userId
      ? ['achievements', 'unnotified', userId] as const
      : ['achievements', 'unnotified'] as const,
    progress: (userId?: string) => userId
      ? ['achievements', 'progress', userId] as const
      : ['achievements', 'progress'] as const,
    userXp: (userId?: string) => userId
      ? ['user_xp', userId] as const
      : ['user_xp'] as const,
  },

  // Progressive Generation
  progressiveGeneration: {
    triggers: (courseId: string) => ['generation-triggers', courseId] as const,
  },

  // Global Search
  globalSearch: {
    results: (query: string) => ['global-search', query] as const,
  },

  // Job Search
  jobSearch: {
    available: () => ['jobSearchAvailable'] as const,
  },

  // Video Other Matches
  videoOtherMatches: {
    list: (contentId: string, currentLoId: string) => ['video-other-matches', contentId, currentLoId] as const,
  },

  // Job Matches
  jobMatches: {
    all: () => ['job-matches'] as const,
    list: (studentId?: string) => studentId
      ? ['job-matches', 'list', studentId] as const
      : ['job-matches', 'list'] as const,
  },

  // Demand Signals
  demandSignals: {
    bySkills: (skills: string[]) => ['demand-signals', skills] as const,
    live: (skills: string[], location?: string) =>
      ['demand-signals', 'live', skills, location] as const,
  },

  // Portfolio
  portfolio: {
    data: (userId?: string) => userId
      ? ['portfolio', userId] as const
      : ['portfolio'] as const,
  },

  // Capstone Projects
  capstone: {
    companies: (courseId: string) => ['capstone-companies', courseId] as const,
    projects: (courseId: string) => ['capstone-projects', courseId] as const,
    projectDetail: (projectId: string) => ['capstone-project', projectId] as const,
    studentProject: (courseId: string) => ['student-capstone', courseId] as const,
    applications: (scope: string) => ['capstone-applications', scope] as const,
    feedback: (projectId: string) => ['project-feedback', projectId] as const,
    proposals: (projectId: string) => ['partnership-proposals', projectId] as const,
    metadata: (projectId: string) => ['project-metadata', projectId] as const,
  },
};
