import { useState } from 'react';
import { CreditCard, History, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/UsageMeter';
import { PricingTable } from '@/components/billing/PricingTable';
import { SubscriptionManager } from '@/components/billing/SubscriptionManager';
import { BillingHistory } from '@/components/billing/BillingHistory';
import { useSubscription } from '@/hooks/useSubscription';

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { subscription, isLoading } = useSubscription();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-2">
            Manage your subscription, view usage, and access billing history.
          </p>
        </div>

        {/* Current Plan Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>
              {isLoading
                ? 'Loading...'
                : `You're on the ${subscription?.tier || 'Free'} plan`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsageMeter />
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="gap-2">
              <Settings className="h-4 w-4" />
              Manage Plan
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Pricing
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <SubscriptionManager />
          </TabsContent>

          <TabsContent value="pricing">
            <PricingTable />
          </TabsContent>

          <TabsContent value="history">
            <BillingHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
