import { useState } from 'react';
import { CreditCard, Calendar, AlertTriangle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSubscription, TIER_INFO } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export function SubscriptionManager() {
  const { subscription, tier, isLoading } = useSubscription();
  const [isManaging, setIsManaging] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const tierInfo = TIER_INFO[tier];

  const handleManageBilling = async () => {
    setIsManaging(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          returnUrl: `${window.location.origin}/billing`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const opened = window.open(data.url, '_blank', 'noopener,noreferrer');
        if (!opened) {
          window.location.href = data.url;
        }
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast({
        title: 'Unable to open billing portal',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsManaging(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: {},
      });

      if (error) throw error;

      toast({
        title: 'Subscription canceled',
        description: 'Your subscription will remain active until the end of the billing period.',
      });

      // Refresh subscription data
      window.location.reload();
    } catch (error) {
      console.error('Cancel error:', error);
      toast({
        title: 'Unable to cancel subscription',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsCanceling(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
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
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing details
            </CardDescription>
          </div>
          <Badge variant={tier === 'free' ? 'secondary' : 'default'} className="text-sm">
            {tierInfo.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan Info */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{tierInfo.name} Plan</p>
              <p className="text-sm text-muted-foreground">{tierInfo.description}</p>
            </div>
            <p className="text-xl font-bold">{tierInfo.price}</p>
          </div>

          {subscription.subscription_ends_at && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {subscription.status === 'canceled' ? 'Access until: ' : 'Renews: '}
                {format(new Date(subscription.subscription_ends_at), 'MMMM d, yyyy')}
              </span>
            </div>
          )}

          {subscription.status === 'past_due' && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Payment failed. Please update your payment method.</span>
            </div>
          )}

          {subscription.status === 'canceled' && (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span>Subscription canceled. You'll be downgraded to Free at the end of your billing period.</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {tier === 'free' ? (
            <Button asChild>
              <Link to="/billing#pricing">Upgrade to Pro</Link>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={isManaging}
              >
                {isManaging ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Billing
              </Button>

              {subscription.status !== 'canceled' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:text-destructive">
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your subscription will remain active until{' '}
                        {subscription.subscription_ends_at
                          ? format(new Date(subscription.subscription_ends_at), 'MMMM d, yyyy')
                          : 'the end of your billing period'}
                        . After that, you'll be downgraded to the Free plan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isCanceling}
                      >
                        {isCanceling ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Cancel Subscription
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {subscription.status === 'canceled' && (
                <Button onClick={handleManageBilling} disabled={isManaging}>
                  {isManaging ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reactivate Subscription
                </Button>
              )}
            </>
          )}
        </div>

        {/* Quick Stats */}
        {tier !== 'free' && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">This billing period</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{subscription.ai_calls_used}</p>
                <p className="text-xs text-muted-foreground">AI Analyses</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{subscription.courses_used}</p>
                <p className="text-xs text-muted-foreground">Courses</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{subscription.dream_jobs_used}</p>
                <p className="text-xs text-muted-foreground">Dream Jobs</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
