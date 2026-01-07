import { useState } from 'react';
import { Video, CheckCircle, XCircle, Clock, ExternalLink, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useContentMatches, useUpdateContentMatchStatus, useSearchYouTubeContent, LearningObjective, ContentMatch } from '@/hooks/useLearningObjectives';
import { EmptyState } from '@/components/common/EmptyState';

interface ContentCurationPanelProps {
  courseId: string;
  learningObjectives: LearningObjective[];
  curationMode: string;
}

export function ContentCurationPanel({ courseId, learningObjectives, curationMode }: ContentCurationPanelProps) {
  const [selectedLO, setSelectedLO] = useState<string | null>(learningObjectives[0]?.id || null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<ContentMatch | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: contentMatches, isLoading } = useContentMatches(selectedLO || undefined);
  const updateStatus = useUpdateContentMatchStatus();
  const searchContent = useSearchYouTubeContent();

  const handleFindContent = (lo: LearningObjective) => {
    searchContent.mutate(lo);
  };

  const selectedLOData = learningObjectives.find(lo => lo.id === selectedLO);

  const handleApprove = (matchId: string) => {
    updateStatus.mutate({ matchId, status: 'approved' });
  };

  const handleReject = () => {
    if (!selectedMatch) return;
    updateStatus.mutate({ 
      matchId: selectedMatch.id, 
      status: 'rejected',
      rejectionReason: rejectReason,
    });
    setRejectDialogOpen(false);
    setSelectedMatch(null);
    setRejectReason('');
  };

  const openRejectDialog = (match: ContentMatch) => {
    setSelectedMatch(match);
    setRejectDialogOpen(true);
  };

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

  const pendingMatches = contentMatches?.filter(m => m.status === 'pending') || [];
  const approvedMatches = contentMatches?.filter(m => m.status === 'approved' || m.status === 'auto_approved') || [];
  const rejectedMatches = contentMatches?.filter(m => m.status === 'rejected') || [];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
      {/* LO Sidebar */}
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Learning Objectives</CardTitle>
          <CardDescription className="text-xs">
            Select an LO to manage its content
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-y-auto">
            {learningObjectives.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No learning objectives yet
              </div>
            ) : (
              learningObjectives.map((lo) => (
                <div
                  key={lo.id}
                  className={`w-full text-left p-3 border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer ${
                    selectedLO === lo.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => setSelectedLO(lo.id)}
                >
                  <p className="text-sm font-medium line-clamp-2">{lo.text}</p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    {lo.bloom_level && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {lo.bloom_level}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFindContent(lo);
                      }}
                      disabled={searchContent.isPending}
                    >
                      {searchContent.isPending && searchContent.variables?.id === lo.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Search className="h-3 w-3" />
                      )}
                      Find
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Content Matches</h3>
            <p className="text-sm text-muted-foreground">
              Mode: <span className="font-medium capitalize">{curationMode.replace('_', ' ')}</span>
            </p>
          </div>
          {selectedLOData && (
            <Button
              onClick={() => handleFindContent(selectedLOData)}
              disabled={searchContent.isPending}
              className="gap-2"
            >
              {searchContent.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Find Content
            </Button>
          )}
        </div>

        {!selectedLO ? (
          <EmptyState
            icon={Video}
            title="Select a learning objective"
            description="Choose an LO from the sidebar to view and manage content matches."
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !contentMatches || contentMatches.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No content found"
            description="Click 'Find Content' on a learning objective to search for matching videos."
          />
        ) : (
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending ({pendingMatches.length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Approved ({approvedMatches.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2">
                <XCircle className="h-4 w-4" />
                Rejected ({rejectedMatches.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingMatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending content to review
                </div>
              ) : (
                pendingMatches.map((match) => (
                  <ContentMatchCard
                    key={match.id}
                    match={match}
                    onApprove={() => handleApprove(match.id)}
                    onReject={() => openRejectDialog(match)}
                    formatDuration={formatDuration}
                    formatViews={formatViews}
                    getScoreColor={getScoreColor}
                    isPending={updateStatus.isPending}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {approvedMatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No approved content yet
                </div>
              ) : (
                approvedMatches.map((match) => (
                  <ContentMatchCard
                    key={match.id}
                    match={match}
                    isApproved
                    formatDuration={formatDuration}
                    formatViews={formatViews}
                    getScoreColor={getScoreColor}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              {rejectedMatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No rejected content
                </div>
              ) : (
                rejectedMatches.map((match) => (
                  <ContentMatchCard
                    key={match.id}
                    match={match}
                    isRejected
                    formatDuration={formatDuration}
                    formatViews={formatViews}
                    getScoreColor={getScoreColor}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Content</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this content (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ContentMatchCardProps {
  match: ContentMatch;
  onApprove?: () => void;
  onReject?: () => void;
  formatDuration: (s: number | null) => string;
  formatViews: (c: number | null) => string;
  getScoreColor: (s: number) => string;
  isApproved?: boolean;
  isRejected?: boolean;
  isPending?: boolean;
}

function ContentMatchCard({ 
  match, 
  onApprove, 
  onReject, 
  formatDuration, 
  formatViews, 
  getScoreColor,
  isApproved,
  isRejected,
  isPending,
}: ContentMatchCardProps) {
  const content = match.content;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Thumbnail */}
        <div className="relative w-full md:w-48 h-32 md:h-auto flex-shrink-0">
          {content?.thumbnail_url ? (
            <img 
              src={content.thumbnail_url} 
              alt={content.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          {content?.duration_seconds && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded">
              {formatDuration(content.duration_seconds)}
            </span>
          )}
        </div>

        {/* Content Info */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground line-clamp-2">{content?.title || 'Unknown Title'}</h4>
              <p className="text-sm text-muted-foreground mt-1">{content?.channel_name || 'Unknown Channel'}</p>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span>{formatViews(content?.view_count || null)} views</span>
                {content?.source_url && (
                  <a 
                    href={content.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Watch
                  </a>
                )}
              </div>
            </div>

            {/* Match Score */}
            <div className="text-right flex-shrink-0">
              <div className={`text-2xl font-bold ${getScoreColor(match.match_score)}`}>
                {Math.round(match.match_score * 100)}%
              </div>
              <p className="text-xs text-muted-foreground">Match Score</p>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Duration</p>
              <Progress value={(match.duration_fit_score || 0) * 100} className="h-1.5 mt-1" />
            </div>
            <div>
              <p className="text-muted-foreground">Relevance</p>
              <Progress value={(match.semantic_similarity_score || 0) * 100} className="h-1.5 mt-1" />
            </div>
            <div>
              <p className="text-muted-foreground">Engagement</p>
              <Progress value={(match.engagement_quality_score || 0) * 100} className="h-1.5 mt-1" />
            </div>
            <div>
              <p className="text-muted-foreground">Authority</p>
              <Progress value={(match.channel_authority_score || 0) * 100} className="h-1.5 mt-1" />
            </div>
            <div>
              <p className="text-muted-foreground">Recency</p>
              <Progress value={(match.recency_score || 0) * 100} className="h-1.5 mt-1" />
            </div>
          </div>

          {/* Actions */}
          {!isApproved && !isRejected && onApprove && onReject && (
            <div className="flex items-center gap-2 mt-4">
              <Button 
                size="sm" 
                onClick={onApprove}
                disabled={isPending}
                className="gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onReject}
                disabled={isPending}
                className="gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </div>
          )}

          {isApproved && (
            <Badge className="mt-4 bg-success/10 text-success">
              {match.status === 'auto_approved' ? 'Auto-Approved' : 'Approved'}
            </Badge>
          )}

          {isRejected && (
            <div className="mt-4">
              <Badge variant="destructive">Rejected</Badge>
              {match.rejection_reason && (
                <p className="text-sm text-muted-foreground mt-1">{match.rejection_reason}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
