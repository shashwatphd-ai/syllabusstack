import { useState } from 'react';
import { Star, User } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubmitStudentRating } from '@/hooks/useStudentRatings';

const SKILL_SUGGESTIONS = ['Communication', 'Technical Skills', 'Teamwork', 'Problem Solving', 'Leadership', 'Time Management'];

interface StudentRatingDialogProps {
  studentId: string;
  studentName?: string;
  employerAccountId: string;
  projectId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentRatingDialog({ studentId, studentName, employerAccountId, projectId, open, onOpenChange }: StudentRatingDialogProps) {
  const submit = useSubmitStudentRating();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const toggleSkill = (s: string) =>
    setSkills(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const handleSubmit = () => {
    submit.mutate({
      student_id: studentId,
      employer_account_id: employerAccountId,
      capstone_project_id: projectId,
      rating,
      feedback: feedback || undefined,
      skills_demonstrated: skills.length > 0 ? skills : undefined,
    }, { onSuccess: () => { onOpenChange(false); setRating(0); setFeedback(''); setSkills([]); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Rate Student
          </DialogTitle>
        </DialogHeader>
        {studentName && <p className="text-sm text-muted-foreground">{studentName}</p>}

        <div className="space-y-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRating(n)} className="p-0.5">
                <Star className={`h-6 w-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
              </button>
            ))}
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Skills Demonstrated</Label>
            <div className="flex flex-wrap gap-1.5">
              {SKILL_SUGGESTIONS.map(s => (
                <Badge key={s} variant={skills.includes(s) ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => toggleSkill(s)}>
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          <Textarea placeholder="Feedback..." value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || submit.isPending}>
            {submit.isPending ? 'Saving...' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
