/**
 * Partnership Proposals Hooks
 * Handles creating, listing, and managing partnership outreach proposals.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';

export interface PartnershipProposal {
  id: string;
  created_at: string;
  updated_at: string;
  instructor_id: string;
  instructor_course_id: string;
  capstone_project_id: string;
  company_profile_id: string | null;
  channel: 'email' | 'linkedin' | 'saved';
  subject: string | null;
  message_body: string;
  recipient_email: string | null;
  recipient_name: string | null;
  recipient_title: string | null;
  status: 'draft' | 'sent' | 'viewed' | 'responded' | 'accepted' | 'declined';
  sent_at: string | null;
  response_received_at: string | null;
  response_notes: string | null;
  template_used: string | null;
}

export interface CreateProposalInput {
  instructorCourseId: string;
  capstoneProjectId: string;
  companyProfileId?: string;
  channel: 'email' | 'linkedin' | 'saved';
  subject?: string;
  messageBody: string;
  recipientEmail?: string;
  recipientName?: string;
  recipientTitle?: string;
}

export function usePartnershipProposals(projectId: string) {
  return useQuery({
    queryKey: queryKeys.capstone.proposals(projectId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('partnership_proposals')
        .select('*')
        .eq('capstone_project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PartnershipProposal[];
    },
    enabled: !!projectId,
  });
}

export function useCreatePartnershipProposal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('partnership_proposals')
        .insert({
          instructor_id: user.id,
          instructor_course_id: input.instructorCourseId,
          capstone_project_id: input.capstoneProjectId,
          company_profile_id: input.companyProfileId || null,
          channel: input.channel,
          subject: input.subject || null,
          message_body: input.messageBody,
          recipient_email: input.recipientEmail || null,
          recipient_name: input.recipientName || null,
          recipient_title: input.recipientTitle || null,
          status: input.channel === 'saved' ? 'draft' : 'sent',
          sent_at: input.channel !== 'saved' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return { proposal: data as PartnershipProposal, channel: input.channel };
    },
    onSuccess: (result, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capstone.proposals(input.capstoneProjectId) });

      if (result.channel === 'email') {
        // Open mailto link
        const mailto = `mailto:${input.recipientEmail || ''}?subject=${encodeURIComponent(input.subject || 'Capstone Partnership Proposal')}&body=${encodeURIComponent(input.messageBody)}`;
        window.open(mailto, '_blank');
        toast({ title: 'Proposal Saved', description: 'Opening your email client...' });
      } else if (result.channel === 'linkedin') {
        toast({ title: 'Proposal Saved', description: 'Message saved. Copy it to LinkedIn.' });
      } else {
        toast({ title: 'Draft Saved', description: 'Partnership proposal saved for later.' });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Proposal Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ proposalId, status, projectId }: { proposalId: string; status: string; projectId: string }) => {
      const { error } = await (supabase as any)
        .from('partnership_proposals')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (error) throw error;
      return { projectId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capstone.proposals(result.projectId) });
      toast({ title: 'Status Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    },
  });
}
