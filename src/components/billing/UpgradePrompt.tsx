import { ReactNode } from 'react';
import { Lock, Sparkles, Check, ArrowRight, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSubscription, TIER_INFO, PremiumFeature } from '@/hooks/useSubscription';
import { Link } from 'react-router-dom';

// Feature descriptions for upgrade prompts
const FEATURE_DESCRIPTIONS: Record<PremiumFeature, {
  title: string;
  description: string;
  benefits: string[];
}> = {
  export_pdf: {
    title: 'PDF Export',
    description: 'Export your gap analysis and recommendations as professional PDF reports',
    benefits: [
      'Share with mentors and advisors',
      'Include in job applications',
      'Print for offline review',
      'Professional formatting',
    ],
  },
  all_recommendations: {
    title: 'Unlimited Recommendations',
    description: 'See all learning recommendations, not just the top 5',
    benefits: [
      'Complete learning roadmap',
      'Alternative learning paths',
      'More content options',
      'Deeper skill coverage',
    ],
  },
  advanced_analytics: {
    title: 'Advanced Analytics',
    description: 'Get detailed insights into your learning progress and career alignment',
    benefits: [
      'Progress tracking over time',
      'Skill gap trends',
      'Learning velocity metrics',
      'Career readiness score',
    ],
  },
  premium_content: {
    title: 'Premium Content',
    description: 'Access curated premium learning resources',
    benefits: [
      'Expert-verified content',
      'Exclusive tutorials',
      'Industry certifications',
      'Priority content updates',
    ],
  },
  unlimited_courses: {
    title: 'Unlimited Courses',
    description: 'Upload as many course syllabi as you need',
    benefits: [
      'Track all your courses',
      'Complete academic coverage',
      'Historical course tracking',
      'No upload restrictions',
    ],
  },
  multiple_dream_jobs: {
    title: 'Multiple Dream Jobs',
    description: 'Explore up to 5 different career paths simultaneously',
    benefits: [
      'Compare career options',
      'Explore different industries',
      'Flexible career planning',
      'Comprehensive gap analysis',
    ],
  },
};

interface UpgradePromptProps {
  feature: PremiumFeature;
  variant?: 'inline' | 'card' | 'dialog' | 'overlay';
  children?: ReactNode;
  className?: string;
}

export function UpgradePrompt({
  feature,
  variant = 'card',
  children,
  className,
}: UpgradePromptProps) {
  const { tier } = useSubscription();
  const featureInfo = FEATURE_DESCRIPTIONS[feature];
  const proInfo = TIER_INFO.pro;

  // If user is pro or higher, don't show upgrade prompt
  if (tier !== 'free') {
    return <>{children}</>;
  }

  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">{featureInfo.title} requires Pro</span>
        <Button asChild size="sm" variant="link" className="h-auto p-0">
          <Link to="/billing">Upgrade</Link>
        </Button>
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className={cn("relative", className)}>
        {/* Blurred content behind */}
        <div className="blur-sm pointer-events-none opacity-50">
          {children}
        </div>
        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center p-6 max-w-sm">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{featureInfo.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{featureInfo.description}</p>
            <Button asChild>
              <Link to="/billing">
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'dialog') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline" className="gap-2">
              <Lock className="h-4 w-4" />
              {featureInfo.title}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Upgrade to Pro
            </DialogTitle>
            <DialogDescription>
              Unlock {featureInfo.title.toLowerCase()} and more premium features
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium">{featureInfo.title}</h4>
              <p className="text-sm text-muted-foreground">{featureInfo.description}</p>
            </div>
            <ul className="space-y-2">
              {featureInfo.benefits.map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold">Pro Plan</p>
                  <p className="text-sm text-muted-foreground">Billed monthly</p>
                </div>
                <p className="text-2xl font-bold">{proInfo.price}</p>
              </div>
              <Button asChild className="w-full">
                <Link to="/billing">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Upgrade Now
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn("border-primary/20 bg-gradient-to-br from-primary/5 to-transparent", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1">
            <Crown className="h-3 w-3" />
            Pro Feature
          </Badge>
        </div>
        <CardTitle className="text-lg">{featureInfo.title}</CardTitle>
        <CardDescription>{featureInfo.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {featureInfo.benefits.slice(0, 3).map((benefit, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-success" />
              {benefit}
            </li>
          ))}
        </ul>
        <Button asChild className="w-full">
          <Link to="/billing">
            Upgrade to Pro
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// HOC for wrapping premium features
export function withPremium<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature: PremiumFeature
) {
  return function PremiumGuard(props: P) {
    const { tier, isLoading } = useSubscription();

    if (isLoading) {
      return (
        <div className="animate-pulse bg-muted rounded-lg h-40" />
      );
    }

    if (tier === 'free') {
      return <UpgradePrompt feature={feature} variant="card" />;
    }

    return <WrappedComponent {...props} />;
  };
}

// Simple lock icon for premium features in menus/lists
export function PremiumBadge({ className }: { className?: string }) {
  const { tier } = useSubscription();

  if (tier !== 'free') return null;

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", className)}>
      <Crown className="h-3 w-3" />
      Pro
    </Badge>
  );
}

// Limit reached prompt
interface LimitReachedPromptProps {
  type: 'ai_calls' | 'courses' | 'dream_jobs';
  className?: string;
}

export function LimitReachedPrompt({ type, className }: LimitReachedPromptProps) {
  const titles: Record<typeof type, string> = {
    ai_calls: 'AI Analysis Limit Reached',
    courses: 'Course Limit Reached',
    dream_jobs: 'Dream Job Limit Reached',
  };

  const descriptions: Record<typeof type, string> = {
    ai_calls: "You've used all your AI analyses for this month. Upgrade to Pro for 200 analyses per month.",
    courses: "You've reached the maximum number of courses on the free plan. Upgrade to Pro for unlimited courses.",
    dream_jobs: "You've reached the maximum number of dream jobs on the free plan. Upgrade to Pro for up to 5 dream jobs.",
  };

  return (
    <Card className={cn("border-destructive/30 bg-destructive/5", className)}>
      <CardContent className="p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="font-semibold text-lg mb-2">{titles[type]}</h3>
        <p className="text-sm text-muted-foreground mb-4">{descriptions[type]}</p>
        <Button asChild>
          <Link to="/billing">
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade to Pro
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
