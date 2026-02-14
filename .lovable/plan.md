

## Complete the Instructor-to-Student Assessment Flow

### Problem Identified
The "Generate Qs" button runs successfully, but **zero questions are saved to the database** due to a mismatch between what the AI generates and what the database accepts:

- **AI generates**: `multiple_choice`, `true_false`, `short_answer`
- **DB constraint allows**: `mcq`, `short_answer` only

This is the root cause of why the quiz generation appeared to succeed (toast showed "Created 7 questions") but nothing is actually available for students.

### Plan Overview

**Phase 1: Fix the question generation pipeline (critical)**
**Phase 2: Add instructor question preview**
**Phase 3: Improve student assessment discoverability**

---

### Phase 1: Fix Question Generation (Broken Pipeline)

1. **Update the edge function** `generate-assessment-questions/index.ts`:
   - Change the AI schema enum from `["multiple_choice", "short_answer", "true_false"]` to match DB values
   - Add a mapping layer that normalizes `multiple_choice` to `mcq` and `true_false` to `mcq` (with True/False as the two options) before inserting
   - This ensures any AI output is safely mapped to valid DB values

2. **Expand the DB constraint** to also accept `true_false` as a valid question type:
   - Migration: `ALTER TABLE assessment_questions DROP CONSTRAINT assessment_questions_question_type_check; ALTER TABLE assessment_questions ADD CONSTRAINT assessment_questions_question_type_check CHECK (question_type = ANY (ARRAY['mcq', 'short_answer', 'true_false']));`

### Phase 2: Instructor Question Preview

Currently after generating questions, the instructor has no way to see what was created. Add:

1. **Question count badge** on each LO in `ModuleCard.tsx` -- show "5 Qs" badge when questions exist (using the existing `useAssessmentQuestions` hook)
2. **Expandable question list** -- clicking the badge or a "View Questions" button shows the generated questions inline with correct answers highlighted
3. This gives instructors confidence that the quiz content is appropriate before students see it

### Phase 3: Student Assessment Discoverability

The current flow requires students to:
1. Watch content until `verification_state` becomes `verified`
2. Then see the "Start Assessment" CTA on the LO page
3. Navigate to `/learn/objective/:loId/assess`

Improvements:
1. **Show assessment availability earlier** -- on the `StudentCourseDetail` page, add a small icon/badge on LOs that have assessment questions available, even if the student hasn't unlocked them yet (motivates content completion)
2. **Assessment CTA for all unlocked states** -- currently only `verified` shows the CTA. Update `LearningObjective.tsx` to also show it for `assessment_unlocked`, `passed`, and `remediation_required` states (the `passed` state should show "Retake" or "View Results" instead)
3. **"No questions yet" graceful handling** -- the `AssessmentSession` already handles this with a "Not Ready Yet" screen, which is good

---

### Technical Details

**Edge function fix** (Phase 1 -- most critical):
```text
In generate-assessment-questions/index.ts:
- Line 31: Change enum to ["mcq", "short_answer", "true_false"]
- Lines 247-261: Add normalization before insert:
  question_type: q.question_type === 'multiple_choice' ? 'mcq' : q.question_type
```

**DB migration** (Phase 1):
```text
ALTER TABLE assessment_questions 
  DROP CONSTRAINT assessment_questions_question_type_check;
ALTER TABLE assessment_questions 
  ADD CONSTRAINT assessment_questions_question_type_check 
  CHECK (question_type = ANY (ARRAY['mcq', 'short_answer', 'true_false']));
```

**ModuleCard.tsx** (Phase 2):
- Fetch question counts per LO using a lightweight query
- Display badge: "5 Qs" next to existing bloom level badges
- Add collapsible section to preview questions

**LearningObjective.tsx** (Phase 3):
- Lines 388-406: Expand the assessment CTA condition from just `verified` to include all assessment-eligible states
- Add a "quiz available" indicator badge on the LO header when questions exist

**QuestionCard.tsx** -- already handles `mcq`, `true_false`, and `short_answer` correctly, so no changes needed there.

