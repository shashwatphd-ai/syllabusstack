-- Step 1: Create a student-safe view that hides correct answers
CREATE OR REPLACE VIEW public.micro_checks_student
WITH (security_invoker = on) AS
SELECT 
  id,
  content_id,
  trigger_time_seconds,
  question_text,
  question_type,
  -- Strip is_correct from options array - students see choices but not which is correct
  CASE 
    WHEN options IS NOT NULL THEN (
      SELECT jsonb_agg(
        jsonb_build_object('text', opt->>'text')
      )
      FROM jsonb_array_elements(options) AS opt
    )
    ELSE NULL 
  END AS options,
  rewind_target_seconds,
  time_limit_seconds,
  created_at
  -- EXCLUDES: correct_answer, created_by
FROM public.micro_checks;

-- Step 2: Drop the overly permissive policy that exposes everything
DROP POLICY IF EXISTS "Anyone can view micro-checks" ON public.micro_checks;

-- Step 3: Ensure only creators/admins/instructors can directly access the base table
-- Keep existing policies but deny student direct access to base table
-- Students will use the view instead

-- Step 4: Create RLS policy on the view for enrolled students during consumption
-- Views with security_invoker inherit the calling user's permissions
-- We need to grant SELECT on the view and create a policy

-- Grant select on the view to authenticated users
GRANT SELECT ON public.micro_checks_student TO authenticated;

-- Step 5: Create a secure function for answer validation (server-side only)
CREATE OR REPLACE FUNCTION public.validate_micro_check_answer(
  p_micro_check_id uuid,
  p_user_answer text,
  p_selected_option_index integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_micro_check RECORD;
  v_is_correct boolean := false;
  v_consumption_record_id uuid;
  v_attempt_number integer;
  v_correct_index integer;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the micro-check (includes correct_answer, only accessible via this SECURITY DEFINER function)
  SELECT * INTO v_micro_check
  FROM public.micro_checks
  WHERE id = p_micro_check_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Micro-check not found';
  END IF;

  -- Verify user has an active consumption record for this content
  SELECT id INTO v_consumption_record_id
  FROM public.consumption_records
  WHERE user_id = auth.uid()
    AND content_id = v_micro_check.content_id
    AND started_at IS NOT NULL
    AND completed_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_consumption_record_id IS NULL THEN
    RAISE EXCEPTION 'No active consumption session for this content';
  END IF;

  -- Calculate attempt number
  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_number
  FROM public.micro_check_results
  WHERE consumption_record_id = v_consumption_record_id
    AND micro_check_id = p_micro_check_id;

  -- Validate the answer based on question type
  IF v_micro_check.question_type = 'mcq' THEN
    -- Find the correct option index
    SELECT idx - 1 INTO v_correct_index
    FROM jsonb_array_elements(v_micro_check.options) WITH ORDINALITY AS arr(opt, idx)
    WHERE (opt->>'is_correct')::boolean = true
    LIMIT 1;

    v_is_correct := (p_selected_option_index = v_correct_index);
  ELSE
    -- Recall question - case-insensitive comparison
    v_is_correct := LOWER(TRIM(p_user_answer)) = LOWER(TRIM(v_micro_check.correct_answer));
  END IF;

  -- Record the result
  INSERT INTO public.micro_check_results (
    consumption_record_id,
    micro_check_id,
    user_answer,
    is_correct,
    attempt_number
  ) VALUES (
    v_consumption_record_id,
    p_micro_check_id,
    COALESCE(p_user_answer, p_selected_option_index::text),
    v_is_correct,
    v_attempt_number
  );

  -- Return result (never expose the correct answer)
  RETURN jsonb_build_object(
    'is_correct', v_is_correct,
    'attempt_number', v_attempt_number,
    'rewind_target_seconds', v_micro_check.rewind_target_seconds,
    'trigger_time_seconds', v_micro_check.trigger_time_seconds
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_micro_check_answer(uuid, text, integer) TO authenticated;