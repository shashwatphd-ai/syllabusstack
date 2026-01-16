/**
 * Skills Assessment Pipeline Types
 * 
 * Central type definitions for the Skills Assessment → Career Matching → Curriculum Generation pipeline.
 * These types ensure consistency across hooks, components, and edge functions.
 */

// ============= Assessment Types =============

export type QuestionType = 'likert_5' | 'likert_7' | 'slider_100' | 'forced_choice';
export type AssessmentFramework = 'holland_riasec' | 'onet_skills' | 'work_values';
export type SessionType = 'standard' | 'quick';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned' | 'expired';

export interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  framework: AssessmentFramework;
  measures_dimension: string;
  response_options: Record<string, unknown> | null;
  sequence_order: number | null;
  is_reverse_scored?: boolean;
}

export interface AssessmentSession {
  id: string;
  user_id: string;
  session_type: SessionType;
  status: SessionStatus;
  total_questions: number;
  questions_answered: number;
  current_section?: string;
  started_at: string;
  completed_at?: string;
  expires_at: string;
}

export interface AssessmentProgress {
  answered: number;
  total: number;
  percentage: number;
}

// ============= Skill Profile Types =============

export interface HollandScores {
  realistic: number;
  investigative: number;
  artistic: number;
  social: number;
  enterprising: number;
  conventional: number;
}

export interface SkillProfile {
  id: string;
  user_id: string;
  holland_code: string | null;
  holland_scores: HollandScores;
  technical_skills: Record<string, number>;
  work_values: Record<string, number>;
  top_interests?: Array<{ dimension: string; score: number }>;
  strong_skills?: Array<{ skill: string; score: number }>;
  development_areas?: Array<{ skill: string; score: number }>;
  assessment_version: string;
  confidence_level?: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============= Career Matching Types =============

export interface SkillGap {
  skill: string;
  gap: number;
  importance?: string;
  required_level?: number;
  current_level?: number;
}

export interface MatchBreakdown {
  user_holland?: string;
  occupation_holland?: string;
  interest_weight?: number;
  skills_weight?: number;
  values_weight?: number;
  holland_similarity?: number;
  skill_gaps?: SkillGap[];
  top_matching_skills?: string[];
}

export interface OccupationDetails {
  median_wage: number | null;
  job_outlook: string | null;
  education_level: string | null;
  bright_outlook: boolean | null;
}

export interface CareerMatch {
  id: string;
  user_id: string;
  skill_profile_id: string | null;
  onet_soc_code: string;
  occupation_title: string;
  description?: string;
  overall_match_score: number;
  interest_match_score: number | null;
  skill_match_score: number | null;
  values_match_score: number | null;
  match_breakdown: MatchBreakdown | null;
  skill_gaps: SkillGap[] | null;
  occupation_details?: OccupationDetails;
  dream_job_id: string | null;
  is_saved: boolean | null;
  is_dismissed: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CareerFilters {
  minMatchScore?: number;
  educationLevel?: string;
  minSalary?: number;
  brightOutlookOnly?: boolean;
  excludeDismissed?: boolean;
}

// ============= Curriculum Types =============

export interface LearningObjective {
  text: string;
  bloom_level: string;
  estimated_minutes: number;
}

export interface CurriculumModule {
  title: string;
  description: string;
  estimated_hours: number;
  learning_objectives: LearningObjective[];
}

export interface CurriculumSubject {
  title: string;
  description: string;
  estimated_hours: number;
  modules: CurriculumModule[];
  skills_covered: string[];
}

export interface CurriculumStructure {
  subjects: CurriculumSubject[];
  estimated_total_weeks: number;
  curriculum_summary: string;
}

export interface GeneratedCurriculum {
  id: string;
  user_id: string;
  career_match_id: string | null;
  target_occupation: string;
  curriculum_structure: CurriculumStructure;
  estimated_weeks: number | null;
  total_subjects: number | null;
  total_modules: number | null;
  total_learning_objectives: number | null;
  progress_percentage: number | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  generation_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurriculumCustomizations {
  hours_per_week?: number;
  learning_style?: 'visual' | 'reading' | 'hands_on';
  priority_skills?: string[];
  exclude_topics?: string[];
}

// ============= O*NET Types =============

export interface ONetOccupation {
  id: string;
  soc_code: string;
  title: string;
  description: string | null;
  riasec_code: string | null;
  riasec_scores: HollandScores | null;
  required_skills: Array<{ skill: string; level: number; importance: string }> | null;
  required_knowledge: Array<{ name: string; level: number }> | null;
  required_abilities: Array<{ name: string; level: number }> | null;
  work_values: Record<string, number> | null;
  education_level: string | null;
  experience_level: string | null;
  median_wage: number | null;
  job_outlook: string | null;
  job_outlook_percent: number | null;
  employment_count: number | null;
  bright_outlook: boolean | null;
  green_occupation: boolean | null;
}

// ============= Constants =============

export const HOLLAND_DIMENSIONS = [
  'realistic',
  'investigative', 
  'artistic',
  'social',
  'enterprising',
  'conventional',
] as const;

export type HollandDimension = typeof HOLLAND_DIMENSIONS[number];

export const HOLLAND_LABELS: Record<HollandDimension, { label: string; description: string }> = {
  realistic: {
    label: 'Realistic',
    description: 'Practical, hands-on problem solving with tools and machines',
  },
  investigative: {
    label: 'Investigative',
    description: 'Analytical thinking, research, and exploring ideas',
  },
  artistic: {
    label: 'Artistic',
    description: 'Creative expression, originality, and imagination',
  },
  social: {
    label: 'Social',
    description: 'Helping, teaching, and working with people',
  },
  enterprising: {
    label: 'Enterprising',
    description: 'Leading, persuading, and business ventures',
  },
  conventional: {
    label: 'Conventional',
    description: 'Organizing data, attention to detail, and following procedures',
  },
};

export const WORK_VALUE_CLUSTERS = [
  'achievement',
  'independence',
  'recognition',
  'relationships',
  'support',
  'working_conditions',
] as const;

export type WorkValueCluster = typeof WORK_VALUE_CLUSTERS[number];

export const WORK_VALUE_LABELS: Record<WorkValueCluster, { label: string; description: string }> = {
  achievement: {
    label: 'Achievement',
    description: 'Results-oriented work that lets you use your abilities',
  },
  independence: {
    label: 'Independence',
    description: 'Autonomous work with freedom to make decisions',
  },
  recognition: {
    label: 'Recognition',
    description: 'Advancement potential and prestige',
  },
  relationships: {
    label: 'Relationships',
    description: 'Friendly coworkers and service to others',
  },
  support: {
    label: 'Support',
    description: 'Supportive management and fair policies',
  },
  working_conditions: {
    label: 'Working Conditions',
    description: 'Job security, good pay, and pleasant environment',
  },
};

export const FRAMEWORK_LABELS: Record<AssessmentFramework, string> = {
  holland_riasec: 'Interests',
  onet_skills: 'Skills',
  work_values: 'Values',
};

export const SESSION_TYPE_CONFIG: Record<SessionType, { items: number; minutes: number; description: string }> = {
  quick: {
    items: 54,
    minutes: 10,
    description: 'Essential questions only, good for exploration',
  },
  standard: {
    items: 103,
    minutes: 20,
    description: 'Comprehensive profile for accurate career matching',
  },
};
