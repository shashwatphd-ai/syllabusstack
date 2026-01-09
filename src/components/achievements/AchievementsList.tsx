import { Trophy, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAchievementsWithProgress, tierConfig, Achievement } from '@/hooks/useAchievements';
import { AchievementBadge, CompactAchievementBadge } from './AchievementBadge';
import { XPProgress } from './XPProgress';

interface AchievementsListProps {
  variant?: 'full' | 'compact' | 'badges-only';
  showXP?: boolean;
}

export function AchievementsList({ variant = 'full', showXP = true }: AchievementsListProps) {
  const { achievements, byTier, totalEarned, totalAchievements, isLoading } = useAchievementsWithProgress();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showXP && <Skeleton className="h-40 w-full" />}
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (variant === 'badges-only') {
    return (
      <div className="flex flex-wrap gap-3">
        {achievements
          .filter(a => a.earned)
          .map(achievement => (
            <AchievementBadge key={achievement.id} achievement={achievement} size="md" />
          ))}
        {totalEarned === 0 && (
          <p className="text-sm text-muted-foreground">No achievements earned yet</p>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Achievements
            <Badge variant="secondary" className="ml-auto">
              {totalEarned}/{totalAchievements}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {achievements
            .filter(a => a.earned)
            .slice(0, 5)
            .map(achievement => (
              <CompactAchievementBadge key={achievement.id} achievement={achievement} />
            ))}
          {totalEarned === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Start learning to earn achievements!
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full variant
  return (
    <div className="space-y-6">
      {showXP && <XPProgress variant="card" />}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Achievements
              </CardTitle>
              <CardDescription>
                Earn badges and XP by completing learning milestones
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-base px-3 py-1">
              {totalEarned} / {totalAchievements}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['bronze', 'silver', 'gold', 'platinum'] as const).map(tier => (
            <TierSection
              key={tier}
              tier={tier}
              achievements={byTier[tier]}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface TierSectionProps {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  achievements: Array<Achievement & {
    earned?: boolean;
    earnedAt?: string;
    progress?: number;
    progressPercent?: number;
  }>;
}

function TierSection({ tier, achievements }: TierSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const config = tierConfig[tier];
  const earnedCount = achievements.filter(a => a.earned).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
          config.bgColor,
          "hover:opacity-90"
        )}>
          <div className="flex items-center gap-3">
            {isOpen ? (
              <ChevronDown className={cn("h-5 w-5", config.color)} />
            ) : (
              <ChevronRight className={cn("h-5 w-5", config.color)} />
            )}
            <span className={cn("font-semibold", config.color)}>{config.label} Tier</span>
            <Badge variant="outline" className={cn("border", config.borderColor, config.color)}>
              {earnedCount}/{achievements.length}
            </Badge>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
          {achievements.map(achievement => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface AchievementCardProps {
  achievement: Achievement & {
    earned?: boolean;
    earnedAt?: string;
    progress?: number;
    progressPercent?: number;
  };
}

function AchievementCard({ achievement }: AchievementCardProps) {
  const tier = tierConfig[achievement.tier];

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border transition-all",
      achievement.earned
        ? [tier.bgColor + '/50', tier.borderColor]
        : "bg-muted/30 border-muted opacity-60"
    )}>
      <AchievementBadge
        achievement={achievement}
        size="md"
        showProgress={true}
        showTooltip={false}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn(
              "font-medium",
              !achievement.earned && "text-muted-foreground"
            )}>
              {achievement.name}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {achievement.description}
            </p>
          </div>
          <Badge
            variant={achievement.earned ? "default" : "outline"}
            className="shrink-0 text-xs"
          >
            +{achievement.xp_reward} XP
          </Badge>
        </div>
        {!achievement.earned && achievement.progressPercent !== undefined && achievement.progressPercent > 0 && (
          <div className="mt-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all bg-primary/60")}
                style={{ width: `${achievement.progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {achievement.progress}/{achievement.requirement_count} completed
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Recently earned achievements display
export function RecentAchievements() {
  const { achievements, isLoading } = useAchievementsWithProgress();

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const recentEarned = achievements
    .filter(a => a.earned)
    .sort((a, b) => new Date(b.earnedAt || 0).getTime() - new Date(a.earnedAt || 0).getTime())
    .slice(0, 3);

  if (recentEarned.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-500" />
        Recent Achievements
      </h4>
      <div className="flex gap-4">
        {recentEarned.map(achievement => (
          <AchievementBadge key={achievement.id} achievement={achievement} size="lg" />
        ))}
      </div>
    </div>
  );
}
