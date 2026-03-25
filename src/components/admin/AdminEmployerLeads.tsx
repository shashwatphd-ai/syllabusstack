import { useState } from 'react';
import { Building2, Clock, CheckCircle2, XCircle, Link2, Briefcase, Search, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useEmployerInterestSubmissions, useUpdateEmployerInterest } from '@/hooks/useEmployerInterest';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
  pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
  approved: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
  rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  matched: { icon: Link2, color: 'text-blue-500', bg: 'bg-blue-50' },
};

function useMatchableProjects(search: string) {
  return useQuery({
    queryKey: ['admin-matchable-projects', search],
    queryFn: async () => {
      let query = supabase
        .from('capstone_projects')
        .select('id, title, company_profiles(name), final_score, status')
        .is('assigned_student_id', null)
        .order('final_score', { ascending: false })
        .limit(20);

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
  });
}

function useMatchSubmissionToProject() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ submissionId, projectId }: { submissionId: string; projectId: string }) => {
      const { error } = await supabase
        .from('employer_interest_submissions')
        .update({
          status: 'matched',
          matched_project_id: projectId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employer-interest'] });
      toast({ title: 'Matched', description: 'Employer interest matched to project.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Match Failed', description: e.message, variant: 'destructive' });
    },
  });
}

export function AdminEmployerLeads() {
  const { data: submissions, isLoading } = useEmployerInterestSubmissions();
  const updateMutation = useUpdateEmployerInterest();
  const matchMutation = useMatchSubmissionToProject();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [matchingSubmission, setMatchingSubmission] = useState<any>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const { data: matchableProjects } = useMatchableProjects(projectSearch);

  if (isLoading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const filtered = (submissions || []).filter((s: any) =>
    statusFilter === 'all' || s.status === statusFilter
  );

  const counts = {
    all: (submissions || []).length,
    pending: (submissions || []).filter((s: any) => s.status === 'pending').length,
    approved: (submissions || []).filter((s: any) => s.status === 'approved').length,
    matched: (submissions || []).filter((s: any) => s.status === 'matched').length,
    rejected: (submissions || []).filter((s: any) => s.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Employer Leads
        </h3>
        <div className="flex items-center gap-2">
          {counts.pending > 0 && (
            <Badge variant="destructive" className="text-xs">{counts.pending} pending</Badge>
          )}
          <Badge variant="secondary">{counts.all} total</Badge>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'matched', 'rejected'] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs capitalize"
            onClick={() => setStatusFilter(status)}
          >
            {status} ({counts[status] || 0})
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No submissions match this filter.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s: any) => {
            const config = statusConfig[s.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{s.company_name}</p>
                      <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                        <StatusIcon className="h-3 w-3 mr-0.5" />{s.status}
                      </Badge>
                      {s.referral_source && (
                        <Badge variant="secondary" className="text-[10px]">via {s.referral_source}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.contact_name} · {s.contact_email}
                      {s.contact_phone && ` · ${s.contact_phone}`}
                    </p>
                    {s.project_description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.project_description}</p>
                    )}
                    {s.target_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.target_skills.map((sk: string) => <Badge key={sk} variant="secondary" className="text-[10px]">{sk}</Badge>)}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{format(new Date(s.created_at), 'MMM d, yyyy')}</span>
                      {s.preferred_timeline && <span>Timeline: {s.preferred_timeline}</span>}
                      {s.matched_project_id && <span className="text-blue-500">Matched to project</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {s.status === 'pending' && (
                      <>
                        <Button size="sm" className="h-7 text-xs"
                          onClick={() => updateMutation.mutate({ id: s.id, status: 'approved' })}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => updateMutation.mutate({ id: s.id, status: 'rejected' })}>
                          Reject
                        </Button>
                      </>
                    )}
                    {(s.status === 'approved' || s.status === 'pending') && !s.matched_project_id && (
                      <Button size="sm" variant="secondary" className="h-7 text-xs gap-1"
                        onClick={() => setMatchingSubmission(s)}>
                        <Link2 className="h-3 w-3" /> Match Project
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Match to Project Dialog */}
      <Dialog open={!!matchingSubmission} onOpenChange={(o) => !o && setMatchingSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Match to Capstone Project</DialogTitle>
            <DialogDescription>
              Link {matchingSubmission?.company_name}'s interest to an AI-generated project shell.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {matchableProjects?.map((proj: any) => (
                <Card key={proj.id} className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    matchMutation.mutate(
                      { submissionId: matchingSubmission.id, projectId: proj.id },
                      { onSuccess: () => setMatchingSubmission(null) }
                    );
                  }}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{proj.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {proj.company_profiles?.name || 'Unknown company'}
                      </p>
                    </div>
                    {proj.final_score != null && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {Math.round(proj.final_score * 100)}%
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
              {!matchableProjects?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No unassigned projects found.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchingSubmission(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
