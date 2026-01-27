import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { useDreamJobs } from './useDreamJobs';
import { useStudentCourses } from './useStudentCourses';
import { queryKeys } from '@/lib/query-keys';

// Onboarding steps configuration
export const ONBOARDING_STEPS = [
  {
    id: 'profile',
    step: 0,
    title: 'Complete Your Profile',
    description: 'Tell us about yourself so we can personalize your experience',
    requiredFields: ['full_name', 'university', 'student_level'],
  },
  {
    id: 'courses',
    step: 1,
    title: 'Add Your Courses',
    description: 'Upload syllabi or add courses to track your learning',
    requiredFields: [],
    requiresData: 'courses',
  },
  {
    id: 'dream-jobs',
    step: 2,
    title: 'Set Your Dream Jobs',
    description: 'Define your career goals to get personalized recommendations',
    requiredFields: [],
    requiresData: 'dreamJobs',
  },
  {
    id: 'skills-assessment',
    step: 3,
    title: 'Take Skills Assessment',
    description: 'Discover your Holland code and skill profile',
    requiredFields: [],
    requiresData: 'skillProfile',
  },
] as const;

export type OnboardingStepId = typeof ONBOARDING_STEPS[number]['id'];

export interface OnboardingStep {
  id: OnboardingStepId;
  step: number;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
}

export interface OnboardingProgress {
  currentStep: number;
  isComplete: boolean;
  completedAt: string | null;
  steps: OnboardingStep[];
  nextIncompleteStep: OnboardingStep | null;
  completionPercentage: number;
  totalSteps: number;
  completedSteps: number;
}

/**
 * Hook to manage and track onboarding progress
 */
export function useOnboardingProgress() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: dreamJobs, isLoading: dreamJobsLoading } = useDreamJobs();
  const { data: enrolledCourses, isLoading: coursesLoading } = useStudentCourses();
  const queryClient = useQueryClient();

  const isLoading = profileLoading || dreamJobsLoading || coursesLoading;

  // Check if each step is complete
  const checkStepCompletion = (stepId: OnboardingStepId): boolean => {
    if (!profile) return false;

    switch (stepId) {
      case 'profile':
        return !!(profile.full_name && profile.university && profile.student_level);
      case 'courses':
        return (enrolledCourses?.length || 0) > 0;
      case 'dream-jobs':
        return (dreamJobs?.length || 0) > 0;
      case 'skills-assessment':
        // Check if user has completed the skills assessment (has a skill profile)
        return !!profile.onboarding_completed; // Will be replaced with actual skill profile check
      default:
        return false;
    }
  };

  // Calculate progress
  const calculateProgress = (): OnboardingProgress => {
    const currentStep = profile?.onboarding_step || 0;
    const isComplete = profile?.onboarding_completed || false;

    const steps: OnboardingStep[] = ONBOARDING_STEPS.map((step, index) => ({
      ...step,
      isComplete: checkStepCompletion(step.id),
      isActive: index === currentStep,
    }));

    const completedSteps = steps.filter(s => s.isComplete).length;
    const nextIncomplete = steps.find(s => !s.isComplete) || null;
    const completionPercentage = Math.round((completedSteps / steps.length) * 100);

    return {
      currentStep,
      isComplete,
      completedAt: null, // Would need to track this in profile
      steps,
      nextIncompleteStep: nextIncomplete,
      completionPercentage,
      totalSteps: steps.length,
      completedSteps,
    };
  };

  const progress = calculateProgress();

  // Mutation to update onboarding step
  const updateStepMutation = useMutation({
    mutationFn: async (step: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update({ onboarding_step: step })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
    },
  });

  // Mutation to complete onboarding
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_step: ONBOARDING_STEPS.length,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
    },
  });

  return {
    progress,
    isLoading,
    updateStep: updateStepMutation.mutateAsync,
    completeOnboarding: completeOnboardingMutation.mutateAsync,
    isUpdating: updateStepMutation.isPending || completeOnboardingMutation.isPending,
  };
}

/**
 * Hook to check if user needs to complete onboarding
 */
export function useNeedsOnboarding() {
  const { progress, isLoading } = useOnboardingProgress();

  return {
    needsOnboarding: !progress.isComplete && progress.completedSteps < progress.totalSteps,
    isLoading,
    nextStep: progress.nextIncompleteStep,
  };
}

/**
 * Hook to get onboarding prompts for incomplete steps
 */
export function useOnboardingPrompts() {
  const { progress, isLoading } = useOnboardingProgress();

  // Get prompts for incomplete steps
  const prompts = progress.steps
    .filter(step => !step.isComplete)
    .map(step => ({
      stepId: step.id,
      title: step.title,
      description: step.description,
      ctaText: getCtaText(step.id),
      ctaLink: getCtaLink(step.id),
      priority: getPriority(step.id),
    }))
    .sort((a, b) => a.priority - b.priority);

  return {
    prompts,
    hasPrompts: prompts.length > 0,
    primaryPrompt: prompts[0] || null,
    isLoading,
  };
}

// Helper functions
function getCtaText(stepId: OnboardingStepId): string {
  switch (stepId) {
    case 'profile':
      return 'Complete Profile';
    case 'courses':
      return 'Add Courses';
    case 'dream-jobs':
      return 'Set Dream Jobs';
    case 'skills-assessment':
      return 'Take Assessment';
    default:
      return 'Continue';
  }
}

function getCtaLink(stepId: OnboardingStepId): string {
  switch (stepId) {
    case 'profile':
      return '/onboarding';
    case 'courses':
      return '/courses';
    case 'dream-jobs':
      return '/career-path';
    case 'skills-assessment':
      return '/skills-assessment';
    default:
      return '/onboarding';
  }
}

function getPriority(stepId: OnboardingStepId): number {
  // Lower number = higher priority
  switch (stepId) {
    case 'profile':
      return 1;
    case 'courses':
      return 2;
    case 'dream-jobs':
      return 3;
    case 'skills-assessment':
      return 4;
    default:
      return 99;
  }
}

/**
 * Component props helper for onboarding banner
 */
export interface OnboardingBannerProps {
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  onDismiss?: () => void;
}

export function useOnboardingBanner(): OnboardingBannerProps | null {
  const { primaryPrompt, isLoading } = useOnboardingPrompts();

  if (isLoading || !primaryPrompt) return null;

  return {
    title: primaryPrompt.title,
    description: primaryPrompt.description,
    ctaText: primaryPrompt.ctaText,
    ctaLink: primaryPrompt.ctaLink,
  };
}
