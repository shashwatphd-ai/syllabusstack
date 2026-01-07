import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

export interface UserPreferences {
  darkMode: boolean;
  theme: string;
  language: string;
  dataCollection: boolean;
}

const defaultPreferences: UserPreferences = {
  darkMode: false,
  theme: 'blue',
  language: 'en',
  dataCollection: true,
};

async function fetchPreferences(): Promise<UserPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return defaultPreferences;

  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching preferences:', error);
    return defaultPreferences;
  }

  // Merge with defaults to ensure all keys exist
  const storedPrefs = (data?.preferences as unknown as Partial<UserPreferences>) || {};
  return { ...defaultPreferences, ...storedPrefs };
}

async function updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // First get current preferences
  const { data: current } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('user_id', user.id)
    .single();

  const currentPrefs = (current?.preferences as unknown as Partial<UserPreferences>) || defaultPreferences;
  const newPrefs = { ...defaultPreferences, ...currentPrefs, ...updates };

  const { error } = await supabase
    .from('profiles')
    .update({ preferences: newPrefs })
    .eq('user_id', user.id);

  if (error) throw error;
  return newPrefs;
}

export function useUserPreferences() {
  return useQuery({
    queryKey: [...queryKeys.user, 'preferences'],
    queryFn: fetchPreferences,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: (newPrefs) => {
      queryClient.setQueryData([...queryKeys.user, 'preferences'], newPrefs);
      toast({
        title: 'Settings saved',
        description: 'Your preferences have been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save preferences',
        variant: 'destructive',
      });
    },
  });
}
