import { ReactNode, ComponentType, isValidElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LucideProps } from 'lucide-react';
import {
  BookOpen,
  Briefcase,
  FileText,
  Plus,
  Sparkles,
  Target,
  Play,
  Video,
  TrendingUp,
  Search,
  Upload,
  ArrowRight,
  Lightbulb
} from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode | ComponentType<LucideProps>;
  title: string;
  description: string;
  action?: ReactNode | {
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
  // Render icon - handle both ReactNode and component type
  const renderIcon = () => {
    if (!icon) return null;
    
    // If it's already a valid React element, return it directly
    if (isValidElement(icon)) {
      return icon;
    }
    
    // Otherwise treat it as a component to instantiate
    const IconComponent = icon as ComponentType<LucideProps>;
    return <IconComponent className="h-8 w-8 text-muted-foreground" />;
  };

  // Render action - handle both ReactNode and object
  const renderAction = () => {
    if (!action) return null;
    
    // If it's already a valid React element, return it directly
    if (isValidElement(action)) {
      return action;
    }
    
    // If it's an object with label/onClick, render a button
    if (typeof action === 'object' && action !== null && 'label' in action && 'onClick' in action) {
      const actionConfig = action as { label: string; onClick: () => void };
      return (
        <Button onClick={actionConfig.onClick}>
          <Plus className="h-4 w-4 mr-2" />
          {actionConfig.label}
        </Button>
      );
    }
    
    return null;
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6 text-center",
      className
    )}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          {renderIcon()}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        {description}
      </p>
      {renderAction()}
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

// New enhanced empty states with navigation

export function EmptyProgress({ onStartLearning }: { onStartLearning?: () => void }) {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
      title="No progress yet"
      description="Start learning from your enrolled courses to track your progress and verify your skills."
      action={
        <Button onClick={onStartLearning ?? (() => navigate('/learn'))}>
          <Play className="h-4 w-4 mr-2" />
          Start Learning
        </Button>
      }
    />
  );
}

export function EmptyContent({ onFindContent }: { onFindContent?: () => void }) {
  return (
    <EmptyState
      icon={<Video className="h-8 w-8 text-muted-foreground" />}
      title="No content found"
      description="Search for educational videos and resources to help you master this topic."
      action={
        onFindContent && (
          <Button onClick={onFindContent}>
            <Search className="h-4 w-4 mr-2" />
            Find Content
          </Button>
        )
      }
    />
  );
}

export function EmptyLearningObjectives() {
  return (
    <EmptyState
      icon={<Lightbulb className="h-8 w-8 text-muted-foreground" />}
      title="No learning objectives yet"
      description="Learning objectives will be extracted automatically when you add course content."
    />
  );
}

export function EmptyEnrollments({ onBrowseCourses }: { onBrowseCourses?: () => void }) {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={<BookOpen className="h-8 w-8 text-muted-foreground" />}
      title="Not enrolled in any courses"
      description="Browse available courses or upload your own syllabus to get started with your learning journey."
      action={
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={onBrowseCourses ?? (() => navigate('/courses'))}>
            <Search className="h-4 w-4 mr-2" />
            Browse Courses
          </Button>
          <Button onClick={() => navigate('/onboarding')}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Syllabus
          </Button>
        </div>
      }
    />
  );
}

export function EmptyGapAnalysis({ onAnalyze }: { onAnalyze?: () => void }) {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={<Target className="h-8 w-8 text-muted-foreground" />}
      title="Gap analysis not completed"
      description="Add at least one course and one dream job to see how your skills compare to job requirements."
      action={
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => navigate('/courses')}>
            <BookOpen className="h-4 w-4 mr-2" />
            Add Course
          </Button>
          <Button onClick={() => navigate('/dream-jobs')}>
            <Briefcase className="h-4 w-4 mr-2" />
            Add Dream Job
          </Button>
        </div>
      }
    />
  );
}

export function EmptySearchResults({ query, onClearSearch }: { query?: string; onClearSearch?: () => void }) {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8 text-muted-foreground" />}
      title="No results found"
      description={query ? `No results match "${query}". Try different keywords or broaden your search.` : "Try adjusting your search terms."}
      action={
        onClearSearch && (
          <Button variant="outline" onClick={onClearSearch}>
            Clear Search
          </Button>
        )
      }
    />
  );
}

// Compact inline empty state for smaller spaces
interface InlineEmptyStateProps {
  icon?: ReactNode;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function InlineEmptyState({ icon, message, action, className }: InlineEmptyStateProps) {
  return (
    <div className={cn(
      "flex items-center justify-center gap-3 py-6 px-4 text-center bg-muted/30 rounded-lg border border-dashed",
      className
    )}>
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button variant="link" size="sm" onClick={action.onClick} className="text-primary">
          {action.label}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      )}
    </div>
  );
}