import { useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
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
import { useEnrollWithAccessCode } from '@/hooks/useStudentCourses';
import { useAutoLinkCourses } from '@/hooks/useAutoLinkCourses';

interface EnrollmentDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function EnrollmentDialog({ trigger, onSuccess }: EnrollmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const enrollMutation = useEnrollWithAccessCode();
  const autoLinkMutation = useAutoLinkCourses();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    enrollMutation.mutate(accessCode, {
      onSuccess: (data) => {
        setOpen(false);
        setAccessCode('');
        onSuccess?.();
        
        // Trigger auto-linking for the newly enrolled course
        autoLinkMutation.mutate({
          instructorCourseId: data.course.id,
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              disabled={!accessCode.trim() || enrollMutation.isPending}
            >
              {enrollMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enrolling...
                </>
              ) : (
                'Enroll'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
