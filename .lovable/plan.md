

# Plan: Merge EduThree1's Capstone Project Pipeline into SyllabusStack

## Summary

Add a "Capstone Projects" feature to SyllabusStack's instructor course management. Instructors can discover local companies (via Apollo API), generate AI-powered industry project proposals aligned to their course's learning objectives, assign projects to students, and extract verified competencies upon completion. All changes are strictly additive — no existing tables, functions, or UI components are modified in a breaking way.

---

## Risk Analysis: What Could Break

| Concern | Mitigation |
|---|---|
| `instructor_courses` table gets new columns | All columns are nullable with no defaults that affect existing rows. No CHECK constraints. Existing queries SELECT specific columns or `*` — nullable columns won't cause errors. |
| `InstructorCourseDetail.tsx` gets a third tab | Only adds a `<TabsTrigger>` + `<TabsContent>` inside the existing `<Tabs>` component (currently has "Course Structure" and "Students"). No existing tab content is touched. |
| `InstructorCourse` TypeScript type needs update | Add new optional fields (`location_city?: string`, etc.). All existing code destructures only existing fields — new optional fields are ignored. |
| EduThree1 uses `esm.sh` imports | All ported edge functions will use SyllabusStack's `npm:` specifier standard from `deno.json`. No `esm.sh` or `deno.land` CDN imports. |
| EduThree1 uses `serve()` from `deno.land` | Ported functions will use `Deno.serve()` per SyllabusStack's edge function standards. |
| EduThree1's `corsHeaders` is wildcard `*` | Ported functions will use SyllabusStack's `getCorsHeaders(req)` + `handleCorsPreFlight(req)` from `_shared/cors.ts`. |
| EduThree1 uses `LOVABLE_API_KEY` for AI | SyllabusStack has this secret. However, per memory constraint `ai-provider-exclusion`, the user prohibits Lovable AI for content generation. Ported functions must use **OpenRouter** (`OPENROUTER_API_KEY`) via `_shared/unified-ai-client.ts` instead. |
| `APOLLO_API_KEY` doesn't exist yet | Must be added as a new secret before the discover-companies function works. The UI should gracefully show "Configure Apollo API key to discover companies" when missing. |
| `verified_skills` table reuse for capstone competencies | Existing `add_verified_skill_from_course()` function accepts `source_type` as a parameter. We'll pass `'capstone_project'` — no schema change needed. |
| Student-side course detail page | Capstone view is a new component added to the student course page. Does not touch existing learning objectives, progress, or assessment UI. |

---

## Database Migration (1 migration file)

### 1. New columns on `instructor_courses`

```sql
ALTER TABLE instructor_courses
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_state TEXT,
  ADD COLUMN IF NOT EXISTS location_zip TEXT,
  ADD COLUMN IF NOT EXISTS search_location TEXT,
  ADD COLUMN IF NOT EXISTS academic_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS expected_artifacts TEXT[];
```

All nullable, no defaults, no constraints. Zero impact on existing rows or queries.

### 2. New table: `company_profiles`

Stores Apollo-discovered companies. Shared across courses (same company can appear in multiple course projects).

Key columns: `id`, `name`, `sector`, `size`, `description`, `website`, `contact_email`, `contact_phone`, `contact_person`, `contact_title`, `full_address`, `linkedin_profile`, `apollo_organization_id` (UNIQUE for dedup), `technologies_used` (text[]), `job_postings` (jsonb), `funding_stage`, `total_funding_usd`, `employee_count`, `revenue_range`, `industries` (text[]), `keywords` (text[]), `data_completeness_score` (numeric), `created_at`, `updated_at`.

RLS: Authenticated users can SELECT. No client INSERT/UPDATE (edge functions use service role).

### 3. New table: `capstone_projects`

Links a company to an instructor course with an AI-generated project proposal.

Key columns: `id`, `instructor_course_id` (FK → instructor_courses ON DELETE CASCADE), `company_profile_id` (FK → company_profiles), `title`, `description`, `tasks` (jsonb), `deliverables` (jsonb), `skills` (text[]), `tier`, `lo_alignment` (text), `lo_alignment_score` (numeric), `feasibility_score` (numeric), `final_score` (numeric), `contact` (jsonb), `equipment`, `majors` (text[]), `status` (text DEFAULT 'generated', CHECK IN generated/active/in_progress/completed), `assigned_student_id` (uuid, nullable), `generation_batch_id` (uuid, nullable), `created_at`, `updated_at`.

RLS:
- Instructor of course: full CRUD via `is_course_instructor(auth.uid(), instructor_course_id)`
- Enrolled students: SELECT only via `is_enrolled_student(auth.uid(), instructor_course_id)`
- Assigned student: UPDATE `status` only

### 4. New table: `project_forms`

1:1 with `capstone_projects`. Stores the 6-form structured project detail data from EduThree1.

Key columns: `id`, `capstone_project_id` (FK UNIQUE → capstone_projects ON DELETE CASCADE), `form1_project_details` (jsonb), `form2_contact_info` (jsonb), `form3_requirements` (jsonb), `form4_timeline` (jsonb), `form5_logistics` (jsonb), `form6_academic` (jsonb), `milestones` (jsonb).

RLS: Same as `capstone_projects` (instructor full CRUD, enrolled students SELECT).

### 5. No new tables for competencies

Reuse existing `verified_skills` table with `source_type = 'capstone_project'`. The existing `add_verified_skill_from_course()` DB function already accepts arbitrary `source_type` and `source_id` values.

---

## Edge Functions (3 new functions)

### Important: Porting Standards

Every ported function must follow SyllabusStack conventions:
- `Deno.serve()` (not `serve()` from deno.land)
- `npm:` imports via `deno.json` (not `esm.sh`)
- `getCorsHeaders(req)` + `handleCorsPreFlight(req)` from `_shared/cors.ts`
- `withErrorHandling` wrapper from `_shared/error-handler.ts`
- AI calls via OpenRouter through `_shared/unified-ai-client.ts` (NOT Lovable AI gateway)
- Auth via `supabaseClient.auth.getUser()` pattern
- Zod validation from `_shared/validators/index.ts`

### Function 1: `discover-companies`

**Source**: EduThree1 `discover-companies/index.ts` (1,727 lines) + `providers/` directory

**Adaptation**:
- Input: `{ instructor_course_id: string }` (validated with Zod)
- Auth: Verify caller is the instructor of the course via `is_course_instructor`
- Course data: Query `learning_objectives.objective_text` WHERE `instructor_course_id = X` (replaces EduThree1's `course_profiles.outcomes`)
- Location: Read from `instructor_courses.search_location`
- AI model: Use OpenRouter `google/gemini-3-flash-preview` via `unified-ai-client.ts` (replaces Lovable AI)
- Output: INSERT into `company_profiles` (upsert on `apollo_organization_id`)
- **Requires**: `APOLLO_API_KEY` secret

**Shared services to copy from EduThree1** (into `supabase/functions/_shared/capstone/`):
- `skill-extraction-service.ts` — hybrid skill extraction
- `occupation-coordinator.ts` — O*NET SOC code mapping
- `onet-service.ts` — O*NET API calls
- `semantic-matching-service.ts` — company relevance ranking
- `geo-distance.ts` — Haversine distance
- `circuit-breaker.ts` — Apollo API resilience (SyllabusStack doesn't have this)
- `retry-utils.ts` — fetch retries (SyllabusStack has its own; evaluate reuse)
- Apollo provider files: `apollo-provider.ts`, `provider-factory.ts`, `types.ts`, `apollo-industry-mapper.ts`, `apollo-technology-mapping.ts`

**Why a subdirectory**: Placing ported services in `_shared/capstone/` avoids any naming conflicts with SyllabusStack's existing `_shared/` files (e.g., both projects have `types.ts`, `error-handler.ts`, `cors.ts`).

**Import migration**: All `esm.sh` imports → `npm:` specifiers. All `serve()` → `Deno.serve()`.

### Function 2: `generate-capstone-projects`

**Source**: EduThree1 `generate-projects/index.ts` (1,122 lines)

**Adaptation**:
- Input: `{ instructor_course_id: string }`
- Auth: Verify instructor ownership
- Course outcomes: Derived from `learning_objectives.objective_text`
- Companies: SELECT from `company_profiles` joined via a linking query or passed IDs
- AI: OpenRouter via `unified-ai-client.ts` (replaces Lovable AI)
- Output: INSERT into `capstone_projects` + `project_forms`

**Shared services**:
- `generation-service.ts` — core AI prompt + structured output (in `_shared/capstone/`)
- `alignment-service.ts` — LO alignment scoring (in `_shared/capstone/`)

### Function 3: `extract-capstone-competencies`

**Source**: EduThree1 `competency-extractor/index.ts` (278 lines)

**Adaptation**:
- Input: `{ capstone_project_id: string }`
- Auth: Verify caller is the assigned student or course instructor
- Fetches completed project data (tasks, deliverables, sector)
- AI: OpenRouter via `unified-ai-client.ts`
- Output: Calls existing `add_verified_skill_from_course()` with `source_type = 'capstone_project'`
- No job-matcher chain (SyllabusStack has its own career pipeline)

---

## Secrets

| Secret | Status | Action |
|---|---|---|
| `OPENROUTER_API_KEY` | Already exists | Used for AI in all 3 functions |
| `APOLLO_API_KEY` | **Does not exist** | Must be added via `add_secret` tool. User needs an Apollo.io account. |
| `LOVABLE_API_KEY` | Already exists | NOT used (per `ai-provider-exclusion` constraint) |

---

## TypeScript Type Update

### `src/hooks/instructorCourses/types.ts`

Add optional fields to `InstructorCourse`:

```typescript
export interface InstructorCourse {
  // ... existing fields unchanged ...
  location_city?: string | null;
  location_state?: string | null;
  location_zip?: string | null;
  search_location?: string | null;
  academic_level?: string | null;
  expected_artifacts?: string[] | null;
}
```

This is safe because all existing code destructures only known fields. The auto-generated `types.ts` from Supabase will also reflect these after migration.

---

## Frontend Components

### 1. Modify: `src/pages/instructor/InstructorCourseDetail.tsx`

Add a third tab "Capstone Projects" to the existing `<Tabs>` component:

```text
[Course Structure] [Students] [Capstone Projects]  ← NEW
```

Changes:
- Import `Briefcase` icon from lucide-react
- Import `CapstoneProjectsTab` component
- Add `<TabsTrigger value="capstone">` after the Students trigger
- Add `<TabsContent value="capstone">` after the Students content

**Lines affected**: ~473-483 (TabsList) and ~926-928 (after Students TabsContent). No existing content modified.

### 2. Create: `src/components/capstone/CapstoneProjectsTab.tsx`

Main container. Props: `courseId: string`. Layout:

```text
┌─────────────────────────────────────────────┐
│ Location Setup Card (if no location set)    │
│ [City] [State] [Zip] [Academic Level]       │
│ [Save Location]                             │
├─────────────────────────────────────────────┤
│ [Discover Companies] button                 │
│                                             │
│ Discovered Companies (cards grid)           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Company1 │ │ Company2 │ │ Company3 │     │
│ └──────────┘ └──────────┘ └──────────┘     │
├─────────────────────────────────────────────┤
│ [Generate Projects] button                  │
│                                             │
│ Generated Projects (cards list)             │
│ ┌─────────────────────────────────────────┐ │
│ │ Project Title — Company — Score — Assign│ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 3. Create: `src/components/capstone/LocationSetup.tsx`

Form component for location fields. Calls `useUpdateInstructorCourse` mutation (already exists) to save `location_city`, `location_state`, `location_zip`, `search_location`, `academic_level`.

### 4. Create: `src/components/capstone/CompanyCard.tsx`

Displays: name, sector, size, website link, technologies (badges), job postings count, match score.

### 5. Create: `src/components/capstone/CapstoneProjectCard.tsx`

Displays: title, company name, tasks (collapsible), deliverables, skills (badges), LO alignment score, feasibility score. Actions: "Assign Student" (dropdown of enrolled students), "View Details", "Mark Active".

### 6. Create: `src/components/capstone/ProjectDetailView.tsx`

Full detail dialog/page: 6-form breakdown from `project_forms`, contact info, timeline, milestones. "Mark Completed" action triggers `extract-capstone-competencies`.

### 7. Create: `src/components/capstone/StudentCapstoneView.tsx`

For enrolled students — shows their assigned project(s), task checklist, deliverables, "Submit Completed" button. Added to the student course detail page as a new section (not replacing anything).

---

## Hooks

### Create: `src/hooks/useCapstoneProjects.ts`

| Hook | Purpose | Query/Mutation |
|---|---|---|
| `useCompanyProfiles(courseId)` | Fetch discovered companies for a course | SELECT company_profiles joined via capstone_projects |
| `useCapstoneProjects(courseId)` | Fetch all projects for a course | SELECT capstone_projects with company join |
| `useCapstoneProject(projectId)` | Single project detail with forms | SELECT capstone_projects + project_forms |
| `useDiscoverCompanies()` | Trigger company discovery | Mutation → invoke `discover-companies` edge function |
| `useGenerateCapstoneProjects()` | Trigger project generation | Mutation → invoke `generate-capstone-projects` edge function |
| `useAssignStudent()` | Assign student to project | Mutation → UPDATE capstone_projects.assigned_student_id |
| `useCompleteProject()` | Mark project done + extract skills | Mutation → UPDATE status + invoke `extract-capstone-competencies` |
| `useUpdateCourseLocation()` | Save location fields | Reuses existing `useUpdateInstructorCourse` |
| `useStudentCapstoneProject(courseId)` | Student's assigned project | SELECT where assigned_student_id = auth.uid() |

Query keys: `['capstone-projects', courseId]`, `['company-profiles', courseId]`, `['capstone-project', projectId]`, `['student-capstone', courseId]`. These are completely new keys — no conflicts with existing cache.

---

## Implementation Order

| Step | What | Files | Depends On |
|---|---|---|---|
| 1 | Database migration | SQL migration file | Nothing |
| 2 | Add `APOLLO_API_KEY` secret | Secret tool | Nothing |
| 3 | Update `InstructorCourse` type | `src/hooks/instructorCourses/types.ts` | Step 1 |
| 4 | Copy shared services from EduThree1 | `supabase/functions/_shared/capstone/*.ts` | Nothing |
| 5 | Create `discover-companies` edge function | `supabase/functions/discover-companies/index.ts` | Steps 2, 4 |
| 6 | Create `generate-capstone-projects` edge function | `supabase/functions/generate-capstone-projects/index.ts` | Steps 4, 5 |
| 7 | Create `extract-capstone-competencies` edge function | `supabase/functions/extract-capstone-competencies/index.ts` | Step 4 |
| 8 | Create hooks | `src/hooks/useCapstoneProjects.ts` | Steps 5, 6, 7 |
| 9 | Create UI components | `src/components/capstone/*.tsx` | Step 8 |
| 10 | Wire tab into instructor course detail | `src/pages/instructor/InstructorCourseDetail.tsx` | Step 9 |
| 11 | Add student capstone view | Student course detail page | Step 8 |
| 12 | Test edge functions | `supabase--curl_edge_functions` | Steps 5, 6, 7 |

---

## Files Summary

| File | Action | Risk |
|---|---|---|
| Migration SQL | Create | Low — all additive |
| `src/hooks/instructorCourses/types.ts` | Modify — add 6 optional fields | Low — all optional |
| `supabase/functions/_shared/capstone/` (8-10 files) | Create — ported from EduThree1 | Low — new directory |
| `supabase/functions/discover-companies/index.ts` | Create | Low — new function |
| `supabase/functions/generate-capstone-projects/index.ts` | Create | Low — new function |
| `supabase/functions/extract-capstone-competencies/index.ts` | Create | Low — new function |
| `src/hooks/useCapstoneProjects.ts` | Create | Low — new file |
| `src/components/capstone/*.tsx` (7 files) | Create | Low — new components |
| `src/pages/instructor/InstructorCourseDetail.tsx` | Modify — add 1 TabsTrigger + 1 TabsContent | Low — additive only |
| Student course detail page | Modify — add capstone section | Low — additive only |

**Total**: ~15 new files, 2 modified files, 1 migration, 3 edge functions, 0 existing logic changed.

