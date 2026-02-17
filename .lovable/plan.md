

## Fix Progress Tracking Disconnect

### Problem

The student completed content and passed micro-checks (state = `verified`, badge = "Content Verified"), but the course detail page shows "0 completed" because the `isComplete()` function only counts the `passed` state (assessment passed). This creates a confusing experience where the student sees a green checkmark but 0% progress.

### Root Cause

Two disconnected definitions of "done" exist in the system:

```text
State Machine (frontend):
  unstarted -> in_progress -> verified -> assessment_unlocked -> passed
                                                                  ^
                                                          only this = "complete"

DB Trigger (backend):
  consumption_records.is_verified = true  ->  updates course_enrollments.overall_progress
  (tracks content consumption, not assessment)
```

The course detail page uses `isComplete()` from the state machine, which only returns `true` for `passed`. Meanwhile, the enrollment progress trigger looks at `consumption_records.is_verified`, which is yet another metric. Neither recognizes `verified` as meaningful progress.

### Impact Chain

| Where | What Shows | Source | Current Behavior |
|-------|-----------|--------|-----------------|
| Course Detail page (student) | "X completed" per module | `isComplete(verification_state)` | Only counts `passed` |
| Course Progress bar (student) | "X of Y completed" | Same `isComplete()` | Only counts `passed` |
| Enrollment record (DB) | `overall_progress` | `update_enrollment_progress()` trigger using `is_verified` | Counts verified consumption records |
| Instructor dashboard | Student progress % | `course_enrollments.overall_progress` | Shows trigger-based % |

### Solution: Weighted Progress Model

Instead of binary "complete or not", show progress that reflects the student's actual advancement through the pipeline. This keeps the state machine intact while giving credit for intermediate steps.

#### Step 1: Add `getProgressWeight()` to verification-state-machine.ts

Assign fractional credit to each state:

| State | Weight | Rationale |
|-------|--------|-----------|
| unstarted | 0 | No engagement |
| in_progress | 0.25 | Started watching |
| verified | 0.5 | Content completed, micro-checks passed |
| assessment_unlocked | 0.5 | Same as verified (ready for quiz) |
| passed | 1.0 | Full mastery demonstrated |
| remediation_required | 0.25 | Needs review, back to partial |

#### Step 2: Update StudentCourseDetail.tsx progress calculation

Replace the binary `isComplete()` filter with weighted progress:

- Module subtitle changes from "X completed" to a more accurate label like "X of Y mastered" for `passed` count, but the progress bar fills proportionally based on weights
- Overall progress bar uses weighted average across all LOs
- Module-level progress bars use weighted average for that module's LOs

#### Step 3: Update the module completion label

Show two signals:
- Progress bar fills based on weighted state (so `verified` shows 50% filled)
- Text shows "X mastered" (only `passed` count) to maintain clarity about what "done" means

This way the student sees visual progress for watching content and verifying, but the text is honest that mastery requires passing the assessment.

#### Step 4: Align the DB trigger with the state machine

Update `update_enrollment_progress()` to also use weighted progress based on `verification_state` instead of just `is_verified`. This ensures the instructor dashboard shows the same progress the student sees.

```sql
-- New logic: weight by verification_state
SELECT SUM(
  CASE lo.verification_state
    WHEN 'passed' THEN 1.0
    WHEN 'verified' THEN 0.5
    WHEN 'assessment_unlocked' THEN 0.5
    WHEN 'in_progress' THEN 0.25
    WHEN 'remediation_required' THEN 0.25
    ELSE 0
  END
) / COUNT(*)::NUMERIC * 100
INTO v_progress
FROM learning_objectives lo
WHERE lo.instructor_course_id = v_course_id;
```

### Files Modified

| File | Change |
|------|--------|
| `src/lib/verification-state-machine.ts` | Add `getProgressWeight(state)` function |
| `src/pages/student/StudentCourseDetail.tsx` | Use weighted progress for bars, show "X mastered" in text |
| `supabase/migrations/` | Update `update_enrollment_progress()` trigger to use weighted states |

### What Stays The Same

- The state machine transitions (unstarted -> in_progress -> verified -> passed) are unchanged
- The `isComplete()` function still returns true only for `passed` (used elsewhere for assessment gating)
- Video player, micro-checks, assessment flow -- all untouched
- The LearningObjective.tsx page pipeline display -- untouched

### Instructor Impact

After this change, the instructor dashboard will show proportional progress (e.g., a student at `verified` for 1 of 17 LOs would show ~3% instead of 0%), which is more accurate and actionable for the instructor.

