import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Search, 
  GraduationCap, 
  PlayCircle, 
  SkipForward,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  type ActionabilityState, 
  getActionabilityConfig 
} from "@/lib/actionability-utils";

interface ActionabilityBadgeProps {
  state: ActionabilityState;
  linkedCourseTitle?: string | null;
  enrollmentProgress?: number | null;
  className?: string;
}

const stateIcons: Record<ActionabilityState, React.ComponentType<{ className?: string }>> = {
  ready_to_start: Sparkles,
  needs_course: Search,
  linked_learning: GraduationCap,
  generic_action: PlayCircle,
  in_progress: PlayCircle,
  completed: CheckCircle2,
  skipped: SkipForward,
};

export function ActionabilityBadge({
  state,
  linkedCourseTitle,
  enrollmentProgress,
  className,
}: ActionabilityBadgeProps) {
  const config = getActionabilityConfig(state);
  const Icon = stateIcons[state];
  
  // Don't render badge for generic_action (non-course types)
  if (state === 'generic_action') return null;
  
  // Special rendering for linked_learning state
  if (state === 'linked_learning' && linkedCourseTitle) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 text-xs rounded-md px-2 py-1",
        "bg-indigo-50 text-indigo-700 border border-indigo-200",
        className
      )}>
        <GraduationCap className="h-3 w-3" />
        <span className="truncate max-w-[150px]">{linkedCourseTitle}</span>
        {enrollmentProgress !== undefined && enrollmentProgress !== null && (
          <Badge 
            variant="outline" 
            className="text-[9px] px-1 py-0 h-4 bg-indigo-100 border-indigo-200 ml-1"
          >
            {enrollmentProgress}%
          </Badge>
        )}
      </div>
    );
  }
  
  return (
    <Badge 
      variant={config.badgeVariant}
      className={cn(
        "text-[10px] px-1.5 py-0.5 gap-1 font-medium",
        config.badgeClassName,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
