import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Swords, Clock, CheckCircle, XCircle, Trophy, Users } from 'lucide-react';
import { ClassmateSelector } from './ClassmateSelector';
import {
  useChallenges,
  useCreateChallenge,
  useRespondToChallenge,
  type Classmate,
} from '@/hooks/useCommunity';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface ChallengeCardProps {
  courseId: string;
  learningObjectives: Array<{ id: string; text: string }>;
}

export function ChallengeCard({ courseId, learningObjectives }: ChallengeCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLO, setSelectedLO] = useState<string | null>(null);
  const [selectedClassmate, setSelectedClassmate] = useState<Classmate | null>(null);
  const { data: challenges = [] } = useChallenges(courseId);
  const createChallenge = useCreateChallenge();
  const respondToChallenge = useRespondToChallenge();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });

  const pendingForMe = challenges.filter(
    c => c.challenged_id === currentUser && c.status === 'pending'
  );
  const activeChallenges = challenges.filter(
    c => c.status === 'active' && (c.challenger_id === currentUser || c.challenged_id === currentUser)
  );
  const recentCompleted = challenges.filter(c => c.status === 'completed').slice(0, 5);

  const handleCreate = async () => {
    if (!selectedLO || !selectedClassmate) return;

    // Get random 5 question IDs for this LO
    const { data: questions } = await supabase
      .from('assessment_questions')
      .select('id')
      .eq('learning_objective_id', selectedLO);

    if (!questions || questions.length === 0) return;

    const shuffled = questions.sort(() => Math.random() - 0.5);
    const questionIds = shuffled.slice(0, Math.min(5, shuffled.length)).map(q => q.id);

    await createChallenge.mutateAsync({
      courseId,
      loId: selectedLO,
      challengedId: selectedClassmate.student_id,
      questionIds,
    });

    setDialogOpen(false);
    setSelectedLO(null);
    setSelectedClassmate(null);
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    active: 'bg-primary/10 text-primary border-primary/30',
    completed: 'bg-green-500/10 text-green-600 border-green-500/30',
    declined: 'bg-destructive/10 text-destructive border-destructive/30',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            Quiz Duels
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8">
                <Swords className="h-3.5 w-3.5 mr-1.5" />
                Challenge
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Challenge a Classmate</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Pick a Learning Objective</label>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {learningObjectives.map(lo => (
                      <button
                        key={lo.id}
                        onClick={() => setSelectedLO(lo.id)}
                        className={`w-full text-left text-sm p-2.5 rounded-lg transition-colors ${
                          selectedLO === lo.id
                            ? 'bg-primary/15 border border-primary/30'
                            : 'hover:bg-accent/10 border border-transparent'
                        }`}
                      >
                        {lo.text}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Pick an Opponent</label>
                  <ClassmateSelector
                    courseId={courseId}
                    selectedId={selectedClassmate?.student_id ?? null}
                    onSelect={setSelectedClassmate}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!selectedLO || !selectedClassmate || createChallenge.isPending}
                  className="w-full"
                >
                  {createChallenge.isPending ? 'Sending...' : 'Send Challenge'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending challenges for me */}
        {pendingForMe.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Incoming Challenges
            </p>
            {pendingForMe.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">You've been challenged!</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.question_ids.length} questions
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => respondToChallenge.mutate({ challengeId: c.id, accept: false })}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => respondToChallenge.mutate({ challengeId: c.id, accept: true })}
                  >
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active challenges */}
        {activeChallenges.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Duels
            </p>
            {activeChallenges.map(c => {
              const isChallenger = c.challenger_id === currentUser;
              const myScore = isChallenger ? c.challenger_score : c.challenged_score;
              const theirScore = isChallenger ? c.challenged_score : c.challenger_score;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => navigate(`/learn/challenge/${c.id}`)}
                >
                  <Swords className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Duel in progress</p>
                    <p className="text-[10px] text-muted-foreground">{c.question_ids.length} questions</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {myScore} - {theirScore}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent completed */}
        {recentCompleted.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Results
            </p>
            {recentCompleted.map(c => {
              const isChallenger = c.challenger_id === currentUser;
              const won = c.winner_id === currentUser;
              const tied = !c.winner_id;
              const myScore = isChallenger ? c.challenger_score : c.challenged_score;
              const theirScore = isChallenger ? c.challenged_score : c.challenger_score;
              return (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50">
                  {won ? (
                    <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                  ) : tied ? (
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {won ? 'Victory!' : tied ? 'Draw' : 'Defeat'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {myScore} - {theirScore}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {challenges.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">
            <Swords className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No challenges yet. Be the first to challenge a classmate!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
