# Performance Optimization Implementation Plan

**Based on:** PERFORMANCE_ANALYSIS.md (Deep Dive)
**Created:** January 10, 2026

This document provides step-by-step implementation instructions for each identified performance issue.

---

## Phase 1: Critical Fixes (Immediate - 2-3 hours)

### 1.1 Fix Missing User Filter (SECURITY + PERFORMANCE)

**File:** `supabase/functions/generate-recommendations/index.ts`
**Effort:** 5 minutes

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
# Deploy and test
supabase functions deploy generate-recommendations
# Test with a specific user
curl -X POST https://[project].supabase.co/functions/v1/generate-recommendations \
  -H "Authorization: Bearer [token]" \
  -d '{"dreamJobId": "..."}'
```

---

### 1.2 Consolidate TooltipProviders

**File:** `src/components/instructor/UnifiedLOCard.tsx`
**Effort:** 30 minutes

#### Step 1: Add TooltipProvider to parent component

In the file that renders `UnifiedLOCard` (likely a course detail page), wrap the list:

```tsx
import { TooltipProvider } from '@/components/ui/tooltip';

// In the parent component's render:
<TooltipProvider>
  {learningObjectives.map(lo => (
    <UnifiedLOCard key={lo.id} learningObjective={lo} ... />
  ))}
</TooltipProvider>
```

#### Step 2: Remove all TooltipProvider wrappers in UnifiedLOCard.tsx

Search and replace all instances. Remove lines containing `<TooltipProvider>` and `</TooltipProvider>` at:
- Lines 146, 160-161 (bloom level tooltip)
- Lines 165, 190-191 (duration tooltip)
- Lines 502, 515-516 (AI concern tooltip)
- Lines 520, 554-555 (AI reasoning tooltip)
- Lines 559, 582-583 (cross-module tooltip)
- Lines 601, 612-613 (approval badge tooltip)
- Lines 615, 635-636 (external link tooltip)
- Lines 642, 656-657 (approve button tooltip)
- Lines 658, 672-673 (reject button tooltip)

Keep the `<Tooltip>`, `<TooltipTrigger>`, and `<TooltipContent>` elements.

#### Verification:
```bash
npm run dev
# Navigate to instructor course page with LOs
# Verify all tooltips still work
```

---

### 1.3 Batch Learning Objective Inserts

**File:** `supabase/functions/extract-learning-objectives/index.ts`
**Effort:** 30 minutes

#### Current Code (Lines 179-212):
```typescript
const savedLOs = [];
for (const lo of learningObjectives) {
  const loData = { ... };
  const { data: savedLO, error: saveError } = await supabaseClient
    .from("learning_objectives")
    .insert(loData)
    .select()
    .single();
  if (!saveError) savedLOs.push(savedLO);
}
```

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

// Single batch insert
const { data: savedLOs, error: saveError } = await supabaseClient
  .from("learning_objectives")
  .insert(loDataArray)
  .select();

if (saveError) {
  console.error("Error saving learning objectives:", saveError);
  throw new Error("Failed to save learning objectives");
}

console.log(`Extracted and saved ${savedLOs?.length || 0} learning objectives`);
```

---

### 1.4 Batch Module and LO Inserts in process-syllabus

**File:** `supabase/functions/process-syllabus/index.ts`
**Effort:** 45 minutes

#### Current Code (Lines 276-364):
Nested loops with individual inserts.

#### Fixed Code:
```typescript
// ========== STEP 3: Save modules and learning objectives to database ==========

// Step 3a: Prepare all module data
const moduleDataArray = courseStructure.modules.map((module, i) => ({
  instructor_course_id: instructor_course_id,
  title: module.title,
  description: module.description || null,
  sequence_order: i + 1,
}));

// Step 3b: Batch insert all modules
const { data: savedModules, error: moduleError } = await supabaseClient
  .from("modules")
  .insert(moduleDataArray)
  .select();

if (moduleError) {
  console.error("Error saving modules:", moduleError);
  throw new Error("Failed to save modules");
}

// Step 3c: Build module ID map (title -> id) for LO assignment
const moduleIdMap = new Map(savedModules.map(m => [m.title, m.id]));

// Step 3d: Prepare all LO data (including module_id references)
let sequenceOrder = 1;
const loDataArray: any[] = [];

for (const module of courseStructure.modules) {
  const moduleId = moduleIdMap.get(module.title);

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
}

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

// Step 3e: Batch insert all LOs
const { data: savedLOs, error: loError } = await supabaseClient
  .from("learning_objectives")
  .insert(loDataArray)
  .select();

if (loError) {
  console.error("Error saving learning objectives:", loError);
  // Continue - modules were saved successfully
}

console.log(`Created ${savedModules.length} modules and ${savedLOs?.length || 0} learning objectives`);
```

---

### 1.5 Fix O(n³) Nested Loop with Map Lookups

**File:** `src/hooks/useInstructorCourses.ts`
**Effort:** 30 minutes

#### Current Code (Lines 343-360):
```typescript
for (const studentId of studentIds) {
  const studentConsumption = consumption?.filter(c => c.user_id === studentId) || [];
  const studentProgress: StudentLOProgress[] = [];

  for (const lo of los) {
    const consumptionRecord = studentConsumption.find(c => c.learning_objective_id === lo.id);
    const loState = loStates?.find(s => s.id === lo.id);
    // ...
  }
}
```

#### Fixed Code:
```typescript
// Build lookup maps ONCE - O(n)
const consumptionMap = new Map<string, typeof consumption[0]>();
consumption?.forEach(c => {
  consumptionMap.set(`${c.user_id}-${c.learning_objective_id}`, c);
});

const loStateMap = new Map<string, typeof loStates[0]>();
loStates?.forEach(s => {
  loStateMap.set(s.id, s);
});

// Build progress map for each student using O(1) lookups
for (const studentId of studentIds) {
  const studentProgress: StudentLOProgress[] = [];

  for (const lo of los) {
    const consumptionRecord = consumptionMap.get(`${studentId}-${lo.id}`);
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

## Phase 2: High Priority Fixes (Next Sprint - 3-4 hours)

### 2.1 Parallelize Global Search Queries

**File:** `supabase/functions/global-search/index.ts`
**Effort:** 15 minutes

#### Current Code (Lines 58-135):
Sequential queries.

#### Fixed Code:
```typescript
const searchTerm = `%${query.trim().toLowerCase()}%`;

// Execute all searches in parallel
const [coursesResult, dreamJobsResult, recommendationsResult, capabilitiesResult] = await Promise.all([
  supabase
    .from("courses")
    .select("id, title, code, instructor")
    .eq("user_id", user.id)
    .or(`title.ilike.${searchTerm},code.ilike.${searchTerm},instructor.ilike.${searchTerm}`)
    .limit(5),
  supabase
    .from("dream_jobs")
    .select("id, title, company_type, location")
    .eq("user_id", user.id)
    .or(`title.ilike.${searchTerm},company_type.ilike.${searchTerm},location.ilike.${searchTerm}`)
    .limit(5),
  supabase
    .from("recommendations")
    .select("id, title, type, provider")
    .eq("user_id", user.id)
    .or(`title.ilike.${searchTerm},provider.ilike.${searchTerm},description.ilike.${searchTerm}`)
    .limit(5),
  supabase
    .from("capabilities")
    .select("id, name, category, proficiency_level")
    .eq("user_id", user.id)
    .or(`name.ilike.${searchTerm},category.ilike.${searchTerm}`)
    .limit(5),
]);

const courses = coursesResult.data;
const dreamJobs = dreamJobsResult.data;
const recommendations = recommendationsResult.data;
const capabilities = capabilitiesResult.data;

// Rest of the code remains the same...
```

---

### 2.2 Add staleTime to Hooks

**Files:** Multiple hooks files
**Effort:** 30 minutes total

#### useCourses.ts (Lines 140-153):
```typescript
export function useCourses() {
  return useQuery({
    queryKey: queryKeys.coursesList(),
    queryFn: fetchCourses,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: queryKeys.courseDetail(id),
    queryFn: () => fetchCourseById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

#### useInstructorCourses.ts (Line 30-43):
```typescript
export function useInstructorCourses() {
  return useQuery({
    queryKey: ['instructor-courses'],
    queryFn: async () => { ... },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

#### useDashboard.ts (Lines 181-193):
```typescript
export function useDashboardOverview() {
  return useQuery({
    queryKey: queryKeys.dashboard.overview,
    queryFn: fetchDashboardOverview,
    staleTime: 1000 * 60 * 2, // 2 minutes - dashboard data changes more often
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: fetchDashboardStats,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
```

---

### 2.3 Add useMemo to Learn.tsx

**File:** `src/pages/Learn.tsx`
**Effort:** 15 minutes

#### Current Code (Lines 264-275):
```typescript
const filteredSkills = skillProfile.filter(skill => ...);
const groupedSkills = filteredSkills.reduce(...);
```

#### Fixed Code:
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

### 2.4 Optimize Dropdown Handlers in Courses.tsx

**File:** `src/pages/Courses.tsx`
**Effort:** 45 minutes

#### Step 1: Create memoized handlers at component top level:
```typescript
// Add after other state declarations (~line 155)

const handleViewDetails = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  if (courseId) navigate(`/courses/${courseId}`);
}, [navigate]);

const handleEditClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  const course = courses?.find(c => c.id === courseId);
  if (course) handleEditCourse(course);
}, [courses, handleEditCourse]);

const handleDeleteClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  const course = courses?.find(c => c.id === courseId);
  if (course) setDeletingCourse(course);
}, [courses]);

const handleMarkCompleted = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  const course = courses?.find(c => c.id === courseId);
  if (course) handleQuickStatusChange(course, "completed");
}, [courses, handleQuickStatusChange]);

const handleMarkInProgress = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  const course = courses?.find(c => c.id === courseId);
  if (course) handleQuickStatusChange(course, "in_progress");
}, [courses, handleQuickStatusChange]);

const handleMarkPlanned = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  const course = courses?.find(c => c.id === courseId);
  if (course) handleQuickStatusChange(course, "planned");
}, [courses, handleQuickStatusChange]);

const handleReanalyze = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
  const courseId = e.currentTarget.dataset.courseId;
  const course = courses?.find(c => c.id === courseId);
  if (course) handleReanalyzeClick(course);
}, [courses, handleReanalyzeClick]);
```

#### Step 2: Update JSX to use data attributes:
```tsx
<DropdownMenuItem
  data-course-id={course.id}
  onClick={handleViewDetails}
>
  <Eye className="h-4 w-4 mr-2" />
  View Details
</DropdownMenuItem>

<DropdownMenuItem
  data-course-id={course.id}
  onClick={handleEditClick}
>
  <Pencil className="h-4 w-4 mr-2" />
  Edit Course
</DropdownMenuItem>

{/* Repeat for all other menu items... */}
```

---

### 2.5 Improve Cache Invalidation Granularity

**File:** `src/hooks/useCourses.ts`
**Effort:** 30 minutes

#### Current Code (Lines 160-165):
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.courses });
  queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
  queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  // ...
}
```

#### Fixed Code:
```typescript
// For useCreateCourse:
onSuccess: (newCourse) => {
  // Add to cache optimistically
  queryClient.setQueryData<Course[]>(queryKeys.coursesList(), (old) =>
    old ? [newCourse, ...old] : [newCourse]
  );

  // Only invalidate what's truly affected
  queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview });

  // Background refresh (don't block UI)
  refreshAllGapAnalyses().catch(console.error);
  // ...
}

// For useUpdateCourse:
onSuccess: (updatedCourse, variables) => {
  // Update specific course in cache
  queryClient.setQueryData<Course>(
    queryKeys.courseDetail(variables.id),
    updatedCourse
  );

  // Update in list cache
  queryClient.setQueryData<Course[]>(queryKeys.coursesList(), (old) =>
    old?.map(c => c.id === variables.id ? updatedCourse : c)
  );

  // Only invalidate capabilities if title/content changed
  if (variables.updates.title || variables.updates.capability_text) {
    queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
  }
  // ...
}

// For useDeleteCourse:
onSuccess: (_, deletedId) => {
  // Remove from cache immediately
  queryClient.setQueryData<Course[]>(queryKeys.coursesList(), (old) =>
    old?.filter(c => c.id !== deletedId)
  );
  queryClient.removeQueries({ queryKey: queryKeys.courseDetail(deletedId) });

  // Invalidate related data
  queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview });
  // ...
}
```

---

## Phase 3: Medium Priority Fixes (Backlog - 2-3 hours)

### 3.1 Fix O(n²) String Concatenation

**Files:** 4 files with same pattern
**Effort:** 15 minutes per file

#### Pattern to find:
```typescript
let binary = '';
for (let i = 0; i < bytes.byteLength; i++) {
  binary += String.fromCharCode(bytes[i]);
}
```

#### Replacement:
```typescript
const chars = new Array(bytes.byteLength);
for (let i = 0; i < bytes.byteLength; i++) {
  chars[i] = String.fromCharCode(bytes[i]);
}
const binary = chars.join('');
```

#### Files to update:
1. `supabase/functions/process-syllabus/index.ts` (Lines 117-121)
2. `src/pages/Learn.tsx` (Lines 433-436)
3. `src/pages/Courses.tsx` (Lines 540-543)
4. `src/components/onboarding/BulkSyllabusUploader.tsx` (Lines 164-167)

---

### 3.2 Parallelize Gap Analysis Refresh

**File:** `src/hooks/useCourses.ts`
**Effort:** 30 minutes

#### Current Code (Lines 84-115):
Sequential loop.

#### Fixed Code:
```typescript
async function refreshAllGapAnalyses() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: dreamJobs } = await supabase
    .from('dream_jobs')
    .select('id')
    .eq('user_id', user.id);

  if (!dreamJobs || dreamJobs.length === 0) return;

  console.log('[Workflow] Checking gap analyses freshness for', dreamJobs.length, 'dream jobs');

  // Step 1: Check freshness in parallel
  const freshnessResults = await Promise.all(
    dreamJobs.map(async (job) => ({
      job,
      isFresh: await isAnalysisFresh(job.id, user.id),
    }))
  );

  // Step 2: Filter to stale analyses
  const staleJobs = freshnessResults
    .filter(({ isFresh }) => !isFresh)
    .map(({ job }) => job);

  if (staleJobs.length === 0) {
    console.log('[Workflow] All analyses are fresh, skipping refresh');
    return;
  }

  console.log('[Workflow] Refreshing', staleJobs.length, 'stale analyses');

  // Step 3: Refresh stale analyses in parallel (with concurrency limit)
  const CONCURRENCY = 3; // Limit to avoid rate limiting
  for (let i = 0; i < staleJobs.length; i += CONCURRENCY) {
    const batch = staleJobs.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (job) => {
        try {
          const gapResult = await performGapAnalysis(job.id);
          if (gapResult.gaps && gapResult.gaps.length > 0) {
            await generateRecommendations(job.id, gapResult.gaps);
          }
        } catch (error) {
          console.error('[Workflow] Failed to refresh analysis for job:', job.id, error);
        }
      })
    );
  }
}
```

---

### 3.3 Single-Pass Counting in Dashboard

**File:** `src/hooks/useDashboard.ts`
**Effort:** 15 minutes

#### Current Code (Lines 74-77):
```typescript
const completedRecs = recs.filter(r => r.status === 'completed').length;
const inProgressRecs = recs.filter(r => r.status === 'in_progress').length;
const pendingRecs = recs.filter(r => r.status === 'pending' || !r.status).length;
const skippedRecs = recs.filter(r => r.status === 'skipped').length;
```

#### Fixed Code:
```typescript
// Single-pass counting
const statusCounts = recs.reduce(
  (acc, r) => {
    const status = r.status || 'pending';
    if (status === 'completed') acc.completed++;
    else if (status === 'in_progress') acc.inProgress++;
    else if (status === 'pending') acc.pending++;
    else if (status === 'skipped') acc.skipped++;
    return acc;
  },
  { completed: 0, inProgress: 0, pending: 0, skipped: 0 }
);

const { completed: completedRecs, inProgress: inProgressRecs,
        pending: pendingRecs, skipped: skippedRecs } = statusCounts;
```

---

## Verification Checklist

### After Phase 1:
- [ ] Generate-recommendations returns only user's capabilities
- [ ] All tooltips work in UnifiedLOCard
- [ ] Syllabus processing completes in < 5 seconds
- [ ] Instructor dashboard loads without lag

### After Phase 2:
- [ ] Global search returns results in < 100ms
- [ ] Navigation doesn't trigger unnecessary loading states
- [ ] Course list renders without jank
- [ ] Cache updates are targeted (check network tab)

### After Phase 3:
- [ ] Large file uploads complete without browser hang
- [ ] Background gap analysis doesn't block UI
- [ ] Dashboard data fetches efficiently

---

## Monitoring Recommendations

1. **Add performance timing logs:**
```typescript
console.time('process-syllabus');
// ... processing code ...
console.timeEnd('process-syllabus');
```

2. **Track query execution time in Supabase:**
- Enable query logging in Supabase dashboard
- Monitor slow query alerts

3. **Add React DevTools Profiler checks:**
- Record renders during navigation
- Verify component re-render counts

---

*Implementation plan created January 10, 2026*
