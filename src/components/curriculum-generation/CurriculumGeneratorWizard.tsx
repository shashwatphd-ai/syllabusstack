import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, BookOpen, Clock, Target, Loader2, Check, X } from 'lucide-react';
import { useGenerateCurriculum, GenerateCurriculumParams } from '@/hooks/useGeneratedCurriculum';
import { CareerMatch } from '@/hooks/useCareerMatches';

interface CurriculumGeneratorWizardProps {
  careerMatch?: CareerMatch;
  dreamJobId?: string;
  occupationTitle: string;
  skillGaps?: Array<{ skill: string; gap: number }>;
  onComplete: (curriculumId: string) => void;
  onCancel: () => void;
}

export function CurriculumGeneratorWizard({
  careerMatch,
  dreamJobId,
  occupationTitle,
  skillGaps = [],
  onComplete,
  onCancel,
}: CurriculumGeneratorWizardProps) {
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [learningStyle, setLearningStyle] = useState<'visual' | 'reading' | 'hands_on'>('hands_on');
  const [prioritySkills, setPrioritySkills] = useState<string[]>([]);

  const generateCurriculum = useGenerateCurriculum();

  const togglePrioritySkill = (skill: string) => {
    setPrioritySkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const handleGenerate = async () => {
    const params: GenerateCurriculumParams = {
      customizations: {
        hours_per_week: hoursPerWeek,
        learning_style: learningStyle,
        priority_skills: prioritySkills,
      },
    };

    if (careerMatch) {
      params.career_match_id = careerMatch.id;
    } else if (dreamJobId) {
      params.dream_job_id = dreamJobId;
    }

    const result = await generateCurriculum.mutateAsync(params);
    onComplete(result.curriculum_id);
  };

  const estimatedWeeks = Math.ceil((skillGaps.length * 15) / hoursPerWeek);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Generate Learning Curriculum</CardTitle>
        </div>
        <CardDescription>
          Create a personalized learning path to become a <span className="font-medium">{occupationTitle}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Hours per week */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Hours per week: <span className="font-bold">{hoursPerWeek}</span>
          </Label>
          <Slider
            value={[hoursPerWeek]}
            onValueChange={([value]) => setHoursPerWeek(value)}
            min={5}
            max={40}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5 hrs (casual)</span>
            <span>20 hrs (part-time)</span>
            <span>40 hrs (full-time)</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Estimated completion: ~{estimatedWeeks} weeks
          </p>
        </div>

        {/* Learning style */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Learning style preference
          </Label>
          <RadioGroup
            value={learningStyle}
            onValueChange={(v) => setLearningStyle(v as typeof learningStyle)}
            className="grid grid-cols-3 gap-2"
          >
            <Label
              htmlFor="visual"
              className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${
                learningStyle === 'visual' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="visual" id="visual" className="sr-only" />
              <span className="text-2xl mb-1">🎥</span>
              <span className="text-sm font-medium">Visual</span>
              <span className="text-xs text-muted-foreground">Videos & diagrams</span>
            </Label>
            <Label
              htmlFor="reading"
              className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${
                learningStyle === 'reading' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="reading" id="reading" className="sr-only" />
              <span className="text-2xl mb-1">📚</span>
              <span className="text-sm font-medium">Reading</span>
              <span className="text-xs text-muted-foreground">Articles & docs</span>
            </Label>
            <Label
              htmlFor="hands_on"
              className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${
                learningStyle === 'hands_on' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="hands_on" id="hands_on" className="sr-only" />
              <span className="text-2xl mb-1">🛠️</span>
              <span className="text-sm font-medium">Hands-on</span>
              <span className="text-xs text-muted-foreground">Projects & labs</span>
            </Label>
          </RadioGroup>
        </div>

        {/* Priority skills */}
        {skillGaps.length > 0 && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Priority skills to focus on (optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {skillGaps.slice(0, 8).map((gap) => (
                <Badge
                  key={gap.skill}
                  variant={prioritySkills.includes(gap.skill) ? 'default' : 'outline'}
                  className="cursor-pointer transition-colors"
                  onClick={() => togglePrioritySkill(gap.skill)}
                >
                  {prioritySkills.includes(gap.skill) && <Check className="h-3 w-3 mr-1" />}
                  {gap.skill}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click skills to prioritize them in your curriculum
            </p>
          </div>
        )}

        {/* Generation progress */}
        {generateCurriculum.isPending && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="font-medium">Generating your curriculum...</span>
            </div>
            <Progress value={66} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Our AI is designing a personalized learning path based on your profile and the role requirements.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={generateCurriculum.isPending}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateCurriculum.isPending}
            className="flex-1"
          >
            {generateCurriculum.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Curriculum
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
