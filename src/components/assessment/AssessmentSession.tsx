import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import { QuestionCard } from './QuestionCard';
import { AssessmentProgress } from './AssessmentProgress';
import { AssessmentResults } from './AssessmentResults';
import {
  useStartAssessment,
  useSubmitAssessmentAnswer,
  useCompleteAssessment,
  type AssessmentQuestion,
  type SessionProgress,
  type PerformanceSummary,
} from '@/hooks/useAssessment';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AssessmentSessionProps {
  learningObjectiveId: string;
  learningObjectiveText: string;
  onClose?: () => void;
}

type SessionState = 'idle' | 'loading' | 'active' | 'submitting' | 'completed' | 'error';

export function AssessmentSession({
  learningObjectiveId,
  learningObjectiveText,
  onClose,
}: AssessmentSessionProps) {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [progress, setProgress] = useState<SessionProgress>({
    questions_answered: 0,
    questions_correct: 0,
    total_questions: 0,
    current_score: 0,
    is_complete: false,
  });
  const [answeredQuestions, setAnsweredQuestions] = useState<Map<string, boolean>>(new Map());
  const [currentFeedback, setCurrentFeedback] = useState<{
    isCorrect: boolean;
    correctAnswer: string | null;
    timeTaken: number;
  } | null>(null);
  const [results, setResults] = useState<{
    performance: PerformanceSummary;
    incorrectAnswers: Array<{
      question_id: string;
      user_answer: string;
      evaluation_details: Record<string, unknown>;
    }>;
  } | null>(null);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionServedAt = useRef<string>(new Date().toISOString());

  const startAssessment = useStartAssessment();
  const submitAnswer = useSubmitAssessmentAnswer();
  const completeAssessment = useCompleteAssessment();

  const handleStart = useCallback(async () => {
    setSessionState('loading');
    setError(null);

    try {
      const result = await startAssessment.mutateAsync({
        learningObjectiveId,
        numQuestions: 5,
      });

      setSessionId(result.session.id);
      setQuestions(result.questions);
      setCurrentQuestionIndex(0);
      setProgress({
        questions_answered: result.session.questions_answered,
        questions_correct: result.session.questions_correct,
        total_questions: result.questions.length,
        current_score: 0,
        is_complete: false,
      });
      setAnsweredQuestions(new Map());
      setCurrentFeedback(null);
      questionServedAt.current = new Date().toISOString();
      setSessionState('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assessment');
      setSessionState('error');
    }
  }, [learningObjectiveId, startAssessment]);

  const handleSubmitAnswer = useCallback(async (answer: string) => {
    if (!sessionId || !questions[currentQuestionIndex]) return;

    setSessionState('submitting');
    const currentQuestion = questions[currentQuestionIndex];

    try {
      const result = await submitAnswer.mutateAsync({
        sessionId,
        questionId: currentQuestion.id,
        userAnswer: answer,
        questionServedAt: questionServedAt.current,
      });

      // Update answered questions map
      setAnsweredQuestions((prev) => {
        const updated = new Map(prev);
        updated.set(currentQuestion.id, result.is_correct);
        return updated;
      });

      // Update progress
      setProgress(result.session_progress);

      // Show feedback
      setCurrentFeedback({
        isCorrect: result.is_correct,
        correctAnswer: result.correct_answer,
        timeTaken: result.time_taken_seconds,
      });

      setSessionState('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
      setSessionState('active'); // Allow retry
    }
  }, [sessionId, questions, currentQuestionIndex, submitAnswer]);

  const handleNextQuestion = useCallback(async () => {
    const isLastQuestion = currentQuestionIndex >= questions.length - 1;

    if (isLastQuestion && sessionId) {
      // Complete the assessment
      setSessionState('loading');
      try {
        const result = await completeAssessment.mutateAsync({ sessionId });
        setResults({
          performance: result.performance,
          incorrectAnswers: result.incorrect_answers,
        });
        setSessionState('completed');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete assessment');
        setSessionState('error');
      }
    } else {
      // Move to next question
      setCurrentQuestionIndex((prev) => prev + 1);
      setCurrentFeedback(null);
      questionServedAt.current = new Date().toISOString();
    }
  }, [currentQuestionIndex, questions.length, sessionId, completeAssessment]);

  const handleRetry = useCallback(() => {
    setSessionState('idle');
    setSessionId(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnsweredQuestions(new Map());
    setCurrentFeedback(null);
    setResults(null);
    setError(null);
  }, []);

  const currentQuestion = questions[currentQuestionIndex];

  // Idle state - show start button
  if (sessionState === 'idle') {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <h3 className="font-semibold text-lg">Ready to Verify Your Knowledge?</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {learningObjectiveText}
          </p>
          <p className="text-sm text-muted-foreground">
            You'll be asked 5 questions. Score 70% or higher to verify this objective.
          </p>
          <div className="flex gap-3 justify-center">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button onClick={handleStart}>
              Start Assessment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (sessionState === 'loading') {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-[200px]">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading assessment...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (sessionState === 'error') {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-destructive font-medium">Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-3 justify-center">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Go Back
              </Button>
            )}
            <Button onClick={handleStart}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed state
  if (sessionState === 'completed' && results) {
    return (
      <AssessmentResults
        performance={results.performance}
        questions={questions}
        incorrectAnswers={results.incorrectAnswers}
        onRetry={handleRetry}
        onBack={onClose}
      />
    );
  }

  // Active state
  if (sessionState === 'active' || sessionState === 'submitting') {
    return (
      <div className="space-y-6">
        {/* Header with quit button */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold truncate max-w-[70%]">
            {learningObjectiveText}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQuitConfirm(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress */}
        <AssessmentProgress
          progress={progress}
          answeredQuestions={answeredQuestions}
          currentQuestionId={currentQuestion?.id}
          questionIds={questions.map((q) => q.id)}
        />

        {/* Question */}
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            onSubmit={handleSubmitAnswer}
            isSubmitting={sessionState === 'submitting'}
            feedback={currentFeedback}
            onNext={currentFeedback ? handleNextQuestion : undefined}
          />
        )}

        {/* Quit confirmation */}
        <AlertDialog open={showQuitConfirm} onOpenChange={setShowQuitConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Quit Assessment?</AlertDialogTitle>
              <AlertDialogDescription>
                Your progress will be saved, but you'll need to restart to complete the assessment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continue</AlertDialogCancel>
              <AlertDialogAction onClick={onClose}>
                Quit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return null;
}
