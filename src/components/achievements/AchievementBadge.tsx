import {
  BookOpen, Briefcase, Target, Play, FileQuestion, Library, Compass, Zap, Award, Flame,
  Star, MessageSquare, GraduationCap, Crown, Shield, Trophy, Heart, Lock, LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tierConfig, Achievement } from '@/hooks/useAchievements';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

// Map icon names to Lucide icons
const iconMap: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  'briefcase': Briefcase,
  'target': Target,
  'play': Play,
  'file-question': FileQuestion,
  'library': Library,
  'compass': Compass,
  'zap': Zap,
  'award': Award,
  'flame': Flame,
  'star': Star,
  'message-square': MessageSquare,
  'graduation-cap': GraduationCap,
  'crown': Crown,
  'shield': Shield,
  'trophy': Trophy,
  'heart': Heart,
};

interface AchievementBadgeProps {
  achievement: Achievement & {
    earned?: boolean;
    earnedAt?: string;
    progress?: number;
    progressPercent?: number;
  };
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  showTooltip?: boolean;
}

export function AchievementBadge({
  achievement,
  size = 'md',
  showProgress = false,
  showTooltip = true,
}: AchievementBadgeProps) {
  const Icon = iconMap[achievement.icon] || Trophy;
  const tier = tierConfig[achievement.tier];
  const earned = achievement.earned;

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };

  const iconSizes = {
    sm: 'h-5 w-5',
    md: 'h-7 w-7',
    lg: 'h-10 w-10',
  };

  const badge = (
    <div className={cn(
      "relative flex flex-col items-center",
      !earned && "opacity-50"
    )}>
      {/* Badge Circle */}
      <div className={cn(
        "rounded-full flex items-center justify-center border-2 transition-all",
        sizeClasses[size],
        earned ? [tier.bgColor, tier.borderColor] : "bg-muted border-muted-foreground/20",
        earned && "ring-2 ring-offset-2 ring-offset-background",
        earned && tier.tier === 'bronze' && "ring-orange-400/50",
        earned && tier.tier === 'silver' && "ring-slate-400/50",
        earned && tier.tier === 'gold' && "ring-yellow-400/50",
        earned && tier.tier === 'platinum' && "ring-purple-400/50"
      )}>
        {earned ? (
          <Icon className={cn(iconSizes[size], tier.color)} />
        ) : (
          <Lock className={cn(iconSizes[size], "text-muted-foreground/50")} />
        )}
      </div>

      {/* Progress bar (if not earned and showing progress) */}
      {showProgress && !earned && achievement.progressPercent !== undefined && (
        <div className="w-full mt-1.5">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all", tier.bgColor.replace('100', '400'))}
              style={{ width: `${achievement.progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-0.5">
            {achievement.progress}/{achievement.requirement_count}
          </p>
        </div>
      )}
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium uppercase", tier.color)}>
                {tier.label}
              </span>
              {earned && (
                <span className="text-xs text-success">Earned!</span>
              )}
            </div>
            <p className="font-semibold">{achievement.name}</p>
            <p className="text-sm text-muted-foreground">{achievement.description}</p>
            <div className="flex items-center gap-2 pt-1 border-t border-border/50 mt-2">
              <span className="text-xs text-primary font-medium">+{achievement.xp_reward} XP</span>
              {earned && achievement.earnedAt && (
                <span className="text-xs text-muted-foreground">
                  Earned {formatDistanceToNow(new Date(achievement.earnedAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact badge for lists
interface CompactBadgeProps {
  achievement: Achievement & { earned?: boolean; earnedAt?: string };
  showXP?: boolean;
}

export function CompactAchievementBadge({ achievement, showXP = true }: CompactBadgeProps) {
  const Icon = iconMap[achievement.icon] || Trophy;
  const tier = tierConfig[achievement.tier];
  const earned = achievement.earned;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
      earned ? tier.borderColor : "border-muted",
      earned ? tier.bgColor + '/30' : "bg-muted/30"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center border",
        earned ? [tier.bgColor, tier.borderColor] : "bg-muted border-muted-foreground/20"
      )}>
        {earned ? (
          <Icon className={cn("h-5 w-5", tier.color)} />
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium truncate",
          !earned && "text-muted-foreground"
        )}>
          {achievement.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {achievement.description}
        </p>
      </div>
      {showXP && (
        <span className={cn(
          "text-xs font-medium shrink-0",
          earned ? "text-primary" : "text-muted-foreground"
        )}>
          +{achievement.xp_reward} XP
        </span>
      )}
    </div>
  );
}
