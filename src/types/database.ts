// EduThree Database Types - Based on Technical Specification v3.0

export type StudentLevel = 'freshman' | 'sophomore' | 'junior' | 'senior' | 'graduate';
export type RecommendationType = 'project' | 'course' | 'certification' | 'action' | 'reading';
export type RecommendationStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

// User Profile
export interface User {
  id: string;
  email: string;
  full_name?: string;
  university?: string;
  graduation_year?: number;
  major?: string;
  student_level?: StudentLevel;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

// Course with AI-analyzed capabilities
export interface Course {
  id: string;
  user_id: string;
  name: string;
  code?: string;
  university?: string;
  semester?: string;
  syllabus_text?: string;
  syllabus_file_url?: string;
  // AI-generated fields
  capability_text?: string;
  capability_embedding?: number[];
  key_capabilities: KeyCapability[];
  evidence_types: string[];
  tools_methods: ToolMethod[];
  ai_model_used?: string;
  ai_cost_usd?: number;
  created_at: string;
  updated_at: string;
}

export interface KeyCapability {
  description: string;
  proficiency_level?: 'basic' | 'intermediate' | 'advanced';
}

export interface ToolMethod {
  name: string;
  proficiency: string;
}

// Dream Job with AI-generated requirements
export interface DreamJob {
  id: string;
  user_id: string;
  job_query: string; // Free text, not dropdown
  target_company_type?: string;
  target_location?: string;
  // AI-generated
  requirements_text?: string;
  requirements_embedding?: number[];
  day_one_capabilities: DayOneCapability[];
  differentiators: string[];
  common_misconceptions: string[];
  realistic_bar?: string;
  ai_model_used?: string;
  ai_cost_usd?: number;
  is_active: boolean;
  created_at: string;
}

export interface DayOneCapability {
  requirement: string;
  importance: 'critical' | 'important' | 'nice_to_have';
}

// Capability Profile (Aggregated from courses)
export interface CapabilityProfile {
  id: string;
  user_id: string;
  combined_capability_text?: string;
  combined_embedding?: number[];
  capabilities_by_theme: Record<string, string[]>;
  course_count: number;
  last_updated: string;
}

// Gap Analysis
export interface GapAnalysis {
  id: string;
  user_id: string;
  dream_job_id: string;
  analysis_text: string;
  strong_overlaps: Overlap[];
  critical_gaps: Gap[];
  partial_overlaps: PartialOverlap[];
  honest_assessment: string;
  readiness_level?: string;
  interview_readiness?: string;
  job_success_prediction?: string;
  priority_gaps: PriorityGap[];
  ai_model_used?: string;
  ai_cost_usd?: number;
  created_at: string;
}

export interface Overlap {
  student_capability: string;
  job_requirement: string;
  assessment: string;
}

export interface Gap {
  job_requirement: string;
  student_status: string;
  impact: string;
}

export interface PartialOverlap {
  area: string;
  foundation: string;
  missing: string;
}

export interface PriorityGap {
  gap: string;
  priority: number;
  reason: string;
}

// Recommendations
export interface Recommendation {
  id: string;
  user_id: string;
  dream_job_id: string;
  gap_analysis_id: string;
  priority: number;
  gap_addressed: string;
  action_title: string;
  action_description: string;
  why_this_matters: string;
  steps: RecommendationStep[];
  type: RecommendationType;
  effort_hours?: number;
  cost: number;
  evidence_created?: string;
  how_to_demonstrate?: string;
  resource_url?: string;
  resource_provider?: string;
  status: RecommendationStatus;
  ai_model_used?: string;
  ai_cost_usd?: number;
  created_at: string;
}

export interface RecommendationStep {
  order: number;
  description: string;
  estimated_time?: string;
}

// Anti-Recommendations (What NOT to do)
export interface AntiRecommendation {
  id: string;
  user_id: string;
  dream_job_id: string;
  action: string;
  reason: string;
  created_at: string;
}

// Dashboard Overview
export interface DashboardOverview {
  user: User;
  course_count: number;
  dream_job_count: number;
  total_capabilities: number;
  completed_recommendations: number;
  total_recommendations: number;
  top_priority_recommendation?: Recommendation;
  dream_jobs_with_analysis: DreamJobWithAnalysis[];
}

export interface DreamJobWithAnalysis {
  dream_job: DreamJob;
  gap_analysis?: GapAnalysis;
  recommendations_count: number;
  completed_count: number;
}

// Onboarding State
export interface OnboardingState {
  step: 'profile' | 'courses' | 'dream_jobs' | 'complete';
  profile_completed: boolean;
  courses_added: number;
  dream_jobs_added: number;
}
