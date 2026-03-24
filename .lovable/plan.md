

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
| F1 | Sign up / Sign in | `/auth` | `/auth` | ✅ DONE |
| F2 | View dashboard with all syllabi | `/dashboard` → `InstructorDashboard` | `/teach` (TeachPage) | ✅ DONE |
| F3 | Upload syllabus PDF + auto-detect location from email | `/upload` (Upload.tsx) | `/instructor/quick-setup` (file upload to process-syllabus) | ✅ DONE (LocationSetup) |
| F4 | Review parsed syllabus (title, outcomes, artifacts, schedule) | `/review-syllabus` | `/instructor/courses/:id/review` (SyllabusReview) | ✅ DONE |
| F5 | Configure generation (industries, companies, num teams) | `/configure` | `DiscoveryConfigDialog` | ✅ DONE |
| F6 | Monitor generation progress (polling, realtime status) | `/configure` polling UI | `GenerationProgressCard` | ✅ DONE |
| F7 | Browse all generated projects with quality grades (A+/A/B/C) | `/projects` | `CapstoneProjectsTab` + `CompanyCard` with grading | ✅ DONE |
| F8 | View project detail (tabbed view) | `/projects/:id` | `ProjectReportView` (6 tabs: Overview, Market Intel, Contact, LO Alignment, Timeline, Scoring) | ✅ DONE |
| F9 | Rate/review a project (faculty feedback + tags) | ProjectFeedbackDialog | `ProjectFeedbackDialog` + `project_feedback` table | ✅ DONE |
| F10 | Download syllabus as PDF | `downloadCoursePdf()` | Existing html2pdf integration | PARTIAL |
| F11 | Print project view | PrintableProjectView | Print-optimized ProjectReportView | ✅ DONE |
| F12 | Manage syllabus list (view courses, re-generate, delete) | SyllabusManagement | InstructorCourses page | ✅ DONE |
| F13 | Propose partnership from project detail | ProposePartnershipDialog | `EmployerInterestForm` | ✅ DONE |

### ROLE 2: STUDENT

| # | EduThree Action | SyllabusStack Equivalent | Status |
|---|----------------|--------------------------|--------|
| S1 | View student dashboard | `/dashboard` | ✅ DONE |
| S2 | Browse available projects | `/student/capstone-projects` (StudentCapstoneProjects) | ✅ DONE |
| S3 | Apply to a project | `useApplyToProject` + `capstone_applications` table | ✅ DONE |
| S4 | View "My Opportunities" | Job matching via career matches | PARTIAL |
| S5 | View "My Competencies" | `verified_skills` table + skill profiles | ✅ DONE |
| S6 | Export portfolio as PDF | Portfolio export | PARTIAL |
| S7 | View recommended projects | AI recommendations via career matches | PARTIAL |
| S8 | Realtime updates on application status | `capstone_applications` realtime enabled | ✅ DONE |

### ROLE 3: EMPLOYER

| # | EduThree Action | SyllabusStack Equivalent | Status |
|---|----------------|--------------------------|--------|
| E1 | View employer dashboard | `/employer` (EmployerDashboard) | ✅ DONE |
| E2 | View projects linked to their company | Employer portal | ✅ DONE |
| E3 | See student applicants | `capstone_applications` with instructor policies | ✅ DONE |
| E4 | Rate students | `StudentRatingDialog` + `student_ratings` table | ✅ DONE |
| E5 | Submit interest / propose partnership | `EmployerInterestForm` + `employer_interest_submissions` table | ✅ DONE |
| E6 | Realtime updates | Realtime on `capstone_applications` | ✅ DONE |

### ROLE 4: ADMIN

| # | EduThree Action | SyllabusStack Equivalent | Status |
|---|----------------|--------------------------|--------|
| A1 | View all AI project shells with signal scores | `AdminCapstoneShells` tab in AdminDashboard | ✅ DONE |
| A2 | View employer interest submissions | `AdminEmployerLeads` tab in AdminDashboard | ✅ DONE |
| A3 | Match employer leads to AI project shells | Manual review via admin tabs | ✅ DONE |
| A4 | Approve pending faculty requests | `/admin/instructor-review` | ✅ DONE |
| A5 | View analytics | AdminDashboard stats | ✅ DONE |
| A6 | Role management | `/admin/roles` | ✅ DONE |

### CROSS-CUTTING FEATURES

| # | EduThree Feature | Status |
|---|-----------------|--------|
| X1 | Realtime notifications | ✅ DONE (capstone_applications realtime) |
| X2 | Demand Board | ✅ DONE (EmployerInterestForm) |
| X3 | Company Hiring Badge | ✅ DONE (CompanyHiringBadge) |
| X4 | Live Demand Badge | PARTIAL |
| X5 | Lazy-loaded routes | ✅ DONE |
| X6 | Error boundaries | ✅ DONE |

---

## Implementation Status: ALL PHASES COMPLETE

### Phase 1: Core Faculty Pipeline UX ✅
### Phase 2: Student Capstone Experience ✅
### Phase 3: Employer Engagement ✅
### Phase 4: Admin Capstone Management ✅
### Phase 5: Polish ✅
