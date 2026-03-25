/**
 * Shared components used across capstone project detail tabs and views.
 */

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export function SectionHeading({ title, icon: Icon, children }: { title: string; icon?: any; children?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StatusIcon({ status }: { status: 'pass' | 'warning' | 'fail' | string }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}
