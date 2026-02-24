import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, Brain, Clock, Sparkles } from 'lucide-react';
import { useSkillsAssessmentWizard } from '@/hooks/useSkillsAssessment';
import { useMatchCareers } from '@/hooks/useCareerMatches';
import { QuestionRenderer } from './QuestionRenderer';
import { AssessmentProgressBar } from './AssessmentProgressBar';
import { SkillsResultsSummary } from './SkillsResultsSummary';

interface SkillsAssessmentWizardProps {
  onComplete?: (skillProfileId: string) => void;
  onCancel?: () => void;
}

type WizardStep = 'intro' | 'assessment' | 'processing' | 'results';

export function SkillsAssessmentWizard({ onComplete, onCancel }: SkillsAssessmentWizardProps) {
  const [step, setStep] = useState<WizardStep>('intro');
  const [sessionType, setSessionType] = useState<'standard' | 'quick'>('standard');
  const [skillProfile, setSkillProfile] = useState<{
    id: string;
    holland_code: string | null;
    holland_scores: Record<string, number>;
    technical_skills: Record<string, number>;
    work_values: Record<string, number>;
  } | null>(null);

  const wizard = useSkillsAssessmentWizard();
  const matchCareers = useMatchCareers();

  const handleStart = async (type: 'standard' | 'quick') => {
    setSessionType(type);
    await wizard.start(type);
    setStep('assessment');
  };

  const handleAnswer = async (value: number) => {
    const result = await wizard.submitAnswer(value);
    if (result?.is_complete) {
      setStep('processing');
      // Complete assessment and get profile
      // Note: Career matching is now triggered automatically in the background
      // by the complete-skills-assessment edge function (per spec section 7.3 step 8)
      const completeResult = await wizard.complete();
      if (completeResult?.skill_profile) {
        setSkillProfile({
          id: completeResult.skill_profile.id,
          holland_code: completeResult.skill_profile.holland_code,
          holland_scores: completeResult.skill_profile.holland_scores,
          technical_skills: completeResult.skill_profile.technical_skills,
          work_values: completeResult.skill_profile.work_values,
        });
        setStep('results');
      }
    }
  };

  const handleFindCareers = async () => {
    await matchCareers.mutateAsync({});
    if (skillProfile) {
      onComplete?.(skillProfile.id);
    }
  };

  // Intro step
  if (step === 'intro') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Discover Your Career DNA</CardTitle>
            <CardDescription className="text-base max-w-lg mx-auto">
              Complete a scientifically-validated assessment to uncover careers that match your
              interests, skills, and values.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
              Answer questions about your interests, skills, and what matters to you at work. We'll match you with careers that fit.
            </p>

            {/* Session type options */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleStart('standard')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Badge variant="secondary" className="mt-1">Recommended</Badge>
                    <div className="flex-1">
                      <h3 className="font-semibold">Full Assessment</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Clock className="h-4 w-4" />
                        ~20 minutes • 103 questions
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Comprehensive profile for accurate career matching
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleStart('quick')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-1">Quick</Badge>
                    <div className="flex-1">
                      <h3 className="font-semibold">Quick Assessment</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Clock className="h-4 w-4" />
                        ~10 minutes • 54 questions
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Essential questions only, good for exploration
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cancel button */}
            {onCancel && (
              <div className="text-center">
                <Button variant="ghost" onClick={onCancel}>
                  Maybe Later
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Assessment step
  if (step === 'assessment') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress */}
        <AssessmentProgressBar
          currentSection={wizard.currentQuestion?.framework || 'holland_riasec'}
          answeredCount={wizard.progress.answered}
          totalCount={wizard.progress.total}
        />

        {/* Current question */}
        {wizard.currentQuestion && (
          <QuestionRenderer
            question={wizard.currentQuestion}
            onAnswer={handleAnswer}
            isSubmitting={wizard.isSubmitting}
            questionNumber={wizard.progress.answered + 1}
            totalQuestions={wizard.progress.total}
          />
        )}

        {/* Loading state */}
        {wizard.isLoading && !wizard.currentQuestion && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading questions...</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Processing step
  if (step === 'processing') {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-6 text-primary" />
            <h3 className="text-xl font-semibold mb-2">Analyzing Your Profile</h3>
            <p className="text-muted-foreground mb-4">
              Computing your Holland code and skill profile...
            </p>
            <p className="text-xs text-muted-foreground">
              Career matching will run automatically in the background
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Results step
  if (step === 'results' && skillProfile) {
    return (
      <div className="space-y-6">
        <SkillsResultsSummary profile={skillProfile} assessmentType={sessionType} />

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="animate-pulse">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Career Matching in Progress</p>
                <p className="text-xs text-muted-foreground">
                  We're finding your top career matches from 800+ O*NET occupations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            onClick={handleFindCareers}
            disabled={matchCareers.isPending}
          >
            {matchCareers.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Finding Matches...
              </>
            ) : (
              <>
                View Career Matches
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
