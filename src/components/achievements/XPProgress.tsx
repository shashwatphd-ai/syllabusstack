import { Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserXP, getLevelProgress, getXPForNextLevel, getXPForLevel } from '@/hooks/useAchievements';

interface XPProgressProps {
  variant?: 'card' | 'compact' | 'inline';
  showLabel?: boolean;
}

export function XPProgress({ variant = 'card', showLabel = true }: XPProgressProps) {
  const { data: userXP, isLoading } = useUserXP();

  if (isLoading) {
    return variant === 'card' ? (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    ) : (
      <Skeleton className="h-10 w-full" />
    );
  }

  const level = userXP?.level || 1;
  const totalXP = userXP?.total_xp || 0;
  const progress = getLevelProgress(totalXP, level);
  const currentLevelXP = getXPForLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const xpIntoLevel = totalXP - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
          "bg-primary/10 text-primary"
        )}>
          {level}
        </div>
        <div className="flex-1 min-w-0">
          <Progress value={progress} className="h-2" />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {totalXP} XP
        </span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-bold",
              "bg-gradient-to-br from-primary/20 to-primary/10 text-primary border border-primary/20"
            )}>
              {level}
            </div>
            <div>
              <p className="font-medium text-sm">Level {level}</p>
              <p className="text-xs text-muted-foreground">{totalXP} total XP</p>
            </div>
          </div>
          <Sparkles className="h-4 w-4 text-primary/50" />
        </div>
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {xpIntoLevel} / {xpNeeded} XP to Level {level + 1}
          </p>
        </div>
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {/* Level Badge */}
          <div className={cn(
            "w-16 h-16 rounded-full flex flex-col items-center justify-center",
            "bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30",
            "shadow-lg shadow-primary/10"
          )}>
            <span className="text-2xl font-bold text-primary">{level}</span>
            <span className="text-xs text-primary/70 -mt-1">LEVEL</span>
          </div>

          {/* XP Info */}
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{totalXP.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">XP</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {xpNeeded - xpIntoLevel} XP until Level {level + 1}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Level {level}</span>
            <span>Level {level + 1}</span>
          </div>
          <Progress value={progress} className="h-3" />
          <p className="text-xs text-center text-muted-foreground">
            {xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
          </p>
        </div>

        {showLabel && (
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-border/50">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">
              {getLevelTitle(level)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Level titles for gamification
function getLevelTitle(level: number): string {
  if (level >= 50) return 'Legendary Scholar';
  if (level >= 40) return 'Master of Knowledge';
  if (level >= 30) return 'Expert Learner';
  if (level >= 25) return 'Knowledge Seeker';
  if (level >= 20) return 'Dedicated Student';
  if (level >= 15) return 'Rising Star';
  if (level >= 10) return 'Committed Learner';
  if (level >= 7) return 'Active Participant';
  if (level >= 5) return 'Getting Started';
  if (level >= 3) return 'Beginner';
  return 'Newcomer';
}

// Mini XP display for headers/navigation
export function XPBadge() {
  const { data: userXP, isLoading } = useUserXP();

  if (isLoading) {
    return <Skeleton className="h-6 w-16 rounded-full" />;
  }

  const level = userXP?.level || 1;
  const totalXP = userXP?.total_xp || 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
        <span className="text-xs font-bold text-primary">{level}</span>
      </div>
      <span className="text-xs font-medium text-primary">
        {totalXP.toLocaleString()} XP
      </span>
    </div>
  );
}
