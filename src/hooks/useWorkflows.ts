// Re-export all workflow hooks from the focused modules for backward compatibility
export { useAddCourse } from './workflows/useCourseWorkflow';
export { useAddDreamJob } from './workflows/useDreamJobWorkflow';
export { useRefreshAnalysis, useRefreshAllAnalyses } from './workflows/useGapAnalysisWorkflow';
