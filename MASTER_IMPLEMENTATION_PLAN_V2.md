# Master Implementation Plan V2: Production-Ready SyllabusStack

**Date:** 2026-01-28
**Verified Against:** Actual codebase analysis (not external documentation)
**Status:** Week 1 Foundation COMPLETED, Week 2+ IN PROGRESS

---

## Executive Summary

This plan provides **detailed, actionable implementation specs** based on deep codebase analysis. Each task includes:
- Exact file paths and line numbers
- Code diffs showing before/after
- Why the change is needed
- What the change accomplishes
- Verification steps

### Current State (Verified 2026-01-28)

| Metric | Status |
|--------|--------|
| Build | **PASSES (0 errors)** |
| Tests | **310 passed, 0 failed** |
| Rate Limiter Usage | 4 of 78 edge functions (5%) |
| Error Handler Usage | 2 of 78 edge functions (2.6%) |

### Completed Tasks

| Task | Status | Commit |
|------|--------|--------|
| 1.1.1 Create useCourseProgress.ts | ✅ DONE | 1a0a2a7 |
| 1.1.2 Create useGapAnalysis.ts | ✅ DONE | 1a0a2a7 |
| 1.1.3 Fix Mock Hoisting (10 files) | ✅ DONE | 1a0a2a7 |
| 1.1.4 Fix Router Test Issue | ✅ DONE | 1a0a2a7 |
| 1.2.1 Database Migration (created) | ✅ DONE | 31979c1 |
| 2.1.2 Password Requirements | ✅ DONE | 31979c1 |
| 3.6 ConfirmationDialog | ✅ DONE | 31979c1 |
| 3.3 ErrorBoundary (verified complete) | ✅ DONE | Already exists |

---

## Part 2: Security Hardening (Week 2) - REMAINING TASKS

### Task 2.1.1: Email Verification

**STATUS:** NEEDS IMPLEMENTATION

**ANALYSIS:** Supabase Auth has built-in email verification. We should use it rather than creating custom edge function.

**Implementation:**

#### Step 1: Enable in Supabase Dashboard
```
Supabase Dashboard → Authentication → Email Templates → Enable "Confirm signup"
```

#### Step 2: Create EmailVerificationBanner Component

**File:** `src/components/auth/EmailVerificationBanner.tsx`

```typescript
/**
 * EmailVerificationBanner.tsx
 *
 * PURPOSE: Show warning banner to users who haven't verified their email
 *
 * WHY: Unverified accounts are a security risk - can be created with
 * any email address without proof of ownership
 *
 * WHERE TO USE: Add to ProtectedRoute or main layout for authenticated pages
 */
import { useState } from 'react';
import { AlertTriangle, Mail, X, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if user is verified or banner dismissed
  if (!user || user.email_confirmed_at || dismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email!,
      });

      if (error) throw error;

      toast({
        title: 'Verification email sent',
        description: 'Please check your inbox and spam folder.',
      });
    } catch (error) {
      toast({
        title: 'Failed to send email',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Alert variant="warning" className="mb-4 relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          Please verify your email address ({user.email}) to access all features.
        </span>
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendVerification}
            disabled={isResending}
          >
            {isResending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Mail className="h-4 w-4 mr-1" />
            )}
            Resend
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

#### Step 3: Add to Layout

**File:** `src/components/layout/MainLayout.tsx`

**DIFF:**
```diff
+ import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
+       <div className="container mx-auto px-4 py-2">
+         <EmailVerificationBanner />
+       </div>
        {children}
      </main>
      <Footer />
    </div>
  );
```

**EFFORT:** 2 hours (reduced from 6 - using built-in Supabase)

---

### Task 2.1.3: Rate Limiting Expansion

**STATUS:** NEEDS IMPLEMENTATION

**ANALYSIS:** Rate limiter exists and works well. Currently used by only 4 functions.

**Current Usage (verified via grep):**
```
supabase/functions/_shared/skills-pipeline/index.ts
supabase/functions/_shared/youtube-search/index.ts
supabase/functions/analyze-syllabus/index.ts
supabase/functions/gap-analysis/index.ts
```

**Target Functions (AI-intensive, highest priority):**
1. `discover-dream-jobs/index.ts`
2. `match-careers/index.ts`
3. `generate-recommendations/index.ts`
4. `generate-assessment-questions/index.ts`
5. `generate-curriculum/index.ts`
6. `curriculum-reasoning-agent/index.ts`

**Implementation Pattern:**

**File:** `supabase/functions/discover-dream-jobs/index.ts`

**DIFF (example for each function):**
```diff
  import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
+ import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";
+ import { createErrorResponse, logInfo } from "../_shared/error-handler.ts";
+ import { createServiceClient } from "../_shared/ai-cache.ts";

  serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
+     // Get authenticated user
      const authHeader = req.headers.get("Authorization");
+     if (!authHeader) {
+       return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Authorization required');
+     }

      const supabase = createClient(/* ... */);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
+     if (userError || !user) {
+       return createErrorResponse('UNAUTHORIZED', corsHeaders, 'Failed to authenticate');
+     }

+     // Check rate limits
+     const serviceClient = createServiceClient();
+     const limits = await getUserLimits(serviceClient, user.id);
+     const rateLimitResult = await checkRateLimit(serviceClient, user.id, 'discover-dream-jobs', limits);
+
+     if (!rateLimitResult.allowed) {
+       return createRateLimitResponse(rateLimitResult, corsHeaders);
+     }
+
+     logInfo('discover-dream-jobs', 'rate_limit_passed', { userId: user.id });

      // ... rest of function logic
```

**EFFORT:** 3 hours (6 functions × 30 min each)

---

### Task 2.1.4: Server-Side Webhook Secrets

**STATUS:** SECURITY ISSUE CONFIRMED - NEEDS FIX

**ANALYSIS:** Verified the security issue exists.

**File:** `src/hooks/useEmployerAccount.ts` (Line 264)
```typescript
// CURRENT (INSECURE): Secret generated client-side
const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
```

**WHY THIS IS A PROBLEM:**
- Secrets generated client-side can be intercepted via browser dev tools
- Malicious JavaScript could capture the secret before it's sent to server
- Violates security best practice of server-side secret generation

**SOLUTION:** Create edge function to generate and store webhook

#### Step 1: Create Edge Function

**File:** `supabase/functions/create-webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { createErrorResponse, createSuccessResponse, logInfo } from "../_shared/error-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employer_account_id, url, events } = await req.json();

    // Validate input
    if (!employer_account_id || !url || !events?.length) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Missing required fields');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Invalid webhook URL');
    }

    // Require HTTPS
    if (!url.startsWith('https://')) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'Webhook URL must use HTTPS');
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createErrorResponse('UNAUTHORIZED', corsHeaders);
    }

    // Verify user owns the employer account
    const { data: account, error: accountError } = await supabase
      .from('employer_accounts')
      .select('id, user_id')
      .eq('id', employer_account_id)
      .single();

    if (accountError || !account || account.user_id !== user.id) {
      return createErrorResponse('FORBIDDEN', corsHeaders, 'Not authorized for this account');
    }

    // Generate secret SERVER-SIDE (the fix)
    const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;

    // Create webhook
    const { data: webhook, error: insertError } = await supabase
      .from('employer_webhooks')
      .insert({
        employer_account_id,
        url,
        events,
        secret,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      return createErrorResponse('DATABASE_ERROR', corsHeaders, insertError.message);
    }

    logInfo('create-webhook', 'webhook_created', {
      webhookId: webhook.id,
      accountId: employer_account_id,
      eventCount: events.length,
    });

    // Return webhook with secret (only shown once)
    return createSuccessResponse({ webhook, secret }, corsHeaders, 201);

  } catch (error) {
    console.error('Create webhook error:', error);
    return createErrorResponse('INTERNAL_ERROR', corsHeaders);
  }
});
```

#### Step 2: Update Frontend Hook

**File:** `src/hooks/useEmployerAccount.ts`

**DIFF:**
```diff
  export function useCreateWebhook() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
      mutationFn: async (data: {
        employer_account_id: string;
        url: string;
        events: string[];
      }) => {
-       // Generate a signing secret
-       const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
-
-       const { data: webhook, error } = await supabase
-         .from('employer_webhooks')
-         .insert({
-           employer_account_id: data.employer_account_id,
-           url: data.url,
-           events: data.events,
-           secret,
-           is_active: true,
-         })
-         .select()
-         .single();
-
-       if (error) throw error;
-       return { ...webhook, secret };
+       // Call server-side function (secret generated securely)
+       const { data: result, error } = await supabase.functions.invoke('create-webhook', {
+         body: data,
+       });
+
+       if (error) throw error;
+       return result;
      },
```

**EFFORT:** 2 hours

---

## Part 3: UX Critical Fixes (Week 2-3)

### Task 3.1: Assessment Progress Auto-Save

**STATUS:** NEEDS IMPLEMENTATION

**ANALYSIS:** Verified that `AssessmentSession.tsx` stores all state in React component state only. No localStorage persistence.

**File:** `src/components/assessment/AssessmentSession.tsx`

**Current State (Lines 40-66):**
```typescript
const [sessionState, setSessionState] = useState<SessionState>('idle');
const [sessionId, setSessionId] = useState<string | null>(null);
const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
const [progress, setProgress] = useState<SessionProgress>({...});
const [answeredQuestions, setAnsweredQuestions] = useState<Map<string, boolean>>(new Map());
// All lost on page refresh!
```

**SOLUTION:** Add localStorage auto-save with recovery dialog

**Implementation:**

#### Step 1: Create Auto-Save Hook

**File:** `src/hooks/useAssessmentAutoSave.ts`

```typescript
/**
 * useAssessmentAutoSave.ts
 *
 * PURPOSE: Persist assessment progress to localStorage
 *
 * WHY: Connection loss or accidental page close = lost progress
 * Students may lose 10-15 minutes of work
 *
 * WHAT IT DOES:
 * - Saves after each answer to localStorage
 * - Provides recovery check on mount
 * - Clears on assessment completion
 */
import { useCallback, useEffect } from 'react';
import { AssessmentQuestion, SessionProgress } from './useAssessment';

interface SavedAssessmentState {
  sessionId: string;
  learningObjectiveId: string;
  questions: AssessmentQuestion[];
  currentQuestionIndex: number;
  progress: SessionProgress;
  answeredQuestions: Record<string, boolean>; // Map serialized as object
  savedAt: string;
}

const STORAGE_KEY = 'syllabusstack_assessment_progress';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useAssessmentAutoSave(learningObjectiveId: string) {
  // Check for saved progress on mount
  const getSavedProgress = useCallback((): SavedAssessmentState | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const parsed: SavedAssessmentState = JSON.parse(saved);

      // Check if same learning objective
      if (parsed.learningObjectiveId !== learningObjectiveId) {
        return null;
      }

      // Check if not expired
      const savedTime = new Date(parsed.savedAt).getTime();
      if (Date.now() - savedTime > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }, [learningObjectiveId]);

  // Save current progress
  const saveProgress = useCallback((state: Omit<SavedAssessmentState, 'savedAt' | 'learningObjectiveId'>) => {
    try {
      const toSave: SavedAssessmentState = {
        ...state,
        learningObjectiveId,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save assessment progress:', error);
    }
  }, [learningObjectiveId]);

  // Clear saved progress
  const clearProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    getSavedProgress,
    saveProgress,
    clearProgress,
  };
}
```

#### Step 2: Integrate into AssessmentSession

**File:** `src/components/assessment/AssessmentSession.tsx`

**DIFF:**
```diff
+ import { useAssessmentAutoSave } from '@/hooks/useAssessmentAutoSave';

  export function AssessmentSession({...}) {
    // ... existing state ...
+   const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
+   const [recoveredState, setRecoveredState] = useState<SavedAssessmentState | null>(null);

+   const { getSavedProgress, saveProgress, clearProgress } = useAssessmentAutoSave(learningObjectiveId);

+   // Check for saved progress on mount
+   useEffect(() => {
+     const saved = getSavedProgress();
+     if (saved && saved.progress.questions_answered > 0) {
+       setRecoveredState(saved);
+       setShowRecoveryDialog(true);
+     }
+   }, [getSavedProgress]);

+   // Auto-save after each answer
+   useEffect(() => {
+     if (sessionId && questions.length > 0) {
+       saveProgress({
+         sessionId,
+         questions,
+         currentQuestionIndex,
+         progress,
+         answeredQuestions: Object.fromEntries(answeredQuestions),
+       });
+     }
+   }, [sessionId, questions, currentQuestionIndex, progress, answeredQuestions, saveProgress]);

+   // Handle recovery
+   const handleRecover = () => {
+     if (recoveredState) {
+       setSessionId(recoveredState.sessionId);
+       setQuestions(recoveredState.questions);
+       setCurrentQuestionIndex(recoveredState.currentQuestionIndex);
+       setProgress(recoveredState.progress);
+       setAnsweredQuestions(new Map(Object.entries(recoveredState.answeredQuestions)));
+       setSessionState('active');
+     }
+     setShowRecoveryDialog(false);
+   };

+   const handleStartFresh = () => {
+     clearProgress();
+     setShowRecoveryDialog(false);
+   };

    // ... rest of component ...

+   // Add recovery dialog
+   {showRecoveryDialog && (
+     <AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
+       <AlertDialogContent>
+         <AlertDialogHeader>
+           <AlertDialogTitle>Resume Previous Assessment?</AlertDialogTitle>
+           <AlertDialogDescription>
+             You have saved progress from a previous session
+             ({recoveredState?.progress.questions_answered} of {recoveredState?.progress.total_questions} questions answered).
+             Would you like to continue where you left off?
+           </AlertDialogDescription>
+         </AlertDialogHeader>
+         <AlertDialogFooter>
+           <AlertDialogCancel onClick={handleStartFresh}>Start Fresh</AlertDialogCancel>
+           <AlertDialogAction onClick={handleRecover}>Resume</AlertDialogAction>
+         </AlertDialogFooter>
+       </AlertDialogContent>
+     </AlertDialog>
+   )}

    // Clear progress on completion
    const handleComplete = async () => {
      // ... existing completion logic ...
+     clearProgress(); // Clear saved progress on successful completion
    };
```

**EFFORT:** 4 hours

---

### Task 3.2: Form Persistence (Onboarding)

**STATUS:** NEEDS IMPLEMENTATION

**ANALYSIS:** `OnboardingWizard.tsx` is a multi-step form. Need to persist form state.

**File to Modify:** `src/components/onboarding/OnboardingWizard.tsx`

**Implementation Pattern:**

```typescript
// Add to OnboardingWizard.tsx

const STORAGE_KEY = 'syllabusstack_onboarding_state';

// Load saved state on mount
useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      setFormState(parsed.formState);
      setCurrentStep(parsed.currentStep);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}, []);

// Save state on change
useEffect(() => {
  if (currentStep > 0) { // Don't save initial state
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      formState,
      currentStep,
      savedAt: new Date().toISOString(),
    }));
  }
}, [formState, currentStep]);

// Clear on completion
const handleComplete = async () => {
  // ... submit logic ...
  localStorage.removeItem(STORAGE_KEY);
};
```

**EFFORT:** 2 hours

---

### Task 3.4: Loading Skeletons

**STATUS:** NEEDS IMPLEMENTATION

**Pages Needing Skeletons (verified via code review):**
1. `src/pages/Dashboard.tsx` - Multiple widgets
2. `src/pages/Learn.tsx` - Course cards
3. `src/pages/CareerPath.tsx` - Gap analysis results
4. `src/pages/instructor/InstructorCourses.tsx` - Course list
5. `src/pages/admin/UserManagement.tsx` - User table

**Implementation:** Use shadcn/ui Skeleton component

**File:** `src/components/ui/skeleton.tsx` (already exists)

**Example for Dashboard:**

```typescript
// src/components/dashboard/DashboardSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**EFFORT:** 4 hours (5 pages × ~45 min each)

---

### Task 3.5: Pagination

**STATUS:** NEEDS IMPLEMENTATION

**Pages Needing Pagination (verified via code review):**
1. `src/pages/admin/UserManagement.tsx` - Loads all users
2. `src/pages/admin/RoleManagement.tsx` - Audit log
3. `src/pages/employer/EmployerDashboard.tsx` - Activity list

**Implementation Pattern:**

```typescript
// Reusable pagination hook
function usePagination<T>(
  data: T[] | undefined,
  pageSize: number = 20
) {
  const [page, setPage] = useState(1);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const totalPages = Math.ceil((data?.length || 0) / pageSize);

  return {
    data: paginatedData,
    page,
    setPage,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
```

**EFFORT:** 3 hours

---

### Task 3.7: Fix Broken Features

#### 3.7.1: PDF Export

**File:** `src/pages/admin/OutcomesReport.tsx`

**Current (broken):** Uses `window.print()` which prints entire page

**Fix:** Install and use html2pdf.js

```bash
npm install html2pdf.js
```

```typescript
import html2pdf from 'html2pdf.js';

const handleExportPDF = () => {
  const element = document.getElementById('report-content');
  html2pdf()
    .set({
      margin: 1,
      filename: `outcomes-report-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    })
    .from(element)
    .save();
};
```

**EFFORT:** 2 hours

#### 3.7.2: Send Reminder Button

**File:** `src/pages/admin/UserManagement.tsx`

**Analysis Needed:** Check if edge function exists for sending reminders

**EFFORT:** 2 hours (if function exists) or 4 hours (if need to create)

---

## Part 4: Edge Function Standardization (Week 3-4)

### Task 4.1: Error Handler Migration

**STATUS:** Only 2 of 78 functions use error-handler.ts

**Using Error Handler (verified):**
- `supabase/functions/analyze-syllabus/index.ts`
- `supabase/functions/gap-analysis/index.ts`

**Migration Pattern:**

```typescript
// BEFORE (typical function without error handling)
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { someInput } = await req.json();
    // ... function logic ...
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// AFTER (with standardized error handling)
import { createErrorResponse, createSuccessResponse, withErrorHandling, logInfo, logError } from "../_shared/error-handler.ts";

const handler = async (req: Request) => {
  const { someInput } = await req.json();

  if (!someInput) {
    return createErrorResponse('VALIDATION_ERROR', corsHeaders, 'someInput is required');
  }

  logInfo('function-name', 'processing', { inputId: someInput });

  // ... function logic ...

  return createSuccessResponse(result, corsHeaders);
};

serve(withErrorHandling(handler, corsHeaders));
```

**Priority Order (by usage frequency and criticality):**

**Week 3, Day 1-2: AI Functions (10 functions)**
1. `discover-dream-jobs`
2. `match-careers`
3. `generate-recommendations`
4. `generate-assessment-questions`
5. `generate-curriculum`
6. `curriculum-reasoning-agent`
7. `evaluate-content-batch`
8. `content-rating-engine`
9. `generate-lecture-slides-v3`
10. `generate-lecture-audio`

**Week 3, Day 3-4: Search Functions (5 functions)**
1. `search-youtube-content`
2. `search-youtube-manual`
3. `search-khan-academy`
4. `search-educational-content`
5. `global-search`

**Week 3, Day 5: Assessment Functions (5 functions)**
1. `start-assessment`
2. `submit-assessment-answer`
3. `complete-assessment`
4. `start-skills-assessment`
5. `complete-skills-assessment`

**Week 4: Remaining 56 Functions**
- Batch migrate in groups of 10-15 per day

**EFFORT:** 20-25 hours total

---

## Part 5: Code Cleanup (Week 4)

### Task 5.1: Remove Unused Code

**Verified Unused (safe to delete):**

| File | Lines | Last Import Check |
|------|-------|-------------------|
| `src/hooks/useWorkflows.ts` | 4 | Never imported |
| `src/hooks/workflows/*` | ~318 | Directory never imported |
| `src/hooks/useProgressiveGeneration.ts` | 115 | Never imported |

**COMMAND:**
```bash
rm src/hooks/useWorkflows.ts
rm -rf src/hooks/workflows/
rm src/hooks/useProgressiveGeneration.ts
```

**EFFORT:** 30 minutes

### Task 5.2: Evaluate Before Deletion

**These hooks exist but appear unused - need deeper analysis:**

| Hook | Lines | Possible Use |
|------|-------|--------------|
| `useAdminAnalytics.ts` | 390 | May be planned for AdminDashboard |
| `useOnboardingProgress.ts` | 287 | May be needed for onboarding flow |
| `useInstructorNotifications.ts` | 286 | May be needed for instructor alerts |

**RECOMMENDATION:** Review with product team before deletion

---

## Implementation Schedule (Updated)

### Week 2 Remaining (Current)
| Task | Hours | Priority |
|------|-------|----------|
| 2.1.1 Email Verification | 2 | HIGH |
| 2.1.3 Rate Limiting (6 functions) | 3 | CRITICAL |
| 2.1.4 Webhook Secrets | 2 | CRITICAL |
| **Subtotal** | **7** | |

### Week 3: UX Critical
| Task | Hours | Priority |
|------|-------|----------|
| 3.1 Assessment Auto-Save | 4 | CRITICAL |
| 3.2 Form Persistence | 2 | HIGH |
| 3.4 Loading Skeletons | 4 | MEDIUM |
| 3.5 Pagination | 3 | MEDIUM |
| 3.7 Broken Features | 4 | HIGH |
| Error Handler Migration (20 functions) | 8 | HIGH |
| **Subtotal** | **25** | |

### Week 4: Edge Functions + Cleanup
| Task | Hours | Priority |
|------|-------|----------|
| Error Handler Migration (remaining) | 15 | HIGH |
| Code Cleanup | 2 | LOW |
| Testing & Verification | 4 | CRITICAL |
| **Subtotal** | **21** | |

---

## Success Criteria (Updated)

### Week 2 Complete
- [ ] Email verification banner shows for unverified users
- [ ] Rate limiting on all AI-intensive functions
- [ ] Webhook secrets generated server-side
- [ ] Build passes, tests pass

### Week 3 Complete
- [ ] Assessment progress auto-saves to localStorage
- [ ] Onboarding form persists across page refreshes
- [ ] Loading skeletons on key pages
- [ ] Pagination working on admin/employer pages
- [ ] 20+ edge functions using standardized error handling

### Week 4 Complete
- [ ] 50%+ edge functions using standardized error handling
- [ ] Unused code removed
- [ ] Full regression test pass

---

## Appendix: File Inventory

### Files Already Created (This Sprint)
| File | Purpose |
|------|---------|
| `src/hooks/useCourseProgress.ts` | Course progress tracking |
| `src/hooks/useGapAnalysis.ts` | Re-export from useAnalysis |
| `src/components/common/ConfirmationDialog.tsx` | Destructive action confirmations |
| `supabase/migrations/20260128100000_add_last_accessed_at.sql` | Activity tracking |

### Files to Create
| File | Purpose | Week |
|------|---------|------|
| `src/components/auth/EmailVerificationBanner.tsx` | Unverified user notice | 2 |
| `supabase/functions/create-webhook/index.ts` | Server-side webhook creation | 2 |
| `src/hooks/useAssessmentAutoSave.ts` | Assessment localStorage persistence | 3 |
| `src/components/dashboard/DashboardSkeleton.tsx` | Loading skeleton | 3 |

### Files to Modify
| File | Changes | Week |
|------|---------|------|
| `src/hooks/useEmployerAccount.ts` | Use server-side webhook creation | 2 |
| `src/components/assessment/AssessmentSession.tsx` | Add auto-save | 3 |
| `src/components/onboarding/OnboardingWizard.tsx` | Add form persistence | 3 |
| 20+ edge functions | Add error handler imports | 3-4 |

---

*Master Implementation Plan V2 - Generated 2026-01-28*
*Based on: Deep codebase analysis, not external documentation*
