import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Search, 
  GraduationCap, 
  PlayCircle, 
  SkipForward,
  Sparkles,
  Lightbulb
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
  suggested_link: Lightbulb,
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
  
  // Special rendering for linked_learning state with progress bar
  if (state === 'linked_learning' && linkedCourseTitle) {
    const progress = enrollmentProgress ?? 0;
    const isComplete = progress >= 100;

    return (
      <div className={cn(
        "flex flex-col gap-1.5 text-xs rounded-md px-2 py-1.5",
        isComplete
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-indigo-50 text-indigo-700 border border-indigo-200",
        className
      )}>
        <div className="flex items-center gap-1.5">
          {isComplete ? (
            <CheckCircle2 className="h-3 w-3 text-green-600" />
          ) : (
            <GraduationCap className="h-3 w-3" />
          )}
          <span className="truncate max-w-[150px] font-medium">{linkedCourseTitle}</span>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 h-1.5 bg-white/50 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isComplete ? "bg-green-500" : "bg-indigo-500"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className={cn(
            "text-[10px] font-semibold min-w-[32px] text-right",
            isComplete && "text-green-600"
          )}>
            {progress}%
          </span>
        </div>
      </div>
    );
  }
  
  // Special rendering for suggested_link state
  if (state === 'suggested_link' && linkedCourseTitle) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 text-xs rounded-md px-2 py-1",
        "bg-amber-50 text-amber-700 border border-amber-200",
        className
      )}>
        <Lightbulb className="h-3 w-3" />
        <span>Suggested: </span>
        <span className="truncate max-w-[120px] font-medium">{linkedCourseTitle}</span>
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
