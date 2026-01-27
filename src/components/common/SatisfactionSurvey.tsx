import { useState, useEffect } from 'react';
import { Star, X, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SatisfactionSurveyProps {
  surveyId: string;
  trigger: 'course_complete' | 'milestone' | 'time_based' | 'manual';
  context?: {
    courseId?: string;
    courseName?: string;
    milestone?: string;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete?: (rating: number, feedback?: string) => void;
}

const NPS_LABELS = [
  'Not at all likely',
  '', '', '', '',
  'Neutral',
  '', '', '', '',
  'Extremely likely',
];

const RATING_EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];

export function SatisfactionSurvey({
  surveyId,
  trigger,
  context,
  open,
  onOpenChange,
  onComplete,
}: SatisfactionSurveyProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [step, setStep] = useState<'rating' | 'feedback' | 'thanks'>('rating');
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setTimeout(() => {
        setStep('rating');
        setRating(null);
        setFeedback('');
      }, 300);
    }
  };

  const handleRating = (value: number) => {
    setRating(value);
    // For low ratings, ask for feedback
    if (value <= 6) {
      setStep('feedback');
    } else {
      // For high ratings, offer optional feedback
      setStep('feedback');
    }
  };

  const handleSubmit = async () => {
    if (rating === null) return;

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Store survey response (use type bypass for tables not in generated types)
      const { error } = await (supabase as any).from('satisfaction_surveys').insert({
        user_id: user?.id || null,
        survey_id: surveyId,
        trigger,
        rating,
        feedback: feedback.trim() || null,
        context: context || null,
      });

      if (error && error.code !== '42P01') {
        throw error;
      }

      setStep('thanks');
      onComplete?.(rating, feedback || undefined);

      // Auto-close after showing thanks
      setTimeout(() => {
        handleOpenChange(false);
      }, 2000);

    } catch (error) {
      toast({
        title: 'Failed to submit',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const skipFeedback = () => {
    handleSubmit();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'rating' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {trigger === 'course_complete'
                  ? `How was ${context?.courseName || 'the course'}?`
                  : 'How likely are you to recommend SyllabusStack?'}
              </DialogTitle>
              <DialogDescription>
                {trigger === 'course_complete'
                  ? 'Rate your learning experience'
                  : 'On a scale of 0-10, with 10 being extremely likely'}
              </DialogDescription>
            </DialogHeader>

            {trigger === 'course_complete' ? (
              // Star rating for course completion
              <div className="py-6">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleRating(value * 2)}
                      className="group p-2 transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "h-10 w-10 transition-colors",
                          rating !== null && value <= rating / 2
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground group-hover:text-yellow-400"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  {RATING_EMOJIS.map((emoji, i) => (
                    <span
                      key={i}
                      className={cn(
                        "text-2xl transition-opacity",
                        rating !== null && Math.ceil(rating / 2) === i + 1
                          ? "opacity-100"
                          : "opacity-30"
                      )}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              // NPS scale for general satisfaction
              <div className="py-6">
                <div className="flex justify-between mb-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleRating(value)}
                      className={cn(
                        "w-8 h-8 rounded-md text-sm font-medium transition-all",
                        rating === value
                          ? "bg-primary text-primary-foreground scale-110"
                          : "bg-muted hover:bg-muted-foreground/20"
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{NPS_LABELS[0]}</span>
                  <span>{NPS_LABELS[5]}</span>
                  <span>{NPS_LABELS[10]}</span>
                </div>
              </div>
            )}
          </>
        )}

        {step === 'feedback' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {rating !== null && rating <= 6
                  ? 'What could we improve?'
                  : 'What did you like?'}
              </DialogTitle>
              <DialogDescription>
                Your feedback helps us make SyllabusStack better
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <Textarea
                placeholder={
                  rating !== null && rating <= 6
                    ? "Tell us what we could do better..."
                    : "Share what you enjoyed (optional)..."
                }
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="resize-none"
              />

              <div className="flex gap-2 justify-end">
                {rating !== null && rating > 6 && (
                  <Button variant="ghost" onClick={skipFeedback}>
                    Skip
                  </Button>
                )}
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'thanks' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="mb-2">Thank you!</DialogTitle>
            <DialogDescription>
              Your feedback means a lot to us.
            </DialogDescription>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Hook to trigger satisfaction survey based on conditions
interface UseSatisfactionSurveyOptions {
  surveyId: string;
  trigger: SatisfactionSurveyProps['trigger'];
  context?: SatisfactionSurveyProps['context'];
  showAfterDays?: number; // Don't show if user saw survey in last N days
  minCompletions?: number; // Minimum course completions before showing
}

export function useSatisfactionSurvey(options: UseSatisfactionSurveyOptions) {
  const [showSurvey, setShowSurvey] = useState(false);
  const STORAGE_KEY = `survey_${options.surveyId}_last_shown`;

  const checkAndShow = () => {
    // Check if we've shown this survey recently
    const lastShown = localStorage.getItem(STORAGE_KEY);
    if (lastShown) {
      const daysSince = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
      if (daysSince < (options.showAfterDays || 30)) {
        return;
      }
    }

    // Show the survey
    setShowSurvey(true);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  const handleComplete = (rating: number, feedback?: string) => {
    console.log('Survey completed:', { surveyId: options.surveyId, rating, feedback });
  };

  return {
    showSurvey,
    setShowSurvey,
    checkAndShow,
    SurveyComponent: () => (
      <SatisfactionSurvey
        surveyId={options.surveyId}
        trigger={options.trigger}
        context={options.context}
        open={showSurvey}
        onOpenChange={setShowSurvey}
        onComplete={handleComplete}
      />
    ),
  };
}
