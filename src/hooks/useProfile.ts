import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

// Profile type - the profiles_safe view already excludes sensitive Stripe fields
type FullProfile = Tables<'profiles'>;
export type Profile = Omit<FullProfile, 'stripe_customer_id' | 'stripe_subscription_id'>;
export type ProfileUpdate = Omit<TablesUpdate<'profiles'>, 'stripe_customer_id' | 'stripe_subscription_id'>;

// Fetch current user's profile
async function fetchProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Query profiles_safe view which excludes sensitive Stripe data at the DB level
  const { data, error } = await supabase
    .from('profiles_safe' as any)
    .select('*')
    .eq('user_id', user.id)
    .single() as { data: Profile | null; error: any };

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Update user's profile
async function updateProfile(updates: ProfileUpdate): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Mark onboarding as completed
async function completeOnboarding(): Promise<Profile> {
  return updateProfile({ onboarding_completed: true });
}

// Hooks
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.userProfile(),
    queryFn: fetchProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}
