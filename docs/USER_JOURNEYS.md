# User Journeys - SyllabusStack

This document describes the complete user flows for each role in SyllabusStack.

## Table of Contents

1. [Student Journey](#student-journey)
2. [Instructor Journey](#instructor-journey)
3. [Admin Journey](#admin-journey)
4. [Common Flows](#common-flows)

---

## Student Journey

### Overview

Students use SyllabusStack to:
1. Upload course syllabi for AI analysis
2. Define career goals (dream jobs)
3. Identify skill gaps between current abilities and job requirements
4. Get personalized learning recommendations
5. Track progress toward career readiness

### Journey Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         STUDENT JOURNEY                               │
└──────────────────────────────────────────────────────────────────────┘

[Landing Page] ──→ [Auth] ──→ [Onboarding] ──→ [Dashboard]
       │              │              │               │
       │              │              │               ├──→ [Learn Page]
       │              │              │               │        │
       │              │              │               │        ├── View courses
       │              │              │               │        ├── Upload syllabus
       │              │              │               │        └── Track completion
       │              │              │               │
       │              │              │               └──→ [Career Page]
       │              │              │                        │
       │              │              │                        ├── Add dream jobs
       │              │              │                        ├── View gap analysis
       │              │              │                        ├── Get recommendations
       │              │              │                        └── Track progress
       │              │              │
       │              │              └── Steps:
       │              │                  1. Complete profile
       │              │                  2. Add courses (syllabus)
       │              │                  3. Add dream jobs
       │              │                  4. Complete!
       │              │
       │              └── Login/Signup with email
       │
       └── Marketing page with features
```

### Detailed Step-by-Step

#### Step 1: Landing → Authentication

**Route:** `/` → `/auth`

**User Actions:**
1. User arrives at landing page (`Index.tsx`)
2. Views features, testimonials, pricing
3. Clicks "Sign Up" or "Get Started"
4. Redirected to auth page (`Auth.tsx`)

**Components Involved:**
- `src/pages/Index.tsx` - Landing page
- `src/components/landing/*` - Hero, Features, Testimonials
- `src/pages/Auth.tsx` - Login/signup forms

**Technical Flow:**
```
User clicks "Sign Up"
    ↓
Navigate to /auth?tab=signup
    ↓
AuthContext: signUp(email, password)
    ↓
Supabase Auth creates user
    ↓
Database trigger creates profile
    ↓
Redirect to /onboarding
```

---

#### Step 2: Onboarding

**Route:** `/onboarding`

**User Actions:**
1. Complete profile (name, university, major)
2. Add courses via syllabus upload or manual entry
3. Add dream jobs
4. Complete onboarding

**Components Involved:**
- `src/pages/Onboarding.tsx` - Multi-step wizard
- `src/components/forms/AddCourseForm.tsx`
- `src/components/forms/AddDreamJobForm.tsx`

**Technical Flow:**
```
Step 1: Profile Form
    ↓
Supabase: UPDATE profiles SET full_name, university, major
    ↓
Step 2: Add Courses
    ↓
User uploads syllabus OR enters course manually
    ↓
Edge Function: analyze-syllabus
    ↓
AI extracts: capabilities, tools, key skills
    ↓
INSERT INTO courses + INSERT INTO capabilities
    ↓
Step 3: Add Dream Jobs
    ↓
User enters job title + company type
    ↓
Edge Function: analyze-dream-job
    ↓
AI extracts: requirements, differentiators, misconceptions
    ↓
INSERT INTO dream_jobs + INSERT INTO job_requirements
    ↓
Step 4: Complete
    ↓
UPDATE profiles SET onboarding_completed = true
    ↓
Redirect to /dashboard
```

---

#### Step 3: Dashboard

**Route:** `/dashboard`

**User Views:**
- Capability snapshot (top skills)
- Dream job cards with match scores
- Progress widget
- Next action recommendations

**Components Involved:**
- `src/pages/Dashboard.tsx`
- `src/components/dashboard/CapabilitySnapshot.tsx`
- `src/components/dashboard/DreamJobCards.tsx`
- `src/components/dashboard/ProgressWidget.tsx`
- `src/components/dashboard/NextActionBanner.tsx`

**Data Fetched:**
```typescript
useDashboard()
  → capabilities (top 5)
  → dream_jobs (with match_score)
  → recommendations (in_progress count)
  → recent_activity
```

---

#### Step 4: Learn Page (Course Management)

**Route:** `/learn`

**Tabs:**
1. **Active** - Current semester courses
2. **Transcript** - Completed courses
3. **All Courses** - Browse available courses

**User Actions:**
- View course list
- Add new course (syllabus upload)
- Click course → Course detail page
- Search for courses

**Components Involved:**
- `src/pages/Learn.tsx`
- `src/components/learn/*`

**Technical Flow (Add Course):**
```
User uploads syllabus file
    ↓
Service: parseSyllabusDocument(file)
    ↓
Upload to Supabase Storage (/syllabi bucket)
    ↓
Edge Function: parse-syllabus-document
    ↓
Edge Function: analyze-syllabus
    ↓
INSERT INTO courses
    ↓
INSERT INTO capabilities (extracted skills)
    ↓
React Query: invalidate(['courses'])
    ↓
UI updates with new course
```

---

#### Step 5: Course Detail

**Route:** `/learn/course/:courseId`

**User Views:**
- Course information (title, instructor, credits)
- Extracted capabilities/skills
- Learning objectives
- Related content (videos, readings)

**Components Involved:**
- `src/pages/student/StudentCourseDetail.tsx`
- `src/components/student/*`

**User Actions:**
- View extracted skills from syllabus
- Access learning materials
- Navigate to learning objectives

---

#### Step 6: Career Page (Gap Analysis)

**Route:** `/career`

**Tabs:**
1. **Jobs** - Manage dream jobs
2. **Gaps** - View skill gaps
3. **Actions** - Recommendations
4. **Don't Do** - Anti-recommendations

**Components Involved:**
- `src/pages/CareerPath.tsx`
- `src/components/analysis/*`
- `src/components/recommendations/*`

**Technical Flow (Gap Analysis):**
```
User selects dream job
    ↓
useAnalysis(dreamJobId)
    ↓
Edge Function: gap-analysis
    ↓
Fetch: user capabilities + job requirements
    ↓
AI compares and generates:
  - strong_overlaps
  - critical_gaps
  - partial_overlaps
  - honest_assessment
  - readiness_level (1-5)
    ↓
INSERT INTO gap_analyses
    ↓
Display in GapAnalysisDisplay component
```

**Technical Flow (Recommendations):**
```
User views Actions tab
    ↓
useRecommendations(dreamJobId)
    ↓
Edge Function: generate-recommendations
    ↓
Based on gap analysis, AI generates:
  - action_title
  - action_description
  - steps[] with estimated_time
  - type (project|course|certification)
  - effort_hours, cost
  - why_this_matters
    ↓
INSERT INTO recommendations
    ↓
Display as actionable cards
```

---

#### Step 7: Learning Objective Detail

**Route:** `/learn/objective/:loId`

**User Actions:**
- View objective details
- Access related content
- Take assessment

**Components Involved:**
- `src/pages/student/LearningObjective.tsx`
- `src/components/learn/*`

---

#### Step 8: Assessment

**Route:** `/learn/objective/:loId/assess`

**User Actions:**
- Answer quiz questions
- Submit answers
- View results with explanations

**Components Involved:**
- `src/pages/student/Assessment.tsx`
- `src/components/assessment/*`

**Technical Flow:**
```
User clicks "Take Assessment"
    ↓
Edge Function: generate-assessment-questions
    ↓
AI generates: questions, options, correct_answer
    ↓
User answers questions
    ↓
Edge Function: submit-assessment-answer
    ↓
Validate answer, return explanation
    ↓
Edge Function: complete-assessment
    ↓
UPDATE user_progress SET completion_percentage
```

---

## Instructor Journey

### Overview

Instructors use SyllabusStack to:
1. Create and manage courses
2. Define learning objectives
3. Curate or auto-discover content
4. Generate assessments
5. Monitor student progress

### Journey Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                       INSTRUCTOR JOURNEY                              │
└──────────────────────────────────────────────────────────────────────┘

[Auth] ──→ [Onboarding (instructor role)] ──→ [Instructor Dashboard]
                                                       │
                     ┌─────────────────────────────────┤
                     │                                 │
                     ↓                                 ↓
           [Quick Course Setup]              [Course List]
                     │                                 │
                     ↓                                 │
           AI generates:                              │
           - Learning objectives                      │
           - Content strategy                         │
                     │                                 │
                     └────────────┬────────────────────┘
                                  │
                                  ↓
                         [Course Detail]
                                  │
                     ┌────────────┼────────────┐
                     │            │            │
                     ↓            ↓            ↓
               [Modules]    [Content]    [Students]
                     │            │            │
                     ↓            ↓            ↓
               Define LOs   Add/verify   View progress
                           materials
```

### Detailed Steps

#### Step 1: Course Creation

**Route:** `/instructor/quick-setup`

**User Actions:**
1. Enter course title, code, description
2. Select curation mode:
   - **Full Control** - Manual content only
   - **Guided Auto** - AI suggests, instructor approves
   - **Hands Off** - AI auto-curates everything
3. Submit for AI processing

**Technical Flow:**
```
Instructor submits course form
    ↓
INSERT INTO instructor_courses
    ↓
Edge Function: extract-learning-objectives
    ↓
AI generates learning objectives
    ↓
INSERT INTO learning_objectives
    ↓
Edge Function: discover content (based on curation_mode)
    ↓
INSERT INTO learning_materials
    ↓
Redirect to course detail
```

---

#### Step 2: Course Management

**Route:** `/instructor/courses/:courseId`

**User Actions:**
- Edit course details
- Manage modules and learning objectives
- Add/verify content
- Generate assessments
- Share access code with students

**Components Involved:**
- `src/pages/instructor/InstructorCourseDetail.tsx`
- `src/components/instructor/*`

---

#### Step 3: Content Management

**User Actions:**
- View AI-discovered content
- Manually add content URLs
- Verify or reject suggested content
- Link content to learning objectives

**Technical Flow:**
```
AI discovers content
    ↓
INSERT INTO learning_materials (verified_by_instructor = false)
    ↓
Instructor reviews
    ↓
UPDATE learning_materials SET verified_by_instructor = true
    OR
DELETE learning_materials (rejected)
```

---

#### Step 4: Assessment Creation

**User Actions:**
- Generate AI questions for learning objectives
- Review and edit questions
- Set pass thresholds

**Technical Flow:**
```
Instructor clicks "Generate Assessment"
    ↓
Edge Function: generate-assessment-questions
    ↓
AI creates: question_text, options, correct_answer, explanation
    ↓
INSERT INTO assessment_questions
    ↓
Instructor reviews/edits
    ↓
Assessment available to students
```

---

#### Step 5: Student Monitoring

**Route:** `/instructor/courses/:courseId/students`

**User Views:**
- Enrolled student list
- Individual progress
- Assessment results
- Learning objective completion rates

---

## Admin Journey

### Overview

Admins use SyllabusStack to:
1. Manage organization users
2. Monitor course creation and usage
3. View learning outcomes reports
4. Customize branding
5. Manage billing

### Journey Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ADMIN JOURNEY                                │
└──────────────────────────────────────────────────────────────────────┘

[Auth (admin)] ──→ [Admin Dashboard]
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ↓                ↓                ↓
   [User Mgmt]      [Course Mgmt]    [Reports]
         │                │                │
         ↓                ↓                ↓
   - View users      - View courses   - Outcomes
   - Manage roles    - Usage stats    - Analytics
   - Invite users    - AI costs       - Trends
```

### Admin Pages

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard overview |
| `/admin/users` | User management |
| `/admin/courses` | Course management |
| `/admin/outcomes` | Outcomes reports |
| `/admin/branding` | Customize look & feel |

---

## Common Flows

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   /auth     │
                    │  (Login)    │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ↓                         ↓
        [Email/Pass]              [Social Auth]
              │                    (if enabled)
              ↓
     ┌────────────────┐
     │ Supabase Auth  │
     │ (JWT created)  │
     └───────┬────────┘
             │
             ↓
     ┌────────────────┐
     │ AuthContext    │
     │ updated        │
     └───────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
    ↓                 ↓
[Onboarded?]     [Not onboarded]
    │                 │
    ↓                 ↓
/dashboard       /onboarding
```

### Content Discovery Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTENT DISCOVERY FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

User requests content for topic
              │
              ↓
┌─────────────────────────┐
│  search-youtube-manual  │
│  (Edge Function)        │
└───────────┬─────────────┘
            │
            ↓
      [YouTube API]
            │
    ┌───────┴───────┐
    │               │
 Success         Quota exceeded
    │               │
    ↓               ↓
 Return        Try Invidious
 videos             │
                    ↓
             ┌──────┴──────┐
             │             │
          Success       Failed
             │             │
             ↓             ↓
          Return      Try Piped
          videos          │
                          ↓
                   ┌──────┴──────┐
                   │             │
                Success       Failed
                   │             │
                   ↓             ↓
                Return    Khan Academy
                videos    (fallback)
```

### Gap Analysis Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      GAP ANALYSIS FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

User selects dream job
          │
          ↓
┌─────────────────────────┐
│   gap-analysis          │
│   (Edge Function)       │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│ Fetch user capabilities │
│ FROM capabilities       │
│ WHERE user_id = ?       │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│ Fetch job requirements  │
│ FROM job_requirements   │
│ WHERE dream_job_id = ?  │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│ AI Analysis (Gemini)    │
│ Compare capabilities    │
│ vs requirements         │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│ Output:                 │
│ - strong_overlaps[]     │
│ - critical_gaps[]       │
│ - partial_overlaps[]    │
│ - honest_assessment     │
│ - readiness_level (1-5) │
└───────────┬─────────────┘
            │
            ↓
INSERT INTO gap_analyses
            │
            ↓
Display to user
```

---

## Page-to-Component Mapping

### Student Pages

| Page | Key Components |
|------|----------------|
| `Dashboard.tsx` | CapabilitySnapshot, DreamJobCards, ProgressWidget |
| `Learn.tsx` | CourseList, AddCourseForm, CourseSearch |
| `CareerPath.tsx` | DreamJobList, GapAnalysisDisplay, RecommendationsList |
| `StudentCourseDetail.tsx` | CourseInfo, CapabilityList, ContentList |
| `LearningObjective.tsx` | ObjectiveDetail, ContentSection, AssessmentLink |
| `Assessment.tsx` | QuestionCard, AnswerOptions, ResultsDisplay |

### Instructor Pages

| Page | Key Components |
|------|----------------|
| `InstructorCourses.tsx` | CourseTable, CreateCourseButton |
| `InstructorCourseDetail.tsx` | CourseEditor, ModuleList, ContentManager |
| `QuickCourseSetup.tsx` | CourseForm, CurationModeSelector |

### Admin Pages

| Page | Key Components |
|------|----------------|
| `AdminDashboard.tsx` | StatsOverview, QuickActions |
| `UserManagement.tsx` | UserTable, RoleEditor, InviteForm |
| `CourseManagement.tsx` | CourseTable, UsageStats |
| `OutcomesReport.tsx` | OutcomesChart, MetricsTable |

---

## State Transitions

### Course States

```
[draft] → [analyzing] → [active] → [completed]
              │
              ↓
         [error]
```

### Recommendation States

```
[not_started] → [in_progress] → [completed]
                      │
                      ↓
                  [skipped]
```

### Assessment States

```
[not_started] → [in_progress] → [completed]
                                    │
                            ┌───────┴───────┐
                            │               │
                         [passed]       [failed]
                                           │
                                           ↓
                                    [retry available]
```
