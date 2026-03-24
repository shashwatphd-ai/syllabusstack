import { useState } from 'react';
import { CheckCircle2, Building2, Mail, Phone, User, MessageSquare } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/common/ResponsiveDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCapstoneProject, useCompleteProject } from '@/hooks/useCapstoneProjects';
import { ProjectFeedbackDialog } from './ProjectFeedbackDialog';

interface ProjectDetailViewProps {
  projectId: string;
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailView({ projectId, courseId, open, onOpenChange }: ProjectDetailViewProps) {
  const { data: project, isLoading } = useCapstoneProject(projectId);
  const completeProject = useCompleteProject();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!project) return null;

  const contact = project.contact as any;
  const company = project.company_profiles;
  const form = (project as any).form;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{project.title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {company?.name} · {company?.sector}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-2">
          {/* Description */}
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}

          {/* Scores */}
          <div className="flex flex-wrap gap-3">
            {project.lo_alignment_score != null && (
              <Badge variant="outline">LO Alignment: {Math.round(project.lo_alignment_score * 100)}%</Badge>
            )}
            {project.feasibility_score != null && (
              <Badge variant="outline">Feasibility: {Math.round(project.feasibility_score * 100)}%</Badge>
            )}
            {project.final_score != null && (
              <Badge>Final Score: {Math.round(project.final_score * 100)}</Badge>
            )}
          </div>

          <Separator />

          {/* Contact Info */}
          {contact && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Contact</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {contact.name && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> {contact.name}
                  </span>
                )}
                {contact.title && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> {contact.title}
                  </span>
                )}
                {contact.email && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {contact.phone}
                  </span>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Tasks & Deliverables */}
          {Array.isArray(project.tasks) && project.tasks.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1.5">Tasks</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                {(project.tasks as string[]).map((t, i) => (
                  <li key={i}>{typeof t === 'string' ? t : JSON.stringify(t)}</li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(project.deliverables) && project.deliverables.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1.5">Deliverables</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                {(project.deliverables as string[]).map((d, i) => (
                  <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          {project.skills && project.skills.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1.5">Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {project.skills.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Form data sections if available */}
          {form && (
            <>
              <Separator />
              <div className="space-y-3">
                {form.form4_timeline && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Timeline</h4>
                    <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto">
                      {JSON.stringify(form.form4_timeline, null, 2)}
                    </pre>
                  </div>
                )}
                {form.milestones && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Milestones</h4>
                    <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto">
                      {JSON.stringify(form.milestones, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Complete action for in-progress projects */}
          {project.status === 'in_progress' && (
            <>
              <Separator />
              <Button
                onClick={() => completeProject.mutate({ projectId, courseId })}
                disabled={completeProject.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {completeProject.isPending ? 'Extracting Skills...' : 'Mark Completed & Extract Skills'}
              </Button>
            </>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
