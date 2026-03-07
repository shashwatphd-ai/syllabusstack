

## Community-Based Interactive Learning — Detailed Implementation Plan

### Architecture Overview

```text
Existing Pipeline (untouched)                    New Community Layer
┌──────────────────────────────┐    ┌─────────────────────────────────────┐
│ assessment_questions         │◄───┤ quiz_challenges (reuses questions)  │
│ assessment_sessions          │    │ challenge_answers                   │
│ start-assessment (edge fn)   │    │ evaluate_challenge_answer (db fn)   │
│ submit-assessment-answer     │    ├─────────────────────────────────────┤
│ complete-assessment          │    │ community_explanations              │
│ course_enrollments           │◄───┤ explanation_votes                   │
│ profiles_minimal (view)      │◄───┤ (joined for leaderboard + names)   │
│ award_xp() (db fn)           │◄───┤ (called on challenge win)          │
└──────────────────────────────┘    └─────────────────────────────────────┘
```

### Phase 1 Scope

Three features, all additive — zero changes to existing tables/functions:

1. **Course Leaderboard** — No new tables. Aggregates existing `assessment_sessions` data.
2. **Challenge Mode** — 2 new tables + 1 SECURITY DEFINER function.
3. **Peer Explanations** — 2 new tables + 1 vote-count trigger (mirrors `suggestion_votes` pattern).

---

### Database Changes (1 migration)

**New enum:**
- `challenge_status` — `pending | active | completed | expired | declined`

**New tables:**

| Table | Key Columns | Notes |
|---|---|---|
| `quiz_challenges` | `id, course_id (FK→instructor_courses), learning_objective_id (FK→learning_objectives), challenger_id, challenged_id, question_ids (uuid[]), status (challenge_status), challenger_score, challenged_score, challenger_completed, challenged_completed, winner_id, created_at, completed_at, expires_at` | `course_id` enables efficient enrollment-scoped RLS |
| `challenge_answers` | `id, challenge_id (FK→quiz_challenges), user_id, question_id (FK→assessment_questions), user_answer, is_correct, time_taken_seconds, answered_at` | UNIQUE(challenge_id, user_id, question_id) |
| `community_explanations` | `id, course_id (FK→instructor_courses), question_id (FK→assessment_questions), user_id, explanation_text, votes (default 0), created_at, updated_at` | UNIQUE(question_id, user_id) |
| `explanation_votes` | `id, explanation_id (FK→community_explanations), user_id, vote (CHECK -1 or 1), created_at` | UNIQUE(explanation_id, user_id) |

**New SECURITY DEFINER function — `evaluate_challenge_answer`:**
- Takes `(p_challenge_id, p_question_id, p_user_answer, p_time_taken)`
- Verifies caller is a participant and challenge is `active`
- Looks up `correct_answer` from `assessment_questions` (hidden from client)
- Handles MCQ via option index matching (same pattern as `validate_micro_check_answer`)
- Inserts into `challenge_answers`, updates score on parent
- When both players complete all questions → sets `winner_id`, updates status to `completed`, calls `award_xp()` for winner (25 XP)
- Returns `{is_correct: boolean}` — never exposes the answer

**New trigger — `update_explanation_votes`:**
- Mirrors existing `update_suggestion_votes()` — on INSERT/UPDATE/DELETE of `explanation_votes`, updates `community_explanations.votes`

**Realtime:**
- `ALTER PUBLICATION supabase_realtime ADD TABLE quiz_challenges` — enables live duel status updates

**RLS policies (all tables):**
- All use `is_enrolled_student(auth.uid(), course_id)` for enrollment scoping
- `quiz_challenges`: participants can SELECT own challenges; challenger can INSERT; challenged can UPDATE status (accept/decline)
- `challenge_answers`: participants can SELECT after both complete; own user can INSERT
- `community_explanations`: enrolled students SELECT; author INSERT/UPDATE own
- `explanation_votes`: enrolled students SELECT; own user INSERT/UPDATE/DELETE

---

### UI Components

**1. Community Tab on `StudentCourseDetail.tsx`**
- Add Tabs component wrapping existing modules content + new "Community" tab
- Community tab contains `CourseLeaderboard` and challenge list

**2. `src/components/community/CourseLeaderboard.tsx`**
- Queries `assessment_sessions` aggregated by user: `SUM(total_score * passed::int) / COUNT(*)` grouped by `user_id`
- Joins `learning_objectives` → `instructor_courses` to scope to current course
- Joins `profiles_minimal` for name + avatar
- Shows top 10 + current user's rank
- Weekly/all-time toggle (filter by `completed_at`)

**3. `src/components/community/ChallengeCard.tsx`**
- **Create flow**: Student picks an LO → sees list of enrolled classmates (query `course_enrollments` excluding self, join `profiles_minimal`) → sends challenge
- Client selects 5 random question IDs from `assessment_questions` for that LO (IDs only, not answers)
- **Duel flow**: Realtime subscription on `quiz_challenges` filtered by challenge ID → both students answer sequentially → each answer calls `evaluate_challenge_answer` RPC → live score updates
- **Results**: Side-by-side score comparison after both complete

**4. `src/components/community/PeerExplanation.tsx`**
- Shown on `AssessmentResults.tsx` after quiz completion
- For questions answered correctly: "Explain this to help classmates" button → text input → INSERT into `community_explanations`
- For questions answered incorrectly: "See peer tips" → shows top-voted explanations for that question
- Upvote/downvote buttons (mirrors existing `suggestion_votes` UI pattern)

**5. `src/components/community/ClassmateSelector.tsx`**
- Dropdown/list of enrolled students for challenge targeting
- Queries `course_enrollments` WHERE `instructor_course_id = courseId` AND `student_id != auth.uid()`, joined with `profiles_minimal`

---

### Hooks

**`src/hooks/useCommunity.ts`**
- `useCourseLeaderboard(courseId)` — aggregation query
- `usePendingChallenges(courseId)` — challenges where user is challenged_id and status = pending
- `useActiveChallenge(challengeId)` — single challenge with realtime subscription
- `useCreateChallenge()` — mutation: INSERT into quiz_challenges
- `useRespondToChallenge()` — mutation: UPDATE status to active/declined
- `useSubmitChallengeAnswer()` — mutation: RPC `evaluate_challenge_answer`
- `usePeerExplanations(questionId)` — SELECT explanations ordered by votes
- `usePostExplanation()` — mutation: INSERT into community_explanations
- `useVoteExplanation()` — mutation: UPSERT into explanation_votes

---

### Files Summary

| File | Action |
|---|---|
| Migration SQL | Create — enum, 4 tables, RLS, trigger, `evaluate_challenge_answer` function, realtime |
| `src/pages/student/StudentCourseDetail.tsx` | Modify — wrap content in Tabs, add Community tab |
| `src/components/community/CourseLeaderboard.tsx` | Create |
| `src/components/community/ChallengeCard.tsx` | Create |
| `src/components/community/ChallengeSession.tsx` | Create — live duel answering UI (reuses QuestionCard) |
| `src/components/community/PeerExplanation.tsx` | Create |
| `src/components/community/ClassmateSelector.tsx` | Create |
| `src/hooks/useCommunity.ts` | Create |
| `src/components/assessment/AssessmentResults.tsx` | Modify — add "Explain to peers" / "See peer tips" buttons |

### Key Design Decisions

1. **No edge functions** — `evaluate_challenge_answer` as a SECURITY DEFINER DB function is faster, simpler, and follows the existing `validate_micro_check_answer` pattern exactly
2. **No leaderboard table** — computed from existing `assessment_sessions` data; avoids sync/staleness issues
3. **`course_id` on all new tables** — enables single-hop RLS using `is_enrolled_student()` instead of expensive multi-table joins
4. **Question selection is client-side** — client picks random question IDs from the LO's pool, but `correct_answer` is never exposed (RLS on `assessment_questions` already restricts this, and evaluation happens server-side)
5. **Realtime only on `quiz_challenges`** — lightweight; the duel UI subscribes filtered by challenge ID

### Risk Assessment

- **Medium complexity**: 4 new tables, 1 DB function, 1 trigger, ~7 new components
- **Zero breakage**: all changes are additive; no modifications to existing assessment flow
- **Security**: answer evaluation is server-side only; enrollment scoping on all tables; no PII exposure (uses `profiles_minimal`)

