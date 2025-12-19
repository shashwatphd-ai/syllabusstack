import { CheckCircle2, ArrowRight, Zap, Sparkles, ThumbsUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type OverlapStrength = 'strong' | 'moderate' | 'partial';

interface Overlap {
  id?: string;
  student_capability?: string;
  studentCapability?: string;
  job_requirement?: string;
  jobRequirement?: string;
  strength?: OverlapStrength;
  strengthScore?: number;
  assessment?: string;
  source?: string;
  notes?: string;
}

interface OverlapsListProps {
  overlaps?: Overlap[];
  strongOverlaps?: Array<{
    student_capability: string;
    job_requirement: string;
    assessment: string;
  }>;
  partialOverlaps?: Array<{
    student_capability: string;
    job_requirement: string;
    assessment: string;
  }>;
  isLoading?: boolean;
  variant?: 'full' | 'compact';
}

function getStrengthColor(strength?: OverlapStrength | string): string {
  switch (strength) {
    case 'strong':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'moderate':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'partial':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getProgressColor(strength?: OverlapStrength | string): string {
  switch (strength) {
    case 'strong':
      return '[&>div]:bg-green-500';
    case 'moderate':
      return '[&>div]:bg-amber-500';
    case 'partial':
      return '[&>div]:bg-blue-500';
    default:
      return '';
  }
}

export function OverlapsList({ 
  overlaps = [], 
  strongOverlaps = [],
  partialOverlaps = [],
  isLoading,
  variant = 'full'
}: OverlapsListProps) {
  // Merge overlaps from different sources
  const allOverlaps: Overlap[] = [
    ...strongOverlaps.map((o, i) => ({
      id: `strong-${i}`,
      student_capability: o.student_capability,
      job_requirement: o.job_requirement,
      assessment: o.assessment,
      strength: 'strong' as OverlapStrength,
      strengthScore: 85 + Math.random() * 15,
    })),
    ...partialOverlaps.map((o, i) => ({
      id: `partial-${i}`,
      student_capability: o.student_capability,
      job_requirement: o.job_requirement,
      assessment: o.assessment,
      strength: 'partial' as OverlapStrength,
      strengthScore: 50 + Math.random() * 25,
    })),
    ...overlaps.filter(o => 
      !strongOverlaps.find(so => so.student_capability === (o.student_capability || o.studentCapability)) &&
      !partialOverlaps.find(po => po.student_capability === (o.student_capability || o.studentCapability))
    ),
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const strongCount = allOverlaps.filter((o) => o.strength === 'strong').length;
  const moderateCount = allOverlaps.filter((o) => o.strength === 'moderate').length;
  const partialCount = allOverlaps.filter((o) => o.strength === 'partial').length;

  if (allOverlaps.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Zap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No skill overlaps found yet. Add more courses to discover matches.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Skills That Match ({allOverlaps.length})
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            {strongCount > 0 && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                <ThumbsUp className="h-3 w-3 mr-1" />
                {strongCount} Strong
              </Badge>
            )}
            {partialCount > 0 && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                {partialCount} Partial
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {allOverlaps.map((overlap, index) => {
          const capability = overlap.student_capability || overlap.studentCapability || 'Your Skill';
          const requirement = overlap.job_requirement || overlap.jobRequirement || 'Job Requirement';
          const assessment = overlap.assessment || overlap.notes || '';
          const score = overlap.strengthScore || (overlap.strength === 'strong' ? 90 : overlap.strength === 'partial' ? 60 : 75);

          return (
            <div
              key={overlap.id || index}
              className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              {/* Capability to Requirement Mapping */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{capability}</p>
                  {overlap.source && (
                    <p className="text-xs text-muted-foreground">From: {overlap.source}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{requirement}</p>
                  <p className="text-xs text-muted-foreground">Required by role</p>
                </div>
              </div>

              {/* Strength Indicator */}
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className={cn('capitalize', getStrengthColor(overlap.strength))}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {overlap.strength || 'match'}
                </Badge>
                <div className="flex-1">
                  <Progress 
                    value={score} 
                    className={cn('h-2', getProgressColor(overlap.strength))}
                  />
                </div>
                <span className="text-sm font-medium w-10 text-right">
                  {Math.round(score)}%
                </span>
              </div>

              {/* Assessment */}
              {assessment && (
                <p className="text-sm text-muted-foreground">{assessment}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
