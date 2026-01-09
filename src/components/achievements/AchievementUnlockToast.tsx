import { useEffect, useState } from 'react';
import { X, Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  useUnnotifiedAchievements,
  useMarkNotified,
  tierConfig,
  Achievement,
} from '@/hooks/useAchievements';
import { AchievementBadge } from './AchievementBadge';

// Provider component to show achievement toasts
export function AchievementToastProvider() {
  const { data: unnotified } = useUnnotifiedAchievements();
  const markNotified = useMarkNotified();
  const [currentAchievement, setCurrentAchievement] = useState<(Achievement & { id: string }) | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (unnotified && unnotified.length > 0 && !currentAchievement) {
      // Show the first unnotified achievement
      const first = unnotified[0];
      setCurrentAchievement(first.achievement as Achievement & { id: string });
      setIsVisible(true);

      // Mark as notified
      markNotified.mutate(first.achievement_id);

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setCurrentAchievement(null), 300); // Wait for animation
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [unnotified, currentAchievement]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => setCurrentAchievement(null), 300);
  };

  if (!currentAchievement) return null;

  return (
    <AchievementUnlockToast
      achievement={{ ...currentAchievement, earned: true }}
      isVisible={isVisible}
      onDismiss={handleDismiss}
    />
  );
}

interface AchievementUnlockToastProps {
  achievement: Achievement & { earned?: boolean };
  isVisible: boolean;
  onDismiss: () => void;
}

export function AchievementUnlockToast({
  achievement,
  isVisible,
  onDismiss,
}: AchievementUnlockToastProps) {
  const tier = tierConfig[achievement.tier];

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-sm",
        "transition-all duration-300 ease-out",
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-4 scale-95 pointer-events-none"
      )}
    >
      <div className={cn(
        "relative overflow-hidden rounded-lg border-2 shadow-xl",
        tier.borderColor,
        "bg-gradient-to-br from-background to-background/95"
      )}>
        {/* Animated background effect */}
        <div className={cn(
          "absolute inset-0 opacity-10",
          tier.bgColor
        )} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-yellow-400/20 via-transparent to-transparent" />

        {/* Sparkle effects */}
        <div className="absolute top-2 right-8 animate-pulse">
          <Sparkles className="h-4 w-4 text-yellow-400/60" />
        </div>
        <div className="absolute bottom-4 left-4 animate-pulse delay-150">
          <Sparkles className="h-3 w-3 text-yellow-400/40" />
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted/50"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Content */}
        <div className="relative p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-5 w-5 text-yellow-500 animate-bounce" />
            <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
              Achievement Unlocked!
            </span>
          </div>

          {/* Achievement Details */}
          <div className="flex items-center gap-4">
            <div className="animate-[pulse_2s_ease-in-out_infinite]">
              <AchievementBadge
                achievement={{ ...achievement, earned: true }}
                size="lg"
                showTooltip={false}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg">{achievement.name}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {achievement.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  tier.bgColor, tier.color
                )}>
                  {tier.label}
                </span>
                <span className="text-sm font-semibold text-primary">
                  +{achievement.xp_reward} XP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className={cn(
          "h-1 w-full",
          "bg-gradient-to-r",
          achievement.tier === 'bronze' && "from-orange-400 via-orange-500 to-orange-600",
          achievement.tier === 'silver' && "from-slate-400 via-slate-500 to-slate-600",
          achievement.tier === 'gold' && "from-yellow-400 via-yellow-500 to-yellow-600",
          achievement.tier === 'platinum' && "from-purple-400 via-purple-500 to-purple-600"
        )} />
      </div>
    </div>
  );
}

// Simpler inline notification for embedding in other components
export function AchievementUnlockBanner({
  achievement,
  onDismiss,
}: {
  achievement: Achievement;
  onDismiss?: () => void;
}) {
  const tier = tierConfig[achievement.tier];

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border-2 animate-in slide-in-from-top",
      tier.borderColor,
      tier.bgColor + '/20'
    )}>
      <Trophy className="h-5 w-5 text-yellow-500 animate-bounce" />
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium text-yellow-600 dark:text-yellow-400">
            Achievement Unlocked:
          </span>{' '}
          <span className="font-semibold">{achievement.name}</span>
          <span className="text-primary ml-2">+{achievement.xp_reward} XP</span>
        </p>
      </div>
      {onDismiss && (
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
