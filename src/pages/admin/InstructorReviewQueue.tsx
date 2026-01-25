import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Clock, ExternalLink, User, Building, Mail, FileText, Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  useAdminVerifications, 
  useVerificationStats, 
  useReviewVerification,
  InstructorVerification 
} from '@/hooks/useAdminVerifications';
import { formatDistanceToNow } from 'date-fns';

function VerificationCard({ verification, onReview }: { 
  verification: InstructorVerification; 
  onReview: (v: InstructorVerification, action: 'approve' | 'reject') => void;
}) {
  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'edu_domain':
        return <Badge variant="default" className="gap-1"><Mail className="h-3 w-3" />.edu Email</Badge>;
      case 'linkedin':
        return <Badge variant="secondary" className="gap-1"><ExternalLink className="h-3 w-3" />LinkedIn</Badge>;
      case 'manual':
        return <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />Documents</Badge>;
      case 'invite_code':
        return <Badge variant="default" className="gap-1"><Shield className="h-3 w-3" />Invite Code</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-warning" />;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={verification.profile?.avatar_url || ''} />
            <AvatarFallback>
              {verification.profile?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">
                {verification.profile?.full_name || 'Unknown User'}
              </h3>
              {getStatusIcon(verification.status)}
            </div>
            
            <p className="text-sm text-muted-foreground truncate">
              {verification.profile?.email}
            </p>
            
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {getMethodBadge(verification.verification_method)}
              
              {verification.institution_name && (
                <Badge variant="outline" className="gap-1">
                  <Building className="h-3 w-3" />
                  {verification.institution_name}
                </Badge>
              )}
              
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(verification.submitted_at), { addSuffix: true })}
              </span>
            </div>

            {/* Trust Score */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Trust Score</span>
                <span className="font-medium">{verification.trust_score}/100</span>
              </div>
              <Progress value={verification.trust_score} className="h-1.5" />
            </div>

            {/* Actions for pending */}
            {verification.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <Button 
                  size="sm" 
                  onClick={() => onReview(verification, 'approve')}
                  className="gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onReview(verification, 'reject')}
                  className="gap-1"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}

            {/* Rejection reason */}
            {verification.status === 'rejected' && verification.rejection_reason && (
              <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
                <strong>Reason:</strong> {verification.rejection_reason}
              </div>
            )}
          </div>

          {/* View Details */}
          <div className="flex flex-col gap-2">
            {verification.linkedin_url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={verification.linkedin_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {verification.document_urls && verification.document_urls.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {verification.document_urls.length} doc(s)
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InstructorReviewQueue() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedVerification, setSelectedVerification] = useState<InstructorVerification | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: stats, isLoading: statsLoading } = useVerificationStats();
  const { data: verifications, isLoading } = useAdminVerifications(activeTab);
  const reviewMutation = useReviewVerification();

  const handleReview = (verification: InstructorVerification, action: 'approve' | 'reject') => {
    setSelectedVerification(verification);
    setReviewAction(action);
    setRejectionReason('');
  };

  const confirmReview = async () => {
    if (!selectedVerification || !reviewAction) return;

    await reviewMutation.mutateAsync({
      verification_id: selectedVerification.id,
      action: reviewAction,
      rejection_reason: reviewAction === 'reject' ? rejectionReason : undefined,
    });

    setSelectedVerification(null);
    setReviewAction(null);
    setRejectionReason('');
  };

  return (
    <AppShell>
      <PageContainer>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Instructor Verification Queue</h1>
          <p className="text-muted-foreground">Review and approve instructor verification requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statsLoading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <Card>
                <CardContent className="pt-4 text-center">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-warning" />
                  <div className="text-2xl font-bold">{stats?.pending || 0}</div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-success" />
                  <div className="text-2xl font-bold">{stats?.approved || 0}</div>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <XCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
                  <div className="text-2xl font-bold">{stats?.rejected || 0}</div>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <Shield className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold">{stats?.total || 0}</div>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending
              {stats?.pending ? (
                <Badge variant="secondary" className="ml-1">{stats.pending}</Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              Rejected
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              All
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : verifications && verifications.length > 0 ? (
              <div className="space-y-4">
                {verifications.map((verification) => (
                  <VerificationCard
                    key={verification.id}
                    verification={verification}
                    onReview={handleReview}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    No {activeTab === 'all' ? '' : activeTab} verification requests found
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog 
          open={!!selectedVerification && !!reviewAction} 
          onOpenChange={() => { setSelectedVerification(null); setReviewAction(null); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewAction === 'approve' ? 'Approve Instructor' : 'Reject Verification'}
              </DialogTitle>
              <DialogDescription>
                {reviewAction === 'approve' 
                  ? `Confirm approval for ${selectedVerification?.profile?.full_name || 'this user'}. They will be able to create and publish courses.`
                  : 'Provide a reason for rejection. The user will be notified.'}
              </DialogDescription>
            </DialogHeader>

            {reviewAction === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="e.g., Unable to verify institutional affiliation..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => { setSelectedVerification(null); setReviewAction(null); }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmReview}
                disabled={reviewMutation.isPending || (reviewAction === 'reject' && !rejectionReason.trim())}
                variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {reviewAction === 'approve' ? 'Confirm Approval' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AppShell>
  );
}
