import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { AssessmentQuestion } from '@/hooks/useAssessment';

interface QuestionCardProps {
  question: AssessmentQuestion;
  questionNumber: number;
  totalQuestions: number;
  onSubmit: (answer: string) => void;
  isSubmitting: boolean;
  feedback?: {
    isCorrect: boolean;
    correctAnswer: string | null;
    timeTaken: number;
  } | null;
  onNext?: () => void;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onSubmit,
  isSubmitting,
  feedback,
  onNext,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState('');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timeLimit = question.time_limit_seconds || 45;

  useEffect(() => {
    // Reset state when question changes
    setAnswer('');
    setTimeElapsed(0);
  }, [question.id]);

  useEffect(() => {
    if (feedback) return; // Stop timer after submission

    const timer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [feedback]);

  const timeProgress = Math.min((timeElapsed / timeLimit) * 100, 100);
  const isTimeWarning = timeElapsed > timeLimit * 0.75;
  const isTimeExceeded = timeElapsed > timeLimit;

  const handleSubmit = () => {
    if (!answer.trim()) return;
    onSubmit(answer);
  };

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-500/10 text-green-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'hard':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const options = (question.options as string[]) || [];

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              Question {questionNumber} of {totalQuestions}
            </Badge>
            {question.difficulty && (
              <Badge className={getDifficultyColor(question.difficulty)}>
                {question.difficulty}
              </Badge>
            )}
            {question.bloom_level && (
              <Badge variant="secondary">{question.bloom_level}</Badge>
            )}
          </div>
          <div className={`flex items-center gap-2 ${isTimeWarning ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="h-4 w-4" />
            <span className="font-mono text-sm">{formatTime(timeElapsed)}</span>
            {isTimeExceeded && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
          </div>
        </div>
        <Progress 
          value={timeProgress} 
          className={`h-1 mt-2 ${isTimeWarning ? '[&>div]:bg-destructive' : ''}`}
        />
      </CardHeader>

      <CardContent className="space-y-6">
        {question.scenario_context && (
          <div className="p-4 bg-muted/50 rounded-lg text-sm italic">
            {question.scenario_context}
          </div>
        )}

        <CardTitle className="text-lg font-medium leading-relaxed">
          {question.question_text}
        </CardTitle>

        {!feedback ? (
          <>
            {question.question_type === 'mcq' && options.length > 0 && (
              <RadioGroup value={answer} onValueChange={setAnswer} className="space-y-3">
                {options.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setAnswer(option)}
                  >
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question.question_type === 'true_false' && (
              <RadioGroup value={answer} onValueChange={setAnswer} className="space-y-3">
                {['True', 'False'].map((option) => (
                  <div
                    key={option}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setAnswer(option)}
                  >
                    <RadioGroupItem value={option} id={option} />
                    <Label htmlFor={option} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question.question_type === 'short_answer' && (
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="min-h-[120px]"
              />
            )}

            <Button
              onClick={handleSubmit}
              disabled={!answer.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg flex items-center gap-3 ${
                feedback.isCorrect
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {feedback.isCorrect ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <XCircle className="h-6 w-6" />
              )}
              <div>
                <p className="font-semibold">
                  {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
                </p>
                <p className="text-sm opacity-80">
                  Time taken: {feedback.timeTaken}s
                </p>
              </div>
            </div>

            {!feedback.isCorrect && feedback.correctAnswer && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Correct answer:</p>
                <p className="font-medium">{feedback.correctAnswer}</p>
              </div>
            )}

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Your answer:</p>
              <p>{answer}</p>
            </div>

            {onNext && (
              <Button onClick={onNext} className="w-full">
                Next Question
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
