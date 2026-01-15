# The Tale of SyllabusStack: A Deep Dive Into the Application's Soul

> *A comprehensive technical narrative of how the SyllabusStack application works, from the first electron to the final pixel.*

---

## Table of Contents

| Chapter | Title | Description |
|---------|-------|-------------|
| **Prologue** | The Birth of a Session | How the application initializes |
| **Chapter 1** | The Gates of Authentication | The AuthContext and session management |
| **Chapter 2** | The Provider Hierarchy | How React providers wrap the application |
| **Chapter 3** | The Router's Journey | Navigation and route protection |
| **Chapter 4** | The Onboarding Odyssey | New user flow and profile setup |
| **Chapter 5** | The Database Connection | Supabase client and data layer |
| **Chapter 6** | The Query Kingdom | React Query and cache management |
| **Chapter 7** | The Course Chronicles | How courses are managed and analyzed |
| **Chapter 8** | The Dream Job Discovery | AI-powered job analysis |
| **Chapter 9** | The Gap Analysis Engine | The heart of career intelligence |
| **Chapter 10** | The Recommendation Factory | Generating actionable advice |
| **Chapter 11** | The Learning Journey | Student courses and enrollments |
| **Chapter 12** | The Dashboard Tapestry | Weaving data into insights |
| **Chapter 13** | The Layout Architecture | AppShell and navigation |
| **Chapter 14** | The Service Layer Secrets | Edge functions and AI calls |
| **Epilogue** | The Data Flow Symphony | Everything working together |

---

## Prologue: The Birth of a Session

Every journey begins with a single step. For SyllabusStack, that step occurs in `src/main.tsx`:

```typescript
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

This deceptively simple code does something profound: it creates a React root attached to the `#root` DOM element and renders the `<App />` component inside React's StrictMode (which helps catch bugs during development by running certain lifecycle methods twice).

**The First Breath**: When the browser loads the application, Vite (the build tool) serves the bundled JavaScript. The `index.html` file contains the target `<div id="root">`, and React takes over from there, hydrating the page with interactive components.

---

## Chapter 1: The Gates of Authentication

### Location: `src/contexts/AuthContext.tsx`

The `AuthProvider` is the guardian of user identity. It wraps the entire application and answers the eternal question: "Who is this user?"

### The State It Maintains

```typescript
const [user, setUser] = useState<User | null>(null);
const [session, setSession] = useState<Session | null>(null);
const [profile, setProfile] = useState<Profile | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

Four pieces of state tell the complete story:
- **user**: The Supabase Auth user object (contains `id`, `email`, etc.)
- **session**: The active session with JWT tokens
- **profile**: Extended user data from the `profiles` table
- **isLoading**: Whether we're still figuring out if the user is logged in

### The Authentication Dance

When the AuthProvider mounts, a carefully choreographed sequence begins:

**Step 1 - Set Up the Listener First**:
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      setTimeout(() => {
        fetchProfile(session.user.id).then(setProfile);
      }, 0);
    } else {
      setProfile(null);
    }
  }
);
```

The listener is established BEFORE checking for an existing session. This prevents race conditions where a session change occurs between checking and subscribing.

**Step 2 - Check Existing Session**:
```typescript
supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(session);
  setUser(session?.user ?? null);

  if (session?.user) {
    fetchProfile(session.user.id).then(profileData => {
      setProfile(profileData);
      setIsLoading(false);
    });
  } else {
    setIsLoading(false);
  }
});
```

### The Profile Fetch: Security by Design

Notice how the profile fetch explicitly selects fields, EXCLUDING sensitive Stripe data:

```typescript
const { data, error } = await supabase
  .from('profiles')
  .select(`
    id, user_id, full_name, email, university, major,
    student_level, graduation_year, avatar_url,
    onboarding_completed, onboarding_step,
    last_active_at, preferences, email_preferences,
    subscription_tier, subscription_status,
    subscription_started_at, subscription_ends_at,
    ai_calls_this_month, ai_calls_reset_at,
    created_at, updated_at
  `)
  .eq('user_id', userId)
  .single();
```

The `stripe_customer_id` and `stripe_subscription_id` are intentionally omitted from the client-side profile type for security.

### The Context Value

Components throughout the app consume this context via `useAuth()`:

```typescript
const value = {
  user,          // Supabase user
  session,       // Auth session with tokens
  profile,       // Extended profile data
  isLoading,     // Loading state
  isOnboarded,   // Computed: profile?.onboarding_completed ?? false
  signUp,        // Sign up with email/password
  signIn,        // Sign in with email/password
  signOut,       // Sign out and clear state
  refreshProfile // Re-fetch profile from database
};
```

---

## Chapter 2: The Provider Hierarchy

### Location: `src/App.tsx`

The App component establishes a carefully ordered hierarchy of providers:

```typescript
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AchievementToastProvider />
        <BrowserRouter>
          <Routes>
            {/* All routes live here */}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);
```

### The Order Matters

**QueryClientProvider (Outermost)**: This provides React Query's caching and data fetching infrastructure. It must be outside AuthProvider because AuthProvider's hooks may need to use React Query.

**AuthProvider**: Wraps authentication state. All children can access `useAuth()`.

**TooltipProvider**: From Radix UI, enables tooltips throughout the app.

**Toaster & Sonner**: Two toast notification systems working in parallel:
- **Toaster** (from shadcn/ui): Used for standard application notifications like success messages, errors, and warnings. This is the primary toast system integrated with the `useToast()` hook throughout the codebase.
- **Sonner**: A more feature-rich toast library used specifically for richer notifications that benefit from its additional capabilities (like progress indicators and custom styling). Rather than migrating all existing toasts, the application uses both systems for their respective strengths - Toaster for simplicity and Sonner for enhanced UX where needed.

**AchievementToastProvider**: Custom provider for achievement unlock notifications (gamification features like badges and XP).

**BrowserRouter**: React Router's provider for client-side routing.

---

## Chapter 3: The Router's Journey

### The Route Architecture

The routing system in `src/App.tsx` defines four categories of routes:

### 1. Public Routes (No authentication required)

```typescript
<Route path="/" element={<Index />} />
<Route path="/scanner" element={<SyllabusScannerPage />} />
<Route path="/test-results" element={<TestResultsPage />} />
<Route path="/resources" element={<ResourcesPage />} />
<Route path="/legal" element={<LegalPage />} />
<Route path="/how-it-works" element={<HowItWorksPage />} />
<Route path="/universities" element={<UniversitiesPage />} />
```

Anyone can access these pages, logged in or not.

### 2. Auth Routes (Redirect if already logged in)

```typescript
<Route path="/auth" element={<GuestGuard><Auth /></GuestGuard>} />
<Route path="/forgot-password" element={<GuestGuard><ForgotPasswordPage /></GuestGuard>} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

The `GuestGuard` component redirects authenticated users to `/dashboard`.

### 3. Protected Routes (Require authentication)

```typescript
<Route path="/onboarding" element={<AuthGuard><OnboardingPage /></AuthGuard>} />
<Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
<Route path="/learn" element={<AuthGuard><LearnPage /></AuthGuard>} />
<Route path="/career" element={<AuthGuard><CareerPathPage /></AuthGuard>} />
```

The `AuthGuard` component redirects unauthenticated users to `/auth`.

### 4. Legacy Redirects (URL migration)

```typescript
<Route path="/courses" element={<Navigate to="/learn?tab=transcript" replace />} />
<Route path="/dream-jobs" element={<Navigate to="/career?tab=jobs" replace />} />
<Route path="/analysis" element={<Navigate to="/career?tab=gaps" replace />} />
```

Old URLs are gracefully redirected to new unified pages.

### The AuthGuard Component

Located in `src/components/auth/AuthGuard.tsx`:

```typescript
export function AuthGuard({ children, requireOnboarding = false }: AuthGuardProps) {
  const { user, isLoading, isOnboarded } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireOnboarding && !isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
```

Three states are handled:
1. **Loading**: Show a spinner
2. **Not authenticated**: Redirect to `/auth`, saving the intended destination
3. **Authenticated but not onboarded**: Redirect to `/onboarding` (if required)

The `GuestGuard` does the inverse - redirects logged-in users to the dashboard.

---

## Chapter 4: The Onboarding Odyssey

### Location: `src/components/onboarding/OnboardingWizard.tsx`

When a new user signs up, they're guided through a multi-step wizard to set up their profile.

### The Four Steps

```typescript
type OnboardingStep = 'profile' | 'courses' | 'dream-jobs' | 'complete';

const steps = [
  { id: 'profile', label: 'Your Profile', icon: User },
  { id: 'courses', label: 'Add Courses', icon: BookOpen },
  { id: 'dream-jobs', label: 'Dream Jobs', icon: Briefcase },
  { id: 'complete', label: 'Complete', icon: Sparkles },
];
```

### Step 1: Profile Information

The user provides:
- **Full Name** (required)
- **University** (required)
- **Major** (optional)
- **Student Level** (required): Freshman, Sophomore, Junior, Senior, or Graduate
- **Graduation Year** (optional)

This data is saved to the `profiles` table via `useUpdateProfile()`.

### Step 2: Add Courses

The `CourseUploader` component allows users to:
- Upload syllabus documents (PDF, DOCX, TXT)
- Paste syllabus text directly
- Enter course details manually

When a syllabus is uploaded, it's sent to the `parse-syllabus-document` edge function for AI analysis.

### Step 3: Dream Jobs

Users can either:
1. **AI Suggestions**: Get job recommendations based on their courses via `DreamJobSuggestions`
2. **Manual Entry**: Enter dream jobs directly via `DreamJobSelector`

Each dream job triggers automatic analysis of requirements via the `analyze-dream-job` edge function.

### Step 4: Complete

A summary screen shows:
- Number of courses added
- Number of dream jobs set
- Confirmation that gap analysis is ready

### The Completion Flow

```typescript
case 'complete':
  await completeOnboarding.mutateAsync();
  await refreshProfile();
  toast({
    title: "Welcome to SyllabusStack!",
    description: "Your profile is set up. Let's explore your gap analysis.",
  });
  navigate('/dashboard');
  break;
```

The `completeOnboarding` hook updates `onboarding_completed = true` in the profile.

---

## Chapter 5: The Database Connection

### Location: `src/integrations/supabase/client.ts`

The Supabase client is the bridge to the PostgreSQL database:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

### Configuration Explained

- **storage: localStorage**: Session tokens are persisted in browser localStorage
- **persistSession: true**: Sessions survive page refreshes
- **autoRefreshToken: true**: Expired tokens are automatically refreshed

### Type Safety

The `Database` type is auto-generated from the Supabase schema, providing full TypeScript support for all tables and columns.

---

## Chapter 6: The Query Kingdom

### Location: `src/lib/query-client.ts`

React Query (TanStack Query) manages server state with intelligent caching:

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 minutes
      gcTime: 1000 * 60 * 30,       // 30 minutes (garbage collection)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### The Cache Strategy

- **staleTime (5 min)**: Data is considered "fresh" for 5 minutes. During this time, React Query returns cached data without refetching.
- **gcTime (30 min)**: Unused data stays in cache for 30 minutes before being garbage collected.
- **retry: 1**: Failed queries retry once automatically.
- **refetchOnWindowFocus: false**: Prevents unnecessary refetches when switching browser tabs.

### The Query Key Factory

Located in `src/lib/query-keys.ts`, this factory ensures consistent cache keys:

```typescript
export const queryKeys = {
  // Courses
  courses: ['courses'] as const,
  coursesList: () => [...queryKeys.courses, 'list'] as const,
  courseDetail: (id: string) => [...queryKeys.courses, 'detail', id] as const,

  // Dream Jobs
  dreamJobs: ['dreamJobs'] as const,
  dreamJobsList: () => [...queryKeys.dreamJobs, 'list'] as const,

  // Analysis
  analysis: ['analysis'] as const,
  gapAnalysis: (dreamJobId: string) => [...queryKeys.analysis, 'gap', dreamJobId] as const,

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    overview: ['dashboard', 'overview'] as const,
    stats: ['dashboard', 'stats'] as const,
  },
};
```

This pattern enables surgical cache invalidation. When a course is updated, only `queryKeys.courses` and related keys need to be invalidated.

---

## Chapter 7: The Course Chronicles

### Location: `src/hooks/useCourses.ts`

Courses are the foundation of a user's capability profile.

### Data Structure

```typescript
type Course = {
  id: string;
  user_id: string;
  title: string;
  code: string | null;
  semester: string | null;
  credits: number | null;
  grade: string | null;
  capability_text: string | null;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysis_error: string | null;
  created_at: string;
  updated_at: string;
};
```

### The Fetch Function

```typescript
async function fetchCourses(): Promise<Course[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
```

### Creating a Course with Side Effects

When a course is created, several things happen:

```typescript
export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      // 1. Invalidate related cache
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });

      // 2. Auto-refresh gap analyses in background
      refreshAllGapAnalyses().catch(console.error);

      // 3. Show success toast
      toast({
        title: 'Course added',
        description: 'Your course has been added successfully.',
      });
    },
  });
}
```

### The Auto-Refresh Logic

The `refreshAllGapAnalyses` function is clever about AI costs:

```typescript
async function refreshAllGapAnalyses() {
  const { data: dreamJobs } = await supabase
    .from('dream_jobs')
    .select('id')
    .eq('user_id', user.id);

  for (const job of dreamJobs) {
    const isFresh = await isAnalysisFresh(job.id, user.id);
    if (isFresh) {
      console.log('[Workflow] Skipping fresh analysis for job:', job.id);
      continue;  // Don't waste AI calls on recent analyses
    }

    console.log('[Workflow] Refreshing stale analysis for job:', job.id);
    const gapResult = await performGapAnalysis(job.id);
    if (gapResult.gaps && gapResult.gaps.length > 0) {
      await generateRecommendations(job.id, gapResult.gaps);
    }
  }
}
```

An analysis is considered "fresh" if it's less than 24 hours old.

---

## Chapter 8: The Dream Job Discovery

### Location: `src/hooks/useDreamJobs.ts`

Dream jobs represent the user's career aspirations.

### The Creation Workflow

When a user adds a dream job, an automated workflow kicks in:

```typescript
async function createDreamJobWithWorkflow(job: Omit<DreamJobInsert, 'user_id'>): Promise<DreamJob> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Create the dream job in database
  const { data: newJob, error } = await supabase
    .from('dream_jobs')
    .insert({ ...job, user_id: user.id })
    .select()
    .single();

  if (error) throw error;

  // 2. Background workflow (doesn't block UI)
  (async () => {
    try {
      // Step 1: Analyze job requirements via AI
      console.log('[Workflow] Auto-analyzing job requirements for:', newJob.id);
      const analysisResult = await analyzeDreamJob(
        job.title,
        job.company_type || undefined,
        job.location || undefined,
        newJob.id
      );

      // Step 2: Update dream job with AI insights
      if (analysisResult) {
        await supabase
          .from('dream_jobs')
          .update({
            day_one_capabilities: analysisResult.day_one_capabilities?.slice(0, 10).map(r => r.requirement) || [],
            realistic_bar: analysisResult.realistic_bar || null,
            differentiators: analysisResult.differentiators || [],
            common_misconceptions: analysisResult.common_misconceptions || [],
            requirements_keywords: analysisResult.requirements?.map(r => r.skill_name) || [],
          })
          .eq('id', newJob.id);

        // Step 3: Run gap analysis if not already exists
        const analysisExists = await hasExistingAnalysis(newJob.id, user.id);
        if (!analysisExists) {
          console.log('[Workflow] Auto-triggering gap analysis for:', newJob.id);
          const gapResult = await performGapAnalysis(newJob.id);

          // Step 4: Generate recommendations based on gaps
          if (gapResult.gaps && gapResult.gaps.length > 0) {
            console.log('[Workflow] Auto-generating recommendations for:', newJob.id);
            await generateRecommendations(newJob.id, gapResult.gaps);
          }
        }
      }
    } catch (workflowError) {
      console.error('[Workflow] Background analysis failed:', workflowError);
      // Don't throw - background task shouldn't break the main flow
    }
  })();

  return newJob;  // Return immediately, workflow runs in background
}
```

### The Primary Job Concept

Users can mark one dream job as "primary" for focused analysis:

```typescript
export function useSetPrimaryDreamJob() {
  return useMutation({
    mutationFn: async (id: string) => {
      // First, set all jobs to not primary
      await supabase
        .from('dream_jobs')
        .update({ is_primary: false })
        .eq('user_id', user.id);

      // Then set the selected one as primary
      const { data, error } = await supabase
        .from('dream_jobs')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
}
```

---

## Chapter 9: The Gap Analysis Engine

### Location: `src/services/gap-analysis-service.ts` and `src/hooks/useAnalysis.ts`

Gap analysis is the heart of SyllabusStack - comparing what you know against what jobs require.

### The Service Layer

```typescript
export interface GapAnalysisResponse {
  match_score: number;                    // 0-100 percentage
  overlaps: SkillOverlap[];               // Skills you have
  gaps: SkillGap[];                       // Skills you need
  honest_assessment: string;              // Plain-language evaluation
  readiness_level?: 'ready_to_apply' | '3_months_away' | '6_months_away' | '1_year_away' | 'needs_significant_development';
  interview_readiness?: string;
  job_success_prediction?: string;
  strong_overlaps?: Array<{ student_capability: string; job_requirement: string; assessment: string }>;
  partial_overlaps?: Array<{ student_capability: string; job_requirement: string; assessment: string }>;
  critical_gaps?: Array<{ job_requirement: string; student_status: string; impact: string }>;
  priority_gaps?: Array<{ gap: string; priority: number; reason: string }>;
  anti_recommendations?: string[];        // Things to AVOID doing
}

export async function performGapAnalysis(dreamJobId: string): Promise<GapAnalysisResponse> {
  const { data, error } = await supabase.functions.invoke('gap-analysis', {
    body: { dreamJobId }
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  return data;
}
```

### The Hook Layer: Two-Tier Approach

The hooks separate fast (cached) reads from slow (AI) operations:

```typescript
// FAST: Read from database (cached)
export function useGapAnalysis(dreamJobId: string) {
  return useQuery({
    queryKey: queryKeys.gapAnalysis(dreamJobId),
    queryFn: () => fetchGapAnalysisFromDB(dreamJobId),
    enabled: !!dreamJobId,
    staleTime: 1000 * 60 * 10, // 10 minutes - it's cached data
  });
}

// SLOW: Run AI analysis on demand
export function useRefreshGapAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dreamJobId: string) => runGapAnalysisAI(dreamJobId),
    onSuccess: (data, dreamJobId) => {
      // Update cache with new data
      queryClient.setQueryData(queryKeys.gapAnalysis(dreamJobId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      toast({
        title: 'Analysis complete',
        description: 'Your gap analysis has been updated.',
      });
    },
  });
}
```

This pattern means:
- Page loads show cached data instantly
- AI analysis only runs when user explicitly clicks "Refresh"
- Saves expensive AI calls

---

## Chapter 10: The Recommendation Factory

### Location: `src/services/recommendations-service.ts` and `src/hooks/useRecommendations.ts`

Once gaps are identified, recommendations help close them.

### Recommendation Types

```typescript
export interface Recommendation {
  title: string;
  type: 'course' | 'certification' | 'project' | 'experience' | 'skill';
  description: string;
  provider?: string;
  url?: string;
  duration?: string;
  priority: 'high' | 'medium' | 'low';
}
```

### Generating Recommendations

```typescript
export async function generateRecommendations(
  dreamJobId: string,
  gaps: SkillGap[]
): Promise<GenerateRecommendationsResponse> {
  const { data, error } = await supabase.functions.invoke('generate-recommendations', {
    body: { dreamJobId, gaps }
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  return data;
}
```

### Linked Course Tracking

Recommendations can be linked to actual courses the user enrolls in. The following pseudocode illustrates the data flow:

```typescript
async function fetchRecommendations(dreamJobId?: string): Promise<RecommendationWithLinks[]> {
  // Step 0: Get authenticated user from Supabase auth context
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Step 1: Build and execute the recommendations query
  // (query is built dynamically based on dreamJobId filter)
  const query = supabase
    .from('recommendations')
    .select('*')
    .eq('user_id', user.id);

  if (dreamJobId) {
    query.eq('dream_job_id', dreamJobId);
  }

  const { data: recs } = await query;

  // Step 2: Extract recommendation IDs for the next query
  const recIds = recs?.map(r => r.id) || [];

  // Step 3: Fetch linked courses for these recommendations
  const { data: links } = await supabase
    .from('recommendation_course_links')
    .select(`
      recommendation_id,
      instructor_course_id,
      instructor_course:instructor_courses (id, title)
    `)
    .in('recommendation_id', recIds)
    .eq('link_status', 'active');

  // Step 4: Fetch enrollment progress for the current user
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('instructor_course_id, overall_progress')
    .eq('student_id', user.id);

  // Step 5: Build lookup maps for O(1) access during merge
  // linkMap: recommendation_id -> { courseId, title }
  const linkMap = new Map(links?.map(l => [
    l.recommendation_id,
    { courseId: l.instructor_course_id, title: l.instructor_course?.title }
  ]));

  // progressMap: course_id -> progress percentage
  const progressMap = new Map(enrollments?.map(e => [
    e.instructor_course_id,
    e.overall_progress
  ]));

  // Step 6: Merge all data into enriched recommendation objects
  return (recs || []).map(rec => {
    const linkedCourse = linkMap.get(rec.id);
    return {
      ...rec,
      linked_course_id: linkedCourse?.courseId || null,
      linked_course_title: linkedCourse?.title || null,
      enrollment_progress: linkedCourse ? progressMap.get(linkedCourse.courseId) ?? null : null,
    };
  });
}
```

### Status Management

Recommendations flow through states:

```typescript
type RecommendationStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export function useUpdateRecommendationStatus() {
  return useMutation({
    mutationFn: ({ id, status }) => updateRecommendationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      toast({ title: 'Status updated' });
    },
  });
}
```

---

## Chapter 11: The Learning Journey

### Location: `src/hooks/useStudentCourses.ts`

Students can enroll in instructor-created courses using access codes.

### Enrollment Structure

```typescript
export interface StudentEnrollment {
  id: string;
  student_id: string;
  instructor_course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  overall_progress: number;
  instructor_course: {
    id: string;
    title: string;
    code: string | null;
    description: string | null;
    instructor_id: string;
    verification_threshold: number;
    is_published: boolean;
  };
}
```

### The Enrollment Process

```typescript
export function useEnrollWithAccessCode() {
  return useMutation({
    mutationFn: async (accessCode: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find course by access code
      const { data: course } = await supabase
        .from('instructor_courses')
        .select('id, title, is_published')
        .eq('access_code', accessCode.trim().toUpperCase())
        .maybeSingle();

      if (!course) throw new Error('Invalid access code');
      if (!course.is_published) throw new Error('This course is not yet published');

      // Check if already enrolled
      const { data: existing } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('student_id', user.id)
        .eq('instructor_course_id', course.id)
        .maybeSingle();

      if (existing) throw new Error('You are already enrolled in this course');

      // Create enrollment
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .insert({
          student_id: user.id,
          instructor_course_id: course.id,
        })
        .select()
        .single();

      return { enrollment, course };
    },
  });
}
```

### Course Detail with N+1 Optimization

The enrolled course detail query demonstrates efficient data fetching:

```typescript
export function useEnrolledCourseDetail(courseId: string | undefined) {
  return useQuery({
    queryFn: async () => {
      // Verify enrollment first
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('student_id', user.id)
        .eq('instructor_course_id', courseId)
        .maybeSingle();

      if (!enrollment) throw new Error('Not enrolled in this course');

      // Fetch course and modules separately
      const { data: course } = await supabase
        .from('instructor_courses')
        .select('id, title, code, description, verification_threshold')
        .eq('id', courseId)
        .single();

      const { data: modules } = await supabase
        .from('modules')
        .select('id, title, description, sequence_order')
        .eq('instructor_course_id', courseId)
        .order('sequence_order', { ascending: true });

      // KEY OPTIMIZATION: Fetch ALL learning objectives in ONE query
      // Instead of N queries (one per module), this is O(1) then grouped in-memory
      const { data: allLOs } = await supabase
        .from('learning_objectives')
        .select('id, text, bloom_level, verification_state, expected_duration_minutes, module_id')
        .eq('instructor_course_id', courseId)
        .order('sequence_order', { ascending: true });

      // Group LOs by module_id for O(1) lookups
      const losByModule = new Map<string | null, typeof allLOs>();
      allLOs?.forEach(lo => {
        const key = lo.module_id;
        const existing = losByModule.get(key) || [];
        existing.push(lo);
        losByModule.set(key, existing);
      });

      // Attach LOs to their respective modules
      const modulesWithLOs = (modules || []).map(module => ({
        ...module,
        learning_objectives: losByModule.get(module.id) || [],
      }));

      return { ...course, modules: modulesWithLOs };
    },
  });
}
```

---

## Chapter 12: The Dashboard Tapestry

### Location: `src/hooks/useDashboard.ts`

The dashboard weaves together data from multiple sources.

### The Overview Structure

```typescript
export interface DashboardOverview {
  totalCourses: number;
  totalDreamJobs: number;
  totalCapabilities: number;
  averageMatchScore: number;
  hasGapAnalysis: boolean;
  topGaps: { skill: string; severity: 'critical' | 'important' | 'minor'; dreamJob: string }[];
  recentRecommendations: { id: string; title: string; type: string; priority: 'high' | 'medium' | 'low' }[];
  progressSummary: {
    completedRecommendations: number;
    inProgressRecommendations: number;
    pendingRecommendations: number;
    skippedRecommendations: number;
    totalRecommendations: number;
    hoursInvested: number;
  };
  topRecommendation?: string;
}
```

### Parallel Data Fetching

The dashboard overview function demonstrates efficient parallel data fetching using `Promise.all`:

```typescript
async function fetchDashboardOverview(): Promise<DashboardOverview> {
  // First, get the authenticated user from Supabase auth
  // This is required for all subsequent queries that filter by user_id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch all data in PARALLEL for performance
  // Instead of sequential queries (slow), we fire all 5 queries simultaneously
  // This reduces total wait time from sum(query times) to max(query times)
  const [
    { data: courses },
    { data: dreamJobs },
    { data: capabilities },
    { data: recommendations },
    { data: gapAnalyses }
  ] = await Promise.all([
    supabase.from('courses').select('id').eq('user_id', user.id),
    supabase.from('dream_jobs').select('id, title, match_score').eq('user_id', user.id),
    supabase.from('capabilities').select('id, name').eq('user_id', user.id),
    supabase.from('recommendations').select('id, title, type, status, priority').eq('user_id', user.id),
    supabase.from('gap_analyses').select('id, dream_job_id, critical_gaps, priority_gaps').eq('user_id', user.id)
  ]);

  // Process and return aggregated data
  // (counts, averages, top items, progress summaries, etc.)
  return {
    totalCourses: courses?.length || 0,
    totalDreamJobs: dreamJobs?.length || 0,
    totalCapabilities: capabilities?.length || 0,
    // ... additional processing
  };
}
```

### The Dashboard Page

Located in `src/pages/Dashboard.tsx`, the dashboard composes multiple widgets:

```typescript
export default function DashboardPage() {
  useSEO(pageSEO.dashboard);
  useActivityTracking();  // Track user activity for re-engagement

  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: dreamJobs = [], isLoading: jobsLoading } = useDreamJobs();
  const { data: capabilities = [], isLoading: capsLoading } = useCapabilities();
  const { data: gapAnalyses = [], isLoading: gapsLoading } = useGapAnalysesForJobs();

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome Banner */}
        <WelcomeBackBanner />

        {/* Smart Next Action Banner */}
        <NextActionBanner stats={nextActionStats} isLoading={overviewLoading} />

        {/* Stats Cards Row */}
        <DashboardOverview stats={overviewStats} isLoading={overviewLoading || statsLoading} />

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <DreamJobCards jobs={transformedJobs} isLoading={jobsLoading} />
          </div>
          <div className="lg:col-span-3">
            <ProgressWidget recommendations={progressStats} isLoading={overviewLoading} />
          </div>
          <div className="lg:col-span-4">
            <CapabilitySnapshot capabilities={transformedCapabilities} isLoading={capsLoading} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
```

---

## Chapter 13: The Layout Architecture

### Location: `src/components/layout/AppShell.tsx`

The AppShell component provides the consistent layout for authenticated pages.

### The Structure

```typescript
export function AppShell({ children, showSearch = true }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - Fixed position, hidden on mobile */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex">
        <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
      </div>

      {/* Mobile Nav - Sheet overlay */}
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main content - Margin adjusts based on sidebar state */}
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        <AppHeader
          onMenuClick={() => setMobileNavOpen(true)}
          showSearch={showSearch}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Navigation Configuration

Located in `src/config/navigation.ts`:

```typescript
// Main navigation - always visible
export const mainNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'My Learning', href: '/learn', icon: GraduationCap },
  { name: 'Career Path', href: '/career', icon: Briefcase },
];

// Role-specific navigation
export const instructorNavigation: NavItem[] = [
  { name: 'Instructor Portal', href: '/instructor/courses', icon: School },
];

export const adminNavigation: NavItem[] = [
  { name: 'Admin Portal', href: '/admin', icon: Shield },
];

// Dynamic navigation builder
export function buildNavigation(roles: { role: string }[] = []): NavSection[] {
  const isInstructor = roles.some(r => r.role === 'instructor' || r.role === 'admin');
  const isAdmin = roles.some(r => r.role === 'admin');

  const sections: NavSection[] = [{ id: 'main', items: mainNavigation }];

  if (isInstructor) sections.push({ id: 'instructor', items: instructorNavigation });
  if (isAdmin) sections.push({ id: 'admin', items: adminNavigation });

  sections.push({ id: 'secondary', items: secondaryNavigation });

  return sections;
}
```

---

## Chapter 14: The Service Layer Secrets

### Syllabus Analysis Service

Located in `src/services/syllabus-service.ts`:

```typescript
export async function parseSyllabusDocument(file: File): Promise<ParseDocumentResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Upload file to syllabi bucket
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('syllabi')
    .upload(filePath, file);

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // 2. Get signed URL (expires in 1 hour)
  const { data: urlData } = await supabase.storage
    .from('syllabi')
    .createSignedUrl(filePath, 3600);

  // 3. Call edge function for AI analysis
  const { data, error } = await supabase.functions.invoke('parse-syllabus-document', {
    body: { document_url: urlData.signedUrl, file_name: file.name }
  });

  // 4. Return normalized response
  return {
    text: data.extracted_text || data.text || '',
    extracted_text: data.extracted_text,
    analysis: data.analysis,
    metadata: data.metadata,
  };
}
```

### Assessment Service

Located in `src/services/assessment-service.ts`:

```typescript
export async function extractLearningObjectives(
  moduleId: string,
  moduleTitle: string,
  moduleDescription: string,
  userId: string
): Promise<ExtractLOsResponse> {
  const { data, error } = await supabase.functions.invoke('extract-learning-objectives', {
    body: {
      module_id: moduleId,
      title: moduleTitle,
      description: moduleDescription,
      user_id: userId
    }
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function generateAssessmentQuestions(
  learningObjectiveId: string,
  questionCount: number = 5
): Promise<GenerateQuestionsResponse> {
  const { data, error } = await supabase.functions.invoke('generate-assessment-questions', {
    body: {
      learning_objective_id: learningObjectiveId,
      question_count: questionCount
    }
  });

  if (error) throw new Error(error.message);
  return data;
}
```

### Content Service (YouTube Integration)

Located in `src/services/content-service.ts`:

```typescript
export async function searchYouTubeContent(
  learningObjectiveId: string,
  searchQuery: string
): Promise<YouTubeSearchResponse> {
  const { data, error } = await supabase.functions.invoke('search-youtube-content', {
    body: {
      learning_objective_id: learningObjectiveId,
      query: searchQuery
    }
  });

  if (error) throw new Error(error.message);
  return data;
}
```

---

## Epilogue: The Data Flow Symphony

Let's trace a complete user journey through the application:

### Act 1: User Opens App

1. **main.tsx** renders `<App />`
2. **App.tsx** establishes provider hierarchy
3. **AuthProvider** checks for existing session
4. If logged in, **AuthGuard** allows access to protected routes
5. If not logged in, redirect to `/auth`

### Act 2: User Logs In

1. **Auth.tsx** renders login form
2. User submits credentials
3. **useAuth().signIn()** calls `supabase.auth.signInWithPassword()`
4. **onAuthStateChange** listener fires
5. Session and user state updated
6. Profile fetched from database
7. **GuestGuard** redirects to `/dashboard`

### Act 3: Dashboard Loads

1. **DashboardPage** mounts
2. Multiple hooks fire in parallel:
   - `useDashboardOverview()` - fetches aggregate stats
   - `useDreamJobs()` - fetches dream jobs
   - `useCapabilities()` - fetches skills
   - `useGapAnalysesForJobs()` - fetches all gap analyses
3. React Query caches all responses
4. Components render with data

### Act 4: User Adds a Course

1. User navigates to `/learn`
2. Clicks "Add Course"
3. **AddCourseForm** renders
4. User uploads syllabus PDF
5. **parseSyllabusDocument()** uploads to storage and calls edge function
6. Edge function extracts text and analyzes with AI
7. Returns capabilities list
8. **useCreateCourse()** saves course and capabilities
9. Cache invalidated, UI updates
10. Background: **refreshAllGapAnalyses()** runs (if stale)

### Act 5: User Checks Gap Analysis

1. User navigates to `/career?tab=gaps`
2. **CareerPathPage** mounts
3. **useGapAnalysis(dreamJobId)** fetches from database (fast, cached)
4. If user clicks "Refresh":
   - **useRefreshGapAnalysis()** calls `gap-analysis` edge function
   - AI compares capabilities to job requirements
   - Results saved to database
   - Cache updated via `setQueryData`
5. Gap visualization renders

### Act 6: User Completes Recommendation

1. User sees recommendation on Career Path page
2. Clicks status dropdown, selects "Completed"
3. **useUpdateRecommendationStatus()** updates database
4. Cache invalidated
5. Progress widget on dashboard reflects change

---

## The Technical Poetry

SyllabusStack is a symphony of modern web technologies working in harmony:

- **React 18** provides the component architecture
- **TypeScript** ensures type safety across the codebase
- **Vite** delivers fast development and optimized builds
- **Supabase** handles auth, database, storage, and edge functions
- **React Query** manages server state with intelligent caching
- **React Router** enables client-side navigation
- **Tailwind CSS + shadcn/ui** create a beautiful, consistent UI
- **Radix UI** provides accessible primitive components

The application demonstrates several key patterns:

1. **Separation of Concerns**: Services handle API calls, hooks manage state, components render UI
2. **Asynchronous Cache Management**: After mutations complete successfully, React Query's cache is intelligently updated using `onSuccess` callbacks. The application uses two strategies:
   - **Cache Invalidation**: `queryClient.invalidateQueries()` marks cached data as stale, triggering a background refetch
   - **Direct Cache Updates**: `queryClient.setQueryData()` directly updates the cache with mutation results (as seen in `useRefreshGapAnalysis`)

   *Note: This differs from true "optimistic updates" which would use `onMutate` to update the UI before the server confirms the mutation, with rollback on error.*
3. **Background Processing**: Heavy AI work happens without blocking UI
4. **Defensive Coding**: Every function checks auth state, handles errors gracefully
5. **Performance Optimization**: N+1 queries are avoided, parallel fetching is preferred

This is SyllabusStack - where education meets AI-powered career intelligence.

---

*Document generated by deep code analysis - January 2026*
