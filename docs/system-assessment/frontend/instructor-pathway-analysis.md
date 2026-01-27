# Instructor Pathway & Frontend Usability Analysis

**Assessment Date:** January 26, 2026

---

## Executive Summary

The instructor journey from login to course publishing involves **7 distinct stages** across **4 unique pages**. While the core flow is functional, there are several usability and routing issues that create friction.

### Health Scorecard

| Aspect | Score | Assessment |
|--------|-------|------------|
| Login/Auth Flow | 8/10 | Clean, but no instructor-specific signup |
| Instructor Discovery | 4/10 | Role-gated, no clear "Become Instructor" path |
| Course Creation (Quick Setup) | 9/10 | Excellent AI-assisted experience |
| Course Management | 7/10 | Feature-rich but complex |
| Verification Flow | 6/10 | Works, but disconnected from main flow |
| Navigation | 5/10 | Role-gated, hidden from new users |

---

## Instructor Journey Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INSTRUCTOR JOURNEY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. SIGNUP/LOGIN                    2. ROLE ASSIGNMENT                       │
│  ─────────────                      ────────────────                         │
│  /auth                              ??? (Manual DB or Admin)                 │
│  • Email + Password                 • No self-service instructor signup      │
│  • Standard user account            • Must be assigned "instructor" role     │
│  • Redirects to /dashboard          • Role stored in user_roles table        │
│                                                                              │
│         │                                    │                               │
│         ▼                                    ▼                               │
│                                                                              │
│  3. DISCOVERY                        4. VERIFICATION (Optional)              │
│  ─────────                           ──────────────────────────              │
│  Sidebar shows "Instructor" section  /instructor/verification               │
│  • Only visible with instructor role • Email verification (.edu auto-verify) │
│  • Links to /instructor/courses      • Invite code verification              │
│  • No onboarding for new instructors • Manual review for non-.edu            │
│                                      • Trust score system                    │
│         │                                    │                               │
│         ▼                                    ▼                               │
│                                                                              │
│  5. COURSE CREATION                                                          │
│  ─────────────────                                                           │
│  /instructor/courses                                                         │
│  ├── Quick Setup (AI) → /instructor/quick-setup                             │
│  │   • Upload syllabus (PDF/DOCX)                                            │
│  │   • AI extracts modules + LOs                                             │
│  │   • AI finds YouTube content                                              │
│  │   • $1 fee for free tier users                                            │
│  │                                                                           │
│  └── Manual Setup                                                            │
│      • Dialog to enter course details                                        │
│      • Then navigate to course detail                                        │
│                                                                              │
│         │                                                                    │
│         ▼                                                                    │
│                                                                              │
│  6. COURSE MANAGEMENT                                                        │
│  ───────────────────                                                         │
│  /instructor/courses/:id                                                     │
│  • Two tabs: Course Structure | Students                                     │
│  • Upload syllabus (if not done)                                             │
│  • Review modules & LOs                                                      │
│  • Find/approve content                                                      │
│  • Generate slides (Batch API)                                               │
│  • Generate images                                                           │
│  • Publish/unpublish course                                                  │
│                                                                              │
│         │                                                                    │
│         ▼                                                                    │
│                                                                              │
│  7. PUBLISH & SHARE                                                          │
│  ─────────────────                                                           │
│  • Access code generated on creation                                         │
│  • Share code with students                                                  │
│  • Students enroll via code                                                  │
│  • Track progress in Students tab                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Critical Issues

### ISSUE-01: No Instructor Signup Path (Severity: High)

**Problem:**
There's no way for a user to become an instructor through the UI. The `instructor` role must be manually assigned in the database or by an admin.

**Current Flow:**
1. User signs up → Gets standard account
2. User has no way to request instructor access
3. Admin must manually add role to `user_roles` table

**Evidence:**
- `Auth.tsx` has no instructor signup option
- `Onboarding.tsx` doesn't ask about instructor intent
- `navigation.ts` shows instructor nav only with role

**Impact:**
- Instructors can't self-onboard
- Lost conversion opportunity
- Requires admin intervention

**Recommendation:**
Add "Become an Instructor" flow:
1. Add option in onboarding or profile
2. Link to `/instructor/verification`
3. Auto-assign instructor role upon verification

---

### ISSUE-02: Instructor Verification Disconnected (Severity: Medium)

**Problem:**
The verification page (`/instructor/verification`) exists but isn't part of the main instructor flow. Instructors can create courses without verification.

**Current Flow:**
```
/instructor/courses → Can create courses immediately
/instructor/verification → Exists separately, optional
```

**Evidence:**
- `InstructorCoursesPage.tsx` doesn't check verification status
- Verification only affects certificate issuance (trust score)
- No prompt to verify before publishing

**Impact:**
- Unverified instructors can publish courses
- No quality gate for instructor content
- Verification feels like an afterthought

**Recommendation:**
- Add verification prompt on first visit to `/instructor/courses`
- Show verification status badge on instructor pages
- Consider requiring verification for publishing (optional gate)

---

### ISSUE-03: Role-Gated Navigation Confusion (Severity: Medium)

**Problem:**
The "Instructor" section in the sidebar only appears if the user has the instructor role. New users don't know this section exists.

**Evidence:**
```typescript
// Sidebar.tsx:40
const isInstructor = roles?.some(r => r.role === 'instructor' || r.role === 'admin');
```

**Impact:**
- New users don't know they can become instructors
- No discoverability of instructor features
- Marketing opportunity missed

**Recommendation:**
- Show "Become an Instructor" link in sidebar for non-instructors
- Or add instructor info on Dashboard for users without the role

---

### ISSUE-04: Payment Flow Opens New Tab (Severity: Low)

**Problem:**
In `QuickCourseSetupPage.tsx`, the Stripe checkout opens in a new tab:
```typescript
window.open(data.checkout_url, '_blank');
```

**Impact:**
- User leaves the context
- After payment, must manually return
- Confusing for less technical users

**Recommendation:**
- Use `window.location.href` for same-tab redirect
- Or use Stripe embedded checkout

---

### ISSUE-05: Complex Course Detail Page (Severity: Medium)

**Problem:**
`InstructorCourseDetailPage.tsx` is 838 lines with many features:
- Syllabus upload
- Module/LO management
- Content search & approval
- Slide generation
- Image generation
- Publishing
- Student progress

**Evidence:**
- 26 hooks imported
- 8 different action buttons
- Complex state management

**Impact:**
- Overwhelming for new instructors
- Cognitive load on first use
- Hard to maintain

**Recommendation:**
- Break into tabbed sub-pages or a wizard
- Progressive disclosure of features
- Add guided onboarding for first course

---

## Routing Analysis

### Current Instructor Routes

| Route | Component | Purpose | Guard |
|-------|-----------|---------|-------|
| `/instructor/courses` | InstructorCoursesPage | Course list | AuthGuard |
| `/instructor/courses/:id` | InstructorCourseDetailPage | Course management | AuthGuard |
| `/instructor/quick-setup` | QuickCourseSetupPage | AI course creation | AuthGuard |
| `/instructor/verification` | InstructorVerificationPage | Instructor verification | AuthGuard |

### Missing Routes

| Suggested Route | Purpose |
|-----------------|---------|
| `/become-instructor` | Self-service instructor signup |
| `/instructor/onboarding` | First-time instructor guide |
| `/instructor/settings` | Instructor-specific settings |
| `/instructor/courses/:id/slides` | Dedicated slide management |
| `/instructor/courses/:id/students` | Dedicated student view |

### Route Issues

1. **No InstructorGuard:** All instructor routes use `AuthGuard`, meaning any logged-in user can access `/instructor/courses` (they'll see empty state)

2. **No 404 handling for instructor routes:** Invalid course IDs show generic 404

3. **Deep linking works but context lost:** `/instructor/courses/:id` works directly but user may not know they're in instructor mode

---

## Navigation Structure

### Current Sidebar Structure

```
MAIN
├── Dashboard        → /dashboard
├── My Learning      → /learn
└── Career Path      → /career

INSTRUCTOR (role-gated)
└── Instructor Portal → /instructor/courses

ADMIN (role-gated)
└── Admin Portal     → /admin

SECONDARY
├── Profile          → /profile
├── AI Usage         → /usage
├── Billing          → /billing
└── Settings         → /settings
```

### Recommended Structure

```
MAIN
├── Dashboard        → /dashboard
├── My Learning      → /learn
├── Career Path      → /career
└── Teach (NEW)      → /instructor/courses OR /become-instructor

INSTRUCTOR (if role)
├── My Courses       → /instructor/courses
├── Verification     → /instructor/verification (if not verified)
└── Analytics        → /instructor/analytics (future)

SECONDARY
├── Profile          → /profile
├── Settings         → /settings
└── Billing          → /billing
```

---

## Frontend Structure Assessment

### Page Count by Category

| Category | Count | Pages |
|----------|-------|-------|
| Public | 9 | Index, Scanner, Resources, Legal, HowItWorks, Universities, TestResults, PaymentSuccess/Cancel |
| Auth | 3 | Auth, ForgotPassword, ResetPassword |
| Student | 7 | Dashboard, Learn, CareerPath, CourseDetail, DreamJobDetail, Onboarding, Profile |
| Instructor | 4 | InstructorCourses, InstructorCourseDetail, QuickCourseSetup, InstructorVerification |
| Admin | 6 | AdminDashboard, UserManagement, CourseManagement, OutcomesReport, BrandingSettings, InstructorReviewQueue |
| Other | 6 | Settings, Billing, Checkout, Usage, CertificateView, EmployerDashboard |

### Component Organization

```
src/components/
├── auth/           # Auth guards, login forms
├── instructor/     # Instructor-specific components ✓
│   ├── InstructorVerificationFlow.tsx
│   ├── UnifiedModuleCard.tsx
│   ├── UnifiedLOCard.tsx
│   ├── SyllabusUploader.tsx
│   └── ...
├── layout/         # AppShell, Sidebar, etc.
├── student/        # Student learning components
└── ui/             # shadcn/ui primitives
```

**Assessment:** Component organization is good. Instructor components are isolated.

---

## Quick Wins (Low Effort, High Impact)

### 1. Add "Teach" Link to Sidebar
```typescript
// navigation.ts - Add to mainNavigation
{ name: 'Teach', href: '/instructor/courses', icon: School, mobileLabel: 'Teach' }
```
This makes instructor features discoverable.

### 2. Add Verification Check to Instructor Pages
```typescript
// InstructorCoursesPage.tsx
if (!profile?.is_instructor_verified) {
  return <VerificationPrompt />;
}
```

### 3. Show Instructor Onboarding on First Visit
```typescript
// Use localStorage flag
if (!localStorage.getItem('instructor_onboarded')) {
  return <InstructorOnboarding />;
}
```

### 4. Simplify Course Detail with Wizard Mode
For first course, show step-by-step wizard instead of all options at once.

---

## Recommendations Summary

| Priority | Issue | Recommendation | Effort |
|----------|-------|----------------|--------|
| P0 | No instructor signup | Add "Become Instructor" flow | Medium |
| P1 | Verification disconnected | Integrate into course creation flow | Low |
| P1 | Role-gated discovery | Show "Teach" in nav for all users | Low |
| P2 | Complex course detail | Add wizard mode for new instructors | Medium |
| P2 | Payment in new tab | Use same-tab redirect | Low |
| P3 | No InstructorGuard | Create dedicated guard | Low |
| P3 | Missing analytics | Add instructor analytics page | High |

---

## Appendix: File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/pages/Auth.tsx` | 284 | Login/Signup |
| `src/pages/Onboarding.tsx` | 19 | Onboarding wrapper |
| `src/pages/instructor/InstructorCourses.tsx` | 296 | Course list |
| `src/pages/instructor/InstructorCourseDetail.tsx` | 838 | Course management |
| `src/pages/instructor/QuickCourseSetup.tsx` | 677 | AI course creation |
| `src/pages/instructor/InstructorVerification.tsx` | 17 | Verification wrapper |
| `src/components/instructor/InstructorVerificationFlow.tsx` | 318 | Verification logic |
| `src/components/layout/Sidebar.tsx` | 231 | Navigation sidebar |
| `src/config/navigation.ts` | 93 | Nav configuration |
