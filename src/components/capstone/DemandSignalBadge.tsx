import { TrendingUp, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface DemandSignalBadgeProps {
  signalScore?: number | null;
  postingCount?: number | null;
  medianSalary?: number | null;
  compact?: boolean;
}

/**
 * Visual indicator of market demand for a skill or company.
 * Shows heat level (low/medium/high) and optional salary data.
 */
export default function DemandSignalBadge({
  signalScore,
  postingCount,
  medianSalary,
  compact = false,
}: DemandSignalBadgeProps) {
  if (!signalScore && !postingCount) return null;

  const score = signalScore || 0;
  const heat = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
  const heatConfig = {
    high: { label: 'High Demand', color: 'bg-red-50 text-red-700 border-red-200', icon: Flame },
    medium: { label: 'Growing', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: TrendingUp },
    low: { label: 'Emerging', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: TrendingUp },
  }[heat];

  const Icon = heatConfig.icon;

  const tooltipContent = [
    postingCount && `${postingCount.toLocaleString()} active postings`,
    medianSalary && `Median salary: $${(medianSalary / 1000).toFixed(0)}k`,
    `Signal strength: ${(score * 100).toFixed(0)}%`,
  ].filter(Boolean).join(' · ');

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Icon className={`h-4 w-4 ${heat === 'high' ? 'text-red-500' : heat === 'medium' ? 'text-amber-500' : 'text-blue-500'}`} />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={`text-xs ${heatConfig.color}`}>
            <Icon className="h-3 w-3 mr-1" />
            {heatConfig.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
