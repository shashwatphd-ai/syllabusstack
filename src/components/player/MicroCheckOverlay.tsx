import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MicroCheck {
  id: string;
  trigger_time_seconds: number;
  question_text: string;
  question_type: 'recall' | 'mcq';
  options?: { text: string; is_correct?: boolean }[];
  correct_answer: string;
  rewind_target_seconds?: number;
  time_limit_seconds?: number;
}

interface MicroCheckOverlayProps {
  microCheck: MicroCheck;
  onAnswer: (isCorrect: boolean) => void;
  isFailed: boolean;
}

export function MicroCheckOverlay({ microCheck, onAnswer, isFailed }: MicroCheckOverlayProps) {
  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  // Use time_limit_seconds from database, default to 30 seconds
  const timeLimit = microCheck.time_limit_seconds || 30;
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (isFailed || hasSubmitted) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFailed, hasSubmitted]);

  const handleSubmit = (timedOut = false) => {
    if (hasSubmitted) return;
    setHasSubmitted(true);

    if (timedOut) {
      onAnswer(false);
      return;
    }

    if (microCheck.question_type === 'mcq') {
      const correctIndex = microCheck.options?.findIndex(o => o.is_correct);
      onAnswer(selectedOption === correctIndex);
    } else {
      const isCorrect = answer.toLowerCase().trim() === microCheck.correct_answer.toLowerCase().trim();
      onAnswer(isCorrect);
    }
  };

  if (isFailed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
        <Card className="max-w-md mx-4 border-destructive">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive">Incorrect Answer</h3>
            <p className="text-muted-foreground mt-2">
              Rewinding to review the relevant section...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
      <Card className="max-w-lg mx-4 w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Quick Check
            </CardTitle>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${
              timeLeft <= 3 ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              <Clock className="h-4 w-4" />
              {timeLeft}s
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-foreground font-medium">{microCheck.question_text}</p>

          {microCheck.question_type === 'mcq' && microCheck.options ? (
            <div className="space-y-2">
              {microCheck.options.map((option, index) => (
                <button
                  key={index}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedOption === index 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedOption(index)}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                  {option.text}
                </button>
              ))}
            </div>
          ) : (
            <Input
              placeholder="Type your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          )}

          <Button 
            className="w-full"
            onClick={() => handleSubmit()}
            disabled={
              (microCheck.question_type === 'mcq' && selectedOption === null) ||
              (microCheck.question_type === 'recall' && !answer.trim())
            }
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Submit Answer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
