import { Briefcase, CheckCircle2, Clock, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudentCapstoneProject } from '@/hooks/useCapstoneProjects';

interface StudentCapstoneViewProps {
  courseId: string;
}

const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  active: { icon: Clock, label: 'Active', color: 'text-primary' },
  in_progress: { icon: ListTodo, label: 'In Progress', color: 'text-amber-600' },
  completed: { icon: CheckCircle2, label: 'Completed', color: 'text-green-600' },
};

export function StudentCapstoneView({ courseId }: StudentCapstoneViewProps) {
  const { data: projects, isLoading } = useStudentCapstoneProject(courseId);

  if (isLoading || !projects || projects.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <Briefcase className="h-4 w-4" />
        Your Capstone Project{projects.length > 1 ? 's' : ''}
      </h3>

      {projects.map(project => {
        const config = statusConfig[project.status] || statusConfig.active;
        const StatusIcon = config.icon;
        const company = project.company_profiles;

        return (
          <Card key={project.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{project.title}</CardTitle>
                <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              </div>
              {company && (
                <p className="text-xs text-muted-foreground">{company.name} · {company.sector}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {project.description && (
                <p className="text-xs text-muted-foreground">{project.description}</p>
              )}

              {Array.isArray(project.tasks) && project.tasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">Tasks</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                    {(project.tasks as string[]).map((t, i) => (
                      <li key={i}>{typeof t === 'string' ? t : JSON.stringify(t)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(project.deliverables) && project.deliverables.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">Deliverables</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                    {(project.deliverables as string[]).map((d, i) => (
                      <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {project.skills && project.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {project.skills.map(s => (
                    <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{s}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
