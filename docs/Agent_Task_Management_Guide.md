# Agent Task Management Guide

> **Purpose:** Establish standards for AI agents working on SyllabusStack to maintain continuity, accuracy, and comprehensiveness across sessions.
> **Version:** 1.0
> **Last Updated:** 2026-01-08

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Pre-Work Discovery Protocol](#2-pre-work-discovery-protocol)
3. [Session State Management](#3-session-state-management)
4. [Verification Requirements](#4-verification-requirements)
5. [Implementation Standards](#5-implementation-standards)
6. [Handoff Protocol](#6-handoff-protocol)
7. [Common Pitfalls to Avoid](#7-common-pitfalls-to-avoid)
8. [Quick Reference](#8-quick-reference)

---

## 1. Core Principles

### 1.1 Verify Before Claiming

**NEVER claim something is not implemented without verification.**

```
WRONG: "The PDF upload feature is not connected to the UI"
RIGHT: First search → Read the file → Then make accurate assessment
```

### 1.2 Trust the Code, Not Assumptions

- The codebase may have changed since previous documentation
- Previous agent assessments may contain errors
- Always verify current state before planning work

### 1.3 Document Everything

- What you found (actual state)
- What you changed (files modified)
- What remains (next steps)

### 1.4 Maintain Continuity

- Use consistent patterns with existing code
- Update documentation when making changes
- Leave the project in a better state than you found it

---

## 2. Pre-Work Discovery Protocol

### 2.1 Before ANY Implementation Task

Execute this checklist before starting work:

```markdown
## Discovery Checklist - [Task Name]

### Step 1: Search for Existing Implementation
- [ ] `Glob` for files with relevant names
- [ ] `Grep` for related function/hook names
- [ ] `Grep` for related component names
- [ ] Search for existing edge functions

### Step 2: Read Existing Code
- [ ] Read any files found in Step 1
- [ ] Trace data flow from hook to component
- [ ] Check edge function implementations
- [ ] Review database schema in migrations

### Step 3: Check Documentation
- [ ] Read /docs/Master_Project_Plan_v3.md
- [ ] Read /docs/Project_Analysis_Documentation.md
- [ ] Check recent git commits for context
- [ ] Look for inline comments explaining decisions

### Step 4: Document Current State
- [ ] Note what IS implemented
- [ ] Note what is NOT implemented
- [ ] Identify specific gaps with evidence
```

### 2.2 Search Commands Reference

```bash
# Find files by name pattern
Glob("**/*pdf*")
Glob("**/*Upload*")
Glob("src/hooks/use*.ts")

# Find code patterns
Grep("parseSyllabusDocument")
Grep("useSearchYouTubeContent")
Grep("anti.?recommend", "-i")  # Case insensitive regex

# Find component usage
Grep("AntiRecommendations")
Grep("<ContentRating")

# Find database operations
Grep("from\\('content_ratings'\\)")
```

### 2.3 Reading Priority Order

When investigating a feature, read in this order:

1. **Hook file** - Understand data layer
2. **Service file** - Understand API calls
3. **Edge function** - Understand backend logic
4. **Component file** - Understand UI implementation
5. **Page file** - Understand integration

---

## 3. Session State Management

### 3.1 Session State Template

Create/update this at the start and end of each session:

```markdown
# Session State: [Feature/Task Name]

## Session Info
- **Date:** YYYY-MM-DD HH:MM
- **Branch:** [branch-name]
- **Last Commit:** [hash] - [message]
- **Agent Type:** [Claude Code / Other]

## Starting State Verification
| Component | Expected State | Actual State | Notes |
|-----------|---------------|--------------|-------|
| Feature X | Not implemented | Actually exists! | Found in src/... |
| Database Y | Missing table | Missing table | Confirmed |

## Tasks This Session
1. [x] Task 1
   - Files: `path/to/file.tsx`
   - Commit: [hash]
2. [x] Task 2
   - Files: `path/to/file.ts`
   - Commit: [hash]
3. [ ] Task 3 (in progress)
   - Status: 50% complete
   - Blocker: Need clarification on X

## Files Modified
| File | Change Type | Description |
|------|-------------|-------------|
| `src/hooks/useX.ts` | Modified | Added Y function |
| `src/components/X.tsx` | Created | New component for Z |

## Issues Discovered
1. **Issue:** Description
   - **Location:** file:line
   - **Impact:** Low/Medium/High
   - **Suggested Fix:** Description

## Next Session Should
1. Complete Task 3
2. Address Issue 1
3. Test feature integration
4. Update documentation

## Environment Notes
- Any secrets needed
- Any packages added
- Any build/lint warnings introduced
```

### 3.2 State File Location

Store session state in: `/docs/session-states/[date]-[task].md`

---

## 4. Verification Requirements

### 4.1 Before Making Claims

| Claim Type | Verification Required |
|------------|----------------------|
| "Feature X doesn't exist" | Search + Read 3+ potential locations |
| "Function Y is broken" | Run it or trace the code |
| "Database table missing" | Check latest migration files |
| "API endpoint not working" | Check edge function exists |

### 4.2 Before Marking Task Complete

```markdown
## Task Completion Checklist

### Code Quality
- [ ] TypeScript compiles: `npm run build`
- [ ] No ESLint errors
- [ ] No console errors in browser
- [ ] Follows existing patterns

### Functionality
- [ ] Feature works as described
- [ ] Edge cases handled
- [ ] Error states show messages
- [ ] Loading states present

### Integration
- [ ] Doesn't break existing features
- [ ] Data persists correctly
- [ ] Auth states work (logged in/out)
- [ ] Mobile responsive (if UI)

### Documentation
- [ ] Code comments for complex logic
- [ ] Updated relevant docs
- [ ] Session state updated
```

### 4.3 Evidence Requirements

When reporting on state, include evidence:

```markdown
## WRONG - No evidence
"The YouTube API is not integrated"

## RIGHT - With evidence
"The YouTube API IS integrated. Evidence:
- File: `src/components/player/VerifiedVideoPlayer.tsx`
- Lines 45-73: Loads YouTube IFrame API
- Lines 260-303: Handles state changes
- Features: Real-time tracking, speed detection, micro-checks"
```

---

## 5. Implementation Standards

### 5.1 Code Style

Follow existing patterns in the codebase:

```typescript
// Data Fetching - Use TanStack Query
export function useSomething(id?: string) {
  return useQuery({
    queryKey: ['something', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('table').select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

// Mutations - With toast feedback
export function useCreateSomething() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input) => { /* ... */ },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['something'] });
      toast({ title: 'Success!' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
```

### 5.2 File Organization

```
New Hook → src/hooks/use{FeatureName}.ts
New Component → src/components/{category}/{ComponentName}.tsx
New Page → src/pages/{role?}/{PageName}.tsx
New Edge Function → supabase/functions/{function-name}/index.ts
New Migration → supabase/migrations/YYYYMMDD_{description}.sql
```

### 5.3 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Hooks | `use{FeatureName}` | `useContentRating` |
| Components | `PascalCase` | `ContentRatingCard` |
| Files | `PascalCase.tsx` | `ContentRatingCard.tsx` |
| Edge Functions | `kebab-case` | `rate-content` |
| DB Tables | `snake_case` | `content_ratings` |

### 5.4 Commit Messages

```
feat: Add content rating system
fix: Correct video tracking time calculation
refactor: Extract shared validation logic
docs: Update Master Project Plan with verified state
chore: Add migration for content_ratings table
```

---

## 6. Handoff Protocol

### 6.1 Before Ending Session

1. **Commit all work** with descriptive messages
2. **Update session state** document
3. **Update main docs** if architectural changes made
4. **List uncommitted decisions** that need input
5. **Run build** to ensure no errors left behind

### 6.2 Starting New Session

1. **Read session state** from previous session
2. **Check git log** for recent changes
3. **Run build** to verify project state
4. **Read Master Plan** for context
5. **Update todo list** before starting

### 6.3 Critical Handoff Information

Always document:

```markdown
## Handoff Notes

### Context Required
- [What background is needed to understand the work]

### Decisions Made
- [Why certain approaches were chosen]
- [Alternatives considered and rejected]

### Dependencies
- [Other features this depends on]
- [Features that depend on this]

### Testing Notes
- [How to verify this works]
- [Edge cases to watch for]

### Known Limitations
- [What doesn't work yet]
- [Intentional constraints]
```

---

## 7. Common Pitfalls to Avoid

### 7.1 Making Assumptions

| Pitfall | Solution |
|---------|----------|
| Assuming feature doesn't exist | Search before claiming |
| Assuming previous docs are accurate | Verify against code |
| Assuming database schema | Check migration files |
| Assuming API works certain way | Read edge function code |

### 7.2 Incomplete Implementation

| Pitfall | Solution |
|---------|----------|
| Missing error handling | Always add try/catch + toasts |
| Missing loading states | Add isPending/isLoading UI |
| Missing empty states | Add EmptyState components |
| Missing type safety | Avoid `any`, define interfaces |

### 7.3 Poor Documentation

| Pitfall | Solution |
|---------|----------|
| No comments on complex logic | Add JSDoc or inline comments |
| Outdated README/docs | Update when changing behavior |
| No session state | Always create/update state file |
| Unclear commit messages | Use conventional commits |

### 7.4 Breaking Changes

| Pitfall | Solution |
|---------|----------|
| Changing shared types | Check all usages first |
| Renaming exports | Search for imports |
| Modifying API contracts | Consider backwards compat |
| Removing unused code | Verify truly unused |

---

## 8. Quick Reference

### 8.1 Essential Files to Know

```
Configuration:
├── package.json          # Dependencies
├── vite.config.ts        # Build config
├── tailwind.config.ts    # Styling
└── tsconfig.json         # TypeScript

Core Application:
├── src/App.tsx                              # Routing
├── src/contexts/AuthContext.tsx             # Auth state
├── src/integrations/supabase/client.ts      # DB client
└── src/lib/query-keys.ts                    # Cache keys

Key Features:
├── src/components/player/VerifiedVideoPlayer.tsx  # Video
├── src/components/onboarding/CourseUploader.tsx   # Upload
├── src/pages/Recommendations.tsx                   # Recs
└── src/pages/instructor/InstructorCourseDetail.tsx # Instructor

Documentation:
├── docs/Master_Project_Plan_v3.md           # This plan
├── docs/Project_Analysis_Documentation.md   # Technical docs
└── docs/Agent_Task_Management_Guide.md      # This guide
```

### 8.2 Common Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Check linting

# Git
git status           # Check state
git log --oneline -10  # Recent commits
git diff             # Uncommitted changes

# Search (use tools, not bash)
Glob("**/*.tsx")     # Find files
Grep("pattern")      # Search content
Read("/path/file")   # Read file
```

### 8.3 Database Quick Reference

```sql
-- Core Tables
profiles              -- User data
courses               -- Student uploaded courses
dream_jobs            -- Career targets
gap_analyses          -- Skill gaps
recommendations       -- Learning actions
instructor_courses    -- Instructor created courses
modules               -- Course sections
learning_objectives   -- Learning goals
content               -- Videos, resources
content_matches       -- LO-Content mappings
consumption_records   -- Watch tracking
```

### 8.4 Edge Function Quick Reference

| Function | Purpose |
|----------|---------|
| `analyze-syllabus` | Extract capabilities |
| `analyze-dream-job` | Job requirements |
| `gap-analysis` | Compare skills |
| `generate-recommendations` | Learning path |
| `search-youtube-content` | Find videos |
| `generate-assessment-questions` | Quiz generation |
| `track-consumption` | Video tracking |

---

## Appendix: Verification Examples

### Example 1: Verifying a Feature Exists

**Task:** Check if PDF upload is implemented

```markdown
## Verification Steps

1. Search for PDF-related files:
   Glob("**/*pdf*") → Found: parse-syllabus-document/index.ts

2. Search for upload component:
   Glob("**/*Upload*") → Found: CourseUploader.tsx

3. Read the uploader:
   Read("src/components/onboarding/CourseUploader.tsx")

4. Find PDF handling (lines 97-119):
   - Accepts PDF/DOCX via dropzone
   - Calls parseSyllabusDocument(file)
   - Shows parsing progress
   - Fills form with extracted text

## Conclusion
PDF upload IS implemented. Evidence at CourseUploader.tsx:97-119
```

### Example 2: Understanding a Data Flow

**Task:** Understand how video tracking works

```markdown
## Data Flow Analysis

1. Component: VerifiedVideoPlayer.tsx
   - Loads YouTube IFrame API (lines 45-73)
   - Tracks state changes (lines 260-303)
   - Uses useConsumptionTracking hook (line 102-107)

2. Hook: useConsumptionTracking.ts
   - Exports: syncConsumption, trackEvent
   - Calls edge function on sync

3. Edge Function: track-consumption/index.ts
   - Receives: segments, duration, micro_check_results
   - Updates: consumption_records table
   - Calculates: engagement_score, verification_state

4. Database: consumption_records
   - Stores: watch_percentage, engagement_score
   - Links to: content_matches, profiles

## Conclusion
Full video tracking pipeline exists:
UI → Hook → Edge Function → Database
```

---

*This guide should be read by any agent before starting work on SyllabusStack.*
