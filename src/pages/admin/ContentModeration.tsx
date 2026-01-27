import { useState } from 'react';
import { Flag, CheckCircle2, XCircle, AlertTriangle, ExternalLink, RefreshCw, Filter } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ModerationItem {
  id: string;
  content_type: string;
  content_id: string;
  course_id: string | null;
  flagged_by: string | null;
  reason: string;
  details: Record<string, unknown>;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  action_taken: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/30',
  approved: 'bg-green-500/10 text-green-600 border-green-500/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  escalated: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
};

const contentTypeLabels: Record<string, string> = {
  video: 'Video Content',
  slide: 'Lecture Slide',
  course: 'Course',
  lo_content: 'Learning Objective Content',
};

export default function ContentModerationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('none');
  const [filterStatus, setFilterStatus] = useState('pending');

  // Fetch moderation queue
  // Note: Using type bypass since content_moderation types are not yet generated
  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ['content-moderation', filterStatus],
    queryFn: async () => {
      let query = (supabase as any)
        .from('content_moderation')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as ModerationItem[];
    },
  });

  // Update moderation status
  // Note: Using type bypass since content_moderation types are not yet generated
  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
      action,
    }: {
      id: string;
      status: string;
      notes: string;
      action: string;
    }) => {
      const { error } = await (supabase as any)
        .from('content_moderation')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          action_taken: action,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-moderation'] });
      setSelectedItem(null);
      setReviewNotes('');
      setActionTaken('none');
      toast({
        title: 'Review submitted',
        description: 'The moderation decision has been recorded.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    },
  });

  const handleApprove = () => {
    if (!selectedItem) return;
    updateStatus.mutate({
      id: selectedItem.id,
      status: 'approved',
      notes: reviewNotes,
      action: 'none',
    });
  };

  const handleReject = () => {
    if (!selectedItem) return;
    updateStatus.mutate({
      id: selectedItem.id,
      status: 'rejected',
      notes: reviewNotes,
      action: actionTaken,
    });
  };

  const handleEscalate = () => {
    if (!selectedItem) return;
    updateStatus.mutate({
      id: selectedItem.id,
      status: 'escalated',
      notes: reviewNotes,
      action: 'none',
    });
  };

  const pendingCount = items?.filter((i) => i.status === 'pending').length ?? 0;

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Flag className="h-6 w-6" />
                Content Moderation
              </h1>
              <p className="text-muted-foreground">
                Review and manage flagged content across the platform.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount} pending</Badge>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-warning">
                  {items?.filter((i) => i.status === 'pending').length ?? 0}
                </div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">
                  {items?.filter((i) => i.status === 'approved').length ?? 0}
                </div>
                <p className="text-sm text-muted-foreground">Approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-destructive">
                  {items?.filter((i) => i.status === 'rejected').length ?? 0}
                </div>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-purple-600">
                  {items?.filter((i) => i.status === 'escalated').length ?? 0}
                </div>
                <p className="text-sm text-muted-foreground">Escalated</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Queue */}
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Loading moderation queue...</p>
              </CardContent>
            </Card>
          ) : items?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold text-lg">All Clear!</h3>
                <p className="text-muted-foreground">No items matching the current filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items?.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedItem(item)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">
                            {contentTypeLabels[item.content_type] || item.content_type}
                          </Badge>
                          <Badge className={statusColors[item.status]}>
                            {item.status}
                          </Badge>
                        </div>
                        <p className="font-medium truncate">
                          {(item.details as Record<string, string>)?.title || `Content ID: ${item.content_id.slice(0, 8)}...`}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          <span className="font-medium">Reason:</span> {item.reason}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Flagged {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Review Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Flagged Content</DialogTitle>
              <DialogDescription>
                Review the flagged content and take appropriate action.
              </DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {contentTypeLabels[selectedItem.content_type] || selectedItem.content_type}
                    </Badge>
                    <Badge className={statusColors[selectedItem.status]}>
                      {selectedItem.status}
                    </Badge>
                  </div>
                  <p className="font-medium">
                    {(selectedItem.details as Record<string, string>)?.title || 'Untitled Content'}
                  </p>
                  {(selectedItem.details as Record<string, string>)?.url && (
                    <a
                      href={(selectedItem.details as Record<string, string>).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center gap-1 hover:underline"
                    >
                      View Content <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Flag Reason</p>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    {selectedItem.reason}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Review Notes</p>
                  <Textarea
                    placeholder="Add notes about your decision..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Action to Take (if rejecting)</p>
                  <Select value={actionTaken} onValueChange={setActionTaken}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No action</SelectItem>
                      <SelectItem value="content_removed">Remove content</SelectItem>
                      <SelectItem value="user_warned">Warn user</SelectItem>
                      <SelectItem value="user_banned">Ban user</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleEscalate}
                disabled={updateStatus.isPending}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Escalate
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={updateStatus.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={updateStatus.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AppShell>
  );
}
