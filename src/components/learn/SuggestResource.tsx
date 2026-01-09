import { useState } from 'react';
import { Plus, Link, Loader2, Video, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSubmitSuggestion } from '@/hooks/useContentSuggestions';

interface SuggestResourceProps {
  learningObjectiveId: string;
  learningObjectiveText?: string;
  onSuccess?: () => void;
}

const sourceTypes = [
  { value: 'youtube', label: 'YouTube Video', icon: Video },
  { value: 'khan_academy', label: 'Khan Academy', icon: BookOpen },
  { value: 'article', label: 'Article', icon: FileText },
  { value: 'course', label: 'Online Course', icon: BookOpen },
  { value: 'other', label: 'Other', icon: Link },
];

export function SuggestResource({
  learningObjectiveId,
  learningObjectiveText,
  onSuccess,
}: SuggestResourceProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState<string>('');

  const submitSuggestion = useSubmitSuggestion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) return;

    await submitSuggestion.mutateAsync({
      learning_objective_id: learningObjectiveId,
      url: url.trim(),
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      source_type: sourceType as any || undefined,
    });

    // Reset form
    setUrl('');
    setTitle('');
    setDescription('');
    setSourceType('');
    setOpen(false);
    onSuccess?.();
  };

  // Auto-detect source type from URL
  const detectSourceType = (inputUrl: string) => {
    if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) {
      setSourceType('youtube');
    } else if (inputUrl.includes('khanacademy.org')) {
      setSourceType('khan_academy');
    } else if (inputUrl.includes('coursera.org') || inputUrl.includes('udemy.com') || inputUrl.includes('edx.org')) {
      setSourceType('course');
    } else if (inputUrl.includes('medium.com') || inputUrl.includes('dev.to') || inputUrl.includes('blog')) {
      setSourceType('article');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Suggest Resource
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Suggest a Resource</DialogTitle>
            <DialogDescription>
              Found a helpful resource for this learning objective? Share it with the community!
              {learningObjectiveText && (
                <span className="block mt-2 text-sm font-medium text-foreground">
                  "{learningObjectiveText}"
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">Resource URL *</Label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    detectSourceType(e.target.value);
                  }}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-type">Resource Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect or select..." />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="Resource title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Why is this helpful? (optional)</Label>
              <Textarea
                id="description"
                placeholder="Explain why this resource is useful for learning this objective..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
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
              disabled={!url.trim() || submitSuggestion.isPending}
            >
              {submitSuggestion.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Suggestion'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
