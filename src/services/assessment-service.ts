import { supabase } from '@/integrations/supabase/client';

export interface ExtractLOsResponse {
  learningObjectives: Array<{
    text: string;
    core_concept: string;
    bloom_level: string;
  }>;
  count: number;
  error?: string;
}

export interface GenerateQuestionsResponse {
  questions: Array<{
    id: string;
    question_text: string;
    question_type: string;
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
