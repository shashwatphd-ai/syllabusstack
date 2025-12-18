import { CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type OverlapStrength = 'strong' | 'moderate' | 'partial';

interface Overlap {
  id: string;
  studentCapability: string;
  jobRequirement: string;
  strength: OverlapStrength;
  strengthScore: number; // 0-100
  assessment: string;
  source: string; // Course name that provided this capability
}

interface OverlapsListProps {
  overlaps?: Overlap[];
  isLoading?: boolean;
}

const mockOverlaps: Overlap[] = [
  {
    id: '1',
    studentCapability: 'Data Analysis & Visualization',
    jobRequirement: 'Analyze business metrics and create dashboards',
    strength: 'strong',
    strengthScore: 92,
    assessment: 'Your coursework in Business Analytics directly aligns with this requirement.',
    source: 'Business Analytics 301',
  },
  {
    id: '2',
    studentCapability: 'Project Management',
    jobRequirement: 'Lead cross-functional project teams',
    strength: 'strong',
    strengthScore: 85,
    assessment: 'Capstone project experience demonstrates team leadership capabilities.',
    source: 'Capstone Project',
  },
  {
    id: '3',
    studentCapability: 'SQL & Database Queries',
    jobRequirement: 'Extract and manipulate data from databases',
    strength: 'moderate',
    strengthScore: 72,
    assessment: 'Foundation is solid, but could benefit from more advanced query practice.',
    source: 'Database Management',
  },
  {
    id: '4',
    studentCapability: 'Presentation Skills',
    jobRequirement: 'Present findings to stakeholders',
    strength: 'moderate',
    strengthScore: 68,
    assessment: 'Group presentations provide a foundation; more executive-level practice recommended.',
    source: 'Business Communication',
  },
  {
    id: '5',
    studentCapability: 'Statistical Analysis',
    jobRequirement: 'Apply statistical methods to business problems',
    strength: 'partial',
    strengthScore: 55,
    assessment: 'Basic statistics covered; advanced methods like A/B testing need development.',
    source: 'Statistics 201',
  },
];

function getStrengthColor(strength: OverlapStrength): string {
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

function getProgressColor(strength: OverlapStrength): string {
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

export function OverlapsList({ overlaps = mockOverlaps, isLoading }: OverlapsListProps) {
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

  const strongCount = overlaps.filter((o) => o.strength === 'strong').length;
  const moderateCount = overlaps.filter((o) => o.strength === 'moderate').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Skills That Match
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              {strongCount} Strong
            </Badge>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              {moderateCount} Moderate
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {overlaps.map((overlap) => (
          <div
            key={overlap.id}
            className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
          >
            {/* Capability to Requirement Mapping */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{overlap.studentCapability}</p>
                <p className="text-xs text-muted-foreground">From: {overlap.source}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{overlap.jobRequirement}</p>
                <p className="text-xs text-muted-foreground">Required by role</p>
              </div>
            </div>

            {/* Strength Indicator */}
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className={cn('capitalize', getStrengthColor(overlap.strength))}>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {overlap.strength} match
              </Badge>
              <div className="flex-1">
                <Progress 
                  value={overlap.strengthScore} 
                  className={cn('h-2', getProgressColor(overlap.strength))}
                />
              </div>
              <span className="text-sm font-medium w-10 text-right">
                {overlap.strengthScore}%
              </span>
            </div>

            {/* Assessment */}
            <p className="text-sm text-muted-foreground">{overlap.assessment}</p>
          </div>
        ))}

        {overlaps.length === 0 && (
          <div className="text-center py-8">
            <Zap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No skill overlaps found yet. Add more courses to discover matches.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
