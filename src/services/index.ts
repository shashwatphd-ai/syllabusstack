// Syllabus services
export { 
  analyzeSyllabus, 
  parseSyllabusDocument,
  type Capability,
  type AnalyzeSyllabusResponse,
  type ParseDocumentResponse,
} from './syllabus-service';

// Dream job services
export { 
  analyzeDreamJob,
  type JobRequirement,
  type DayOneCapability,
  type AnalyzeDreamJobResponse,
} from './dream-job-service';

// Gap analysis services
export { 
  performGapAnalysis,
  type SkillOverlap,
  type SkillGap,
  type GapAnalysisResponse,
} from './gap-analysis-service';

// Recommendations services
export { 
  generateRecommendations,
  type Recommendation,
  type GenerateRecommendationsResponse,
} from './recommendations-service';

// Content services
export { 
  searchYouTubeContent,
  type YouTubeSearchResponse,
} from './content-service';

// Assessment services
export { 
  extractLearningObjectives,
  generateAssessmentQuestions,
  type ExtractLOsResponse,
  type GenerateQuestionsResponse,
} from './assessment-service';
