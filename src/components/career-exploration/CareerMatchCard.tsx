import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Briefcase, 
  TrendingUp, 
  DollarSign, 
  GraduationCap, 
  Bookmark, 
  BookmarkCheck,
  Plus,
  XCircle,
  Leaf,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CareerMatch } from '@/hooks/useCareerMatches';

interface CareerMatchCardProps {
  match: CareerMatch;
  onSave?: () => void;
  onDismiss?: () => void;
  onAddToDreamJobs?: () => void;
  onViewDetails?: () => void;
  isLoading?: boolean;
}

export function CareerMatchCard({
  match,
  onSave,
  onDismiss,
  onAddToDreamJobs,
  onViewDetails,
  isLoading,
}: CareerMatchCardProps) {
  const getMatchColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getMatchBg = (score: number): string => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'bg-blue-100 dark:bg-blue-900/30';
    if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-muted';
  };

  return (
    <Card className={cn(
      'hover:shadow-md transition-all',
      match.is_saved && 'border-primary',
      match.is_dismissed && 'opacity-50'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{match.occupation_title}</CardTitle>
              {match.dream_job_id && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Dream Job
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs font-mono">
              O*NET: {match.onet_soc_code}
            </CardDescription>
          </div>
          
          {/* Match Score */}
          <div className={cn('text-center p-3 rounded-lg', getMatchBg(match.overall_match_score))}>
            <div className={cn('text-2xl font-bold', getMatchColor(match.overall_match_score))}>
              {match.overall_match_score}%
            </div>
            <div className="text-xs text-muted-foreground">Match</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score Breakdown */}
        <div className="grid grid-cols-3 gap-2">
          {match.interest_match_score !== null && (
            <div className="text-center p-2 rounded bg-muted/50">
              <div className="text-sm font-medium">{match.interest_match_score}%</div>
              <div className="text-xs text-muted-foreground">Interests</div>
            </div>
          )}
          {match.skill_match_score !== null && (
            <div className="text-center p-2 rounded bg-muted/50">
              <div className="text-sm font-medium">{match.skill_match_score}%</div>
              <div className="text-xs text-muted-foreground">Skills</div>
            </div>
          )}
          {match.values_match_score !== null && (
            <div className="text-center p-2 rounded bg-muted/50">
              <div className="text-sm font-medium">{match.values_match_score}%</div>
              <div className="text-xs text-muted-foreground">Values</div>
            </div>
          )}
        </div>

        {/* Skill Gaps Preview */}
        {match.skill_gaps && match.skill_gaps.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Top Skill Gaps</div>
            {match.skill_gaps.slice(0, 3).map((gap, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{gap.skill.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">
                    {gap.current_level} → {gap.required_level}
                  </span>
                </div>
                <Progress value={(gap.current_level / gap.required_level) * 100} className="h-1" />
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {!match.dream_job_id && onAddToDreamJobs && (
            <Button
              size="sm"
              variant="default"
              onClick={onAddToDreamJobs}
              disabled={isLoading}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add to Dream Jobs
            </Button>
          )}
          
          {onSave && !match.is_saved && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSave}
              disabled={isLoading}
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          )}
          
          {match.is_saved && (
            <Button size="sm" variant="ghost" disabled>
              <BookmarkCheck className="h-4 w-4 text-primary" />
            </Button>
          )}
          
          {onDismiss && !match.is_dismissed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              disabled={isLoading}
            >
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}

          {onViewDetails && (
            <Button
              size="sm"
              variant="outline"
              onClick={onViewDetails}
              disabled={isLoading}
            >
              Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
