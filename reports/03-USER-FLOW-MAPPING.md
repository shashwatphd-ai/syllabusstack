# SyllabusStack — User Flow Mapping Report

> Generated from codebase analysis on 2026-02-16. Based solely on reading the actual source code, route definitions, page components, hooks, and auth guards.

---

## 1. User Roles & Access Matrix

### 1.1 Role Definitions (from `user_roles` table and `useUserRoles` hook)

| Role | Defined By | Auto-Includes |
|------|-----------|----------------|
| **Student** | Default on signup (no explicit role row needed) | — |
| **Instructor** | Row in `user_roles` with role='instructor' | Student features |
| **Admin** | Row in `user_roles` with role='admin' | Student + Instructor features |

### 1.2 Route Access Matrix

| Route | Guest | Student | Instructor | Admin |
|-------|-------|---------|------------|-------|
| `/` (Landing) | Yes | Yes | Yes | Yes |
| `/auth` | Yes (GuestGuard) | Redirect | Redirect | Redirect |
| `/employers` | Yes | Yes | Yes | Yes |
| `/universities` | Yes | Yes | Yes | Yes |
| `/how-it-works` | Yes | Yes | Yes | Yes |
| `/help` | Yes | Yes | Yes | Yes |
| `/legal` | Yes | Yes | Yes | Yes |
| `/scanner` | Yes | Yes | Yes | Yes |
| `/verify/:shareToken` | Yes | Yes | Yes | Yes |
| `/employer/api-docs` | Yes | Yes | Yes | Yes |
| `/dashboard` | No | Yes | Yes | Yes |
| `/learn` | No | Yes | Yes | Yes |
| `/career` | No | Yes | Yes | Yes |
| `/teach` | No | Yes* | Yes | Yes |
| `/become-instructor` | No | Yes | Yes | Yes |
| `/progress` | No | Yes | Yes | Yes |
| `/profile` | No | Yes | Yes | Yes |
| `/settings` | No | Yes | Yes | Yes |
| `/billing` | No | Yes | Yes | Yes |
| `/usage` | No | Yes | Yes | Yes |
| `/learn/course/:id` | No | Yes | Yes | Yes |
| `/learn/objective/:loId` | No | Yes | Yes | Yes |
| `/learn/objective/:loId/assess` | No | Yes | Yes | Yes |
| `/instructor/courses` | No | Yes** | Yes | Yes |
| `/instructor/courses/:id` | No | Yes** | Yes | Yes |
| `/instructor/verification` | No | Yes** | Yes | Yes |
| `/instructor/quick-setup` | No | Yes** | Yes | Yes |
| `/admin` | No | No | No | Yes (AdminGuard) |
| `/admin/users` | No | No | No | Yes |
| `/admin/courses` | No | No | No | Yes |
| `/admin/roles` | No | No | No | Yes |
| `/employer` | No | Yes | Yes | Yes |

\* Non-instructors see marketing page; instructors see dashboard
\** AuthGuard only — instructor role checked inside component, not at route level

---

## 2. Complete User Journeys

### 2.1 New Student Journey

```
LANDING PAGE (/)
│
├─ User clicks "Get Started" / "Sign Up"
│
▼
AUTH PAGE (/auth) [GuestGuard — redirects if logged in]
│
├─ SignupForm: email, password, full_name
├─ Supabase auth.signUp() → confirmation email
├─ Email redirect back to /
│
▼
AUTH STATE CHANGE → AuthProvider detects session
│
├─ fetchProfile() → profiles_safe view
├─ Check: profile.onboarding_completed?
│
├─ If NO → Redirect to ONBOARDING
▼
ONBOARDING (/onboarding) [AuthGuard]
│
├─ OnboardingWizard Steps:
│   1. Welcome / profile basics
│   2. CourseUploader — add first courses from transcript
│      ├─ Manual entry: title, code, semester, credits
│      └─ Syllabus upload (PDF/DOCX) → parse-syllabus-document → capabilities
│   3. Dream job selection
│      ├─ Enter job title, company type, location
│      └─ Background: analyze-dream-job + gap-analysis + generate-recommendations
│
├─ useCompleteOnboarding() → sets onboarding_completed = true
│
▼
DASHBOARD (/dashboard) [AuthGuard]
│
├─ WelcomeBackBanner (returning users)
├─ NextActionBanner (smart contextual prompt):
│   ├─ "Add your first course" (if 0 courses)
│   ├─ "Add a dream job" (if 0 jobs)
│   ├─ "View your gap analysis" (if has gaps)
│   └─ "Complete recommendation: X" (if pending recs)
├─ DashboardOverview: stats cards
├─ DreamJobCards: jobs with match scores, gap counts
├─ ProgressWidget: recommendation status (pending/in_progress/completed/skipped)
└─ CapabilitySnapshot: top 10 capabilities with proficiency bars
```

### 2.2 Learning Flow

```
LEARN PAGE (/learn) [AuthGuard]
│
├─ Tab: "Active Courses" ──────────────────────────────────
│   │
│   ├─ EnrollmentDialog: enter instructor access code
│   │   └─ enroll-in-course edge function
│   │
│   └─ Click enrolled course card
│       │
│       ▼
│   STUDENT COURSE DETAIL (/learn/course/:id)
│   │
│   ├─ Course header: title, code, instructor
│   ├─ Modules list (sequence ordered)
│   │   └─ Learning Objectives per module
│   │       ├─ Verification state badge
│   │       ├─ Content progress bar
│   │       └─ Click to enter LO
│   │
│   ▼
│   LEARNING OBJECTIVE (/learn/objective/:loId)
│   │
│   ├─ State: unstarted → shows "Start Learning" button
│   │
│   ├─ VerifiedVideoPlayer: YouTube embed
│   │   ├─ MicroCheckOverlay: question at trigger_time_seconds
│   │   │   ├─ Correct → continue playing
│   │   │   └─ Wrong → auto-rewind to rewind_target_seconds
│   │   ├─ ContentRating: rate content relevance
│   │   └─ track-consumption: records watch progress
│   │
│   ├─ State: in_progress → content being consumed
│   │   └─ All content watched + micro-checks passed → verified
│   │
│   ├─ State: verified / assessment_unlocked → "Take Assessment" button
│   │
│   ▼
│   ASSESSMENT (/learn/objective/:loId/assess)
│   │
│   ├─ start-assessment: creates session, loads questions
│   ├─ QuestionCard: one question at a time
│   │   ├─ Multiple choice / open-ended
│   │   ├─ Timer (time_limit_seconds per question)
│   │   └─ Tracks response time (timing anomaly detection)
│   ├─ submit-assessment-answer: server-side grading
│   │   ├─ is_correct, evaluation_method
│   │   └─ timing_flags (suspicious speed detection)
│   ├─ complete-assessment:
│   │   ├─ score >= 70% (configurable) → state = passed
│   │   └─ score < threshold → state = remediation_required
│   └─ AssessmentResults: PerformanceSummary display
│       ├─ Score, pass/fail, time stats
│       ├─ Correct/incorrect breakdown
│       └─ "Retry" button if failed
│
├─ Tab: "Certificates" ───────────────────────────────────
│   │
│   └─ MyCertificatesList
│       ├─ completion_badge: basic completion
│       ├─ verified: identity-verified certificate
│       └─ assessed: with mastery score + skill breakdown
│       │
│       └─ Click certificate → /certificate/:id
│           ├─ Certificate view with details
│           └─ Share via /verify/:shareToken (public)
│
├─ Tab: "My Transcript" ──────────────────────────────────
│   │
│   ├─ AddCourseForm: manual course entry
│   │   ├─ Title, code, semester, credits
│   │   ├─ Optional: upload syllabus (PDF/DOCX/TXT)
│   │   │   └─ parse-syllabus-document → extract capabilities
│   │   └─ Creates course + capabilities in DB
│   │
│   ├─ Course cards with:
│   │   ├─ Status badges: completed/in_progress/planned
│   │   ├─ Analysis status: analyzed/pending/failed/analyzing
│   │   ├─ Skill count extracted
│   │   └─ Actions menu:
│   │       ├─ View Details → /courses/:id
│   │       ├─ Edit Course (title, code, semester, credits, status, grade)
│   │       ├─ Mark Completed / In Progress / Planned
│   │       ├─ Re-analyze (upload new syllabus)
│   │       └─ Delete Course
│   │
│   ├─ Bulk operations (selection mode):
│   │   ├─ Select all / individual checkboxes
│   │   ├─ Bulk mark completed / in_progress
│   │   ├─ Export selected as CSV
│   │   └─ Bulk delete
│   │
│   └─ Search, filter (all/analyzed/pending), sort (newest/oldest/name/skills)
│
└─ Tab: "Skill Profile" ──────────────────────────────────
    │
    ├─ Verified Skills: assessment-backed, green badges
    │   └─ Proficiency bar (beginner/intermediate/advanced/expert)
    ├─ Self-Reported Skills: from syllabus analysis, amber badges
    ├─ Search skills by name or source
    └─ Stats: X verified, Y self-reported
```

### 2.3 Career Planning Flow

```
CAREER PATH PAGE (/career) [AuthGuard]
│
├─ Dream Job Selector (dropdown): switch between multiple target jobs
│   └─ Match Score badge: X% Match
│
├─ Stats Cards (when job selected):
│   ├─ Skills Matched (overlaps count)
│   ├─ Gaps (critical + priority count)
│   ├─ To Do (pending recommendations)
│   ├─ Done (completed recommendations)
│   └─ Enrolled (active course enrollments)
│
├─ Tab: "Dream Jobs" ─────────────────────────────────────
│   │
│   ├─ Action buttons:
│   │   ├─ Take Skills Assessment (if no profile) ─────────────┐
│   │   ├─ View Career Matches (if has Holland code) ──────────┤
│   │   ├─ Quick Discover (AI job suggestions) ────────────────┤
│   │   └─ Add Dream Job (manual entry) ───────────────────────┤
│   │                                                           │
│   │   ┌─── Skills Assessment Flow ───────────────────────────┘
│   │   │
│   │   ├─ SkillsAssessmentWizard
│   │   │   ├─ start-skills-assessment: session created
│   │   │   ├─ Questions: Likert, slider, forced choice
│   │   │   │   Frameworks: Holland RIASEC, O*NET skills, work values
│   │   │   ├─ Track response times per question
│   │   │   ├─ Batch fetching (reduces round-trips)
│   │   │   └─ complete-skills-assessment:
│   │   │       → SkillProfile with holland_code, scores, technical_skills, work_values
│   │   │
│   │   ├─ On complete → auto-show Career Matches
│   │   │
│   │   ┌─── Career Matches ───────────────────────────────────
│   │   │
│   │   ├─ CareerMatchesGrid
│   │   │   ├─ match-careers: O*NET matching (Iachan M Index)
│   │   │   ├─ Cards: occupation_title, match_score, skill/interest/values scores
│   │   │   ├─ Filters: min score, education, salary, bright outlook
│   │   │   ├─ MatchScoreBreakdown: detailed score explanation
│   │   │   └─ "Add to Dream Jobs" → creates dream_job from match
│   │   │
│   │   ┌─── Quick Discover ───────────────────────────────────
│   │   │
│   │   ├─ DreamJobDiscovery
│   │   │   └─ discover-dream-jobs: AI suggests jobs based on profile
│   │   │
│   │   ┌─── Manual Add ──────────────────────────────────────
│   │   │
│   │   ├─ AddDreamJobForm: job title, company type, location
│   │   │
│   │   └─ On any job added → createDreamJobWithWorkflow():
│   │       ├─ Insert dream_jobs record (immediate, UI updates)
│   │       └─ Background async chain:
│   │           ├─ analyze-dream-job → requirements, differentiators, realistic_bar
│   │           ├─ gap-analysis → match_score, overlaps, gaps
│   │           └─ generate-recommendations → action items
│   │
│   └─ Dream Job Cards grid:
│       ├─ Title, company type, match score, progress bar
│       ├─ Primary badge (for primary job)
│       ├─ Click card → select job + switch to Gaps tab
│       └─ Menu: Set as Primary, Delete
│
├─ Tab: "Gap Analysis" ───────────────────────────────────
│   │
│   ├─ Requires: selected dream job with analysis data
│   │
│   ├─ HonestAssessment component:
│   │   ├─ Match score (0-100%) with visual indicator
│   │   ├─ Readiness level: ready_to_apply / 3_months / 6_months / 1_year / needs_significant
│   │   ├─ Honest assessment text (qualitative)
│   │   ├─ Interview readiness assessment
│   │   └─ Job success prediction
│   │
│   ├─ Two-column layout:
│   │   ├─ Left: "Skills You Have" (OverlapsList)
│   │   │   ├─ Strong overlaps: student_capability ↔ job_requirement (90% match)
│   │   │   └─ Partial overlaps: foundation + what's missing (50% match)
│   │   │
│   │   └─ Right: "Gaps to Close" (GapsList)
│   │       ├─ Critical gaps: job_requirement, student_status, impact
│   │       └─ Priority gaps: gap text, priority number, reason
│   │
│   └─ "Refresh Analysis" button → re-runs gap analysis
│
├─ Tab: "Action Plan" ────────────────────────────────────
│   │
│   ├─ Action buttons:
│   │   ├─ "Find Real Courses" → Firecrawl web scraping for all gaps
│   │   └─ "Generate Actions" → AI recommendation generation
│   │
│   ├─ Course Filters (when course recs exist):
│   │   ├─ "Free First" toggle (sorts free courses to top)
│   │   ├─ Price filter: All / Free / Paid / Unknown
│   │   └─ Stats: X free, Y paid, Z unknown
│   │
│   ├─ CurrentlyLearningPanel:
│   │   ├─ Shows enrolled courses
│   │   └─ Link courses to specific recommendations
│   │
│   └─ RecommendationsList:
│       ├─ Cards per recommendation:
│       │   ├─ Title, type badge (project/course/skill/action/experience)
│       │   ├─ Steps with time estimates
│       │   ├─ Evidence created description
│       │   ├─ How to demonstrate
│       │   ├─ Gap addressed
│       │   ├─ Price (for courses)
│       │   ├─ External link (for discovered courses)
│       │   └─ Status: pending → in_progress → completed / skipped
│       └─ Status update buttons per recommendation
│
└─ Tab: "Avoid" ──────────────────────────────────────────
    │
    └─ AntiRecommendations:
        ├─ "Don't do X" with reason why
        └─ 3-5 items per dream job
```

### 2.4 Instructor Journey

```
TEACH PAGE (/teach) [AuthGuard]
│
├─ IF NOT instructor role:
│   │
│   ├─ Marketing page: "Share Your Knowledge"
│   │   ├─ Benefits: AI-Powered Creation, Track Progress, Issue Certificates
│   │   ├─ How it works: Upload Syllabus → AI Analysis → Find Content → Publish
│   │   ├─ FAQ: pricing ($1/course free tier, unlimited Pro), .edu verification, content
│   │   └─ CTA → "Become an Instructor" → /become-instructor
│   │
│   ▼
│   BECOME INSTRUCTOR (/become-instructor) [AuthGuard]
│   │
│   └─ Application / verification request
│       ├─ .edu email → auto-verified
│       └─ Other email → manual review queue
│
├─ IF instructor role:
│   │
│   ├─ Instructor Dashboard:
│   │   ├─ Verification status (verified badge or "Complete Verification" prompt)
│   │   ├─ Stats: Total Courses, Published, Drafts
│   │   ├─ Quick Actions: "My Courses", "Create New Course"
│   │   └─ Recent Courses list (top 3)
│   │
│   ▼
│   INSTRUCTOR COURSES (/instructor/courses) [AuthGuard]
│   │
│   ├─ Course list with publish status badges
│   ├─ "Create Course" button
│   │
│   ├─── Quick Setup Flow (/instructor/quick-setup) ──────
│   │   │
│   │   ├─ Upload syllabus (PDF/DOCX)
│   │   ├─ AI extracts: course structure, modules, learning objectives
│   │   ├─ Review and edit extracted content
│   │   ├─ Domain configuration
│   │   ├─ Set curation mode: full_control / guided_auto / hands_off
│   │   ├─ Auto-generated 6-char access code
│   │   └─ Save as draft (is_published: false)
│   │
│   └─── Course Detail (/instructor/courses/:id) ─────────
│       │
│       ├─ Course header: title, code, access code, publish toggle
│       ├─ Modules (reorderable):
│       │   ├─ Add/edit/delete modules
│       │   └─ Learning Objectives per module:
│       │       ├─ Text, Bloom level, action verb, duration
│       │       ├─ Content matches (YouTube videos)
│       │       │   ├─ Auto-discovered with match scores
│       │       │   ├─ ContentCurationPanel: approve/reject
│       │       │   └─ Manual content addition
│       │       ├─ Lecture Slides:
│       │       │   ├─ "Generate Slides" → generate-lecture-slides-v3
│       │       │   ├─ Research-grounded with citations
│       │       │   ├─ Quality score display
│       │       │   └─ LectureSlideViewer for preview
│       │       ├─ Assessment Questions:
│       │       │   └─ Generate / manually add questions
│       │       └─ Micro-Checks:
│       │           └─ In-video knowledge checks with timestamps
│       │
│       ├─ Enrolled Students list:
│       │   ├─ Student name, progress %, enrolled date
│       │   └─ Send message to student
│       │
│       ├─ Actions:
│       │   ├─ Duplicate Course (batch copies everything)
│       │   ├─ Analytics → /instructor/courses/:id/analytics
│       │   │   └─ EngagementChart, completion rates
│       │   └─ Gradebook → /instructor/courses/:id/gradebook
│       │       └─ GradebookTable: per-student per-LO grades
│       │
│       └─ Publish: makes course available to students via access code
│
│   INSTRUCTOR VERIFICATION (/instructor/verification)
│   │
│   └─ InstructorVerificationFlow:
│       ├─ Email verification step
│       ├─ Credential submission
│       ├─ Status tracking
│       └─ Trust score earned on approval
```

### 2.5 Employer Journey

```
EMPLOYERS PAGE (/employers) [Public]
│
├─ Value proposition for employers
├─ API integration benefits
└─ CTA → Sign up
    │
    ▼
EMPLOYER SIGNUP (/employer/signup) [AuthGuard]
│
├─ Company information
├─ API access request
│
▼
EMPLOYER DASHBOARD (/employer) [AuthGuard]
│
├─ Skills Verification:
│   ├─ Individual candidate lookup
│   └─ Batch verification CSV upload
│
├─ Certificate Verification:
│   ├─ Enter certificate number
│   └─ View certificate details + validity
│
├─ API Documentation (/employer/api-docs) [Public]:
│   ├─ REST API endpoints
│   ├─ Authentication methods
│   └─ Response formats
│
└─ Webhook Settings (/employer/webhooks) [AuthGuard]:
    ├─ Configure webhook URL
    ├─ Select events (certificate.issued, etc.)
    └─ Test webhook delivery

PUBLIC CERTIFICATE VERIFICATION (/verify/:shareToken) [Public]
│
├─ No login required
├─ Displays: certificate type, course, instructor, mastery score
├─ Verification: identity_verified, instructor_verified flags
└─ Skill breakdown (for assessed certificates)
```

### 2.6 Admin Journey

```
ADMIN DASHBOARD (/admin) [AdminGuard]
│
├─ System overview metrics
├─ Quick links to all admin sections
│
├─── User Management (/admin/users)
│    ├─ User list with search/filter
│    ├─ View user details
│    ├─ Assign/remove roles (student, instructor, admin)
│    └─ Disable/enable accounts
│
├─── Role Management (/admin/roles)
│    └─ Define and manage role permissions
│
├─── Course Management (/admin/courses)
│    ├─ All courses across platform
│    ├─ Moderate content
│    └─ Feature/unfeature courses
│
├─── Content Moderation (/admin/content-moderation)
│    ├─ Flagged content review queue
│    └─ Approve/reject/escalate
│
├─── Instructor Review Queue (/admin/instructor-review)
│    ├─ Pending instructor applications
│    ├─ Verification document review
│    └─ Approve/deny with notes
│
├─── Outcomes Report (/admin/outcomes)
│    └─ Platform-wide learning outcomes data
│
├─── Branding Settings (/admin/branding)
│    └─ Platform appearance customization
│
├─── System Health (/admin/system-health)
│    └─ System monitoring and performance
│
└─── Organization Dashboard (/organization) [AuthGuard]
     ├─ Multi-tenant organization management
     ├─ SSO configuration (configure-organization-sso)
     ├─ User invitations (invite-users)
     └─ Member management (remove-org-user)
```

---

## 3. Automated Background Workflows

### 3.1 Dream Job Creation Workflow

```
User submits: "Software Engineer at Google"
       │
       ▼ (synchronous — user waits)
Insert dream_jobs record
Toast: "Dream job added"
       │
       ▼ (async — user does NOT wait)
┌─────────────────────────────────────┐
│ BACKGROUND WORKFLOW                  │
│                                      │
│ Step 1: analyze-dream-job            │
│   ├─ Check job_requirements_cache    │
│   ├─ If miss: AI extracts:          │
│   │   ├─ requirements (categorized)  │
│   │   ├─ day_one_capabilities        │
│   │   ├─ differentiators             │
│   │   ├─ common_misconceptions       │
│   │   └─ realistic_bar              │
│   └─ Update dream_jobs + cache       │
│                                      │
│ Step 2: Check freshness              │
│   └─ Has analysis < 24 hours? Skip   │
│                                      │
│ Step 3: gap-analysis                 │
│   ├─ Gather user skills + decay      │
│   ├─ Match against requirements      │
│   ├─ AI analysis + keyword scoring   │
│   └─ Store gap_analyses              │
│                                      │
│ Step 4: generate-recommendations     │
│   ├─ Use gap results                 │
│   ├─ AI creates 7-10 action items    │
│   ├─ Soft-delete old AI recs         │
│   └─ Insert new recs + anti-recs     │
└─────────────────────────────────────┘

Frontend: TanStack Query invalidation surfaces results when user navigates
```

### 3.2 Course Addition Workflow

```
User adds course "CS 301" with syllabus
       │
       ▼ (synchronous)
Insert courses record
If syllabus: parse-syllabus-document → extract capabilities
Insert capabilities records
Toast: "Course added"
       │
       ▼ (async — user does NOT wait)
┌─────────────────────────────────────┐
│ GAP REFRESH WORKFLOW                 │
│                                      │
│ Fetch all user's dream_jobs          │
│ For each job (in parallel):          │
│   ├─ Check: gap analysis < 24h old? │
│   │   ├─ Yes → skip (fresh)         │
│   │   └─ No → re-run gap-analysis   │
│   └─ Promise.allSettled()            │
│       (handles partial failures)     │
└─────────────────────────────────────┘
```

### 3.3 Assessment Completion Workflow

```
Student answers final question
       │
       ▼
complete-assessment edge function:
  ├─ Calculate: correct / total * 100
  ├─ If score >= passing_threshold (70%):
  │   ├─ Update assessment_sessions.passed = true
  │   ├─ Update verification state → 'passed'
  │   ├─ Issue verified_skills for the LO
  │   └─ Check: all LOs passed? → course completion
  │       └─ If all complete → certificates available
  └─ If score < threshold:
      ├─ Update assessment_sessions.passed = false
      └─ Update verification state → 'remediation_required'
```

---

## 4. Data Trigger Chains

### 4.1 What happens when a student adds a course

```
1. courses.INSERT
2. capabilities.INSERT (if syllabus analyzed)
3. ASYNC: For each dream_job:
   a. gap_analyses.UPSERT (re-analyzed with new capabilities)
   b. dream_jobs.UPDATE (match_score refreshed)
   c. recommendations may be regenerated
4. TanStack Query invalidation:
   - ['courses'], ['capabilities'], ['analysis'], ['dashboard']
```

### 4.2 What happens when a student adds a dream job

```
1. dream_jobs.INSERT
2. ASYNC: analyze-dream-job
   a. job_requirements.INSERT (per requirement)
   b. job_requirements_cache.UPSERT
   c. dream_jobs.UPDATE (requirements_keywords, etc.)
3. ASYNC: gap-analysis
   a. gap_analyses.INSERT
   b. dream_jobs.UPDATE (match_score)
4. ASYNC: generate-recommendations
   a. recommendations.SOFT_DELETE (old AI recs)
   b. recommendations.INSERT (new recs)
   c. anti_recommendations.INSERT
5. TanStack Query invalidation:
   - ['dream_jobs'], ['analysis'], ['recommendations'], ['dashboard']
```

### 4.3 What happens when a student enrolls in a course

```
1. course_enrollments.INSERT (via enroll-in-course edge function)
2. Student can now see course in "Active Courses" tab
3. Learning objectives become accessible
4. Progress tracking begins (overall_progress starts at 0)
5. TanStack Query invalidation:
   - ['student-enrollments'], ['instructor_courses']
```

### 4.4 What happens when an instructor publishes a course

```
1. instructor_courses.UPDATE (is_published = true)
2. Course becomes enrollable via access code
3. Students with access code can enroll
4. Content, LOs, and assessments become student-accessible
```

---

## 5. Page-Level Component Composition

### 5.1 Dashboard Page (`/dashboard`)

```
AppShell
└─ <div className="space-y-6">
    ├─ WelcomeBackBanner
    ├─ NextActionBanner (contextual CTA)
    ├─ DashboardOverview (7 stat cards)
    └─ Grid (3 columns):
        ├─ DreamJobCards (col-span-5)
        ├─ ProgressWidget (col-span-3)
        └─ CapabilitySnapshot (col-span-4)
```

### 5.2 Learn Page (`/learn`)

```
AppShell
└─ <div className="space-y-6">
    ├─ Stats Cards Grid (4 cards): Active, Completed, Transcript, Skills
    └─ Tabs:
        ├─ "Active Courses": EnrollmentDialog + StudentCourseCards
        ├─ "Certificates": MyCertificatesList
        ├─ "My Transcript": AddCourseForm + CourseGrid + BulkToolbar
        └─ "Skill Profile": VerifiedSkills + SelfReportedSkills
```

### 5.3 Career Path Page (`/career`)

```
AppShell
└─ <div className="space-y-6">
    ├─ Header: subtitle + DreamJobSelector + MatchScoreBadge
    ├─ Stats Cards Grid (5 cards): Matched, Gaps, To Do, Done, Enrolled
    └─ Tabs:
        ├─ "Dream Jobs": Assessment/Matches/Discover/AddForm/JobCards
        ├─ "Gap Analysis": HonestAssessment + OverlapsList + GapsList
        ├─ "Action Plan": CourseFilters + CurrentlyLearning + RecommendationsList
        └─ "Avoid": AntiRecommendations
```

### 5.4 Teach Page (`/teach`)

```
AppShell
└─ PageContainer
    ├─ IF instructor:
    │   ├─ Header + VerificationStatus
    │   ├─ Stats Cards (Total, Published, Drafts)
    │   ├─ Quick Actions (My Courses, Create New Course)
    │   └─ Recent Courses list
    │
    └─ IF not instructor:
        ├─ Hero: "Share Your Knowledge"
        ├─ Benefits Grid (3 cards)
        ├─ How It Works (4 steps)
        ├─ CTA: "Become an Instructor"
        └─ FAQ Grid (4 questions)
```

---

## 6. Navigation State & URL Patterns

### 6.1 Tab State via URL Params

| Page | Parameter | Values | Default |
|------|-----------|--------|---------|
| `/learn` | `?tab=` | active, certificates, transcript, skills | active |
| `/career` | `?tab=` | jobs, gaps, actions, avoid | jobs |

### 6.2 Legacy URL Redirects

| Old URL | New URL | Purpose |
|---------|---------|---------|
| `/courses` | `/learn?tab=transcript` | Unified learn page |
| `/dream-jobs` | `/career?tab=jobs` | Unified career page |
| `/analysis` | `/career?tab=gaps` | Unified career page |
| `/recommendations` | `/career?tab=actions` | Unified career page |
| `/learn/courses` | `/learn?tab=active` | Unified learn page |

### 6.3 Deep Link Patterns

| Pattern | Purpose |
|---------|---------|
| `/courses/:id` | Course detail (legacy, still works) |
| `/dream-jobs/:jobId` | Dream job detail (legacy, still works) |
| `/learn/course/:id` | Student course view |
| `/learn/objective/:loId` | Learning objective view |
| `/learn/objective/:loId/assess` | Assessment for LO |
| `/learn/slides/:slideId` | Lecture slide viewer |
| `/instructor/courses/:id` | Instructor course detail |
| `/instructor/courses/:courseId/analytics` | Course analytics |
| `/instructor/courses/:courseId/gradebook` | Course gradebook |
| `/certificate/:id` | Certificate view |
| `/verify/:shareToken` | Public certificate verification |
| `/help/article/:articleId` | Help center article |

---

## 7. Error & Edge Case Handling

### 7.1 Global Error Boundary
- `ErrorBoundary` wraps all routes
- Catches React rendering errors
- Displays fallback UI instead of blank page

### 7.2 Component-Level Error Boundaries
- `RecommendationsErrorBoundary`: wraps RecommendationsList specifically
- Isolates recommendation rendering failures from the rest of the career page

### 7.3 Loading States
- Every data-fetching component has skeleton/loading states
- `Skeleton` components match layout of loaded content
- Stats cards show 0 during loading (not undefined)

### 7.4 Empty States
- Each tab has a specific empty state with:
  - Relevant icon
  - Descriptive message
  - Action button (e.g., "Add Course", "Add Dream Job")

### 7.5 Failed Analysis Recovery
- Courses with `analysis_status: 'failed'` show destructive badge
- "Retry Analysis" available in dropdown menu
- New syllabus upload replaces old capabilities

### 7.6 Assessment Retry Flow
- Failed assessment → `remediation_required` state
- Student must review content again (retry_content → in_progress)
- Can re-attempt assessment after content review
- Attempt number tracked for analytics
