# SyllabusStack Critical Fixes Implementation Plan v2

**Created:** 2026-02-02
**Updated:** 2026-02-02 (Incorporating Lovable Agent Review)
**Priority:** P0 (Must fix before production)
**Estimated Total Effort:** 4-6 days

---

## Executive Summary

This plan addresses **13 verified issues** discovered during code review by both Claude and Lovable agents. Issues are organized into 4 phases with **concrete implementation logic** - no vague "improvements."

### Key Updates from Lovable Agent Review:
- **Issue 8 (Race Condition)**: Downgraded to P2 - DB unique constraint already exists (`UNIQUE(student_id, instructor_course_id)`), only need better error handling
- **More specific line numbers** identified for response format inconsistencies
- **Additional context** on schema mismatch impact

---

## Phase 1: Data Integrity & Security (P0 - CRITICAL)

### 1.1 Fix Silent Database Failures in Payment Handlers

**File:** `supabase/functions/stripe-webhook/index.ts`
**Lines:** 202-213, 240-250, 268-276, 302-305, 376-379

#### The Problem (Concrete)
```typescript
// CURRENT CODE (lines 202-213)
await supabase
  .from("profiles")
  .update({
    subscription_tier: "pro",
    subscription_status: subscription.status,
    // ...
  })
  .eq("user_id", subscriptionUserId);

console.log(`Updated user ${subscriptionUserId} to pro tier`);
// ^^^ This logs "success" even if the update FAILED
```

**Why This Is Dangerous:**
1. Stripe charges the user successfully
2. Webhook fires and runs this code
3. Database update fails silently (network issue, constraint violation, etc.)
4. `console.log` says it worked
5. User is charged but stays on Free tier
6. No alert, no retry, no record of failure

#### The Fix (Concrete)

```typescript
// FIXED CODE
const { data: updatedProfile, error: updateError } = await supabase
  .from("profiles")
  .update({
    subscription_tier: "pro",
    subscription_status: subscription.status,
    stripe_subscription_id: subscription.id,
    subscription_started_at: new Date(subscription.start_date * 1000).toISOString(),
    subscription_ends_at: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
  })
  .eq("user_id", subscriptionUserId)
  .select('user_id, subscription_tier')  // CRITICAL: Get confirmation
  .single();

if (updateError || !updatedProfile) {
  // CRITICAL: Log with all context needed to manually fix
  console.error('CRITICAL PAYMENT ERROR:', JSON.stringify({
    error: updateError?.message,
    code: updateError?.code,
    userId: subscriptionUserId,
    stripeSubscriptionId: subscription.id,
    stripeEventId: event.id,
    intendedTier: 'pro',
    timestamp: new Date().toISOString()
  }));

  // Return 500 so Stripe retries the webhook (up to 3 days)
  throw new Error(`Failed to update subscription for user ${subscriptionUserId}`);
}

// Only log success if we CONFIRMED the update
console.log(`CONFIRMED: User ${subscriptionUserId} upgraded to ${updatedProfile.subscription_tier}`);
```

**Apply same pattern to:**
- Lines 240-250 (`handleSubscriptionUpdate`)
- Lines 268-276 (`handleSubscriptionCanceled`)
- Lines 302-305 (`handlePaymentFailed` status update)
- Lines 376-379 (`handleCoursePayment`)

#### Logic Verification Table
| Scenario | Before | After |
|----------|--------|-------|
| DB success | Logs success | Logs success with confirmation |
| DB timeout | Logs success (WRONG) | Throws error, Stripe retries |
| User not found | Logs success (WRONG) | Throws error, logged for manual fix |
| Constraint violation | Logs success (WRONG) | Throws error with details |

---

### 1.2 Fix Rate Limiter to Fail CLOSED

**File:** `supabase/functions/_shared/rate-limiter.ts`
**Lines:** 66-70, 79-81, 133-136

#### The Problem (Concrete)
```typescript
// CURRENT CODE (line 66-69)
if (hourlyError) {
  console.error('Rate limit hourly check error:', hourlyError);
  // Fail open - allow the request but log the error
  return { allowed: true, remaining: { hourly: 0, daily: 0, costBudget: 0 } };
}
```

**Why This Is Dangerous:**
1. Database has temporary issue (maintenance, high load)
2. Rate limiter can't check usage
3. Returns `allowed: true` for EVERYONE
4. Attacker notices and sends 10,000 requests
5. You get a $50,000 AI bill from Google/OpenAI

#### The Fix (Concrete)

```typescript
// FIXED CODE (lines 66-70)
if (hourlyError) {
  console.error('Rate limit check FAILED - blocking request:', {
    error: hourlyError.message,
    userId,
    functionName,
    checkType: 'hourly'
  });

  // FAIL CLOSED: Deny request when we can't verify limits
  return {
    allowed: false,
    remaining: { hourly: 0, daily: 0, costBudget: 0 },
    retryAfter: 60, // Tell client to retry in 60 seconds
    reason: 'Rate limit service temporarily unavailable. Please try again in a minute.',
    _internal_error: true // Flag for monitoring
  };
}
```

**Apply same pattern to:**
- Lines 79-81 (`dailyError`)
- Lines 133-136 (`catch` block)

#### Logic Verification Table
| Scenario | Before | After |
|----------|--------|-------|
| DB healthy | Normal rate limiting | Normal rate limiting |
| DB timeout | ALL requests allowed | ALL requests blocked with retry hint |
| DB down for 1 hour | 100K+ requests slip through | Users see "try again in 1 minute" |
| Recovery | No change | Automatic recovery when DB returns |

#### Why Fail-Closed is Correct
- **Cost of false positive** (blocking legitimate user): User waits 60 seconds, retries
- **Cost of false negative** (allowing abuse): Potentially $1000s in AI costs
- Risk ratio strongly favors fail-closed

---

### 1.3 Fix Schema Name Mismatch in analyze-syllabus

**File:** `supabase/functions/analyze-syllabus/index.ts`
**Line:** 108

**File:** `supabase/functions/_shared/schemas.ts`
**Line:** 10

#### The Problem (Concrete)
```typescript
// In analyze-syllabus/index.ts:108
"Return your response using the extract_syllabus_data function"

// In _shared/schemas.ts:10
export const EXTRACT_CAPABILITIES_SCHEMA = {
  name: "extract_capabilities",  // <-- Different name!
  // ...
}
```

**Why This Matters:**
- Gemini/OpenAI structured output mode matches function name to schema
- Mismatch can cause: intermittent failures, wrong schema used, hallucinated format
- Hard to debug because it works "most of the time"

#### The Fix (Concrete)

```typescript
// In analyze-syllabus/index.ts:108
// BEFORE
"Return your response using the extract_syllabus_data function"

// AFTER - Match the actual schema name
"Return your response using the extract_capabilities function"
```

#### Logic Verification
- Schema name in prompt MUST match schema name in schema definition
- After fix: prompt says `extract_capabilities`, schema is `extract_capabilities` ✓

---

## Phase 2: AI Quality & Reliability (P1 - HIGH)

### 2.1 Smart LO Extraction with Transparency (REVISED)

**File:** `supabase/functions/extract-learning-objectives/index.ts`
**Lines:** 118-208, 222-385

#### The Original Problem
The original code said "infer them from course topics" but lacked:
1. Distinction between explicit and inferred LOs
2. Source text showing what content the inference was based on
3. Confidence levels for each LO
4. Instructor review workflow for inferred LOs

#### The Smart Fix (Using AI Intelligently)

**Approach: Extract BOTH explicit and inferred LOs with full transparency**

```typescript
// SMART EXTRACTION PROMPT
const userPrompt = `Analyze this syllabus and extract ALL learning objectives - both explicit and inferred:

EXTRACTION STRATEGY:

1. EXPLICIT OBJECTIVES (source_type: "explicit", confidence: "high")
   Look for clearly stated objectives like "Students will be able to..."

2. INFERRED FROM TOPICS (source_type: "inferred_from_topics", confidence: "medium")
   "Week 3: Supply and Demand" → "Understand supply and demand principles"

3. INFERRED FROM ASSIGNMENTS (source_type: "inferred_from_assignments", confidence: "medium")
   "Midterm: Case study analysis" → "Analyze real-world case studies"

4. INFERRED FROM READINGS (source_type: "inferred_from_readings", confidence: "low")
   "Required: Chapter 5 - Neural Networks" → "Understand neural network architecture"

CRITICAL: Every inferred objective MUST include source_text showing the EXACT syllabus text.

Return JSON:
{
  "explicit_objectives": [...],
  "inferred_objectives": [...],
  "extraction_summary": { ... }
}`;
```

**Interface Updates:**
```typescript
interface LearningObjective {
  // ... existing fields ...
  source_type: 'explicit' | 'inferred_from_topics' | 'inferred_from_assignments' | 'inferred_from_readings';
  source_text: string;  // The actual syllabus text this came from
  confidence: 'high' | 'medium' | 'low';
}
```

**Database Updates:**
```typescript
// Explicit LOs are auto-approved
approval_status: isAutoApproved ? 'approved' : 'pending_review'
```

**Response Format:**
```typescript
return {
  explicit_objectives: savedExplicitLOs,      // Auto-approved
  inferred_objectives: savedInferredLOs,      // Pending review
  learning_objectives: [...all...],           // Backwards compatible
  review_required: savedInferredLOs.length > 0,
  review_message: "Found X explicit and Y inferred objectives. Please review inferred objectives."
};
```

#### Logic Verification Table
| Scenario | Before | Smart Fix |
|----------|--------|-----------|
| Syllabus with explicit LOs | Extracts correctly | Extracts with source_type="explicit" |
| Syllabus with only topics | INVENTED fake LOs | Infers with source_text showing "Week 3: Topic X" |
| Syllabus with assignments | No context | Infers with source_type="inferred_from_assignments" |
| Instructor visibility | Unknown if real or fake | Clear separation + review workflow |
| Content search | Uses potentially wrong LOs | Uses approved LOs only |

#### Why This Is Better
1. **Intelligent**: Uses AI to extract implicit knowledge from course structure
2. **Transparent**: Every inference shows its source text
3. **Controllable**: Instructors review/approve inferred LOs
4. **Accurate**: Content search only uses approved objectives

---

### 2.2 Add Concrete Scoring Examples

**File:** `supabase/functions/evaluate-content-batch/index.ts`
**Lines:** 61-69

#### The Problem (Concrete)
```typescript
// CURRENT SCORING RUBRIC
`SCORING CALIBRATION:
- 90-100: Exceptional - Could be used in a professional course
- 80-89: Excellent - Strong match
...`
```

**The Logical Flaw:**
- "Could be used in a professional course" is subjective
- Different AI calls interpret this differently
- Same video scores 85 in one call, 65 in another
- Content recommendations become unreliable
- Instructors lose trust in the system

#### The Fix (Concrete)

```typescript
const SCORING_RUBRIC = `
SCORING CALIBRATION WITH CONCRETE EXAMPLES:

For a Learning Objective: "Apply the concept of supply and demand to predict market prices"

RELEVANCE (40% weight):
- 95-100: Video title is "Supply and Demand: Predicting Prices" AND description mentions price prediction
- 85-94: Video is "Introduction to Supply and Demand" (covers concept but not application)
- 70-84: Video is "Microeconomics Basics" (includes supply/demand as one topic)
- 50-69: Video is "Economics Overview" (briefly mentions supply/demand)
- 0-49: Video is "Macroeconomics: GDP and Inflation" (wrong topic)

PEDAGOGY (35% weight):
- 95-100: Uses diagrams showing price curves, walks through example step-by-step, includes practice problem
  Example: Khan Academy style with graph animations and "now you try" moment
- 85-94: Clear explanation with visuals but no practice component
  Example: University lecture with good slides but no interaction
- 70-84: Verbal explanation only, assumes some prior knowledge
  Example: Podcast discussing the concept conversationally
- 50-69: Explains concept but too fast, no structure
  Example: Quick tips video that rushes through
- 0-49: Confusing, disorganized, or completely lecture-style with no aids
  Example: Recorded classroom with poor audio

QUALITY (25% weight):
- 95-100: Professional production (studio lighting, clear audio, HD, edited)
- 85-94: Good quality (clear audio, decent video, minor issues)
- 70-84: Acceptable (some background noise, standard definition)
- 50-69: Distracting issues (echo, poor lighting, shaky camera)
- 0-49: Unwatchable (can't hear speaker, video freezes, major issues)

BLOOM'S LEVEL ALIGNMENT:
- For "Apply" objectives: Prioritize tutorials, worked examples, demonstrations
- For "Understand" objectives: Prioritize explanatory videos, lectures
- For "Analyze" objectives: Prioritize case studies, comparisons
- For "Create" objectives: Prioritize project walkthroughs, design processes

SCORING CONSISTENCY RULES:
1. A Khan Academy video on the exact topic should score 90+
2. A random YouTube tutorial should score 70-85 depending on quality
3. A tangentially related video should never score above 65
4. Same video evaluated twice should score within 5 points
`;
```

#### Logic Verification Table
| Video Type | Before (Variance) | After (Expected) |
|------------|-------------------|------------------|
| Khan Academy exact match | 75-98 (23 point range) | 90-95 (5 point range) |
| Good YouTube tutorial | 60-90 (30 point range) | 75-85 (10 point range) |
| Tangentially related | 40-75 (35 point range) | 50-65 (15 point range) |

---

### 2.3 Add Null Safety in complete-assessment

**File:** `supabase/functions/complete-assessment/index.ts`
**Lines:** 259-270

#### The Problem (Concrete)
```typescript
// CURRENT CODE (lines 259-263)
const performanceSummary = {
  total_questions: session.question_ids.length,  // Crashes if null
  attempt_number: session.attempt_number,        // Could be undefined
};
```

**What Happens:**
1. Student completes 20-minute assessment
2. Session data has malformed `question_ids` (null instead of array)
3. Code crashes at `.length` call
4. Student sees error, loses their work
5. No record of their attempt

#### The Fix (Concrete)

```typescript
// FIXED CODE
// First, validate session structure
if (!session) {
  return createErrorResponse('NOT_FOUND', corsHeaders,
    'Assessment session not found. Please start a new assessment.');
}

// Validate required fields with specific error messages
if (!session.question_ids || !Array.isArray(session.question_ids)) {
  console.error('Malformed session - missing question_ids:', {
    sessionId: session.id,
    questionIdsType: typeof session.question_ids,
    questionIdsValue: session.question_ids
  });
  return createErrorResponse('INTERNAL_ERROR', corsHeaders,
    'Assessment session data is corrupted. Please contact support with session ID: ' + session.id);
}

if (session.question_ids.length === 0) {
  return createErrorResponse('BAD_REQUEST', corsHeaders,
    'This assessment has no questions. Please contact your instructor.');
}

// Now safe to use
const performanceSummary = {
  total_questions: session.question_ids.length,
  attempt_number: session.attempt_number ?? 1,  // Default to 1 if missing
  score_percentage: session.score_percentage ?? 0,
  completed_at: new Date().toISOString()
};
```

#### Logic Verification Table
| Session State | Before | After |
|---------------|--------|-------|
| Normal session | Works | Works |
| `question_ids: null` | CRASH | Clear error message |
| `question_ids: []` | Returns 0 questions | "No questions" error |
| `attempt_number: undefined` | undefined in summary | Defaults to 1 |

---

### 2.4 Fix "EXACTLY 5" Constraint Messaging

**File:** `supabase/functions/curriculum-reasoning-agent/index.ts`
**Lines:** 95, 303-307

#### The Problem (Concrete)
```typescript
// PROMPT (line 95)
"Decompose into EXACTLY 5 teachable micro-concepts"

// CODE (lines 303-307)
if (teachingUnits.length > 5) {
  teachingUnits = teachingUnits.slice(0, 5);  // Silently truncates
}
// No check for < 5, just accepts whatever
```

**The Logical Flaw:**
- Prompt says "EXACTLY 5" but code accepts 1-7
- AI learns the constraint isn't enforced
- Over time, responses become less consistent
- Some LOs get 2 teaching units, others get 5 (unfair coverage)

#### The Fix (Concrete)

**Option A: Be honest about flexibility (Recommended)**
```typescript
// FIXED PROMPT
`Decompose into 3-5 teachable micro-concepts. Aim for 5 when the topic has enough depth.

IMPORTANT: You MUST return between 3 and 5 teaching units. Not 2, not 6.
If the concept is simple, find 3 distinct aspects.
If the concept is complex, prioritize the 5 most important aspects.`

// FIXED CODE
if (teachingUnits.length < 3) {
  console.warn('Too few teaching units generated:', {
    loId: learningObjectiveId,
    count: teachingUnits.length,
    loText: loText?.substring(0, 100)
  });
  // Log but proceed - better to have some than none
}

if (teachingUnits.length > 5) {
  console.info('Truncating teaching units from', teachingUnits.length, 'to 5');
  teachingUnits = teachingUnits.slice(0, 5);
}
```

#### Logic Verification Table
| AI Returns | Before (Prompt: EXACTLY 5) | After (Prompt: 3-5) |
|------------|---------------------------|---------------------|
| 2 units | Accepted silently | Logged as warning, proceed |
| 5 units | Accepted | Accepted |
| 7 units | Truncated to 5 silently | Truncated to 5 (logged) |

---

## Phase 3: Flow Correctness (P2 - MEDIUM)

### 3.1 Improve Enrollment Race Condition Handling

**File:** `supabase/functions/enroll-in-course/index.ts`
**Lines:** 77-121

#### Current State (Verified by Lovable Agent)
- **Database constraint EXISTS**: `UNIQUE(student_id, instructor_course_id)` ✓
- **Race condition MITIGATED** at DB level - duplicate inserts fail
- **Remaining issue**: Error message is unfriendly on duplicate

#### The Fix (Concrete)

```typescript
// CURRENT CODE handles duplicate like any other error
// FIXED CODE - Catch unique constraint specifically

const { data: enrollment, error: enrollError } = await supabase
  .from('student_course_enrollments')
  .insert({
    student_id: userId,
    instructor_course_id: courseId,
    enrolled_at: new Date().toISOString()
  })
  .select()
  .single();

if (enrollError) {
  // Check for unique constraint violation (Postgres error code 23505)
  if (enrollError.code === '23505' || enrollError.message?.includes('duplicate')) {
    // User is already enrolled - this is not an error, just a duplicate request
    const { data: existingEnrollment } = await supabase
      .from('student_course_enrollments')
      .select('id, enrolled_at')
      .eq('student_id', userId)
      .eq('instructor_course_id', courseId)
      .single();

    return createSuccessResponse({
      success: true,
      already_enrolled: true,
      enrollment_id: existingEnrollment?.id,
      enrolled_at: existingEnrollment?.enrolled_at,
      message: 'You are already enrolled in this course.'
    }, corsHeaders);
  }

  // Other errors are real problems
  throw enrollError;
}
```

#### Logic Verification Table
| Scenario | Before | After |
|----------|--------|-------|
| First enrollment | Works | Works |
| Duplicate request | Generic error | "Already enrolled" success |
| Race condition | DB prevents duplicate, error shown | DB prevents, friendly success shown |
| Real DB error | Generic error | Throws for proper handling |

---

### 3.2 Fix Teaching Unit Query Fallback

**File:** `supabase/functions/search-youtube-content/index.ts`
**Lines:** 643-682

#### The Problem (Concrete)
```typescript
// CURRENT CODE - Good queries get thrown away
if (teaching_unit_id && teachingUnits.length > 0) {
  const targetUnit = teachingUnits.find(u => u.id === teaching_unit_id);
  if (targetUnit?.search_queries?.length > 0) {
    queries = targetUnit.search_queries;  // Uses good queries
  }
}

// But if search_queries is empty/null, falls back to generic
if (queries.length === 0) {
  queries = await generateSearchQueries(...);  // Loses teaching unit context!
}
```

**The Logical Flaw:**
- Curriculum agent spends AI tokens creating sophisticated teaching units
- But if `search_queries` field is empty, all that context is lost
- Generic queries like "photosynthesis tutorial" replace specific queries like "chloroplast electron transport chain visualization"

#### The Fix (Concrete)

```typescript
// FIXED CODE - Preserve teaching unit context in fallback
let querySource = 'unknown';

if (teaching_unit_id && teachingUnits.length > 0) {
  const targetUnit = teachingUnits.find(u => u.id === teaching_unit_id);

  if (targetUnit?.search_queries?.length > 0) {
    queries = targetUnit.search_queries;
    querySource = 'teaching_unit_cached';
    console.log(`[QUERIES] Using ${queries.length} cached teaching unit queries`);

  } else if (targetUnit) {
    // Teaching unit exists but no queries - generate WITH unit context
    console.log(`[QUERIES] Teaching unit ${teaching_unit_id} missing queries, generating with context...`);

    queries = await generateSearchQueries(
      {
        ...loContext,
        // ADD teaching unit context for better queries
        teaching_unit_title: targetUnit.title,
        teaching_unit_focus: targetUnit.focus_area,
        teaching_unit_prerequisites: targetUnit.prerequisites,
        teaching_unit_key_terms: targetUnit.key_terms,
      },
      moduleContext,
      courseContext
    );
    querySource = 'teaching_unit_generated';

    // Cache for next time
    if (queries.length > 0) {
      await supabaseClient
        .from('teaching_units')
        .update({ search_queries: queries })
        .eq('id', teaching_unit_id);
      console.log(`[QUERIES] Cached ${queries.length} queries to teaching unit`);
    }
  }
} else {
  // No teaching unit - use LO-level query generation
  queries = await generateSearchQueries(loContext, moduleContext, courseContext);
  querySource = 'lo_level';
}

// Log query source for debugging
console.log(`[QUERIES] Source: ${querySource}, Count: ${queries.length}`);
```

#### Logic Verification Table
| Teaching Unit State | Before | After |
|--------------------|--------|-------|
| Has search_queries | Uses them ✓ | Uses them ✓ |
| Exists, no queries | Generic LO queries (loses context) | Uses unit context, caches result |
| Doesn't exist | Generic LO queries | Generic LO queries |

---

### 3.3 Add Curriculum Hours Validation

**File:** `supabase/functions/generate-curriculum/index.ts`

#### The Problem (Concrete)
- User says "I have 10 hours/week for 12 weeks" (120 hours)
- AI generates curriculum requiring 200 hours
- User gets overwhelmed, quits
- No warning given

#### The Fix (Concrete)

```typescript
// After AI generates curriculum (around line 301)

const totalRequiredHours = curriculumData.subjects.reduce(
  (sum, subject) => sum + subject.estimated_hours, 0
);
const totalAvailableHours = hoursPerWeek * curriculumData.estimated_total_weeks;
const utilizationRatio = totalRequiredHours / totalAvailableHours;

let timeWarning = null;

if (utilizationRatio > 1.2) {
  // Curriculum requires 20%+ more time than available
  const adjustedWeeks = Math.ceil(totalRequiredHours / hoursPerWeek);
  const extraWeeks = adjustedWeeks - curriculumData.estimated_total_weeks;

  timeWarning = {
    type: 'exceeds_available_time',
    message: `This curriculum requires approximately ${totalRequiredHours} hours, ` +
      `but you indicated ${totalAvailableHours} hours available ` +
      `(${hoursPerWeek} hrs/week × ${curriculumData.estimated_total_weeks} weeks). ` +
      `Consider extending your timeline by ${extraWeeks} weeks or reducing scope.`,
    required_hours: totalRequiredHours,
    available_hours: totalAvailableHours,
    suggested_weeks: adjustedWeeks,
    utilization_ratio: Math.round(utilizationRatio * 100)
  };

  console.warn('Curriculum exceeds available time:', timeWarning);
}

// Include in response
return createSuccessResponse({
  success: true,
  curriculum_id: curriculum.id,
  // ... other fields ...
  time_analysis: {
    total_required_hours: totalRequiredHours,
    total_available_hours: totalAvailableHours,
    utilization_percentage: Math.round(utilizationRatio * 100),
    warning: timeWarning
  }
}, corsHeaders);
```

#### Logic Verification Table
| Utilization | Before | After |
|-------------|--------|-------|
| 80% (fits well) | No indication | Shows 80% utilization |
| 120% (slightly over) | No indication | Shows warning + suggested adjustment |
| 200% (way over) | No indication | Strong warning + extra weeks needed |

---

## Phase 4: Code Quality (P3 - LOW)

### 4.1 Standardize Response Formats

**Files with Inconsistencies (from Lovable Agent):**
- `curriculum-reasoning-agent/index.ts` (lines 367-379, 384-392)
- `generate-curriculum/index.ts` (lines 339-356, 361-364)
- `generate-assessment-questions/index.ts` (lines 262-269, 274-278)
- `add-manual-content/index.ts` (lines 232-240, 348-356)

#### The Fix Pattern
```typescript
// BEFORE (inconsistent)
return new Response(JSON.stringify({ success: true, data }), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

// AFTER (standardized)
return createSuccessResponse({ success: true, data }, corsHeaders);
```

**Why This Matters:**
- Consistent error structure for frontend handling
- CORS headers always included
- Request ID for debugging
- Timestamp for logging

---

### 4.2 Strengthen Consumption Event Validation

**File:** `supabase/functions/_shared/validators/index.ts`
**Line:** 294

#### The Fix
```typescript
// BEFORE
data: z.any().optional(),

// AFTER
data: z.union([
  z.object({
    event_type: z.literal('video_watch'),
    video_id: z.string().min(1),
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
  z.object({}).passthrough(), // Allow unknown event types with logging
]).optional(),
```

---

### 4.3 Add Distractor Quality Examples

**File:** `supabase/functions/generate-assessment-questions/index.ts`
**Line:** 97

#### The Fix
```typescript
`DISTRACTOR GUIDELINES WITH EXAMPLES:

Good distractors are based on common misconceptions:

Example Question: "What is the primary function of mitochondria?"
Correct: "Generate ATP through cellular respiration"
Good Distractor: "Store genetic information" (common misconception - that's the nucleus)
Good Distractor: "Break down waste products" (plausible cell function)
Bad Distractor: "Make the cell blue" (obviously absurd)
Bad Distractor: "Generate ATP" (too close to correct answer)

Example Question: "In JavaScript, what does 'const' primarily indicate?"
Correct: "The variable binding cannot be reassigned"
Good Distractor: "The value is deeply immutable" (common misconception)
Good Distractor: "The variable is only accessible in the current block" (true but not primary)
Bad Distractor: "The variable must be a number" (obviously wrong)

RULES:
1. Each distractor should be grammatically similar to the correct answer
2. Distractors should be similar in length to the correct answer
3. At least one distractor should be a common misconception
4. No distractor should be partially correct
5. Avoid "all of the above" or "none of the above"`
```

---

## Implementation Schedule

### Day 1 (4-5 hours) - CRITICAL (P0)
| Task | File | Est. Time | Verified By |
|------|------|-----------|-------------|
| 1.1 Payment DB error handling | stripe-webhook/index.ts | 2-3h | Claude + Lovable |
| 1.2 Rate limiter fail-closed | _shared/rate-limiter.ts | 45m | Claude + Lovable |
| 1.3 Schema name mismatch | analyze-syllabus/index.ts | 15m | Claude + Lovable |

### Day 2 (4-5 hours) - HIGH (P1)
| Task | File | Est. Time | Verified By |
|------|------|-----------|-------------|
| 2.1 Remove LO hallucination | extract-learning-objectives/index.ts | 1h | Claude + Lovable |
| 2.2 Scoring examples | evaluate-content-batch/index.ts | 2h | Claude + Lovable |
| 2.3 Assessment null safety | complete-assessment/index.ts | 45m | Claude + Lovable |
| 2.4 EXACTLY 5 constraint | curriculum-reasoning-agent/index.ts | 30m | Claude + Lovable |

### Day 3-4 (4 hours) - MEDIUM (P2)
| Task | File | Est. Time | Verified By |
|------|------|-----------|-------------|
| 3.1 Enrollment error handling | enroll-in-course/index.ts | 45m | Lovable (downgraded) |
| 3.2 Teaching unit query fallback | search-youtube-content/index.ts | 1.5h | Claude + Lovable |
| 3.3 Curriculum hours validation | generate-curriculum/index.ts | 1h | Claude |

### Day 5-6 (3 hours) - LOW (P3)
| Task | File | Est. Time | Verified By |
|------|------|-----------|-------------|
| 4.1 Response format standardization | Multiple files | 1.5h | Lovable |
| 4.2 Consumption event validation | _shared/validators/index.ts | 30m | Claude + Lovable |
| 4.3 Distractor quality examples | generate-assessment-questions/index.ts | 1h | Claude + Lovable |

---

## Testing Requirements

### Critical Path (Must Pass Before Deploy)
1. **Payment Flow**
   - [ ] User upgrades to Pro → DB updated → confirmed in response
   - [ ] Simulate DB failure → webhook returns 500 → Stripe retries
   - [ ] Same webhook twice → idempotent (no duplicate update)

2. **Rate Limiting**
   - [ ] Normal usage → limits enforced correctly
   - [ ] Simulate DB failure → requests BLOCKED with retry message
   - [ ] DB recovery → normal operation resumes within 60s

3. **LO Extraction**
   - [ ] Syllabus with explicit LOs → extracted correctly
   - [ ] Syllabus with NO LOs → empty array + `explicit_objectives_found: false`
   - [ ] Verify NO hallucinated LOs in any case

### Regression Tests
- [ ] All existing unit tests pass
- [ ] No new TypeScript errors in edge functions
- [ ] Frontend build succeeds
- [ ] E2E tests for instructor flow pass

---

## Monitoring & Alerts (Post-Deployment)

| Alert | Trigger | Severity | Action |
|-------|---------|----------|--------|
| Payment DB Error | Any error in stripe-webhook | P0 | PagerDuty immediately |
| Rate Limit Fail-Closed | > 10 blocked/minute | P1 | Slack notification |
| LO Extraction Empty | > 30% syllabi return 0 LOs | P2 | Review prompt effectiveness |
| Score Variance | Same video > 15 point spread | P2 | Review scoring rubric |
| Enrollment Duplicates | > 5 duplicate attempts/minute | P3 | Investigate source |

---

## Rollback Plan

| Fix | Rollback Method | Time to Rollback |
|-----|-----------------|------------------|
| Payment error handling | Revert file; Stripe will retry missed webhooks | 2 min |
| Rate limiter | Env var `RATE_LIMIT_FAIL_OPEN=true` for emergency | 30 sec |
| AI prompts | All prompts are in code; simple git revert | 2 min |
| Schema changes | Backward compatible; no rollback needed | N/A |
| Response formats | Revert files; frontend handles both formats | 2 min |

---

## Sign-off Checklist

### Pre-Deploy
- [ ] All P0 fixes implemented and tested
- [ ] All P1 fixes implemented and tested
- [ ] Code reviewed by second engineer
- [ ] Staging environment tested end-to-end
- [ ] Rollback procedures documented and tested

### Post-Deploy
- [ ] Monitoring alerts configured and verified
- [ ] First payment webhook processed successfully
- [ ] Rate limiter functioning (test with high volume)
- [ ] AI functions returning expected formats
- [ ] Documentation updated

---

## Appendix: Files Modified Summary

| File | Priority | Issues Fixed |
|------|----------|--------------|
| `stripe-webhook/index.ts` | P0 | Silent DB failures |
| `_shared/rate-limiter.ts` | P0 | Fail-open behavior |
| `analyze-syllabus/index.ts` | P0 | Schema name mismatch |
| `extract-learning-objectives/index.ts` | P1 | LO hallucination |
| `evaluate-content-batch/index.ts` | P1 | Scoring examples |
| `complete-assessment/index.ts` | P1 | Null safety |
| `curriculum-reasoning-agent/index.ts` | P1 | EXACTLY 5 constraint |
| `enroll-in-course/index.ts` | P2 | Friendly duplicate handling |
| `search-youtube-content/index.ts` | P2 | Query fallback context |
| `generate-curriculum/index.ts` | P2 | Hours validation |
| `_shared/validators/index.ts` | P3 | Event data schema |
| `generate-assessment-questions/index.ts` | P3 | Distractor examples |
| Multiple files | P3 | Response format standardization |
