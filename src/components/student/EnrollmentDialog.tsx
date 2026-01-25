import { useState } from 'react';
import { BookOpen, Loader2, CreditCard, Check, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoLinkCourses } from '@/hooks/useAutoLinkCourses';
import { useQueryClient } from '@tanstack/react-query';

interface EnrollmentDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function EnrollmentDialog({ trigger, onSuccess }: EnrollmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [coursePreview, setCoursePreview] = useState<{
    id: string;
    title: string;
    requires_payment: boolean;
  } | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();
  const autoLinkMutation = useAutoLinkCourses();
  const queryClient = useQueryClient();

  const isPro = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'university';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enroll-in-course', {
        body: { access_code: accessCode.trim() },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Already enrolled
      if (data.already_enrolled) {
        toast({
          title: 'Already Enrolled',
          description: `You are already enrolled in "${data.course.title}"`,
        });
        setOpen(false);
        setAccessCode('');
        return;
      }

      // Pro user - enrolled immediately
      if (data.enrolled && !data.requires_payment) {
        toast({
          title: 'Enrolled Successfully!',
          description: `You are now enrolled in "${data.course.title}"`,
        });
        queryClient.invalidateQueries({ queryKey: ['student-enrollments'] });
        autoLinkMutation.mutate({ instructorCourseId: data.course.id });
        setOpen(false);
        setAccessCode('');
        onSuccess?.();
        return;
      }

      // Non-Pro - needs payment
      if (data.requires_payment && data.checkout_url) {
        setCoursePreview({
          id: data.course.id,
          title: data.course.title,
          requires_payment: true,
        });
        // Redirect to Stripe checkout
        window.open(data.checkout_url, '_blank');
        toast({
          title: 'Payment Required',
          description: 'Complete the $1 payment to enroll in this course.',
        });
      }
    } catch (error) {
      toast({
        title: 'Enrollment Failed',
        description: error instanceof Error ? error.message : 'Failed to enroll',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAccessCode('');
    setCoursePreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) handleReset(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <BookOpen className="mr-2 h-4 w-4" />
            Join Course
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a Course</DialogTitle>
          <DialogDescription>
            Enter the access code provided by your instructor to enroll in their course.
          </DialogDescription>
        </DialogHeader>
        
        {!coursePreview ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="accessCode">Access Code</Label>
                <Input
                  id="accessCode"
                  placeholder="e.g., ABC123"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="font-mono text-lg tracking-widest text-center"
                  maxLength={10}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  The access code is case-insensitive
                </p>
              </div>

              {/* Pricing info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Enrollment Fee</span>
                  {isPro ? (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      Free with Pro
                    </Badge>
                  ) : (
                    <span className="text-lg font-bold">$1.00</span>
                  )}
                </div>
                {isPro && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Unlimited enrollments included in your Pro subscription
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!accessCode.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : isPro ? (
                  'Enroll Now'
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay $1 & Enroll
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center space-y-2">
              <BookOpen className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">{coursePreview.title}</p>
              <p className="text-sm text-muted-foreground">
                Complete the payment in the new tab to finish enrollment
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleReset}>
                Try Different Code
              </Button>
              <Button onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
