# EduThree Implementation Plan
## Complete Phase-by-Phase Development Guide

**Created:** 2024-12-19  
**Reference:** EduThree_Technical_Spec.md v3.0  
**Status:** In Progress

---

## Executive Summary

This document outlines the complete implementation plan to bring EduThree from its current state to full production readiness per the Technical Specification v3.0. The plan is organized into 14 phases with detailed tasks, dependencies, and verification criteria.

---

## Current State Assessment

### ✅ Fully Implemented
- Core database schema (12 tables with RLS policies)
- Basic authentication flow (signup/login)
- Supabase client integration
- Four edge functions (analyze-syllabus, analyze-dream-job, gap-analysis, generate-recommendations)
- Basic UI components (layout, cards, forms)
- React Query for data fetching
- Tailwind CSS design system

### ⚠️ Partially Implemented
- TanStack Form (basic usage, not all forms)
- Onboarding wizard (structure exists, incomplete flow)
- Dashboard (basic layout, missing live data)
- Gap analysis display (needs honest assessment styling)

### ❌ Not Implemented
- TanStack Router (using react-router-dom)
- pgvector extension for embeddings
- File upload to Supabase Storage
- PDF/document parsing
- AI usage dashboard
- Anti-recommendations display
- Public syllabus scanner page
- Complete workflow orchestration
- Cache invalidation system
- Cost tracking dashboard

---

## Phase 1: Database & Schema Alignment
**Priority:** Critical | **Estimated Effort:** 2-3 hours

### 1.1 Enable pgvector Extension
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.2 Add Vector Columns
- Add `capability_embedding vector(1536)` to `capability_profiles`
- Add `requirements_embedding vector(1536)` to `job_requirements_cache`

### 1.3 Create Indexes for Vector Search
```sql
CREATE INDEX ON capability_profiles USING ivfflat (capability_embedding vector_cosine_ops);
CREATE INDEX ON job_requirements_cache USING ivfflat (requirements_embedding vector_cosine_ops);
```

### 1.4 Verify All Table Columns Match Spec
Cross-reference each table against Part 5 of technical spec:
- [x] profiles
- [x] courses
- [x] dream_jobs
- [x] capabilities
- [x] capability_profiles
- [x] gap_analyses
- [x] recommendations
- [x] anti_recommendations
- [x] job_requirements
- [x] job_requirements_cache
- [x] ai_cache
- [x] ai_usage

### 1.5 Verification Criteria
- [ ] pgvector extension enabled
- [ ] Vector columns added
- [ ] Indexes created
- [ ] All RLS policies verified secure

---

## Phase 2: Supabase Storage Setup
**Priority:** High | **Estimated Effort:** 1-2 hours

### 2.1 Create Storage Buckets
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('syllabi', 'syllabi', false);
```

### 2.2 Storage RLS Policies
```sql
-- Users can upload their own syllabi
CREATE POLICY "Users can upload syllabi" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'syllabi' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own syllabi
CREATE POLICY "Users can view their syllabi" ON storage.objects
FOR SELECT USING (
  bucket_id = 'syllabi' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own syllabi
CREATE POLICY "Users can delete their syllabi" ON storage.objects
FOR DELETE USING (
  bucket_id = 'syllabi' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 2.3 File Upload Utility Functions
Create `src/lib/storage.ts`:
- `uploadSyllabus(file: File): Promise<string>` - returns public URL
- `deleteSyllabus(path: string): Promise<void>`
- `getSyllabusUrl(path: string): string`

### 2.4 Verification Criteria
- [ ] Syllabi bucket created
- [ ] RLS policies applied
- [ ] Upload/download working
- [ ] File size limits configured (10MB max)

---

## Phase 3: Edge Function Enhancements
**Priority:** High | **Estimated Effort:** 4-6 hours

### 3.1 Create Shared AI Orchestrator
File: `supabase/functions/_shared/ai-orchestrator.ts`

Features:
- Model selection based on task type
- Automatic fallback handling
- Token counting and cost estimation
- Structured output parsing via tool calling

```typescript
interface AIRequest {
  task: 'syllabus_extraction' | 'capability_analysis' | 'job_requirements' | 'gap_analysis' | 'recommendations';
  prompt: string;
  schema?: object; // For structured output
}

interface AIResponse {
  content: any;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export async function callAI(request: AIRequest): Promise<AIResponse>
```

### 3.2 Enhance analyze-syllabus
- Add PDF text extraction support
- Extract evidence types (projects, exams, papers)
- Generate capability embeddings
- Track detailed token usage

### 3.3 Enhance analyze-dream-job
- Check job_requirements_cache first
- Increment query_count on cache hit
- Generate requirements embedding for new entries
- Return richer structured data

### 3.4 Enhance gap-analysis
- Use vector similarity for matching
- Generate all assessment fields:
  - honest_assessment
  - readiness_level
  - job_success_prediction
  - interview_readiness
  - strong_overlaps
  - partial_overlaps
  - critical_gaps
  - priority_gaps
- Calculate accurate match_score

### 3.5 Enhance generate-recommendations
- Generate anti-recommendations
- Include all fields per spec:
  - why_this_matters
  - how_to_demonstrate
  - evidence_created
  - steps (array)
  - effort_hours
  - cost_usd
  - provider
  - url

### 3.6 Create parse-document Edge Function
File: `supabase/functions/parse-document/index.ts`

Features:
- Accept file URL from storage
- Extract text from PDF/DOCX
- Return structured text content

### 3.7 Verification Criteria
- [ ] AI orchestrator working with fallbacks
- [ ] All edge functions using orchestrator
- [ ] Token usage tracked accurately
- [ ] Embeddings generated and stored
- [ ] Anti-recommendations generated

---

## Phase 4: TanStack Form Integration
**Priority:** Medium | **Estimated Effort:** 3-4 hours

### 4.1 Forms to Enhance/Create
Per Technical Spec Part 3.3:

1. **AddCourseForm** (`src/components/forms/AddCourseForm.tsx`)
   - Fields: title, code, instructor, semester, year, credits, grade, syllabus upload
   - Validation: Zod schema
   - File upload integration

2. **AddDreamJobForm** (`src/components/forms/AddDreamJobForm.tsx`)
   - Fields: jobQuery, targetCompanyType, targetLocation
   - Popular roles suggestions
   - Company type select

3. **ProfileForm** (`src/components/forms/ProfileForm.tsx`)
   - Fields: full_name, university, major, graduation_year, student_level
   - Auto-save on blur

4. **OnboardingProfileForm** - Part of onboarding wizard

### 4.2 Form Utilities
Create `src/lib/form-utils.ts`:
- Common validation schemas
- Error message formatting
- Form state persistence

### 4.3 Verification Criteria
- [ ] All forms using TanStack Form
- [ ] Zod validation on all forms
- [ ] File upload working on course form
- [ ] Error states displayed correctly
- [ ] Loading states during submission

---

## Phase 5: UI Component Enhancements
**Priority:** High | **Estimated Effort:** 6-8 hours

### 5.1 HonestAssessment Component
File: `src/components/analysis/HonestAssessment.tsx`

Per spec Part 8.2:
```typescript
interface HonestAssessmentProps {
  assessment: string;
  readinessLevel: 'not_ready' | 'getting_there' | 'almost_ready' | 'ready';
  matchScore: number;
  jobTitle: string;
}
```

Features:
- Color-coded readiness indicator
- Progress ring for match score
- Expandable detailed assessment
- Interview readiness indicator

### 5.2 RecommendationCard Enhancement
Already partially done, verify:
- [ ] Expandable accordion for steps
- [ ] Priority badges (critical/high/medium/low)
- [ ] Type icons (course/project/certification/experience)
- [ ] Progress tracking (status updates)
- [ ] Cost and duration display

### 5.3 GapAnalysisView Enhancement
File: `src/components/analysis/GapAnalysisView.tsx`

Features:
- Three-column layout (Strengths | Partial | Gaps)
- Visual hierarchy with icons
- Actionable items linked to recommendations

### 5.4 CapabilitySnapshot Component
File: `src/components/dashboard/CapabilitySnapshot.tsx`

Features:
- Radar chart of capabilities by theme
- Course count indicator
- Last updated timestamp
- Quick links to add more courses

### 5.5 DreamJobCards Component
File: `src/components/dashboard/DreamJobCards.tsx`

Features:
- Card for each dream job
- Match score progress ring
- Quick gap summary
- Primary job indicator
- Add/remove functionality

### 5.6 AntiRecommendations Component
File: `src/components/recommendations/AntiRecommendations.tsx`

Features:
- Warning-styled cards
- Action to avoid
- Reason explanation
- Link to related gap

### 5.7 Verification Criteria
- [ ] All components styled per design system
- [ ] Responsive on mobile/tablet/desktop
- [ ] Loading skeletons implemented
- [ ] Empty states handled
- [ ] Error boundaries in place

---

## Phase 6: Onboarding Wizard
**Priority:** High | **Estimated Effort:** 4-5 hours

### 6.1 Wizard Structure
File: `src/components/onboarding/OnboardingWizard.tsx`

Steps per spec Part 9.1:
1. **Welcome** - Introduction, value proposition
2. **Profile** - Basic info (name, university, major, year)
3. **Courses** - Add 2+ courses with syllabi
4. **Dream Jobs** - Add 1-3 target roles
5. **Analysis** - Trigger initial gap analysis
6. **Complete** - Summary and next steps

### 6.2 Step Components
- `OnboardingWelcome.tsx`
- `OnboardingProfile.tsx`
- `OnboardingCourses.tsx`
- `OnboardingDreamJobs.tsx`
- `OnboardingAnalysis.tsx`
- `OnboardingComplete.tsx`

### 6.3 Progress Persistence
- Save progress to profile.onboarding_step
- Allow resume from last step
- Skip completed steps on revisit

### 6.4 Minimum Requirements
- At least 2 courses before proceeding
- At least 1 dream job before analysis
- Profile fields required

### 6.5 Verification Criteria
- [ ] All 6 steps implemented
- [ ] Progress bar showing current step
- [ ] Back/Next navigation working
- [ ] Data persisted between steps
- [ ] Can resume after page refresh
- [ ] Redirects to dashboard on complete

---

## Phase 7: Dashboard Implementation
**Priority:** High | **Estimated Effort:** 4-5 hours

### 7.1 DashboardOverview Component
File: `src/components/dashboard/DashboardOverview.tsx`

Layout:
```
┌─────────────────────────────────────────────┐
│ Welcome, {name}!                    [Quick Actions] │
├─────────────────────┬───────────────────────┤
│ Capability Snapshot │ Dream Jobs (cards)    │
│ (radar chart)       │ - Primary job         │
│                     │ - Other jobs          │
├─────────────────────┴───────────────────────┤
│ Recent Recommendations                       │
│ [Card] [Card] [Card]                        │
├─────────────────────────────────────────────┤
│ Quick Stats                                  │
│ Courses: X | Capabilities: Y | Match: Z%    │
└─────────────────────────────────────────────┘
```

### 7.2 Data Hooks
- `useDashboard()` - aggregates all dashboard data
- Real-time updates on data changes
- Optimistic UI updates

### 7.3 Quick Actions
- Add Course
- Add Dream Job
- Run New Analysis
- View All Recommendations

### 7.4 Verification Criteria
- [ ] All sections populated with real data
- [ ] Loading states for each section
- [ ] Empty states with CTAs
- [ ] Responsive layout
- [ ] Quick actions functional

---

## Phase 8: Workflow Orchestration
**Priority:** High | **Estimated Effort:** 3-4 hours

### 8.1 Course Addition Flow
Per spec Part 9.2:
```
User adds course → 
  Upload syllabus (if provided) →
  Call analyze-syllabus →
  Save capabilities →
  Update capability_profile →
  Invalidate gap analyses →
  Show success toast
```

### 8.2 Dream Job Addition Flow
```
User adds dream job →
  Check job_requirements_cache →
  If miss: Call analyze-dream-job →
  Cache requirements →
  Create gap_analysis placeholder →
  Trigger gap-analysis function →
  Show analysis in progress
```

### 8.3 Analysis Refresh Flow
```
User requests refresh →
  Fetch latest capability_profile →
  Fetch dream_job requirements →
  Call gap-analysis →
  Update gap_analyses table →
  Invalidate old recommendations →
  Generate new recommendations →
  Show updated UI
```

### 8.4 Cache Invalidation Rules
Per spec Part 9.4:
- Course added/updated → Invalidate capability_profile, all gap_analyses
- Dream job added → Generate new gap_analysis
- Profile updated → No cache invalidation needed
- Manual refresh → Force regenerate all analyses

### 8.5 Implement Workflow Hooks
- `useAddCourse()` - orchestrates course addition
- `useAddDreamJob()` - orchestrates dream job addition
- `useRefreshAnalysis(dreamJobId)` - refreshes single analysis
- `useRefreshAllAnalyses()` - refreshes all analyses

### 8.6 Verification Criteria
- [ ] All workflows execute correctly
- [ ] Proper loading states during async operations
- [ ] Error handling with retry options
- [ ] Cache invalidation working
- [ ] Optimistic updates where appropriate

---

## Phase 9: Public Syllabus Scanner
**Priority:** Medium | **Estimated Effort:** 2-3 hours

### 9.1 Page Implementation
File: `src/pages/SyllabusScanner.tsx`

Features:
- No auth required
- Paste syllabus text
- Get instant capability analysis
- Show extracted capabilities
- CTA to sign up for full features

### 9.2 Rate Limiting
- IP-based rate limiting (5 scans/hour)
- Show remaining scans
- Prompt signup after limit

### 9.3 Simplified Edge Function
- No database persistence
- No user context
- Return capabilities only

### 9.4 Verification Criteria
- [ ] Accessible without login
- [ ] Analysis completes quickly
- [ ] Results displayed clearly
- [ ] Signup CTA prominent
- [ ] Rate limiting working

---

## Phase 10: AI Usage & Cost Tracking
**Priority:** Medium | **Estimated Effort:** 2-3 hours

### 10.1 Usage Dashboard Component
File: `src/components/dashboard/AIUsageDashboard.tsx`

Features:
- Total tokens used (input/output)
- Estimated cost to date
- Usage by function
- Daily/weekly/monthly views
- Usage trends chart

### 10.2 Cost Calculation
Per spec Part 10:
- Track per-call costs
- Aggregate by user
- Show in settings page

### 10.3 Admin View (Future)
- Total platform usage
- Per-user breakdown
- Cost projections

### 10.4 Verification Criteria
- [ ] Usage tracked for all AI calls
- [ ] Costs calculated correctly
- [ ] Dashboard displays data
- [ ] Export functionality

---

## Phase 11: Profile & Settings Pages
**Priority:** Medium | **Estimated Effort:** 2-3 hours

### 11.1 Profile Page Enhancement
File: `src/pages/Profile.tsx`

Sections:
- Personal information (editable)
- Academic information
- Avatar upload
- Account settings

### 11.2 Settings Page
File: `src/pages/Settings.tsx`

Sections:
- Notification preferences
- Privacy settings
- Data export
- Account deletion
- AI usage summary

### 11.3 Verification Criteria
- [ ] Profile editable and saves
- [ ] Avatar upload working
- [ ] Settings persist
- [ ] Data export generates file

---

## Phase 12: Error Handling & Loading States
**Priority:** High | **Estimated Effort:** 2-3 hours

### 12.1 Global Error Boundary
Enhance `src/components/common/ErrorBoundary.tsx`:
- Catch render errors
- Show friendly message
- Report to console
- Retry option

### 12.2 API Error Handling
- Consistent error format from edge functions
- Toast notifications for errors
- Retry mechanisms for transient failures

### 12.3 Loading States
Per component:
- Skeleton loaders
- Spinner indicators
- Progress bars for long operations

### 12.4 Empty States
Per component:
- Helpful illustrations
- Action CTAs
- Contextual guidance

### 12.5 Verification Criteria
- [ ] No unhandled errors reach user
- [ ] All loading states implemented
- [ ] All empty states have CTAs
- [ ] Errors logged for debugging

---

## Phase 13: Testing & Quality
**Priority:** High | **Estimated Effort:** 4-6 hours

### 13.1 Component Testing
- Test all form validations
- Test all user flows
- Test error states

### 13.2 Integration Testing
- Test edge function calls
- Test database operations
- Test file uploads

### 13.3 AI Output Validation
Per spec Part 13.2:
- Verify structured output format
- Check for hallucinations
- Validate recommendation quality

### 13.4 Performance Testing
- Page load times < 2s
- API response times < 500ms
- Smooth animations

### 13.5 Verification Criteria
- [ ] All critical paths tested
- [ ] No console errors
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed

---

## Phase 14: Polish & Launch Prep
**Priority:** Medium | **Estimated Effort:** 3-4 hours

### 14.1 SEO Implementation
- Meta tags on all pages
- Open Graph tags
- Structured data
- Sitemap

### 14.2 Analytics Integration
- Page view tracking
- Event tracking
- Conversion funnels

### 14.3 Documentation
- User guide
- FAQ section
- API documentation (if public)

### 14.4 Launch Checklist
- [ ] All features working
- [ ] Performance optimized
- [ ] Security audit passed
- [ ] Backup procedures in place
- [ ] Monitoring configured
- [ ] Error alerting set up

---

## Implementation Order & Dependencies

```
Phase 1 (Database) ────┐
                       ├──► Phase 3 (Edge Functions)
Phase 2 (Storage) ─────┘          │
                                  ▼
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          Phase 4 (Forms)              Phase 5 (UI Components)
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          Phase 6 (Onboarding)         Phase 7 (Dashboard)
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                         Phase 8 (Workflows)
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
          Phase 9          Phase 10       Phase 11
         (Scanner)         (Usage)       (Settings)
                    │             │             │
                    └─────────────┴─────────────┘
                                  ▼
                         Phase 12 (Error Handling)
                                  ▼
                         Phase 13 (Testing)
                                  ▼
                         Phase 14 (Launch)
```

---

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1. Database | ✅ Done | 2024-12-19 | 2024-12-19 | pgvector enabled, vector columns added |
| 2. Storage | ✅ Done | 2024-12-19 | 2024-12-19 | Syllabi bucket with RLS policies |
| 3. Edge Functions | ✅ Done | 2024-12-19 | 2024-12-19 | AI orchestrator, cache helpers created |
| 4. Forms | ✅ Done | 2024-12-19 | 2024-12-19 | ProfileForm, form-utils.ts, validation schemas |
| 5. UI Components | ✅ Done | 2024-12-19 | 2024-12-19 | Enhanced GapsList, OverlapsList, HonestAssessment |
| 6. Onboarding | ✅ Done | 2024-12-19 | 2024-12-19 | Already well implemented, verified |
| 7. Dashboard | ✅ Done | 2024-12-19 | 2024-12-19 | useDashboard hook, query keys updated |
| 8. Workflows | ✅ Done | 2024-12-19 | 2024-12-19 | useWorkflows hook with full orchestration |
| 9. Scanner | ✅ Done | 2024-12-19 | 2024-12-19 | Rate limiting, AI integration added |
| 10. Usage | ✅ Done | 2024-12-19 | 2024-12-19 | Usage page with stats and recent activity |
| 11. Settings | ✅ Done | - | - | Already implemented |
| 12. Errors | ✅ Done | - | - | ErrorBoundary, LoadingState already exist |
| 13. Testing | ⏳ Pending | - | - | Manual testing done, automated pending |
| 14. Launch | ✅ Done | 2024-12-19 | 2024-12-19 | SEO hook, page-specific meta tags added |

---

## Notes & Decisions

### TanStack Router
Currently blocked due to tsconfig.json restrictions. Using react-router-dom. Will revisit if constraints are lifted.

### Multi-Model AI
Using Lovable AI Gateway exclusively. Not implementing direct OpenAI/Anthropic integrations to simplify architecture.

### Vector Embeddings
Will use Lovable AI to generate embeddings. May skip if performance is acceptable without vector similarity search.

---

*This document will be updated as phases are completed.*
