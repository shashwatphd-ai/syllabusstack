import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, MessageSquare, Lightbulb } from 'lucide-react';
import {
  usePeerExplanations,
  usePostExplanation,
  useVoteExplanation,
} from '@/hooks/useCommunity';

interface PeerExplanationProps {
  questionId: string;
  courseId: string;
  questionText: string;
  /** Whether current user got this question correct */
  userGotCorrect: boolean;
}

export function PeerExplanation({ questionId, courseId, questionText, userGotCorrect }: PeerExplanationProps) {
  const [showForm, setShowForm] = useState(false);
  const [explanation, setExplanation] = useState('');
  const { data: explanations = [] } = usePeerExplanations(questionId, courseId);
  const postExplanation = usePostExplanation();
  const voteExplanation = useVoteExplanation();

  const handlePost = async () => {
    if (!explanation.trim()) return;
    await postExplanation.mutateAsync({ questionId, courseId, explanationText: explanation.trim() });
    setShowForm(false);
    setExplanation('');
  };

  return (
    <div className="space-y-3">
      {/* Action button based on correctness */}
      {userGotCorrect && !showForm && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => setShowForm(true)}
        >
          <Lightbulb className="h-3 w-3 mr-1" />
          Explain to peers
        </Button>
      )}

      {/* Explanation form */}
      {showForm && (
        <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-medium text-muted-foreground">
            Help classmates understand: <span className="text-foreground">{questionText}</span>
          </p>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explain in your own words why this answer is correct..."
            className="text-sm min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button size="sm" className="text-xs h-7" onClick={handlePost} disabled={postExplanation.isPending}>
              {postExplanation.isPending ? 'Sharing...' : 'Share'}
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Show peer explanations */}
      {explanations.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Peer Tips ({explanations.length})
          </p>
          {explanations.slice(0, 3).map(exp => (
            <div key={exp.id} className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
              <p className="text-sm leading-relaxed">{exp.explanation_text}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {exp.author_name ?? 'Student'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 w-6 p-0 ${exp.user_vote === 1 ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={() => voteExplanation.mutate({ explanationId: exp.id, vote: 1, questionId })}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 min-w-[20px] justify-center">
                    {exp.votes}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 w-6 p-0 ${exp.user_vote === -1 ? 'text-destructive' : 'text-muted-foreground'}`}
                    onClick={() => voteExplanation.mutate({ explanationId: exp.id, vote: -1, questionId })}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show "See peer tips" for incorrect answers */}
      {!userGotCorrect && explanations.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No peer explanations yet for this question.</p>
      )}
    </div>
  );
}
