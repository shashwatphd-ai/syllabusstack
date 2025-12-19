// HonestAssessment Component
// Per Technical Specification v3.0 Part 8.2
// Displays candid career readiness feedback with visual indicators

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Target,
  Clock,
  Briefcase,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Readiness levels per spec
type ReadinessLevel = 'ready_to_apply' | '3_months_away' | '6_months_away' | '1_year_away' | 'needs_significant_development';

interface HonestAssessmentProps {
  dreamJobTitle: string;
  matchScore: number;
  readinessLevel?: ReadinessLevel;
  honestAssessment?: string;
  interviewReadiness?: string;
  jobSuccessPrediction?: string;
  strongOverlaps?: Array<{
    student_capability: string;
    job_requirement: string;
    assessment: string;
  }>;
  criticalGaps?: Array<{
    job_requirement: string;
    student_status: string;
    impact: string;
  }>;
  priorityGaps?: Array<{
    gap: string;
    priority: number;
    reason: string;
  }>;
  isLoading?: boolean;
}

// Readiness level configuration
const READINESS_CONFIG: Record<ReadinessLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof CheckCircle2;
}> = {
  ready_to_apply: {
    label: 'Ready to Apply',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
    icon: CheckCircle2,
  },
  '3_months_away': {
    label: '3 Months Away',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500',
    icon: Clock,
  },
  '6_months_away': {
    label: '6 Months Away',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500',
    icon: Clock,
  },
  '1_year_away': {
    label: '1 Year Away',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500',
    icon: AlertTriangle,
  },
  needs_significant_development: {
    label: 'Significant Work Needed',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500',
    icon: AlertTriangle,
  },
};

export function HonestAssessment({ 
  dreamJobTitle,
  matchScore = 0,
  readinessLevel = 'needs_significant_development',
  honestAssessment,
  interviewReadiness,
  jobSuccessPrediction,
  strongOverlaps = [],
  criticalGaps = [],
  priorityGaps = [],
  isLoading 
}: HonestAssessmentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const readinessConfig = READINESS_CONFIG[readinessLevel] || READINESS_CONFIG.needs_significant_development;
  const ReadinessIcon = readinessConfig.icon;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-l-4", readinessConfig.borderColor)}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Assessment for {dreamJobTitle}
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Readiness Badge */}
            <Badge className={cn(readinessConfig.bgColor, readinessConfig.color, "border-0")}>
              <ReadinessIcon className="h-3 w-3 mr-1" />
              {readinessConfig.label}
            </Badge>
          </div>
        </div>
        
        {/* Match Score Progress Ring */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${matchScore}, 100`}
                className={cn(
                  matchScore >= 70 ? "text-green-500" :
                  matchScore >= 50 ? "text-yellow-500" :
                  matchScore >= 30 ? "text-orange-500" :
                  "text-red-500"
                )}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold">{matchScore}%</span>
            </div>
          </div>
          <div>
            <p className="font-medium">Match Score</p>
            <p className="text-sm text-muted-foreground">
              {matchScore >= 70 ? "Strong candidate" :
               matchScore >= 50 ? "Competitive with development" :
               matchScore >= 30 ? "Significant gaps to address" :
               "Major development needed"}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Honest Assessment - Main Feedback */}
        {honestAssessment && (
          <div className="bg-muted/50 rounded-lg p-4 border">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm leading-relaxed">{honestAssessment}</p>
            </div>
          </div>
        )}

        {/* Interview & Job Success Predictions */}
        {(interviewReadiness || jobSuccessPrediction) && (
          <div className="grid md:grid-cols-2 gap-4">
            {interviewReadiness && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Interview Readiness</span>
                </div>
                <p className="text-sm text-muted-foreground">{interviewReadiness}</p>
              </div>
            )}
            {jobSuccessPrediction && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Job Success Prediction</span>
                </div>
                <p className="text-sm text-muted-foreground">{jobSuccessPrediction}</p>
              </div>
            )}
          </div>
        )}

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span>View Detailed Breakdown</span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-6 pt-4">
            {/* Strong Overlaps */}
            {strongOverlaps.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Your Strengths ({strongOverlaps.length})
                </h4>
                <div className="space-y-2">
                  {strongOverlaps.map((overlap, index) => (
                    <div key={index} className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <div>
                          <p className="text-sm font-medium">{overlap.student_capability}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Matches: {overlap.job_requirement}
                          </p>
                          {overlap.assessment && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {overlap.assessment}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critical Gaps */}
            {criticalGaps.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Gaps ({criticalGaps.length})
                </h4>
                <div className="space-y-2">
                  {criticalGaps.map((gap, index) => (
                    <div key={index} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 mt-1">!</span>
                        <div>
                          <p className="text-sm font-medium">{gap.job_requirement}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Current: {gap.student_status}
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            Impact: {gap.impact}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Gaps */}
            {priorityGaps.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Priority Focus Areas
                </h4>
                <div className="space-y-2">
                  {priorityGaps.slice(0, 5).map((gap, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        index === 0 ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {gap.priority || index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{gap.gap}</p>
                        <p className="text-xs text-muted-foreground">{gap.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
