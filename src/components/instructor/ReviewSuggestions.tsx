import { useState } from 'react';
import { Check, X, ExternalLink, Loader2, Video, BookOpen, FileText, Link as LinkIcon, Filter, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { usePendingSuggestions, useReviewSuggestion, ContentSuggestion } from '@/hooks/useContentSuggestions';
import { formatDistanceToNow } from 'date-fns';

interface ReviewSuggestionsProps {
  courseId?: string;
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

export function ReviewSuggestions({ courseId }: ReviewSuggestionsProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const { data: suggestions, isLoading } = usePendingSuggestions(courseId);

  const filteredSuggestions = suggestions?.filter(s =>
    filterType === 'all' || s.source_type === filterType
  ) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Suggestions</CardTitle>
          <CardDescription>Approve or reject community-submitted resources</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Review Suggestions
              {(suggestions?.length || 0) > 0 && (
                <Badge variant="secondary">{suggestions?.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>Approve or reject community-submitted resources</CardDescription>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="khan_academy">Khan Academy</SelectItem>
              <SelectItem value="article">Article</SelectItem>
              <SelectItem value="course">Course</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredSuggestions.length === 0 ? (
          <div className="text-center py-12">
            <Check className="h-12 w-12 mx-auto mb-4 text-success/50" />
            <p className="text-lg font-medium text-muted-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground">No pending suggestions to review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSuggestions.map((suggestion: any) => (
              <ReviewCard key={suggestion.id} suggestion={suggestion} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ReviewCardProps {
  suggestion: any;
}

function ReviewCard({ suggestion }: ReviewCardProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const reviewMutation = useReviewSuggestion();

  const Icon = sourceTypeIcons[suggestion.source_type || 'other'] || LinkIcon;

  const handleApprove = async () => {
    await reviewMutation.mutateAsync({
      suggestionId: suggestion.id,
      status: 'approved',
    });
  };

  const handleReject = async () => {
    await reviewMutation.mutateAsync({
      suggestionId: suggestion.id,
      status: 'rejected',
    });
    setShowRejectDialog(false);
  };

  const displayTitle = suggestion.title || suggestion.url.replace(/^https?:\/\//, '').slice(0, 60);

  return (
    <>
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Source Type Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={suggestion.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    {displayTitle}
                    <ExternalLink className="h-4 w-4 flex-shrink-0" />
                  </a>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {sourceTypeLabels[suggestion.source_type || 'other']}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
                    </span>
                    {suggestion.votes !== 0 && (
                      <span className={cn(
                        "text-xs font-medium",
                        suggestion.votes > 0 && "text-success",
                        suggestion.votes < 0 && "text-destructive"
                      )}>
                        {suggestion.votes > 0 ? '+' : ''}{suggestion.votes} votes
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={reviewMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleApprove}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Approve
                  </Button>
                </div>
              </div>

              {/* Description */}
              {suggestion.description && (
                <p className="text-sm text-muted-foreground">
                  {suggestion.description}
                </p>
              )}

              {/* Learning Objective Context */}
              {suggestion.learning_objective?.text && (
                <div className="bg-muted/50 rounded-md p-2 text-xs">
                  <span className="font-medium">Learning Objective:</span>{' '}
                  <span className="text-muted-foreground">
                    {suggestion.learning_objective.text}
                  </span>
                </div>
              )}

              {/* URL Preview */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LinkIcon className="h-3 w-3" />
                <span className="truncate">{suggestion.url}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rejection Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the suggestion as rejected. The contributor will not be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Summary stats component for dashboard
export function SuggestionStats({ courseId }: { courseId?: string }) {
  const { data: suggestions, isLoading } = usePendingSuggestions(courseId);

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  const pending = suggestions?.length || 0;

  if (pending === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
      <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
        <Clock className="h-5 w-5 text-warning" />
      </div>
      <div>
        <p className="text-sm font-medium">
          {pending} suggestion{pending !== 1 ? 's' : ''} awaiting review
        </p>
        <p className="text-xs text-muted-foreground">
          Community members have submitted resources for approval
        </p>
      </div>
    </div>
  );
}
