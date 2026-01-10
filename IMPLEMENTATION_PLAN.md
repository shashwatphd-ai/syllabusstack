# Performance Optimization Implementation Plan

**Based on:** PERFORMANCE_ANALYSIS.md (Deep Dive)
**Created:** January 10, 2026
**Scale Target:** 100,000 users

This document provides step-by-step implementation instructions optimized for production scale.

---

## Implementation Phases Overview

| Phase | Focus | User Scale | Timeline |
|-------|-------|------------|----------|
| Phase 1 | Critical & Security | 0 → 10K | Immediate |
| Phase 2 | Database & Caching | 10K → 50K | Week 1-2 |
| Phase 3 | Frontend & UX | 50K → 100K | Week 3-4 |
| Phase 4 | Advanced Scaling | 100K+ | Ongoing |

---

## Phase 1: Critical Fixes (Before 10K Users)

### 1.1 Fix Missing User Filter (SECURITY CRITICAL)

**File:** `supabase/functions/generate-recommendations/index.ts`
**Effort:** 5 minutes
**Impact:** Prevents data breach and crashes

#### Current Code (Line 66-68):
```typescript
const { data: capabilities } = await supabase
  .from("capabilities")
  .select("name, category, proficiency_level");
```

#### Fixed Code:
```typescript
const { data: capabilities } = await supabase
  .from("capabilities")
  .select("name, category, proficiency_level")
  .eq("user_id", userId);
```

#### Verification:
```bash
supabase functions deploy generate-recommendations
# Test: Verify only returns current user's capabilities (should be ~20, not millions)
```

---

### 1.2 Add Critical Database Indexes

**File:** Create new migration `supabase/migrations/[timestamp]_add_performance_indexes.sql`
**Effort:** 30 minutes
**Impact:** 100× faster queries at scale

```sql
-- =============================================
-- CRITICAL INDEXES FOR 100K USERS
-- =============================================

-- 1. Capabilities lookup (used in gap analysis, recommendations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capabilities_user_id
ON capabilities(user_id);

-- 2. Learning objectives by course (every course view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lo_instructor_course
ON learning_objectives(instructor_course_id);

-- 3. Learning objectives by module (module views)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lo_module
ON learning_objectives(module_id) WHERE module_id IS NOT NULL;

-- 4. Consumption records (progress tracking - HOT PATH)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consumption_user_lo
ON consumption_records(user_id, learning_objective_id);

-- 5. Recommendations by user and dream job
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_user_job
ON recommendations(user_id, dream_job_id) WHERE deleted_at IS NULL;

-- 6. Dream jobs by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dream_jobs_user
ON dream_jobs(user_id);

-- 7. Courses by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courses_user
ON courses(user_id);

-- 8. Gap analyses by user and job
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gap_analyses_user_job
ON gap_analyses(user_id, dream_job_id);

-- 9. Modules by course (for syllabus loading)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_modules_course
ON modules(instructor_course_id);

-- 10. Content matches by LO (for content display)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_matches_lo
ON content_matches(learning_objective_id);

-- =============================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- =============================================

-- Dashboard queries (courses with status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courses_user_status
ON courses(user_id, analysis_status);

-- Student progress queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consumption_lo_user_verified
ON consumption_records(learning_objective_id, user_id, is_verified);

-- =============================================
-- ANALYZE TABLES AFTER INDEX CREATION
-- =============================================
ANALYZE capabilities;
ANALYZE learning_objectives;
ANALYZE consumption_records;
ANALYZE recommendations;
ANALYZE dream_jobs;
ANALYZE courses;
ANALYZE gap_analyses;
ANALYZE modules;
ANALYZE content_matches;
```

#### Verification:
```sql
-- Check indexes were created
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('capabilities', 'learning_objectives', 'consumption_records');

-- Test query performance
EXPLAIN ANALYZE SELECT * FROM capabilities WHERE user_id = '[test-uuid]';
-- Should show "Index Scan" not "Seq Scan"
```

---

### 1.3 Optimize RLS Policies

**File:** Create migration `supabase/migrations/[timestamp]_optimize_rls_policies.sql`
**Effort:** 1 hour
**Impact:** Eliminates subquery overhead on every row

```sql
-- =============================================
-- OPTIMIZED RLS POLICIES FOR SCALE
-- =============================================

-- Step 1: Add denormalized course access for students
ALTER TABLE learning_objectives
ADD COLUMN IF NOT EXISTS accessible_student_ids UUID[] DEFAULT '{}';

-- Step 2: Create function to update accessible students
CREATE OR REPLACE FUNCTION update_lo_accessible_students()
RETURNS TRIGGER AS $$
BEGIN
  -- When enrollment changes, update LO access list
  IF TG_OP = 'INSERT' THEN
    UPDATE learning_objectives
    SET accessible_student_ids = array_append(accessible_student_ids, NEW.student_id)
    WHERE instructor_course_id = NEW.instructor_course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE learning_objectives
    SET accessible_student_ids = array_remove(accessible_student_ids, OLD.student_id)
    WHERE instructor_course_id = OLD.instructor_course_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger
DROP TRIGGER IF EXISTS trg_update_lo_access ON course_enrollments;
CREATE TRIGGER trg_update_lo_access
AFTER INSERT OR DELETE ON course_enrollments
FOR EACH ROW EXECUTE FUNCTION update_lo_accessible_students();

-- Step 4: Backfill existing enrollments
UPDATE learning_objectives lo
SET accessible_student_ids = (
  SELECT COALESCE(array_agg(ce.student_id), '{}')
  FROM course_enrollments ce
  WHERE ce.instructor_course_id = lo.instructor_course_id
);

-- Step 5: Create optimized RLS policy
DROP POLICY IF EXISTS "Students can view LOs from enrolled courses" ON learning_objectives;

CREATE POLICY "Students can view LOs - optimized"
ON learning_objectives
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Owner check (fast)
  OR
  auth.uid() = ANY(accessible_student_ids)  -- Array contains check (fast with GIN index)
);

-- Step 6: Add GIN index for array lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lo_accessible_students
ON learning_objectives USING GIN(accessible_student_ids);
```

---

### 1.4 Batch Learning Objective Inserts

**File:** `supabase/functions/extract-learning-objectives/index.ts`
**Effort:** 30 minutes
**Impact:** 15× faster, 90% fewer connections

#### Fixed Code:
```typescript
// Build all LO data objects first
const loDataArray = learningObjectives.map((lo) => {
  const bloomLevel = lo.bloom_level || "understand";
  const specificity = lo.specificity || "intermediate";
  const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

  return {
    user_id: user.id,
    instructor_course_id: instructorCourseId || null,
    module_id: targetModuleId || null,
    text: lo.text,
    core_concept: lo.core_concept,
    action_verb: lo.action_verb,
    bloom_level: bloomLevel,
    domain: lo.domain || "other",
    specificity: specificity,
    search_keywords: lo.search_keywords || [],
    expected_duration_minutes: expectedDuration,
    verification_state: "unstarted",
  };
});

// Validate before insert (prevents partial failures)
const validLOs = loDataArray.filter(lo =>
  lo.text && lo.text.trim().length > 0 &&
  lo.core_concept && lo.core_concept.trim().length > 0
);

if (validLOs.length === 0) {
  throw new Error("No valid learning objectives to save");
}

// Single batch insert
const { data: savedLOs, error: saveError } = await supabaseClient
  .from("learning_objectives")
  .insert(validLOs)
  .select();

if (saveError) {
  console.error("Batch insert failed:", saveError);
  throw new Error(`Failed to save learning objectives: ${saveError.message}`);
}

console.log(`Batch inserted ${savedLOs?.length || 0} learning objectives`);
```

---

### 1.5 Batch Module and LO Inserts

**File:** `supabase/functions/process-syllabus/index.ts`
**Effort:** 45 minutes
**Impact:** 12× faster syllabus processing

#### Fixed Code:
```typescript
// ========== STEP 3: Batch Save Modules and LOs ==========

// Step 3a: Batch insert all modules
const moduleDataArray = courseStructure.modules.map((module, i) => ({
  instructor_course_id: instructor_course_id,
  title: module.title,
  description: module.description || null,
  sequence_order: i + 1,
}));

const { data: savedModules, error: moduleError } = await supabaseClient
  .from("modules")
  .insert(moduleDataArray)
  .select();

if (moduleError) {
  console.error("Batch module insert failed:", moduleError);
  throw new Error("Failed to save modules");
}

// Step 3b: Build module lookup by sequence (handles duplicate titles)
const moduleIdBySequence = new Map<number, string>();
savedModules.forEach((m, idx) => {
  moduleIdBySequence.set(idx, m.id);
});

// Step 3c: Build all LO data with correct module references
let sequenceOrder = 1;
const loDataArray: any[] = [];

courseStructure.modules.forEach((module, moduleIndex) => {
  const moduleId = moduleIdBySequence.get(moduleIndex);

  for (const lo of module.learning_objectives) {
    const bloomLevel = lo.bloom_level || "understand";
    const specificity = lo.specificity || "intermediate";
    const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

    loDataArray.push({
      user_id: user.id,
      instructor_course_id: instructor_course_id,
      module_id: moduleId,
      text: lo.text,
      core_concept: lo.core_concept,
      action_verb: lo.action_verb,
      bloom_level: bloomLevel,
      domain: lo.domain || "other",
      specificity: specificity,
      search_keywords: lo.search_keywords || [],
      expected_duration_minutes: expectedDuration,
      verification_state: "unstarted",
      sequence_order: sequenceOrder++,
    });
  }
});

// Add unassigned objectives
for (const lo of courseStructure.unassigned_objectives || []) {
  const bloomLevel = lo.bloom_level || "understand";
  const specificity = lo.specificity || "intermediate";
  const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

  loDataArray.push({
    user_id: user.id,
    instructor_course_id: instructor_course_id,
    module_id: null,
    text: lo.text,
    core_concept: lo.core_concept,
    action_verb: lo.action_verb,
    bloom_level: bloomLevel,
    domain: lo.domain || "other",
    specificity: specificity,
    search_keywords: lo.search_keywords || [],
    expected_duration_minutes: expectedDuration,
    verification_state: "unstarted",
    sequence_order: sequenceOrder++,
  });
}

// Step 3d: Batch insert all LOs
if (loDataArray.length > 0) {
  const { data: savedLOs, error: loError } = await supabaseClient
    .from("learning_objectives")
    .insert(loDataArray)
    .select();

  if (loError) {
    console.error("Batch LO insert failed:", loError);
    // Don't throw - modules were saved, log for debugging
  }

  console.log(`Created ${savedModules.length} modules and ${savedLOs?.length || 0} LOs`);
}
```

---

### 1.6 Fix O(n³) Algorithm with Map Lookups

**File:** `src/hooks/useInstructorCourses.ts`
**Effort:** 30 minutes
**Impact:** 1000× faster for large classes

#### Fixed Code:
```typescript
// Build lookup maps ONCE - O(n) total
const consumptionMap = new Map<string, typeof consumption[0]>();
consumption?.forEach(c => {
  // Use pipe separator to avoid collision with UUIDs containing hyphens
  consumptionMap.set(`${c.user_id}|${c.learning_objective_id}`, c);
});

const loStateMap = new Map<string, typeof loStates[0]>();
loStates?.forEach(s => {
  loStateMap.set(s.id, s);
});

// Build progress with O(1) lookups - O(students × LOs) total
const loProgress: Record<string, StudentLOProgress[]> = {};

for (const studentId of studentIds) {
  const studentProgress: StudentLOProgress[] = [];

  for (const lo of los) {
    // O(1) lookup instead of O(n) find
    const consumptionRecord = consumptionMap.get(`${studentId}|${lo.id}`);
    const loState = loStateMap.get(lo.id);

    studentProgress.push({
      learning_objective_id: lo.id,
      verification_state: loState?.verification_state || 'unstarted',
      content_watched: consumptionRecord?.watch_percentage || 0,
      micro_checks_passed: consumptionRecord?.is_verified ? 1 : 0,
    });
  }

  loProgress[studentId] = studentProgress;
}
```

---

## Phase 2: Database & Caching (Before 50K Users)

### 2.1 Add staleTime to All Hooks

**Files:** Multiple hooks
**Effort:** 30 minutes total
**Impact:** 80% reduction in API calls

```typescript
// src/hooks/useCourses.ts
export function useCourses() {
  return useQuery({
    queryKey: queryKeys.coursesList(),
    queryFn: fetchCourses,
    staleTime: 1000 * 60 * 5,      // 5 minutes
    gcTime: 1000 * 60 * 30,        // 30 minutes (formerly cacheTime)
  });
}

// src/hooks/useDashboard.ts
export function useDashboardOverview() {
  return useQuery({
    queryKey: queryKeys.dashboard.overview,
    queryFn: fetchDashboardOverview,
    staleTime: 1000 * 60 * 2,      // 2 minutes (changes more often)
    gcTime: 1000 * 60 * 10,        // 10 minutes
  });
}

// src/hooks/useCapabilities.ts
export function useCapabilities() {
  return useQuery({
    queryKey: queryKeys.capabilities(),
    queryFn: fetchCapabilities,
    staleTime: 1000 * 60 * 10,     // 10 minutes (rarely changes)
    gcTime: 1000 * 60 * 60,        // 1 hour
  });
}

// Apply similar pattern to:
// - useInstructorCourses.ts (5 min)
// - useDreamJobs.ts (10 min)
// - useRecommendations.ts (5 min)
// - useProfile.ts (10 min)
```

---

### 2.2 Implement Rate Limiting

**File:** Create `supabase/functions/_shared/rate-limit.ts`
**Effort:** 2 hours
**Impact:** Cost protection, abuse prevention

```typescript
// Rate limiting utility for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

interface RateLimitConfig {
  windowMs: number;      // Time window in ms
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Redis/KV key prefix
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  'generate-recommendations': { windowMs: 60000, maxRequests: 5, keyPrefix: 'rl:rec' },
  'gap-analysis': { windowMs: 60000, maxRequests: 10, keyPrefix: 'rl:gap' },
  'discover-dream-jobs': { windowMs: 300000, maxRequests: 3, keyPrefix: 'rl:discover' },
  'parse-syllabus-document': { windowMs: 60000, maxRequests: 10, keyPrefix: 'rl:parse' },
};

export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  functionName: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = DEFAULT_LIMITS[functionName] || { windowMs: 60000, maxRequests: 100, keyPrefix: 'rl:default' };
  const key = `${config.keyPrefix}:${userId}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Use Supabase table for rate limit tracking (or Redis if available)
  const { data: entries } = await supabase
    .from('rate_limits')
    .select('timestamp')
    .eq('key', key)
    .gte('timestamp', new Date(windowStart).toISOString());

  const requestCount = entries?.length || 0;
  const allowed = requestCount < config.maxRequests;

  if (allowed) {
    // Record this request
    await supabase.from('rate_limits').insert({
      key,
      timestamp: new Date().toISOString(),
      function_name: functionName,
    });
  }

  // Clean up old entries (async, don't await)
  supabase
    .from('rate_limits')
    .delete()
    .lt('timestamp', new Date(windowStart).toISOString())
    .then(() => {});

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - requestCount - 1),
    resetAt: new Date(now + config.windowMs),
  };
}

// Rate limit table migration
/*
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  function_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limits_key_timestamp ON rate_limits(key, timestamp DESC);

-- Auto-cleanup old entries (run daily via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void AS $$
  DELETE FROM rate_limits WHERE timestamp < now() - interval '1 hour';
$$ LANGUAGE sql;
*/
```

#### Usage in Edge Functions:
```typescript
import { checkRateLimit } from "../_shared/rate-limit.ts";

// At the start of the function:
const { allowed, remaining, resetAt } = await checkRateLimit(supabase, user.id, 'generate-recommendations');

if (!allowed) {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: resetAt.toISOString(),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Retry-After': Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString(),
      }
    }
  );
}
```

---

### 2.3 Parallelize Global Search

**File:** `supabase/functions/global-search/index.ts`
**Effort:** 15 minutes
**Impact:** 4× faster search

```typescript
// Use Promise.allSettled for graceful degradation
const searchTerm = `%${query.trim().toLowerCase()}%`;

const [coursesResult, dreamJobsResult, recommendationsResult, capabilitiesResult] =
  await Promise.allSettled([
    supabase
      .from("courses")
      .select("id, title, code, instructor")
      .eq("user_id", user.id)
      .or(`title.ilike.${searchTerm},code.ilike.${searchTerm}`)
      .limit(5),
    supabase
      .from("dream_jobs")
      .select("id, title, company_type, location")
      .eq("user_id", user.id)
      .or(`title.ilike.${searchTerm},company_type.ilike.${searchTerm}`)
      .limit(5),
    supabase
      .from("recommendations")
      .select("id, title, type, provider")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .or(`title.ilike.${searchTerm},provider.ilike.${searchTerm}`)
      .limit(5),
    supabase
      .from("capabilities")
      .select("id, name, category, proficiency_level")
      .eq("user_id", user.id)
      .or(`name.ilike.${searchTerm},category.ilike.${searchTerm}`)
      .limit(5),
  ]);

// Extract results with fallback to empty arrays
const courses = coursesResult.status === 'fulfilled' ? coursesResult.value.data || [] : [];
const dreamJobs = dreamJobsResult.status === 'fulfilled' ? dreamJobsResult.value.data || [] : [];
const recommendations = recommendationsResult.status === 'fulfilled' ? recommendationsResult.value.data || [] : [];
const capabilities = capabilitiesResult.status === 'fulfilled' ? capabilitiesResult.value.data || [] : [];

// Log any failures for monitoring
[coursesResult, dreamJobsResult, recommendationsResult, capabilitiesResult].forEach((result, idx) => {
  if (result.status === 'rejected') {
    console.error(`Search query ${idx} failed:`, result.reason);
  }
});
```

---

### 2.4 Add Pagination to Large Lists

**File:** `src/hooks/useCourses.ts` (and similar hooks)
**Effort:** 2 hours
**Impact:** 90% smaller payloads

```typescript
interface PaginationParams {
  page?: number;
  pageSize?: number;
}

interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function useCoursesPaginated({ page = 1, pageSize = 20 }: PaginationParams = {}) {
  return useQuery({
    queryKey: ['courses', 'paginated', page, pageSize],
    queryFn: async (): Promise<PaginatedResult<Course>> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Get total count (use count query for efficiency)
      const { count } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get paginated data
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        data: data || [],
        totalCount: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > to + 1,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Infinite scroll variant
export function useCoursesInfinite(pageSize = 20) {
  return useInfiniteQuery({
    queryKey: ['courses', 'infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + pageSize - 1);

      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < pageSize) return undefined;
      return allPages.flat().length;
    },
    staleTime: 1000 * 60 * 5,
  });
}
```

---

## Phase 3: Frontend Optimization (Before 100K Users)

### 3.1 Consolidate TooltipProviders

**File:** `src/components/instructor/UnifiedLOCard.tsx`
**Effort:** 30 minutes

#### Step 1: Add TooltipProvider to parent
```tsx
// In the parent component (e.g., CourseDetail.tsx)
import { TooltipProvider } from '@/components/ui/tooltip';

<TooltipProvider delayDuration={300}>
  {learningObjectives.map(lo => (
    <UnifiedLOCard key={lo.id} learningObjective={lo} />
  ))}
</TooltipProvider>
```

#### Step 2: Remove all TooltipProvider wrappers in UnifiedLOCard.tsx
Search for `<TooltipProvider>` and `</TooltipProvider>` and remove them, keeping the inner `<Tooltip>` components.

---

### 3.2 Add useMemo/useCallback

**File:** `src/pages/Learn.tsx`
**Effort:** 15 minutes

```typescript
const filteredSkills = useMemo(() =>
  skillProfile.filter(skill =>
    skill.skill_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.source_name.toLowerCase().includes(searchQuery.toLowerCase())
  ),
  [skillProfile, searchQuery]
);

const groupedSkills = useMemo(() =>
  filteredSkills.reduce((acc, skill) => {
    const category = skill.verified ? "verified" : "self_reported";
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {} as Record<string, SkillProfile[]>),
  [filteredSkills]
);
```

---

### 3.3 Optimize Dropdown Handlers

**File:** `src/pages/Courses.tsx`
**Effort:** 45 minutes

```typescript
// Create stable handler references
const handleViewDetails = useCallback((e: React.MouseEvent<HTMLElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  if (courseId) navigate(`/courses/${courseId}`);
}, [navigate]);

const handleEdit = useCallback((e: React.MouseEvent<HTMLElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  const course = courses?.find(c => c.id === courseId);
  if (course) handleEditCourse(course);
}, [courses, handleEditCourse]);

const handleDelete = useCallback((e: React.MouseEvent<HTMLElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  const course = courses?.find(c => c.id === courseId);
  if (course) setDeletingCourse(course);
}, [courses]);

// Use in JSX with data attributes
<DropdownMenuItem data-course-id={course.id} onClick={handleViewDetails}>
  <Eye className="h-4 w-4 mr-2" /> View Details
</DropdownMenuItem>
```

---

## Phase 4: Advanced Scaling (100K+ Users)

### 4.1 Background Job Queue

**Implementation:** Use Supabase Edge Functions with pg_cron or external queue (e.g., Inngest, Trigger.dev)

```typescript
// Create a job queue table
/*
CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_queue_status ON job_queue(status, scheduled_at) WHERE status = 'pending';
*/

// Queue a job instead of running synchronously
async function queueSyllabusProcessing(userId: string, courseId: string, documentBase64: string) {
  await supabase.from('job_queue').insert({
    user_id: userId,
    job_type: 'process_syllabus',
    payload: { courseId, documentBase64 },
  });

  // Return job ID for status polling
  return { queued: true, message: 'Syllabus processing started' };
}

// Client polls for status
export function useJobStatus(jobId: string) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_queue')
        .select('status, error, completed_at')
        .eq('id', jobId)
        .single();
      return data;
    },
    refetchInterval: (data) =>
      data?.status === 'completed' || data?.status === 'failed' ? false : 2000,
  });
}
```

---

### 4.2 WebSocket for Real-time Updates

**Replace polling with Supabase Realtime:**

```typescript
// Instead of polling every 30 seconds
export function useAchievementsRealtime() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    // Initial fetch
    fetchAchievements().then(setAchievements);

    // Subscribe to changes
    const subscription = supabase
      .channel('achievements')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_achievements',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setAchievements(prev => [...prev, payload.new as Achievement]);
          // Show toast notification
          toast({ title: 'New Achievement!', description: payload.new.title });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return achievements;
}
```

---

## Verification Checklist

### Phase 1 Complete:
- [ ] User filter added - verify no data leakage
- [ ] Indexes created - verify query plans show "Index Scan"
- [ ] RLS optimized - verify no subquery overhead
- [ ] Batch inserts working - verify syllabus upload < 5 seconds
- [ ] Map lookups - verify instructor dashboard loads < 1 second

### Phase 2 Complete:
- [ ] staleTime configured - verify reduced API calls in Network tab
- [ ] Rate limiting active - verify 429 responses on abuse
- [ ] Search parallelized - verify < 100ms response
- [ ] Pagination working - verify payload sizes < 20KB

### Phase 3 Complete:
- [ ] Single TooltipProvider - verify all tooltips work
- [ ] useMemo/useCallback - verify React DevTools shows fewer renders
- [ ] Handlers optimized - verify no jank on course list

### Phase 4 Complete:
- [ ] Background jobs - verify no timeout errors
- [ ] WebSocket - verify no polling in Network tab

---

## Monitoring Recommendations

```typescript
// Add to Edge Functions
console.time('function-name');
// ... function code ...
console.timeEnd('function-name');

// Add custom metrics
await supabase.from('metrics').insert({
  function_name: 'process-syllabus',
  duration_ms: endTime - startTime,
  user_id: user.id,
  success: true,
});
```

---

*Implementation plan updated for 100K user scale on January 10, 2026*
