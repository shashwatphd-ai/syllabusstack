import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionTier = 'free' | 'pro' | 'university';

export interface SubscriptionDetails {
  tier: SubscriptionTier;
  status: string;
  ai_calls_used: number;
  ai_calls_limit: number;
  courses_used: number;
  courses_limit: number;
  dream_jobs_used: number;
  dream_jobs_limit: number;
  can_export_pdf: boolean;
  can_see_all_recommendations: boolean;
  can_access_advanced_analytics: boolean;
  subscription_ends_at: string | null;
}

export interface TierLimits {
  tier: SubscriptionTier;
  max_courses: number;
  max_dream_jobs: number;
  max_ai_calls_per_month: number;
  can_export_pdf: boolean;
  can_see_all_recommendations: boolean;
  can_access_advanced_analytics: boolean;
  can_access_premium_content: boolean;
  priority_support: boolean;
}

// Features that require pro or higher
export const PREMIUM_FEATURES = [
  'export_pdf',
  'all_recommendations',
  'advanced_analytics',
  'premium_content',
  'unlimited_courses',
  'multiple_dream_jobs',
] as const;

export type PremiumFeature = typeof PREMIUM_FEATURES[number];

// Tier display info
export const TIER_INFO: Record<SubscriptionTier, {
  name: string;
  price: string;
  priceMonthly: number;
  description: string;
  color: string;
  features: string[];
}> = {
  free: {
    name: 'Free',
    price: 'Free',
    priceMonthly: 0,
    description: 'Get started with career navigation',
    color: 'text-muted-foreground',
    features: [
      'Up to 3 course syllabi',
      '1 dream job profile',
      '20 AI analyses/month',
      'Basic gap analysis',
      'Top 5 recommendations',
      'Community content',
    ],
  },
  pro: {
    name: 'Pro',
    price: '$9.99/mo',
    priceMonthly: 9.99,
    description: 'Full career acceleration toolkit',
    color: 'text-primary',
    features: [
      'Unlimited course syllabi',
      'Up to 5 dream job profiles',
      '200 AI analyses/month',
      'Advanced gap analysis',
      'All recommendations',
      'Premium content library',
      'PDF exports',
      'Priority email support',
    ],
  },
  university: {
    name: 'University',
    price: 'Custom',
    priceMonthly: -1,
    description: 'Enterprise solution for institutions',
    color: 'text-purple-600',
    features: [
      'Everything in Pro',
      'Unlimited everything',
      'Bulk user provisioning',
      'Admin dashboard',
      'Student outcomes reporting',
      'White-label branding',
      'Dedicated support',
      'Custom integrations',
    ],
  },
};

// Get subscription details
export function useSubscription() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<SubscriptionDetails> => {
      if (!user) {
        return getDefaultSubscription();
      }

      const { data, error } = await supabase.rpc('get_subscription_details', {
        p_user_id: user.id,
      });

      if (error) {
        console.error('Error fetching subscription:', error);
        return getDefaultSubscription();
      }

      if (!data || data.length === 0) {
        return getDefaultSubscription();
      }

      return data[0] as SubscriptionDetails;
    },
    enabled: !!user,
    staleTime: 60000, // Cache for 1 minute
  });

  const subscription = query.data || getDefaultSubscription();

  return {
    ...query,
    subscription,
    tier: subscription.tier,
    isPro: subscription.tier === 'pro' || subscription.tier === 'university',
    isUniversity: subscription.tier === 'university',
    isFree: subscription.tier === 'free',
  };
}

function getDefaultSubscription(): SubscriptionDetails {
  return {
    tier: 'free',
    status: 'active',
    ai_calls_used: 0,
    ai_calls_limit: 20,
    courses_used: 0,
    courses_limit: 3,
    dream_jobs_used: 0,
    dream_jobs_limit: 1,
    can_export_pdf: false,
    can_see_all_recommendations: false,
    can_access_advanced_analytics: false,
    subscription_ends_at: null,
  };
}

// Check if a specific feature is available
export function useCanAccess(feature: PremiumFeature): boolean {
  const { subscription } = useSubscription();

  switch (feature) {
    case 'export_pdf':
      return subscription.can_export_pdf;
    case 'all_recommendations':
      return subscription.can_see_all_recommendations;
    case 'advanced_analytics':
      return subscription.can_access_advanced_analytics;
    case 'premium_content':
      return subscription.tier !== 'free';
    case 'unlimited_courses':
      return subscription.courses_limit > 100;
    case 'multiple_dream_jobs':
      return subscription.dream_jobs_limit > 1;
    default:
      return false;
  }
}

// Check usage limits
export function useUsageLimits() {
  const { subscription } = useSubscription();

  const aiUsagePercent = (subscription.ai_calls_used / subscription.ai_calls_limit) * 100;
  const coursesUsagePercent = (subscription.courses_used / subscription.courses_limit) * 100;
  const dreamJobsUsagePercent = (subscription.dream_jobs_used / subscription.dream_jobs_limit) * 100;

  return {
    ai: {
      used: subscription.ai_calls_used,
      limit: subscription.ai_calls_limit,
      percent: aiUsagePercent,
      isWarning: aiUsagePercent >= 80,
      isExhausted: aiUsagePercent >= 100,
    },
    courses: {
      used: subscription.courses_used,
      limit: subscription.courses_limit,
      percent: coursesUsagePercent,
      isWarning: coursesUsagePercent >= 80,
      isExhausted: coursesUsagePercent >= 100,
    },
    dreamJobs: {
      used: subscription.dream_jobs_used,
      limit: subscription.dream_jobs_limit,
      percent: dreamJobsUsagePercent,
      isWarning: dreamJobsUsagePercent >= 80,
      isExhausted: dreamJobsUsagePercent >= 100,
    },
  };
}

// Increment AI usage
export function useIncrementAIUsage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('increment_ai_usage', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data[0] as { allowed: boolean; current_usage: number; max_usage: number; tier: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

// Get all tier limits for comparison
export function useTierLimits() {
  return useQuery({
    queryKey: ['tier_limits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tier_limits')
        .select('*');

      if (error) throw error;
      return data as TierLimits[];
    },
    staleTime: 3600000, // Cache for 1 hour
  });
}
