import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  type: string;
  license_tier: string;
  seat_limit: number;
  seats_used: number;
  sso_enabled: boolean;
  is_active: boolean;
  license_start_date: string | null;
  license_end_date: string | null;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  department: string | null;
  joined_at: string;
  is_active: boolean;
  profile?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  status: string;
  created_at: string;
}

// Fetch user's organization
export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async (): Promise<Organization | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!membership?.organization_id) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, type, license_tier, seat_limit, seats_used, sso_enabled, is_active, license_start_date, license_end_date, created_at')
        .eq('id', membership.organization_id)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// Fetch organization members
export function useOrganizationMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: async (): Promise<OrganizationMember[]> => {
      if (!organizationId) return [];

      // Fetch members without join (foreign key doesn't exist yet)
      const { data: membersData, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      if (!membersData) return [];

      // Fetch profiles separately for each member
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .in('user_id', userIds);

      // Map profiles to members
      const profileMap = new Map(
        (profilesData || []).map(p => [p.user_id, p])
      );

      return membersData.map(member => ({
        ...member,
        profile: profileMap.get(member.user_id) || undefined,
      }));
    },
    enabled: !!organizationId,
  });
}

// Fetch pending invitations
export function useOrganizationInvitations(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['organization-invitations', organizationId],
    queryFn: async (): Promise<OrganizationInvitation[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
}

// Get user's role in organization
export function useOrganizationRole(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['organization-role', organizationId],
    queryFn: async (): Promise<string | null> => {
      if (!organizationId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .single();

      if (error) return null;
      return data?.role || null;
    },
    enabled: !!organizationId,
  });
}

// Create organization
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; type?: string; slug?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          type: data.type || 'university',
          slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      // Update profile
      await supabase
        .from('profiles')
        .update({ organization_id: org.id })
        .eq('user_id', user.id);

      return org;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({
        title: 'Organization created',
        description: 'Your organization has been set up successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organization',
        variant: 'destructive',
      });
    },
  });
}

// Invite users
export function useInviteUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { organization_id: string; emails: string[]; role?: string }) => {
      const { data: result, error } = await supabase.functions.invoke('invite-users', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-invitations', variables.organization_id] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({
        title: 'Invitations sent',
        description: 'Users have been invited to join your organization.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitations',
        variant: 'destructive',
      });
    },
  });
}

// Remove user
export function useRemoveOrganizationMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { organization_id: string; user_id: string }) => {
      const { data: result, error } = await supabase.functions.invoke('remove-org-user', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', variables.organization_id] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({
        title: 'Member removed',
        description: 'User has been removed from the organization.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      });
    },
  });
}

// Accept invitation
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_organization_invitation', {
        invitation_token: token,
      });

      if (error) throw error;
      
      // Handle JSON response from the function
      const result = data as { success: boolean; error?: string; organization_id?: string };
      if (!result.success) throw new Error(result.error || 'Failed to accept invitation');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({
        title: 'Invitation accepted',
        description: 'You have joined the organization.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept invitation',
        variant: 'destructive',
      });
    },
  });
}
