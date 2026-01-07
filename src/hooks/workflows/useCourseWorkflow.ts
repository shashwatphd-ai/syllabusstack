import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import { analyzeSyllabus } from '@/services/syllabus-service';
import { TablesInsert } from '@/integrations/supabase/types';

type CourseInsert = Omit<TablesInsert<'courses'>, 'user_id'>;

interface AddCourseParams {
  course: CourseInsert;
  syllabusText?: string;
}

async function addCourseWithAnalysis({ course, syllabusText }: AddCourseParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Create the course
  const { data: newCourse, error: courseError } = await supabase
    .from('courses')
    .insert({ ...course, user_id: user.id })
    .select()
    .single();

  if (courseError) throw courseError;

  // 2. If syllabus text provided, analyze it
  if (syllabusText && syllabusText.trim()) {
    try {
      const analysisResult = await analyzeSyllabus(syllabusText, newCourse.id);
      
      // 3. Update course with extracted capabilities
      if (analysisResult.capabilities && analysisResult.capabilities.length > 0) {
        await supabase
          .from('courses')
          .update({
            key_capabilities: analysisResult.capabilities.map(c => c.name),
            capability_text: syllabusText.substring(0, 5000),
          })
          .eq('id', newCourse.id);

        // 4. Save individual capabilities
        const capabilitiesToInsert = analysisResult.capabilities.map(cap => ({
          user_id: user.id,
          course_id: newCourse.id,
          name: cap.name,
          category: cap.category || 'General',
          proficiency_level: cap.proficiency_level || 'developing',
          source: 'course',
        }));

        await supabase.from('capabilities').insert(capabilitiesToInsert);
      }
    } catch (analysisError) {
      console.error('Syllabus analysis failed:', analysisError);
      // Course is still created, just without analysis
    }
  }

  return newCourse;
}

export function useAddCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addCourseWithAnalysis,
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      
      toast({
        title: 'Course added',
        description: 'Your course has been added and analyzed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error adding course',
        description: error instanceof Error ? error.message : 'Failed to add course',
        variant: 'destructive',
      });
    },
  });
}
