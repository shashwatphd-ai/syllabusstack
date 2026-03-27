import { Badge } from "@/components/ui/badge";

interface QualityBadgeProps {
  score: number; // 0-1 scale (final_score from capstone_projects)
  size?: 'sm' | 'md' | 'lg';
}

export function QualityBadge({ score, size = 'md' }: QualityBadgeProps) {
  const pct = score * 100;

  const { grade, variant, label } =
    pct >= 85 ? { grade: 'A+', variant: 'default' as const, label: 'Excellent' } :
    pct >= 80 ? { grade: 'A', variant: 'default' as const, label: 'Very Good' } :
    pct >= 75 ? { grade: 'B+', variant: 'secondary' as const, label: 'Good' } :
    pct >= 70 ? { grade: 'B', variant: 'secondary' as const, label: 'Fair' } :
    { grade: 'C', variant: 'destructive' as const, label: 'Needs Review' };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5 font-semibold',
  };

  return (
    <Badge
      variant={variant}
      className={`${sizeClasses[size]} ${pct >= 80 ? 'bg-green-600 hover:bg-green-700' : pct >= 70 ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}`}
      title={`Quality: ${grade} (${pct.toFixed(0)}%) — ${label}`}
    >
      {grade}
    </Badge>
  );
}
