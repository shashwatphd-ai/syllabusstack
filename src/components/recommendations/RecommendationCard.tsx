import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  SkipForward
} from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationType = "course" | "project" | "certification" | "action" | "reading" | "skill" | "experience" | "resource" | "networking";
type Priority = "high" | "medium" | "low" | "critical" | "important" | "nice_to_have";
type Status = "pending" | "in_progress" | "completed" | "skipped" | "not_started";

interface Step {
  step: string;
  order?: number;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: RecommendationType;
  priority: Priority;
  estimatedTime?: string;
  effort_hours?: number;
  cost_usd?: number;
  provider?: string;
  url?: string;
  status: Status;
  relatedGap?: string;
  gap_addressed?: string;
  why_this_matters?: string;
  steps?: Step[] | string[];
  evidence_created?: string;
  how_to_demonstrate?: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onStatusChange?: (id: string, status: Status) => void;
  onView?: (id: string) => void;
}

const getTypeIcon = (type: RecommendationType) => {
  switch (type) {
    case "course":
      return <BookOpen className="h-5 w-5" />;
    case "project":
      return <Code className="h-5 w-5" />;
    case "certification":
      return <Star className="h-5 w-5" />;
    case "networking":
      return <Users className="h-5 w-5" />;
    case "reading":
    case "resource":
      return <Video className="h-5 w-5" />;
    case "action":
      return <PlayCircle className="h-5 w-5" />;
    default:
      return <Star className="h-5 w-5" />;
  }
};

const getPriorityColor = (priority: Priority): string => {
  switch (priority) {
    case "high":
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "medium":
    case "important":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "low":
    case "nice_to_have":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusColor = (status: Status): string => {
  switch (status) {
    case "completed":
      return "bg-green-500/10 text-green-600";
    case "in_progress":
      return "bg-blue-500/10 text-blue-600";
    case "skipped":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function RecommendationCard({ recommendation, onStatusChange }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { 
    id, 
    title, 
    description, 
    type, 
    priority, 
    estimatedTime,
    effort_hours,
    cost_usd,
    provider, 
    url, 
    status,
    gap_addressed,
    relatedGap,
    why_this_matters,
    steps,
    evidence_created,
    how_to_demonstrate
  } = recommendation;

  const isCompleted = status === "completed";
  const displayGap = gap_addressed || relatedGap;
  
  // Parse steps - can be array of strings or array of objects
  const parsedSteps = steps?.map((step, i) => {
    if (typeof step === 'string') return step;
    if (typeof step === 'object' && step !== null) {
      return (step as Step).step || String(step);
    }
    return String(step);
  }) || [];

  return (
    <Card className={cn(
      "transition-all",
      isCompleted ? "opacity-60" : "hover:shadow-md"
    )}>
      <CardHeader 
        className="pb-2 cursor-pointer" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className={cn(
              "px-2 py-1 text-xs font-medium",
              getPriorityColor(priority)
            )}>
              #{priority === 'critical' || priority === 'high' ? '1' : priority === 'important' || priority === 'medium' ? '2' : '3'}
            </Badge>
            <div className="flex-1">
              <h4 className={cn(
                "font-medium",
                isCompleted && "line-through text-muted-foreground"
              )}>
                {title}
              </h4>
              {displayGap && (
                <p className="text-sm text-muted-foreground mt-1">
                  Addresses: {displayGap}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {effort_hours ? `${effort_hours}h` : estimatedTime || 'Varies'}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {cost_usd === 0 || !cost_usd ? 'Free' : `$${cost_usd}`}
            </span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Status buttons */}
        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {(['pending', 'in_progress', 'completed', 'skipped'] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange?.(id, s)}
              className={cn(
                "px-2 py-1 text-xs rounded-full transition-colors",
                status === s 
                  ? getStatusColor(s) + " font-medium"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground"
              )}
            >
              {s === 'in_progress' ? 'in progress' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="border-t bg-muted/30 space-y-4 pt-4">
          {/* Description */}
          <div>
            <h5 className="text-sm font-medium mb-1">What To Do</h5>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {/* Why This Matters */}
          {why_this_matters && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <h5 className="text-sm font-medium text-primary mb-1">Why This Matters</h5>
              <p className="text-sm text-primary/80">{why_this_matters}</p>
            </div>
          )}

          {/* Steps */}
          {parsedSteps.length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Steps</h5>
              <ol className="list-decimal list-inside space-y-1">
                {parsedSteps.map((step, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Evidence Created */}
          {evidence_created && (
            <div>
              <h5 className="text-sm font-medium mb-1">Evidence Created</h5>
              <p className="text-sm text-muted-foreground">{evidence_created}</p>
            </div>
          )}

          {/* How to Demonstrate */}
          {how_to_demonstrate && (
            <div>
              <h5 className="text-sm font-medium mb-1">How to Demonstrate in Interviews</h5>
              <p className="text-sm text-muted-foreground italic">"{how_to_demonstrate}"</p>
            </div>
          )}

          {/* Action Button */}
          {url && (
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
            >
              Start: {provider || 'Resource'}
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </CardContent>
      )}
    </Card>
  );
}