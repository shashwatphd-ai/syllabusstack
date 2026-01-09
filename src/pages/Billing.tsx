import { useEffect, useState } from 'react';
import { CreditCard, History, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsageMeter } from '@/components/billing/UsageMeter';
import { PricingTable } from '@/components/billing/PricingTable';
import { SubscriptionManager } from '@/components/billing/SubscriptionManager';
import { BillingHistory } from '@/components/billing/BillingHistory';
import { useSubscription } from '@/hooks/useSubscription';
import { AppShell } from '@/components/layout';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';

const TABS = ['overview', 'pricing', 'history'] as const;
type BillingTab = (typeof TABS)[number];

function getTabFromHash(hash: string): BillingTab | null {
  const cleaned = hash.replace('#', '').trim();
  return (TABS as readonly string[]).includes(cleaned) ? (cleaned as BillingTab) : null;
}

export default function BillingPage() {
  const { subscription, isLoading } = useSubscription();
  const [activeTab, setActiveTab] = useState<BillingTab>(() => getTabFromHash(window.location.hash) ?? 'overview');

  useEffect(() => {
    const applyFromHash = () => {
      const tab = getTabFromHash(window.location.hash);
      if (tab) setActiveTab(tab);
    };

    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  const handleTabChange = (value: string) => {
    if (!(TABS as readonly string[]).includes(value)) return;

    const next = value as BillingTab;
    setActiveTab(next);

    // Keep URL in sync so "Upgrade" links to /billing#pricing work reliably
    const nextUrl = `${window.location.pathname}${window.location.search}#${next}`;
    window.history.replaceState(null, '', nextUrl);
  };

  return (
    <AppShell>
      <PageContainer maxWidth="2xl">
        <PageHeader
          title="Billing & Subscription"
          description="Manage your subscription, view usage, and access billing history."
        />

        {/* Current Plan Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>
              {isLoading ? 'Loading...' : `You're on the ${subscription?.tier || 'Free'} plan`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Avoid redundant "Upgrade" CTA here; Pricing tab owns checkout */}
            <UsageMeter variant="full" showUpgrade={false} />
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
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
      </PageContainer>
    </AppShell>
  );
}
