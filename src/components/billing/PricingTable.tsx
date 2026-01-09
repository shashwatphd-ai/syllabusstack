import { Check, X, Sparkles, Crown, Building2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSubscription, TIER_INFO, SubscriptionTier } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PricingTableProps {
  showCurrentBadge?: boolean;
}

export function PricingTable({ showCurrentBadge = true }: PricingTableProps) {
  const { tier: currentTier, subscription } = useSubscription();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'university') {
      window.open('mailto:enterprise@syllabusstack.com?subject=University Plan Inquiry', '_blank');
      return;
    }

    if (tier === currentTier) {
      toast({
        title: 'Already on this plan',
        description: `You're already subscribed to the ${TIER_INFO[tier].name} plan.`,
      });
      return;
    }

    // Pre-open a tab to avoid popup blockers (browsers block window.open after async)
    const popup = window.open('about:blank', '_blank');

    setLoadingTier(tier);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          tier,
          isAnnual,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing?canceled=true`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        if (popup) {
          try {
            // prevent the new page from having a reference back to this window
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (popup as any).opener = null;
          } catch {
            // ignore
          }
          popup.location.href = data.url;
        } else {
          // Fallback if popups are blocked
          window.location.href = data.url;
        }
      } else {
        throw new Error('Checkout URL missing');
      }
    } catch (error) {
      if (popup) popup.close();
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout failed',
        description: 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingTier(null);
    }
  };

  const annualDiscount = 0.17; // 17% discount for annual
  const getPrice = (tier: SubscriptionTier) => {
    const monthly = TIER_INFO[tier].priceMonthly;
    if (monthly <= 0) return TIER_INFO[tier].price;
    if (isAnnual) {
      const annual = monthly * 12 * (1 - annualDiscount);
      return `$${(annual / 12).toFixed(2)}/mo`;
    }
    return `$${monthly.toFixed(2)}/mo`;
  };

  return (
    <div className="space-y-6">
      {/* Annual/Monthly Toggle */}
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-toggle" className={!isAnnual ? 'font-medium' : 'text-muted-foreground'}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle"
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
        />
        <Label htmlFor="billing-toggle" className={isAnnual ? 'font-medium' : 'text-muted-foreground'}>
          Annual
          <Badge variant="secondary" className="ml-2 text-xs">Save 17%</Badge>
        </Label>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Free Tier */}
        <PricingCard
          tier="free"
          price={getPrice('free')}
          isCurrent={currentTier === 'free'}
          showCurrentBadge={showCurrentBadge}
          onSelect={() => {}}
          isLoading={false}
          buttonText={currentTier === 'free' ? 'Current Plan' : 'Downgrade'}
          buttonDisabled={currentTier === 'free'}
        />

        {/* Pro Tier */}
        <PricingCard
          tier="pro"
          price={getPrice('pro')}
          isCurrent={currentTier === 'pro'}
          showCurrentBadge={showCurrentBadge}
          onSelect={() => handleUpgrade('pro')}
          isLoading={loadingTier === 'pro'}
          buttonText={currentTier === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
          buttonDisabled={currentTier === 'pro' || currentTier === 'university'}
          isPopular
          billingNote={isAnnual ? 'Billed annually' : 'Billed monthly'}
        />

        {/* University Tier */}
        <PricingCard
          tier="university"
          price={getPrice('university')}
          isCurrent={currentTier === 'university'}
          showCurrentBadge={showCurrentBadge}
          onSelect={() => handleUpgrade('university')}
          isLoading={loadingTier === 'university'}
          buttonText="Contact Sales"
          buttonDisabled={false}
          buttonVariant="outline"
        />
      </div>

      {/* Feature Comparison */}
      <FeatureComparison />
    </div>
  );
}

interface PricingCardProps {
  tier: SubscriptionTier;
  price: string;
  isCurrent: boolean;
  showCurrentBadge: boolean;
  onSelect: () => void;
  isLoading: boolean;
  buttonText: string;
  buttonDisabled: boolean;
  buttonVariant?: 'default' | 'outline';
  isPopular?: boolean;
  billingNote?: string;
}

function PricingCard({
  tier,
  price,
  isCurrent,
  showCurrentBadge,
  onSelect,
  isLoading,
  buttonText,
  buttonDisabled,
  buttonVariant = 'default',
  isPopular,
  billingNote,
}: PricingCardProps) {
  const info = TIER_INFO[tier];
  const Icon = tier === 'university' ? Building2 : tier === 'pro' ? Crown : Sparkles;

  return (
    <Card className={cn(
      "relative transition-all",
      isPopular && "border-primary shadow-lg scale-105",
      isCurrent && "ring-2 ring-primary"
    )}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary">Most Popular</Badge>
        </div>
      )}
      {isCurrent && showCurrentBadge && (
        <div className="absolute -top-3 right-4">
          <Badge variant="outline">Current</Badge>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <div className={cn(
          "w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center",
          tier === 'pro' && "bg-primary/10",
          tier === 'university' && "bg-purple-100",
          tier === 'free' && "bg-muted"
        )}>
          <Icon className={cn(
            "h-6 w-6",
            tier === 'pro' && "text-primary",
            tier === 'university' && "text-purple-600",
            tier === 'free' && "text-muted-foreground"
          )} />
        </div>
        <CardTitle>{info.name}</CardTitle>
        <CardDescription>{info.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="text-center">
          <p className="text-3xl font-bold">{price}</p>
          {billingNote && (
            <p className="text-xs text-muted-foreground">{billingNote}</p>
          )}
        </div>

        <ul className="space-y-2">
          {info.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={buttonVariant}
          disabled={buttonDisabled || isLoading}
          onClick={onSelect}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            buttonText
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function FeatureComparison() {
  const features = [
    { name: 'Course Syllabi', free: '3', pro: 'Unlimited', university: 'Unlimited' },
    { name: 'Dream Jobs', free: '1', pro: '5', university: 'Unlimited' },
    { name: 'AI Analyses/month', free: '20', pro: '200', university: 'Unlimited' },
    { name: 'Gap Analysis', free: 'Basic', pro: 'Advanced', university: 'Advanced + Custom' },
    { name: 'Recommendations', free: 'Top 5', pro: 'All', university: 'All + Custom' },
    { name: 'Content Library', free: 'Community', pro: 'Premium', university: 'Premium + Custom' },
    { name: 'PDF Export', free: false, pro: true, university: true },
    { name: 'Advanced Analytics', free: false, pro: true, university: true },
    { name: 'Admin Dashboard', free: false, pro: false, university: true },
    { name: 'White-label Branding', free: false, pro: false, university: true },
    { name: 'Priority Support', free: false, pro: 'Email', university: 'Dedicated' },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Feature Comparison</CardTitle>
        <CardDescription>See exactly what's included in each plan</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium">Feature</th>
                <th className="text-center p-4 font-medium">Free</th>
                <th className="text-center p-4 font-medium text-primary">Pro</th>
                <th className="text-center p-4 font-medium text-purple-600">University</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-4 text-sm">{feature.name}</td>
                  <td className="p-4 text-center">
                    <FeatureValue value={feature.free} />
                  </td>
                  <td className="p-4 text-center bg-primary/5">
                    <FeatureValue value={feature.pro} />
                  </td>
                  <td className="p-4 text-center bg-purple-50">
                    <FeatureValue value={feature.university} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="h-5 w-5 text-success mx-auto" />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />;
  }
  return <span className="text-sm">{value}</span>;
}
