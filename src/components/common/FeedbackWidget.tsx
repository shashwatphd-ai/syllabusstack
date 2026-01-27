import { useState } from 'react';
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Bug, Lightbulb, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type FeedbackType = 'bug' | 'feature' | 'question' | 'praise' | 'other';

interface FeedbackWidgetProps {
  variant?: 'floating' | 'inline' | 'button';
  position?: 'bottom-right' | 'bottom-left';
  contextPage?: string;
  className?: string;
}

const feedbackTypes: { value: FeedbackType; label: string; icon: typeof Bug }[] = [
  { value: 'bug', label: 'Report a bug', icon: Bug },
  { value: 'feature', label: 'Suggest a feature', icon: Lightbulb },
  { value: 'question', label: 'Ask a question', icon: HelpCircle },
  { value: 'praise', label: 'Share praise', icon: ThumbsUp },
];

export function FeedbackWidget({
  variant = 'floating',
  position = 'bottom-right',
  contextPage,
  className,
}: FeedbackWidgetProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter your feedback.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Store feedback in database
      const { error } = await supabase.from('user_feedback').insert({
        user_id: user?.id || null,
        type: feedbackType,
        message: message.trim(),
        page_url: window.location.href,
        page_context: contextPage,
        user_agent: navigator.userAgent,
      });

      if (error) {
        // If table doesn't exist, just show success (for demo purposes)
        if (error.code === '42P01') {
          console.log('Feedback (table not created):', { feedbackType, message });
        } else {
          throw error;
        }
      }

      setSubmitted(true);
      setMessage('');

      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
      }, 2000);

    } catch (error) {
      toast({
        title: 'Failed to send feedback',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const FeedbackForm = () => (
    <div className="space-y-4">
      {submitted ? (
        <div className="py-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ThumbsUp className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium mb-2">Thank you!</h3>
          <p className="text-muted-foreground">
            Your feedback helps us improve SyllabusStack.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>What type of feedback?</Label>
            <RadioGroup
              value={feedbackType}
              onValueChange={(v) => setFeedbackType(v as FeedbackType)}
              className="grid grid-cols-2 gap-2"
            >
              {feedbackTypes.map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                    feedbackType === value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value={value} className="sr-only" />
                  <Icon className={cn(
                    "h-4 w-4",
                    feedbackType === value ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message">Your feedback</Label>
            <Textarea
              id="feedback-message"
              placeholder={
                feedbackType === 'bug'
                  ? "What happened? What did you expect to happen?"
                  : feedbackType === 'feature'
                  ? "Describe the feature you'd like to see..."
                  : feedbackType === 'question'
                  ? "What would you like to know?"
                  : "Tell us what you think..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim()}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Feedback
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );

  // Floating button variant
  if (variant === 'floating') {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "fixed z-50 rounded-full shadow-lg",
              position === 'bottom-right' ? 'bottom-6 right-6' : 'bottom-6 left-6',
              className
            )}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Feedback
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Send Feedback</SheetTitle>
            <SheetDescription>
              Help us improve by sharing your thoughts, reporting issues, or suggesting features.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <FeedbackForm />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Inline popover variant
  if (variant === 'inline') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={className}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <FeedbackForm />
        </PopoverContent>
      </Popover>
    );
  }

  // Button that opens sheet
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={className}>
          <MessageCircle className="h-4 w-4 mr-2" />
          Send Feedback
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Send Feedback</SheetTitle>
          <SheetDescription>
            Help us improve by sharing your thoughts, reporting issues, or suggesting features.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <FeedbackForm />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Quick rating component for specific features
interface QuickRatingProps {
  feature: string;
  question?: string;
  onRate?: (rating: 'positive' | 'negative') => void;
  className?: string;
}

export function QuickRating({
  feature,
  question = 'Was this helpful?',
  onRate,
  className,
}: QuickRatingProps) {
  const [rated, setRated] = useState<'positive' | 'negative' | null>(null);
  const { toast } = useToast();

  const handleRate = async (rating: 'positive' | 'negative') => {
    setRated(rating);
    onRate?.(rating);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('feature_ratings').insert({
        user_id: user?.id || null,
        feature,
        rating,
        page_url: window.location.href,
      }).maybeSingle();
    } catch {
      // Silent fail for ratings
    }

    toast({
      title: 'Thanks for your feedback!',
      description: rating === 'positive'
        ? 'Glad this was helpful!'
        : 'We\'ll work on improving this.',
    });
  };

  if (rated) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <ThumbsUp className="h-4 w-4 text-green-500" />
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-sm text-muted-foreground">{question}</span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => handleRate('positive')}
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => handleRate('negative')}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
