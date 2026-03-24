import { Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CompanyHiringBadgeProps {
  jobPostings?: any[] | null;
}

export function CompanyHiringBadge({ jobPostings }: CompanyHiringBadgeProps) {
  if (!jobPostings || !Array.isArray(jobPostings) || jobPostings.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="default" className="gap-1 text-[10px] bg-green-600 hover:bg-green-700">
          <Briefcase className="h-2.5 w-2.5" />
          {jobPostings.length} Job{jobPostings.length > 1 ? 's' : ''}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs font-medium mb-1">Active Job Postings</p>
        <ul className="text-xs space-y-0.5">
          {jobPostings.slice(0, 5).map((jp: any, i: number) => (
            <li key={i} className="truncate">{jp.title || jp.name || 'Untitled'}</li>
          ))}
          {jobPostings.length > 5 && <li className="text-muted-foreground">+{jobPostings.length - 5} more</li>}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
