import { supabase } from '@/integrations/supabase/client';

export interface Capability {
  name: string;
  category: string;
  proficiency_level: string;
}

export interface AnalyzeSyllabusResponse {
  capabilities: Capability[];
  error?: string;
}

export async function analyzeSyllabus(
  syllabusText: string,
  courseId?: string
): Promise<AnalyzeSyllabusResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-syllabus', {
    body: { syllabusText, courseId }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export interface JobRequirement {
  skill_name: string;
  importance: 'critical' | 'important' | 'nice_to_have';
  category: string;
}

export interface DayOneCapability {
  requirement: string;
  importance: 'critical' | 'important' | 'nice_to_have';
}

export interface AnalyzeDreamJobResponse {
  requirements: JobRequirement[];
  description?: string;
  salary_range?: string;
  day_one_capabilities?: DayOneCapability[];
  differentiators?: string[];
  common_misconceptions?: string[];
  realistic_bar?: string;
  error?: string;
}

export async function analyzeDreamJob(
  jobTitle: string,
  companyType?: string,
  location?: string,
  dreamJobId?: string
): Promise<AnalyzeDreamJobResponse> {
  const { data, error } = await supabase.functions.invoke('analyze-dream-job', {
    body: { jobTitle, companyType, location, dreamJobId }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export interface SkillOverlap {
  capability: string;
  requirement: string;
  strength: 'strong' | 'moderate' | 'partial';
  notes?: string;
}

export interface SkillGap {
  requirement: string;
  importance: 'critical' | 'important' | 'nice_to_have';
  difficulty: 'easy' | 'moderate' | 'challenging';
  time_to_close: string;
  suggested_action?: string;
}

export interface GapAnalysisResponse {
  match_score: number;
  overlaps: SkillOverlap[];
  gaps: SkillGap[];
  honest_assessment: string;
  readiness_level?: 'ready_to_apply' | '3_months_away' | '6_months_away' | '1_year_away' | 'needs_significant_development';
  interview_readiness?: string;
  job_success_prediction?: string;
  strong_overlaps?: Array<{
    student_capability: string;
    job_requirement: string;
    assessment: string;
  }>;
  partial_overlaps?: Array<{
    student_capability: string;
    job_requirement: string;
    assessment: string;
  }>;
  critical_gaps?: Array<{
    job_requirement: string;
    student_status: string;
    impact: string;
  }>;
  priority_gaps?: Array<{
    gap: string;
    priority: number;
    reason: string;
  }>;
  anti_recommendations?: string[];
  error?: string;
}

export async function performGapAnalysis(dreamJobId: string): Promise<GapAnalysisResponse> {
  const { data, error } = await supabase.functions.invoke('gap-analysis', {
    body: { dreamJobId }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export interface Recommendation {
  title: string;
  type: 'course' | 'certification' | 'project' | 'experience' | 'skill';
  description: string;
  provider?: string;
  url?: string;
  duration?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GenerateRecommendationsResponse {
  recommendations: Recommendation[];
  error?: string;
}

export async function generateRecommendations(
  dreamJobId: string,
  gaps: SkillGap[]
): Promise<GenerateRecommendationsResponse> {
  const { data, error } = await supabase.functions.invoke('generate-recommendations', {
    body: { dreamJobId, gaps }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

// Parse PDF syllabus document
export interface ParseDocumentResponse {
  text: string;
  metadata?: {
    pages?: number;
    title?: string;
  };
  error?: string;
}

export async function parseSyllabusDocument(file: File): Promise<ParseDocumentResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Upload file to syllabi bucket
  const fileExt = file.name.split('.').pop();
  const filePath = `${user.id}/${Date.now()}-${file.name}`;
  
  const { error: uploadError } = await supabase.storage
    .from('syllabi')
    .upload(filePath, file);
  
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // 2. Get signed URL
  const { data: urlData, error: urlError } = await supabase.storage
    .from('syllabi')
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  
  if (urlError || !urlData?.signedUrl) {
    throw new Error('Failed to get file URL');
  }

  // 3. Call parse-syllabus-document edge function
  const { data, error } = await supabase.functions.invoke('parse-syllabus-document', {
    body: { 
      file_url: urlData.signedUrl, 
      file_name: file.name 
    }
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  return data;
}

// Extract learning objectives from module
export interface ExtractLOsResponse {
  learningObjectives: Array<{
    text: string;
    core_concept: string;
    bloom_level: string;
  }>;
  count: number;
  error?: string;
}

export async function extractLearningObjectives(
  moduleId: string,
  moduleTitle: string,
  moduleDescription: string,
  userId: string
): Promise<ExtractLOsResponse> {
  const { data, error } = await supabase.functions.invoke('extract-learning-objectives', {
    body: { 
      module_id: moduleId, 
      title: moduleTitle, 
      description: moduleDescription,
      user_id: userId
    }
  });
  
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return data;
}

// Search YouTube content for a learning objective
export interface YouTubeSearchResponse {
  matches: Array<{
    content_id: string;
    title: string;
    match_score: number;
  }>;
  total_found: number;
  auto_approved_count: number;
  error?: string;
}

export async function searchYouTubeContent(
  learningObjectiveId: string,
  searchQuery: string
): Promise<YouTubeSearchResponse> {
  const { data, error } = await supabase.functions.invoke('search-youtube-content', {
    body: { 
      learning_objective_id: learningObjectiveId, 
      query: searchQuery 
    }
  });
  
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return data;
}

// Generate assessment questions for a learning objective
export interface GenerateQuestionsResponse {
  questions: Array<{
    id: string;
    question_text: string;
    question_type: string;
  }>;
  count: number;
  error?: string;
}

export async function generateAssessmentQuestions(
  learningObjectiveId: string,
  questionCount: number = 5
): Promise<GenerateQuestionsResponse> {
  const { data, error } = await supabase.functions.invoke('generate-assessment-questions', {
    body: { 
      learning_objective_id: learningObjectiveId, 
      question_count: questionCount 
    }
  });
  
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return data;
}
