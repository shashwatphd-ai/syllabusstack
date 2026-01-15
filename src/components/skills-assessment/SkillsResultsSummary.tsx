import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { HollandRadarChart } from './HollandRadarChart';
import { CheckCircle2, Target, Brain, Heart } from 'lucide-react';

interface SkillProfile {
  holland_code: string | null;
  holland_scores: Record<string, number>;
  technical_skills: Record<string, number>;
  work_values: Record<string, number>;
}

interface SkillsResultsSummaryProps {
  profile: SkillProfile;
  className?: string;
}

const WORK_VALUE_LABELS: Record<string, string> = {
  achievement: 'Achievement',
  independence: 'Independence',
  recognition: 'Recognition',
  relationships: 'Relationships',
  support: 'Support',
  working_conditions: 'Working Conditions',
};

export function SkillsResultsSummary({ profile, className }: SkillsResultsSummaryProps) {
  // Sort skills by score
  const topSkills = Object.entries(profile.technical_skills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Sort work values by score
  const sortedValues = Object.entries(profile.work_values)
    .sort((a, b) => b[1] - a[1]);

  const formatSkillName = (key: string): string => {
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className={className}>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Holland RIASEC Chart */}
        <HollandRadarChart
          scores={profile.holland_scores as Record<string, number> & {
            realistic: number;
            investigative: number;
            artistic: number;
            social: number;
            enterprising: number;
            conventional: number;
          }}
          hollandCode={profile.holland_code}
        />

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Assessment Complete
            </CardTitle>
            <CardDescription>
              Your personalized profile based on 103 validated questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Holland Code Explanation */}
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Your Holland Code: {profile.holland_code}</h4>
              <p className="text-sm text-muted-foreground">
                This 3-letter code represents your top interest areas based on the RIASEC model,
                widely used in career counseling.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <Target className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-2xl font-bold">{Object.keys(profile.technical_skills).length}</div>
                <div className="text-xs text-muted-foreground">Skills Rated</div>
              </div>
              <div>
                <Brain className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <div className="text-2xl font-bold">6</div>
                <div className="text-xs text-muted-foreground">Interest Areas</div>
              </div>
              <div>
                <Heart className="h-5 w-5 mx-auto mb-1 text-red-500" />
                <div className="text-2xl font-bold">6</div>
                <div className="text-xs text-muted-foreground">Work Values</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Your Top Skills
            </CardTitle>
            <CardDescription>
              Self-rated proficiency across O*NET skill categories
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topSkills.map(([skill, score]) => (
              <div key={skill} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{formatSkillName(skill)}</span>
                  <span className="font-medium">{score}%</span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Work Values */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Work Values
            </CardTitle>
            <CardDescription>
              What matters most to you in a career
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedValues.map(([value, score], index) => (
              <div key={value} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={index < 2 ? 'default' : 'secondary'} className="w-6 h-6 p-0 flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <span className="text-sm">{WORK_VALUE_LABELS[value] || value}</span>
                </div>
                <span className="text-sm font-medium">{score}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
