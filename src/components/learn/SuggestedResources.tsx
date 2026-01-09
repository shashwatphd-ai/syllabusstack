import { useState } from 'react';
import { ExternalLink, ThumbsUp, ThumbsDown, Loader2, Video, BookOpen, FileText, Link as LinkIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useLOSuggestions, useVoteSuggestion, ContentSuggestion } from '@/hooks/useContentSuggestions';
import { SuggestResource } from './SuggestResource';
import { formatDistanceToNow } from 'date-fns';

interface SuggestedResourcesProps {
  learningObjectiveId: string;
  learningObjectiveText?: string;
  showHeader?: boolean;
}

const sourceTypeIcons: Record<string, typeof Video> = {
  youtube: Video,
  khan_academy: BookOpen,
  article: FileText,
  course: BookOpen,
  other: LinkIcon,
};

const sourceTypeLabels: Record<string, string> = {
  youtube: 'YouTube',
  khan_academy: 'Khan Academy',
  article: 'Article',
  course: 'Course',
  other: 'Resource',
};

export function SuggestedResources({
  learningObjectiveId,
  learningObjectiveText,
  showHeader = true,
}: SuggestedResourcesProps) {
  const { data: suggestions, isLoading } = useLOSuggestions(learningObjectiveId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {showHeader && <Skeleton className="h-6 w-48" />}
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const approvedSuggestions = suggestions?.filter(s => s.status === 'approved') || [];
  const pendingSuggestions = suggestions?.filter(s => s.status === 'pending') || [];

  if (approvedSuggestions.length === 0 && pendingSuggestions.length === 0) {
    return (
      <div className="text-center py-6 border border-dashed rounded-lg">
        <LinkIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground mb-3">No community resources yet</p>
        <SuggestResource
          learningObjectiveId={learningObjectiveId}
          learningObjectiveText={learningObjectiveText}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Community Resources</h4>
          <SuggestResource
            learningObjectiveId={learningObjectiveId}
            learningObjectiveText={learningObjectiveText}
          />
        </div>
      )}

      {approvedSuggestions.length > 0 && (
        <div className="space-y-2">
          {approvedSuggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </div>
      )}

      {pendingSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending review ({pendingSuggestions.length})
          </p>
          {pendingSuggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} isPending />
          ))}
        </div>
      )}
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: ContentSuggestion;
  isPending?: boolean;
}

function SuggestionCard({ suggestion, isPending }: SuggestionCardProps) {
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const voteMutation = useVoteSuggestion();

  const Icon = sourceTypeIcons[suggestion.source_type || 'other'] || LinkIcon;

  const handleVote = async (vote: 'up' | 'down') => {
    if (voteMutation.isPending) return;

    // Toggle vote if clicking same button
    const newVote = userVote === vote ? null : vote;

    await voteMutation.mutateAsync({
      suggestionId: suggestion.id,
      vote: newVote === 'up' ? 1 : newVote === 'down' ? -1 : 0,
    });

    setUserVote(newVote);
  };

  const displayTitle = suggestion.title || suggestion.url.replace(/^https?:\/\//, '').slice(0, 50);

  return (
    <Card className={cn(
      "transition-colors",
      isPending && "opacity-70 border-dashed"
    )}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Source Type Icon */}
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
            isPending ? "bg-muted" : "bg-primary/10"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              isPending ? "text-muted-foreground" : "text-primary"
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <a
                  href={suggestion.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1 truncate"
                >
                  {displayTitle}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">
                    {sourceTypeLabels[suggestion.source_type || 'other']}
                  </Badge>
                  {isPending && (
                    <Badge variant="outline" className="text-xs text-warning border-warning/30">
                      Pending
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Voting */}
              {!isPending && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 w-7 p-0",
                      userVote === 'up' && "text-success bg-success/10"
                    )}
                    onClick={() => handleVote('up')}
                    disabled={voteMutation.isPending}
                  >
                    {voteMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <span className={cn(
                    "text-xs font-medium min-w-[1.5rem] text-center",
                    suggestion.votes > 0 && "text-success",
                    suggestion.votes < 0 && "text-destructive"
                  )}>
                    {suggestion.votes}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 w-7 p-0",
                      userVote === 'down' && "text-destructive bg-destructive/10"
                    )}
                    onClick={() => handleVote('down')}
                    disabled={voteMutation.isPending}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {suggestion.description && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {suggestion.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact list view for sidebars
interface CompactSuggestionsProps {
  learningObjectiveId: string;
  limit?: number;
}

export function CompactSuggestions({ learningObjectiveId, limit = 3 }: CompactSuggestionsProps) {
  const { data: suggestions, isLoading } = useLOSuggestions(learningObjectiveId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const approvedSuggestions = suggestions
    ?.filter(s => s.status === 'approved')
    .slice(0, limit) || [];

  if (approvedSuggestions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Community Resources</p>
      {approvedSuggestions.map((suggestion) => {
        const Icon = sourceTypeIcons[suggestion.source_type || 'other'] || LinkIcon;
        return (
          <a
            key={suggestion.id}
            href={suggestion.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs hover:text-primary transition-colors py-1"
          >
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{suggestion.title || 'Resource'}</span>
            <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0" />
          </a>
        );
      })}
    </div>
  );
}
