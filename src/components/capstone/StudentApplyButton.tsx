import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApplyToProject, useStudentApplications } from '@/hooks/useCapstoneApplications';

interface StudentApplyButtonProps {
  projectId: string;
  disabled?: boolean;
}

export function StudentApplyButton({ projectId, disabled }: StudentApplyButtonProps) {
  const { data: applications, isLoading } = useStudentApplications();
  const applyMutation = useApplyToProject();

  const hasApplied = (applications || []).some(
    (a: any) => a.capstone_project_id === projectId
  );

  if (isLoading) {
    return (
      <Button size="sm" disabled className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading
      </Button>
    );
  }

  if (hasApplied) {
    return (
      <Button size="sm" disabled variant="secondary" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        Applied
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => applyMutation.mutate({ projectId })}
      disabled={disabled || applyMutation.isPending}
      className="gap-1.5"
    >
      {applyMutation.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Send className="h-3 w-3" />
      )}
      {applyMutation.isPending ? 'Applying...' : 'Apply'}
    </Button>
  );
}
