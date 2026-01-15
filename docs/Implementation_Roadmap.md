# SyllabusStack Strategic Analysis: A User-Centric Implementation Roadmap

> **Document Purpose**: This document serves as the authoritative implementation guide for AI agents and developers working on SyllabusStack. It provides narrative context for each feature, explaining WHO does WHAT, WHEN, WHY, and HOW. Use this for continuity across sessions and quality control.

---

## Document Metadata

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Created** | 2025-12-20 |
| **Last Updated** | 2025-12-20 |
| **Status** | Active |
| **Stakeholders** | Development Agents, QA, Product |

---

## Table of Contents

1. [Discovery Phase](#part-1-the-discovery-phase)
2. [Authentication Phase](#part-2-the-authentication-phase)
3. [Onboarding Phase](#part-3-the-onboarding-phase)
4. [Dashboard Experience](#part-4-the-dashboard-experience)
5. [Core Value Loop](#part-5-the-core-value-loop)
6. [Data Export](#part-6-the-data-export-need)
7. [Retention System](#part-7-the-retention-challenge)
8. [Social Proof](#part-8-the-social-proof-opportunity)
9. [Development Phases Summary](#development-phases-summary)
10. [Technical Implementation Details](#technical-implementation-details)

---

## Part 1: The Discovery Phase

### Current State

**Actor**: Anonymous Visitor (prospective user)

**Trigger**: User arrives at the EduThree landing page (`/`) because they:
- Searched for "career planning for students"
- Heard about the platform from a peer
- Clicked on a marketing link

**Current Behavior**: The landing page (`src/pages/Index.tsx`) presents:
- Hero section with value proposition
- Feature highlights
- Testimonials section
- Pricing information

**User Action**: The visitor scrolls through, trying to understand what value EduThree provides.

### Problem Analysis

**Outcome A (Negative)**: User leaves because the value proposition isn't immediately clear.

**Outcome B (Positive)**: User becomes curious enough to try the free syllabus scanner (`/scanner`).

**The Scanner Experience**: The `SyllabusScanner` page (`src/pages/SyllabusScanner.tsx`) allows anonymous users to:
1. Paste syllabus text into a text area
2. Click "Analyze" to trigger AI extraction
3. View extracted capabilities on the test results page (`/test-results`)

### Identified Gap

**Location**: `/test-results` page (`src/pages/TestResults.tsx`)

**Problem**: After viewing scanned results:
- No persistent call-to-action guides users toward signup
- Results disappear when user leaves the page
- No mechanism to save or email preview results
- User effort is wasted if they don't immediately sign up

### Proposed Solution

**Feature**: "Save These Results" Conversion Flow

**Implementation Requirements**:

1. **UI Component**: Add a prominent CTA on `/test-results`
   - Component: `src/components/scanner/SaveResultsCTA.tsx`
   - Trigger: Displays when user has unsaved preview results
   - Text: "Sign up to keep these results and track your progress"

2. **State Persistence**: Store preview results temporarily
   - Use `localStorage` with key `eduthree_preview_results`
   - Expiry: 24 hours
   - Structure: `{ syllabusText: string, capabilities: Capability[], timestamp: number }`

3. **Signup Flow Integration**: Auto-create course on signup
   - Location: `src/contexts/AuthContext.tsx` or new hook `usePreviewConversion.ts`
   - Trigger: After successful signup, check for preview results
   - Action: Call `analyze-syllabus` edge function with stored syllabus text
   - Result: User's first course is pre-populated

```
flowchart LR
    A[User Lands on Homepage] --> B{Understands Value?}
    B -->|No| C[Leaves Site]
    B -->|Yes| D[Tries Free Scanner]
    D --> E[Sees Preview Results]
    E --> F{Wants to Keep Results?}
    F -->|No| C
    F -->|Yes| G[Signs Up]
    G --> H[Results Auto-Saved as First Course]

    style C fill:#fee2e2
    style H fill:#dcfce7
```

### Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/TestResults.tsx` | Modify | Add SaveResultsCTA component |
| `src/components/scanner/SaveResultsCTA.tsx` | Create | New conversion CTA component |
| `src/hooks/usePreviewConversion.ts` | Create | Handle preview-to-account conversion |
| `src/lib/storage.ts` | Modify | Add preview results storage utilities |

---

## Part 2: The Authentication Phase

### Current State

**Actor**: Prospective user who decided to sign up

**Location**: Auth page (`/auth`) implemented in `src/pages/Auth.tsx`

**Current Behavior**:
1. User navigates to `/auth`
2. User sees `LoginForm` or `SignupForm` (toggle between them)
3. Signup collects: email, password, optional full name
4. On successful registration:
   - Backend creates user record in `auth.users`
   - Database trigger (`handle_new_user`) creates `profiles` entry
   - User is authenticated and session is established

**Post-Auth Routing** (handled by `AuthGuard` in `src/components/auth/AuthGuard.tsx`):
- If `profile.onboarding_completed === false` → Redirect to `/onboarding`
- If `profile.onboarding_completed === true` → Redirect to `/dashboard`

### Problem Analysis

**Situation**: New user is redirected to onboarding but may feel lost:
- No progress indicator showing how many steps remain
- No contextual help explaining why each step matters
- `profile.onboarding_step` field tracks progress but isn't utilized

**Abandonment Risk**: Users who leave onboarding midway have no reminder to return.

### Identified Gap

**Location**: `OnboardingWizard` component (`src/components/onboarding/OnboardingWizard.tsx`)

**Problems**:
1. Missing visual progress indicator (e.g., "Step 2 of 4")
2. No re-engagement mechanism for abandoned onboarding
3. `onboarding_step` field is underutilized

### Proposed Solution

**Feature Set**:

1. **Progress Indicator UI**
   - Location: `OnboardingWizard.tsx`
   - Visual: Step dots or progress bar at top of wizard
   - Text: "Step X of Y" with step names
   - Behavior: Updates as user progresses through steps

2. **Onboarding Reminder Email** (Phase 3 - Retention)
   - Trigger: 24 hours after signup if `onboarding_completed = false`
   - Channel: Email via edge function
   - Content: "Complete your profile to get personalized career recommendations"

### Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/components/onboarding/OnboardingWizard.tsx` | Modify | Add progress indicator |
| `src/components/onboarding/OnboardingProgress.tsx` | Create | Visual progress component |
| `supabase/functions/send-onboarding-reminder/index.ts` | Create (Phase 3) | Email trigger |

---

## Part 3: The Onboarding Phase

### Current State

**Actor**: Newly authenticated user

**Location**: Onboarding wizard at `/onboarding`

**Current Workflow**:

| Step | User Action | System Response |
|------|-------------|-----------------|
| 1 | Provides profile info (university, major, graduation year, student level) | Saves to `profiles` table |
| 2 | Adds first course with syllabus text | Triggers `analyze-syllabus` edge function |
| 3 | Defines at least one dream job | Triggers `analyze-dream-job` edge function |
| 4 | Completes wizard | Sets `onboarding_completed = true` |

**AI Processing Flow**:
- `analyze-syllabus` edge function (`supabase/functions/analyze-syllabus/index.ts`):
  - Receives syllabus text
  - Calls Lovable AI (Gemini) to extract capabilities
  - Returns: capabilities[], tools_methods[], evidence_types[]
  
- `analyze-dream-job` edge function (`supabase/functions/analyze-dream-job/index.ts`):
  - Receives job title, company type, location
  - Calls Lovable AI to extract requirements
  - Returns: requirements[], differentiators[], realistic_bar

### Problem Analysis

**Situation**: User waits during AI processing with only a spinner visible.

**User Experience Gap**:
- User doesn't understand what's happening
- No feedback about what AI is extracting
- Creates anxiety and potential abandonment

### Identified Gap

**Location**: AI processing states in `CourseUploader.tsx` and `DreamJobSelector.tsx`

**Problem**: Generic loading spinner with no contextual information.

### Proposed Solution

**Feature**: AI Processing Status Messages

**Implementation**:

1. **Staged Loading Messages**
   - Component: `src/components/common/AIProcessingIndicator.tsx`
   - States:
     - "Analyzing your syllabus..."
     - "Extracting skills and capabilities..."
     - "Categorizing by theme..."
     - "Found X capabilities!"

2. **Animation Enhancement**
   - Use framer-motion for smooth transitions
   - Progress indicator showing estimated completion
   - Checkmarks for completed stages

```
sequenceDiagram
    actor User
    participant UI as Onboarding UI
    participant API as Edge Function
    participant AI as Lovable AI

    User->>UI: Pastes syllabus text
    UI->>API: POST /analyze-syllabus
    API->>AI: Extract capabilities
    Note over UI: Currently: Generic spinner
    Note over UI: Proposed: "Analyzing syllabus..."
    AI-->>API: Returns capabilities[]
    Note over UI: Proposed: "Found 12 skills!"
    API-->>UI: {capabilities, tools, methods}
    UI->>User: Shows extracted capabilities
```

### Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/components/common/AIProcessingIndicator.tsx` | Create | Staged loading component |
| `src/components/onboarding/CourseUploader.tsx` | Modify | Integrate AI indicator |
| `src/components/onboarding/DreamJobSelector.tsx` | Modify | Integrate AI indicator |

---

## Part 4: The Dashboard Experience

### Current State

**Actor**: Authenticated user who completed onboarding

**Location**: Dashboard at `/dashboard` (`src/pages/Dashboard.tsx`)

**Current Components**:

1. **DashboardOverview** (`src/components/dashboard/DashboardOverview.tsx`)
   - Displays aggregate stats: courses analyzed, dream jobs tracked, capabilities identified
   - Shows gaps to close, recommendations completed vs total
   - Overall readiness score

2. **DreamJobCards** (`src/components/dashboard/DreamJobCards.tsx`)
   - Cards for each target role
   - Match percentage visualization
   - Quick navigation to job details

3. **CapabilitySnapshot** (`src/components/dashboard/CapabilitySnapshot.tsx`)
   - Skills summary by category
   - Proficiency levels visualization

### Problem Analysis

**Situation**: Dashboard shows data but doesn't guide action.

**User Confusion**: User sees numbers and cards but lacks clear direction on what to do next.

**Current Priority Display**: "Top priority" recommendation appears in a small card, easily overlooked.

### Identified Gap

**Location**: Dashboard page layout and hierarchy

**Problem**: Informational but not actionable. No "your next step is X because Y" prompt.

### Proposed Solution

**Feature**: Smart Next Action Banner

**Implementation**:

1. **Component**: `src/components/dashboard/NextActionBanner.tsx`

2. **Logic Tree**:
   ```typescript
   function getNextAction(stats: DashboardStats): NextAction {
     if (stats.totalCourses === 0) {
       return {
         title: "Add your first course",
         description: "Upload a syllabus to discover your capabilities",
         action: "/courses",
         priority: "high"
       };
     }
     if (stats.totalDreamJobs === 0) {
       return {
         title: "Define a dream job",
         description: "See how your skills match up to your career goals",
         action: "/dream-jobs",
         priority: "high"
       };
     }
     if (!stats.hasGapAnalysis) {
       return {
         title: "Run gap analysis",
         description: "Identify the skills you need to develop",
         action: "/analysis",
         priority: "high"
       };
     }
     if (stats.pendingRecommendations > 0) {
       return {
         title: `${stats.pendingRecommendations} skills to develop`,
         description: `Start with: ${stats.topRecommendation}`,
         action: "/recommendations",
         priority: "medium"
       };
     }
     return {
       title: "You're on track!",
       description: "Keep updating your courses as you progress",
       action: "/courses",
       priority: "low"
     };
   }
   ```

3. **Visual Design**:
   - Prominent placement at top of dashboard
   - Color-coded by priority (high = accent, medium = primary, low = muted)
   - Clear CTA button

### Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/components/dashboard/NextActionBanner.tsx` | Create | Smart action guidance |
| `src/pages/Dashboard.tsx` | Modify | Add NextActionBanner |
| `src/hooks/useDashboard.ts` | Modify | Add next action logic |

---

## Part 5: The Core Value Loop

### Current State

**Actor**: User with courses and dream jobs added

**Location**: Analysis page (`/analysis`) and Recommendations page (`/recommendations`)

**Current Workflow**:

1. **Gap Analysis** (`src/pages/Analysis.tsx`):
   - Uses `useAnalysis` hook to fetch from `gap_analyses` table
   - Displays:
     - Strong overlaps (skills matching job requirements)
     - Partial overlaps (skills partially matching)
     - Critical gaps (missing skills)
   - Shows match score (e.g., 62%)

2. **Recommendations** (`src/pages/Recommendations.tsx`):
   - Uses `useRecommendations` hook to fetch from `recommendations` table
   - Displays AI-generated learning paths:
     - Courses to take
     - Projects to build
     - Certifications to earn
   - Each recommendation has: title, description, type, priority, estimated effort

### Problem Analysis

**Critical Journey Dead-End**: After viewing recommendations, user journey stops.

**Missing Functionality**:
1. Cannot mark a recommendation as "started" or "completed"
2. Cannot trigger re-analysis after skill acquisition
3. Cannot see match score improve over time

**Impact**: Users who follow recommendations see no tangible progress in platform → kills motivation → causes churn.

### Identified Gap

**Location**: `RecommendationCard` component and `useRecommendations` hook

**Problem**: No status tracking, no feedback loop, no visible progress.

### Proposed Solution

**Feature**: Complete Progress Tracking System (PHASE 1 - HIGHEST PRIORITY)

**Database Schema** (already exists):
```sql
-- recommendations table has status column
-- Possible values: 'pending', 'in_progress', 'completed', 'skipped'
```

**Implementation**:

1. **UI Status Controls** in `RecommendationCard`:
   ```typescript
   // Status buttons
   <Button onClick={() => onStatusChange(id, 'in_progress')}>Start This</Button>
   <Button onClick={() => onStatusChange(id, 'completed')}>Mark Complete</Button>
   <Button onClick={() => onStatusChange(id, 'skipped')}>Skip</Button>
   ```

2. **Re-Analysis Prompt**:
   - Trigger: When user marks recommendation as 'completed'
   - UI: Modal asking "Want to re-run your gap analysis to see your new score?"
   - Action: If yes, call `gap-analysis` edge function for active dream job

3. **Progress Visualization**:
   - Dashboard widget showing recommendations by status
   - Historical match score chart (requires new `match_score_history` table or JSON field)

```
stateDiagram-v2
    [*] --> Pending: Recommendation Generated
    Pending --> InProgress: User clicks "Start This"
    InProgress --> Completed: User clicks "Mark Complete"
    Completed --> Verified: Re-run gap analysis
    Verified --> [*]: Match score updated

    note right of Pending: status='pending'
    note right of InProgress: status='in_progress'
    note right of Completed: status='completed'
    note right of Verified: Triggers recalculation
```

### Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/components/recommendations/RecommendationCard.tsx` | Modify | Add status controls |
| `src/hooks/useRecommendations.ts` | Modify | Add status update mutation (exists) |
| `src/components/recommendations/ReAnalysisPrompt.tsx` | Create | Completion modal |
| `src/components/dashboard/ProgressWidget.tsx` | Create | Dashboard progress visualization |

---

## Part 6: The Data Export Need

### Current State

**Actor**: User with accumulated data in EduThree

**Data Assets**:
- Capability profile (skills, categories, proficiency levels)
- Gap analyses (overlaps, gaps, match scores)
- Personalized recommendations
- Course history

**Current Access**: Data exists only within platform interface.

### Problem Analysis

**Missed Opportunity**: When users apply for jobs, they need to articulate skills and development journey.

**User Workaround**: Manual copy-paste from platform into resumes/cover letters:
- Tedious and error-prone
- Loses structured format
- No professional presentation

### Identified Gap

**Location**: Profile, Analysis, and Recommendations pages

**Problem**: No export functionality exists.

### Proposed Solution

**Feature**: Export System (PHASE 2)

**Two Export Types**:

1. **PDF Report**:
   - Professional formatting
   - Content includes:
     - User profile summary
     - Capability inventory by category
     - Dream job analysis with match scores
     - Gap summary with priority areas
     - Completed recommendations as "achievements"

2. **JSON Export**:
   - Raw data download
   - Use case: Import into other systems, personal records

**Implementation**:

1. **Edge Function**: `supabase/functions/generate-pdf-report/index.ts`
   - Uses PDF generation library (e.g., jspdf, pdfkit for Deno)
   - Fetches user data from tables
   - Generates formatted PDF
   - Returns PDF as base64 or direct download

2. **UI Components**:
   - Export button on Analysis page
   - Export button on Profile page
   - Dropdown with format options (PDF, JSON)

3. **Optional Shareable Profile**:
   - Public URL for profile (e.g., `/profile/[username]`)
   - RLS policy adjustment for public read of specific fields
   - Privacy toggle in settings

### Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/generate-pdf-report/index.ts` | Create | PDF generation |
| `src/components/common/ExportButton.tsx` | Create | Reusable export UI |
| `src/pages/Analysis.tsx` | Modify | Add export option |
| `src/pages/Profile.tsx` | Modify | Add export option |

---

## Part 7: The Retention Challenge

### Current State

**Actor**: User who completed initial analysis and viewed recommendations

**Platform Behavior**: Entirely passive after initial use.

**No Triggers For**:
- Adding new courses when semester changes
- Updating capabilities after experiences
- Re-running analyses periodically

### Problem Analysis

**User Reality**: Students take new courses each semester, gain new experiences, capabilities evolve.

**Platform Miss**: EduThree doesn't capture ongoing growth because users forget to update.

**Result**: User churn after initial engagement.

### Identified Gap

**Location**: Entire platform (no notification/email system)

**Problem**: No mechanism to bring users back.

### Proposed Solution

**Feature**: Multi-Channel Reminder System (PHASE 3)

**Channels**:

1. **Email Digests**:
   - Frequency: Weekly or monthly (user preference)
   - Storage: New column `profiles.email_preferences` (JSONB)
   - Content examples:
     - "You've been on EduThree for 30 days. Have you taken any new courses?"
     - "Your match score for [Job] is 62%. Here's what could boost it."
     - "3 users targeting [same job] completed [recommendation]."

2. **In-App Nudges**:
   - Trigger: User returns after 14+ days
   - UI: Top banner on dashboard
   - Message: "Welcome back! Want to add any new courses from this semester?"

**Implementation**:

1. **Database Schema**:
   ```sql
   ALTER TABLE profiles ADD COLUMN email_preferences JSONB DEFAULT '{"weekly_digest": false, "monthly_digest": true}';
   ALTER TABLE profiles ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT now();
   ```

2. **Edge Function**: `supabase/functions/send-digest-email/index.ts`
   - Scheduled via pg_cron (or external scheduler)
   - Queries users with digest preferences enabled
   - Generates personalized content using Lovable AI
   - Sends via Resend integration

3. **Activity Tracking**:
   - Update `last_active_at` on page views
   - Use for "days since last active" nudge logic

```
flowchart TB
    subgraph Current["Current State: Passive Platform"]
        A[User Completes Analysis] --> B[Views Recommendations]
        B --> C[Leaves Platform]
        C --> D[May Never Return]
    end

    subgraph Proposed["Proposed: Active Engagement"]
        A2[User Completes Analysis] --> B2[Views Recommendations]
        B2 --> C2[Leaves Platform]
        C2 --> D2[Day 7: Progress Email]
        D2 --> E2[User Returns]
        E2 --> F2[Adds New Course]
        F2 --> G2[Re-runs Analysis]
        G2 --> H2[Sees Improvement]
        H2 --> B2
    end

    style D fill:#fee2e2
    style H2 fill:#dcfce7
```

### Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/send-digest-email/index.ts` | Create | Email digest sender |
| `src/components/dashboard/WelcomeBackBanner.tsx` | Create | Return user nudge |
| `src/pages/Settings.tsx` | Modify | Add email preferences |
| `src/hooks/useActivityTracking.ts` | Create | Track user activity |

---

## Part 8: The Social Proof Opportunity

### Current State

**Actor**: User working in isolation

**Current Experience**: No visibility into:
- Peer comparisons
- Success stories from similar users
- Aggregate data on effective learning paths

### Problem Analysis

**User Uncertainty**: "Am I on the right track? Have others like me succeeded with this approach?"

**Static Pages**: Universities and Resources pages are placeholders without dynamic content.

### Identified Gap

**Location**: Platform-wide (no benchmarking features)

**Problem**: No social proof or peer comparison functionality.

### Proposed Solution

**Feature**: Anonymous Benchmarking (PHASE 4 - FUTURE)

**Components**:

1. **Anonymous Job Benchmarks**:
   - Display on Dream Job detail page
   - Metrics:
     - "Average match score for this role: 71%"
     - "Most common gaps: [skill1], [skill2], [skill3]"
     - "Top recommended courses by users targeting this role"

2. **University Cohort Insights**:
   - For users at same university
   - Metrics:
     - "12 students at [Your University] are also targeting this role"
     - "Popular courses at [Your University] for this career path"

**Privacy Requirements**:
- Only show aggregates when N > 10 (prevent identification)
- User opt-out for contributing to aggregates
- No PII exposed

**Implementation** (Future Phase):
1. Aggregate calculation edge function
2. Privacy-safe data views
3. UI components for benchmark display

---

## Development Phases Summary

| Phase | Focus | User Need | Key Deliverables | Priority |
|-------|-------|-----------|------------------|----------|
| **1** | Progress Loop | "I want to see my score improve" | Recommendation status tracking, re-analysis trigger, progress visualization | **HIGHEST** |
| **2** | Data Portability | "I want to use this outside the platform" | PDF export, JSON download, optional shareable profile | HIGH |
| **3** | Re-engagement | "Remind me to keep updating" | Email digests, in-app nudges, activity tracking | MEDIUM |
| **4** | Social Proof | "How do I compare to others?" | Anonymous benchmarks, cohort insights | FUTURE |

---

## Technical Implementation Details

### Phase 1: Progress Loop

**Sprint Allocation**: 2 sprints

**Sprint 1 Tasks**:
1. Update `RecommendationCard.tsx` with status controls
2. Implement status change mutation in `useRecommendations.ts`
3. Create `ReAnalysisPrompt.tsx` modal component
4. Add toast notifications for status changes

**Sprint 2 Tasks**:
1. Create `ProgressWidget.tsx` for dashboard
2. Implement match score history tracking
3. Add progress summary to `DashboardOverview`
4. E2E testing for complete flow

**Database Changes Required**: None (status column exists)

**Edge Function Changes**: None (gap-analysis already supports re-run)

### Phase 2: Data Export

**Sprint Allocation**: 1 sprint

**Tasks**:
1. Create `generate-pdf-report` edge function
2. Implement PDF template with branding
3. Create `ExportButton` component
4. Add JSON export utility function
5. Integrate export buttons on Analysis and Profile pages

**Dependencies**: 
- PDF library for Deno (research options: jspdf port or pdfkit)
- May need RESEND_API_KEY for email delivery of reports

### Phase 3: Re-engagement

**Sprint Allocation**: 1 sprint

**Tasks**:
1. Add `email_preferences` column to profiles
2. Create Settings page email preferences UI
3. Implement `send-digest-email` edge function
4. Set up pg_cron schedule for weekly/monthly runs
5. Create `WelcomeBackBanner` component
6. Implement activity tracking

**Dependencies**:
- RESEND_API_KEY for email sending
- pg_cron extension enabled

### Phase 4: Social Proof

**Sprint Allocation**: 2+ sprints (future)

**Prerequisites**:
- Sufficient user base (N > 100 per job category)
- Privacy policy updates
- User consent mechanism

---

## Quality Control Checklist

For each feature implementation, verify:

- [ ] User story matches documented narrative
- [ ] All files listed in "Files to Modify/Create" are addressed
- [ ] Database changes use migration tool (not direct edits)
- [ ] RLS policies reviewed for new/modified tables
- [ ] Toast notifications for user feedback
- [ ] Loading states during async operations
- [ ] Error handling with user-friendly messages
- [ ] Mobile responsiveness verified
- [ ] Accessibility (ARIA labels, keyboard navigation)

---

## Glossary

| Term | Definition |
|------|------------|
| **Gap Analysis** | AI-powered comparison of user capabilities vs job requirements |
| **Match Score** | Percentage indicating alignment between user skills and job needs |
| **Recommendation** | Actionable suggestion to close a skill gap |
| **Capability** | A skill or competency extracted from course syllabus |
| **Dream Job** | User's target career role for analysis |

---

*This document should be referenced at the start of each development session to ensure continuity and alignment with the strategic vision.*
