# SyllabusStack Critical Fixes Implementation Plan

**Created:** 2026-02-02
**Priority:** P0 (Must fix before production)
**Estimated Total Effort:** 3-4 days

---

## Executive Summary

This plan addresses **13 critical issues** discovered during code review, organized into 4 phases:

1. **Phase 1: Data Integrity & Security** (Day 1) - Payment safety, race conditions, rate limiting
2. **Phase 2: AI Quality & Reliability** (Day 2) - Prompts, schemas, scoring calibration
3. **Phase 3: Flow Correctness** (Day 3) - Assessment completion, content search, curriculum
4. **Phase 4: Code Quality** (Day 3-4) - Response formats, validation, consistency

---

## Phase 1: Data Integrity & Security (CRITICAL)

### 1.1 Fix Silent Database Failures in Payment Handlers

**Priority:** P0 - CRITICAL (Money at risk)
**Effort:** 2-3 hours

#### Problem
Database updates in Stripe webhook handlers don't verify success. Users can pay but not receive Pro access.

#### Files to Modify

| File | Lines | Issue |
|------|-------|-------|
| `supabase/functions/stripe-webhook/index.ts` | 202-213, 240-250, 268-276 | No error check on profile update |
| `supabase/functions/create-checkout-session/index.ts` | 87-90 | No error check |
| `supabase/functions/create-course-payment/index.ts` | 88-91 | No error check |
| `supabase/functions/cancel-subscription/index.ts` | 85-95 | No error check |

#### Implementation

```typescript
// BEFORE (dangerous)
await supabase
  .from("profiles")
  .update({ subscription_tier: "pro" })
  .eq("user_id", userId);

// AFTER (safe)
const { data, error } = await supabase
  .from("profiles")
  .update({ subscription_tier: "pro" })
  .eq("user_id", userId)
  .select()
  .single();

if (error || !data) {
  // Log critical error for alerting
  logError('stripe-webhook', new Error(`CRITICAL: Failed to update subscription for user ${userId}`), {
    stripe_event_id: event.id,
    subscription_id: subscription.id,
    error: error?.message
  });

  // Return 500 so Stripe retries the webhook
  return createErrorResponse('DATABASE_ERROR', corsHeaders,
    'Failed to update subscription. Stripe will retry.');
}

logInfo('stripe-webhook', 'subscription_updated', { userId, tier: 'pro' });
```

#### Testing Checklist
- [ ] Simulate database timeout during webhook
- [ ] Verify Stripe retries on 500 response
- [ ] Verify successful updates return 200
- [ ] Add monitoring alert for DATABASE_ERROR in stripe-webhook

---

### 1.2 Fix Race Condition in Course Enrollment

**Priority:** P0 - CRITICAL (Duplicate charges possible)
**Effort:** 1 hour

#### Problem
Check-then-insert pattern allows duplicate enrollments when two requests race.

#### File to Modify
`supabase/functions/enroll-in-course/index.ts` (lines 77-121)

#### Implementation

**Option A: Use UPSERT (Recommended)**
```typescript
// BEFORE
const { data: existingEnrollment } = await supabase
  .from('student_course_enrollments')
  .select('id')
  .eq('student_id', userId)
  .eq('instructor_course_id', courseId)
  .maybeSingle();

if (existingEnrollment) {
  return createErrorResponse('BAD_REQUEST', corsHeaders, 'Already enrolled');
}

const { data: enrollment, error } = await supabase
  .from('student_course_enrollments')
  .insert({ student_id: userId, instructor_course_id: courseId })
  .select()
  .single();

// AFTER
const { data: enrollment, error } = await supabase
  .from('student_course_enrollments')
  .upsert(
    {
      student_id: userId,
      instructor_course_id: courseId,
      enrolled_at: new Date().toISOString()
    },
    {
      onConflict: 'student_id,instructor_course_id',
      ignoreDuplicates: true
    }
  )
  .select()
  .single();

if (error) {
  if (error.code === '23505') { // Unique violation
    return createSuccessResponse({
      already_enrolled: true,
      message: 'You are already enrolled in this course'
    }, corsHeaders);
  }
  throw error;
}
```

**Option B: Database Constraint (Also do this)**
```sql
-- Add unique constraint if not exists
ALTER TABLE student_course_enrollments
ADD CONSTRAINT unique_student_course
UNIQUE (student_id, instructor_course_id);
```

#### Testing Checklist
- [ ] Concurrent enrollment requests from same user
- [ ] Verify only one enrollment created
- [ ] Verify appropriate response for duplicate attempt

---

### 1.3 Fix Rate Limiter to Fail Closed

**Priority:** P0 - CRITICAL (Abuse protection)
**Effort:** 30 minutes

#### Problem
Rate limiter returns `allowed: true` on database errors, disabling protection entirely.

#### File to Modify
`supabase/functions/_shared/rate-limiter.ts` (lines 68-70, 80-81)

#### Implementation

```typescript
// BEFORE (fails open - DANGEROUS)
if (hourlyError) {
  console.error('Rate limit hourly check error:', hourlyError);
  return { allowed: true, remaining: limits.hourly, resetAt: null, limit: limits.hourly };
}

// AFTER (fails closed - SAFE)
if (hourlyError) {
  logError('rate-limiter', hourlyError, { userId, functionName, checkType: 'hourly' });
  // Fail closed: deny request if we can't verify rate limit
  return {
    allowed: false,
    remaining: 0,
    resetAt: new Date(Date.now() + 60000).toISOString(), // Retry in 1 minute
    limit: limits.hourly,
    error: 'Rate limit check failed. Please try again shortly.'
  };
}

// Same for daily check (lines 80-81)
if (dailyError) {
  logError('rate-limiter', dailyError, { userId, functionName, checkType: 'daily' });
  return {
    allowed: false,
    remaining: 0,
    resetAt: new Date(Date.now() + 60000).toISOString(),
    limit: limits.daily,
    error: 'Rate limit check failed. Please try again shortly.'
  };
}
```

#### Testing Checklist
- [ ] Simulate database connection failure
- [ ] Verify requests are blocked (not allowed)
- [ ] Verify user-friendly error message returned
- [ ] Verify recovery when database comes back

---

## Phase 2: AI Quality & Reliability

### 2.1 Fix AI Prompt Schema Mismatch in analyze-syllabus

**Priority:** P1 - HIGH
**Effort:** 30 minutes

#### Problem
Prompt references `extract_syllabus_data` but schema is named `extract_capabilities`.

#### File to Modify
`supabase/functions/analyze-syllabus/index.ts` (line 108)

#### Implementation

```typescript
// BEFORE
"Return your response using the extract_syllabus_data function"

// AFTER - Match the actual schema name in _shared/schemas.ts
"Return your response using the extract_capabilities function"
```

Also verify schema in `_shared/schemas.ts:10` matches expected structure.

---

### 2.2 Fix AI Hallucination Risk in extract-learning-objectives

**Priority:** P1 - HIGH (Affects course quality)
**Effort:** 1 hour

#### Problem
AI is told to "infer" learning objectives if none found, leading to hallucinated content.

#### File to Modify
`supabase/functions/extract-learning-objectives/index.ts` (line 149)

#### Implementation

```typescript
// BEFORE
"If no explicit learning objectives are found, infer them from course topics"

// AFTER
`IMPORTANT: Only extract learning objectives that are EXPLICITLY stated in the syllabus.
Do NOT infer or create learning objectives.

If no explicit learning objectives are found:
1. Set "explicit_los_found": false
2. Return "suggested_sections" array with section titles that MIGHT contain LOs
3. Return empty "learning_objectives" array

The instructor will be prompted to provide explicit LOs if none are found.`
```

#### Frontend Change Required
`src/components/instructor/QuickCourseSetup.tsx`

```tsx
// Add handling for no LOs found
if (response.explicit_los_found === false) {
  toast.warning(
    "No explicit learning objectives found in syllabus. " +
    "Please add them manually or upload a more detailed syllabus.",
    { duration: 10000 }
  );
  // Show suggested sections where LOs might be
  setSuggestedSections(response.suggested_sections);
}
```

---

### 2.3 Add Scoring Examples to evaluate-content-batch

**Priority:** P1 - HIGH (Content quality)
**Effort:** 2 hours

#### Problem
Scoring rubric has no examples, causing inconsistent AI evaluations.

#### File to Modify
`supabase/functions/evaluate-content-batch/index.ts` (lines 62-68)

#### Implementation

Add concrete examples to the scoring prompt:

```typescript
const SCORING_RUBRIC = `
SCORING RUBRIC WITH EXAMPLES:

RELEVANCE SCORE (0-100):
- 90-100 (Exceptional): Video title/description directly mentions the learning objective's core concept AND covers it as the main topic.
  Example: LO "Explain photosynthesis" + Video "Photosynthesis Explained: How Plants Make Food" = 95
- 75-89 (Good): Video covers the concept but as part of a broader topic.
  Example: LO "Explain photosynthesis" + Video "Plant Biology: Nutrition and Growth" = 80
- 60-74 (Acceptable): Video mentions the concept but focuses on related topics.
  Example: LO "Explain photosynthesis" + Video "How Ecosystems Work" = 65
- 40-59 (Poor): Tangentially related, concept barely mentioned.
- 0-39 (Irrelevant): Different topic entirely.

PEDAGOGY SCORE (0-100):
- 90-100: Uses visual aids, clear explanations, scaffolds complexity, checks understanding.
  Example: Khan Academy style with diagrams, step-by-step, practice problems = 95
- 75-89: Good explanations but missing visual aids OR structure.
  Example: Clear lecture but talking head only = 80
- 60-74: Explains concept but assumes prior knowledge, moves too fast.
- Below 60: Confusing, disorganized, or too advanced/basic.

QUALITY SCORE (0-100):
- 90-100: Professional production, clear audio, HD video, well-edited.
- 75-89: Good quality with minor issues (occasional background noise, standard definition).
- 60-74: Acceptable but distracting quality issues.
- Below 60: Poor audio/video that interferes with learning.

BLOOM'S ALIGNMENT:
For each Bloom's level, prioritize videos that match:
- Remember/Understand: Explanatory videos, lectures, overviews
- Apply: Tutorials, worked examples, demonstrations
- Analyze: Case studies, comparisons, breakdowns
- Evaluate: Critiques, reviews, debates
- Create: Project walkthroughs, design processes
`;
```

---

### 2.4 Fix Curriculum-Reasoning-Agent EXACTLY 5 Constraint

**Priority:** P2 - MEDIUM
**Effort:** 1 hour

#### Problem
Prompt says "EXACTLY 5" but code accepts 1-7 units, creating inconsistency.

#### File to Modify
`supabase/functions/curriculum-reasoning-agent/index.ts` (lines 95, 304-307)

#### Implementation

```typescript
// BEFORE (line 95)
"Decompose into EXACTLY 5 teachable micro-concepts"

// AFTER - Be honest about the range
"Decompose into 3-5 teachable micro-concepts (aim for 5 when the topic is complex enough)"

// AND update validation (lines 304-307)
// BEFORE
teachingUnits = teachingUnits.slice(0, 5);

// AFTER - Validate and warn
if (teachingUnits.length < 3) {
  logWarn('curriculum-reasoning-agent', 'Too few teaching units generated', {
    loId: learningObjectiveId,
    count: teachingUnits.length
  });
  // Don't fail - proceed with what we have
}
if (teachingUnits.length > 5) {
  logInfo('curriculum-reasoning-agent', 'Truncating teaching units to 5', {
    loId: learningObjectiveId,
    originalCount: teachingUnits.length
  });
  teachingUnits = teachingUnits.slice(0, 5);
}
```

---

## Phase 3: Flow Correctness

### 3.1 Add Null Checks in complete-assessment

**Priority:** P1 - HIGH (Crashes user flow)
**Effort:** 45 minutes

#### Problem
Assessment completion crashes if session has null fields.

#### File to Modify
`supabase/functions/complete-assessment/index.ts` (lines 259-263)

#### Implementation

```typescript
// BEFORE
const performanceSummary = {
  total_questions: session.question_ids.length,
  attempt_number: session.attempt_number,
};

// AFTER
if (!session.question_ids || !Array.isArray(session.question_ids)) {
  logError('complete-assessment', new Error('Invalid session: missing question_ids'), {
    sessionId: session.id
  });
  return createErrorResponse('INTERNAL_ERROR', corsHeaders,
    'Assessment session is corrupted. Please start a new assessment.');
}

const performanceSummary = {
  total_questions: session.question_ids?.length ?? 0,
  attempt_number: session.attempt_number ?? 1,
  completed_at: new Date().toISOString(),
  score_percentage: session.score_percentage ?? 0,
};
```

Also add validation at session start to prevent corrupted sessions.

---

### 3.2 Fix Teaching Unit Query Usage in search-youtube-content

**Priority:** P2 - MEDIUM (Affects content quality)
**Effort:** 1.5 hours

#### Problem
Teaching unit's AI-generated `search_queries` are often ignored, falling back to generic queries.

#### File to Modify
`supabase/functions/search-youtube-content/index.ts` (lines 645-683)

#### Implementation

```typescript
// BEFORE - Teaching unit queries easily overwritten
if (teaching_unit_id && teachingUnits.length > 0) {
  const targetUnit = teachingUnits.find((u: any) => u.id === teaching_unit_id);
  if (targetUnit?.search_queries && targetUnit.search_queries.length > 0) {
    queries = targetUnit.search_queries;
  }
}

// Fallback always runs if queries empty
if (queries.length === 0) {
  queries = await generateSearchQueries(...);
}

// AFTER - Prioritize teaching unit queries, log when falling back
let querySource = 'fallback';

if (teaching_unit_id && teachingUnits.length > 0) {
  const targetUnit = teachingUnits.find((u: any) => u.id === teaching_unit_id);

  if (targetUnit?.search_queries && targetUnit.search_queries.length > 0) {
    queries = targetUnit.search_queries;
    querySource = 'teaching_unit';
    console.log(`[QUERY SOURCE] Using ${queries.length} pre-generated teaching unit queries`);
  } else {
    // Teaching unit exists but no queries - generate them now and save
    console.log(`[QUERY SOURCE] Teaching unit ${teaching_unit_id} missing queries, generating...`);
    queries = await generateSearchQueries({
      ...loContext,
      // Include teaching unit context for better queries
      teaching_unit_title: targetUnit?.title,
      teaching_unit_focus: targetUnit?.focus_area,
    }, moduleContext, courseContext);

    // Save generated queries back to teaching unit for future use
    if (queries.length > 0) {
      await supabaseClient
        .from('teaching_units')
        .update({ search_queries: queries })
        .eq('id', teaching_unit_id);
    }
    querySource = 'generated_for_unit';
  }
} else {
  // No teaching unit - use LO-level query generation
  queries = await generateSearchQueries(loContext, moduleContext, courseContext);
  querySource = 'lo_level';
}

logInfo('search-youtube-content', 'queries_selected', {
  loId: learning_objective_id,
  teachingUnitId: teaching_unit_id,
  querySource,
  queryCount: queries.length,
  queries: queries.slice(0, 3) // Log first 3 for debugging
});
```

---

### 3.3 Add Curriculum Hours Validation

**Priority:** P2 - MEDIUM
**Effort:** 1 hour

#### Problem
Generated curriculum may require more hours than user has available.

#### File to Modify
`supabase/functions/generate-curriculum/index.ts`

#### Implementation

Add validation after AI generates curriculum:

```typescript
// After parsing curriculumData (around line 301)

// Calculate total hours
const totalRequiredHours = curriculumData.subjects.reduce(
  (sum, s) => sum + s.estimated_hours, 0
);
const totalAvailableHours = hoursPerWeek * curriculumData.estimated_total_weeks;

// Check if curriculum fits
if (totalRequiredHours > totalAvailableHours * 1.2) { // 20% buffer
  logWarn('generate-curriculum', 'Curriculum exceeds available time', {
    userId,
    requiredHours: totalRequiredHours,
    availableHours: totalAvailableHours,
    overflow: totalRequiredHours - totalAvailableHours
  });

  // Option 1: Auto-adjust weeks
  const adjustedWeeks = Math.ceil(totalRequiredHours / hoursPerWeek);
  curriculumData.estimated_total_weeks = adjustedWeeks;
  curriculumData.time_warning = `This curriculum requires ${totalRequiredHours} hours. ` +
    `At ${hoursPerWeek} hours/week, it will take approximately ${adjustedWeeks} weeks ` +
    `(${adjustedWeeks - 12} weeks longer than typical).`;
}

// Add to response
return new Response(JSON.stringify({
  success: true,
  // ... existing fields ...
  total_hours_required: totalRequiredHours,
  hours_per_week: hoursPerWeek,
  time_warning: curriculumData.time_warning || null,
}), { ... });
```

---

## Phase 4: Code Quality

### 4.1 Standardize Response Formats

**Priority:** P3 - LOW
**Effort:** 2 hours

#### Problem
Inconsistent response formats across edge functions.

#### Files to Modify
All edge functions should use `createSuccessResponse` and `createErrorResponse` from `_shared/error-handler.ts`.

#### Implementation Pattern

```typescript
// BEFORE (inconsistent)
return new Response(JSON.stringify({ success: true, data }), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

// AFTER (consistent)
return createSuccessResponse({ success: true, data }, corsHeaders);
```

#### Files Needing Update
- `add-manual-content/index.ts:232-240,348-356`
- `issue-certificate/index.ts`
- `generate-curriculum/index.ts:335-350`
- `process-syllabus/index.ts`
- Several others (run grep to find all `new Response(JSON.stringify`)

---

### 4.2 Fix Validation Schema for Consumption Events

**Priority:** P3 - LOW
**Effort:** 30 minutes

#### File to Modify
`supabase/functions/_shared/validators/index.ts` (line 294)

#### Implementation

```typescript
// BEFORE
data: z.any().optional(),

// AFTER - Define expected shapes
data: z.discriminatedUnion('event_type', [
  z.object({
    event_type: z.literal('video_watch'),
    video_id: z.string(),
    watch_duration_seconds: z.number().min(0),
    completed: z.boolean().optional(),
  }),
  z.object({
    event_type: z.literal('assessment_attempt'),
    assessment_id: z.string().uuid(),
    score: z.number().min(0).max(100),
    time_spent_seconds: z.number().min(0),
  }),
  z.object({
    event_type: z.literal('slide_view'),
    slide_id: z.string().uuid(),
    view_duration_seconds: z.number().min(0),
  }),
]).optional(),
```

---

### 4.3 Add Distractor Quality Examples

**Priority:** P3 - LOW
**Effort:** 1 hour

#### File to Modify
`supabase/functions/generate-assessment-questions/index.ts` (line 97)

#### Implementation

```typescript
// Add to prompt
`DISTRACTOR GUIDELINES:

Good distractors are:
1. Plausible - Could be true if you didn't know the material
2. Similar length/format to correct answer
3. Based on common misconceptions

Examples:
Q: What is the primary function of mitochondria?
Correct: Generate ATP through cellular respiration
Good Distractor: Store genetic information (common misconception - that's the nucleus)
Good Distractor: Break down waste products (plausible cell function)
Bad Distractor: Make the cell blue (obviously wrong, not plausible)

Q: In JavaScript, what does 'const' mean?
Correct: The variable binding cannot be reassigned
Good Distractor: The value is deeply immutable (common misconception)
Good Distractor: The variable is only accessible in the current block (partially true, but not the primary meaning)
Bad Distractor: The variable is a constant number (too specific, obviously wrong for objects)`
```

---

## Implementation Order

### Day 1 (4-5 hours)
1. [ ] 1.1 - Payment DB error handling (2-3h)
2. [ ] 1.2 - Enrollment race condition (1h)
3. [ ] 1.3 - Rate limiter fail closed (30m)

### Day 2 (4-5 hours)
4. [ ] 2.1 - Schema mismatch (30m)
5. [ ] 2.2 - LO hallucination fix (1h)
6. [ ] 2.3 - Scoring examples (2h)
7. [ ] 2.4 - Curriculum constraints (1h)

### Day 3 (4 hours)
8. [ ] 3.1 - Assessment null checks (45m)
9. [ ] 3.2 - Teaching unit queries (1.5h)
10. [ ] 3.3 - Curriculum hours validation (1h)
11. [ ] 4.1 - Response format standardization (2h)

### Day 4 (1.5 hours)
12. [ ] 4.2 - Validation schema (30m)
13. [ ] 4.3 - Distractor examples (1h)

---

## Testing Plan

### Critical Path Tests (Must Pass)
1. **Payment Flow**
   - Successful subscription upgrade
   - Database failure during upgrade (should retry)
   - Webhook idempotency (same event twice)

2. **Enrollment Flow**
   - Normal enrollment
   - Concurrent enrollment attempts
   - Already enrolled user

3. **Rate Limiting**
   - Normal usage within limits
   - Exceeding limits
   - Database failure during rate check

### AI Quality Tests
1. **LO Extraction**
   - Syllabus with explicit LOs
   - Syllabus without LOs (should NOT hallucinate)
   - Edge case: partial/vague LOs

2. **Content Evaluation**
   - Run same video through evaluation 5 times
   - Verify score variance < 10 points
   - Check Bloom's level alignment

### Integration Tests
1. **Full Instructor Flow**
   - Upload syllabus → Extract LOs → Search content → Evaluate → Approve
   - Verify teaching unit queries are used
   - Verify content matches link to teaching units

---

## Rollback Plan

If issues arise after deployment:

1. **Payment Issues**: Feature flag to bypass new error handling, manual reconciliation
2. **Rate Limiter**: Environment variable to switch back to fail-open (temporary)
3. **AI Prompts**: Revert prompt files, prompts are hot-swappable

---

## Monitoring & Alerts

Add these alerts post-deployment:

1. `stripe-webhook` DATABASE_ERROR rate > 0.1% → PagerDuty
2. `rate-limiter` error rate > 1% → Slack
3. `evaluate-content-batch` score variance > 15 points → Log for review
4. `enroll-in-course` duplicate attempts > 5/minute → Investigate

---

## Sign-off Checklist

- [ ] All critical fixes implemented
- [ ] Tests written and passing
- [ ] Code reviewed by second engineer
- [ ] Staging environment tested
- [ ] Rollback plan verified
- [ ] Monitoring alerts configured
- [ ] Documentation updated
