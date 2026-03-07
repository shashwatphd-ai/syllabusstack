
-- 1. Challenge status enum
CREATE TYPE public.challenge_status AS ENUM ('pending', 'active', 'completed', 'expired', 'declined');

-- 2. Quiz challenges table
CREATE TABLE public.quiz_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  learning_objective_id uuid NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_ids uuid[] NOT NULL,
  status public.challenge_status NOT NULL DEFAULT 'pending',
  challenger_score int NOT NULL DEFAULT 0,
  challenged_score int NOT NULL DEFAULT 0,
  challenger_completed boolean NOT NULL DEFAULT false,
  challenged_completed boolean NOT NULL DEFAULT false,
  winner_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- 3. Challenge answers table
CREATE TABLE public.challenge_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.quiz_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  user_answer text NOT NULL,
  is_correct boolean NOT NULL,
  time_taken_seconds int,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id, question_id)
);

-- 4. Community explanations table
CREATE TABLE public.community_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  explanation_text text NOT NULL,
  votes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(question_id, user_id)
);

-- 5. Explanation votes table
CREATE TABLE public.explanation_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  explanation_id uuid NOT NULL REFERENCES public.community_explanations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote int NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(explanation_id, user_id)
);

-- 6. RLS on all tables
ALTER TABLE public.quiz_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explanation_votes ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for quiz_challenges
CREATE POLICY "Enrolled students can view challenges in their course"
  ON public.quiz_challenges FOR SELECT TO authenticated
  USING (public.is_enrolled_student(auth.uid(), course_id));

CREATE POLICY "Enrolled students can create challenges"
  ON public.quiz_challenges FOR INSERT TO authenticated
  WITH CHECK (
    challenger_id = auth.uid()
    AND public.is_enrolled_student(auth.uid(), course_id)
    AND public.is_enrolled_student(challenged_id, course_id)
  );

CREATE POLICY "Challenged user can respond to challenge"
  ON public.quiz_challenges FOR UPDATE TO authenticated
  USING (challenged_id = auth.uid() AND status = 'pending')
  WITH CHECK (challenged_id = auth.uid());

-- 8. RLS policies for challenge_answers
CREATE POLICY "Participants can view answers after both complete"
  ON public.challenge_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_challenges qc
      WHERE qc.id = challenge_id
        AND (qc.challenger_id = auth.uid() OR qc.challenged_id = auth.uid())
        AND qc.status = 'completed'
    )
  );

CREATE POLICY "Participants can view own answers during challenge"
  ON public.challenge_answers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No direct INSERT policy — inserts happen via evaluate_challenge_answer SECURITY DEFINER

-- 9. RLS policies for community_explanations
CREATE POLICY "Enrolled students can view explanations"
  ON public.community_explanations FOR SELECT TO authenticated
  USING (public.is_enrolled_student(auth.uid(), course_id));

CREATE POLICY "Enrolled students can post explanations"
  ON public.community_explanations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_enrolled_student(auth.uid(), course_id)
  );

CREATE POLICY "Authors can update own explanations"
  ON public.community_explanations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 10. RLS policies for explanation_votes
CREATE POLICY "Enrolled students can view votes"
  ON public.explanation_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_explanations ce
      WHERE ce.id = explanation_id
        AND public.is_enrolled_student(auth.uid(), ce.course_id)
    )
  );

CREATE POLICY "Enrolled students can vote"
  ON public.explanation_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_explanations ce
      WHERE ce.id = explanation_id
        AND public.is_enrolled_student(auth.uid(), ce.course_id)
    )
  );

CREATE POLICY "Users can update own votes"
  ON public.explanation_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own votes"
  ON public.explanation_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 11. Vote count trigger (mirrors update_suggestion_votes)
CREATE OR REPLACE FUNCTION public.update_explanation_vote_count()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_explanations SET votes = votes + NEW.vote, updated_at = now() WHERE id = NEW.explanation_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.community_explanations SET votes = votes - OLD.vote + NEW.vote, updated_at = now() WHERE id = NEW.explanation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_explanations SET votes = votes - OLD.vote, updated_at = now() WHERE id = OLD.explanation_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_explanation_votes
  AFTER INSERT OR UPDATE OR DELETE ON public.explanation_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_explanation_vote_count();

-- 12. evaluate_challenge_answer SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.evaluate_challenge_answer(
  p_challenge_id uuid,
  p_question_id uuid,
  p_user_answer text,
  p_time_taken_seconds int DEFAULT NULL,
  p_selected_option_index int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_challenge RECORD;
  v_question RECORD;
  v_is_correct boolean := false;
  v_correct_index int;
  v_user_is_challenger boolean;
  v_answers_count int;
  v_total_questions int;
  v_opponent_completed boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get challenge and verify participation + active status
  SELECT * INTO v_challenge
  FROM public.quiz_challenges
  WHERE id = p_challenge_id AND status = 'active'
    AND (challenger_id = v_user_id OR challenged_id = v_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found or not active';
  END IF;

  -- Verify question is part of this challenge
  IF NOT (p_question_id = ANY(v_challenge.question_ids)) THEN
    RAISE EXCEPTION 'Question not part of this challenge';
  END IF;

  -- Check for duplicate answer
  IF EXISTS (
    SELECT 1 FROM public.challenge_answers
    WHERE challenge_id = p_challenge_id AND user_id = v_user_id AND question_id = p_question_id
  ) THEN
    RAISE EXCEPTION 'Already answered this question';
  END IF;

  v_user_is_challenger := (v_user_id = v_challenge.challenger_id);

  -- Get correct answer from assessment_questions (hidden from client)
  SELECT * INTO v_question
  FROM public.assessment_questions
  WHERE id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  -- Evaluate correctness (same pattern as validate_micro_check_answer)
  IF v_question.question_type = 'mcq' AND p_selected_option_index IS NOT NULL THEN
    SELECT idx - 1 INTO v_correct_index
    FROM jsonb_array_elements(v_question.options) WITH ORDINALITY AS arr(opt, idx)
    WHERE (opt->>'is_correct')::boolean = true
    LIMIT 1;
    v_is_correct := (p_selected_option_index = v_correct_index);
  ELSIF v_question.correct_answer IS NOT NULL THEN
    v_is_correct := LOWER(TRIM(p_user_answer)) = LOWER(TRIM(v_question.correct_answer));
  ELSE
    -- Check accepted_answers array
    IF v_question.accepted_answers IS NOT NULL THEN
      v_is_correct := LOWER(TRIM(p_user_answer)) = ANY(
        SELECT LOWER(TRIM(a)) FROM unnest(v_question.accepted_answers) a
      );
    END IF;
  END IF;

  -- Insert answer
  INSERT INTO public.challenge_answers (challenge_id, user_id, question_id, user_answer, is_correct, time_taken_seconds)
  VALUES (p_challenge_id, v_user_id, p_question_id, COALESCE(p_user_answer, p_selected_option_index::text), v_is_correct, p_time_taken_seconds);

  -- Update score
  IF v_is_correct THEN
    IF v_user_is_challenger THEN
      UPDATE public.quiz_challenges SET challenger_score = challenger_score + 1 WHERE id = p_challenge_id;
    ELSE
      UPDATE public.quiz_challenges SET challenged_score = challenged_score + 1 WHERE id = p_challenge_id;
    END IF;
  END IF;

  -- Check if this user completed all questions
  v_total_questions := array_length(v_challenge.question_ids, 1);
  SELECT COUNT(*) INTO v_answers_count
  FROM public.challenge_answers
  WHERE challenge_id = p_challenge_id AND user_id = v_user_id;

  IF v_answers_count >= v_total_questions THEN
    -- Mark this user as completed
    IF v_user_is_challenger THEN
      UPDATE public.quiz_challenges SET challenger_completed = true WHERE id = p_challenge_id;
      v_opponent_completed := v_challenge.challenged_completed;
    ELSE
      UPDATE public.quiz_challenges SET challenged_completed = true WHERE id = p_challenge_id;
      v_opponent_completed := v_challenge.challenger_completed;
    END IF;

    -- If both completed, finalize challenge
    IF v_opponent_completed THEN
      DECLARE
        v_final RECORD;
        v_winner uuid;
      BEGIN
        SELECT * INTO v_final FROM public.quiz_challenges WHERE id = p_challenge_id;

        IF v_final.challenger_score > v_final.challenged_score THEN
          v_winner := v_final.challenger_id;
        ELSIF v_final.challenged_score > v_final.challenger_score THEN
          v_winner := v_final.challenged_id;
        ELSE
          v_winner := NULL; -- tie
        END IF;

        UPDATE public.quiz_challenges
        SET status = 'completed', winner_id = v_winner, completed_at = now()
        WHERE id = p_challenge_id;

        -- Award XP to winner (25 XP), or 10 each for a tie
        IF v_winner IS NOT NULL THEN
          PERFORM public.award_xp(v_winner, 25);
        ELSE
          PERFORM public.award_xp(v_final.challenger_id, 10);
          PERFORM public.award_xp(v_final.challenged_id, 10);
        END IF;
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object('is_correct', v_is_correct);
END;
$$;

-- 13. Enable realtime for quiz_challenges
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_challenges;

-- 14. Indexes for performance
CREATE INDEX idx_quiz_challenges_course ON public.quiz_challenges(course_id);
CREATE INDEX idx_quiz_challenges_participants ON public.quiz_challenges(challenger_id, challenged_id);
CREATE INDEX idx_quiz_challenges_status ON public.quiz_challenges(status);
CREATE INDEX idx_challenge_answers_challenge ON public.challenge_answers(challenge_id);
CREATE INDEX idx_community_explanations_question ON public.community_explanations(question_id);
CREATE INDEX idx_community_explanations_course ON public.community_explanations(course_id);
CREATE INDEX idx_explanation_votes_explanation ON public.explanation_votes(explanation_id);
