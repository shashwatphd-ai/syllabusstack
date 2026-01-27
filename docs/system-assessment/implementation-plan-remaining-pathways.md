# SyllabusStack - Remaining User Pathway Implementation Plan

> **Generated:** 2026-01-27
> **Status:** Ready for Implementation
> **Priority:** Employer → Admin → Student enhancements

---

## Executive Summary

### Current Pathway Status

| Pathway | Completeness | Status | Priority |
|---------|-------------|--------|----------|
| **Instructor** | 95% ✅ | Production-ready | Maintenance only |
| **Student** | 85% ✅ | Mostly complete | Low - Progress dashboard |
| **Admin** | 70% ⚠️ | Security fixed, features missing | Medium - Operations |
| **Employer** | 60% ⚠️ | Core API exists, no acquisition | **High - Revenue** |

### Critical Issues Resolved This Session
1. ✅ Fixed `useVerificationStatus` hook to check pending status
2. ✅ Created RLS security fix migration for admin policies

---

## Phase 1: Employer Pathway (Priority: HIGH)

**Goal:** Enable employer acquisition and revenue generation

### 1.1 Employer Landing Page
**Impact:** Discovery & Conversion
**Effort:** 4 hours

**Files to Create:**
```
src/pages/Employers.tsx          # Marketing landing page
src/components/employer/
  ├── PricingCard.tsx           # Plan comparison cards
  ├── FeatureGrid.tsx           # Feature list with icons
  └── TestimonialSection.tsx    # Social proof
```

**Route:** `/employers` (public, no auth required)

**Content:**
- Hero: "Verify Credentials in Seconds"
- Value props: Reduce hiring risk, verify skills, trust scores
- Pricing: API-only ($99/mo) vs Recruiting Portal ($299/mo)
- CTA: "Start Free Trial" → `/employer/signup`

**Code Pattern:**
```typescript
// src/pages/Employers.tsx
export default function EmployersPage() {
  return (
    <div className="min-h-screen">
      <HeroSection
        title="Verify Credentials in Seconds"
        subtitle="Trust verified skills from real courses"
        cta={{ label: "Start Free Trial", href: "/employer/signup" }}
      />
      <FeatureGrid features={employerFeatures} />
      <PricingSection plans={employerPlans} />
      <TestimonialSection />
      <CTASection />
    </div>
  );
}
```

### 1.2 Employer Signup Flow
**Impact:** Acquisition funnel
**Effort:** 8 hours

**Files to Create:**
```
src/pages/employer/
  ├── EmployerSignup.tsx        # Multi-step signup wizard
  └── EmployerOnboarding.tsx    # Post-signup setup
src/components/employer/
  ├── CompanyInfoForm.tsx       # Company details form
  ├── PlanSelector.tsx          # Plan selection UI
  └── PaymentSetup.tsx          # Stripe integration
```

**Route:** `/employer/signup` (public)

**Flow:**
1. **Step 1:** Email + Password (Supabase Auth)
2. **Step 2:** Company Info (name, website, industry, size)
3. **Step 3:** Plan Selection (API / Recruiting Portal)
4. **Step 4:** Payment Setup (Stripe Checkout)
5. **Step 5:** API Key Generation + Documentation

**Database Changes:**
```sql
-- Add fields to employer_accounts
ALTER TABLE employer_accounts
ADD COLUMN website TEXT,
ADD COLUMN industry VARCHAR(100),
ADD COLUMN company_size VARCHAR(50),
ADD COLUMN billing_email TEXT;
```

**Hook to Create:**
```typescript
// src/hooks/useEmployerSignup.ts
export function useEmployerSignup() {
  return useMutation({
    mutationFn: async (data: EmployerSignupData) => {
      // 1. Create auth user
      // 2. Create employer_accounts record
      // 3. Generate initial API key
      // 4. Create Stripe customer
    }
  });
}
```

### 1.3 Webhook Configuration UI
**Impact:** Real-time integration capability
**Effort:** 6 hours

**Files to Create:**
```
src/components/employer/
  ├── WebhookConfig.tsx         # Webhook management UI
  ├── WebhookTestButton.tsx     # Send test webhook
  └── WebhookEventLog.tsx       # Recent deliveries
```

**Features:**
- Add webhook endpoint URL
- Select events (certificate_issued, certificate_revoked, verification_completed)
- View delivery logs with status codes
- Retry failed deliveries
- Generate signing secret

**Edge Function:**
```typescript
// supabase/functions/trigger-employer-webhook/index.ts
export async function triggerWebhook(
  employerId: string,
  event: WebhookEvent,
  payload: any
) {
  // 1. Fetch employer webhooks
  // 2. Sign payload with HMAC-SHA256
  // 3. POST to webhook URL
  // 4. Log result
  // 5. Queue retry if failed
}
```

### 1.4 API Documentation Page
**Impact:** Developer experience
**Effort:** 4 hours

**Files to Create:**
```
src/pages/employer/
  └── ApiDocs.tsx               # Interactive API docs
```

**Route:** `/employer/api-docs` (public)

**Content:**
- Authentication (API key headers)
- Endpoints with request/response examples
- Code snippets (curl, Python, JavaScript)
- Error codes reference
- Rate limits explanation

---

## Phase 2: Admin Pathway (Priority: MEDIUM)

**Goal:** Enable platform operations and content quality

### 2.1 Content Moderation System
**Impact:** Quality control
**Effort:** 12 hours

**Files to Create:**
```
src/pages/admin/
  └── ContentModeration.tsx     # Moderation queue
src/components/admin/
  ├── ModerationQueue.tsx       # Flagged content list
  ├── ContentReviewCard.tsx     # Individual review UI
  └── ModerationActions.tsx     # Approve/reject/escalate
```

**Route:** `/admin/content-moderation`

**Database Migration:**
```sql
-- supabase/migrations/XXXXXX_add_content_moderation.sql
CREATE TABLE content_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL, -- 'video', 'slide', 'course'
  content_id UUID NOT NULL,
  flagged_by UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'escalated'
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only admins can access
ALTER TABLE content_moderation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage moderation"
ON content_moderation FOR ALL
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND role = 'admin'));
```

**Features:**
- Queue of flagged content
- Filter by content type, status, date
- Preview content inline
- Approve (remove flag), Reject (remove content), Escalate
- Bulk actions

### 2.2 Role Management Interface
**Impact:** Admin operations
**Effort:** 8 hours

**Files to Create:**
```
src/pages/admin/
  └── RoleManagement.tsx        # Role assignment UI
src/components/admin/
  ├── UserRoleEditor.tsx        # Edit user roles
  ├── BulkRoleAssignment.tsx    # Bulk role changes
  └── RoleAuditLog.tsx          # Role change history
```

**Route:** `/admin/roles`

**Features:**
- Search users by email/name
- View current roles (student, instructor, admin)
- Add/remove roles with confirmation
- Bulk role assignment via CSV
- Role change audit log

**Database Changes:**
```sql
-- Add role_audit table
CREATE TABLE role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  old_roles TEXT[],
  new_roles TEXT[],
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 Admin Activity Dashboard
**Impact:** Operations visibility
**Effort:** 6 hours

**Files to Update:**
```
src/pages/admin/AdminDashboard.tsx  # Replace placeholder
```

**Features:**
- Recent admin actions (role changes, verifications, moderation)
- Pending items counts (verifications, moderation)
- Quick action buttons
- Key metrics (new users, enrollments, certificates)

**Hook:**
```typescript
// src/hooks/useAdminActivity.ts
export function useAdminActivity() {
  return useQuery({
    queryKey: ['admin-activity'],
    queryFn: async () => {
      // Aggregate recent admin actions from audit tables
    }
  });
}
```

### 2.4 Fix Incomplete Admin Features
**Impact:** UX polish
**Effort:** 4 hours

**Fixes Needed:**
1. `UserManagement.tsx`: Implement "Send Reminder" dropdown action
2. `OutcomesReport.tsx`: Implement PDF export (use react-pdf or html2canvas)
3. `BrandingSettings.tsx`: Persist settings to database
4. `OrganizationDashboard.tsx`: Wire up "Manage Subscription" button

---

## Phase 3: Student Pathway Enhancements (Priority: LOW)

**Goal:** Improve learning experience visibility

### 3.1 Learning Progress Dashboard
**Impact:** Student engagement
**Effort:** 8 hours

**Files to Create:**
```
src/pages/
  └── Progress.tsx              # Dedicated progress page
src/components/progress/
  ├── CourseProgressCard.tsx    # Per-course progress
  ├── ObjectiveTimeline.tsx     # LO completion timeline
  ├── SkillProgressChart.tsx    # Skills radar chart
  └── LearningStreak.tsx        # Engagement metrics
```

**Route:** `/progress`

**Features:**
- All enrolled courses with progress bars
- Module/objective breakdown
- Time spent tracking
- Completion timeline
- Learning streak/engagement metrics
- Next recommended actions

### 3.2 Certificate PDF Generation Verification
**Impact:** Product credibility
**Effort:** 3 hours

**Verify/Fix:**
- Test PDF generation flow
- Ensure `pdf_path` is populated
- Verify download works
- Add loading state for PDF generation

### 3.3 Assessment Failure UX
**Impact:** Student success
**Effort:** 4 hours

**Files to Update:**
```
src/pages/student/Assessment.tsx
src/components/assessment/AssessmentResults.tsx
```

**Improvements:**
- Show what to review on failure
- Recommended content to revisit
- Retry timing guidance
- Progress preservation

---

## Implementation Guidelines

### Agent Task Pattern

For each feature, follow this pattern:

```markdown
## Task: [Feature Name]

### Pre-conditions
- List existing files to read
- List database tables to check
- List hooks to verify

### Implementation Steps
1. Create/update database migration (if needed)
2. Create/update TypeScript types
3. Create/update hooks
4. Create/update components
5. Create/update pages
6. Add routes to App.tsx
7. Test critical paths

### Post-conditions
- Feature is accessible via route
- All data persists correctly
- Error states handled
- Loading states present
- Mobile responsive
```

### Code Quality Checklist

For each implementation:
- [ ] TypeScript types complete
- [ ] Error handling with toast notifications
- [ ] Loading states (skeleton or spinner)
- [ ] Empty states with guidance
- [ ] Mobile responsive design
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Query caching configured
- [ ] RLS policies if database changes

### Commit Message Format

```
feat(employer): add employer landing page with pricing

- Create Employers.tsx marketing page
- Add PricingCard and FeatureGrid components
- Add /employers route (public)
- Include pricing plans and CTAs

Impact: Enables employer discovery and acquisition funnel
```

---

## Execution Order

### Week 1: Employer Acquisition
| Day | Task | Hours |
|-----|------|-------|
| 1-2 | 1.1 Employer Landing Page | 4 |
| 2-3 | 1.2 Employer Signup Flow | 8 |
| 4 | 1.3 Webhook Configuration UI | 6 |
| 5 | 1.4 API Documentation Page | 4 |

### Week 2: Admin Operations
| Day | Task | Hours |
|-----|------|-------|
| 1-2 | 2.1 Content Moderation System | 12 |
| 3-4 | 2.2 Role Management Interface | 8 |
| 4-5 | 2.3 Admin Activity Dashboard | 6 |
| 5 | 2.4 Fix Incomplete Features | 4 |

### Week 3: Student Polish
| Day | Task | Hours |
|-----|------|-------|
| 1-2 | 3.1 Learning Progress Dashboard | 8 |
| 3 | 3.2 Certificate PDF Verification | 3 |
| 3-4 | 3.3 Assessment Failure UX | 4 |
| 5 | Testing & Bug Fixes | 8 |

---

## Testing Strategy

### Per-Feature Testing
1. **Unit:** Hook logic, utility functions
2. **Component:** Render tests, interaction
3. **Integration:** Full user flow
4. **E2E:** Critical paths with Playwright

### Critical Paths to Test
- [ ] Employer: Landing → Signup → API Key → Verify Certificate
- [ ] Admin: Login → Review Queue → Approve/Reject → User updated
- [ ] Student: Enroll → Learn → Assess → Certificate → Share

---

## Deployment Checklist

Before merging to main:
- [ ] All migrations applied successfully
- [ ] TypeScript build passes
- [ ] No console errors in dev
- [ ] Mobile responsive verified
- [ ] RLS policies tested
- [ ] Edge functions deployed
- [ ] Environment variables configured
- [ ] Feature flags set (if using)

---

## Files Summary

### New Files to Create (25 files)
```
src/pages/
  ├── Employers.tsx
  ├── Progress.tsx
  └── employer/
      ├── EmployerSignup.tsx
      ├── EmployerOnboarding.tsx
      └── ApiDocs.tsx

src/pages/admin/
  ├── ContentModeration.tsx
  └── RoleManagement.tsx

src/components/employer/
  ├── PricingCard.tsx
  ├── FeatureGrid.tsx
  ├── TestimonialSection.tsx
  ├── CompanyInfoForm.tsx
  ├── PlanSelector.tsx
  ├── PaymentSetup.tsx
  ├── WebhookConfig.tsx
  ├── WebhookTestButton.tsx
  └── WebhookEventLog.tsx

src/components/admin/
  ├── ModerationQueue.tsx
  ├── ContentReviewCard.tsx
  ├── ModerationActions.tsx
  ├── UserRoleEditor.tsx
  ├── BulkRoleAssignment.tsx
  └── RoleAuditLog.tsx

src/components/progress/
  ├── CourseProgressCard.tsx
  ├── ObjectiveTimeline.tsx
  ├── SkillProgressChart.tsx
  └── LearningStreak.tsx

src/hooks/
  ├── useEmployerSignup.ts
  └── useAdminActivity.ts

supabase/migrations/
  └── XXXXXX_add_content_moderation.sql
```

### Files to Update (8 files)
```
src/App.tsx                       # Add new routes
src/pages/admin/AdminDashboard.tsx
src/pages/admin/UserManagement.tsx
src/pages/admin/OutcomesReport.tsx
src/pages/admin/BrandingSettings.tsx
src/pages/admin/OrganizationDashboard.tsx
src/pages/student/Assessment.tsx
src/components/assessment/AssessmentResults.tsx
```
