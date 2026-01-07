import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProcessSyllabusParams {
  documentBase64?: string;
  documentUrl?: string;
  instructorCourseId: string;
  fileName?: string;
}

interface ProcessSyllabusResult {
  success: boolean;
  extracted_text_length: number;
  course_title?: string;
  course_description?: string;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    sequence_order: number;
  }>;
  learning_objectives: Array<{
    id: string;
    text: string;
    module_id: string | null;
    module_title: string | null;
    bloom_level: string;
  }>;
  module_count: number;
  lo_count: number;
}

export function useProcessSyllabus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      documentBase64, 
      documentUrl, 
      instructorCourseId,
      fileName,
    }: ProcessSyllabusParams): Promise<ProcessSyllabusResult> => {
      const { data, error } = await supabase.functions.invoke('process-syllabus', {
        body: {
          document_base64: documentBase64,
          document_url: documentUrl,
          instructor_course_id: instructorCourseId,
          file_name: fileName,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['modules', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['learning-objectives', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['instructor-course', variables.instructorCourseId] });
      
      toast({
        title: 'Syllabus Processed!',
        description: `Created ${data.module_count} modules with ${data.lo_count} learning objectives`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'Failed to process syllabus',
        variant: 'destructive',
      });
    },
  });
}
