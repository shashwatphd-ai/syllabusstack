import { useState } from 'react';
import { ChevronDown, ChevronRight, Video, Search, Plus, Loader2, CheckCircle, XCircle, Play, Link, Sparkles, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LearningObjective, ContentMatch, useContentMatches, useSearchYouTubeContent, useUpdateContentMatchStatus } from '@/hooks/useLearningObjectives';
import { useGenerateMicroChecks } from '@/hooks/useAssessment';
import { VideoPreviewModal } from './VideoPreviewModal';
import { ManualContentSearch } from './ManualContentSearch';
import { AddVideoByURL } from './AddVideoByURL';

interface UnifiedLOCardProps {
  learningObjective: LearningObjective;
  contentStatus: {
    hasContent: boolean;
    pendingCount: number;
    approvedCount: number;
  };
}

export function UnifiedLOCard({ learningObjective, contentStatus }: UnifiedLOCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewMatch, setPreviewMatch] = useState<ContentMatch | null>(null);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [showAddByURL, setShowAddByURL] = useState(false);

  const { data: contentMatches, isLoading: loadingMatches } = useContentMatches(isOpen ? learningObjective.id : undefined);
  const searchContent = useSearchYouTubeContent();
  const updateStatus = useUpdateContentMatchStatus();
  const generateMicroChecks = useGenerateMicroChecks();

  const pendingMatches = contentMatches?.filter(m => m.status === 'pending') || [];
  const approvedMatches = contentMatches?.filter(m => m.status === 'approved' || m.status === 'auto_approved') || [];

  const getBloomBadgeColor = (level: string | null) => {
    const colors: Record<string, string> = {
      remember: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      understand: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      apply: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      analyze: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      evaluate: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      create: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    };
    return colors[level || ''] || 'bg-muted text-muted-foreground';
  };

  const getStatusIndicator = () => {
    if (contentStatus.approvedCount > 0) {
      return <div className="w-3 h-3 rounded-full bg-success" title="Has approved content" />;
    }
    if (contentStatus.pendingCount > 0) {
      return <div className="w-3 h-3 rounded-full bg-warning" title="Has pending content" />;
    }
    return <div className="w-3 h-3 rounded-full bg-muted-foreground/30" title="No content" />;
  };

  const handleApprove = async (match: ContentMatch) => {
    await updateStatus.mutateAsync({ matchId: match.id, status: 'approved' });
    
    // Auto-generate micro-checks for approved content
    if (match.content) {
      generateMicroChecks.mutate({
        contentId: match.content.id,
        learningObjectiveId: learningObjective.id,
        contentTitle: match.content.title,
        contentDescription: match.content.description || undefined,
        durationSeconds: match.content.duration_seconds || 600,
        learningObjectiveText: learningObjective.text,
        numChecks: 3,
      });
    }
    
    setPreviewMatch(null);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.75) return 'text-success';
    if (score >= 0.5) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors">
          <CollapsibleTrigger asChild>
            <div className="flex items-start gap-3 p-4 cursor-pointer">
              <div className="mt-1 flex-shrink-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              
              {getStatusIndicator()}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{learningObjective.text}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {learningObjective.bloom_level && (
                    <Badge className={`text-xs ${getBloomBadgeColor(learningObjective.bloom_level)}`}>
                      {learningObjective.bloom_level}
                    </Badge>
                  )}
                  {learningObjective.expected_duration_minutes && (
                    <span className="text-xs text-muted-foreground">
                      ~{learningObjective.expected_duration_minutes} min
                    </span>
                  )}
                  {contentStatus.approvedCount > 0 && (
                    <Badge variant="outline" className="text-xs text-success border-success/30">
                      {contentStatus.approvedCount} approved
                    </Badge>
                  )}
                  {contentStatus.pendingCount > 0 && (
                    <Badge variant="outline" className="text-xs text-warning border-warning/30">
                      {contentStatus.pendingCount} pending
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={() => searchContent.mutate(learningObjective)}
                  disabled={searchContent.isPending}
                >
                  {searchContent.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  Find
                </Button>
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0 border-t border-border/50">
              {/* Action buttons */}
              <div className="flex items-center gap-2 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowManualSearch(true)}
                >
                  <Search className="h-3 w-3" />
                  Search YouTube
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowAddByURL(true)}
                >
                  <Link className="h-3 w-3" />
                  Add by URL
                </Button>
              </div>

              {loadingMatches ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : contentMatches && contentMatches.length > 0 ? (
                <div className="space-y-3">
                  {/* Approved content */}
                  {approvedMatches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Approved ({approvedMatches.length})
                      </p>
                      {approvedMatches.map((match) => (
                        <CompactContentCard
                          key={match.id}
                          match={match}
                          onPreview={() => setPreviewMatch(match)}
                          formatDuration={formatDuration}
                          getScoreColor={getScoreColor}
                          isApproved
                        />
                      ))}
                    </div>
                  )}

                  {/* Pending content */}
                  {pendingMatches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Pending Review ({pendingMatches.length})
                      </p>
                      {pendingMatches.map((match) => (
                        <CompactContentCard
                          key={match.id}
                          match={match}
                          onPreview={() => setPreviewMatch(match)}
                          onApprove={() => handleApprove(match)}
                          onReject={() => updateStatus.mutate({ matchId: match.id, status: 'rejected' })}
                          formatDuration={formatDuration}
                          getScoreColor={getScoreColor}
                          isLoading={updateStatus.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No content found yet</p>
                  <p className="text-xs">Click "Find" to search for videos</p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Preview Modal */}
      <VideoPreviewModal
        match={previewMatch}
        open={previewMatch !== null}
        onOpenChange={(open) => !open && setPreviewMatch(null)}
        onApprove={() => previewMatch && handleApprove(previewMatch)}
        onReject={() => {
          if (previewMatch) {
            updateStatus.mutate({ matchId: previewMatch.id, status: 'rejected' });
            setPreviewMatch(null);
          }
        }}
        isLoading={updateStatus.isPending}
      />

      {/* Manual Search Dialog */}
      <ManualContentSearch
        open={showManualSearch}
        onOpenChange={setShowManualSearch}
        learningObjectiveId={learningObjective.id}
        learningObjectiveText={learningObjective.text}
      />

      {/* Add by URL Dialog */}
      <AddVideoByURL
        open={showAddByURL}
        onOpenChange={setShowAddByURL}
        learningObjectiveId={learningObjective.id}
      />
    </>
  );
}

interface CompactContentCardProps {
  match: ContentMatch;
  onPreview: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  formatDuration: (s: number | null) => string;
  getScoreColor: (s: number) => string;
  isApproved?: boolean;
  isLoading?: boolean;
}

function CompactContentCard({
  match,
  onPreview,
  onApprove,
  onReject,
  formatDuration,
  getScoreColor,
  isApproved,
  isLoading,
}: CompactContentCardProps) {
  const content = match.content;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50">
      {/* Thumbnail */}
      <div 
        className="relative w-20 h-12 flex-shrink-0 rounded overflow-hidden cursor-pointer group"
        onClick={onPreview}
      >
        {content?.thumbnail_url ? (
          <img 
            src={content.thumbnail_url} 
            alt={content.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Video className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="h-4 w-4 text-white" />
        </div>
        {content?.duration_seconds && (
          <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 text-white text-[10px] rounded">
            {formatDuration(content.duration_seconds)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{content?.title || 'Unknown'}</p>
        <p className="text-xs text-muted-foreground truncate">{content?.channel_name}</p>
      </div>

      {/* Score */}
      <div className="flex-shrink-0 text-right">
        <span className={`text-lg font-bold ${getScoreColor(match.match_score)}`}>
          {Math.round(match.match_score * 100)}%
        </span>
      </div>

      {/* Actions */}
      {isApproved ? (
        <Badge className="bg-success/10 text-success text-xs">
          ✓
        </Badge>
      ) : (
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                  onClick={onApprove}
                  disabled={isLoading}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Approve</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onReject}
                  disabled={isLoading}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
