import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EmployerAccount {
  id: string;
  company_name: string;
  company_domain: string | null;
  plan: string;
  primary_contact_email: string | null;
  is_active: boolean;
  monthly_verification_limit: number;
  verifications_this_month: number;
  created_at: string;
}

export interface EmployerApiKey {
  id: string;
  employer_account_id: string;
  key_prefix: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
}

export interface EmployerApiRequest {
  id: string;
  api_key_id: string;
  endpoint: string;
  request_method: string;
  response_status: number;
  response_time_ms: number;
  created_at: string;
}

// Fetch employer account
export function useEmployerAccount() {
  return useQuery({
    queryKey: ['employer-account'],
    queryFn: async (): Promise<EmployerAccount | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('employer_accounts')
        .select('*')
        .eq('primary_contact_user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

// Fetch API keys
export function useEmployerApiKeys(accountId: string | undefined) {
  return useQuery({
    queryKey: ['employer-api-keys', accountId],
    queryFn: async (): Promise<EmployerApiKey[]> => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from('employer_api_keys')
        .select('*')
        .eq('employer_account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });
}

// Fetch recent API requests
export function useEmployerApiRequests(accountId: string | undefined) {
  return useQuery({
    queryKey: ['employer-api-requests', accountId],
    queryFn: async (): Promise<EmployerApiRequest[]> => {
      if (!accountId) return [];

      // Get all API keys for this account first
      const { data: keys } = await supabase
        .from('employer_api_keys')
        .select('id')
        .eq('employer_account_id', accountId);

      if (!keys?.length) return [];

      const keyIds = keys.map(k => k.id);

      const { data, error } = await supabase
        .from('employer_api_requests')
        .select('*')
        .in('api_key_id', keyIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });
}

// Create employer account
export function useCreateEmployerAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { company_name: string; company_domain?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: account, error } = await supabase
        .from('employer_accounts')
        .insert({
          company_name: data.company_name,
          company_domain: data.company_domain,
          primary_contact_user_id: user.id,
          primary_contact_email: user.email,
        })
        .select()
        .single();

      if (error) throw error;
      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-account'] });
      toast({
        title: 'Account created',
        description: 'Your employer account has been set up.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create account',
        variant: 'destructive',
      });
    },
  });
}

// Generate new API key
export function useGenerateApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { employer_account_id: string; name?: string }) => {
      const { data: result, error } = await supabase.rpc('generate_employer_api_key', {
        p_employer_account_id: data.employer_account_id,
        p_name: data.name || 'Default Key',
      });

      if (error) throw error;
      return result as { api_key: string; key_id: string }[];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employer-api-keys', variables.employer_account_id] });
      toast({
        title: 'API key generated',
        description: 'Make sure to copy your key now. It won\'t be shown again.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate API key',
        variant: 'destructive',
      });
    },
  });
}

// Revoke API key
export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('employer_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-api-keys'] });
      toast({
        title: 'API key revoked',
        description: 'The API key has been disabled.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke API key',
        variant: 'destructive',
      });
    },
  });
}

// Webhook types
export interface EmployerWebhook {
  id: string;
  employer_account_id: string;
  url: string;
  events: string[] | null;
  secret: string | null;
  is_active: boolean | null;
  last_triggered_at: string | null;
  failure_count: number | null;
  created_at: string | null;
}

export const WEBHOOK_EVENTS = [
  { value: 'certificate.issued', label: 'Certificate Issued', description: 'When a new certificate is issued to a student' },
  { value: 'certificate.revoked', label: 'Certificate Revoked', description: 'When a certificate is revoked' },
  { value: 'verification.completed', label: 'Verification Completed', description: 'When you verify a certificate via API' },
] as const;

// Fetch webhooks
export function useEmployerWebhooks(accountId: string | undefined) {
  return useQuery({
    queryKey: ['employer-webhooks', accountId],
    queryFn: async (): Promise<EmployerWebhook[]> => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from('employer_webhooks')
        .select('*')
        .eq('employer_account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });
}

/**
 * Create webhook with server-side secret generation
 *
 * SECURITY FIX (Task 2.1.4 from MASTER_IMPLEMENTATION_PLAN_V2.md):
 * - Previously: Secret generated client-side (insecure - could be intercepted)
 * - Now: Secret generated server-side in create-webhook edge function
 * - Secret is only returned once at creation time
 */
export function useCreateWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      employer_account_id: string;
      url: string;
      events: string[];
    }) => {
      // Call server-side function for secure secret generation
      const { data: result, error } = await supabase.functions.invoke('create-webhook', {
        body: data,
      });

      if (error) throw error;
      if (!result) throw new Error('No response from server');

      // Return webhook with secret (server-generated)
      return { ...result.webhook, secret: result.secret };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employer-webhooks', variables.employer_account_id] });
      toast({
        title: 'Webhook created',
        description: 'Your webhook endpoint has been configured.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create webhook',
        variant: 'destructive',
      });
    },
  });
}

// Update webhook
export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      url?: string;
      events?: string[];
      is_active?: boolean;
    }) => {
      const { error } = await supabase
        .from('employer_webhooks')
        .update({
          url: data.url,
          events: data.events,
          is_active: data.is_active,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-webhooks'] });
      toast({
        title: 'Webhook updated',
        description: 'Your webhook settings have been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update webhook',
        variant: 'destructive',
      });
    },
  });
}

// Delete webhook
export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (webhookId: string) => {
      const { error } = await supabase
        .from('employer_webhooks')
        .delete()
        .eq('id', webhookId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-webhooks'] });
      toast({
        title: 'Webhook deleted',
        description: 'The webhook endpoint has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete webhook',
        variant: 'destructive',
      });
    },
  });
}
