import { Building2, MapPin, DollarSign, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { JobMatch } from '@/hooks/useJobMatches';

interface JobMatchCardProps {
  match: JobMatch;
  onMarkApplied?: (matchId: string) => void;
}

export default function JobMatchCard({ match, onMarkApplied }: JobMatchCardProps) {
  const scorePercent = Math.round(match.match_score * 100);
  const scoreColor = scorePercent >= 70 ? 'text-green-600' : scorePercent >= 50 ? 'text-amber-600' : 'text-red-500';

  const matchedSkills = match.skill_overlap?.matched || [];
  const missingSkills = match.skill_overlap?.missing || [];

  const salaryText = match.salary_estimate
    ? `$${((match.salary_estimate.min || 0) / 1000).toFixed(0)}k – $${((match.salary_estimate.max || 0) / 1000).toFixed(0)}k`
    : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{match.job_title}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {match.company_name && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {match.company_name}
                </span>
              )}
              {match.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {match.location}
                </span>
              )}
              {salaryText && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {salaryText}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`text-xl font-bold ${scoreColor}`}>{scorePercent}%</div>
            <span className="text-xs text-muted-foreground">match</span>
          </div>
        </div>

        {/* Skill overlap */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {matchedSkills.slice(0, 6).map(skill => (
            <Badge key={skill} variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {skill}
            </Badge>
          ))}
          {missingSkills.slice(0, 3).map(skill => (
            <Badge key={skill} variant="outline" className="text-xs text-amber-600 border-amber-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              {skill}
            </Badge>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">
              <TrendingUp className="h-3 w-3 mr-1" />
              {match.source?.replace('_', ' ') || 'match'}
            </Badge>
            {match.status !== 'active' && (
              <Badge variant="secondary" className="text-xs capitalize">{match.status}</Badge>
            )}
          </div>

          {match.status === 'active' && onMarkApplied && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onMarkApplied(match.id)}
            >
              Mark Applied
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
