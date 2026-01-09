import { useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  useUserContentRating,
  useContentRatingStats,
  useSubmitRating,
  formatRating,
} from '@/hooks/useContentRating';

interface ContentRatingProps {
  contentId: string;
  onRatingComplete?: () => void;
  showPrompt?: boolean;
  compact?: boolean;
}

type Difficulty = 'too_easy' | 'just_right' | 'too_hard';

export function ContentRating({
  contentId,
  onRatingComplete,
  showPrompt = false,
  compact = false,
}: ContentRatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [showCommentField, setShowCommentField] = useState(false);

  const { data: existingRating, isLoading: loadingExisting } = useUserContentRating(contentId);
  const { data: stats } = useContentRatingStats(contentId);
  const submitRating = useSubmitRating();

  // Initialize from existing rating
  useState(() => {
    if (existingRating) {
      setRating(existingRating.rating);
      setDifficulty(existingRating.difficulty);
      setHelpful(existingRating.helpful);
      setComment(existingRating.comment || '');
    }
  });

  const handleSubmit = async () => {
    if (rating === 0) return;

    await submitRating.mutateAsync({
      content_id: contentId,
      rating,
      difficulty: difficulty || undefined,
      helpful: helpful ?? undefined,
      comment: comment.trim() || undefined,
    });

    onRatingComplete?.();
  };

  const displayRating = hoverRating || rating;

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Compact view for content cards
  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2">
            <Star className={cn(
              "h-3.5 w-3.5",
              stats?.average_rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            )} />
            <span className="text-xs">
              {stats?.average_rating ? formatRating(stats.average_rating) : 'Rate'}
            </span>
            {stats?.rating_count ? (
              <span className="text-xs text-muted-foreground">
                ({stats.rating_count})
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <ContentRatingForm
            rating={rating}
            hoverRating={hoverRating}
            difficulty={difficulty}
            helpful={helpful}
            comment={comment}
            showCommentField={showCommentField}
            isSubmitting={submitRating.isPending}
            existingRating={existingRating}
            onRatingChange={setRating}
            onHoverChange={setHoverRating}
            onDifficultyChange={setDifficulty}
            onHelpfulChange={setHelpful}
            onCommentChange={setComment}
            onToggleComment={() => setShowCommentField(!showCommentField)}
            onSubmit={handleSubmit}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Full rating prompt (shown after video completion)
  if (showPrompt) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">How was this content?</CardTitle>
          <CardDescription>
            Your feedback helps improve recommendations for everyone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContentRatingForm
            rating={rating}
            hoverRating={hoverRating}
            difficulty={difficulty}
            helpful={helpful}
            comment={comment}
            showCommentField={showCommentField}
            isSubmitting={submitRating.isPending}
            existingRating={existingRating}
            onRatingChange={setRating}
            onHoverChange={setHoverRating}
            onDifficultyChange={setDifficulty}
            onHelpfulChange={setHelpful}
            onCommentChange={setComment}
            onToggleComment={() => setShowCommentField(!showCommentField)}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    );
  }

  // Default inline view
  return (
    <div className="space-y-3">
      <ContentRatingForm
        rating={rating}
        hoverRating={hoverRating}
        difficulty={difficulty}
        helpful={helpful}
        comment={comment}
        showCommentField={showCommentField}
        isSubmitting={submitRating.isPending}
        existingRating={existingRating}
        onRatingChange={setRating}
        onHoverChange={setHoverRating}
        onDifficultyChange={setDifficulty}
        onHelpfulChange={setHelpful}
        onCommentChange={setComment}
        onToggleComment={() => setShowCommentField(!showCommentField)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

// Internal form component
interface ContentRatingFormProps {
  rating: number;
  hoverRating: number;
  difficulty: Difficulty | null;
  helpful: boolean | null;
  comment: string;
  showCommentField: boolean;
  isSubmitting: boolean;
  existingRating: any;
  onRatingChange: (r: number) => void;
  onHoverChange: (r: number) => void;
  onDifficultyChange: (d: Difficulty | null) => void;
  onHelpfulChange: (h: boolean | null) => void;
  onCommentChange: (c: string) => void;
  onToggleComment: () => void;
  onSubmit: () => void;
}

function ContentRatingForm({
  rating,
  hoverRating,
  difficulty,
  helpful,
  comment,
  showCommentField,
  isSubmitting,
  existingRating,
  onRatingChange,
  onHoverChange,
  onDifficultyChange,
  onHelpfulChange,
  onCommentChange,
  onToggleComment,
  onSubmit,
}: ContentRatingFormProps) {
  const displayRating = hoverRating || rating;

  return (
    <div className="space-y-4">
      {/* Star Rating */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Overall Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onRatingChange(star)}
              onMouseEnter={() => onHoverChange(star)}
              onMouseLeave={() => onHoverChange(0)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  star <= displayRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                )}
              />
            </button>
          ))}
          {displayRating > 0 && (
            <span className="ml-2 text-sm text-muted-foreground">
              {displayRating === 1 && "Poor"}
              {displayRating === 2 && "Fair"}
              {displayRating === 3 && "Good"}
              {displayRating === 4 && "Very Good"}
              {displayRating === 5 && "Excellent"}
            </span>
          )}
        </div>
      </div>

      {/* Difficulty */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Difficulty Level</label>
        <div className="flex gap-2">
          {[
            { value: 'too_easy', label: 'Too Easy' },
            { value: 'just_right', label: 'Just Right' },
            { value: 'too_hard', label: 'Too Hard' },
          ].map((opt) => (
            <Badge
              key={opt.value}
              variant={difficulty === opt.value ? 'default' : 'outline'}
              className={cn(
                "cursor-pointer transition-colors",
                difficulty === opt.value && "bg-primary"
              )}
              onClick={() => onDifficultyChange(
                difficulty === opt.value ? null : opt.value as Difficulty
              )}
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Helpful */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Was this helpful?</label>
        <div className="flex gap-2">
          <Button
            variant={helpful === true ? 'default' : 'outline'}
            size="sm"
            onClick={() => onHelpfulChange(helpful === true ? null : true)}
            className="gap-1.5"
          >
            <ThumbsUp className="h-4 w-4" />
            Yes
          </Button>
          <Button
            variant={helpful === false ? 'default' : 'outline'}
            size="sm"
            onClick={() => onHelpfulChange(helpful === false ? null : false)}
            className="gap-1.5"
          >
            <ThumbsDown className="h-4 w-4" />
            No
          </Button>
        </div>
      </div>

      {/* Comment Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleComment}
        className="gap-1.5 text-muted-foreground"
      >
        <MessageSquare className="h-4 w-4" />
        {showCommentField ? 'Hide Comment' : 'Add Comment'}
      </Button>

      {/* Comment Field */}
      {showCommentField && (
        <Textarea
          placeholder="Share your thoughts about this content..."
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={3}
          className="resize-none"
        />
      )}

      {/* Submit Button */}
      <Button
        onClick={onSubmit}
        disabled={rating === 0 || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : existingRating ? (
          'Update Rating'
        ) : (
          'Submit Rating'
        )}
      </Button>
    </div>
  );
}

// Display component for showing ratings on content cards
interface RatingDisplayProps {
  averageRating: number | null;
  ratingCount: number;
  size?: 'sm' | 'md';
}

export function RatingDisplay({ averageRating, ratingCount, size = 'sm' }: RatingDisplayProps) {
  if (!averageRating || ratingCount === 0) {
    return (
      <span className="text-xs text-muted-foreground">No ratings</span>
    );
  }

  const starSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-1">
      <Star className={cn(starSize, "fill-yellow-400 text-yellow-400")} />
      <span className={cn(textSize, "font-medium")}>
        {formatRating(averageRating)}
      </span>
      <span className={cn(textSize, "text-muted-foreground")}>
        ({ratingCount})
      </span>
    </div>
  );
}
