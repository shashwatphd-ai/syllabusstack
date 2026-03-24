import { Building2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployerInterestSubmissions, useUpdateEmployerInterest } from '@/hooks/useEmployerInterest';
import { format } from 'date-fns';

const statusConfig: Record<string, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: 'text-amber-500' },
  approved: { icon: CheckCircle2, color: 'text-green-500' },
  rejected: { icon: XCircle, color: 'text-red-500' },
};

export function AdminEmployerLeads() {
  const { data: submissions, isLoading } = useEmployerInterestSubmissions();
  const updateMutation = useUpdateEmployerInterest();

  if (isLoading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Employer Leads
        </h3>
        <Badge variant="secondary">{(submissions || []).length} submissions</Badge>
      </div>

      {(!submissions || submissions.length === 0) ? (
        <p className="text-sm text-muted-foreground">No employer interest submissions yet.</p>
      ) : (
        <div className="space-y-2">
          {submissions.map((s: any) => {
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
                    </div>
                    <p className="text-xs text-muted-foreground">{s.contact_name} · {s.contact_email}</p>
                    {s.project_description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.project_description}</p>
                    )}
                    {s.target_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.target_skills.map((sk: string) => <Badge key={sk} variant="secondary" className="text-[10px]">{sk}</Badge>)}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">{format(new Date(s.created_at), 'MMM d, yyyy')}</p>
                  </div>
                  {s.status === 'pending' && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => updateMutation.mutate({ id: s.id, status: 'rejected' })}>
                        Reject
                      </Button>
                      <Button size="sm" className="h-7 text-xs"
                        onClick={() => updateMutation.mutate({ id: s.id, status: 'approved' })}>
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
