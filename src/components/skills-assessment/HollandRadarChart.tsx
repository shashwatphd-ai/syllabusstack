import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HollandScores {
  realistic: number;
  investigative: number;
  artistic: number;
  social: number;
  enterprising: number;
  conventional: number;
}

interface HollandRadarChartProps {
  scores: HollandScores;
  hollandCode?: string | null;
  showCard?: boolean;
  className?: string;
}

const DIMENSION_LABELS: Record<keyof HollandScores, { short: string; full: string }> = {
  realistic: { short: 'R', full: 'Realistic' },
  investigative: { short: 'I', full: 'Investigative' },
  artistic: { short: 'A', full: 'Artistic' },
  social: { short: 'S', full: 'Social' },
  enterprising: { short: 'E', full: 'Enterprising' },
  conventional: { short: 'C', full: 'Conventional' },
};

export function HollandRadarChart({
  scores,
  hollandCode,
  showCard = true,
  className,
}: HollandRadarChartProps) {
  const data = Object.entries(scores).map(([key, value]) => ({
    dimension: DIMENSION_LABELS[key as keyof HollandScores].full,
    shortLabel: DIMENSION_LABELS[key as keyof HollandScores].short,
    score: value,
    fullMark: 100,
  }));

  const chartContent = (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid strokeDasharray="3 3" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Radar
          name="Your Profile"
          dataKey="score"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          formatter={(value: number) => [`${value}%`, 'Score']}
        />
      </RadarChart>
    </ResponsiveContainer>
  );

  if (!showCard) {
    return <div className={className}>{chartContent}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Holland RIASEC Profile</CardTitle>
            <CardDescription>Your interest pattern based on the assessment</CardDescription>
          </div>
          {hollandCode && (
            <Badge variant="secondary" className="text-lg font-mono px-3 py-1">
              {hollandCode}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>{chartContent}</CardContent>
    </Card>
  );
}
