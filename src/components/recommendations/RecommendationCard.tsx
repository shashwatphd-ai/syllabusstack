import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Video, 
  Code, 
  Users, 
  ExternalLink,
  Clock,
  Star,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  PlayCircle,
  SkipForward,
  Circle,
  Loader2,
  Link2,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkCourseDialog } from "./LinkCourseDialog";
import { ActionabilityBadge } from "./ActionabilityBadge";
import { formatPrice, type PriceableItem } from "@/lib/price-utils";
import { 
  getActionabilityState, 
  getActionabilityConfig,
  isTerminalState,
  canStart,
  needsCourseAction,
  type ActionabilityState 
} from "@/lib/actionability-utils";

type RecommendationType = "course" | "project" | "certification" | "action" | "reading" | "skill" | "experience" | "resource" | "networking" | "portfolio";
type Priority = "high" | "medium" | "low" | "critical" | "important" | "nice_to_have";
type Status = "pending" | "in_progress" | "completed" | "skipped" | "not_started";

interface Step {
  step?: string;
  description?: string;
  text?: string;
  order?: number;
  estimated_time?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: RecommendationType;
  priority: Priority;
  estimatedTime?: string;
  effort_hours?: number;
  cost_usd?: number | null;
  price_known?: boolean;
  provider?: string;
  url?: string;
  status: Status;
  relatedGap?: string;
  gap_addressed?: string;
  why_this_matters?: string;
  steps?: Step[] | string[];
  evidence_created?: string;
  how_to_demonstrate?: string;
  dream_job_id?: string;
  // Linked course info (from view)
  linked_course_id?: string;
  linked_course_title?: string;
  enrollment_progress?: number;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onStatusChange?: (id: string, status: Status) => Promise<void>;
  onView?: (id: string) => void;
  onSearchCourse?: (recommendationId: string, gapAddressed: string) => Promise<void>;
  isUpdating?: boolean;
  isSearchingCourse?: boolean;
  showLinkOption?: boolean;
  dreamJobTitle?: string;
}

const getTypeConfig = (type: RecommendationType) => {
  const configs: Record<RecommendationType, { icon: typeof BookOpen; label: string; color: string }> = {
    course: { icon: BookOpen, label: "Course", color: "text-blue-600" },
    project: { icon: Code, label: "Project", color: "text-purple-600" },
    certification: { icon: Star, label: "Cert", color: "text-amber-600" },
    networking: { icon: Users, label: "Network", color: "text-green-600" },
    skill: { icon: Star, label: "Skill", color: "text-orange-600" },
    experience: { icon: Users, label: "Experience", color: "text-teal-600" },
    action: { icon: CheckCircle2, label: "Action", color: "text-indigo-600" },
    reading: { icon: BookOpen, label: "Reading", color: "text-emerald-600" },
    portfolio: { icon: Code, label: "Portfolio", color: "text-pink-600" },
    resource: { icon: Video, label: "Resource", color: "text-cyan-600" },
  };
  return configs[type] || { icon: Video, label: "Resource", color: "text-gray-600" };
};

const getPriorityConfig = (priority: Priority) => {
  switch (priority) {
    case "high":
    case "critical":
      return { 
        label: "High Priority",
        borderColor: "border-l-destructive",
        bgColor: "bg-destructive/5",
        badgeClass: "bg-destructive text-destructive-foreground"
      };
    case "medium":
    case "important":
      return { 
        label: "Medium",
        borderColor: "border-l-warning",
        bgColor: "hover:bg-warning/5",
        badgeClass: "bg-warning/10 text-warning border-warning/30"
      };
    case "low":
    case "nice_to_have":
      return { 
        label: "Low",
        borderColor: "border-l-muted-foreground",
        bgColor: "hover:bg-muted/50",
        badgeClass: "bg-muted text-muted-foreground"
      };
    default:
      return { 
        label: "",
        borderColor: "border-l-muted",
        bgColor: "",
        badgeClass: "bg-muted text-muted-foreground"
      };
  }
};

const getStatusConfig = (status: Status) => {
  switch (status) {
    case "completed":
      return { 
        bgClass: "bg-success/10",
        textClass: "text-success",
        icon: CheckCircle2,
        label: "Done"
      };
    case "in_progress":
      return { 
        bgClass: "bg-blue-500/10",
        textClass: "text-blue-600",
        icon: PlayCircle,
        label: "Active"
      };
    case "skipped":
      return { 
        bgClass: "bg-muted",
        textClass: "text-muted-foreground",
        icon: SkipForward,
        label: "Skipped"
      };
    default:
      return { 
        bgClass: "bg-muted/50",
        textClass: "text-muted-foreground",
        icon: Circle,
        label: "To Do"
      };
  }
};

export function RecommendationCard({ 
  recommendation, 
  onStatusChange, 
  onSearchCourse,
  isUpdating,
  isSearchingCourse,
  showLinkOption = true,
  dreamJobTitle 
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<Status | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  
  const { 
    id, 
    title, 
    description, 
    type, 
    priority, 
    estimatedTime,
    effort_hours,
    cost_usd,
    price_known,
    provider, 
    url, 
    status,
    gap_addressed,
    relatedGap,
    why_this_matters,
    steps,
    evidence_created,
    how_to_demonstrate,
    linked_course_id,
    linked_course_title,
    enrollment_progress,
  } = recommendation;

  // Compute actionability state
  const actionabilityState = getActionabilityState({
    status,
    type,
    url,
    linked_course_id,
    linked_course_title,
    enrollment_progress,
  });
  const actionabilityConfig = getActionabilityConfig(actionabilityState);

  const isCompleted = status === "completed";
  const isSkipped = status === "skipped";
  const displayGap = gap_addressed || relatedGap;
  const priorityConfig = getPriorityConfig(priority);
  const statusConfig = getStatusConfig(status);
  const typeConfig = getTypeConfig(type);
  const TypeIcon = typeConfig.icon;
  
  // Parse steps
  const parsedSteps = steps?.map((step, index) => {
    if (typeof step === 'string') return step;
    if (typeof step === 'object' && step !== null) {
      const stepObj = step as Step;
      const stepText = stepObj.description || stepObj.step || stepObj.text;
      if (stepText) {
        const timeInfo = stepObj.estimated_time ? ` (${stepObj.estimated_time})` : '';
        return `${stepText}${timeInfo}`;
      }
      return `Step ${stepObj.order || index + 1}`;
    }
    return `Step ${index + 1}`;
  }) || [];

  const handleStatusChange = async (newStatus: Status) => {
    if (!onStatusChange || status === newStatus) return;
    setUpdatingStatus(newStatus);
    try {
      await onStatusChange(id, newStatus);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Handle primary CTA based on actionability state
  const handlePrimaryCTA = () => {
    switch (actionabilityState) {
      case 'ready_to_start':
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        handleStatusChange('in_progress');
        break;
      case 'linked_learning':
        // Navigate to the linked course
        handleStatusChange('in_progress');
        break;
      case 'needs_course':
        // Trigger course search
        if (onSearchCourse && displayGap) {
          onSearchCourse(id, displayGap);
        }
        break;
      case 'generic_action':
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        handleStatusChange('in_progress');
        break;
      case 'in_progress':
        handleStatusChange('completed');
        break;
      case 'completed':
        handleStatusChange('pending');
        break;
      case 'skipped':
        handleStatusChange('pending');
        break;
    }
  };

  // Compact displays
  const timeDisplay = effort_hours ? `${effort_hours}h` : estimatedTime || null;
  const priceItem: PriceableItem = { cost_usd, price_known };
  const costDisplay = formatPrice(priceItem);
  
  // Determine if we're in a loading state
  const isPrimaryLoading = isSearchingCourse || !!updatingStatus;

  return (
    <Card className={cn(
      "transition-all border-l-4 overflow-hidden",
      priorityConfig.borderColor,
      isCompleted && "opacity-60",
      isSkipped && "opacity-40",
      !isCompleted && !isSkipped && priorityConfig.bgColor
    )}>
      <CardContent className="p-0">
        {/* Main Content - Always visible */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Top row: Type icon, Title, Actionability Badge */}
          <div className="flex items-start gap-3">
            {/* Type Icon */}
            <div className={cn(
              "p-2 rounded-lg shrink-0 mt-0.5",
              statusConfig.bgClass
            )}>
              <TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
            </div>
            
            {/* Title and Gap */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={cn(
                  "font-medium text-sm leading-tight",
                  isCompleted && "line-through text-muted-foreground",
                  isSkipped && "text-muted-foreground"
                )}>
                  {title}
                </h4>
              </div>
              {displayGap && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  <span className="font-medium">Skill gap:</span> {displayGap}
                </p>
              )}
              
              {/* Actionability Badge - shows linked course or state */}
              <div className="mt-1.5">
                <ActionabilityBadge
                  state={actionabilityState}
                  linkedCourseTitle={linked_course_title}
                  enrollmentProgress={enrollment_progress}
                />
              </div>
            </div>

            {/* Right side: Status badge + expand */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={cn(
                "text-[10px] px-1.5 py-0.5 gap-1",
                statusConfig.bgClass,
                statusConfig.textClass
              )}>
                <statusConfig.icon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2 ml-11 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
              {typeConfig.label}
            </Badge>
            {timeDisplay && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timeDisplay}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              {costDisplay}
            </span>
            {provider && (
              <span className="text-[11px] text-muted-foreground">
                via {provider}
              </span>
            )}
          </div>

          {/* Action buttons - State-aware CTAs */}
          <div className="mt-3 ml-11 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Primary CTA based on actionability state */}
            {!isTerminalState(actionabilityState) ? (
              <>
                <Button
                  variant={actionabilityConfig.ctaVariant}
                  size="sm"
                  onClick={handlePrimaryCTA}
                  disabled={isPrimaryLoading}
                  className={cn(
                    "h-7 text-xs gap-1",
                    actionabilityState === 'in_progress' && "bg-success hover:bg-success/90"
                  )}
                >
                  {isPrimaryLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : actionabilityState === 'needs_course' ? (
                    <Search className="h-3 w-3" />
                  ) : actionabilityState === 'in_progress' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <PlayCircle className="h-3 w-3" />
                  )}
                  {actionabilityConfig.ctaLabel}
                </Button>

                {/* Secondary actions based on state */}
                {actionabilityState === 'in_progress' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange('pending')}
                    disabled={!!updatingStatus}
                    className="h-7 text-xs gap-1 text-muted-foreground"
                  >
                    Pause
                  </Button>
                )}

                {(canStart(actionabilityState) || needsCourseAction(actionabilityState)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange('skipped')}
                    disabled={!!updatingStatus}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {updatingStatus === 'skipped' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <SkipForward className="h-3 w-3" />
                    )}
                    Skip
                  </Button>
                )}
              </>
            ) : (
              /* Terminal states: just show restore/undo */
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrimaryCTA}
                disabled={!!updatingStatus}
                className="h-7 text-xs gap-1 text-muted-foreground"
              >
                {updatingStatus ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {actionabilityConfig.ctaLabel}
              </Button>
            )}
            
            {/* External link if URL exists */}
            {url && (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-7 px-2 text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            )}
            
            {/* Link to Enrolled Course option */}
            {actionabilityConfig.showLinkButton && showLinkOption && !linked_course_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLinkDialog(true);
                }}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <Link2 className="h-3 w-3" />
                Link Course
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="border-t bg-muted/30 p-4 space-y-3">
            {/* Description */}
            {description && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What To Do</h5>
                <p className="text-sm">{description}</p>
              </div>
            )}

            {/* Why This Matters */}
            {why_this_matters && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <h5 className="text-xs font-medium text-primary uppercase tracking-wide mb-1">Why This Matters</h5>
                <p className="text-sm text-primary/80">{why_this_matters}</p>
              </div>
            )}

            {/* Steps */}
            {parsedSteps.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Steps</h5>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {parsedSteps.map((step, i) => (
                    <li key={i} className="text-muted-foreground">{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Evidence & Interview prep in a grid */}
            {(evidence_created || how_to_demonstrate) && (
              <div className="grid sm:grid-cols-2 gap-3">
                {evidence_created && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Evidence Created</h5>
                    <p className="text-sm">{evidence_created}</p>
                  </div>
                )}
                {how_to_demonstrate && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Interview Talking Point</h5>
                    <p className="text-sm italic">"{how_to_demonstrate}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      {/* Link Course Dialog */}
      <LinkCourseDialog
        open={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        recommendationId={id}
        recommendationTitle={title}
      />
    </Card>
  );
}
