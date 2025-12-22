import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type AppRole = 'student' | 'instructor' | 'admin';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// Fetch current user's roles
export function useUserRoles() {
  return useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as UserRole[];
    },
  });
}

// Check if user has a specific role
export function useHasRole(role: AppRole) {
  const { data: roles, isLoading } = useUserRoles();
  return {
    hasRole: roles?.some(r => r.role === role) ?? false,
    isLoading,
  };
}

// Get user's primary role (highest privilege)
export function usePrimaryRole() {
  const { data: roles, isLoading } = useUserRoles();
  
  const rolePriority: Record<AppRole, number> = {
    admin: 1,
    instructor: 2,
    student: 3,
  };

  const primaryRole = roles?.reduce((primary, current) => {
    if (!primary) return current.role;
    return rolePriority[current.role] < rolePriority[primary] ? current.role : primary;
  }, null as AppRole | null);

  return {
    primaryRole: primaryRole ?? 'student',
    isLoading,
    roles: roles?.map(r => r.role) ?? [],
  };
}

// Request instructor role (requires admin approval in production)
export function useRequestInstructorRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // For MVP, we directly add the instructor role
      // In production, this would create a request for admin approval
      const { data, error } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'instructor',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('You already have the instructor role');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({
        title: 'Instructor Role Added',
        description: 'You can now create courses and manage content',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add instructor role',
        variant: 'destructive',
      });
    },
  });
}
