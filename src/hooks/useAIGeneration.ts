/**
 * ============================================================================
 * useAIGeneration - Unified AI Generation Hook
 * ============================================================================
 *
 * PURPOSE: Single entry point for all AI generation operations in the frontend.
 * Consolidates multiple specialized hooks into one unified interface.
 *
 * TASKS SUPPORTED:
 *   - slides: Generate lecture slides for teaching units
 *   - images: Generate images for slides
 *   - curriculum: Generate personalized curriculum
 *   - assessment: Generate assessment questions
 *   - text: Generic text generation
 *
 * USAGE:
 *   const { generateSlides, generateImages, generateCurriculum } = useAIGeneration();
 *
 *   // Generate slides for a course
 *   await generateSlides.mutateAsync({
 *     instructorCourseId,
 *     teachingUnitIds,
 *   });
 *
 *   // Generate images for slides
 *   await generateImages.mutateAsync({
 *     instructorCourseId,
 *   });
 *
 * ============================================================================
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

export interface SlideGenerationRequest {
  instructorCourseId: string;
  teachingUnitIds: string[];
}

export interface ImageGenerationRequest {
  instructorCourseId: string;
  lectureSlideIds?: string[];
}

export interface CurriculumGenerationRequest {
  careerMatchId?: string;
  dreamJobId?: string;
  customization?: {
    learning_style?: string;
    time_commitment?: string;
    focus_areas?: string[];
  };
}

export interface AssessmentGenerationRequest {
  learningObjectiveId: string;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface TextGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
  };
}

export interface GenerationResult {
  success: boolean;
  message?: string;
  data?: unknown;
  metadata?: {
    provider: string;
    model: string;
    latency_ms: number;
    cost_usd?: number;
  };
}

// ============================================================================
// UNIFIED AI GENERATION HOOK
// ============================================================================

export function useAIGeneration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ==========================================================================
  // SLIDE GENERATION
  // ==========================================================================
  const generateSlides = useMutation({
    mutationFn: async ({ instructorCourseId, teachingUnitIds }: SlideGenerationRequest) => {
      console.log(`[AI] Generating slides for ${teachingUnitIds.length} units`);

      // Step 1: Create placeholders
      const { data: submitData, error: submitError } = await supabase.functions.invoke(
        'submit-batch-slides',
        {
          body: {
            instructor_course_id: instructorCourseId,
            teaching_unit_ids: teachingUnitIds,
          },
        }
      );

      if (submitError) throw submitError;
      if (!submitData?.success) throw new Error(submitData?.error || 'Batch submission failed');

      // Step 2: Start research (fire and forget)
      if (submitData.batch_job_id && submitData.total > 0) {
        supabase.functions.invoke('process-batch-research', {
          body: { batch_job_id: submitData.batch_job_id },
        }).catch(err => console.error('[AI] Research error:', err));
      }

      return submitData as GenerationResult & {
        batch_job_id: string | null;
        total: number;
        skipped: number;
      };
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['course-slide-status', variables.instructorCourseId] });

      toast({
        title: '🔬 Slide Generation Started',
        description: `Processing ${data.total} teaching units. This may take a few minutes.`,
      });
    },

    onError: (error: Error) => {
      console.error('[AI] Slide generation failed:', error);
      toast({
        title: 'Slide Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // ==========================================================================
  // IMAGE GENERATION
  // ==========================================================================
  const generateImages = useMutation({
    mutationFn: async ({ instructorCourseId, lectureSlideIds }: ImageGenerationRequest) => {
      console.log(`[AI] Triggering image generation for course ${instructorCourseId}`);

      const { data, error } = await supabase.functions.invoke('process-batch-images', {
        body: lectureSlideIds
          ? { lecture_slides_ids: lectureSlideIds }
          : { instructor_course_id: instructorCourseId },
      });

      if (error) throw error;
      return data as GenerationResult;
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-slide-status', variables.instructorCourseId] });
      queryClient.invalidateQueries({ queryKey: ['course-lecture-slides', variables.instructorCourseId] });

      toast({
        title: '🖼️ Image Generation Started',
        description: data.message || 'Processing images for slides.',
      });
    },

    onError: (error: Error) => {
      console.error('[AI] Image generation failed:', error);
      toast({
        title: 'Image Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // ==========================================================================
  // CURRICULUM GENERATION
  // ==========================================================================
  const generateCurriculum = useMutation({
    mutationFn: async ({ careerMatchId, dreamJobId, customization }: CurriculumGenerationRequest) => {
      console.log('[AI] Generating curriculum');

      const { data, error } = await supabase.functions.invoke('generate-curriculum', {
        body: {
          career_match_id: careerMatchId,
          dream_job_id: dreamJobId,
          customization,
        },
      });

      if (error) throw error;
      return data as GenerationResult;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-curriculum'] });

      toast({
        title: '📚 Curriculum Generated',
        description: 'Your personalized learning path is ready.',
      });
    },

    onError: (error: Error) => {
      console.error('[AI] Curriculum generation failed:', error);
      toast({
        title: 'Curriculum Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // ==========================================================================
  // ASSESSMENT GENERATION
  // ==========================================================================
  const generateAssessment = useMutation({
    mutationFn: async ({ learningObjectiveId, count, difficulty }: AssessmentGenerationRequest) => {
      console.log(`[AI] Generating assessment for LO ${learningObjectiveId}`);

      const { data, error } = await supabase.functions.invoke('generate-assessment-questions', {
        body: {
          learning_objective_id: learningObjectiveId,
          question_count: count || 5,
          difficulty,
        },
      });

      if (error) throw error;
      return data as GenerationResult;
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment-questions', variables.learningObjectiveId] });

      toast({
        title: '📝 Assessment Generated',
        description: 'Questions are ready for review.',
      });
    },

    onError: (error: Error) => {
      console.error('[AI] Assessment generation failed:', error);
      toast({
        title: 'Assessment Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // ==========================================================================
  // GENERIC TEXT GENERATION (via ai-gateway)
  // ==========================================================================
  const generateText = useMutation({
    mutationFn: async ({ prompt, systemPrompt, options }: TextGenerationRequest) => {
      console.log('[AI] Generating text via gateway');

      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: {
          task: 'text',
          prompt,
          system_prompt: systemPrompt,
          options,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Text generation failed');

      return data as GenerationResult & { result: { content: string } };
    },

    onError: (error: Error) => {
      console.error('[AI] Text generation failed:', error);
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // ==========================================================================
  // GENERIC IMAGE GENERATION (via ai-gateway)
  // ==========================================================================
  const generateSingleImage = useMutation({
    mutationFn: async ({ prompt, slideTitle }: { prompt: string; slideTitle?: string }) => {
      console.log('[AI] Generating single image via gateway');

      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: {
          task: 'image',
          prompt,
          options: { slide_title: slideTitle },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Image generation failed');

      return data as GenerationResult & {
        result: { base64: string; mimeType: string };
      };
    },

    onError: (error: Error) => {
      console.error('[AI] Single image generation failed:', error);
      toast({
        title: 'Image Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    // Specialized generation
    generateSlides,
    generateImages,
    generateCurriculum,
    generateAssessment,

    // Generic generation
    generateText,
    generateSingleImage,

    // Convenience: check if any generation is in progress
    isGenerating:
      generateSlides.isPending ||
      generateImages.isPending ||
      generateCurriculum.isPending ||
      generateAssessment.isPending ||
      generateText.isPending ||
      generateSingleImage.isPending,
  };
}

// ============================================================================
// RE-EXPORTS for backwards compatibility
// ============================================================================

export { useSubmitBatchSlides, useTriggerImageGeneration } from './useBatchSlides';
