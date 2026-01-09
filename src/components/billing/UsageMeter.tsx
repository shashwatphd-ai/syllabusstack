import { AlertCircle, Zap, BookOpen, Briefcase, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubscription, useUsageLimits, TIER_INFO } from '@/hooks/useSubscription';
import { Link } from 'react-router-dom';

interface UsageMeterProps {
  variant?: 'full' | 'compact' | 'inline';
  showUpgrade?: boolean;
}

export function UsageMeter({ variant = 'full', showUpgrade = true }: UsageMeterProps) {
  const { subscription, isLoading, tier } = useSubscription();
  const limits = useUsageLimits();
  const tierInfo = TIER_INFO[tier];

  if (isLoading) {
    return variant === 'full' ? (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    ) : (
      <Skeleton className="h-20 w-full" />
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">
            {limits.ai.used}/{limits.ai.limit} AI calls
          </span>
        </div>
        {limits.ai.isWarning && (
          <Badge variant="destructive" className="text-xs">
            {limits.ai.isExhausted ? 'Limit reached' : 'Low'}
          </Badge>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-3 p-4 border rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Usage This Month</span>
          <Badge variant="outline" className={tierInfo.color}>
            {tierInfo.name}
          </Badge>
        </div>
        <UsageBar
          icon={Zap}
          label="AI Calls"
          used={limits.ai.used}
          limit={limits.ai.limit}
          percent={limits.ai.percent}
          isWarning={limits.ai.isWarning}
        />
        {showUpgrade && tier === 'free' && (
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to="/billing">Upgrade for more</Link>
          </Button>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage & Limits
            </CardTitle>
            <CardDescription>
              Your current plan usage for this billing period
            </CardDescription>
          </div>
          <Badge variant="outline" className={cn("text-base px-3 py-1", tierInfo.color)}>
            {tierInfo.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Calls */}
        <UsageSection
          icon={Zap}
          title="AI Analyses"
          description="Syllabus parsing, gap analysis, recommendations"
          used={limits.ai.used}
          limit={limits.ai.limit}
          percent={limits.ai.percent}
          isWarning={limits.ai.isWarning}
          isExhausted={limits.ai.isExhausted}
        />

        {/* Courses */}
        <UsageSection
          icon={BookOpen}
          title="Course Syllabi"
          description="Uploaded course documents"
          used={limits.courses.used}
          limit={limits.courses.limit}
          percent={limits.courses.percent}
          isWarning={limits.courses.isWarning}
          isExhausted={limits.courses.isExhausted}
        />

        {/* Dream Jobs */}
        <UsageSection
          icon={Briefcase}
          title="Dream Jobs"
          description="Career profiles for gap analysis"
          used={limits.dreamJobs.used}
          limit={limits.dreamJobs.limit}
          percent={limits.dreamJobs.percent}
          isWarning={limits.dreamJobs.isWarning}
          isExhausted={limits.dreamJobs.isExhausted}
        />

        {/* Upgrade CTA */}
        {showUpgrade && tier === 'free' && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Need more?</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade to Pro for unlimited access
                </p>
              </div>
              <Button asChild>
                <Link to="/billing">Upgrade to Pro</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface UsageSectionProps {
  icon: typeof Zap;
  title: string;
  description: string;
  used: number;
  limit: number;
  percent: number;
  isWarning: boolean;
  isExhausted: boolean;
}

function UsageSection({
  icon: Icon,
  title,
  description,
  used,
  limit,
  percent,
  isWarning,
  isExhausted,
}: UsageSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            "h-4 w-4",
            isExhausted ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground"
          )} />
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn(
            "font-medium",
            isExhausted ? "text-destructive" : isWarning ? "text-warning" : ""
          )}>
            {used} / {limit > 1000 ? '∞' : limit}
          </p>
          {isExhausted && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Limit reached
            </p>
          )}
        </div>
      </div>
      <Progress
        value={Math.min(percent, 100)}
        className={cn(
          "h-2",
          isExhausted && "[&>div]:bg-destructive",
          isWarning && !isExhausted && "[&>div]:bg-warning"
        )}
      />
    </div>
  );
}

interface UsageBarProps {
  icon: typeof Zap;
  label: string;
  used: number;
  limit: number;
  percent: number;
  isWarning: boolean;
}

function UsageBar({ icon: Icon, label, used, limit, percent, isWarning }: UsageBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className={isWarning ? "text-warning font-medium" : ""}>
          {used}/{limit > 1000 ? '∞' : limit}
        </span>
      </div>
      <Progress value={Math.min(percent, 100)} className="h-1.5" />
    </div>
  );
}

// Minimal warning banner for when limits are approaching
export function UsageWarningBanner() {
  const limits = useUsageLimits();
  const { tier } = useSubscription();

  if (tier !== 'free') return null;

  const warnings = [
    limits.ai.isWarning && `AI calls: ${limits.ai.used}/${limits.ai.limit}`,
    limits.courses.isWarning && `Courses: ${limits.courses.used}/${limits.courses.limit}`,
    limits.dreamJobs.isWarning && `Dream jobs: ${limits.dreamJobs.used}/${limits.dreamJobs.limit}`,
  ].filter(Boolean);

  if (warnings.length === 0) return null;

  const hasExhausted = limits.ai.isExhausted || limits.courses.isExhausted || limits.dreamJobs.isExhausted;

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg text-sm",
      hasExhausted
        ? "bg-destructive/10 border border-destructive/30 text-destructive"
        : "bg-warning/10 border border-warning/30 text-warning"
    )}>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>
          {hasExhausted ? 'Limit reached: ' : 'Approaching limit: '}
          {warnings.join(', ')}
        </span>
      </div>
      <Button asChild size="sm" variant={hasExhausted ? "destructive" : "outline"}>
        <Link to="/billing">Upgrade</Link>
      </Button>
    </div>
  );
}
