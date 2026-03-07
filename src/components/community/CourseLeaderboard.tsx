import { useCourseLeaderboard } from '@/hooks/useCommunity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const rankIcons = [
  <Trophy className="h-5 w-5 text-yellow-500" />,
  <Medal className="h-5 w-5 text-gray-400" />,
  <Award className="h-5 w-5 text-amber-600" />,
];

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface CourseLeaderboardProps {
  courseId: string;
}

export function CourseLeaderboard({ courseId }: CourseLeaderboardProps) {
  const [timeRange, setTimeRange] = useState<'all' | 'weekly'>('all');
  const { data: entries = [], isLoading } = useCourseLeaderboard(courseId, timeRange);

  // Get current user id
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });

  const currentUserEntry = entries.find(e => e.user_id === currentUser);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Leaderboard
          </CardTitle>
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as 'all' | 'weekly')}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-2 h-6">All Time</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs px-2 h-6">This Week</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-6">Loading rankings...</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No assessment data yet. Complete quizzes to appear on the leaderboard!
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 10).map((entry) => {
              const isCurrentUser = entry.user_id === currentUser;
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                    isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent/10'
                  }`}
                >
                  <div className="w-7 text-center shrink-0">
                    {entry.rank <= 3 ? rankIcons[entry.rank - 1] : (
                      <span className="text-sm font-bold text-muted-foreground">{entry.rank}</span>
                    )}
                  </div>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={entry.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(entry.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {entry.full_name ?? 'Student'}
                      {isCurrentUser && <span className="text-primary ml-1">(you)</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.sessions_passed}/{entry.total_sessions} passed
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold">
                    {entry.total_score}%
                  </Badge>
                </div>
              );
            })}

            {/* Show current user if not in top 10 */}
            {currentUserEntry && currentUserEntry.rank > 10 && (
              <>
                <div className="text-center text-muted-foreground text-xs py-1">···</div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="w-7 text-center shrink-0">
                    <span className="text-sm font-bold text-muted-foreground">{currentUserEntry.rank}</span>
                  </div>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={currentUserEntry.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(currentUserEntry.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {currentUserEntry.full_name ?? 'Student'} <span className="text-primary">(you)</span>
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold">
                    {currentUserEntry.total_score}%
                  </Badge>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
