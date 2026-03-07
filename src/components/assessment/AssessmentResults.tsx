import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy, 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RotateCcw,
  ArrowLeft,
  TrendingUp,
} from 'lucide-react';
import type { PerformanceSummary, AssessmentQuestion } from '@/hooks/useAssessment';
import { PeerExplanation } from '@/components/community/PeerExplanation';

interface AssessmentResultsProps {
  performance: PerformanceSummary;
  questions: AssessmentQuestion[];
  incorrectAnswers: Array<{
    question_id: string;
    user_answer: string;
    evaluation_details: Record<string, unknown>;
  }>;
  onRetry?: () => void;
  onBack?: () => void;
}

export function AssessmentResults({
  performance,
  questions,
  incorrectAnswers,
  onRetry,
  onBack,
}: AssessmentResultsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-primary';
    if (score >= 50) return 'text-yellow-500';
    return 'text-destructive';
  };

  const incorrectQuestionMap = new Map(
    incorrectAnswers.map((a) => [a.question_id, a])
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Score Card */}
      <Card className={performance.passed ? 'border-green-500/50' : 'border-destructive/50'}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className={`inline-flex p-4 rounded-full ${performance.passed ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              {performance.passed ? (
                <Trophy className={`h-12 w-12 ${getScoreColor(performance.total_score)}`} />
              ) : (
                <Target className="h-12 w-12 text-destructive" />
              )}
            </div>
            
            <div>
              <h2 className={`text-4xl font-bold ${getScoreColor(performance.total_score)}`}>
                {Math.round(performance.total_score)}%
              </h2>
              <p className="text-muted-foreground mt-1">
                {performance.passed ? 'Assessment Passed!' : 'Keep practicing!'}
              </p>
            </div>

            <Badge variant={performance.passed ? 'default' : 'destructive'} className="text-sm">
              {performance.passed ? '✓ Learning Objective Verified' : `Requires ${performance.passing_threshold}% to pass`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{performance.questions_correct}</p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 text-center">
            <XCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
            <p className="text-2xl font-bold">{performance.questions_incorrect}</p>
            <p className="text-xs text-muted-foreground">Incorrect</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{formatTime(performance.total_time_seconds)}</p>
            <p className="text-xs text-muted-foreground">Total Time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{formatTime(performance.avg_time_per_question)}</p>
            <p className="text-xs text-muted-foreground">Avg/Question</p>
          </CardContent>
        </Card>
      </div>

      {/* Attempt Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Attempt Number</span>
            <Badge variant="outline">{performance.attempt_number}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Review Incorrect Answers */}
      {incorrectAnswers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Review Incorrect Answers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {incorrectAnswers.map((incorrect, index) => {
              const question = questions.find((q) => q.id === incorrect.question_id);
              if (!question) return null;

              return (
                <div
                  key={incorrect.question_id}
                  className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-2"
                >
                  <p className="font-medium text-sm">
                    {index + 1}. {question.question_text}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Your Answer</p>
                      <p className="text-destructive">{incorrect.user_answer}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Correct Answer</p>
                      <p className="text-green-500">{question.correct_answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Objectives
          </Button>
        )}
        {onRetry && !performance.passed && (
          <Button onClick={onRetry} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
