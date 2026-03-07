import { useClassmates, type Classmate } from '@/hooks/useCommunity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User } from 'lucide-react';

interface ClassmateSelectorProps {
  courseId: string;
  selectedId: string | null;
  onSelect: (classmate: Classmate) => void;
}

export function ClassmateSelector({ courseId, selectedId, onSelect }: ClassmateSelectorProps) {
  const { data: classmates = [], isLoading } = useClassmates(courseId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Loading classmates...</div>;
  }

  if (classmates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No other students enrolled yet
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-48">
      <div className="space-y-1">
        {classmates.map((c) => (
          <button
            key={c.student_id}
            onClick={() => onSelect(c)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
              selectedId === c.student_id
                ? 'bg-primary/15 border border-primary/30'
                : 'hover:bg-accent/10 border border-transparent'
            }`}
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={c.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {c.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate">{c.full_name ?? 'Student'}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
