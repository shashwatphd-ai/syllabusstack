import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingState } from '@/components/common/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Swords,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useActiveChallenge, useSubmitChallengeAnswer } from '@/hooks/useCommunity';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface QuestionData {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  scenario_context: string | null;
  difficulty: string | null;
  bloom_level: string | null;
}

export default function ChallengeSessionPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { data: challenge, isLoading: challengeLoading } = useActiveChallenge(challengeId);
  const submitAnswer = useSubmitChallengeAnswer();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ isCorrect: boolean } | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });

  // Load questions (without correct_answer — RLS hides it)
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['challenge-questions', challengeId],
    queryFn: async () => {
      if (!challenge?.question_ids?.length) return [];
      const { data } = await supabase
        .from('assessment_questions')
        .select('id, question_text, question_type, options, scenario_context, difficulty, bloom_level')
        .in('id', challenge.question_ids);

      // Sort by the order in question_ids
      const orderMap = new Map(challenge.question_ids.map((id, i) => [id, i]));
      return (data || []).sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)) as QuestionData[];
    },
    enabled: !!challenge?.question_ids?.length,
  });

  // Load already-answered questions for this user
  const { data: existingAnswers } = useQuery({
    queryKey: ['challenge-my-answers', challengeId, currentUser],
    queryFn: async () => {
      if (!challengeId || !currentUser) return [];
      const { data } = await supabase
        .from('challenge_answers')
        .select('question_id')
        .eq('challenge_id', challengeId)
        .eq('user_id', currentUser);
      return (data || []).map(a => a.question_id);
    },
    enabled: !!challengeId && !!currentUser,
  });

  // Load opponent profile
  const opponentId = challenge && currentUser
    ? (challenge.challenger_id === currentUser ? challenge.challenged_id : challenge.challenger_id)
    : null;

  const { data: profiles } = useQuery({
    queryKey: ['challenge-profiles', challenge?.challenger_id, challenge?.challenged_id],
    queryFn: async () => {
      if (!challenge) return {};
      const { data } = await supabase
        .from('profiles_minimal')
        .select('user_id, full_name, avatar_url')
        .in('user_id', [challenge.challenger_id, challenge.challenged_id]);
      const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      (data || []).forEach(p => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!challenge,
  });

  // Initialize answered set from existing answers
  useEffect(() => {
    if (existingAnswers?.length) {
      setAnsweredIds(new Set(existingAnswers));
      // Jump to first unanswered
      if (questions.length > 0) {
        const first = questions.findIndex(q => !existingAnswers.includes(q.id));
        if (first >= 0) setCurrentIndex(first);
        else setCurrentIndex(questions.length); // all done
      }
    }
  }, [existingAnswers, questions]);

  // Timer
  useEffect(() => {
    if (feedback) return;
    const timer = setInterval(() => setTimeElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [feedback, currentIndex]);

  const isChallenger = challenge?.challenger_id === currentUser;
  const myScore = isChallenger ? challenge?.challenger_score : challenge?.challenged_score;
  const theirScore = isChallenger ? challenge?.challenged_score : challenge?.challenger_score;
  const myCompleted = isChallenger ? challenge?.challenger_completed : challenge?.challenged_completed;
  const currentQuestion = questions[currentIndex];

  const handleSubmit = useCallback(async () => {
    if (!currentQuestion || !challengeId || !answer.trim()) return;

    const options = (currentQuestion.options as any[]) || [];
    const selectedOptionIndex = currentQuestion.question_type === 'mcq'
      ? options.findIndex((opt: any) => {
          const text = typeof opt === 'string' ? opt : opt?.text;
          return text === answer;
        })
      : undefined;

    try {
      const result = await submitAnswer.mutateAsync({
        challengeId,
        questionId: currentQuestion.id,
        userAnswer: answer,
        timeTakenSeconds: timeElapsed,
        selectedOptionIndex: selectedOptionIndex !== undefined && selectedOptionIndex >= 0
          ? selectedOptionIndex
          : undefined,
      });

      setFeedback({ isCorrect: result.is_correct });
      setAnsweredIds(prev => new Set([...prev, currentQuestion.id]));
    } catch {
      // Error handled by hook toast
    }
  }, [currentQuestion, challengeId, answer, timeElapsed, submitAnswer]);

  const handleNext = () => {
    setFeedback(null);
    setAnswer('');
    setTimeElapsed(0);
    setCurrentIndex(prev => prev + 1);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (challengeLoading || questionsLoading) {
    return (
      <AppShell>
        <PageContainer>
          <LoadingState message="Loading challenge..." />
        </PageContainer>
      </AppShell>
    );
  }

  if (!challenge) {
    return (
      <AppShell>
        <PageContainer>
          <div className="text-center py-12">
            <p className="text-destructive mb-4">Challenge not found</p>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  const myProfile = currentUser ? profiles?.[currentUser] : null;
  const opponentProfile = opponentId ? profiles?.[opponentId] : null;
  const totalQuestions = questions.length;
  const isCompleted = challenge.status === 'completed';
  const iFinished = myCompleted || currentIndex >= totalQuestions;

  // ─── Completed State ─────────────────────────────────────────────
  if (isCompleted || (iFinished && challenge.status !== 'active')) {
    const won = challenge.winner_id === currentUser;
    const tied = !challenge.winner_id && isCompleted;

    return (
      <AppShell>
        <PageContainer>
          <div className="max-w-lg mx-auto space-y-6 pt-8">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            <Card className="text-center">
              <CardContent className="pt-8 pb-8 space-y-6">
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${
                  won ? 'bg-yellow-500/15' : tied ? 'bg-muted' : 'bg-destructive/10'
                }`}>
                  {won ? <Trophy className="h-10 w-10 text-yellow-500" /> :
                   tied ? <Users className="h-10 w-10 text-muted-foreground" /> :
                   <XCircle className="h-10 w-10 text-destructive" />}
                </div>

                <div>
                  <h2 className="text-2xl font-bold">
                    {won ? 'Victory!' : tied ? "It's a Draw!" : 'Defeat'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {won ? 'You earned 25 XP!' : tied ? 'Both players earned 10 XP' : 'Better luck next time!'}
                  </p>
                </div>

                {/* Score comparison */}
                <div className="flex items-center justify-center gap-8">
                  <ScoreColumn
                    name={myProfile?.full_name ?? 'You'}
                    avatar={myProfile?.avatar_url}
                    score={myScore ?? 0}
                    isWinner={won}
                    label="You"
                  />
                  <span className="text-2xl font-bold text-muted-foreground">vs</span>
                  <ScoreColumn
                    name={opponentProfile?.full_name ?? 'Opponent'}
                    avatar={opponentProfile?.avatar_url}
                    score={theirScore ?? 0}
                    isWinner={challenge.winner_id === opponentId}
                    label=""
                  />
                </div>

                <Button onClick={() => navigate(-1)} className="w-full">
                  Back to Course
                </Button>
              </CardContent>
            </Card>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  // ─── Waiting for Opponent ─────────────────────────────────────────
  if (iFinished) {
    return (
      <AppShell>
        <PageContainer>
          <div className="max-w-lg mx-auto space-y-6 pt-8">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            <Card className="text-center">
              <CardContent className="pt-8 pb-8 space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Waiting for Opponent</h2>
                <p className="text-sm text-muted-foreground">
                  You've finished! Your score: <strong>{myScore}/{totalQuestions}</strong>.
                  Waiting for {opponentProfile?.full_name ?? 'your opponent'} to complete...
                </p>
                <div className="flex items-center justify-center gap-6 pt-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{myScore}</p>
                    <p className="text-xs text-muted-foreground">You</p>
                  </div>
                  <Swords className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{theirScore}</p>
                    <p className="text-xs text-muted-foreground">{opponentProfile?.full_name ?? 'Opponent'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  // ─── Active Question ──────────────────────────────────────────────
  const options = (currentQuestion?.options as any[]) || [];
  const optionTexts = options.map((opt: any) => typeof opt === 'string' ? opt : opt?.text ?? '');
  const progressPercent = (answeredIds.size / totalQuestions) * 100;

  return (
    <AppShell>
      <PageContainer>
        <div className="max-w-2xl mx-auto space-y-4 pt-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-bold text-primary">{myScore}</span>
                <span className="text-muted-foreground">-</span>
                <span className="font-bold text-muted-foreground">{theirScore}</span>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Question {currentIndex + 1} of {totalQuestions}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(timeElapsed)}
              </span>
            </div>
            <Progress value={progressPercent} className="h-1.5 [&>div]:bg-primary" />
          </div>

          {/* Question Card */}
          {currentQuestion && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    <Swords className="h-3 w-3 mr-1" /> Duel
                  </Badge>
                  {currentQuestion.difficulty && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {currentQuestion.difficulty}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {currentQuestion.scenario_context && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm italic">
                    {currentQuestion.scenario_context}
                  </div>
                )}

                <p className="text-base font-medium leading-relaxed">
                  {currentQuestion.question_text}
                </p>

                {!feedback ? (
                  <>
                    {currentQuestion.question_type === 'mcq' && optionTexts.length > 0 && (
                      <RadioGroup value={answer} onValueChange={setAnswer} className="space-y-2.5">
                        {optionTexts.map((text, i) => (
                          <div
                            key={i}
                            className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/10 transition-colors cursor-pointer"
                            onClick={() => setAnswer(text)}
                          >
                            <RadioGroupItem value={text} id={`opt-${i}`} />
                            <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer text-sm">
                              {text}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {currentQuestion.question_type === 'true_false' && (
                      <RadioGroup value={answer} onValueChange={setAnswer} className="space-y-2.5">
                        {['True', 'False'].map(opt => (
                          <div
                            key={opt}
                            className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/10 transition-colors cursor-pointer"
                            onClick={() => setAnswer(opt)}
                          >
                            <RadioGroupItem value={opt} id={opt} />
                            <Label htmlFor={opt} className="flex-1 cursor-pointer text-sm">{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {currentQuestion.question_type === 'short_answer' && (
                      <Textarea
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        placeholder="Type your answer..."
                        className="min-h-[100px] text-sm"
                      />
                    )}

                    <Button
                      onClick={handleSubmit}
                      disabled={!answer.trim() || submitAnswer.isPending}
                      className="w-full"
                    >
                      {submitAnswer.isPending ? 'Submitting...' : 'Submit Answer'}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg flex items-center gap-3 ${
                      feedback.isCorrect
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {feedback.isCorrect
                        ? <CheckCircle className="h-6 w-6" />
                        : <XCircle className="h-6 w-6" />}
                      <div>
                        <p className="font-semibold">
                          {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
                        </p>
                        <p className="text-sm opacity-80">
                          {feedback.isCorrect ? '+1 point' : 'No points'}
                        </p>
                      </div>
                    </div>

                    <Button onClick={handleNext} className="w-full">
                      {currentIndex + 1 < totalQuestions ? 'Next Question' : 'See Results'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}

// ─── Helper Component ──────────────────────────────────────────────

function ScoreColumn({ name, avatar, score, isWinner, label }: {
  name: string;
  avatar: string | null | undefined;
  score: number;
  isWinner: boolean;
  label: string;
}) {
  return (
    <div className="text-center space-y-2">
      <Avatar className={`h-14 w-14 mx-auto ${isWinner ? 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-background' : ''}`}>
        <AvatarImage src={avatar ?? undefined} />
        <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium truncate max-w-[100px]">{name}</p>
        {label && <p className="text-[10px] text-muted-foreground">{label}</p>}
      </div>
      <p className={`text-3xl font-bold ${isWinner ? 'text-yellow-500' : 'text-foreground'}`}>
        {score}
      </p>
    </div>
  );
}
