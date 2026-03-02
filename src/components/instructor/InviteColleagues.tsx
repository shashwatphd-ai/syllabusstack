import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Copy, Check, Users, Mail } from 'lucide-react';

export function InviteColleagues() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch quota
  const { data: quota, isLoading: quotaLoading } = useQuery({
    queryKey: ['invite-quota', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invite_quota', {
        p_user_id: user!.id,
      });
      if (error) throw error;
      return data?.[0] as { total_allowed: number; total_used: number; remaining: number };
    },
    enabled: !!user,
  });

  // Fetch sent invitations
  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['instructor-invitations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_invitations')
        .select('*')
        .eq('inviter_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Send invite mutation
  const sendInvite = useMutation({
    mutationFn: async (inviteeEmail: string) => {
      const { data, error } = await supabase.functions.invoke('send-instructor-invite', {
        body: { email: inviteeEmail },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Invitation Sent', description: `Invite sent to ${email}` });
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['invite-quota'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Send',
        description: error.message || 'Could not send invitation',
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    if (!email.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email', variant: 'destructive' });
      return;
    }
    sendInvite.mutate(email);
  };

  const copyLink = (inviteUrl: string) => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(inviteUrl);
    toast({ title: 'Link Copied', description: 'Invitation link copied to clipboard' });
    setTimeout(() => setCopied(null), 2000);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'pending': return 'secondary';
      case 'expired': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Invite Colleagues
        </CardTitle>
        {quota && (
          <p className="text-sm text-muted-foreground">
            {quota.remaining.toLocaleString()} of {quota.total_allowed.toLocaleString()} invitations remaining
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Send invite form */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="invite-email" className="sr-only">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={sendInvite.isPending || !email}
            className="gap-2"
          >
            {sendInvite.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Invite
          </Button>
        </div>

        {/* Sent invitations */}
        {invitationsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : invitations && invitations.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Sent Invitations</p>
            <div className="divide-y rounded-lg border">
              {invitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{inv.invitee_email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor(inv.status) as any}>
                      {inv.status}
                    </Badge>
                    {inv.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const appUrl = window.location.origin;
                          copyLink(`${appUrl}/auth?invite=${inv.token}`);
                        }}
                      >
                        {copied === `${window.location.origin}/auth?invite=${inv.token}` ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No invitations sent yet. Invite a colleague to get started!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
