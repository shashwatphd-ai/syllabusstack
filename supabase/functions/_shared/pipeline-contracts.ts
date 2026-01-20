/**
 * AI Pipeline Contracts
 * 
 * Defines the input/output types for all AI edge functions in the course lifecycle.
 * These contracts are used for testing and ensure type safety across the pipeline.
 */

// ============================================================================
// ANALYZE SYLLABUS
// ============================================================================

export interface AnalyzeSyllabusInput {
  syllabusText: string;
  courseId?: string;
}

export interface AnalyzeSyllabusOutput {
  capabilities: {
    name: string;
    category: 'technical' | 'analytical' | 'communication' | 'leadership' | 'creative' | 'research' | 'interpersonal';
    proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    evidence_type?: string;
  }[];
  course_themes: string[];
  tools_learned: string[];
  course_title: string | null;
  course_code: string | null;
  semester: string | null;
  credits: number | null;
}

// ============================================================================
// EXTRACT LEARNING OBJECTIVES
// ============================================================================

export interface ExtractLearningObjectivesInput {
  syllabus_text: string;
  course_id?: string;
  module_id?: string;
}

export interface LearningObjective {
  id?: string;
  text: string;
  core_concept: string;
  action_verb: string;
  bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  domain: 'business' | 'science' | 'humanities' | 'technical' | 'arts' | 'other';
  specificity: 'introductory' | 'intermediate' | 'advanced';
  search_keywords: string[];
  expected_duration_minutes: number;
}

export interface ExtractLearningObjectivesOutput {
  success: boolean;
  learning_objectives: LearningObjective[];
  count: number;
}

// ============================================================================
// CURRICULUM REASONING AGENT
// ============================================================================

export interface CurriculumReasoningInput {
  learning_objective_id: string;
}

export interface TeachingUnit {
  sequence_order: number;
  title: string;
  description: string;
  what_to_teach: string;
  why_this_matters: string;
  how_to_teach: string;
  common_misconceptions: string[];
  prerequisites: string[];
  enables: string[];
  target_video_type: 'explainer' | 'tutorial' | 'case_study' | 'worked_example' | 'lecture' | 'demonstration';
  target_duration_minutes: number;
  search_queries: string[];
  required_concepts: string[];
  avoid_terms: string[];
}

export interface CurriculumReasoningOutput {
  success: boolean;
  teaching_units: TeachingUnit[];
  reasoning_chain: string;
  total_estimated_time_minutes: number;
  domain_context: string;
}

// ============================================================================
// GENERATE LECTURE SLIDES
// ============================================================================

export interface GenerateLectureSlidesInput {
  teaching_unit_id: string;
  instructor_course_id?: string;
}

export interface SlideVisualDirective {
  type: 'diagram' | 'screenshot' | 'comparison' | 'flowchart' | 'illustration' | 'none';
  description: string;
  elements: string[];
  style: string;
  educational_purpose?: string;
}

export interface LectureSlide {
  order: number;
  type: 'title' | 'hook' | 'recap' | 'definition' | 'explanation' | 
        'example' | 'demonstration' | 'misconception' | 'practice' | 
        'synthesis' | 'preview' | 'process' | 'summary';
  title: string;
  content: {
    main_text: string;
    key_points?: string[];
    definition?: {
      term: string;
      formal_definition: string;
      simple_explanation: string;
    };
    example?: {
      scenario: string;
      walkthrough: string;
      connection_to_concept: string;
    };
    misconception?: {
      wrong_belief: string;
      why_wrong: string;
      correct_understanding: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
  };
  visual_directive: SlideVisualDirective;
  speaker_notes: string;
  estimated_seconds: number;
  pedagogy: {
    purpose: string;
    bloom_action: string;
    transition_to_next: string;
  };
}

export interface GenerateLectureSlidesOutput {
  success: boolean;
  lecture_slides_id: string;
  slide_count: number;
  total_duration_seconds: number;
  teaching_unit_id: string;
}

// ============================================================================
// GENERATE ASSESSMENT QUESTIONS
// ============================================================================

export interface GenerateAssessmentQuestionsInput {
  learning_objective_id?: string;
  learning_objective_text?: string;
  content_context?: string;
}

export interface AssessmentQuestion {
  question_type: 'multiple_choice' | 'short_answer' | 'true_false';
  question_text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  options?: {
    label: string;
    text: string;
    is_correct: boolean;
  }[];
  correct_answer: string;
  accepted_answers?: string[];
  required_keywords?: string[];
  scenario_context?: string;
  explanation?: string;
}

export interface GenerateAssessmentQuestionsOutput {
  success: boolean;
  questions: AssessmentQuestion[];
  count: number;
  learning_objective_id?: string;
}

// ============================================================================
// PROCESS BATCH IMAGES
// ============================================================================

export interface ProcessBatchImagesInput {
  lecture_slides_id?: string;
  batch_job_id?: string;
  limit?: number;
}

export interface ProcessBatchImagesOutput {
  success: boolean;
  processed: number;
  failed: number;
  remaining: number;
  images: {
    slide_index: number;
    status: 'completed' | 'failed';
    image_url?: string;
    error?: string;
  }[];
}

// ============================================================================
// SEARCH YOUTUBE CONTENT
// ============================================================================

export interface SearchYouTubeContentInput {
  learning_objective_id?: string;
  teaching_unit_id?: string;
  query?: string;
  max_results?: number;
}

export interface YouTubeVideo {
  video_id: string;
  title: string;
  channel_name: string;
  duration_seconds: number;
  view_count: number;
  thumbnail_url: string;
  relevance_score: number;
}

export interface SearchYouTubeContentOutput {
  success: boolean;
  videos: YouTubeVideo[];
  count: number;
  search_queries_used: string[];
}

// ============================================================================
// BATCH SLIDE SUBMISSION
// ============================================================================

export interface SubmitBatchSlidesInput {
  instructor_course_id: string;
  teaching_unit_ids: string[];
}

export interface SubmitBatchSlidesOutput {
  success: boolean;
  batch_job_id: string;
  units_queued: number;
  placeholders_created: number;
}

// ============================================================================
// POLL BATCH STATUS
// ============================================================================

export interface PollBatchStatusInput {
  batch_job_id: string;
}

export interface PollBatchStatusOutput {
  status: 'pending' | 'preparing' | 'processing' | 'completed' | 'failed';
  succeeded_count: number;
  failed_count: number;
  total_requests: number;
  completed_at?: string;
  error_message?: string;
}

// ============================================================================
// PIPELINE STAGE ENUM
// ============================================================================

export enum PipelineStage {
  SYLLABUS_ANALYSIS = 'analyze-syllabus',
  LEARNING_OBJECTIVES = 'extract-learning-objectives',
  CURRICULUM_DECOMPOSITION = 'curriculum-reasoning-agent',
  LECTURE_SLIDES = 'generate-lecture-slides-v3',
  BATCH_SLIDES_SUBMIT = 'submit-batch-slides',
  BATCH_SLIDES_POLL = 'poll-batch-status',
  BATCH_IMAGES = 'process-batch-images',
  ASSESSMENT_QUESTIONS = 'generate-assessment-questions',
  CONTENT_SEARCH = 'search-youtube-content',
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateAnalyzeSyllabusOutput(output: unknown): output is AnalyzeSyllabusOutput {
  if (!output || typeof output !== 'object') return false;
  const o = output as AnalyzeSyllabusOutput;
  return (
    Array.isArray(o.capabilities) &&
    Array.isArray(o.course_themes) &&
    Array.isArray(o.tools_learned)
  );
}

export function validateExtractLearningObjectivesOutput(output: unknown): output is ExtractLearningObjectivesOutput {
  if (!output || typeof output !== 'object') return false;
  const o = output as ExtractLearningObjectivesOutput;
  return (
    typeof o.success === 'boolean' &&
    Array.isArray(o.learning_objectives) &&
    typeof o.count === 'number'
  );
}

export function validateCurriculumReasoningOutput(output: unknown): output is CurriculumReasoningOutput {
  if (!output || typeof output !== 'object') return false;
  const o = output as CurriculumReasoningOutput;
  return (
    typeof o.success === 'boolean' &&
    Array.isArray(o.teaching_units) &&
    typeof o.reasoning_chain === 'string'
  );
}

export function validateGenerateAssessmentQuestionsOutput(output: unknown): output is GenerateAssessmentQuestionsOutput {
  if (!output || typeof output !== 'object') return false;
  const o = output as GenerateAssessmentQuestionsOutput;
  return (
    typeof o.success === 'boolean' &&
    Array.isArray(o.questions) &&
    typeof o.count === 'number'
  );
}
