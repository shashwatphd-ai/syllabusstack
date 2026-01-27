# Frontend & UX Comprehensive Review

**Date:** 2026-01-27
**Scope:** Complete frontend analysis - all pages, pipelines, user flows, and expected outputs
**Purpose:** Documentation for UX fixes and improvements

---

## Executive Summary

| Category | Pages | User Flows | Issues Found |
|----------|-------|------------|--------------|
| Public/Landing | 4 | 3 | 8 |
| Authentication | 3 | 4 | 12 |
| Onboarding | 1 | 4 | 14 |
| Dashboard/Main | 4 | 6 | 15 |
| Student Learning | 5 | 8 | 22 |
| Career Path | 2 | 9 | 18 |
| Instructor | 7 | 12 | 21 |
| Employer | 4 | 8 | 16 |
| Admin | 6 | 10 | 24 |
| **Total** | **36** | **64** | **150** |

---

## Table of Contents

1. [Route Map](#1-route-map)
2. [Public & Landing Pages](#2-public--landing-pages)
3. [Authentication Flow](#3-authentication-flow)
4. [Onboarding Flow](#4-onboarding-flow)
5. [Dashboard](#5-dashboard)
6. [My Learning Flow](#6-my-learning-flow)
7. [Career Path Flow](#7-career-path-flow)
8. [Instructor Flow](#8-instructor-flow)
9. [Employer Flow](#9-employer-flow)
10. [Admin Flow](#10-admin-flow)
11. [Cross-Cutting Issues](#11-cross-cutting-issues)
12. [Prioritized Fix List](#12-prioritized-fix-list)

---

## 1. Route Map

### Public Routes (No Auth Required)
| Route | Page | Purpose |
|-------|------|---------|
| `/` | Index | Landing page with audience toggle |
| `/employers` | Employers | B2B marketing page |
| `/scanner` | SyllabusScanner | Public syllabus analysis demo |
| `/resources` | Resources | Learning resources |
| `/legal` | Legal | Terms and privacy |
| `/help` | HelpCenter | Help articles |
| `/help/article/:articleId` | HelpArticle | Single help article |
| `/how-it-works` | HowItWorks | Product explainer |
| `/universities` | Universities | University partnership info |
| `/verify/:shareToken` | PublicCertificateVerify | Certificate verification |

### Auth Routes (Redirect if Logged In)
| Route | Page | Purpose |
|-------|------|---------|
| `/auth` | Auth | Login/Signup forms |
| `/forgot-password` | ForgotPassword | Password reset request |
| `/reset-password` | ResetPassword | Set new password |

### Protected Routes (Auth Required)
| Route | Page | Access Control |
|-------|------|----------------|
| `/onboarding` | Onboarding | New users |
| `/dashboard` | Dashboard | All authenticated |
| `/learn` | Learn | Students |
| `/career` | CareerPath | Students |
| `/teach` | Teach | All (role-specific views) |
| `/progress` | Progress | Students |
| `/profile` | Profile | All |
| `/settings` | Settings | All |
| `/billing` | Billing | All |
| `/usage` | Usage | All |

### Student Learning Routes
| Route | Page | Purpose |
|-------|------|---------|
| `/learn/course/:id` | StudentCourseDetail | Course modules and progress |
| `/learn/objective/:loId` | LearningObjective | Video player + micro-checks |
| `/learn/objective/:loId/assess` | Assessment | Take assessment |
| `/learn/slides/:slideId` | StudentSlidePage | View lecture slides |
| `/verify-identity` | IdentityVerification | KYC for certificates |
| `/certificate/:id` | CertificateView | View earned certificate |

### Instructor Routes
| Route | Page | Purpose |
|-------|------|---------|
| `/instructor/courses` | InstructorCourses | Course management |
| `/instructor/courses/:id` | InstructorCourseDetail | Course editing hub |
| `/instructor/courses/:courseId/analytics` | CourseAnalytics | Student engagement |
| `/instructor/courses/:courseId/gradebook` | Gradebook | Grades and certificates |
| `/instructor/quick-setup` | QuickCourseSetup | AI course creation |
| `/instructor/verification` | InstructorVerification | Verify instructor status |
| `/become-instructor` | BecomeInstructor | Apply for instructor role |

### Admin Routes (University Tier Required)
| Route | Page | Purpose |
|-------|------|---------|
| `/admin` | AdminDashboard | Admin overview |
| `/admin/users` | UserManagement | Manage org users |
| `/admin/outcomes` | OutcomesReport | Learning analytics |
| `/admin/courses` | CourseManagement | Course oversight |
| `/admin/branding` | BrandingSettings | Platform customization |
| `/admin/instructor-review` | InstructorReviewQueue | Review applications |
| `/admin/content-moderation` | ContentModeration | Flagged content |
| `/admin/roles` | RoleManagement | Role assignment |
| `/admin/system-health` | SystemHealth | Platform monitoring |

### Employer Routes
| Route | Page | Purpose |
|-------|------|---------|
| `/employer` | EmployerDashboard | API management |
| `/employer/signup` | EmployerSignup | Create employer account |
| `/employer/api-docs` | ApiDocs | API documentation |
| `/employer/webhooks` | WebhookSettings | Webhook configuration |

### Legacy Redirects
| Old Route | Redirects To |
|-----------|--------------|
| `/courses` | `/learn?tab=transcript` |
| `/dream-jobs` | `/career?tab=jobs` |
| `/analysis` | `/career?tab=gaps` |
| `/recommendations` | `/career?tab=actions` |

---

## 2. Public & Landing Pages

### 2.1 Landing Page (`/`)

**Components:**
- Header (navigation + CTA)
- HeroSection (audience toggle: Students/Educators)
- FeaturesSection (4 features per audience)
- HowItWorksSection (4 steps)
- TestimonialsSection
- PricingSection (3 tiers)
- CTASection
- Footer

**User Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Toggle audience | Click "I'm a Student/Educator" | Content dynamically changes |
| Get Started | Click CTA button | Navigate to `/auth` |
| Log In | Click login link | Navigate to `/auth` |
| View pricing | Scroll to pricing | 3 plan cards displayed |

**Issues:**
1. **Audience preference not persisted** - Lost on navigation to auth
2. **No skeleton loading** - Content may flash
3. **Console ref warnings** - Header and HeroSection need forwardRef

---

## 3. Authentication Flow

### 3.1 Auth Page (`/auth`)

**Tab Structure:**
- Login tab
- Sign Up tab

**Login Form:**

| Field | Validation | Required |
|-------|------------|----------|
| Email | Valid email format | Yes |
| Password | Min 6 characters | Yes |

**Sign Up Form:**

| Field | Validation | Required |
|-------|------------|----------|
| Full Name | Min 2 characters | Yes |
| Email | Valid email format | Yes |
| Password | Min 6 characters | Yes |
| Confirm Password | Must match password | Yes |

**User Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Login | email + password | Success: `/dashboard`, Error: Toast |
| Sign Up | name + email + passwords | Success: `/onboarding`, Error: Toast |
| Forgot Password | Click link | Navigate to `/forgot-password` |

**Issues:**
1. **No email verification** - Accounts active immediately
2. **Weak password requirements** - Only 6 char minimum
3. **No social auth** - Missing Google/GitHub OAuth
4. **No rate limiting visible** - Brute force vulnerability
5. **Password toggle shared** - One toggle affects both fields

---

## 4. Onboarding Flow

### 4.1 Onboarding Wizard (`/onboarding`)

**4-Step Process:**

#### Step 1: Profile
| Field | Required | Validation |
|-------|----------|------------|
| Full Name | Yes | Min 2 chars |
| University | Yes | Any text |
| Major | No | Any text |
| Student Level | Yes | Select from dropdown |
| Graduation Year | No | Select from dropdown |

#### Step 2: Courses
| Action | Input | Output |
|--------|-------|--------|
| Upload syllabus | PDF/DOCX/TXT file | AI extracts capabilities |
| Paste syllabus | Manual text entry | AI extracts capabilities |
| Add course details | name, code, semester | Course saved to DB |

**Processing Pipeline:**
```
File → parse-syllabus-document → Save course → analyze-syllabus → Extract capabilities
```

#### Step 3: Dream Jobs
| Field | Required | Validation |
|-------|----------|------------|
| Job Role | Yes | Min 3 chars |
| Company Type | No | Select dropdown |
| Location | No | Any text |

**Max 5 dream jobs allowed**

**Processing Pipeline:**
```
Job query → createDreamJob → analyzeDreamJob → performGapAnalysis → generateRecommendations
```

#### Step 4: Complete
| Action | Output |
|--------|--------|
| Go to Dashboard | Sets `onboarding_completed=true`, navigates to `/dashboard` |

**Issues:**
1. **No form persistence** - Data lost if page closes
2. **No skip option** - Must complete all steps
3. **AI failures silent** - Course saved but no capabilities extracted
4. **No progress estimates** - User doesn't know how long AI processing takes
5. **DreamJobSuggestions component referenced but may not render**

---

## 5. Dashboard

### 5.1 Dashboard Page (`/dashboard`)

**Components:**
- WelcomeBackBanner
- NextActionBanner (smart recommendations)
- DashboardOverview (4 stat cards)
- DreamJobCards (carousel)
- ProgressWidget (recommendation status)
- CapabilitySnapshot (top 10 skills)

**Stats Cards:**
- Total Courses
- Dream Jobs Tracked
- Capabilities Identified
- Gaps to Close

**User Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Click dream job | Job card | Navigate to `/dream-jobs/{id}` |
| Add dream job | "+" button | Navigate to `/career?tab=jobs` |
| View all capabilities | Expand link | Navigate to `/learn?tab=skills` |

**Data Hooks:**
- `useDashboardOverview()` - Stats aggregation
- `useDashboardStats()` - Readiness metrics
- `useDreamJobs()` - Job list
- `useCapabilities()` - Skill list
- `useGapAnalysesForJobs()` - Gap counts

**Issues:**
1. **No error states** - If hooks fail, page shows nothing
2. **No loading skeletons** - All or nothing loading
3. **Capabilities capped at 10** - No "see all" option
4. **Gap count calculation** - Assumes arrays exist

---

## 6. My Learning Flow

### 6.1 Learn Page (`/learn`)

**Tab Structure:**
1. **Active** - Enrolled instructor courses
2. **Certificates** - Earned credentials
3. **Transcript** - Personal course history
4. **Skills** - Unified skill profile

#### Active Tab

| Action | Input | Output |
|--------|-------|--------|
| Enroll with code | Access code | Enrollment created |
| View course | Click card | Navigate to `/learn/course/{id}` |

#### Transcript Tab

| Action | Input | Output |
|--------|-------|--------|
| Add course | Syllabus + metadata | Course created, AI analyzes |
| Edit course | Updated fields | Course updated |
| Delete course | Confirmation | Course removed |
| Re-analyze | New syllabus file | Capabilities replaced |
| Mark complete | Status change | Grade dialog if completed |
| Bulk select | Checkbox selection | Enables bulk operations |
| Bulk delete | Confirmation | Selected courses removed |
| Export CSV | Selected courses | Downloads transcript file |

**Course Status Logic:**
```
grade = "in_progress" → Status: In Progress
grade = "planned" → Status: Planned
grade = any other value → Status: Completed (shows grade)
```

#### Skills Tab
- Verified Skills (from assessments) - Green badge
- Self-Reported Skills (from syllabus) - Gray badge
- Proficiency levels: beginner/intermediate/advanced/expert

**Issues:**
1. **Re-analysis replaces all capabilities** - No merge option
2. **Selection persists across tabs** - Confusing
3. **No pagination** - Could be slow with many courses
4. **Grade entry not required** - Defaults to "completed" status

### 6.2 Student Course Detail (`/learn/course/:id`)

**Components:**
- Course header (title, code)
- Progress overview card
- Modules accordion
- Learning objectives list per module

**Verification States:**
```
unstarted → in_progress → verified → assessment_unlocked → passed
                                   ↘ remediation_required
```

**User Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Expand module | Click header | Shows learning objectives |
| Click objective | LO card | Navigate to `/learn/objective/{loId}` |

**Issues:**
1. **No breadcrumb navigation**
2. **No recommended next objective**
3. **State machine not explained to students**

### 6.3 Learning Objective Page (`/learn/objective/:loId`)

**Layout:**
- Video player (left, main)
- Sidebar (right, 320px fixed):
  - Video list with match scores
  - Lecture slides (if published)
  - Assessment CTA

**Video Completion Requirements:**
1. Watch 80%+ of video
2. Pass all micro-checks

**Micro-Check Flow:**
```
Video plays → Trigger time reached → Overlay appears →
  Answer correct → Continue video
  Answer incorrect → Rewind to target timestamp
```

**User Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Select video | Click in sidebar | Load video player |
| Answer micro-check | Submit answer | Feedback + continue/rewind |
| View slides | Click slide set | Open modal viewer |
| Start assessment | Button (when verified) | Navigate to `/learn/objective/{loId}/assess` |

**Issues:**
1. **Sidebar not responsive** - Fixed 320px on mobile
2. **No note-taking capability**
3. **No video speed adjustment**
4. **No transcript/captions**
5. **Match scores unclear** - 0-100 or 0-1?

### 6.4 Assessment Page (`/learn/objective/:loId/assess`)

**Eligibility Check:**
```
ALLOWED_STATES = ['verified', 'assessment_unlocked', 'passed', 'remediation_required']
```

**If Eligible:** AssessmentSession component

**Session State Machine:**
```
idle → loading → active → submitting → completed → error
```

**User Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Start assessment | Page load | Creates session, fetches questions |
| Answer question | Submit answer | Server validates, shows feedback |
| Skip question | Skip button | Moves to next, marks skipped |
| Complete | Final answer | Shows results, updates verification_state |

**Results:**
- Score (percentage)
- Pass/fail status
- Breakdown by question
- Remediation path if failed

**Issues:**
1. **No time limit UI** - Per-question limits not visible
2. **No progress auto-save** - Connection loss = lost progress
3. **No review before submit** - Can't go back
4. **No rate limiting** - Unlimited attempts

---

## 7. Career Path Flow

### 7.1 Career Path Page (`/career`)

**Tab Structure:**
1. **Jobs** - Manage dream jobs
2. **Gaps** - View skill gaps
3. **Actions** - Recommendations
4. **Explore** - Discovery tools

#### Jobs Tab

| Action | Input | Output |
|--------|-------|--------|
| Add dream job | Title + company + location | Creates job, triggers analysis |
| Set as primary | Button on card | Updates primary flag |
| Delete job | Confirmation | Removes job + cascades |

#### Gaps Tab

**Gap Analysis Data:**
```typescript
{
  match_score: number,          // 0-100%
  honest_assessment: string,    // Candid feedback
  readiness_level: string,      // ready/3mo/6mo/1yr/needs_work
  strong_overlaps: [],          // Skills you have
  partial_overlaps: [],         // Foundation exists
  critical_gaps: [],            // Essential missing
  priority_gaps: []             // Ranked gaps
}
```

| Action | Input | Output |
|--------|-------|--------|
| Refresh analysis | Button | Re-runs AI gap analysis |
| Find courses | Button per gap | Searches for real courses |

#### Actions Tab

**Recommendation Types:**
- course, project, certification, skill, action
- reading, experience, networking, portfolio, resource

**Recommendation Statuses:**
- pending → in_progress → completed
- ↘ skipped

| Action | Input | Output |
|--------|-------|--------|
| Start recommendation | Button | Opens URL, marks in_progress |
| Complete | Button | Marks completed, may trigger re-analysis |
| Skip | Button | Marks skipped |
| Link course | Select course | Associates enrolled course |
| Find courses | Button | Searches for courses to match |

**Re-analysis Prompt:**
Shows after completing 1st, 3rd, 5th, 7th... recommendations

#### Explore Tab

| Action | Input | Output |
|--------|-------|--------|
| Take skills assessment | Button | Opens SkillsAssessmentWizard |
| View career matches | After assessment | Shows CareerMatchesGrid |
| Add match to jobs | Button on match | Creates dream job with O*NET data |

**Issues:**
1. **Background analysis delay** - 10-30s before data appears
2. **Course search results not shown** - Happens in background
3. **Linked course progress not auto-updating**
4. **No match score breakdown** - User doesn't understand calculation
5. **No timeline/roadmap view**

### 7.2 Dream Job Detail (`/dream-jobs/:jobId`)

Same tabs as Career Path but focused on single job.

**Additional Features:**
- Full job details header
- Dedicated gap analysis view
- Anti-recommendations section

---

## 8. Instructor Flow

### 8.1 Teach Page (`/teach`)

**Non-Instructor View:**
- Marketing content
- Benefits grid
- "Become Instructor" CTA

**Instructor View:**
- Stats cards (Total, Published, Drafts)
- Quick actions (My Courses, Create New)
- Recent courses list
- Verification status banner

### 8.2 Become Instructor (`/become-instructor`)

**Form Fields:**
| Field | Required | Notes |
|-------|----------|-------|
| Email | Yes | .edu emails auto-approved |
| Institution | No | University name |
| Department | No | Academic department |
| Title | No | Job title |
| LinkedIn | No | Profile URL |

**Approval Logic:**
```
.edu email → auto_approved → instructor role assigned
non-.edu → pending → manual review required
```

### 8.3 Instructor Courses (`/instructor/courses`)

**Course Grid:**
- Code badge
- Title (clickable)
- Description
- Status (Published/Draft)
- Curation mode badge

**Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Quick Setup (AI) | Button | Navigate to `/instructor/quick-setup` |
| Manual Setup | Dialog form | Creates course with access code |
| Duplicate | Button | Deep copies course + modules + LOs |
| Delete | Confirmation | Removes course |

### 8.4 Quick Course Setup (`/instructor/quick-setup`)

**8-Step Pipeline:**

| Step | Progress | Action |
|------|----------|--------|
| upload | 15% | File selection + naming |
| extracting | 35% | Read document |
| analyzing | 35% | Extract structure |
| creating_course | 50% | Create record |
| saving_structure | 60% | Save modules + LOs |
| finding_content | 75% | Search YouTube (batches of 3) |
| evaluating_content | 90% | AI scores videos |
| complete | 100% | Show results |

**Payment Gate (Non-Pro):**
- $1 per course
- Stripe checkout opens in new tab
- Returns with `?payment=success` or `?payment=cancelled`

**Issues:**
1. **Batch evaluation timeout** - Max 2 minutes polling
2. **No progress persistence** - Lost if page closes
3. **Payment in new tab** - Could be blocked

### 8.5 Instructor Course Detail (`/instructor/courses/:id`)

**Tabs:**
1. **Course Structure** - Modules + LOs + content
2. **Students** - Progress tracking

**Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Upload Syllabus | File | Extracts modules + LOs |
| Add Module | Form | Creates module |
| Find All Content | Button | Searches YouTube for all LOs |
| Generate All Slides | Button | Submits to batch API |
| Bulk Publish Slides | Button | Publishes all ready slides |
| Publish Course | Toggle | Validates and publishes |

**Publish Validation:**
- Has modules ✓
- Has learning objectives ✓
- Has approved content ✓

**Issues:**
1. **Course Settings button non-functional**
2. **No bulk content approval**
3. **No module reordering UI**
4. **No LO editing**
5. **No slide preview/edit**

### 8.6 Course Analytics (`/instructor/courses/:courseId/analytics`)

**Metrics:**
- Total Enrolled
- Active (7 days)
- Completed
- Avg Progress

**Student Filters:**
- All, Active, At Risk, Completed

**Student Status Logic:**
```
completed_at exists → completed
last_activity within 7 days → active
progress < 20% AND inactive → struggling
else → inactive
```

### 8.7 Gradebook (`/instructor/courses/:courseId/gradebook`)

**Summary Cards:**
- Total Students
- Average Score %
- Passing Rate %
- Completion Rate %

**Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Send Message | Select students | Opens message dialog |
| Issue Certificate | Button (if verified) | Issues certificate |
| View Student | Button | (Placeholder) |

---

## 9. Employer Flow

### 9.1 Employer Dashboard (`/employer`)

**If No Account:** Create account form

**If Account Exists:**
- Company info header
- Stats: Monthly Verifications, API Keys, API Requests
- 4 tabs: API Keys, Webhooks, Activity, Docs

**API Keys Tab:**

| Action | Input | Output |
|--------|-------|--------|
| Generate key | Key name (optional) | One-time visible key |
| Copy key | Button | Copied to clipboard |
| Revoke key | Delete button | Sets inactive |

**Webhooks Tab:**
Delegates to WebhookConfig component

**Activity Tab:**
- Last 20 API requests
- Shows endpoint, status code, latency

**Issues:**
1. **API key shown once** - Must copy immediately
2. **No key expiration policy**
3. **No pagination** - Limited to 20 items

### 9.2 Employer Signup (`/employer/signup`)

**3-Step Form:**

**Step 1: Company Info**
| Field | Required |
|-------|----------|
| Company Name | Yes |
| Domain | No |
| Industry | No |
| Size | No |
| Contact Name | No |
| Contact Email | No |

**Step 2: Plan Selection**
- Starter (Free): 50 verifications/month
- Professional ($99/mo): 500 verifications/month
- Enterprise (Custom): Unlimited

**Step 3: Complete**
Navigate to dashboard

**Issues:**
1. **Plan selection ignored** - Not sent to API
2. **No duplicate account check**
3. **Email validation missing**

### 9.3 Webhook Settings (`/employer/webhooks`)

**Webhook Events:**
- certificate.issued
- certificate.revoked
- verification.completed

**Tabs:**
1. Endpoints - WebhookConfig component
2. Event Types - Static list
3. Security - Signature verification guide
4. Testing - Code samples

**Issues:**
1. **No webhook testing UI** - Only examples
2. **Webhook secret generated client-side** - Security concern

### 9.4 API Documentation (`/employer/api-docs`)

**Endpoints:**
1. `POST /functions/v1/employer-verify-completion` - Single verification
2. `GET /functions/v1/employer-verify-completion` - Query param variant
3. `POST /functions/v1/employer-batch-verify` - Batch (max 50)

**Code Examples:** cURL, JavaScript, Python

**Issues:**
1. **Hardcoded project URL** - Shows placeholder
2. **No sandbox testing**
3. **Rate limits static** - Not from account

---

## 10. Admin Flow

### 10.1 Admin Dashboard (`/admin`)

**Access:** Requires `university` tier

**Stats:**
- Total Users
- Active Today
- Courses
- Completions

**Quick Actions:**
- User Management → `/admin/users`
- Outcomes Report → `/admin/outcomes`
- Branding Settings → `/admin/branding`

**Issues:**
1. **4 separate queries** - Should be aggregated
2. **Activity feed placeholder** - "Coming soon"
3. **Branding page may not exist**

### 10.2 User Management (`/admin/users`)

**Features:**
- Search by email/name
- Users table with status
- Bulk invite via email list

**Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Search | Text query | Filtered list |
| Add Users | Email list | Invitations sent |
| Export CSV | Button | Downloads user list |
| Remove from Org | User selection | Removes user |

**Issues:**
1. **"Send Reminder" non-functional**
2. **Email validation weak** - Only checks @
3. **No pagination**
4. **CSV not properly escaped**

### 10.3 Outcomes Report (`/admin/outcomes`)

**Time Range:** 7/30/90/365 days

**Metrics:**
- Active Students / Total
- Avg Gaps Identified
- Avg Gaps Closed
- Avg Completion Rate

**Lists:**
- Top 5 Skill Gaps
- Top 5 Dream Jobs
- Top 5 Course Utilization

**Issues:**
1. **PDF Export broken** - Uses window.print()
2. **Data aggregation inefficient** - Fetches all, processes in-memory
3. **No caching strategy**

### 10.4 Role Management (`/admin/roles`)

**Tabs:**
1. Manage Roles - Search + assign
2. Audit Log - Role change history

**Roles:** student, instructor, admin

**Actions:**

| Action | Input | Output |
|--------|-------|--------|
| Search users | Query (min 2 chars) | Matching profiles |
| Add role | Role + optional reason | Role assigned + audit log |
| Remove role | Role + optional reason | Role removed + audit log |

**Audit Log Entry:**
- User
- Action (added/removed)
- Old roles → New roles
- Reason
- Changed by
- Timestamp

**Issues:**
1. **Reason optional** - Audit trail can be empty
2. **No pagination** - Limited to 50 entries
3. **No undo functionality**

### 10.5 System Health (`/admin/system-health`)

**Health Checks:**
1. Database - Query profiles table
2. Auth - Get session
3. Storage - List buckets
4. Edge Functions - Invoke test function

**Status Logic:**
```
Latency < threshold → healthy
Latency >= threshold → degraded
Error → down (or degraded for storage/functions)
```

**Metrics (Mostly Simulated):**
- Active Connections: Random 10-60
- Requests/min: Random 50-250
- Avg Response: Calculated from checks
- Error Rate: % of down services
- Uptime: Based on status (99.9%/98.5%/95%)

**Issues:**
1. **Most metrics fake** - Random numbers
2. **No alerting**
3. **No historical data**
4. **Response time trend placeholder**

---

## 11. Cross-Cutting Issues

### Security Concerns
| Issue | Location | Severity |
|-------|----------|----------|
| No email verification | Auth | High |
| Weak password requirements | Auth | High |
| Client-side webhook secret | Employer | High |
| No rate limiting visible | Auth, API | Medium |
| API keys never expire | Employer | Medium |
| Email validation weak | Admin | Low |

### Performance Issues
| Issue | Location | Severity |
|-------|----------|----------|
| N+1 queries | Dashboard, Admin | High |
| No pagination | User tables, Activity logs | High |
| In-memory data processing | Outcomes Report, Analytics | Medium |
| No caching strategy | Admin queries | Medium |
| Large dataset loads | Analytics hooks | Medium |

### UX Issues
| Issue | Location | Severity |
|-------|----------|----------|
| No form persistence | Onboarding, Signup | High |
| Error states missing | Dashboard, Learn | High |
| Loading skeletons incomplete | Most pages | Medium |
| No progress indicators for AI | Onboarding, Quick Setup | Medium |
| Fixed sidebar widths | Learning Objective | Medium |
| Confirmation dialogs missing | Destructive actions | Medium |

### Missing Features
| Feature | Location | Priority |
|---------|----------|----------|
| Email verification | Auth | High |
| Social authentication | Auth | Medium |
| Progress auto-save | Assessment | High |
| Note-taking | Learning | Medium |
| Video speed control | Learning | Low |
| Module reordering | Instructor | Medium |
| Bulk content approval | Instructor | Medium |
| Webhook testing | Employer | Medium |
| PDF generation | Admin | Medium |
| Real metrics | System Health | Low |

---

## 12. Prioritized Fix List

### Critical (Fix Immediately)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | Add email verification | Auth flow | Security |
| 2 | Strengthen password requirements | Auth flow | Security |
| 3 | Fix assessment progress loss | Assessment | Data loss |
| 4 | Add error boundaries | All pages | UX crash |
| 5 | Fix PDF export | Outcomes Report | Broken feature |

### High Priority (Fix Soon)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | Add form persistence | Onboarding | User frustration |
| 7 | Add pagination | User tables | Performance |
| 8 | Fix N+1 queries | Dashboard, Admin | Performance |
| 9 | Add loading skeletons | All pages | UX polish |
| 10 | Server-side webhook secrets | Employer | Security |
| 11 | Add rate limiting UI | Auth, API | Security |
| 12 | Fix "Send Reminder" | User Management | Broken feature |
| 13 | Add confirmation dialogs | Destructive actions | Data safety |

### Medium Priority (Next Sprint)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 14 | Add social auth | Auth | User convenience |
| 15 | Add progress indicators | AI processing | UX clarity |
| 16 | Make sidebar responsive | Learning Objective | Mobile UX |
| 17 | Add module reordering | Instructor | Feature gap |
| 18 | Add bulk content approval | Instructor | Efficiency |
| 19 | Add webhook testing UI | Employer | Feature gap |
| 20 | Implement real metrics | System Health | Accuracy |
| 21 | Add video speed control | Learning | Feature request |
| 22 | Add note-taking | Learning | Feature request |
| 23 | Add caching strategy | Admin analytics | Performance |
| 24 | Fix plan selection | Employer Signup | Bug |

### Low Priority (Technical Debt)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 25 | Fix console ref warnings | Landing | Code quality |
| 26 | Add API key expiration | Employer | Best practice |
| 27 | Improve email validation | Admin | Data quality |
| 28 | Add CSV escaping | Export | Edge case bug |
| 29 | Add audit log pagination | Role Management | UX |
| 30 | Add historical health data | System Health | Feature |

---

## Appendix: Data Flow Diagrams

### A. User Registration → Learning Flow
```
Landing → Auth (signup) → Onboarding
                              ├→ Profile (save)
                              ├→ Courses (upload + analyze)
                              └→ Dream Jobs (add + analyze)
                                        ↓
                                   Dashboard
                                        ↓
                              ┌────────┴────────┐
                              ↓                 ↓
                           /learn            /career
                              ↓                 ↓
                    Course Detail         Gap Analysis
                              ↓                 ↓
                    Learning Objective   Recommendations
                              ↓                 ↓
                    Watch Content        Link Courses
                              ↓                 ↓
                       Assessment        Complete Tasks
                              ↓                 ↓
                    Pass → Certificate   Re-analyze
```

### B. Instructor Course Creation Flow
```
/teach → /instructor/quick-setup
              ↓
    Upload Syllabus (PDF/DOCX)
              ↓
    Parse Document (Edge Function)
              ↓
    Extract Modules + LOs (AI)
              ↓
    Search YouTube Content (Batch)
              ↓
    Evaluate Videos (Batch API)
              ↓
    ┌─────────────────────────────┐
    ↓                             ↓
Review Course              Create Another
    ↓
/instructor/courses/{id}
    ↓
Approve Content + Generate Slides
    ↓
Publish Course (with access code)
    ↓
Students enroll via code
```

### C. Employer Verification Flow
```
/employer/signup → Create Account
                         ↓
              /employer (dashboard)
                         ↓
            ┌────────────┴────────────┐
            ↓                         ↓
    Generate API Key            Configure Webhooks
            ↓                         ↓
    Call Verification API       Receive Events
            ↓
    Certificate Verified/Invalid
```

---

*Report generated by Claude Code Review - 2026-01-27*
