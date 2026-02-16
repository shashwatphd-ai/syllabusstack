# SyllabusStack — Complete Product Report

> Generated from codebase analysis on 2026-02-16. Based solely on reading the actual source code, database schema, edge functions, and frontend components.

---

## 1. Product Overview

**SyllabusStack** is an AI-powered career-skills bridge platform that connects university coursework to job-market requirements. It enables students to understand their real-world readiness for target careers and provides structured, personalized learning paths to close skill gaps.

### Core Value Proposition

Students upload their course transcripts and identify dream jobs. The platform uses AI to:
1. Extract capabilities from syllabi
2. Analyze job requirements from target positions
3. Perform gap analysis comparing student skills vs. job demands
4. Generate personalized action plans with real course recommendations
5. Provide verified assessments and employer-verifiable certificates

### Target Users

| User Type | Description |
|-----------|-------------|
| **Students** | University/college students planning careers |
| **Instructors** | Educators creating and managing courses |
| **Employers** | Companies verifying candidate skills and certificates |
| **Admins** | Platform administrators managing users, content, and operations |

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.8.3 | Type safety |
| Vite | 5.4.19 | Build tool & dev server |
| React Router | 7.12.0 | Client-side routing |
| Tailwind CSS | 3.4.17 | Utility-first styling |
| shadcn/ui (Radix) | 60+ components | Component library |
| TanStack Query | 5.83.0 | Server state & caching |
| React Hook Form | 7.61.1 | Form management |
| Zod | 3.25.76 | Schema validation |
| Recharts | 2.15.4 | Data visualization |
| Lucide React | 0.462.0 | Icon library |

### Backend
| Technology | Purpose |
|------------|---------|
| Supabase | BaaS (PostgreSQL + Auth + Edge Functions + Storage) |
| Deno | Runtime for 85 Edge Functions |
| PostgreSQL | Relational database (via Supabase) |
| Row Level Security (RLS) | Database-level access control |

### AI & External Services
| Service | Purpose |
|---------|---------|
| OpenRouter API | LLM gateway (Claude, Gemini, Perplexity routing) |
| Google Vertex AI | Batch processing for curriculum & evaluation |
| Perplexity Sonar Pro | Research grounding for lecture slides |
| Firecrawl | Web scraping for real course discovery |
| YouTube API | Video content matching |
| Khan Academy API | Educational content |
| O*NET Database | Occupation data, skills taxonomy, RIASEC codes |
| Stripe | Payment processing & subscription management |
| Stripe Connect | Seller payouts (future) |
| RapidAPI (Active Jobs DB) | Job search integration |

### Development & Testing
| Tool | Purpose |
|------|---------|
| Vitest | Unit testing framework |
| Testing Library | Component testing |
| ESLint | Linting |
| Bun | Package manager (lockfile present) |

---

## 3. Feature Inventory

### 3.1 Student Features

#### Transcript Management (`/learn`)
- **Add courses** manually with title, code, semester, credits
- **Upload syllabi** (PDF, DOCX, TXT) for AI extraction of capabilities
- **Bulk operations**: select multiple courses, bulk status change, bulk delete, CSV export
- **Course statuses**: completed (with grade), in_progress, planned
- **Re-analyze**: upload new syllabus to re-extract skills from a course
- **Skill Profile**: unified view of verified (assessment-backed) and self-reported skills
- **Proficiency levels**: beginner, intermediate, advanced, expert

#### Career Planning (`/career`)
- **Dream Jobs**: add target positions with title, company type, location
- **AI Job Analysis**: extracts requirements, day-one capabilities, differentiators, misconceptions, realistic hiring bar
- **Skills Assessment**: Holland RIASEC questionnaire (standard or quick mode) with Likert scales, sliders, forced choice
- **Career Matching**: O*NET occupation matching using Iachan's M Index (Holland), skill gap scoring, work values alignment
- **Gap Analysis**: AI-powered comparison of student capabilities vs. job requirements
  - Match score (0-100%)
  - Strong/partial overlaps
  - Critical gaps with time-to-close estimates
  - Readiness levels: ready_to_apply, 3_months_away, 6_months_away, 1_year_away, needs_significant_development
  - Honest assessment, interview readiness, job success prediction
- **Action Plan**: AI-generated recommendations (projects, courses, skills, actions, experiences)
  - Priority ranking with steps and time estimates
  - Evidence-creating activities emphasized
  - Free/paid course filtering with "Free First" toggle
- **Course Discovery**: Firecrawl-powered web scraping finds real courses matching gaps
- **Anti-Recommendations**: things NOT to do for the target role
- **Currently Learning Panel**: links enrolled courses to specific recommendations
- **Dream Job Selector**: switch between multiple dream jobs, set primary

#### Active Course Learning (`/learn/course/:id`)
- **Enrollment via access code** from instructor
- **Progress tracking**: overall percentage, per-module, per-learning-objective
- **Learning Objective Verification State Machine**:
  - `unstarted` → `in_progress` → `verified` → `assessment_unlocked` → `passed`
  - Failed assessment → `remediation_required` (retry path)
- **Video content consumption** with embedded micro-checks
- **Micro-checks**: questions triggered at specific video timestamps, auto-rewind on wrong answer
- **Assessments**: multiple choice/open-ended, server-side grading, timing anomaly detection
- **Lecture Slides**: AI-generated presentation slides with speaker notes

#### Certificates (`/certificate/:id`)
- **Three types**: completion_badge, verified (identity-verified), assessed (with mastery score)
- **Public verification**: `/verify/:shareToken` — anyone can verify a certificate
- **Skill breakdown**: per-skill scores on assessed certificates
- **Certificate stats**: total, by type, average mastery score

#### Identity Verification (`/verify-identity`)
- **KYC/IDV integration** via webhooks
- **Status tracking**: initiated → pending → verified/failed
- **Required for "verified" certificates**

#### Profile & Settings
- **Profile page** (`/profile`): personal info, onboarding status
- **Settings** (`/settings`): email preferences
- **Billing** (`/billing`): subscription management, pricing table, billing history
- **Usage** (`/usage`): AI usage tracking
- **Learning Path** (`/learning-path`): generated curriculum from career matches

### 3.2 Instructor Features

#### Course Creation & Management (`/instructor/courses`)
- **Quick Setup** (`/instructor/quick-setup`): AI-powered course creation from syllabus
- **Course details**: title, code, description, domain configuration
- **Curation modes**: full_control, guided_auto, hands_off
- **Access codes**: auto-generated 6-char unique codes for student enrollment
- **Publish/Draft** toggle
- **Duplicate course**: batch copies modules, learning objectives with new access code

#### Course Content
- **Modules**: ordered sequence with titles and descriptions
- **Learning Objectives**: Bloom's taxonomy levels (remember through create), action verbs, estimated duration
- **Content Matching**: AI-powered YouTube video search with relevance scores, auto-approval for high scores
- **Lecture Slides** (v3): AI-generated with research grounding (Perplexity), visual directives, speaker notes (CMM method), quality metrics
- **Content Curation Panel**: review, approve, reject matched content

#### Student Management
- **Enrolled students list** with progress tracking
- **Gradebook** (`/instructor/courses/:courseId/gradebook`): per-student per-objective grades
- **Course Analytics** (`/instructor/courses/:courseId/analytics`): engagement charts
- **Student messaging**: send messages to enrolled students
- **Verification threshold**: configurable passing percentage

#### Instructor Verification (`/instructor/verification`)
- **.edu emails**: auto-verified
- **Other emails**: manual review queue (1-2 business days)
- **Trust score**: earned through verification
- **Required for**: issuing certificates, increased platform trust

### 3.3 Employer Features

#### Dashboard (`/employer`)
- **Skills verification**: verify candidate skills against platform data
- **Certificate verification**: check completion/assessment certificates
- **Batch verification upload**: bulk CSV of candidates to verify

#### API Integration
- **API Documentation** (`/employer/api-docs`): public endpoint docs
- **Webhook Settings** (`/employer/webhooks`): configure event webhooks
- **Webhook events**: certificate issuance, completion verification

### 3.4 Admin Features (`/admin`)

| Feature | Route | Purpose |
|---------|-------|---------|
| Dashboard | `/admin` | System overview, key metrics |
| User Management | `/admin/users` | CRUD users, assign roles |
| Role Management | `/admin/roles` | Define and manage user roles |
| Course Management | `/admin/courses` | Moderate all courses |
| Content Moderation | `/admin/content-moderation` | Review flagged content |
| Instructor Review Queue | `/admin/instructor-review` | Approve/deny instructor applications |
| Outcomes Report | `/admin/outcomes` | Platform-wide learning outcomes |
| Branding Settings | `/admin/branding` | Customize platform appearance |
| System Health | `/admin/system-health` | Monitor system performance |
| Organization Dashboard | `/organization` | Multi-tenant org management |

### 3.5 Public Features

| Feature | Route | Purpose |
|---------|-------|---------|
| Landing Page | `/` | Hero, features, pricing sections |
| Employers Page | `/employers` | Employer value proposition |
| Universities Page | `/universities` | University partnership info |
| How It Works | `/how-it-works` | Product explainer |
| Syllabus Scanner | `/scanner` | Public demo tool |
| Help Center | `/help` | Knowledge base |
| Legal | `/legal` | Terms, privacy |
| Certificate Verify | `/verify/:token` | Public cert verification |

---

## 4. Pricing & Monetization

**Mentioned in code:**
- **Free tier**: Limited features, $1 per instructor course creation
- **Pro subscription**: Unlimited course creation, advanced features
- **Certificate purchases**: Students can purchase verified/assessed certificates
- **Stripe integration**: Checkout sessions, customer portal, subscription management, invoices
- **Payment flows**: `/checkout` → `/payment-success` or `/payment-cancel`

---

## 5. Codebase Statistics

| Metric | Count |
|--------|-------|
| Frontend Components | 200+ files across 31 directories |
| Custom React Hooks | 80+ files |
| Pages | 36+ route components |
| Supabase Edge Functions | 85 serverless functions |
| Database Migrations | 116 SQL migration files |
| UI Components (shadcn/ui) | 60+ base components |
| Frontend TypeScript LOC | ~33,880 lines |
| Type Definition Files | 3 + 1 auto-generated (157KB) |
| Service Files | 7 business logic services |
| Utility Libraries | 18 lib files |
| Test Files | 11 test files |

---

## 6. Navigation Architecture

### Primary Navigation (all authenticated users)
| Item | Route | Icon |
|------|-------|------|
| Dashboard | `/dashboard` | LayoutDashboard |
| My Learning | `/learn` | GraduationCap |
| Career Path | `/career` | Briefcase |
| Teach | `/teach` | School |

### Role-Specific Navigation
| Role | Item | Route |
|------|------|-------|
| Instructor | Instructor Portal | `/instructor/courses` |
| Admin | Admin Portal | `/admin` |

### Secondary Navigation
| Item | Route |
|------|-------|
| Profile | `/profile` |
| AI Usage | `/usage` |
| Billing | `/billing` |
| Settings | `/settings` |

### Route Protection
- **Public**: Landing, employers, universities, help, legal, scanner, certificate verification
- **GuestGuard**: Auth page, forgot password (redirect if already logged in)
- **AuthGuard**: All authenticated routes (dashboard, learn, career, teach, profile, etc.)
- **AdminGuard**: All `/admin/*` routes (requires admin role)

### Legacy Redirects
| Old Route | Redirects To |
|-----------|-------------|
| `/courses` | `/learn?tab=transcript` |
| `/dream-jobs` | `/career?tab=jobs` |
| `/analysis` | `/career?tab=gaps` |
| `/recommendations` | `/career?tab=actions` |

---

## 7. Authentication System

### Auth Provider (`AuthContext`)
- **Supabase Auth**: email/password authentication
- **Session management**: automatic session persistence and refresh
- **Profile loading**: queries `profiles_safe` view (excludes Stripe fields at DB level)
- **Onboarding gate**: `isOnboarded` flag controls post-signup flow
- **Sign up**: email + password with optional full_name metadata, email redirect
- **Sign in**: email + password via `signInWithPassword`
- **Sign out**: clears all local state
- **Password reset**: forgot password → email link → reset password flow

### Role System
- **Roles**: student (default), instructor, admin
- **Role check**: `useUserRoles()` hook queries user_roles table
- **Navigation adaptation**: sidebar items change based on role
- **Instructor auto-detection**: admin role includes instructor privileges

---

## 8. Key Product Differentiators (from code analysis)

1. **Honest Assessment**: Unlike typical career platforms, explicitly tells users their readiness level and interview preparedness — not just positive spin
2. **Anti-Recommendations**: Unique "what NOT to do" feature that prevents common career mistakes
3. **Weibull Skill Decay Model**: Skills lose verification value over time using survival probability curves
4. **Research-Grounded Lectures**: Slides are backed by Perplexity-sourced citations, not just AI generation
5. **Verification State Machine**: Strict learning path enforcement (must watch content → pass micro-checks → pass assessment)
6. **Timing Anomaly Detection**: Assessments track response times to detect suspicious behavior
7. **Career Match Psychometrics**: Uses validated Iachan's M Index for Holland code matching, not simple keyword matching
8. **Gap-to-Course Pipeline**: From skill gap → AI recommendation → real course discovery (Firecrawl) → enrollment → progress tracking → certificate
9. **Employer Verification API**: Certificates are verifiable by employers via public URLs and webhooks
10. **Multi-Source Skill Profile**: Combines self-reported skills (from syllabus) with assessment-verified skills in a unified profile
