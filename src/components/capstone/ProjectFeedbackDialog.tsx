import { useState, useEffect } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useProjectFeedback, useSubmitProjectFeedback } from '@/hooks/useProjectFeedback';

const TAG_OPTIONS = ['Industry-Ready', 'Well-Scoped', 'Too Complex', 'Great LO Alignment', 'Needs Revision', 'Student Favorite'];

interface ProjectFeedbackDialogProps {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectFeedbackDialog({ projectId, projectTitle, open, onOpenChange }: ProjectFeedbackDialogProps) {
  const { data: existing } = useProjectFeedback(projectId);
  const submit = useSubmitProjectFeedback();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (existing) {
      setRating(existing.rating || 0);
      setText(existing.feedback_text || '');
      setTags(existing.tags || []);
    }
  }, [existing]);

  const toggleTag = (tag: string) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const handleSubmit = () => {
    submit.mutate({
      capstone_project_id: projectId,
      rating,
      feedback_text: text || undefined,
      tags: tags.length > 0 ? tags : undefined,
    }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Rate Project
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground line-clamp-1">{projectTitle}</p>

        <div className="space-y-4">
          {/* Star Rating */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRating(n)} className="p-0.5">
                <Star className={`h-6 w-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
              </button>
            ))}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map(tag => (
              <Badge
                key={tag}
                variant={tags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>

          <Textarea
            placeholder="Additional feedback..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || submit.isPending}>
            {submit.isPending ? 'Saving...' : existing ? 'Update' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
