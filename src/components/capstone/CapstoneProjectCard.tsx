import { useState } from 'react';
import { ChevronDown, ChevronUp, Star, Target, UserPlus, Eye, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CapstoneProject } from '@/hooks/useCapstoneProjects';
import { ProjectFeedbackDialog } from './ProjectFeedbackDialog';

interface CapstoneProjectCardProps {
  project: CapstoneProject;
  onAssign?: () => void;
  onViewDetail?: () => void;
}

const statusColors: Record<string, string> = {
  generated: 'bg-muted text-muted-foreground',
  active: 'bg-primary/10 text-primary',
  in_progress: 'bg-amber-500/10 text-amber-700',
  completed: 'bg-green-500/10 text-green-700',
};

export function CapstoneProjectCard({ project, onAssign, onViewDetail }: CapstoneProjectCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const company = project.company_profiles;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm">{project.title}</h4>
            {company && (
              <p className="text-xs text-muted-foreground">{company.name} · {company.sector}</p>
            )}
          </div>
          <Badge className={`text-[10px] shrink-0 ${statusColors[project.status] || ''}`}>
            {project.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Scores */}
        <div className="flex gap-3 text-xs">
          {project.lo_alignment_score != null && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Target className="h-3 w-3" /> LO: {Math.round(project.lo_alignment_score * 100)}%
            </span>
          )}
          {project.feasibility_score != null && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              Feasibility: {Math.round(project.feasibility_score * 100)}%
            </span>
          )}
          {project.final_score != null && (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <Star className="h-3 w-3" /> {Math.round(project.final_score * 100)}
            </span>
          )}
        </div>

        {/* Skills */}
        {project.skills && project.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.skills.slice(0, 4).map(skill => (
              <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {skill}
              </Badge>
            ))}
            {project.skills.length > 4 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                +{project.skills.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Collapsible Tasks/Deliverables */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 -ml-2">
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {isOpen ? 'Hide' : 'Show'} Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {project.description && (
              <p className="text-xs text-muted-foreground">{project.description}</p>
            )}
            {Array.isArray(project.tasks) && project.tasks.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Tasks</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                  {(project.tasks as string[]).map((task, i) => (
                    <li key={i}>{typeof task === 'string' ? task : JSON.stringify(task)}</li>
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
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {onViewDetail && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onViewDetail}>
              <Eye className="h-3 w-3" /> View
            </Button>
          )}
          {onAssign && project.status === 'generated' && (
            <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={onAssign}>
              <UserPlus className="h-3 w-3" /> Assign Student
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
