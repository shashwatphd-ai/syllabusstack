# SyllabusStack Platform Expansion - Complete Wireframe Specification

> **Version:** 1.0
> **Last Updated:** 2026-01-25
> **Status:** Implementation Ready
> **Reference:** SyllabusStack_Detailed_Operations.mermaid

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State vs Target State](#2-current-state-vs-target-state)
3. [Section 1: Instructor Onboarding](#3-section-1-instructor-onboarding)
4. [Section 2: Institutional Licensing](#4-section-2-institutional-licensing)
5. [Section 3: Employer Access](#5-section-3-employer-access)
6. [Section 4: Course Creation Pipeline](#6-section-4-course-creation-pipeline)
7. [Section 5: Student Onboarding](#7-section-5-student-onboarding)
8. [Section 6: Enrollment & Learning](#8-section-6-enrollment--learning)
9. [Section 7: Progressive Generation Engine](#9-section-7-progressive-generation-engine)
10. [Section 8: Certification & Monetization](#10-section-8-certification--monetization)
11. [Database Schema](#11-database-schema)
12. [API Contracts](#12-api-contracts)
13. [Implementation Checklist](#13-implementation-checklist)

---

## 1. Executive Summary

### 1.1 Purpose
This document provides complete wireframe specifications for expanding SyllabusStack from its current state to the target platform described in the operational flowchart.

### 1.2 Scope
- 8 major platform sections
- 45+ new screens/components
- 15+ new database tables
- 25+ new API endpoints
- 3 third-party integrations

### 1.3 Implementation Priority

| Priority | Section | Revenue Impact | Effort |
|----------|---------|----------------|--------|
| P0 | Certificate System | High ($25-49/cert) | 3 weeks |
| P1 | Instructor Verification | Medium (trust) | 2 weeks |
| P1 | Student IDV | Medium (cert value) | 3 weeks |
| P2 | Progressive Generation | Medium (cost savings) | 2 weeks |
| P2 | B2B Institutional | High ($5K-50K/yr) | 4 weeks |
| P3 | Employer Access | Medium ($2K/yr) | 3 weeks |
| P3 | Proctoring | Low (premium only) | 2 weeks |

---

## 2. Current State vs Target State

### 2.1 What EXISTS Today (from codebase analysis)

#### Authentication & Users
- [x] Email/password authentication (Supabase Auth)
- [x] User profiles with university field (free text)
- [x] Multi-step onboarding wizard
- [x] Subscription tiers (free/pro/university)
- [ ] Instructor verification workflow
- [ ] Identity verification (IDV)
- [ ] Organization/B2B model

#### Course Creation (Instructors)
- [x] Syllabus upload (PDF/DOCX/text)
- [x] Automatic parsing via Edge Functions
- [x] Module and LO extraction
- [x] Teaching units generation
- [x] Content search and curation
- [x] Draft/Published status
- [x] Cost tracking (generation_cost_usd)
- [ ] $1 course creation paywall
- [ ] Formalized pipeline stages

#### Student Learning
- [x] Course enrollment
- [x] Progress tracking (overall_progress)
- [x] Video consumption tracking
- [x] Lecture slides with audio
- [x] Micro-checks (in-video quizzes)
- [x] Engagement scoring
- [x] Learning objective verification
- [ ] $1 enrollment fee
- [ ] Identity-tied completion records

#### Assessments
- [x] Question generation
- [x] Assessment sessions
- [x] Answer recording and scoring
- [x] Pass/fail determination
- [x] Basic cheat detection (tab focus)
- [ ] Proctored assessments
- [ ] Browser lockdown
- [ ] Webcam monitoring

#### Certificates
- [ ] Certificate issuance
- [ ] PDF generation
- [ ] QR code verification
- [ ] Public verification page
- [ ] Blockchain anchoring

#### Batch Processing
- [x] Google Batch API integration
- [x] batch_jobs table with status tracking
- [x] Slide generation batching
- [x] Content evaluation batching
- [ ] Demand-based triggers
- [ ] Enrollment threshold automation
- [ ] Periodic trigger checks

#### Admin Features
- [x] Admin dashboard
- [x] User management
- [x] Course management
- [x] Outcomes reporting
- [x] Branding settings
- [ ] Instructor review queue
- [ ] Organization management
- [ ] Seat-based licensing

### 2.2 Gap Summary

| Feature | Current | Target | Gap |
|---------|---------|--------|-----|
| Instructor Verification | None | .edu + manual review | **NEW** |
| Student IDV | None | Persona/Jumio | **NEW** |
| Certificates | None | 3 tiers ($0/$25/$49) | **NEW** |
| Proctoring | Basic tab detect | Full lockdown | **ENHANCE** |
| Organizations | None | B2B licensing | **NEW** |
| Employer API | None | Verification API | **NEW** |
| Progressive Gen | Manual | Demand-triggered | **ENHANCE** |
| Payment Gates | None | $1 create/enroll | **NEW** |

---

## 3. Section 1: Instructor Onboarding

### 3.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTRUCTOR ONBOARDING                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Instructor visits]                                             │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Provides     │                                               │
│  │ email        │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ◇ Is .edu domain? ◇────NO───▶ ◇ Alternative verification? ◇   │
│         │                              │                         │
│        YES                      ┌──────┴──────┐                 │
│         │                       │             │                  │
│         ▼                   Acceptable   Not acceptable          │
│  ┌──────────────┐               │             │                  │
│  │ Submit       │◀──────────────┘             ▼                  │
│  │ affiliation  │                      ╔════════════╗            │
│  │ details      │                      ║  REJECTED  ║            │
│  └──────┬───────┘                      ╚════════════╝            │
│         │                                    │                   │
│         ▼                                    ▼                   │
│  ◇ Manual review ◇                    ◇ Retry? ◇                │
│    │         │                         │      │                  │
│ Approved  Rejected                    YES    NO                  │
│    │         │                         │      │                  │
│    ▼         └─────────────────────────┘      ▼                  │
│ ╔════════════════════╗                    [EXIT]                 │
│ ║ INSTRUCTOR         ║                                           │
│ ║ VERIFIED           ║◀─────── [Invite code bypass]             │
│ ║ Trust Score: 100   ║                                           │
│ ╚════════════════════╝                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 New Database Tables

```sql
-- instructor_verifications: Track verification requests
CREATE TABLE instructor_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Verification method
    verification_method VARCHAR(20) NOT NULL, -- 'edu_domain', 'linkedin', 'manual', 'invite_code'

    -- Email verification
    email_domain VARCHAR(255),
    is_edu_domain BOOLEAN DEFAULT FALSE,

    -- Alternative verification
    linkedin_url TEXT,
    linkedin_verified BOOLEAN DEFAULT FALSE,
    institution_website_url TEXT,

    -- Affiliation details
    institution_name VARCHAR(255),
    department VARCHAR(255),
    title VARCHAR(100), -- Professor, Lecturer, TA, etc.

    -- Supporting documents
    document_urls TEXT[], -- Array of uploaded document URLs

    -- Review workflow
    status VARCHAR(20) DEFAULT 'pending', -- pending, under_review, approved, rejected
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_id UUID REFERENCES auth.users(id),
    reviewer_notes TEXT,
    rejection_reason TEXT,

    -- Trust scoring
    trust_score INTEGER DEFAULT 0, -- 0-100

    -- Invite code bypass
    invite_code_used VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Verification expiry

    CONSTRAINT valid_status CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'expired')),
    CONSTRAINT valid_method CHECK (verification_method IN ('edu_domain', 'linkedin', 'manual', 'invite_code'))
);

-- instructor_invite_codes: Pre-approved invite codes
CREATE TABLE instructor_invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id),

    -- Restrictions
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    institution_restriction VARCHAR(255), -- Optional: only for specific institution

    -- Validity
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
    is_instructor_verified BOOLEAN DEFAULT FALSE,
    instructor_verification_id UUID REFERENCES instructor_verifications(id),
    instructor_trust_score INTEGER DEFAULT 0,
    instructor_verified_at TIMESTAMP WITH TIME ZONE;
```

### 3.3 Screen Wireframes

#### 3.3.1 Screen: Instructor Signup / Email Entry

**Route:** `/instructor/signup`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                                    SyllabusStack        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    🎓 Become a Verified Instructor               │
│                                                                  │
│     Create courses and reach students with verified             │
│     credentials that employers trust.                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Email Address                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ professor@university.edu                            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           Continue with Email                       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ─────────────────── OR ───────────────────              │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  🔗 I have an invite code                           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│     Already have an account? Sign in                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `InstructorSignupEmail.tsx`

**State:**
```typescript
interface InstructorSignupState {
  email: string;
  isLoading: boolean;
  error: string | null;
  showInviteCodeInput: boolean;
  inviteCode: string;
}
```

**Actions:**
1. On email submit → Check if .edu domain
2. If .edu → Auto-verify email, proceed to affiliation
3. If not .edu → Show alternative verification options
4. If invite code → Validate code, bypass to verified

---

#### 3.3.2 Screen: Alternative Verification (Non-.edu)

**Route:** `/instructor/verify/alternative`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                                    SyllabusStack        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    📋 Alternative Verification                   │
│                                                                  │
│     Your email (john@gmail.com) is not from an educational      │
│     institution. Please provide alternative verification.       │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Option 1: LinkedIn Profile                               │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ https://linkedin.com/in/yourprofile                 │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ℹ️ Must show current educational institution role        │  │
│  │                                                           │  │
│  │  Option 2: Institution Website                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ https://university.edu/faculty/yourname             │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ℹ️ Faculty/staff directory page showing your name        │  │
│  │                                                           │  │
│  │  Option 3: Upload Documents                               │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  📄 Drop files here or click to upload              │  │  │
│  │  │     Employment letter, ID badge, contract           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Continue to Affiliation                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `InstructorAlternativeVerification.tsx`

---

#### 3.3.3 Screen: Affiliation Details

**Route:** `/instructor/verify/affiliation`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                                    SyllabusStack        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    🏫 Your Affiliation Details                   │
│                                                                  │
│     This information will appear on your courses and           │
│     student certificates.                                       │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Institution Name *                                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Stanford University                                 │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Department *                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Computer Science                                    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Title/Position *                                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ ▼ Select your role                                  │  │  │
│  │  ├─────────────────────────────────────────────────────┤  │  │
│  │  │   Professor                                         │  │  │
│  │  │   Associate Professor                               │  │  │
│  │  │   Assistant Professor                               │  │  │
│  │  │   Lecturer                                          │  │  │
│  │  │   Adjunct Faculty                                   │  │  │
│  │  │   Teaching Assistant                                │  │  │
│  │  │   Graduate Instructor                               │  │  │
│  │  │   Other                                             │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  [x] I confirm this information is accurate and I am     │  │
│  │      authorized to teach at this institution             │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Submit for Review                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `InstructorAffiliationForm.tsx`

---

#### 3.3.4 Screen: Verification Pending

**Route:** `/instructor/verify/pending`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Dashboard                               SyllabusStack        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ⏳                                       │
│                                                                  │
│                 Verification Under Review                        │
│                                                                  │
│     Your application has been submitted and is being            │
│     reviewed by our team. This typically takes 1-2              │
│     business days.                                              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Submitted: January 25, 2026 at 10:30 AM                 │  │
│  │  Status: Under Review                                     │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ ● Email verified                          ✓        │  │  │
│  │  │ ● Affiliation details provided            ✓        │  │  │
│  │  │ ○ Manual review                           ⏳       │  │  │
│  │  │ ○ Verification complete                   -        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  We'll email you at john@stanford.edu when your          │  │
│  │  verification is complete.                                │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         While you wait: Explore sample courses            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `InstructorVerificationPending.tsx`

---

#### 3.3.5 Screen: Verification Rejected

**Route:** `/instructor/verify/rejected`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Dashboard                               SyllabusStack        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ❌                                       │
│                                                                  │
│                 Verification Not Approved                        │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Reason:                                                  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ We could not verify your affiliation with the       │  │  │
│  │  │ institution. The LinkedIn profile provided does     │  │  │
│  │  │ not show a current educational role.                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  You can resubmit with additional documentation:          │  │
│  │  • Employment verification letter                         │  │
│  │  • Faculty ID badge photo                                 │  │
│  │  • Contract or offer letter                               │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Resubmit with More Documents                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Contact Support                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `InstructorVerificationRejected.tsx`

---

#### 3.3.6 Screen: Admin Review Queue

**Route:** `/admin/instructor-review`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │              Instructor Verification Queue           │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Dashboard│  ┌─────────────────────────────────────────────────┐ │
│          │  │ Pending (12)  Under Review (3)  Completed (156) │ │
│ Users    │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│ Courses  │  ┌─────────────────────────────────────────────────┐ │
│          │  │ Search by name, email, institution...          │ │
│ ▶Verify  │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│ Reports  │  ┌─────────────────────────────────────────────────┐ │
│          │  │ ┌─────┬──────────────┬────────────┬──────────┐ │ │
│ Settings │  │ │     │ Applicant    │ Institution│ Submitted│ │ │
│          │  │ ├─────┼──────────────┼────────────┼──────────┤ │ │
│          │  │ │ ○   │ John Smith   │ Stanford   │ 2h ago   │ │ │
│          │  │ │     │ john@gmail.. │ CS Dept    │          │ │ │
│          │  │ │     │ 🔗 LinkedIn  │ Professor  │ [Review] │ │ │
│          │  │ ├─────┼──────────────┼────────────┼──────────┤ │ │
│          │  │ │ ○   │ Jane Doe     │ MIT        │ 5h ago   │ │ │
│          │  │ │     │ jane@mit.edu │ Physics    │          │ │ │
│          │  │ │     │ ✓ .edu       │ Lecturer   │ [Review] │ │ │
│          │  │ ├─────┼──────────────┼────────────┼──────────┤ │ │
│          │  │ │ ○   │ Bob Wilson   │ UCLA       │ 1d ago   │ │ │
│          │  │ │     │ bob@ucla.edu │ Math       │          │ │ │
│          │  │ │     │ ✓ .edu 📄 2  │ TA         │ [Review] │ │ │
│          │  │ └─────┴──────────────┴────────────┴──────────┘ │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│          │  ◀ 1 2 3 ... 12 ▶                                   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Component:** `AdminInstructorReviewQueue.tsx`

---

#### 3.3.7 Screen: Admin Review Detail

**Route:** `/admin/instructor-review/:id`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Queue                    Review: John Smith          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────┐  ┌───────────────────────────┐ │
│  │ Applicant Info              │  │ Verification Evidence     │ │
│  │                             │  │                           │ │
│  │ Name: John Smith            │  │ Method: LinkedIn + Manual │ │
│  │ Email: john@gmail.com       │  │                           │ │
│  │ Submitted: Jan 25, 2026     │  │ LinkedIn:                 │ │
│  │                             │  │ ┌───────────────────────┐ │ │
│  │ Institution: Stanford       │  │ │ linkedin.com/in/john  │ │ │
│  │ Department: Computer Science│  │ │ [Open in new tab ↗]   │ │ │
│  │ Title: Professor            │  │ └───────────────────────┘ │ │
│  │                             │  │                           │ │
│  └─────────────────────────────┘  │ Uploaded Documents:       │ │
│                                   │ • employment_letter.pdf   │ │
│  ┌─────────────────────────────┐  │   [View]                  │ │
│  │ Verification Checklist      │  │ • faculty_id.jpg          │ │
│  │                             │  │   [View]                  │ │
│  │ [ ] LinkedIn shows current  │  │                           │ │
│  │     educational role        │  └───────────────────────────┘ │
│  │ [ ] Institution matches     │                                │
│  │     claimed affiliation     │  ┌───────────────────────────┐ │
│  │ [ ] Title/position valid    │  │ Review Notes              │ │
│  │ [ ] Documents authentic     │  │ ┌───────────────────────┐ │ │
│  │                             │  │ │ LinkedIn verified,     │ │
│  └─────────────────────────────┘  │ │ shows Stanford prof... │ │
│                                   │ └───────────────────────┘ │ │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │  Trust Score: [====●==========] 70                          ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │  ✓ Approve  │  │  ✗ Reject   │  │ Request More Info   │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `AdminInstructorReviewDetail.tsx`

---

### 3.4 API Endpoints

#### POST `/functions/v1/verify-instructor-email`
```typescript
// Request
{
  email: string;
}

// Response
{
  is_edu_domain: boolean;
  domain: string;
  next_step: 'affiliation' | 'alternative_verification';
  verification_id: string;
}
```

#### POST `/functions/v1/submit-instructor-verification`
```typescript
// Request
{
  verification_id: string;
  email: string;
  verification_method: 'edu_domain' | 'linkedin' | 'manual';
  linkedin_url?: string;
  institution_website_url?: string;
  document_urls?: string[];
  institution_name: string;
  department: string;
  title: string;
}

// Response
{
  success: boolean;
  status: 'pending' | 'auto_approved';
  verification_id: string;
  estimated_review_time?: string;
}
```

#### POST `/functions/v1/review-instructor-verification`
```typescript
// Request (Admin only)
{
  verification_id: string;
  decision: 'approve' | 'reject' | 'request_more_info';
  trust_score?: number; // 0-100
  reviewer_notes?: string;
  rejection_reason?: string;
}

// Response
{
  success: boolean;
  verification: InstructorVerification;
  notification_sent: boolean;
}
```

#### POST `/functions/v1/use-instructor-invite-code`
```typescript
// Request
{
  code: string;
  user_id: string;
}

// Response
{
  success: boolean;
  error?: string;
  verification_id?: string;
}
```

---

### 3.5 Component Specifications

#### `InstructorVerificationBadge.tsx`
Shows verification status on instructor profiles and courses.

```typescript
interface InstructorVerificationBadgeProps {
  isVerified: boolean;
  trustScore?: number;
  institutionName?: string;
  showDetails?: boolean;
}

// Renders:
// ✓ Verified Instructor - Stanford University
// or
// ⏳ Verification Pending
// or
// (nothing if not an instructor)
```

#### `useInstructorVerification.ts`
Hook for managing verification state.

```typescript
interface UseInstructorVerificationReturn {
  verification: InstructorVerification | null;
  isLoading: boolean;
  isVerified: boolean;
  isPending: boolean;
  isRejected: boolean;
  submitVerification: (data: VerificationSubmission) => Promise<void>;
  checkStatus: () => Promise<void>;
}
```

---

### 3.6 Implementation Notes

1. **Auto-approval for .edu**: If email domain ends in `.edu`, skip manual review and auto-approve with trust score 80.

2. **LinkedIn Verification**: Use LinkedIn profile scraping or ask user to screenshot their profile showing current position.

3. **Trust Score Calculation**:
   - .edu email: +40 points
   - LinkedIn verified: +20 points
   - Documents provided: +20 points
   - Manual review approval: +20 points
   - Maximum: 100 points

4. **Invite Code Use Cases**:
   - Partner institutions
   - Conference speakers
   - Early adopters
   - Support escalations

5. **Verification Expiry**: Verifications expire after 2 years, requiring re-verification.

---

## 4. Section 2: Institutional Licensing

### 4.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTITUTIONAL LICENSING                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [University/Employer Inquiry]                                   │
│              │                                                   │
│              ▼                                                   │
│       ◇ License tier? ◇                                         │
│        │      │      │                                          │
│     Basic    Pro   Enterprise                                   │
│        │      │      │                                          │
│        ▼      ▼      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ BASIC         │ PRO            │ ENTERPRISE                 ││
│  │ $5K/year      │ $15K/year      │ $50K/year                  ││
│  │               │                │                            ││
│  │ • Unlimited   │ • All Basic +  │ • All Pro +                ││
│  │   instructor  │ • SSO          │ • LMS integration          ││
│  │   seats       │ • Cohort mgmt  │   (LTI)                    ││
│  │ • Basic       │ • Governance   │ • API access               ││
│  │   analytics   │   controls     │ • Dedicated support        ││
│  │ • Standard    │ • Custom       │ • Custom reporting         ││
│  │   support     │   branding     │                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 New Database Tables

```sql
-- organizations: B2B customer entities
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE, -- For custom URLs: syllabusstack.com/org/stanford
    type VARCHAR(20) NOT NULL, -- 'university', 'employer', 'training_provider'
    logo_url TEXT,
    website_url TEXT,

    -- License details
    license_tier VARCHAR(20) NOT NULL DEFAULT 'basic', -- 'basic', 'pro', 'enterprise'
    license_start_date DATE,
    license_end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Seat management
    seat_limit INTEGER, -- NULL = unlimited
    seats_used INTEGER DEFAULT 0,

    -- Features (JSON for flexibility)
    features JSONB DEFAULT '{}',
    -- Example: { "sso_enabled": true, "lti_enabled": false, "api_access": false }

    -- SSO Configuration (Pro+)
    sso_enabled BOOLEAN DEFAULT FALSE,
    sso_provider VARCHAR(50), -- 'saml', 'oidc', 'google_workspace', 'azure_ad'
    sso_config JSONB, -- Provider-specific configuration
    sso_domain VARCHAR(255), -- e.g., 'stanford.edu' for email matching

    -- LTI Configuration (Enterprise)
    lti_enabled BOOLEAN DEFAULT FALSE,
    lti_client_id VARCHAR(255),
    lti_deployment_id VARCHAR(255),
    lti_platform_url TEXT,
    lti_jwks_url TEXT,

    -- Branding (Pro+)
    custom_branding JSONB DEFAULT '{}',
    -- Example: { "primary_color": "#8C1515", "logo_url": "...", "favicon_url": "..." }
    custom_domain VARCHAR(255), -- e.g., learn.stanford.edu

    -- Billing
    stripe_customer_id VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,

    -- Contacts
    primary_contact_user_id UUID REFERENCES auth.users(id),
    admin_emails TEXT[],

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_type CHECK (type IN ('university', 'employer', 'training_provider')),
    CONSTRAINT valid_tier CHECK (license_tier IN ('basic', 'pro', 'enterprise'))
);

-- organization_members: Link users to organizations
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role within organization
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'instructor', 'student', 'member'

    -- Invitation tracking
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    invitation_email VARCHAR(255),
    invitation_token VARCHAR(100),
    invitation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'revoked'

    -- Membership status
    joined_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    deactivated_at TIMESTAMP WITH TIME ZONE,
    deactivated_by UUID REFERENCES auth.users(id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, user_id),
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'instructor', 'student', 'member')),
    CONSTRAINT valid_invitation_status CHECK (invitation_status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- organization_invitations: Track pending invitations
CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    token VARCHAR(100) UNIQUE NOT NULL,

    invited_by UUID NOT NULL REFERENCES auth.users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),

    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID REFERENCES auth.users(id),

    status VARCHAR(20) DEFAULT 'pending',

    CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- Add organization_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
    organization_id UUID REFERENCES organizations(id),
    organization_role VARCHAR(20);
```

### 4.3 Screen Wireframes

#### 4.3.1 Screen: Organization Setup Wizard

**Route:** `/organization/setup`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1 of 4: Organization Details                              │
│  [====○─────────────────────────────]                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Organization Name *                                      │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Stanford University                                 │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Organization Type *                                      │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ ○ University / College                              │  │  │
│  │  │ ○ Employer / Corporation                            │  │  │
│  │  │ ○ Training Provider                                 │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Organization Website                                     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ https://stanford.edu                                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Organization Logo                                        │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  📷 Drop image here or click to upload              │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                              ┌──────────────────────────────┐   │
│                              │          Next →              │   │
│                              └──────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3.2 Screen: License Tier Selection

**Route:** `/organization/setup/tier`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 2 of 4: Choose Your Plan                                  │
│  [========○─────────────────────]                               │
│                                                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │     BASIC       │ │      PRO        │ │   ENTERPRISE    │   │
│  │                 │ │   POPULAR       │ │                 │   │
│  │   $5,000/yr     │ │   $15,000/yr    │ │   $50,000/yr    │   │
│  │                 │ │                 │ │                 │   │
│  │ ✓ Unlimited     │ │ Everything in   │ │ Everything in   │   │
│  │   instructor    │ │ Basic, plus:    │ │ Pro, plus:      │   │
│  │   seats         │ │                 │ │                 │   │
│  │                 │ │ ✓ SSO (SAML/    │ │ ✓ LMS/LTI       │   │
│  │ ✓ Basic         │ │   OIDC)         │ │   integration   │   │
│  │   analytics     │ │                 │ │                 │   │
│  │   dashboard     │ │ ✓ Cohort        │ │ ✓ Full API      │   │
│  │                 │ │   management    │ │   access        │   │
│  │ ✓ Standard      │ │                 │ │                 │   │
│  │   email         │ │ ✓ Governance    │ │ ✓ Dedicated     │   │
│  │   support       │ │   controls      │ │   support       │   │
│  │                 │ │                 │ │                 │   │
│  │ ✓ Course        │ │ ✓ Custom        │ │ ✓ Custom        │   │
│  │   creation      │ │   branding      │ │   reporting     │   │
│  │                 │ │                 │ │                 │   │
│  │ ✓ Certificates  │ │ ✓ Priority      │ │ ✓ White-label   │   │
│  │   included      │ │   support       │ │   option        │   │
│  │                 │ │                 │ │                 │   │
│  │ [Select Basic]  │ │ [Select Pro]    │ │ [Contact Sales] │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                  │
│  Need a custom plan? Contact our sales team                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Screen: Organization Admin Dashboard

**Route:** `/organization/dashboard`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │         Stanford University Dashboard                │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Overview │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│          │  │   127    │ │    34    │ │    89    │ │   78%    ││
│ Members  │  │ Members  │ │ Courses  │ │  Active  │ │Completion││
│          │  │          │ │          │ │ Learners │ │  Rate    ││
│ Courses  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│          │                                                      │
│ Analytics│  ┌─────────────────────────────────────────────────┐ │
│          │  │ License Status                        PRO TIER │ │
│ Settings │  │                                                 │ │
│          │  │ Valid until: Dec 31, 2026                       │ │
│ ▶SSO     │  │ Seats: 127 / Unlimited                          │ │
│          │  │ Features: SSO ✓  LTI ✗  API ✗                   │ │
│ ▶LTI     │  │                                                 │ │
│          │  │ [Upgrade to Enterprise]  [Manage Billing]       │ │
│ Branding │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│          │  ┌─────────────────────────────────────────────────┐ │
│          │  │ Recent Activity                                 │ │
│          │  │                                                 │ │
│          │  │ • John Smith enrolled in CS101      2 hours ago │ │
│          │  │ • Jane Doe completed ML Basics      5 hours ago │ │
│          │  │ • New course: Data Structures       yesterday   │ │
│          │  │ • 12 certificates issued            this week   │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

#### 4.3.4 Screen: Member Management

**Route:** `/organization/members`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │              Organization Members                    │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Overview │  ┌──────────────────────────────┐ ┌───────────────┐ │
│          │  │ Search members...            │ │ + Invite      │ │
│ ▶Members │  └──────────────────────────────┘ └───────────────┘ │
│          │                                                      │
│ Courses  │  ┌─────────────────────────────────────────────────┐ │
│          │  │ All (127)  Admins (5)  Instructors (22)         │ │
│ Analytics│  │ Students (100)  Pending (8)                     │ │
│          │  └─────────────────────────────────────────────────┘ │
│ Settings │                                                      │
│          │  ┌─────────────────────────────────────────────────┐ │
│          │  │ ┌─────┬────────────────┬──────────┬───────────┐ │ │
│          │  │ │ ☑   │ Name           │ Role     │ Status    │ │ │
│          │  │ ├─────┼────────────────┼──────────┼───────────┤ │ │
│          │  │ │ ☐   │ John Smith     │ Admin    │ Active    │ │ │
│          │  │ │     │ john@stanford..│          │ Joined 3mo│ │ │
│          │  │ ├─────┼────────────────┼──────────┼───────────┤ │ │
│          │  │ │ ☐   │ Jane Doe       │Instructor│ Active    │ │ │
│          │  │ │     │ jane@stanford..│ 5 courses│ Joined 1yr│ │ │
│          │  │ ├─────┼────────────────┼──────────┼───────────┤ │ │
│          │  │ │ ☐   │ Bob Wilson     │ Student  │ Active    │ │ │
│          │  │ │     │ bob@stanford.. │ 3 enrolled│Joined 2mo│ │ │
│          │  │ ├─────┼────────────────┼──────────┼───────────┤ │ │
│          │  │ │ ☐   │ alice@stanf..  │ Student  │ Pending   │ │ │
│          │  │ │     │ Invited 2d ago │          │ [Resend]  │ │ │
│          │  │ └─────┴────────────────┴──────────┴───────────┘ │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│          │  With selected: [Change Role ▼] [Remove] [Export]   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

#### 4.3.5 Screen: Invite Members Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                     Invite Team Members                    ✕    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Email Addresses (one per line or comma-separated)              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ alice@stanford.edu                                        │  │
│  │ bob@stanford.edu                                          │  │
│  │ charlie@stanford.edu                                      │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Role                                                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ▼ Student                                                 │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │   Admin - Full organization access                        │  │
│  │   Instructor - Create and manage courses                  │  │
│  │   Student - Enroll in courses (default)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [x] Auto-approve users with @stanford.edu emails          │  │
│  │ [ ] Require admin approval for all new members            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Send 3 Invitations                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 API Endpoints

#### POST `/functions/v1/create-organization`
```typescript
// Request
{
  name: string;
  type: 'university' | 'employer' | 'training_provider';
  website_url?: string;
  logo_url?: string;
  license_tier: 'basic' | 'pro' | 'enterprise';
  billing_email: string;
}

// Response
{
  organization: Organization;
  checkout_url: string; // Stripe checkout for license
}
```

#### POST `/functions/v1/invite-organization-members`
```typescript
// Request
{
  organization_id: string;
  emails: string[];
  role: 'admin' | 'instructor' | 'student';
  auto_approve_domain?: string;
}

// Response
{
  invitations_sent: number;
  failed_emails: string[];
}
```

#### POST `/functions/v1/configure-organization-sso`
```typescript
// Request (Pro+ only)
{
  organization_id: string;
  provider: 'saml' | 'oidc' | 'google_workspace' | 'azure_ad';
  config: {
    // SAML
    idp_entity_id?: string;
    idp_sso_url?: string;
    idp_certificate?: string;
    // OIDC
    client_id?: string;
    client_secret?: string;
    issuer_url?: string;
  };
  domain: string; // Email domain for auto-matching
}

// Response
{
  success: boolean;
  sso_login_url: string;
  metadata_url?: string; // For SAML SP metadata
}
```

---

## 5. Section 3: Employer Access

### 5.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       EMPLOYER ACCESS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Employer Inquiry]                                              │
│         │                                                        │
│         ▼                                                        │
│  ◇ Product? ◇                                                   │
│   │     │     │                                                 │
│  API  Training  Recruiting                                      │
│   │     │     │                                                 │
│   ▼     ▼     ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ SKILL VERIFICATION  │ BULK TRAINING    │ RECRUITING PORTAL  ││
│  │ API - $2K/year      │ Custom pricing   │ $500/seat/year     ││
│  │                     │                  │                    ││
│  │ • Query: Did person │ • Enroll         │ • Browse verified  ││
│  │   X complete course │   employees in   │   completers       ││
│  │   Y?                │   courses        │                    ││
│  │                     │                  │ • Filter by        ││
│  │ • Returns: verified │ • Progress       │   skill/course     ││
│  │   completion data   │   dashboards     │                    ││
│  │                     │                  │ • Contact          ││
│  │ • Webhook for new   │ • Completion     │   candidates       ││
│  │   completions       │   reports        │                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 New Database Tables

```sql
-- employer_accounts: Employer organizations
CREATE TABLE employer_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id), -- Link to main org table

    -- Company info
    company_name VARCHAR(255) NOT NULL,
    company_website TEXT,
    company_logo_url TEXT,
    industry VARCHAR(100),
    company_size VARCHAR(50), -- '1-50', '51-200', '201-1000', '1000+'

    -- Products subscribed
    has_verification_api BOOLEAN DEFAULT FALSE,
    has_bulk_training BOOLEAN DEFAULT FALSE,
    has_recruiting_portal BOOLEAN DEFAULT FALSE,

    -- Billing
    stripe_customer_id VARCHAR(255),
    billing_email VARCHAR(255),

    -- Contacts
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- employer_api_keys: API access credentials
CREATE TABLE employer_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,

    -- Key details
    name VARCHAR(100) NOT NULL, -- "Production", "Testing", etc.
    key_prefix VARCHAR(10) NOT NULL, -- First 8 chars for identification
    key_hash VARCHAR(255) NOT NULL, -- Hashed full key

    -- Permissions
    scopes TEXT[] DEFAULT ARRAY['verify:read'], -- 'verify:read', 'verify:webhook', 'training:read', 'training:write'

    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,

    -- Usage tracking
    total_requests INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- employer_api_requests: Audit log of API calls
CREATE TABLE employer_api_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES employer_api_keys(id),

    -- Request details
    endpoint VARCHAR(100) NOT NULL, -- '/verify', '/completions', etc.
    method VARCHAR(10) NOT NULL,
    request_body JSONB,

    -- Query parameters (for verification)
    queried_email VARCHAR(255),
    queried_certificate_id VARCHAR(50),
    queried_course_id UUID,

    -- Response
    response_status INTEGER,
    response_body JSONB,

    -- Result (for verification requests)
    verification_result VARCHAR(20), -- 'verified', 'not_found', 'invalid'
    certificate_id UUID REFERENCES certificates(id),

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    response_time_ms INTEGER,

    -- Timestamp
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- employer_webhooks: Webhook configurations
CREATE TABLE employer_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,

    -- Webhook config
    url TEXT NOT NULL,
    secret VARCHAR(255) NOT NULL, -- For HMAC signature
    events TEXT[] NOT NULL, -- ['certificate.issued', 'course.completed']

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Delivery tracking
    last_delivery_at TIMESTAMP WITH TIME ZONE,
    last_delivery_status INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    disabled_at TIMESTAMP WITH TIME ZONE, -- Auto-disabled after failures

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- employer_recruiting_searches: Saved candidate searches
CREATE TABLE employer_recruiting_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,

    -- Search criteria
    name VARCHAR(100),
    filters JSONB NOT NULL,
    -- Example: { "courses": ["uuid1", "uuid2"], "min_score": 80, "location": "CA" }

    -- Notification preferences
    notify_new_matches BOOLEAN DEFAULT FALSE,
    notification_email VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_run_at TIMESTAMP WITH TIME ZONE
);

-- employer_candidate_contacts: Track candidate outreach
CREATE TABLE employer_candidate_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_account_id UUID NOT NULL REFERENCES employer_accounts(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Contact record
    contacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contact_method VARCHAR(50), -- 'email', 'platform_message'
    message_preview TEXT,

    -- User response
    user_responded BOOLEAN DEFAULT FALSE,
    user_response_at TIMESTAMP WITH TIME ZONE,
    user_interested BOOLEAN,

    -- Tracking
    contacted_by UUID REFERENCES auth.users(id)
);
```

### 5.3 Screen Wireframes

#### 5.3.1 Screen: Employer Portal Dashboard

**Route:** `/employer/dashboard`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │              Acme Corp - Employer Portal             │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Overview │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│          │  │   1,247  │ │    89    │ │    12    │ │    3     ││
│ ▶API     │  │ API Calls│ │Candidates│ │ Contacts │ │ Hires    ││
│          │  │this month│ │ matched  │ │ this mo  │ │ this yr  ││
│ Training │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│          │                                                      │
│ Recruit  │  ┌─────────────────────────────────────────────────┐ │
│          │  │ Your Products                                   │ │
│ Settings │  │                                                 │ │
│          │  │ ✓ Skill Verification API     $2,000/year       │ │
│          │  │   Next renewal: Dec 31, 2026                    │ │
│          │  │   [Manage Keys] [View Docs]                     │ │
│          │  │                                                 │ │
│          │  │ ✓ Recruiting Portal          $500/seat × 3     │ │
│          │  │   3 recruiter seats active                      │ │
│          │  │   [Manage Seats] [Browse Candidates]            │ │
│          │  │                                                 │ │
│          │  │ ○ Bulk Training              Contact Sales      │ │
│          │  │   Train your workforce                          │ │
│          │  │   [Learn More]                                  │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

#### 5.3.2 Screen: API Key Management

**Route:** `/employer/api/keys`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │              API Key Management                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Overview │  ┌─────────────────────────────────────────────────┐ │
│          │  │ Your API Keys                    [+ Create Key] │ │
│ ▶API     │  │                                                 │ │
│  ▶Keys   │  │ ┌───────────────────────────────────────────┐   │ │
│  Docs    │  │ │ Production                                │   │ │
│  Usage   │  │ │ sk_live_8x7y...  Created: Jan 1, 2026    │   │ │
│  Webhooks│  │ │                                           │   │ │
│          │  │ │ Scopes: verify:read, verify:webhook       │   │ │
│ Training │  │ │ Rate limit: 60/min, 10,000/day            │   │ │
│          │  │ │ Last used: 2 minutes ago                  │   │ │
│ Recruit  │  │ │                                           │   │ │
│          │  │ │ [Rotate] [Edit Scopes] [Revoke]           │   │ │
│          │  │ └───────────────────────────────────────────┘   │ │
│          │  │                                                 │ │
│          │  │ ┌───────────────────────────────────────────┐   │ │
│          │  │ │ Testing                                   │   │ │
│          │  │ │ sk_test_4a2b...  Created: Jan 15, 2026   │   │ │
│          │  │ │                                           │   │ │
│          │  │ │ Scopes: verify:read                       │   │ │
│          │  │ │ Rate limit: 10/min, 100/day               │   │ │
│          │  │ │ Last used: 3 days ago                     │   │ │
│          │  │ │                                           │   │ │
│          │  │ │ [Rotate] [Edit Scopes] [Revoke]           │   │ │
│          │  │ └───────────────────────────────────────────┘   │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

#### 5.3.3 Screen: API Documentation

**Route:** `/employer/api/docs`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │              API Documentation                       │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Overview │  Skill Verification API v1                           │
│          │  ══════════════════════                              │
│ ▶API     │                                                      │
│  Keys    │  Base URL: https://api.syllabusstack.com/v1          │
│  ▶Docs   │                                                      │
│  Usage   │  Authentication                                      │
│  Webhooks│  ────────────────                                    │
│          │  Include your API key in the Authorization header:   │
│          │                                                      │
│          │  ┌─────────────────────────────────────────────────┐ │
│          │  │ Authorization: Bearer sk_live_your_key_here     │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│          │  Endpoints                                           │
│          │  ─────────                                           │
│          │                                                      │
│          │  POST /verify/certificate                            │
│          │  Verify a certificate by ID or user email            │
│          │                                                      │
│          │  Request:                                            │
│          │  ┌─────────────────────────────────────────────────┐ │
│          │  │ {                                               │ │
│          │  │   "certificate_id": "CERT-2026-ABC123"          │ │
│          │  │   // OR                                         │ │
│          │  │   "email": "student@example.com",               │ │
│          │  │   "course_id": "uuid-of-course"                 │ │
│          │  │ }                                                │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│          │  Response (200 OK):                                  │
│          │  ┌─────────────────────────────────────────────────┐ │
│          │  │ {                                               │ │
│          │  │   "verified": true,                             │ │
│          │  │   "certificate": {                              │ │
│          │  │     "id": "CERT-2026-ABC123",                   │ │
│          │  │     "holder_name": "John Smith",                │ │
│          │  │     "course_title": "Machine Learning",         │ │
│          │  │     "instructor": "Dr. Jane Doe",               │ │
│          │  │     "institution": "Stanford University",       │ │
│          │  │     "issued_at": "2026-01-15T10:30:00Z",        │ │
│          │  │     "certificate_type": "assessed",             │ │
│          │  │     "mastery_score": 92,                        │ │
│          │  │     "identity_verified": true                   │ │
│          │  │   }                                              │ │
│          │  │ }                                                │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

#### 5.3.4 Screen: Recruiting - Candidate Search

**Route:** `/employer/recruiting`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │              Find Verified Candidates                │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Overview │  ┌─────────────────────────────────────────────────┐ │
│          │  │ Filters                                         │ │
│ API      │  │                                                 │ │
│          │  │ Courses/Skills        Minimum Score             │ │
│ Training │  │ ┌─────────────────┐   ┌─────────────────┐       │ │
│          │  │ │ Machine Learning│   │ 80% ▼           │       │ │
│ ▶Recruit │  │ │ Data Science    │   └─────────────────┘       │ │
│  ▶Search │  │ │ + Add more      │                             │ │
│  Saved   │  │ └─────────────────┘   Certificate Type          │ │
│  Contacts│  │                       ┌─────────────────┐       │ │
│          │  │ Institution           │ ☑ Assessed      │       │ │
│          │  │ ┌─────────────────┐   │ ☑ Verified      │       │ │
│          │  │ │ Any ▼           │   │ ☐ Completion    │       │ │
│          │  │ └─────────────────┘   └─────────────────┘       │ │
│          │  │                                                 │ │
│          │  │ [Search]  [Save Search]  [Clear]                │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│          │  89 candidates found                                 │
│          │                                                      │
│          │  ┌─────────────────────────────────────────────────┐ │
│          │  │ ┌─────────────────────────────────────────────┐ │ │
│          │  │ │ 👤 John S.              Stanford University │ │ │
│          │  │ │                                             │ │ │
│          │  │ │ ✓ Machine Learning       Score: 94%        │ │ │
│          │  │ │ ✓ Data Science           Score: 88%        │ │ │
│          │  │ │ ✓ Python Programming     Score: 91%        │ │ │
│          │  │ │                                             │ │ │
│          │  │ │ Identity Verified: ✓    Certificates: 3    │ │ │
│          │  │ │                                             │ │ │
│          │  │ │ [View Profile]  [Contact]  [Save]           │ │ │
│          │  │ └─────────────────────────────────────────────┘ │ │
│          │  │                                                 │ │
│          │  │ ┌─────────────────────────────────────────────┐ │ │
│          │  │ │ 👤 Jane D.              MIT                 │ │ │
│          │  │ │ ...                                         │ │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 5.4 API Endpoints (Public Employer API)

#### POST `/api/v1/verify/certificate`
```typescript
// Request
{
  certificate_id?: string;  // "CERT-2026-ABC123"
  email?: string;           // Student email
  course_id?: string;       // Course UUID (required with email)
}

// Response (200)
{
  verified: true,
  certificate: {
    id: string;
    holder_name: string;
    course_title: string;
    course_id: string;
    instructor_name: string;
    institution_name: string;
    issued_at: string;
    certificate_type: 'completion_badge' | 'verified' | 'assessed';
    mastery_score?: number;  // For assessed certs
    identity_verified: boolean;
    skills: string[];
  }
}

// Response (404)
{
  verified: false,
  error: "certificate_not_found"
}
```

#### GET `/api/v1/completions`
```typescript
// Query params
{
  course_id?: string;
  since?: string;  // ISO date
  page?: number;
  limit?: number;  // max 100
}

// Response
{
  completions: [{
    user_id: string;  // Anonymized unless user consented
    email?: string;   // Only if user enabled sharing
    course_id: string;
    course_title: string;
    completed_at: string;
    certificate_id?: string;
    score?: number;
  }],
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  }
}
```

#### POST `/api/v1/webhooks/configure`
```typescript
// Request
{
  url: string;
  events: ('certificate.issued' | 'course.completed')[];
}

// Response
{
  webhook_id: string;
  secret: string;  // For signature verification
  status: 'active';
}
```

### 5.5 Webhook Payload Examples

#### certificate.issued
```json
{
  "event": "certificate.issued",
  "timestamp": "2026-01-25T10:30:00Z",
  "data": {
    "certificate_id": "CERT-2026-ABC123",
    "user_email": "student@example.com",
    "course_id": "uuid",
    "course_title": "Machine Learning Fundamentals",
    "certificate_type": "assessed",
    "mastery_score": 92,
    "issued_at": "2026-01-25T10:30:00Z"
  }
}
```

---

## 6. Section 4: Course Creation Pipeline

### 6.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    COURSE CREATION PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Instructor creates course]                                     │
│              │                                                   │
│              ▼                                                   │
│       ◇ Pay $1? ◇──NO──▶ [EXIT]                                 │
│              │                                                   │
│             YES                                                  │
│              │                                                   │
│              ▼                                                   │
│  ┌─────────────────────────┐                                    │
│  │ Upload syllabus         │                                    │
│  │ PDF, DOCX, or paste text│                                    │
│  └───────────┬─────────────┘                                    │
│              │                                                   │
│              ▼                                                   │
│  ╔═════════════════════════════════════════╗                    │
│  ║ STAGE 2: Syllabus Processing            ║                    │
│  ║ • Extract text via Edge Function        ║                    │
│  ║ • Generate domain_config                ║                    │
│  ║ • Identify modules                      ║                    │
│  ║ • Extract learning objectives           ║                    │
│  ║ Cost: $0.30                             ║                    │
│  ╚═══════════════════╤═════════════════════╝                    │
│                      │                                           │
│                      ▼                                           │
│           ◇ Parse successful? ◇                                 │
│            │                │                                    │
│           NO               YES                                   │
│            │                │                                    │
│            ▼                ▼                                    │
│  ┌─────────────────┐ ╔═════════════════════════════════════════╗│
│  │ Parsing failed  │ ║ STAGE 3: Curriculum Decomposition       ║│
│  │ Manual interv.  │ ║ • LO → Teaching Units (5 per LO)        ║│
│  │ [Retry Upload]  │ ║ • Add pedagogy metadata                 ║│
│  └─────────────────┘ ║ • Generate search queries               ║│
│                      ║ • Identify prerequisites                ║│
│                      ║ • Flag misconceptions                   ║│
│                      ║ Cost: $0.30                             ║│
│                      ╚═══════════════════╤═════════════════════╝│
│                                          │                       │
│                                          ▼                       │
│                      ╔═════════════════════════════════════════╗│
│                      ║ STAGE 4: Basic Discovery                ║│
│                      ║ • Search for top 3-5 videos per unit    ║│
│                      ║ • Rule-based filtering only             ║│
│                      ║ • NO deep AI evaluation yet             ║│
│                      ║ Cost: $0.15                             ║│
│                      ╚═══════════════════╤═════════════════════╝│
│                                          │                       │
│                                          ▼                       │
│                      ╔═════════════════════════════════════════╗│
│                      ║ ✓ COURSE SHELL CREATED                  ║│
│                      ║ Status: DRAFT                           ║│
│                      ║ Total Cost: $0.60                       ║│
│                      ║ Ready for publishing                    ║│
│                      ╚═══════════════════╤═════════════════════╝│
│                                          │                       │
│                                          ▼                       │
│                            ◇ Instructor publishes? ◇            │
│                             │                  │                 │
│                          Not yet              YES                │
│                             │                  │                 │
│                             ▼                  ▼                 │
│                      [Review & edit]    ╔════════════════════╗  │
│                             │           ║ ✓ COURSE LIVE      ║  │
│                             └──────────▶║ is_published = true║  │
│                                         ║ Enrollment enabled ║  │
│                                         ╚════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Current State Analysis

The course creation pipeline is **mostly implemented**. Key existing components:

| Component | Status | Location |
|-----------|--------|----------|
| Syllabus upload UI | ✅ | `QuickCourseSetup.tsx` |
| PDF/DOCX parsing | ✅ | `parse-syllabus-document` Edge Function |
| Module extraction | ✅ | `process-syllabus` Edge Function |
| LO extraction | ✅ | `extract-learning-objectives` Edge Function |
| Teaching units | ✅ | `teaching_units` table |
| Content search | ✅ | `search-youtube-content` Edge Function |
| Draft/Published | ✅ | `instructor_courses.is_published` |
| Cost tracking | ✅ | `generation_cost_usd` field |
| **$1 paywall** | ❌ | **NOT IMPLEMENTED** |
| **Stage state machine** | ⚠️ | Implicit, not explicit |

### 6.3 Changes Required

#### 6.3.1 Database Changes

```sql
-- Add payment tracking to instructor_courses
ALTER TABLE instructor_courses ADD COLUMN IF NOT EXISTS
    creation_fee_paid BOOLEAN DEFAULT FALSE,
    creation_fee_amount DECIMAL(10,2) DEFAULT 1.00,
    creation_fee_payment_id VARCHAR(255),
    creation_fee_paid_at TIMESTAMP WITH TIME ZONE,

    -- Explicit pipeline stage tracking
    pipeline_stage VARCHAR(30) DEFAULT 'pending_payment',
    -- Values: 'pending_payment', 'uploading', 'parsing', 'decomposing',
    --         'discovering', 'ready_draft', 'published', 'failed'

    pipeline_stage_updated_at TIMESTAMP WITH TIME ZONE,
    pipeline_error TEXT,
    pipeline_retry_count INTEGER DEFAULT 0;

-- Course creation cost breakdown
CREATE TABLE course_creation_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_course_id UUID NOT NULL REFERENCES instructor_courses(id) ON DELETE CASCADE,

    stage VARCHAR(30) NOT NULL, -- 'parsing', 'decomposition', 'discovery'
    cost_usd DECIMAL(10,4) NOT NULL,
    tokens_used INTEGER,
    model_used VARCHAR(100),

    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 6.3.2 Screen: Course Creation Payment Gate

**Route:** `/instructor/courses/create`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                                    SyllabusStack        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    🎓 Create a New Course                        │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Course creation uses AI to:                              │  │
│  │                                                           │  │
│  │  ✓ Parse your syllabus and extract structure              │  │
│  │  ✓ Identify learning objectives automatically             │  │
│  │  ✓ Generate teaching strategies for each topic            │  │
│  │  ✓ Find relevant educational videos                       │  │
│  │                                                           │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  Cost breakdown:                                          │  │
│  │  • Syllabus parsing:        $0.30                         │  │
│  │  • Curriculum decomposition: $0.30                        │  │
│  │  • Content discovery:        $0.15                        │  │
│  │                             ──────                        │  │
│  │  Total AI cost:             $0.75                         │  │
│  │                                                           │  │
│  │  Your price:                $1.00                         │  │
│  │  (includes platform fee)                                  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              💳 Pay $1 to Create Course                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🎟️ I have a promo code                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│     Free tier users: 1 free course creation per month           │
│     Pro users: Unlimited course creations                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `CourseCreationPaymentGate.tsx`

#### 6.3.3 Screen: Course Creation Progress

**Route:** `/instructor/courses/create/:id/progress`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    Creating Your Course                          │
│                                                                  │
│  Course: Introduction to Machine Learning                        │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ● Stage 1: Payment             ✓ Complete      $1.00    │  │
│  │  ────────────────────────────────────────────────────────│  │
│  │                                                           │  │
│  │  ● Stage 2: Syllabus Processing ✓ Complete      $0.28    │  │
│  │    └─ Extracted 8 modules, 24 learning objectives        │  │
│  │  ────────────────────────────────────────────────────────│  │
│  │                                                           │  │
│  │  ◐ Stage 3: Curriculum Decomposition  In Progress...     │  │
│  │    └─ Processing LO 12 of 24... [████████░░░░] 50%       │  │
│  │  ────────────────────────────────────────────────────────│  │
│  │                                                           │  │
│  │  ○ Stage 4: Content Discovery   Pending                  │  │
│  │  ────────────────────────────────────────────────────────│  │
│  │                                                           │  │
│  │  ○ Stage 5: Review & Publish    Pending                  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Estimated time remaining: ~2 minutes                           │
│                                                                  │
│  We'll email you when your course is ready for review.          │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            Continue in Background                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `CourseCreationProgress.tsx`

#### 6.3.4 Screen: Parse Failed - Manual Intervention

**Route:** `/instructor/courses/create/:id/failed`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ⚠️ Parsing Issue                              │
│                                                                  │
│  We had trouble extracting the structure from your syllabus.    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Issue detected:                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ The document appears to be an image-based PDF       │  │  │
│  │  │ without extractable text. Please try:               │  │  │
│  │  │ • Uploading a text-based PDF                        │  │  │
│  │  │ • Using a DOCX version                              │  │  │
│  │  │ • Pasting the text directly                         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              📄 Upload Different File                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              📝 Paste Syllabus Text                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ✉️ Contact Support                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Your $1 payment is still valid. No additional charge.          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `CourseCreationFailed.tsx`

### 6.4 API Endpoints

#### POST `/functions/v1/initiate-course-creation`
```typescript
// Request
{
  title?: string;  // Optional, can be extracted from syllabus
  syllabus_text?: string;
  syllabus_file_url?: string;
  promo_code?: string;
}

// Response
{
  course_id: string;
  requires_payment: boolean;
  payment_url?: string;  // Stripe checkout URL if payment required
  pipeline_stage: 'pending_payment' | 'uploading';
}
```

#### POST `/functions/v1/process-course-creation`
```typescript
// Called after payment confirmed (via webhook) or for free users
// Request
{
  course_id: string;
}

// Response (streaming updates via realtime)
{
  success: boolean;
  stage: string;
  message: string;
  progress?: number;  // 0-100
  cost_so_far?: number;
}
```

---

## 7. Section 5: Student Onboarding

### 7.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      STUDENT ONBOARDING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Student visits SyllabusStack]                                  │
│              │                                                   │
│              ▼                                                   │
│       ◇ Has account? ◇                                          │
│        │           │                                            │
│       NO          YES                                           │
│        │           │                                            │
│        ▼           │                                            │
│  ┌───────────┐     │                                            │
│  │ Create    │     │                                            │
│  │ account   │     │                                            │
│  │ Email +   │     │                                            │
│  │ Password  │     │                                            │
│  └─────┬─────┘     │                                            │
│        │           │                                            │
│        └─────┬─────┘                                            │
│              │                                                   │
│              ▼                                                   │
│         [Login]                                                  │
│              │                                                   │
│              ▼                                                   │
│  ◇ Identity already verified? ◇                                 │
│        │              │                                         │
│       YES            NO                                         │
│        │              │                                         │
│        │              ▼                                         │
│        │   ╔═══════════════════════════════════╗                │
│        │   ║ Identity Verification             ║                │
│        │   ║ Provider: Persona/Jumio           ║                │
│        │   ║ • Photo ID upload                 ║                │
│        │   ║ • Selfie match                    ║                │
│        │   ║ • Liveness check                  ║                │
│        │   ║ Cost: ~$0.50                      ║                │
│        │   ╚═══════════════╤═══════════════════╝                │
│        │                   │                                    │
│        │                   ▼                                    │
│        │          ◇ IDV Result ◇                                │
│        │           │        │                                   │
│        │         Pass     Fail                                  │
│        │           │        │                                   │
│        │           │        ▼                                   │
│        │           │   ╔═══════════════╗                        │
│        │           │   ║ ✗ IDV FAILED  ║                        │
│        │           │   ╚═══════╤═══════╝                        │
│        │           │           │                                │
│        │           │           ▼                                │
│        │           │    ◇ Retry? ◇                              │
│        │           │     │     │                                │
│        │           │    YES   NO                                │
│        │           │     │     │                                │
│        │           │     │     ▼                                │
│        │           │     │  [EXIT - cannot enroll               │
│        │           │     │   in verified courses]               │
│        │           │     │                                      │
│        └───────────┴─────┴───────────▶ ╔════════════════════╗   │
│                                        ║ ✓ IDENTITY         ║   │
│                                        ║   VERIFIED         ║   │
│                                        ║   (Stored          ║   │
│                                        ║   permanently)     ║   │
│                                        ╚════════════════════╝   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Current State Analysis

| Component | Status | Location |
|-----------|--------|----------|
| Email/Password signup | ✅ | `Auth.tsx` |
| Onboarding wizard | ✅ | `Onboarding.tsx` |
| Profile storage | ✅ | `profiles` table |
| **Identity Verification** | ❌ | **NOT IMPLEMENTED** |
| **IDV Provider Integration** | ❌ | **NOT IMPLEMENTED** |
| **Verified identity storage** | ❌ | **NOT IMPLEMENTED** |

### 7.3 New Database Tables

```sql
-- identity_verifications: Track IDV attempts and results
CREATE TABLE identity_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Provider info
    provider VARCHAR(50) NOT NULL, -- 'persona', 'jumio', 'manual'
    provider_inquiry_id VARCHAR(255), -- Persona inquiry ID or Jumio transaction ID
    provider_session_token TEXT, -- For resuming incomplete verifications

    -- Verification status
    status VARCHAR(20) DEFAULT 'pending',
    -- Values: 'pending', 'in_progress', 'needs_review', 'verified', 'failed', 'expired'

    -- Verified data (stored after successful verification)
    verified_first_name VARCHAR(100),
    verified_last_name VARCHAR(100),
    verified_full_name VARCHAR(255),
    verified_date_of_birth DATE,
    verified_address JSONB, -- { street, city, state, postal_code, country }

    -- Document info
    document_type VARCHAR(50), -- 'drivers_license', 'passport', 'national_id'
    document_country VARCHAR(3), -- ISO 3166-1 alpha-3
    document_issuing_state VARCHAR(50),
    document_number_last4 VARCHAR(4), -- Last 4 chars only for privacy
    document_expiration DATE,

    -- Biometric checks
    selfie_match_score DECIMAL(5,4), -- 0.0000 to 1.0000
    liveness_check_passed BOOLEAN,

    -- Risk assessment
    risk_signals JSONB, -- Array of risk flags from provider

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- When verification becomes invalid

    -- Cost tracking
    cost_usd DECIMAL(10,4),

    -- Failure tracking
    failure_reason VARCHAR(100),
    failure_details TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Raw provider response (for debugging, encrypted at rest)
    provider_response_encrypted TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'needs_review', 'verified', 'failed', 'expired'))
);

-- Add to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
    is_identity_verified BOOLEAN DEFAULT FALSE,
    identity_verification_id UUID REFERENCES identity_verifications(id),
    identity_verified_at TIMESTAMP WITH TIME ZONE,
    identity_verification_method VARCHAR(50);

-- Index for efficient lookups
CREATE INDEX idx_identity_verifications_user_id ON identity_verifications(user_id);
CREATE INDEX idx_identity_verifications_status ON identity_verifications(status);
```

### 7.4 Screen Wireframes

#### 7.4.1 Screen: Identity Verification Prompt

**Route:** `/verify-identity` or modal on enrollment

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    🔐 Verify Your Identity                       │
│                                                                  │
│  To earn verified certificates that employers trust, we need    │
│  to confirm your identity once. This is a one-time process.     │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  What you'll need:                                        │  │
│  │                                                           │  │
│  │  📄 A valid government-issued ID                          │  │
│  │     Driver's license, passport, or national ID            │  │
│  │                                                           │  │
│  │  📷 A device with a camera                                │  │
│  │     For a quick selfie to match your ID photo             │  │
│  │                                                           │  │
│  │  ⏱️ About 2 minutes                                       │  │
│  │     The process is quick and secure                       │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  🔒 Your data is secure                                   │  │
│  │                                                           │  │
│  │  • We use Persona, a trusted verification provider        │  │
│  │  • Your ID images are processed, then deleted             │  │
│  │  • We only store your verified name and DOB               │  │
│  │  • You can request data deletion anytime                  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Start Identity Verification                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Skip for Now (Limited Access)                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│     Without verification, you can still:                        │
│     • Browse and enroll in courses                              │
│     • Access all learning content                               │
│     • Earn completion badges (not verified certificates)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `IdentityVerificationPrompt.tsx`

#### 7.4.2 Screen: IDV In Progress (Persona Embed)

**Route:** `/verify-identity/process`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                                                     │  │  │
│  │  │                                                     │  │  │
│  │  │                                                     │  │  │
│  │  │           [Persona Verification Embed]              │  │  │
│  │  │                                                     │  │  │
│  │  │       Step 1: Select your ID type                   │  │  │
│  │  │       ○ Driver's License                            │  │  │
│  │  │       ○ Passport                                    │  │  │
│  │  │       ○ National ID Card                            │  │  │
│  │  │                                                     │  │  │
│  │  │       [Continue]                                    │  │  │
│  │  │                                                     │  │  │
│  │  │                                                     │  │  │
│  │  │                                                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│     Having trouble? Contact support                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `IdentityVerificationProcess.tsx`

Uses Persona's embedded flow: https://docs.withpersona.com/docs/embedded-flow

#### 7.4.3 Screen: IDV Success

**Route:** `/verify-identity/success`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ✅                                       │
│                                                                  │
│                 Identity Verified!                               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Great news, John!                                        │  │
│  │                                                           │  │
│  │  Your identity has been verified. You can now:            │  │
│  │                                                           │  │
│  │  ✓ Earn verified certificates                             │  │
│  │  ✓ Take proctored assessments                             │  │
│  │  ✓ Share credentials with employers                       │  │
│  │                                                           │  │
│  │  Your verification is stored securely and you won't       │  │
│  │  need to verify again.                                    │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Continue to Dashboard                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `IdentityVerificationSuccess.tsx`

#### 7.4.4 Screen: IDV Failed

**Route:** `/verify-identity/failed`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ⚠️                                       │
│                                                                  │
│              Verification Unsuccessful                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  We couldn't verify your identity. This might be because: │  │
│  │                                                           │  │
│  │  • The ID photo was unclear or partially obscured         │  │
│  │  • The selfie didn't match the ID photo                   │  │
│  │  • The ID document has expired                            │  │
│  │                                                           │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  Tips for a successful verification:                      │  │
│  │                                                           │  │
│  │  📷 Use good lighting when taking photos                  │  │
│  │  📄 Ensure your entire ID is visible                      │  │
│  │  😊 Look directly at the camera for the selfie            │  │
│  │  🔲 Remove glasses if possible                            │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Try Again                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Continue Without Verification                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Contact Support                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `IdentityVerificationFailed.tsx`

### 7.5 API Endpoints

#### POST `/functions/v1/initiate-identity-verification`
```typescript
// Request
{
  user_id: string;
  redirect_url?: string;  // Where to send user after completion
}

// Response
{
  verification_id: string;
  inquiry_id: string;  // Persona inquiry ID
  session_token: string;  // For Persona embed
  embed_url?: string;  // Or URL for redirect flow
}
```

#### POST `/functions/v1/idv-webhook` (Persona webhook)
```typescript
// Persona sends webhook on completion
// Request (from Persona)
{
  data: {
    type: "inquiry",
    id: string,
    attributes: {
      status: "completed" | "failed" | "needs_review",
      // ... verification data
    }
  }
}

// Updates identity_verifications table
// Updates profiles.is_identity_verified
```

#### GET `/functions/v1/identity-verification-status`
```typescript
// Request (query param)
{
  user_id: string;
}

// Response
{
  is_verified: boolean;
  verification?: {
    id: string;
    status: string;
    verified_name?: string;
    verified_at?: string;
  };
  can_retry: boolean;
  retry_count: number;
}
```

### 7.6 Persona Integration Details

#### Setup Requirements
1. Create Persona account at https://withpersona.com
2. Create an "Inquiry Template" for SyllabusStack
3. Configure required verifications:
   - Government ID verification
   - Selfie verification
   - Liveness check
4. Set up webhook endpoint
5. Store API keys in Supabase secrets

#### Environment Variables
```env
PERSONA_API_KEY=persona_sandbox_xxxxx
PERSONA_TEMPLATE_ID=tmpl_xxxxx
PERSONA_WEBHOOK_SECRET=whs_xxxxx
```

#### Cost Estimate
- ~$0.50 per successful verification
- Failed attempts may still incur partial costs

---

## 8. Section 6: Enrollment & Learning

### 8.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ENROLLMENT & LEARNING                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Browse course catalog]◀───────────────────────────────────┐   │
│         │                                                   │   │
│         ▼                                                   │   │
│  [Select course]                                            │   │
│         │                                                   │   │
│         ▼                                                   │   │
│  ┌─────────────────────────────┐                            │   │
│  │ View course preview:        │                            │   │
│  │ • Instructor affiliation    │                            │   │
│  │ • Module outline            │                            │   │
│  │ • LO summary                │                            │   │
│  └─────────────┬───────────────┘                            │   │
│                │                                            │   │
│                ▼                                            │   │
│         ◇ Enroll? ◇───NO────────────────────────────────────┘   │
│                │                                                │
│               YES                                               │
│                │                                                │
│                ▼                                                │
│         ◇ Pay $1? ◇───NO────────────────────────────────────┘   │
│                │                                                │
│               YES                                               │
│                │                                                │
│                ▼                                                │
│  ╔════════════════════════════════════╗                        │
│  ║ ✓ ENROLLED                         ║                        │
│  ║ • Access granted                   ║                        │
│  ║ • Progress tracking starts         ║                        │
│  ╚═══════════════════╤════════════════╝                        │
│                      │                                          │
│                      ▼                                          │
│              [Begin learning]                                   │
│                      │                                          │
│                      ▼                                          │
│         ┌────[Access teaching unit]◀────────────┐              │
│         │            │                          │              │
│         │            ▼                          │              │
│         │   ◇ Content generated? ◇              │              │
│         │      │           │                    │              │
│         │     NO          YES                   │              │
│         │      │           │                    │              │
│         │      ▼           ▼                    │              │
│         │ [Basic content] [Full content]        │              │
│         │ [only - slides] [available]           │              │
│         │ [pending]                             │              │
│         │      │           │                    │              │
│         │      └─────┬─────┘                    │              │
│         │            │                          │              │
│         │            ▼                          │              │
│         │   [Mark unit complete]                │              │
│         │            │                          │              │
│         │            ▼                          │              │
│         │     ◇ More units? ◇───YES─────────────┘              │
│         │            │                                          │
│         │           NO                                          │
│         │            │                                          │
│         │            ▼                                          │
│         │   ◇ Module complete? ◇───NO───────────┘              │
│         │            │                                          │
│         │           YES                                         │
│         │            │                                          │
│         │            ▼                                          │
│         │   ◇ Course complete? ◇───NO───────────┘              │
│         │            │                                          │
│         │           YES                                         │
│         │            │                                          │
│         │            ▼                                          │
│         │  ╔════════════════════════════════════╗              │
│         │  ║ ✓ COURSE COMPLETED                 ║              │
│         │  ║ • Completion logged                ║              │
│         │  ║ • Tied to verified identity        ║              │
│         │  ║ • Timestamp recorded               ║              │
│         │  ╚════════════════════════════════════╝              │
│         │                                                       │
└─────────┴───────────────────────────────────────────────────────┘
```

### 8.2 Current State Analysis

| Component | Status | Location |
|-----------|--------|----------|
| Course catalog | ✅ | `Courses.tsx`, `Learn.tsx` |
| Course preview | ✅ | `CourseDetail.tsx` |
| Enrollment | ✅ | `course_enrollments` table |
| Progress tracking | ✅ | `overall_progress`, `consumption_records` |
| Teaching units | ✅ | `teaching_units` table |
| Lecture slides | ✅ | `lecture_slides` table |
| **$1 enrollment fee** | ❌ | **NOT IMPLEMENTED** |
| **Identity-tied completion** | ❌ | **NOT IMPLEMENTED** |
| **Fallback content mode** | ❌ | **NOT IMPLEMENTED** |

### 8.3 Database Changes

```sql
-- Add payment and identity tracking to course_enrollments
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS
    enrollment_fee_required BOOLEAN DEFAULT TRUE,
    enrollment_fee_amount DECIMAL(10,2) DEFAULT 1.00,
    enrollment_fee_paid BOOLEAN DEFAULT FALSE,
    enrollment_fee_payment_id VARCHAR(255),
    enrollment_fee_paid_at TIMESTAMP WITH TIME ZONE,

    -- Identity verification at enrollment time
    identity_verified_at_enrollment BOOLEAN DEFAULT FALSE,
    identity_verification_id UUID REFERENCES identity_verifications(id),

    -- Completion tracking
    completed_with_verified_identity BOOLEAN DEFAULT FALSE,
    completion_certificate_eligible BOOLEAN DEFAULT FALSE;

-- Create enrollment_transactions for payment audit
CREATE TABLE enrollment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    course_id UUID NOT NULL REFERENCES instructor_courses(id),

    -- Payment details
    amount_usd DECIMAL(10,2) NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    payment_status VARCHAR(20) NOT NULL, -- 'pending', 'succeeded', 'failed', 'refunded'

    -- Promo codes
    promo_code_used VARCHAR(50),
    discount_amount DECIMAL(10,2) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
```

### 8.4 Screen Wireframes

#### 8.4.1 Screen: Course Enrollment with Payment

**Route:** `/courses/:id/enroll` (or modal)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enroll in Course                        ✕    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📚 Machine Learning Fundamentals                         │  │
│  │                                                           │  │
│  │  Instructor: Dr. Jane Smith                               │  │
│  │  Institution: Stanford University ✓                       │  │
│  │                                                           │  │
│  │  8 Modules • 24 Learning Objectives                       │  │
│  │  Estimated: 20 hours                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  What you'll get:                                         │  │
│  │                                                           │  │
│  │  ✓ Full access to all course content                      │  │
│  │  ✓ AI-generated lecture slides                            │  │
│  │  ✓ Curated video resources                                │  │
│  │  ✓ Knowledge assessments                                  │  │
│  │  ✓ Progress tracking                                      │  │
│  │  ✓ Completion certificate (if identity verified)         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Enrollment fee:               $1.00                      │  │
│  │  ┌───────────────────────────────────────┐                │  │
│  │  │ 🎟️ Have a promo code? Enter here    │                │  │
│  │  └───────────────────────────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              💳 Pay $1 & Enroll                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Pro subscribers: Enrollments included in your plan             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `EnrollmentPaymentModal.tsx`

#### 8.4.2 Screen: Learning Unit with Fallback Content

When slides aren't generated yet:

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Course: ML Fundamentals                    SyllabusStack     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Module 2: Supervised Learning                                  │
│  Unit 2.3: Decision Trees                                       │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ⏳ Full lecture slides are being generated...            │  │
│  │                                                           │  │
│  │  In the meantime, here's what we have:                    │  │
│  │                                                           │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  📖 Learning Objective:                                   │  │
│  │  "Understand how decision trees partition feature         │  │
│  │   space and make predictions"                             │  │
│  │                                                           │  │
│  │  📹 Curated Videos:                                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ ▶ Decision Trees Explained (StatQuest)    12:34    │  │  │
│  │  │   Match score: 94%                                  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ ▶ ID3 Algorithm Tutorial             8:21          │  │  │
│  │  │   Match score: 87%                                  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  📝 Key Concepts:                                         │  │
│  │  • Information gain and entropy                           │  │
│  │  • Gini impurity                                          │  │
│  │  • Pruning strategies                                     │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Mark as Complete                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `LearningUnitFallback.tsx`

#### 8.4.3 Screen: Course Completion

**Route:** `/courses/:id/completed`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         🎉                                       │
│                                                                  │
│              Congratulations, John!                              │
│                                                                  │
│     You've completed Machine Learning Fundamentals              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  📊 Your Progress                                         │  │
│  │                                                           │  │
│  │  Modules completed:        8/8                            │  │
│  │  Learning objectives:      24/24                          │  │
│  │  Total time:              18 hours 32 minutes             │  │
│  │  Assessments passed:       6/6                            │  │
│  │  Average score:            87%                            │  │
│  │                                                           │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  ✓ Identity verified                                      │  │
│  │  ✓ Eligible for verified certificate                      │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Get Your Certificate →                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Share on LinkedIn                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Browse More Courses                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `CourseCompletionScreen.tsx`

### 8.5 API Endpoints

#### POST `/functions/v1/enroll-in-course`
```typescript
// Request
{
  course_id: string;
  promo_code?: string;
}

// Response (requires payment)
{
  requires_payment: true;
  checkout_url: string;  // Stripe checkout
  enrollment_id: string;
}

// Response (free - Pro user or promo code)
{
  requires_payment: false;
  enrollment: CourseEnrollment;
}
```

#### POST `/functions/v1/complete-enrollment-payment`
```typescript
// Called by Stripe webhook after payment
// Request (internal)
{
  enrollment_id: string;
  payment_intent_id: string;
}

// Response
{
  enrollment: CourseEnrollment;
  access_granted: true;
}
```

---

## 9. Section 7: Progressive Generation Engine

### 9.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  PROGRESSIVE GENERATION ENGINE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Trigger Check - runs periodically]────────▶ [Retry failed     │
│         │                                      units]           │
│         │                                         │              │
│         ├─────────────────┬─────────────────┐    │              │
│         │                 │                 │    │              │
│         ▼                 ▼                 ▼    │              │
│  ◇ Instructor     ◇ ≥5 students      ◇ Course has              │
│    spent           reached             ≥10 enrollments?         │
│    credits? ◇       Unit N-1? ◇                 ◇               │
│    │     │         │        │         │        │                │
│   YES   NO        YES      NO        YES      NO                │
│    │     │   (not gen)  (or done)  (not gen) (or done)         │
│    │     │         │        │         │        │                │
│    │     ▼         │        ▼         │        ▼                │
│    │  [Skip]       │     [Skip]       │     [Skip]              │
│    │               │                  │                         │
│    ▼               ▼                  ▼                         │
│  ╔═══════════════════════════════════════════════════════════╗ │
│  ║ Queue: Generate Unit N              Queue: Generate        ║ │
│  ║ • Deep content eval                 Module 1 Slides        ║ │
│  ║ • Slide generation                  • Research grounding   ║ │
│  ║ • Cost: ~$0.03/unit                 • Vertex AI batch job  ║ │
│  ║                                     • Cost: ~$0.50/module  ║ │
│  ╚════════════════════════╤══════════════════════════════════╝ │
│                           │                                     │
│                           ▼                                     │
│  ╔═════════════════════════════════════════════════════════════╗│
│  ║ STAGE 5: Batch Processing                                   ║│
│  ║ • Submit to Vertex AI                                       ║│
│  ║ • Track batch_jobs status                                   ║│
│  ║ • Poll for completion                                       ║│
│  ║ • Handle partial failures                                   ║│
│  ╚═════════════════════════════╤═══════════════════════════════╝│
│                                │                                 │
│                                ▼                                 │
│                       ◇ Batch status? ◇                         │
│                        │      │      │                          │
│                 Completed  Partial  Failed                      │
│                        │      │      │                          │
│                        ▼      │      ▼                          │
│  ╔══════════════════════╗    │  ╔═══════════════════════════╗  │
│  ║ Content ready        ║    │  ║ Batch failed              ║  │
│  ║ lecture_slides.status║    │  ║ Alert & manual review     ║  │
│  ║ = 'ready'            ║    │  ╚═══════════════════════════╝  │
│  ╚══════════════════════╝    │                                  │
│                               │                                  │
│                               ▼                                  │
│                    ╔══════════════════════╗                     │
│                    ║ Partial success      ║                     │
│                    ║ Retry failed units   ║─────────────────────┘│
│                    ╚══════════════════════╝                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Current State Analysis

| Component | Status | Location |
|-----------|--------|----------|
| Batch job infrastructure | ✅ | `batch_jobs` table |
| Vertex AI integration | ✅ | `vertex-ai-batch.ts` |
| Slide generation | ✅ | `generate-lecture-slides-v3` |
| Polling for completion | ✅ | `poll-batch-status` |
| **Demand-based triggers** | ❌ | **NOT IMPLEMENTED** |
| **Enrollment thresholds** | ❌ | **NOT IMPLEMENTED** |
| **Progress-based triggers** | ❌ | **NOT IMPLEMENTED** |
| **Instructor credits** | ❌ | **NOT IMPLEMENTED** |
| **Periodic cron job** | ❌ | **NOT IMPLEMENTED** |

### 9.3 Database Changes

```sql
-- Generation triggers table
CREATE TABLE generation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_course_id UUID NOT NULL REFERENCES instructor_courses(id) ON DELETE CASCADE,

    -- What to generate
    target_type VARCHAR(30) NOT NULL, -- 'module', 'learning_objective', 'teaching_unit'
    target_id UUID NOT NULL, -- ID of the module/LO/TU to generate

    -- Trigger type
    trigger_type VARCHAR(30) NOT NULL,
    -- Values: 'enrollment_threshold', 'progress_threshold', 'instructor_credit', 'manual'

    -- Threshold configuration
    threshold_config JSONB NOT NULL,
    -- Examples:
    -- { "min_enrollments": 10 }
    -- { "min_students_at_previous_unit": 5 }
    -- { "credits_spent": 1 }

    -- Current state
    current_value INTEGER DEFAULT 0,
    threshold_met BOOLEAN DEFAULT FALSE,
    threshold_met_at TIMESTAMP WITH TIME ZONE,

    -- Generation status
    generation_status VARCHAR(20) DEFAULT 'pending',
    -- Values: 'pending', 'queued', 'generating', 'completed', 'failed'

    batch_job_id UUID REFERENCES batch_jobs(id),
    generation_started_at TIMESTAMP WITH TIME ZONE,
    generation_completed_at TIMESTAMP WITH TIME ZONE,
    generation_cost_usd DECIMAL(10,4),

    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instructor generation credits
ALTER TABLE instructor_courses ADD COLUMN IF NOT EXISTS
    generation_credits INTEGER DEFAULT 0,
    generation_credits_used INTEGER DEFAULT 0;

-- Add to profiles for instructors
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
    instructor_generation_credits INTEGER DEFAULT 0;

-- Trigger check log (for debugging/monitoring)
CREATE TABLE generation_trigger_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    courses_checked INTEGER,
    triggers_evaluated INTEGER,
    triggers_fired INTEGER,
    jobs_queued INTEGER,

    duration_ms INTEGER,
    errors TEXT[]
);

-- Index for efficient trigger checks
CREATE INDEX idx_generation_triggers_pending ON generation_triggers(generation_status)
    WHERE generation_status IN ('pending', 'queued');
CREATE INDEX idx_generation_triggers_course ON generation_triggers(instructor_course_id);
```

### 9.4 Trigger Check Logic (Pseudo-code)

```typescript
// Edge Function: trigger-progressive-generation
// Runs every 15 minutes via cron

async function checkAndTriggerGeneration() {
  const log = { courses_checked: 0, triggers_evaluated: 0, triggers_fired: 0 };

  // Get all published courses
  const courses = await supabase
    .from('instructor_courses')
    .select('*')
    .eq('is_published', true);

  for (const course of courses) {
    log.courses_checked++;

    // Check 1: Enrollment threshold (≥10 enrollments, Module 1 not generated)
    const enrollmentCount = await getEnrollmentCount(course.id);
    if (enrollmentCount >= 10) {
      const module1 = await getFirstModule(course.id);
      if (!module1.slides_generated) {
        await queueModuleGeneration(course.id, module1.id, 'enrollment_threshold');
        log.triggers_fired++;
      }
    }

    // Check 2: Progress threshold (≥5 students reached Unit N-1)
    const unitsNeedingGeneration = await getUnitsWithProgressThreshold(course.id, 5);
    for (const unit of unitsNeedingGeneration) {
      await queueUnitGeneration(course.id, unit.id, 'progress_threshold');
      log.triggers_fired++;
    }

    // Check 3: Instructor credits
    if (course.generation_credits > course.generation_credits_used) {
      const nextUngenerated = await getNextUngeneratedUnit(course.id);
      if (nextUngenerated) {
        await queueUnitGeneration(course.id, nextUngenerated.id, 'instructor_credit');
        await useCredit(course.id);
        log.triggers_fired++;
      }
    }

    log.triggers_evaluated += 3;
  }

  // Record check log
  await supabase.from('generation_trigger_checks').insert(log);

  return log;
}
```

### 9.5 Screen Wireframes

#### 9.5.1 Admin: Generation Queue Monitor

**Route:** `/admin/generation-queue`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │           Progressive Generation Monitor              │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Dashboard│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│          │  │    12    │ │     3    │ │     8    │ │     1    ││
│ Users    │  │  Queued  │ │Generating│ │Completed │ │  Failed  ││
│          │  │          │ │          │ │ (24h)    │ │          ││
│ Courses  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│          │                                                      │
│ ▶Generate│  ┌─────────────────────────────────────────────────┐ │
│          │  │ Active Generation Jobs                          │ │
│ Reports  │  │                                                 │ │
│          │  │ ┌───────────────────────────────────────────┐   │ │
│          │  │ │ CS101 - Module 2: Data Structures         │   │ │
│          │  │ │ Status: Generating  [████████░░] 78%      │   │ │
│          │  │ │ Trigger: enrollment_threshold (15 enrolled)│   │ │
│          │  │ │ Started: 5 min ago  Est. remaining: 2 min │   │ │
│          │  │ └───────────────────────────────────────────┘   │ │
│          │  │                                                 │ │
│          │  │ ┌───────────────────────────────────────────┐   │ │
│          │  │ │ ML201 - Unit 3.4: Neural Networks         │   │ │
│          │  │ │ Status: Generating  [████░░░░░░] 42%      │   │ │
│          │  │ │ Trigger: progress_threshold (7 students)  │   │ │
│          │  │ │ Started: 8 min ago  Est. remaining: 5 min │   │ │
│          │  │ └───────────────────────────────────────────┘   │ │
│          │  │                                                 │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
│          │  ┌─────────────────────────────────────────────────┐ │
│          │  │ Failed Jobs (Needs Attention)                   │ │
│          │  │                                                 │ │
│          │  │ ┌───────────────────────────────────────────┐   │ │
│          │  │ │ BIO101 - Unit 2.1: Cell Biology    ⚠️     │   │ │
│          │  │ │ Error: Vertex AI rate limit exceeded      │   │ │
│          │  │ │ Retries: 3/3                              │   │ │
│          │  │ │ [Retry Now]  [View Logs]  [Skip]          │   │ │
│          │  │ └───────────────────────────────────────────┘   │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Component:** `AdminGenerationMonitor.tsx`

#### 9.5.2 Instructor: Generation Credits

**Route:** `/instructor/courses/:id/generation` (tab)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Course                    ML Fundamentals            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Overview] [Content] [Students] [▶Generation] [Settings]       │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Generation Status                                        │  │
│  │                                                           │  │
│  │  📊 Content Generation Progress                           │  │
│  │                                                           │  │
│  │  Module 1: Intro to ML          [████████████] 100% ✓    │  │
│  │  Module 2: Supervised Learning  [████████░░░░]  67%      │  │
│  │  Module 3: Unsupervised         [░░░░░░░░░░░░]   0%      │  │
│  │  Module 4: Neural Networks      [░░░░░░░░░░░░]   0%      │  │
│  │                                                           │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  🎟️ Your Generation Credits: 5 remaining                 │  │
│  │                                                           │  │
│  │  Use credits to generate content immediately instead      │  │
│  │  of waiting for enrollment thresholds.                    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Generate next unfinished unit         [Use Credit] │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Buy more credits                   $0.50 each      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Automatic Generation Triggers                            │  │
│  │                                                           │  │
│  │  Content is automatically generated when:                 │  │
│  │  • Course reaches 10 enrollments (Module 1)               │  │
│  │  • 5+ students complete the previous unit (subsequent)    │  │
│  │                                                           │  │
│  │  Current: 8 enrollments (2 more for auto Module 1)        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `InstructorGenerationTab.tsx`

### 9.6 API Endpoints

#### POST `/functions/v1/trigger-progressive-generation`
```typescript
// Called by cron job (Supabase pg_cron or external)
// No request body

// Response
{
  courses_checked: number;
  triggers_evaluated: number;
  triggers_fired: number;
  jobs_queued: number;
  errors: string[];
}
```

#### POST `/functions/v1/use-generation-credit`
```typescript
// Request
{
  course_id: string;
  target_type: 'module' | 'unit';
  target_id: string;
}

// Response
{
  success: boolean;
  credits_remaining: number;
  job_id: string;
  estimated_completion: string;
}
```

#### POST `/functions/v1/retry-failed-generation`
```typescript
// Request
{
  trigger_id: string;
}

// Response
{
  success: boolean;
  job_id: string;
}
```

---

## 10. Section 8: Certification & Monetization

### 10.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  CERTIFICATION & MONETIZATION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Student completed course]                                      │
│              │                                                   │
│              ▼                                                   │
│       ◇ Want certificate? ◇                                     │
│        │           │                                            │
│       NO          YES                                           │
│        │           │                                            │
│        ▼           ▼                                            │
│  ╔═══════════════╗  ◇ Take assessment? ◇                       │
│  ║ Free          ║    │           │                             │
│  ║ Completion    ║   NO          YES                            │
│  ║ Badge         ║    │           │                             │
│  ║               ║    │           ▼                             │
│  ║ • Basic badge ║    │  ╔════════════════════════════════════╗│
│  ║ • No verifi-  ║    │  ║ Assessed Certificate - $49         ║│
│  ║   cation seal ║    │  ║                                    ║│
│  ║ • Not employer║    │  ║ • All basic features +             ║│
│  ║   recognized  ║    │  ║ • Proctored assessment             ║│
│  ║ • Revenue: $0 ║    │  ║ • Mastery score                    ║│
│  ╚═══════════════╝    │  ║ • Detailed skill breakdown         ║│
│                       │  ╚═══════════════╤════════════════════╝│
│                       │                  │                      │
│                       │                  ▼                      │
│                       │  ╔════════════════════════════════════╗│
│                       │  ║ Proctored Assessment               ║│
│                       │  ║ • Browser lockdown                 ║│
│                       │  ║ • Webcam monitoring                ║│
│                       │  ║ • Time-limited                     ║│
│                       │  ╚═══════════════╤════════════════════╝│
│                       │                  │                      │
│                       │                  ▼                      │
│                       │         ◇ Pass threshold? ◇            │
│                       │          │           │                  │
│                       │         NO          YES                 │
│                       │          │           │                  │
│                       │          ▼           │                  │
│                       │    ◇ Retry? ◇        │                  │
│                       │     │      │         │                  │
│                       │    YES    NO         │                  │
│                       │     │      │         │                  │
│                       │     │      ▼         │                  │
│                       ▼     │      │         │                  │
│  ╔══════════════════════════╗     │         │                  │
│  ║ Verified Certificate     ║◀────┘         │                  │
│  ║ $25                      ║               │                  │
│  ║                          ║               │                  │
│  ║ • Identity-verified      ║               │                  │
│  ║   learner                ║               │                  │
│  ║ • Verified instructor    ║               │                  │
│  ║   affiliation            ║               │                  │
│  ║ • University name        ║               │                  │
│  ║   displayed              ║               │                  │
│  ║ • Shareable link + PDF   ║               │                  │
│  ║ • QR code verification   ║               │                  │
│  ╚════════════╤═════════════╝               │                  │
│               │                             │                  │
│               └──────────────┬──────────────┘                  │
│                              │                                  │
│                              ▼                                  │
│             ╔════════════════════════════════════╗             │
│             ║ ✓ CERTIFICATE ISSUED               ║             │
│             ║                                    ║             │
│             ║ • Unique cert ID                   ║             │
│             ║ • Blockchain anchor (optional)     ║             │
│             ║ • Verification API endpoint        ║             │
│             ╚════════════════════════════════════╝             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 New Database Tables

```sql
-- certificates: Issued certificates
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Human-readable certificate ID
    certificate_id VARCHAR(20) UNIQUE NOT NULL, -- e.g., "CERT-2026-A7B3C9"

    -- Relationships
    user_id UUID NOT NULL REFERENCES auth.users(id),
    instructor_course_id UUID NOT NULL REFERENCES instructor_courses(id),
    enrollment_id UUID REFERENCES course_enrollments(id),

    -- Certificate type and pricing
    certificate_type VARCHAR(20) NOT NULL, -- 'completion_badge', 'verified', 'assessed'
    price_usd DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Payment
    stripe_payment_intent_id VARCHAR(255),
    payment_status VARCHAR(20), -- 'pending', 'succeeded', 'failed', 'refunded'
    paid_at TIMESTAMP WITH TIME ZONE,

    -- Assessment (for assessed certificates)
    assessment_session_id UUID REFERENCES assessment_sessions(id),
    proctored_session_id UUID,
    mastery_score DECIMAL(5,2), -- 0-100
    skill_breakdown JSONB, -- { "skill_name": score, ... }
    passed_assessment BOOLEAN,

    -- Identity verification
    identity_verification_id UUID REFERENCES identity_verifications(id),
    identity_verified BOOLEAN DEFAULT FALSE,

    -- Instructor/Institution info (denormalized for certificate)
    instructor_name VARCHAR(255),
    instructor_title VARCHAR(100),
    institution_name VARCHAR(255),
    instructor_verified BOOLEAN DEFAULT FALSE,

    -- Course info (denormalized)
    course_title VARCHAR(255),
    course_code VARCHAR(50),
    completion_date DATE,
    total_hours DECIMAL(6,2),

    -- Certificate assets
    pdf_url TEXT,
    pdf_generated_at TIMESTAMP WITH TIME ZONE,
    qr_code_url TEXT,
    share_token VARCHAR(100) UNIQUE, -- For public sharing link

    -- Blockchain (optional)
    blockchain_enabled BOOLEAN DEFAULT FALSE,
    blockchain_network VARCHAR(50), -- 'polygon', 'ethereum'
    blockchain_tx_hash VARCHAR(255),
    blockchain_anchored_at TIMESTAMP WITH TIME ZONE,

    -- Verification
    verification_url TEXT, -- Public URL for verification
    verification_count INTEGER DEFAULT 0, -- How many times verified

    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'revoked', 'expired'
    revoked_at TIMESTAMP WITH TIME ZONE,
    revocation_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_cert_type CHECK (certificate_type IN ('completion_badge', 'verified', 'assessed')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'revoked', 'expired'))
);

-- proctored_sessions: Track proctoring during assessments
CREATE TABLE proctored_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_session_id UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Session timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    time_limit_minutes INTEGER DEFAULT 60,

    -- Browser info
    browser_name VARCHAR(50),
    browser_version VARCHAR(20),
    os_name VARCHAR(50),
    screen_resolution VARCHAR(20),
    is_fullscreen BOOLEAN DEFAULT FALSE,

    -- Violation tracking
    fullscreen_exits INTEGER DEFAULT 0,
    tab_switches INTEGER DEFAULT 0,
    copy_paste_attempts INTEGER DEFAULT 0,
    right_click_attempts INTEGER DEFAULT 0,
    keyboard_shortcuts_blocked INTEGER DEFAULT 0,
    browser_resize_attempts INTEGER DEFAULT 0,

    -- Webcam monitoring
    webcam_enabled BOOLEAN DEFAULT FALSE,
    webcam_snapshots_count INTEGER DEFAULT 0,
    webcam_snapshots_urls TEXT[], -- Stored image URLs
    face_not_detected_count INTEGER DEFAULT 0,
    multiple_faces_detected_count INTEGER DEFAULT 0,

    -- Suspicious activity log
    suspicious_events JSONB[] DEFAULT ARRAY[]::JSONB[],
    -- Each event: { "type": "tab_switch", "timestamp": "...", "details": {...} }

    -- Proctor decision
    proctoring_passed BOOLEAN,
    proctoring_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,

    -- Auto-flag thresholds
    auto_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,

    CONSTRAINT valid_webcam CHECK (webcam_enabled = FALSE OR webcam_snapshots_urls IS NOT NULL)
);

-- Certificate verification log (for employer API tracking)
CREATE TABLE certificate_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id),

    -- Verification source
    verified_via VARCHAR(30) NOT NULL, -- 'public_page', 'qr_code', 'api', 'employer_api'
    api_key_id UUID REFERENCES employer_api_keys(id),

    -- Verifier info
    verifier_ip INET,
    verifier_user_agent TEXT,
    verifier_referrer TEXT,

    -- Timestamp
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_certificates_user ON certificates(user_id);
CREATE INDEX idx_certificates_course ON certificates(instructor_course_id);
CREATE INDEX idx_certificates_certificate_id ON certificates(certificate_id);
CREATE INDEX idx_certificates_share_token ON certificates(share_token);
CREATE INDEX idx_proctored_sessions_assessment ON proctored_sessions(assessment_session_id);
```

### 10.3 Screen Wireframes

#### 10.3.1 Screen: Certificate Selection

**Route:** `/courses/:id/certificate`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                 🎓 Get Your Certificate                          │
│                                                                  │
│     Machine Learning Fundamentals                                │
│     Completed on January 25, 2026                                │
│                                                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │    FREE         │ │   VERIFIED      │ │   ASSESSED      │   │
│  │                 │ │   POPULAR       │ │                 │   │
│  │   Completion    │ │                 │ │                 │   │
│  │   Badge         │ │     $25         │ │      $49        │   │
│  │                 │ │                 │ │                 │   │
│  │ ✓ Basic badge   │ │ Everything in   │ │ Everything in   │   │
│  │   on profile    │ │ Free, plus:     │ │ Verified, plus: │   │
│  │                 │ │                 │ │                 │   │
│  │ ✓ Shareable     │ │ ✓ Identity      │ │ ✓ Proctored     │   │
│  │   link          │ │   verified      │ │   assessment    │   │
│  │                 │ │                 │ │                 │   │
│  │ ✗ No employer   │ │ ✓ Instructor    │ │ ✓ Mastery score │   │
│  │   verification  │ │   verification  │ │   included      │   │
│  │                 │ │                 │ │                 │   │
│  │ ✗ No PDF        │ │ ✓ PDF download  │ │ ✓ Skill         │   │
│  │                 │ │                 │ │   breakdown     │   │
│  │                 │ │ ✓ QR code       │ │                 │   │
│  │                 │ │   verification  │ │ ✓ Employer API  │   │
│  │                 │ │                 │ │   verified      │   │
│  │                 │ │ ✓ Employer      │ │                 │   │
│  │                 │ │   verifiable    │ │                 │   │
│  │                 │ │                 │ │                 │   │
│  │ [Get Badge]     │ │ [Get Verified]  │ │ [Start Assess.] │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                  │
│  ℹ️ Identity verification required for Verified & Assessed      │
│     You are: ✓ Identity verified                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `CertificateSelection.tsx`

#### 10.3.2 Screen: Proctored Assessment Start

**Route:** `/assessment/:id/proctored/start`

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                 📋 Proctored Assessment                          │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Machine Learning Fundamentals - Final Assessment         │  │
│  │                                                           │  │
│  │  ⏱️ Time limit: 60 minutes                                │  │
│  │  📝 Questions: 30 (multiple choice + short answer)        │  │
│  │  📊 Passing score: 70%                                    │  │
│  │                                                           │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  Before you begin:                                        │  │
│  │                                                           │  │
│  │  ✓ Close all other browser tabs and applications          │  │
│  │  ✓ Ensure you have a stable internet connection           │  │
│  │  ✓ Find a quiet location with no distractions             │  │
│  │  ✓ Have your webcam ready (optional but recommended)      │  │
│  │                                                           │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  Proctoring rules:                                        │  │
│  │                                                           │  │
│  │  • The assessment will run in fullscreen mode             │  │
│  │  • Exiting fullscreen will be recorded                    │  │
│  │  • Tab switching is not allowed                           │  │
│  │  • Copy/paste is disabled                                 │  │
│  │  • Multiple violations may disqualify your attempt        │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [x] I understand and agree to the proctoring rules       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              🚀 Enter Fullscreen & Start                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `ProctoredAssessmentStart.tsx`

#### 10.3.3 Screen: Proctored Assessment In Progress

**Route:** `/assessment/:id/proctored`

```
┌─────────────────────────────────────────────────────────────────┐
│  ⏱️ 42:15 remaining          Question 12 of 30    [⚠️ Fullscreen]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Question 12                                              │  │
│  │                                                           │  │
│  │  Which of the following best describes the purpose of     │  │
│  │  regularization in machine learning?                      │  │
│  │                                                           │  │
│  │  ○ To increase the complexity of the model                │  │
│  │                                                           │  │
│  │  ○ To prevent overfitting by penalizing large weights     │  │
│  │                                                           │  │
│  │  ○ To speed up the training process                       │  │
│  │                                                           │  │
│  │  ○ To increase the number of features                     │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ◀ Previous                              Next ▶           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Progress: [████████████░░░░░░░░░░░░░░░░░░] 40%                 │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Submit Assessment                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⚠️ Warning: 2 tab switches detected (max 5 before review)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `ProctoredAssessmentSession.tsx`

#### 10.3.4 Screen: Certificate Display

**Route:** `/certificate/:id` (Public)

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyllabusStack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ┌─────────────────────────────────────────────────────┐   │  │
│  │ │                                                     │   │  │
│  │ │            ╔═══════════════════════════╗            │   │  │
│  │ │            ║     CERTIFICATE OF        ║            │   │  │
│  │ │            ║      COMPLETION           ║            │   │  │
│  │ │            ╚═══════════════════════════╝            │   │  │
│  │ │                                                     │   │  │
│  │ │              This certifies that                    │   │  │
│  │ │                                                     │   │  │
│  │ │                  JOHN SMITH                         │   │  │
│  │ │              ✓ Identity Verified                    │   │  │
│  │ │                                                     │   │  │
│  │ │         has successfully completed                  │   │  │
│  │ │                                                     │   │  │
│  │ │       MACHINE LEARNING FUNDAMENTALS                 │   │  │
│  │ │                                                     │   │  │
│  │ │    Instructor: Dr. Jane Doe (✓ Verified)           │   │  │
│  │ │    Institution: Stanford University                 │   │  │
│  │ │                                                     │   │  │
│  │ │    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │   │  │
│  │ │                                                     │   │  │
│  │ │    Mastery Score: 92%         ┌─────────┐          │   │  │
│  │ │    Completion Date: Jan 25    │ [QR]    │          │   │  │
│  │ │    Certificate ID:            │ [CODE]  │          │   │  │
│  │ │    CERT-2026-A7B3C9           └─────────┘          │   │  │
│  │ │                                                     │   │  │
│  │ └─────────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  ✓ This certificate is verified                          │  │
│  │    Verified 47 times                                      │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────────┐ │
│  │ Download PDF│ │ Share Link  │ │ Add to LinkedIn           │ │
│  └─────────────┘ └─────────────┘ └───────────────────────────┘ │
│                                                                  │
│  ───────────────────────────────────────────────────────────────│
│                                                                  │
│  Skill Breakdown:                                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Supervised Learning    [████████████████░░] 94%           │  │
│  │ Neural Networks        [██████████████░░░░] 88%           │  │
│  │ Model Evaluation       [███████████████░░░] 91%           │  │
│  │ Feature Engineering    [██████████████████] 97%           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Component:** `CertificateDisplay.tsx`

#### 10.3.5 Screen: My Certificates

**Route:** `/certificates`

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │              My Certificates                         │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ Dashboard│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│          │  │    3     │ │    1     │ │    2     │             │
│ Courses  │  │ Assessed │ │ Verified │ │ Badges   │             │
│          │  └──────────┘ └──────────┘ └──────────┘             │
│ ▶Certs   │                                                      │
│          │  ┌─────────────────────────────────────────────────┐ │
│ Profile  │  │ ┌─────────────────────────────────────────────┐ │ │
│          │  │ │ 🏆 Machine Learning Fundamentals             │ │ │
│          │  │ │    ASSESSED • Score: 92%                     │ │ │
│          │  │ │                                              │ │ │
│          │  │ │    Stanford University                       │ │ │
│          │  │ │    Issued: Jan 25, 2026                      │ │ │
│          │  │ │    ID: CERT-2026-A7B3C9                      │ │ │
│          │  │ │                                              │ │ │
│          │  │ │    [View] [Download PDF] [Share]             │ │ │
│          │  │ └─────────────────────────────────────────────┘ │ │
│          │  │                                                 │ │
│          │  │ ┌─────────────────────────────────────────────┐ │ │
│          │  │ │ ✓ Data Science Essentials                   │ │ │
│          │  │ │    VERIFIED                                  │ │ │
│          │  │ │                                              │ │ │
│          │  │ │    MIT                                       │ │ │
│          │  │ │    Issued: Jan 10, 2026                      │ │ │
│          │  │ │    ID: CERT-2026-X8Y2Z1                      │ │ │
│          │  │ │                                              │ │ │
│          │  │ │    [View] [Download PDF] [Share]             │ │ │
│          │  │ └─────────────────────────────────────────────┘ │ │
│          │  │                                                 │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Component:** `MyCertificates.tsx`

### 10.4 API Endpoints

#### POST `/functions/v1/purchase-certificate`
```typescript
// Request
{
  enrollment_id: string;
  certificate_type: 'verified' | 'assessed';
}

// Response
{
  checkout_url: string;  // Stripe checkout
  certificate_id: string;  // Pre-created, pending payment
}
```

#### POST `/functions/v1/issue-certificate`
```typescript
// Called after payment (webhook) or for free badges
// Request
{
  enrollment_id: string;
  certificate_type: 'completion_badge' | 'verified' | 'assessed';
  assessment_session_id?: string;  // For assessed certificates
}

// Response
{
  certificate: Certificate;
  pdf_url: string;
  verification_url: string;
}
```

#### POST `/functions/v1/start-proctored-assessment`
```typescript
// Request
{
  enrollment_id: string;
  certificate_type: 'assessed';
}

// Response
{
  assessment_session_id: string;
  proctored_session_id: string;
  time_limit_minutes: number;
  questions: Question[];  // Shuffled, no answers
}
```

#### POST `/functions/v1/record-proctor-event`
```typescript
// Request
{
  proctored_session_id: string;
  event_type: 'fullscreen_exit' | 'tab_switch' | 'copy_paste' | 'webcam_snapshot';
  details?: object;
}

// Response
{
  recorded: true;
  warning_level: 'none' | 'warning' | 'critical';
  violations_remaining: number;
}
```

#### GET `/functions/v1/verify-certificate/:certificate_id`
```typescript
// Public endpoint - no auth required
// Response
{
  valid: true;
  certificate: {
    certificate_id: string;
    holder_name: string;
    course_title: string;
    instructor_name: string;
    institution_name: string;
    certificate_type: string;
    issued_at: string;
    mastery_score?: number;
    identity_verified: boolean;
    instructor_verified: boolean;
  }
}

// Or if invalid
{
  valid: false;
  error: 'certificate_not_found' | 'certificate_revoked' | 'certificate_expired';
}
```

#### POST `/functions/v1/generate-certificate-pdf`
```typescript
// Request
{
  certificate_id: string;
}

// Response
{
  pdf_url: string;
  qr_code_url: string;
}
```

### 10.5 Proctoring Implementation Details

#### Browser Lockdown
```typescript
// ProctoringService.ts

class ProctoringService {
  private violations: ViolationRecord[] = [];

  startProctoring() {
    // Enter fullscreen
    document.documentElement.requestFullscreen();

    // Monitor fullscreen exits
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    // Monitor tab visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Disable right-click
    document.addEventListener('contextmenu', this.preventDefault);

    // Disable copy/paste
    document.addEventListener('copy', this.preventDefault);
    document.addEventListener('paste', this.preventDefault);

    // Disable keyboard shortcuts (Ctrl+C, Ctrl+V, etc.)
    document.addEventListener('keydown', this.handleKeydown);

    // Optional: Start webcam monitoring
    if (this.webcamEnabled) {
      this.startWebcamCapture();
    }
  }

  handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      this.recordViolation('fullscreen_exit');
    }
  };

  handleVisibilityChange = () => {
    if (document.hidden) {
      this.recordViolation('tab_switch');
    }
  };

  recordViolation(type: string) {
    this.violations.push({ type, timestamp: new Date() });

    // Send to server
    fetch('/functions/v1/record-proctor-event', {
      method: 'POST',
      body: JSON.stringify({
        proctored_session_id: this.sessionId,
        event_type: type,
      }),
    });

    // Check if should disqualify
    if (this.violations.length >= 5) {
      this.disqualifyAttempt();
    }
  }
}
```

#### Certificate PDF Generation
Using Puppeteer or a PDF library:

```typescript
// generate-certificate-pdf.ts

async function generateCertificatePDF(certificate: Certificate): Promise<string> {
  const html = renderCertificateHTML(certificate);

  // Option 1: Puppeteer (if available)
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ format: 'A4', landscape: true });
  await browser.close();

  // Upload to storage
  const url = await uploadToStorage(`certificates/${certificate.id}.pdf`, pdf);

  return url;
}

function renderCertificateHTML(cert: Certificate): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          /* Certificate styling */
          body { font-family: 'Georgia', serif; }
          .certificate {
            border: 20px solid #1a1a2e;
            padding: 40px;
            text-align: center;
          }
          /* ... more styles */
        </style>
      </head>
      <body>
        <div class="certificate">
          <h1>CERTIFICATE OF COMPLETION</h1>
          <p>This certifies that</p>
          <h2>${cert.holder_name}</h2>
          <p>has successfully completed</p>
          <h3>${cert.course_title}</h3>
          <!-- ... more content -->
          <img src="${cert.qr_code_url}" alt="QR Code" />
        </div>
      </body>
    </html>
  `;
}
```

---

## 11. Database Schema - Complete Summary

### 11.1 New Tables Required

| Table | Section | Priority | Description |
|-------|---------|----------|-------------|
| `instructor_verifications` | 1 | P1 | Instructor verification requests |
| `instructor_invite_codes` | 1 | P1 | Pre-approved invite codes |
| `organizations` | 2 | P2 | B2B institutional customers |
| `organization_members` | 2 | P2 | Org membership |
| `organization_invitations` | 2 | P2 | Pending org invitations |
| `employer_accounts` | 3 | P3 | Employer customers |
| `employer_api_keys` | 3 | P3 | API credentials |
| `employer_api_requests` | 3 | P3 | API audit log |
| `employer_webhooks` | 3 | P3 | Webhook configurations |
| `employer_recruiting_searches` | 3 | P3 | Saved candidate searches |
| `employer_candidate_contacts` | 3 | P3 | Outreach tracking |
| `course_creation_costs` | 4 | P1 | Per-stage cost tracking |
| `identity_verifications` | 5 | P1 | Student IDV records |
| `enrollment_transactions` | 6 | P1 | Enrollment payments |
| `generation_triggers` | 7 | P2 | Demand-based triggers |
| `generation_trigger_checks` | 7 | P2 | Trigger check log |
| `certificates` | 8 | P0 | Issued certificates |
| `proctored_sessions` | 8 | P2 | Proctoring records |
| `certificate_verifications` | 8 | P0 | Verification audit log |

### 11.2 Table Alterations Required

| Table | New Columns | Section |
|-------|-------------|---------|
| `profiles` | `is_instructor_verified`, `instructor_verification_id`, `instructor_trust_score`, `is_identity_verified`, `identity_verification_id`, `organization_id`, `organization_role` | 1, 2, 5 |
| `instructor_courses` | `creation_fee_paid`, `creation_fee_payment_id`, `pipeline_stage`, `generation_credits` | 4, 7 |
| `course_enrollments` | `enrollment_fee_paid`, `enrollment_fee_payment_id`, `identity_verified_at_enrollment`, `completed_with_verified_identity` | 6 |

### 11.3 Migration Order

Run migrations in this order to satisfy foreign key constraints:

```sql
-- Phase 1: Foundation tables (no dependencies)
1. instructor_verifications
2. instructor_invite_codes
3. identity_verifications
4. organizations

-- Phase 2: Dependent tables
5. organization_members (depends on: organizations)
6. organization_invitations (depends on: organizations)
7. employer_accounts (depends on: organizations)
8. employer_api_keys (depends on: employer_accounts)

-- Phase 3: Feature tables
9. employer_api_requests (depends on: employer_api_keys)
10. employer_webhooks (depends on: employer_accounts)
11. employer_recruiting_searches (depends on: employer_accounts)
12. employer_candidate_contacts (depends on: employer_accounts)
13. course_creation_costs (depends on: instructor_courses)
14. enrollment_transactions (depends on: course_enrollments)
15. generation_triggers (depends on: instructor_courses, batch_jobs)
16. generation_trigger_checks (no dependencies)

-- Phase 4: Certification tables
17. certificates (depends on: identity_verifications, assessment_sessions)
18. proctored_sessions (depends on: assessment_sessions)
19. certificate_verifications (depends on: certificates, employer_api_keys)

-- Phase 5: Alter existing tables
20. ALTER profiles (add new columns)
21. ALTER instructor_courses (add new columns)
22. ALTER course_enrollments (add new columns)
```

---

## 12. API Contracts - Complete Summary

### 12.1 New Edge Functions Required

| Function | Section | Priority | Auth | Description |
|----------|---------|----------|------|-------------|
| `verify-instructor-email` | 1 | P1 | Public | Check .edu domain |
| `submit-instructor-verification` | 1 | P1 | User | Submit verification request |
| `review-instructor-verification` | 1 | P1 | Admin | Approve/reject |
| `use-instructor-invite-code` | 1 | P1 | User | Redeem invite code |
| `create-organization` | 2 | P2 | User | Create B2B org |
| `invite-organization-members` | 2 | P2 | Admin | Send invitations |
| `configure-organization-sso` | 2 | P3 | Admin | Set up SSO |
| `employer-verify-completion` | 3 | P3 | API Key | Public verification API |
| `initiate-course-creation` | 4 | P1 | User | Start course with payment |
| `process-course-creation` | 4 | P1 | Internal | Pipeline processing |
| `initiate-identity-verification` | 5 | P1 | User | Start IDV |
| `idv-webhook` | 5 | P1 | Webhook | Handle Persona callbacks |
| `identity-verification-status` | 5 | P1 | User | Check IDV status |
| `enroll-in-course` | 6 | P1 | User | Enroll with payment |
| `complete-enrollment-payment` | 6 | P1 | Webhook | Handle payment |
| `trigger-progressive-generation` | 7 | P2 | Cron | Check and trigger generation |
| `use-generation-credit` | 7 | P2 | User | Instructor credit usage |
| `retry-failed-generation` | 7 | P2 | Admin | Retry failed jobs |
| `purchase-certificate` | 8 | P0 | User | Buy certificate |
| `issue-certificate` | 8 | P0 | Internal | Create certificate |
| `start-proctored-assessment` | 8 | P2 | User | Begin proctored test |
| `record-proctor-event` | 8 | P2 | User | Log violations |
| `verify-certificate` | 8 | P0 | Public | Public verification |
| `generate-certificate-pdf` | 8 | P0 | Internal | PDF generation |

### 12.2 External API (Employer)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/verify/certificate` | POST | API Key | Verify a certificate |
| `/api/v1/completions` | GET | API Key | List completions |
| `/api/v1/webhooks/configure` | POST | API Key | Set up webhooks |

---

## 13. Implementation Checklist

### Phase 0: Immediate Revenue (Certificates)

**Goal:** Launch certificate system for revenue generation

- [ ] **Database**
  - [ ] Create `certificates` table
  - [ ] Create `certificate_verifications` table
  - [ ] Add certificate fields to `course_enrollments`

- [ ] **Backend**
  - [ ] `purchase-certificate` Edge Function
  - [ ] `issue-certificate` Edge Function
  - [ ] `verify-certificate` Edge Function (public)
  - [ ] `generate-certificate-pdf` Edge Function
  - [ ] Stripe integration for certificate payments

- [ ] **Frontend**
  - [ ] `CertificateSelection.tsx` - Choose certificate type
  - [ ] `CertificateDisplay.tsx` - View certificate
  - [ ] `MyCertificates.tsx` - List user's certificates
  - [ ] Certificate checkout flow
  - [ ] Public verification page `/certificate/:id`

- [ ] **Testing**
  - [ ] Test certificate purchase flow
  - [ ] Test PDF generation
  - [ ] Test public verification
  - [ ] Test Stripe webhooks

### Phase 1: Trust Infrastructure

**Goal:** Enable instructor and student verification

- [ ] **Instructor Verification**
  - [ ] Create `instructor_verifications` table
  - [ ] Create `instructor_invite_codes` table
  - [ ] `verify-instructor-email` Edge Function
  - [ ] `submit-instructor-verification` Edge Function
  - [ ] `review-instructor-verification` Edge Function
  - [ ] `InstructorSignupEmail.tsx`
  - [ ] `InstructorAlternativeVerification.tsx`
  - [ ] `InstructorAffiliationForm.tsx`
  - [ ] `InstructorVerificationPending.tsx`
  - [ ] `AdminInstructorReviewQueue.tsx`
  - [ ] `AdminInstructorReviewDetail.tsx`
  - [ ] `InstructorVerificationBadge.tsx`

- [ ] **Student IDV**
  - [ ] Create `identity_verifications` table
  - [ ] Set up Persona account and template
  - [ ] `initiate-identity-verification` Edge Function
  - [ ] `idv-webhook` Edge Function
  - [ ] `IdentityVerificationPrompt.tsx`
  - [ ] `IdentityVerificationProcess.tsx` (Persona embed)
  - [ ] `IdentityVerificationSuccess.tsx`
  - [ ] `IdentityVerificationFailed.tsx`

- [ ] **Payment Gates**
  - [ ] Add payment fields to `instructor_courses`
  - [ ] Add payment fields to `course_enrollments`
  - [ ] `CourseCreationPaymentGate.tsx`
  - [ ] `EnrollmentPaymentModal.tsx`
  - [ ] Modify course creation flow
  - [ ] Modify enrollment flow

### Phase 2: Automation & Proctoring

**Goal:** Automate content generation and enable proctored assessments

- [ ] **Progressive Generation**
  - [ ] Create `generation_triggers` table
  - [ ] Create `generation_trigger_checks` table
  - [ ] `trigger-progressive-generation` Edge Function
  - [ ] Set up cron job (pg_cron or external)
  - [ ] `use-generation-credit` Edge Function
  - [ ] `AdminGenerationMonitor.tsx`
  - [ ] `InstructorGenerationTab.tsx`
  - [ ] Add generation credits to instructor courses

- [ ] **Proctoring**
  - [ ] Create `proctored_sessions` table
  - [ ] `start-proctored-assessment` Edge Function
  - [ ] `record-proctor-event` Edge Function
  - [ ] `ProctoringService.ts` (browser lockdown)
  - [ ] `ProctoredAssessmentStart.tsx`
  - [ ] `ProctoredAssessmentSession.tsx`
  - [ ] Webcam capture (optional)

### Phase 3: B2B Products

**Goal:** Launch institutional licensing and employer access

- [ ] **Organizations**
  - [ ] Create `organizations` table
  - [ ] Create `organization_members` table
  - [ ] Create `organization_invitations` table
  - [ ] `create-organization` Edge Function
  - [ ] `invite-organization-members` Edge Function
  - [ ] `OrganizationSetupWizard.tsx`
  - [ ] `OrganizationDashboard.tsx`
  - [ ] `OrganizationMembers.tsx`
  - [ ] License tier selection
  - [ ] Stripe subscription for orgs

- [ ] **Employer Access**
  - [ ] Create `employer_accounts` table
  - [ ] Create `employer_api_keys` table
  - [ ] Create `employer_api_requests` table
  - [ ] Create `employer_webhooks` table
  - [ ] `employer-verify-completion` Edge Function
  - [ ] `EmployerDashboard.tsx`
  - [ ] `EmployerAPIKeys.tsx`
  - [ ] `EmployerAPIDocs.tsx`
  - [ ] `EmployerRecruitingSearch.tsx`
  - [ ] API rate limiting
  - [ ] Webhook delivery system

- [ ] **SSO (Pro+)**
  - [ ] `configure-organization-sso` Edge Function
  - [ ] SAML integration
  - [ ] OIDC integration
  - [ ] `SSOConfigPage.tsx`

---

## 14. Cost & Revenue Summary

### 14.1 Platform Costs

| Operation | Cost |
|-----------|------|
| Course creation (AI) | ~$0.75 |
| Identity verification | ~$0.50 |
| Slide generation (per unit) | ~$0.03 |
| Module generation | ~$0.50 |
| Certificate PDF | ~$0.01 |

### 14.2 Revenue Streams

| Product | Price | Margin |
|---------|-------|--------|
| Course creation fee | $1.00 | ~$0.25 |
| Enrollment fee | $1.00 | ~$0.50 |
| Completion badge | $0 | N/A |
| Verified certificate | $25 | ~$24 |
| Assessed certificate | $49 | ~$48 |
| Basic license | $5K/yr | High |
| Pro license | $15K/yr | High |
| Enterprise license | $50K/yr | High |
| Verification API | $2K/yr | High |
| Recruiting portal | $500/seat/yr | High |

### 14.3 Break-even Analysis

For a course with 100 students purchasing verified certificates:
- Revenue: 100 × $25 = $2,500
- Costs: ~$50 (verification) + ~$100 (content gen) = $150
- Profit: ~$2,350 per course

---

## 15. Third-Party Integrations

### 15.1 Required Integrations

| Service | Purpose | Priority | Est. Cost |
|---------|---------|----------|-----------|
| **Persona** | Student identity verification | P1 | ~$0.50/verification |
| **Stripe** | Payments (already integrated) | P0 | 2.9% + $0.30 |
| **Puppeteer/PDF** | Certificate generation | P0 | Compute cost |
| **QR Code lib** | Certificate QR codes | P0 | Free |

### 15.2 Optional Integrations

| Service | Purpose | Priority | Est. Cost |
|---------|---------|----------|-----------|
| **Polygon/Blockchain** | Certificate anchoring | P3 | ~$0.01/anchor |
| **WorkOS** | Enterprise SSO | P3 | ~$100/mo |
| **LTI 1.3** | LMS integration | P3 | Implementation time |
| **Webcam AI** | Proctoring monitoring | P3 | ~$1/session |

---

## 16. Risk Mitigation

### 16.1 Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Persona integration delays | Delays IDV launch | Have Jumio as backup |
| PDF generation failures | Certificate delivery | Queue + retry mechanism |
| Proctoring browser compat | Student complaints | Graceful degradation |
| Progressive gen cost spikes | Budget overrun | Hard limits, monitoring |

### 16.2 Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low certificate purchases | Revenue miss | Focus on assessed value prop |
| Instructor adoption | Supply shortage | Invite codes for trusted early adopters |
| B2B sales cycle | Slow revenue | Launch B2C certificates first |
| Fraud/cheating | Trust erosion | Proctoring + verification |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-25 | Claude | Initial complete wireframe specification |

---

**END OF WIREFRAME SPECIFICATION**

