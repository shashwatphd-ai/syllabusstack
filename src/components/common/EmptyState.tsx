import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Briefcase, 
  FileText, 
  Plus,
  Sparkles,
  Target
} from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6 text-center",
      className
    )}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick}>
          <Plus className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-configured empty states for common scenarios
export function EmptyCourses({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={<BookOpen className="h-8 w-8 text-muted-foreground" />}
      title="No courses added yet"
      description="Add your courses by uploading syllabi. We'll analyze them to understand what you can do."
      action={{
        label: "Add Your First Course",
        onClick: onAdd
      }}
    />
  );
}

export function EmptyDreamJobs({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={<Briefcase className="h-8 w-8 text-muted-foreground" />}
      title="No dream jobs added"
      description="Tell us what roles you're targeting. We'll analyze what they actually require."
      action={{
        label: "Add a Dream Job",
        onClick: onAdd
      }}
    />
  );
}

export function EmptyAnalysis() {
  return (
    <EmptyState
      icon={<Target className="h-8 w-8 text-muted-foreground" />}
      title="No analysis available"
      description="Add courses and dream jobs to see how your capabilities match job requirements."
    />
  );
}

export function EmptyRecommendations() {
  return (
    <EmptyState
      icon={<Sparkles className="h-8 w-8 text-muted-foreground" />}
      title="No recommendations yet"
      description="Complete a gap analysis to receive personalized, actionable recommendations."
    />
  );
}

export function EmptyCapabilities() {
  return (
    <EmptyState
      icon={<FileText className="h-8 w-8 text-muted-foreground" />}
      title="No capabilities detected"
      description="Your capabilities will appear here once you've added courses with syllabi."
    />
  );
}
