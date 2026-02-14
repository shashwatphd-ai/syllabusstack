
-- Phase 1: Expand question type constraint to include true_false
ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_question_type_check;
ALTER TABLE assessment_questions ADD CONSTRAINT assessment_questions_question_type_check 
  CHECK (question_type = ANY (ARRAY['mcq', 'short_answer', 'true_false']));
