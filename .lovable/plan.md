

# EduThree Action Map by User Role → SyllabusStack Gap Analysis

## Complete User Journey Mapping

### ROLE 1: FACULTY / INSTRUCTOR

```text
EduThree Flow:
  Landing → Auth → Upload → ReviewSyllabus → Configure → Projects → ProjectDetail
                     ↓
              InstructorDashboard (SyllabusManagement)
```

| # | EduThree Action | EduThree Page/Component | SyllabusStack Equivalent | Status |
|---|----------------|------------------------|--------------------------|--------|
| F1 | Sign up / Sign in | `/auth` | `/auth` | DONE |
| F2 | View dashboard with all syllabi | `/dashboard` → `InstructorDashboard` | `/teach` (TeachPage) | DONE |
| F3 | Upload syllabus PDF + auto-detect location from email | `/upload` (Upload.tsx) | `/instructor/quick-setup` (file upload to process-syllabus) | PARTIAL — no location auto-detection from email |
| F4 | Review parsed syllabus (title, outcomes, artifacts, schedule) | `/review-syllabus` (ReviewSyllabus.tsx + SyllabusReview component) | No equivalent — goes straight from upload to course detail | MISSING |
| F5 | Configure generation (industries, companies, num teams) + auto-generate option | `/configure` (Configure.tsx) | Capstone tab "Discover Companies" button — no configuration UI | MISSING |
| F6 | Monitor generation progress (polling, realtime status) | `/configure` polling UI + progress bar | Inline loading spinner only | PARTIAL |
| F7 | Browse all generated projects with quality grades (A+/A/B/C) | `/projects` (Projects.tsx) with pagination, course filter, quality borders | `CapstoneProjectsTab` — basic card list | PARTIAL |
| F8 | View project detail (14 tabs: Overview, Premium Insights, Discovery Quality, Value Analysis, Market Intelligence, Contact, Timeline, Logistics, Academic, LO Alignment, Feedback, Verification, Scoring, Algorithm) | `/projects/:id` (ProjectDetail.tsx) | No project detail page — only CompanyCard inline | MISSING |
| F9 | Rate/review a project (faculty feedback + tags) | ProjectFeedbackDialog in Projects.tsx | No feedback mechanism | MISSING |
| F10 | Download syllabus as PDF | `downloadCoursePdf()` on Projects page | No download | MISSING |
| F11 | Print project view | PrintableProjectView in ProjectDetail | No print | MISSING |
| F12 | Manage syllabus list (view courses, re-generate, delete) | SyllabusManagement component on InstructorDashboard | InstructorCourses page — manages courses but not capstone pipeline | PARTIAL |
| F13 | Propose partnership from project detail | ProposePartnershipDialog | No equivalent | MISSING |

### ROLE 2: STUDENT

| # | EduThree Action | EduThree Page/Component | SyllabusStack Equivalent | Status |
|---|----------------|------------------------|--------------------------|--------|
| S1 | View student dashboard (metrics: applications, approved, job matches, skills) | `/dashboard` → `StudentDashboard` | `/dashboard` — has student widgets but no capstone metrics | PARTIAL |
| S2 | Browse available projects | `/projects` (student view with "Apply Now" buttons) | No student-facing project browse | MISSING |
| S3 | Apply to a project | `handleApplyToProject()` in Projects.tsx → `project_applications` table | No application system | MISSING |
| S4 | View "My Opportunities" — job matches from Apollo | `/my-opportunities` (MyOpportunities.tsx) — `job_matches` table | No job matching | MISSING |
| S5 | View "My Competencies" — verified skills with employer ratings | `/my-competencies` (MyCompetencies.tsx) — `verified_competencies` table | No competency tracking | MISSING |
| S6 | Export portfolio as PDF | `portfolio-export` edge function | No portfolio export | MISSING |
| S7 | View recommended projects (AI-based) | RecommendedProjects component on StudentDashboard | No recommendations | MISSING |
| S8 | Realtime updates on application status changes | useStudentRealtime hook | No realtime for students | MISSING |

### ROLE 3: EMPLOYER

| # | EduThree Action | EduThree Page/Component | SyllabusStack Equivalent | Status |
|---|----------------|------------------------|--------------------------|--------|
| E1 | View employer dashboard with company profile | `/employer/dashboard` (EmployerDashboard.tsx) | `/employer` (EmployerDashboard) | DONE |
| E2 | View projects linked to their company | ProjectCard list in EmployerDashboard | Employer portal exists but limited | PARTIAL |
| E3 | See student applicants for their projects | ApplicationCard list in EmployerDashboard | No student applications | MISSING |
| E4 | Rate students (StudentRatingDialog) | Rate button → `StudentRatingDialog` | No student rating | MISSING |
| E5 | Submit interest / propose partnership | DemandBoard / EmployerCTAModal | Employer signup exists but no interest submission | PARTIAL |
| E6 | Realtime updates on new applications | useEmployerRealtime hook | No realtime | MISSING |

### ROLE 4: ADMIN

| # | EduThree Action | EduThree Page/Component | SyllabusStack Equivalent | Status |
|---|----------------|------------------------|--------------------------|--------|
| A1 | View all AI project shells with signal scores | AdminHub → "AI Project Shells" tab | `/admin` AdminDashboard — has course/user management but not project shells | PARTIAL |
| A2 | View employer interest submissions | AdminHub → "Employer Leads" tab | No employer lead management | MISSING |
| A3 | Match employer leads to AI project shells | `sync-project-match` edge function via modal | No matching system | MISSING |
| A4 | Approve pending faculty requests | AdminHub → "Pending Faculty" tab | `/admin/instructor-review` (InstructorReviewQueue) | DONE |
| A5 | View analytics (ProjectAnalytics component) | AdminHub → "Analytics" tab | `/admin` has basic metrics | PARTIAL |
| A6 | Role management | `/admin-hub/roles` (RoleManagement.tsx) | `/admin/roles` (RoleManagementPage) | DONE |
| A7 | View metrics dashboard | `/admin-hub/metrics` (AdminMetrics.tsx) | No dedicated metrics page | MISSING |
| A8 | Import universities | `/admin-hub/import-universities` | No equivalent | MISSING |
| A9 | Test dashboard | `/admin-hub/tests` | No equivalent | MISSING |

### CROSS-CUTTING FEATURES

| # | EduThree Feature | SyllabusStack Status |
|---|-----------------|---------------------|
| X1 | Realtime notifications (RealtimeNotificationListener + NotificationProvider) | No notification system for capstone events |
| X2 | Demand Board — public view of hiring signals | No demand board |
| X3 | Company Hiring Badge (CompanyHiringBadge) on project cards | No hiring badges |
| X4 | Live Demand Badge (LiveDemandBadge) — premium feature | No demand signals |
| X5 | Lazy-loaded routes with code splitting | Already implemented |
| X6 | Error boundaries per route | Already implemented |

---

## Implementation Plan (Prioritized)

### Phase 1: Core Faculty Pipeline UX (Highest Impact)

**Goal**: Give instructors the same Upload → Review → Configure → Generate → Browse → Detail flow.

1. **Create `/instructor/courses/:id/review` page** — Show parsed syllabus data (title, outcomes, schedule) with edit capability before generation, matching EduThree's ReviewSyllabus
2. **Create Configure modal/page for capstone generation** — Before discovery, let instructor set: target industries, target companies, number of projects, max distance. Wire into discover-companies
3. **Create Project Detail page** (`/instructor/courses/:courseId/project/:companyId`) — Tabbed view with: Overview, Contact, Market Intelligence, LO Alignment, Timeline, Scoring. Pull from company_profiles + capstone_projects
4. **Add generation progress UI** — Polling-based progress indicator during discover+generate pipeline (replace simple spinner)
5. **Add quality grading to company cards** — A+/A/B/C badges based on composite_signal_score thresholds

### Phase 2: Student Capstone Experience

6. **Create student project browse page** — Students see published capstone projects and can apply
7. **Add project application system** — `capstone_applications` table + apply button + status tracking
8. **Add student capstone dashboard widgets** — Applications count, approved projects, available projects

### Phase 3: Employer Engagement

9. **Add employer interest submission form** — Companies can propose project partnerships
10. **Add student applicant view for employers** — See who applied to their linked projects
11. **Add student rating system** — Employers rate students post-project

### Phase 4: Admin Capstone Management

12. **Add capstone project shells view to admin** — See all generated projects across courses with signal scores
13. **Add employer lead matching** — Match incoming employer interest to AI-generated project shells

### Phase 5: Polish

14. **Add project PDF download/print** — PrintableProjectView for capstone projects
15. **Add realtime notifications** — Pipeline completion, application status changes
16. **Add Company Hiring Badge** — Show active job posting count on company cards

---

## Technical Notes

- Phase 1 is the critical UX gap — faculty currently have no visibility into what happens between "Discover Companies" and seeing results
- The project detail page is the single biggest missing piece — EduThree has 14 tabs of intelligence per project; SyllabusStack shows a card
- Student and employer features (Phases 2-3) require new database tables: `capstone_applications`, `employer_interest_submissions`, `verified_competencies`
- All phases are additive — no breaking changes to existing instructor course management flow

