import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, XCircle } from 'lucide-react';
import type { SessionProgress } from '@/hooks/useAssessment';

interface AssessmentProgressProps {
  progress: SessionProgress;
  answeredQuestions: Map<string, boolean>; // questionId -> isCorrect
  currentQuestionId?: string;
  questionIds: string[];
}

export function AssessmentProgress({
  progress,
  answeredQuestions,
  currentQuestionId,
  questionIds,
}: AssessmentProgressProps) {
  const progressPercent = (progress.questions_answered / progress.total_questions) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Progress: {progress.questions_answered}/{progress.total_questions}
        </span>
        <Badge variant={progress.current_score >= 70 ? 'default' : 'secondary'}>
          Score: {progress.current_score}%
        </Badge>
      </div>

      <Progress value={progressPercent} className="h-2" />

      <div className="flex flex-wrap gap-2">
        {questionIds.map((qId, index) => {
          const isAnswered = answeredQuestions.has(qId);
          const isCorrect = answeredQuestions.get(qId);
          const isCurrent = qId === currentQuestionId;

          return (
            <div
              key={qId}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                isCurrent
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : ''
              } ${
                isAnswered
                  ? isCorrect
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-destructive/20 text-destructive'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {isAnswered ? (
                isCorrect ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )
              ) : (
                index + 1
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
