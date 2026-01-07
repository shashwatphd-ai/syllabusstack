import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { ContentMatch } from '@/hooks/useLearningObjectives';

interface VideoPreviewModalProps {
  match: ContentMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

function extractVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

export function VideoPreviewModal({ 
  match, 
  open, 
  onOpenChange, 
  onApprove, 
  onReject,
  isLoading 
}: VideoPreviewModalProps) {
  const content = match?.content;
  const videoId = extractVideoId(content?.source_url);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (count: number | null) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.75) return 'text-success';
    if (score >= 0.5) return 'text-warning';
    return 'text-destructive';
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg pr-8">{content?.title || 'Video Preview'}</DialogTitle>
          <DialogDescription>
            {content?.channel_name} • {formatViews(content?.view_count || null)} views • {formatDuration(content?.duration_seconds || null)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video embed */}
          {videoId ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
              <p className="text-muted-foreground">Video preview not available</p>
            </div>
          )}

          {/* Match score and breakdown */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div>
                <p className={`text-3xl font-bold ${getScoreColor(match.match_score)}`}>
                  {Math.round(match.match_score * 100)}%
                </p>
                <p className="text-sm text-muted-foreground">Match Score</p>
              </div>
            </div>
            
            <div className="flex gap-6 text-sm">
              <ScoreItem label="Duration Fit" score={match.duration_fit_score} />
              <ScoreItem label="Relevance" score={match.semantic_similarity_score} />
              <ScoreItem label="Engagement" score={match.engagement_quality_score} />
              <ScoreItem label="Authority" score={match.channel_authority_score} />
              <ScoreItem label="Recency" score={match.recency_score} />
            </div>
          </div>

          {/* Description */}
          {content?.description && (
            <div className="text-sm text-muted-foreground line-clamp-3">
              {content.description}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          {content?.source_url && (
            <Button variant="ghost" size="sm" asChild className="sm:mr-auto">
              <a href={content.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in YouTube
              </a>
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={onReject}
            disabled={isLoading}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
          <Button 
            onClick={onApprove}
            disabled={isLoading}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScoreItem({ label, score }: { label: string; score: number | null }) {
  const value = score ?? 0;
  const percentage = Math.round(value * 100);
  
  const getColor = () => {
    if (percentage >= 75) return 'bg-success';
    if (percentage >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className="text-center">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full ${getColor()} transition-all`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-medium w-8">{percentage}%</span>
      </div>
    </div>
  );
}
