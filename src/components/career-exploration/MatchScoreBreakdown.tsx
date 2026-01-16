import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Brain, Target, Heart, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchScoreBreakdownProps {
  interestScore: number;
  skillScore: number;
  valuesScore: number;
  overallScore: number;
  userHollandCode?: string;
  occupationHollandCode?: string;
  className?: string;
  compact?: boolean;
}

const SCORE_COLORS = {
  high: 'text-green-600',
  medium: 'text-amber-600',
  low: 'text-red-600',
};

const PROGRESS_COLORS = {
  high: 'bg-green-500',
  medium: 'bg-amber-500',
  low: 'bg-red-500',
};

function getScoreCategory(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function MatchScoreBreakdown({
  interestScore,
  skillScore,
  valuesScore,
  overallScore,
  userHollandCode,
  occupationHollandCode,
  className,
  compact = false,
}: MatchScoreBreakdownProps) {
  const scores = [
    {
      label: 'Interest Match',
      score: interestScore,
      weight: '40%',
      icon: Brain,
      description: 'How well your Holland RIASEC profile matches this occupation',
      details: userHollandCode && occupationHollandCode 
        ? `Your code: ${userHollandCode} → Job: ${occupationHollandCode}`
        : undefined,
    },
    {
      label: 'Skills Match',
      score: skillScore,
      weight: '40%',
      icon: Target,
      description: 'How your technical skills align with job requirements',
    },
    {
      label: 'Values Match',
      score: valuesScore,
      weight: '20%',
      icon: Heart,
      description: 'How your work values align with this career',
    },
  ];

  if (compact) {
    return (
      <TooltipProvider>
        <div className={cn("flex gap-2", className)}>
          {scores.map(({ label, score, icon: Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs">
                  <Icon className={cn("h-3 w-3", SCORE_COLORS[getScoreCategory(score)])} />
                  <span className={cn("font-medium", SCORE_COLORS[getScoreCategory(score)])}>
                    {score}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{score}% match</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Overall Score Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <span className="text-sm font-medium text-muted-foreground">Overall Match</span>
        <span className={cn(
          "text-2xl font-bold",
          SCORE_COLORS[getScoreCategory(overallScore)]
        )}>
          {overallScore}%
        </span>
      </div>

      {/* Individual Score Breakdowns */}
      <div className="space-y-3">
        {scores.map(({ label, score, weight, icon: Icon, description, details }) => (
          <TooltipProvider key={label}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", SCORE_COLORS[getScoreCategory(score)])} />
                  <span className="text-sm font-medium">{label}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{description}</p>
                      {details && (
                        <p className="mt-1 text-xs text-muted-foreground">{details}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">({weight})</span>
                  <span className={cn("font-semibold", SCORE_COLORS[getScoreCategory(score)])}>
                    {score}%
                  </span>
                </div>
              </div>
              <div className="relative">
                <Progress 
                  value={score} 
                  className="h-2"
                />
                <div 
                  className={cn(
                    "absolute top-0 left-0 h-2 rounded-full transition-all",
                    PROGRESS_COLORS[getScoreCategory(score)]
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          </TooltipProvider>
        ))}
      </div>

      {/* Formula Explanation */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Overall = (Interest × 40%) + (Skills × 40%) + (Values × 20%)
        </p>
      </div>
    </div>
  );
}
