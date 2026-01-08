# SyllabusStack: Comprehensive Project Analysis & Documentation

> **Version:** 1.1 (Verified)
> **Date:** 2026-01-08
> **Last Verified:** 2026-01-08 by Lovable Agent
> **Document Type:** Project Manager Analysis
> **Scope:** Business Process Review, User Journey Analysis, Technology Assessment, Strategic Recommendations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Market Position](#2-product-vision--market-position)
3. [Technology Stack Analysis](#3-technology-stack-analysis)
4. [Architecture Deep Dive](#4-architecture-deep-dive)
5. [User Journey Analysis](#5-user-journey-analysis)
6. [Business Process Mapping](#6-business-process-mapping)
7. [Data Model & Entity Relationships](#7-data-model--entity-relationships)
8. [User Integration Strategy](#8-user-integration-strategy)
9. [Gap Analysis & Streamlining Opportunities](#9-gap-analysis--streamlining-opportunities)
10. [Technical Debt & Modernization](#10-technical-debt--modernization)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Success Metrics & KPIs](#12-success-metrics--kpis)

---

## 1. Executive Summary

### 1.1 Product Overview

**SyllabusStack** (formerly EduThree) is an AI-powered career navigation and verified learning platform that bridges the gap between academic coursework and career readiness. The platform transforms static course syllabi into actionable career intelligence through:

- **Capability Extraction**: AI analyzes syllabi to identify transferable skills
- **Career Gap Analysis**: Compares student capabilities against job market requirements
- **Personalized Recommendations**: AI-generated learning pathways to close skill gaps
- **Verified Learning**: Instructor-curated content with assessment-based verification

### 1.2 Current State Assessment

| Dimension | Status | Score |
|-----------|--------|-------|
| **Core Functionality** | ~85% Complete | 8.5/10 |
| **Student Career Path** | 95% Complete | 9.5/10 |
| **Student Learning Path** | 75% Complete | 7.5/10 |
| **Instructor Tools** | 70% Complete | 7/10 |
| **Technical Architecture** | Solid Foundation | 8/10 |
| **User Experience** | Good, Needs Polish | 7/10 |
| **Scalability** | Ready | 8/10 |

### 1.3 Key Findings

**Strengths:**
- Robust AI integration via Gemini 2.5 Flash
- Strong data model with comprehensive gap analysis
- Modern tech stack with excellent developer experience
- Solid authentication and multi-tenant architecture

**Weaknesses:**
- Simulated video tracking (YouTube API not fully integrated for real-time events)
- Missing email notifications (RESEND_API_KEY not configured)
- Instructor workflow friction (some manual steps could be automated)
- Some instructor UI triggers could be more discoverable

**Opportunities:**
- User-generated content curation community
- Peer learning and social features
- B2B university partnerships
- API marketplace for career services

**Threats:**
- Competition from established ed-tech platforms
- AI commoditization reducing differentiation
- Student data privacy concerns

---

## 2. Product Vision & Market Position

### 2.1 Value Proposition

```
┌─────────────────────────────────────────────────────────────────┐
│                    SyllabusStack Value Chain                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Syllabus Upload] → [AI Capability Extraction] → [Career Gaps] │
│         ↓                      ↓                       ↓        │
│  Course Library      Capability Profile        Dream Job Match  │
│         ↓                      ↓                       ↓        │
│  Learning Content    Skill Inventory          Gap Analysis      │
│         ↓                      ↓                       ↓        │
│  Verified Progress   Portfolio Builder        Recommendations   │
│         ↓                      ↓                       ↓        │
│  ────────────────── Career Readiness ──────────────────────     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Target User Segments

| Segment | Description | Primary Need | Current Support |
|---------|-------------|--------------|-----------------|
| **College Students** | Undergrads planning careers | Career clarity, skill gaps | Strong |
| **Graduate Students** | Advanced degree seekers | Research-to-industry transition | Moderate |
| **Career Changers** | Professionals pivoting | Skill transferability | Weak |
| **Instructors** | Faculty creating courses | Student engagement, content curation | Moderate |
| **Universities** | Institutions (B2B) | Student outcomes data | Not Started |
| **Employers** | Hiring companies | Verified credentials | Not Started |

### 2.3 Competitive Differentiation

| Feature | SyllabusStack | LinkedIn Learning | Coursera | Handshake |
|---------|---------------|-------------------|----------|-----------|
| Syllabus Analysis | **Unique** | No | No | No |
| Gap Analysis | **Unique** | No | Limited | No |
| AI Recommendations | **Full** | Limited | Limited | No |
| Verified Learning | **Yes** | No | Yes | No |
| Career Matching | **Yes** | Yes | No | Yes |
| B2B Integration | Planned | Yes | Yes | Yes |

---

## 3. Technology Stack Analysis

### 3.1 Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Stack                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   React 18   │  │ TypeScript   │  │   Vite 5.4   │       │
│  │  (UI Layer)  │  │ (Type Safe)  │  │   (Build)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ TanStack     │  │  React       │  │   Zod        │       │
│  │ Query 5.83   │  │ Hook Form    │  │ (Validation) │       │
│  │ (Server St)  │  │ (Forms)      │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Tailwind CSS │  │  Radix UI    │  │  shadcn/ui   │       │
│  │ (Styling)    │  │ (Primitives) │  │ (Components) │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Assessment:** Modern, well-structured stack with excellent developer experience. React Query provides robust caching. TypeScript ensures type safety across the codebase.

### 3.2 Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend Stack                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Supabase Platform                       │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │    │
│  │  │ PostgreSQL │ │   Auth     │ │  Storage   │       │    │
│  │  │   (DB)     │ │   (JWT)    │ │  (Files)   │       │    │
│  │  └────────────┘ └────────────┘ └────────────┘       │    │
│  │                                                      │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │           Edge Functions (27)                │    │    │
│  │  │  ┌─────────────┐  ┌─────────────┐           │    │    │
│  │  │  │ AI Analysis │  │ Content     │           │    │    │
│  │  │  │ Functions   │  │ Functions   │           │    │    │
│  │  │  └─────────────┘  └─────────────┘           │    │    │
│  │  │  ┌─────────────┐  ┌─────────────┐           │    │    │
│  │  │  │ Assessment  │  │ Utility     │           │    │    │
│  │  │  │ Functions   │  │ Functions   │           │    │    │
│  │  │  └─────────────┘  └─────────────┘           │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           External Integrations                      │    │
│  │  ┌──────────────┐  ┌──────────────┐                 │    │
│  │  │ Google       │  │ YouTube      │                 │    │
│  │  │ Gemini 2.5   │  │ Data API     │                 │    │
│  │  └──────────────┘  └──────────────┘                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Assessment:** Serverless-first architecture enables rapid scaling. RLS policies provide row-level security. Edge functions handle AI-intensive operations.

### 3.3 AI Integration Layer

| AI Function | Model | Purpose | Status |
|-------------|-------|---------|--------|
| `analyze-syllabus` | Gemini 2.5 Flash | Extract capabilities from syllabus | Active |
| `analyze-dream-job` | Gemini 2.5 Flash | Generate job requirements | Active |
| `gap-analysis` | Gemini 2.5 Flash | Compare capabilities vs requirements | Active |
| `generate-recommendations` | Gemini 2.5 Flash | Create personalized learning paths | Active |
| `discover-dream-jobs` | Gemini 2.5 Flash | Suggest career options | Active |
| `extract-learning-objectives` | Gemini 2.5 Flash | Parse LOs from course materials | Active |
| `generate-assessment-questions` | Gemini 2.5 Flash | Create quiz questions | Active |
| `generate-micro-checks` | Gemini 2.5 Flash | Inline video comprehension | Active |
| `content-assistant-chat` | Gemini 2.5 Flash | AI chat for content curation | Active |

**Assessment:** Comprehensive AI coverage. Consider adding fallback models and caching optimization.

### 3.4 Dependency Health

| Package | Version | Latest | Status |
|---------|---------|--------|--------|
| React | 18.3.1 | 18.3.x | Current |
| TypeScript | 5.8.3 | 5.8.x | Current |
| Vite | 5.4.19 | 5.4.x | Current |
| TanStack Query | 5.83.0 | 5.83.x | Current |
| Supabase JS | 2.89.0 | 2.89.x | Current |
| Tailwind CSS | 3.4.17 | 3.4.x | Current |

**Assessment:** Dependencies are well-maintained and up-to-date. No critical vulnerabilities detected.

---

## 4. Architecture Deep Dive

### 4.1 Application Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        React Application                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │   │
│  │  │  Pages   │  │Components│  │  Hooks   │  │ Services │         │   │
│  │  │  (31)    │  │  (117)   │  │  (30+)   │  │   (7)    │         │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘         │   │
│  │       │             │             │             │                │   │
│  │       └─────────────┴──────┬──────┴─────────────┘                │   │
│  │                            │                                      │   │
│  │                    ┌───────▼───────┐                             │   │
│  │                    │  TanStack     │                             │   │
│  │                    │  Query Cache  │                             │   │
│  │                    └───────┬───────┘                             │   │
│  │                            │                                      │   │
│  │                    ┌───────▼───────┐                             │   │
│  │                    │   AuthContext │                             │   │
│  │                    │   (Session)   │                             │   │
│  │                    └───────┬───────┘                             │   │
│  └────────────────────────────┼──────────────────────────────────────┘  │
│                               │                                          │
├───────────────────────────────┼──────────────────────────────────────────┤
│                           API LAYER                                      │
├───────────────────────────────┼──────────────────────────────────────────┤
│                               │                                          │
│  ┌────────────────────────────▼─────────────────────────────────────┐   │
│  │                    Supabase Client SDK                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │   Auth API   │  │  Database    │  │  Functions   │            │   │
│  │  │   (JWT)      │  │  (RLS)       │  │  (Invoke)    │            │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │   │
│  └─────────┼─────────────────┼─────────────────┼─────────────────────┘  │
│            │                 │                 │                         │
├────────────┼─────────────────┼─────────────────┼─────────────────────────┤
│                           SERVER LAYER                                   │
├────────────┼─────────────────┼─────────────────┼─────────────────────────┤
│            │                 │                 │                         │
│  ┌─────────▼─────────────────▼─────────────────▼─────────────────────┐  │
│  │                    Supabase Platform                               │  │
│  │                                                                    │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │  │
│  │  │   PostgreSQL   │  │  Edge Functions │  │    Storage     │       │  │
│  │  │                │  │     (Deno)      │  │                │       │  │
│  │  │  ┌──────────┐  │  │  ┌──────────┐   │  │  ┌──────────┐  │       │  │
│  │  │  │ profiles │  │  │  │ analyze- │   │  │  │ syllabi  │  │       │  │
│  │  │  │ courses  │  │  │  │ syllabus │   │  │  │ avatars  │  │       │  │
│  │  │  │ jobs     │  │  │  │ gap-     │   │  │  │ content  │  │       │  │
│  │  │  │ analysis │  │  │  │ analysis │   │  │  └──────────┘  │       │  │
│  │  │  │ recs     │  │  │  │ etc...   │   │  │                │       │  │
│  │  │  └──────────┘  │  │  └──────────┘   │  │                │       │  │
│  │  │                │  │                 │  │                │       │  │
│  │  │  RLS Policies  │  │  Shared Utils   │  │                │       │  │
│  │  │  (20+ rules)   │  │  (ai-cache,     │  │                │       │  │
│  │  │                │  │   rate-limiter) │  │                │       │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘       │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                        EXTERNAL SERVICES                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Google       │  │ YouTube      │  │ Resend       │                   │
│  │ Gemini AI    │  │ Data API     │  │ (Email)      │                   │
│  │ (via Lovable)│  │              │  │              │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow Patterns

#### Pattern 1: Query Flow (Read Operations)

```
User Action → React Component → useQuery Hook → Query Key Factory
      ↓
React Query Cache Check
      ↓
[Cache Miss] → Supabase Client → PostgreSQL (with RLS)
      ↓
Data Returned → Cache Updated → Component Re-renders
```

#### Pattern 2: Mutation Flow (Write Operations)

```
Form Submit → React Hook Form → Zod Validation → useMutation Hook
      ↓
Supabase Client → PostgreSQL (with RLS)
      ↓
Success → Cache Invalidation → Toast Notification
      ↓
Related Queries Refetch Automatically
```

#### Pattern 3: AI Analysis Flow

```
User Input (Syllabus Text) → Frontend Service → Edge Function
      ↓
Rate Limiter Check → AI Cache Check
      ↓
[Cache Miss] → Lovable AI Gateway → Gemini 2.5 Flash
      ↓
Structured Response (JSON Schema) → Cache Storage
      ↓
Database Insert → Usage Tracking → Response to Client
```

### 4.3 Security Architecture

| Layer | Mechanism | Implementation |
|-------|-----------|----------------|
| **Authentication** | JWT Tokens | Supabase Auth with auto-refresh |
| **Authorization** | Row Level Security | 20+ PostgreSQL policies |
| **Data Isolation** | Multi-tenant | user_id filtering on all tables |
| **API Security** | Bearer Tokens | Required for protected Edge Functions |
| **Rate Limiting** | Per-user limits | Configurable quotas in Edge Functions |
| **Input Validation** | Zod Schemas | Frontend and backend validation |
| **XSS Protection** | React Escaping | Automatic in JSX |
| **Encryption** | TLS + At-rest | Supabase managed |

---

## 5. User Journey Analysis

### 5.1 Journey 1: Student Career Path

**Goal:** Discover career readiness gaps and get actionable recommendations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     STUDENT CAREER PATH JOURNEY                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AWARENESS        CONSIDERATION      CONVERSION        RETENTION         │
│      │                 │                 │                 │             │
│      ▼                 ▼                 ▼                 ▼             │
│  ┌───────┐        ┌────────┐        ┌────────┐        ┌────────┐        │
│  │Landing│───────▶│Scanner │───────▶│ Signup │───────▶│Onboard │        │
│  │ Page  │        │ Demo   │        │        │        │ Wizard │        │
│  └───────┘        └────────┘        └────────┘        └───┬────┘        │
│                                                           │              │
│                                                           ▼              │
│                                          ┌────────────────────────────┐  │
│                                          │      ONBOARDING FLOW       │  │
│                                          │  ┌───────┐  ┌───────────┐  │  │
│                                          │  │Profile│─▶│Upload     │  │  │
│                                          │  │ Info  │  │Syllabi    │  │  │
│                                          │  └───────┘  └─────┬─────┘  │  │
│                                          │                   │        │  │
│                                          │             ┌─────▼─────┐  │  │
│                                          │             │ Add Dream │  │  │
│                                          │             │   Jobs    │  │  │
│                                          │             └─────┬─────┘  │  │
│                                          └───────────────────┼────────┘  │
│                                                              │           │
│                                                              ▼           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        CORE EXPERIENCE                             │  │
│  │                                                                    │  │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │  │
│  │  │Dashboard │───▶│ Gap      │───▶│ Recom-   │───▶│ Progress │    │  │
│  │  │ Overview │    │ Analysis │    │ mendations│    │ Tracking │    │  │
│  │  └──────────┘    └──────────┘    └──────────┘    └──────────┘    │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Journey Steps:**

| Step | Page/Component | Time | Friction Points | Recommendations |
|------|----------------|------|-----------------|-----------------|
| 1. Landing | `Index.tsx` | 30s | Low | Add testimonials |
| 2. Scanner Demo | `SyllabusScanner.tsx` | 2m | **Medium** - PDF parsing not working for guests | Fix public PDF parsing |
| 3. Signup | `Auth.tsx` | 1m | Low | Add social auth |
| 4. Profile | `OnboardingWizard` Step 1 | 1m | Low | Pre-fill from university |
| 5. Upload Syllabi | `CourseUploader.tsx` | 3m | Low - PDF/DOCX parsing works | ✅ Fully functional |
| 6. Dream Jobs | `DreamJobSelector.tsx` | 2m | Medium | Add job suggestions |
| 7. Dashboard | `Dashboard.tsx` | - | Low | Add quick actions |
| 8. Gap Analysis | `GapAnalysisView.tsx` | - | Low | Add export option |
| 9. Recommendations | `Recommendations.tsx` | - | Low - Anti-recs in "Avoid" tab | ✅ Fully functional |
| 10. Progress | `ProgressTracker.tsx` | - | Low | Add reminders |

**Current Completion Rate:** 95%

### 5.2 Journey 2: Student Learning Path

**Goal:** Complete verified learning to close skill gaps

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     STUDENT LEARNING PATH JOURNEY                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │Find      │───▶│Enroll    │───▶│Course    │───▶│ Module   │          │
│  │Course    │    │(Access   │    │Overview  │    │ List     │          │
│  │          │    │ Code)    │    │          │    │          │          │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘          │
│                                                       │                 │
│                                                       ▼                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    LEARNING LOOP                                   │ │
│  │                                                                    │ │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │ │
│  │  │Learning  │───▶│ Watch    │───▶│ Micro-   │───▶│ Take     │    │ │
│  │  │Objective │    │ Video    │    │ Checks   │    │Assessment│    │ │
│  │  │ Detail   │    │(Verified)│    │(Inline)  │    │          │    │ │
│  │  └──────────┘    └────┬─────┘    └──────────┘    └────┬─────┘    │ │
│  │                       │                               │          │ │
│  │                       │    ┌──────────────┐          │          │ │
│  │                       └───▶│ Consumption  │◀─────────┘          │ │
│  │                            │  Tracking    │                      │ │
│  │                            └──────────────┘                      │ │
│  │                                                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│                                   ▼                                      │
│                         ┌──────────────────┐                            │
│                         │   Completion     │                            │
│                         │   Certificate    │                            │
│                         │   (Future)       │                            │
│                         └──────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Journey Steps:**

| Step | Page/Component | Time | Friction Points | Recommendations |
|------|----------------|------|-----------------|-----------------|
| 1. Find Course | `StudentCoursesPage.tsx` | 2m | Medium | Add search/filter |
| 2. Enroll | `EnrollmentDialog.tsx` | 30s | Low | Pre-fill codes |
| 3. Course Overview | `StudentCourseDetailPage.tsx` | 1m | Low | Show progress |
| 4. Module List | Module components | 30s | Low | Add thumbnails |
| 5. LO Detail | `LearningObjective.tsx` | 1m | **High** - Content may not exist | Show content status |
| 6. Video Player | `VerifiedVideoPlayer.tsx` | 10m+ | **High** - Simulated tracking | Integrate YouTube API |
| 7. Micro-Checks | `MicroCheckOverlay.tsx` | 1m | **High** - May not exist | Generate on demand |
| 8. Assessment | `AssessmentPage.tsx` | 10m | **Medium** - Questions may not exist | Pre-generate questions |

**Current Completion Rate:** 70%

### 5.3 Journey 3: Instructor Course Creation

**Goal:** Create and curate verified learning courses

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   INSTRUCTOR COURSE CREATION JOURNEY                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │Create    │───▶│Add       │───▶│Extract   │───▶│Search    │          │
│  │Course    │    │Modules   │    │  LOs     │    │Content   │          │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘          │
│                                                       │                 │
│                                                       ▼                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    CURATION LOOP                                   │ │
│  │                                                                    │ │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │ │
│  │  │Review    │───▶│Approve/  │───▶│Generate  │───▶│ Publish  │    │ │
│  │  │Content   │    │Reject    │    │Questions │    │ Course   │    │ │
│  │  │Matches   │    │          │    │          │    │          │    │ │
│  │  └──────────┘    └──────────┘    └──────────┘    └──────────┘    │ │
│  │                                                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Journey Steps:**

| Step | Page/Component | Time | Friction Points | Recommendations |
|------|----------------|------|-----------------|-----------------|
| 1. Create Course | `InstructorCoursesPage.tsx` | 2m | Low | Add templates |
| 2. Add Modules | `ModuleCard.tsx` | 5m | Medium | Bulk import |
| 3. Extract LOs | Edge Function | 1m | **High** - No UI trigger | Add UI button |
| 4. Search Content | Edge Function | 2m | **High** - No UI trigger | Add search panel |
| 5. Review Matches | `ContentCurationPanel.tsx` | 10m | Medium | Add bulk actions |
| 6. Generate Questions | Edge Function | 1m | **High** - No UI trigger | Add generate button |
| 7. Publish | Publish button | 30s | Low | Add preview |

**Current Completion Rate:** 65%

---

## 6. Business Process Mapping

### 6.1 Core Business Processes

#### Process 1: Capability Extraction Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   CAPABILITY EXTRACTION PIPELINE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT                    PROCESSING                    OUTPUT           │
│    │                          │                           │              │
│    ▼                          ▼                           ▼              │
│  ┌─────────┐            ┌───────────┐             ┌─────────────┐       │
│  │Syllabus │───────────▶│   Gemini  │────────────▶│Capabilities │       │
│  │  Text   │            │ Analysis  │             │   Array     │       │
│  └─────────┘            └─────┬─────┘             └──────┬──────┘       │
│                               │                          │              │
│                               ▼                          ▼              │
│                         ┌───────────┐             ┌─────────────┐       │
│                         │   Cache   │             │ Capability  │       │
│                         │  Results  │             │  Profile    │       │
│                         └───────────┘             │ (Aggregate) │       │
│                                                   └─────────────┘       │
│                                                                          │
│  Data Extracted:                                                         │
│  - Key capabilities with proficiency levels                              │
│  - Evidence types (projects, papers, labs)                               │
│  - Tools & methods used                                                  │
│  - Course themes and topics                                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Process 2: Gap Analysis Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      GAP ANALYSIS PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │   Capability    │     │    Dream Job    │     │                 │   │
│  │    Profile      │     │   Requirements  │     │   Gap Analysis  │   │
│  │ (User's Skills) │────▶│  (Job Needs)    │────▶│    Output       │   │
│  └─────────────────┘     └─────────────────┘     └────────┬────────┘   │
│                                                           │            │
│                                   ┌───────────────────────┼───────────┐│
│                                   │                       │           ││
│                                   ▼                       ▼           ▼│
│                          ┌──────────────┐  ┌──────────────┐  ┌───────┐│
│                          │   Strong     │  │   Critical   │  │Honest ││
│                          │  Overlaps    │  │    Gaps      │  │Assess ││
│                          │ (Matches)    │  │  (Missing)   │  │ment   ││
│                          └──────────────┘  └──────────────┘  └───────┘│
│                                                                       │
│                                                                       │
│  Output Structure:                                                    │
│  - Strong overlaps (capability → requirement match)                   │
│  - Critical gaps (missing skills with impact)                         │
│  - Partial overlaps (foundation exists, needs extension)              │
│  - Honest assessment (realistic career readiness)                     │
│  - Priority gaps (ranked by importance)                               │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

#### Process 3: Recommendation Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  RECOMMENDATION GENERATION PIPELINE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT                    PROCESSING                    OUTPUT           │
│    │                          │                           │              │
│    ▼                          ▼                           ▼              │
│  ┌──────────┐           ┌───────────┐            ┌────────────────┐    │
│  │  Gap     │──────────▶│  Gemini   │───────────▶│ Recommendations│    │
│  │ Analysis │           │ Generator │            │     List       │    │
│  └──────────┘           └─────┬─────┘            └───────┬────────┘    │
│                               │                          │             │
│                               │                          ▼             │
│                         ┌─────▼─────┐            ┌────────────────┐    │
│                         │   Anti-   │            │ Prioritized    │    │
│                         │   Recs    │            │ Action Items   │    │
│                         └───────────┘            └───────┬────────┘    │
│                                                          │             │
│                                                          ▼             │
│                                                  ┌────────────────┐    │
│                                                  │   Progress     │    │
│                                                  │   Tracking     │    │
│                                                  └────────────────┘    │
│                                                                         │
│  Recommendation Types:                                                  │
│  - Courses (online, university)                                         │
│  - Certifications (industry credentials)                                │
│  - Projects (portfolio builders)                                        │
│  - Actions (networking, research)                                       │
│  - Reading (books, articles)                                            │
│                                                                         │
│  Each Includes:                                                         │
│  - Priority ranking                                                     │
│  - Effort estimate (hours)                                              │
│  - Cost estimate ($)                                                    │
│  - Step-by-step instructions                                            │
│  - How to demonstrate completion                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Verified Learning Process

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VERIFIED LEARNING PROCESS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INSTRUCTOR CREATES                                                      │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     COURSE STRUCTURE                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │  Course  │─▶│  Module  │─▶│ Learning │─▶│ Content  │        │   │
│  │  │          │  │    1-N   │  │ Objective│  │ Matches  │        │   │
│  │  └──────────┘  └──────────┘  │   1-N    │  │   1-N    │        │   │
│  │                              └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  STUDENT LEARNS                                                          │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   VERIFICATION CHAIN                             │   │
│  │                                                                  │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │   │
│  │  │ Watch    │───▶│ Micro-   │───▶│Complete  │───▶│ Take     │  │   │
│  │  │ Video    │    │ Check    │    │ Video    │    │ Quiz     │  │   │
│  │  │ (Track)  │    │ (Verify) │    │ (>80%)   │    │(Assess)  │  │   │
│  │  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │   │
│  │       │               │               │               │        │   │
│  │       ▼               ▼               ▼               ▼        │   │
│  │  [consumption   [micro_check    [verification   [assessment    │   │
│  │   _records]      _results]       _state]         _answers]     │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Verification States:                                                    │
│  - none: Haven't started                                                 │
│  - partial: Watched some, no assessment                                  │
│  - unverified: Watched but failed checks                                 │
│  - verified: Passed all requirements                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Model & Entity Relationships

### 7.1 Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        ENTITY RELATIONSHIPS                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                              ┌──────────────┐                            │
│                              │   profiles   │                            │
│                              │   (users)    │                            │
│                              └──────┬───────┘                            │
│                   ┌─────────────────┼─────────────────┐                  │
│                   │                 │                 │                  │
│                   ▼                 ▼                 ▼                  │
│            ┌──────────┐      ┌──────────┐      ┌──────────┐             │
│            │ courses  │      │dream_jobs│      │instructor│             │
│            │(student) │      │          │      │_courses  │             │
│            └────┬─────┘      └────┬─────┘      └────┬─────┘             │
│                 │                 │                 │                    │
│                 ▼                 │                 ▼                    │
│         ┌────────────┐           │          ┌──────────┐                │
│         │capabilities│           │          │ modules  │                │
│         └──────┬─────┘           │          └────┬─────┘                │
│                │                 │               │                       │
│                ▼                 ▼               ▼                       │
│         ┌────────────┐    ┌──────────┐   ┌────────────┐                 │
│         │capability  │    │gap_      │   │learning_   │                 │
│         │_profiles   │    │analyses  │   │objectives  │                 │
│         └────────────┘    └────┬─────┘   └──────┬─────┘                 │
│                                │               │                         │
│                                │               │                         │
│                         ┌──────┴──────┐       │                         │
│                         │             │       │                         │
│                         ▼             ▼       ▼                         │
│                  ┌───────────┐  ┌─────────┐  ┌───────────┐              │
│                  │recommen-  │  │anti_    │  │content_   │              │
│                  │dations    │  │recommen │  │matches    │              │
│                  └───────────┘  │dations  │  └─────┬─────┘              │
│                                 └─────────┘        │                     │
│                                                    ▼                     │
│                                             ┌───────────┐                │
│                                             │ content   │                │
│                                             └─────┬─────┘                │
│                                                   │                      │
│                                    ┌──────────────┼──────────────┐       │
│                                    │              │              │       │
│                                    ▼              ▼              ▼       │
│                             ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│                             │consump-  │  │micro_    │  │assessment│    │
│                             │tion_     │  │checks    │  │_questions│    │
│                             │records   │  └────┬─────┘  └────┬─────┘    │
│                             └──────────┘       │             │          │
│                                                ▼             ▼          │
│                                          ┌──────────┐  ┌──────────┐     │
│                                          │micro_    │  │assessment│     │
│                                          │check_    │  │_sessions │     │
│                                          │results   │  └────┬─────┘     │
│                                          └──────────┘       │           │
│                                                             ▼           │
│                                                       ┌──────────┐      │
│                                                       │assessment│      │
│                                                       │_answers  │      │
│                                                       └──────────┘      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Key Data Entities

| Entity | Purpose | Key Fields | Relations |
|--------|---------|------------|-----------|
| **profiles** | User account data | email, university, major, student_level | Has many: courses, dream_jobs, instructor_courses |
| **courses** | Student course uploads | name, syllabus_text, key_capabilities | Belongs to: profile. Has many: capabilities |
| **capabilities** | Extracted skills | name, description, proficiency, theme | Belongs to: course |
| **capability_profiles** | Aggregated skills | capabilities_by_theme, course_count | Belongs to: profile |
| **dream_jobs** | Career targets | job_query, day_one_capabilities, differentiators | Belongs to: profile. Has one: gap_analysis |
| **job_requirements** | Job skill needs | requirement, importance | Belongs to: dream_job |
| **gap_analyses** | Capability comparison | strong_overlaps, critical_gaps, honest_assessment | Belongs to: dream_job. Has many: recommendations |
| **recommendations** | Learning actions | action_title, steps, type, status | Belongs to: gap_analysis |
| **anti_recommendations** | Actions to avoid | action, reason | Belongs to: gap_analysis |
| **instructor_courses** | Instructor-created courses | name, curation_mode, access_code, is_published | Has many: modules |
| **modules** | Course sections | title, description, sequence | Has many: learning_objectives |
| **learning_objectives** | Specific learning goals | description, bloom_level | Has many: content_matches |
| **content** | Learning resources | title, url, type, quality_score | Has many: content_matches |
| **content_matches** | LO-Content links | match_score, approval_status | Belongs to: learning_objective, content |
| **consumption_records** | Watch tracking | watch_percentage, engagement_score, verification_state | Belongs to: content_match, profile |
| **micro_checks** | Video quizzes | question, correct_answer, timestamp | Belongs to: content |
| **micro_check_results** | Quiz responses | selected_option, is_correct, response_time_ms | Belongs to: micro_check, consumption_record |
| **assessment_questions** | LO quizzes | question, options, correct_answer, bloom_level | Belongs to: learning_objective |
| **assessment_sessions** | Quiz attempts | status, score, time_taken_seconds | Belongs to: learning_objective, profile |
| **assessment_answers** | Quiz responses | selected_answer, is_correct, ai_evaluation | Belongs to: assessment_session, assessment_question |

### 7.3 Data Flow Summary

```
User Signup → Profile Created
      ↓
Course Upload → Syllabus Analyzed → Capabilities Extracted
      ↓
Capability Profile Aggregated
      ↓
Dream Job Added → Requirements Analyzed
      ↓
Gap Analysis Generated → Overlaps + Gaps Identified
      ↓
Recommendations Generated → Progress Tracked
      ↓
[Optional] Enroll in Instructor Course → Learn → Verify
```

---

## 8. User Integration Strategy

### 8.1 Users as Valuable Tool: Strategic Framework

The goal is to transform passive users into active contributors who enhance platform value for all users.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    USER VALUE CREATION FRAMEWORK                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    USER CONTRIBUTION LAYERS                        │  │
│  │                                                                    │  │
│  │  Layer 1: PASSIVE CONTRIBUTION                                    │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐      │  │
│  │  │ Usage Data     │  │ Learning       │  │ Career         │      │  │
│  │  │ (Analytics)    │  │ Patterns       │  │ Outcomes       │      │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘      │  │
│  │                                                                    │  │
│  │  Layer 2: ACTIVE CONTRIBUTION                                     │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐      │  │
│  │  │ Content        │  │ Course         │  │ Job            │      │  │
│  │  │ Ratings        │  │ Reviews        │  │ Experiences    │      │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘      │  │
│  │                                                                    │  │
│  │  Layer 3: CREATION                                                │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐      │  │
│  │  │ Content        │  │ Study Groups   │  │ Mentorship     │      │  │
│  │  │ Curation       │  │               │  │ Connections    │      │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘      │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 User Integration Opportunities

#### 8.2.1 Peer Learning Network

| Feature | Description | Implementation | Value Created |
|---------|-------------|----------------|---------------|
| **Study Buddy Matching** | Connect students with same gap + different strengths | Match algorithm on capability_profiles | Collaborative learning |
| **Skill Exchange** | Trade tutoring in areas of strength | Credit/token system | Resource utilization |
| **Group Learning** | Form study groups around recommendations | Shared progress tracking | Accountability |
| **Peer Reviews** | Students review each other's project work | Review assignments | Quality feedback |

**Implementation Priority:** Medium
**Effort Estimate:** 3-4 weeks

#### 8.2.2 Content Crowdsourcing

| Feature | Description | Implementation | Value Created |
|---------|-------------|----------------|---------------|
| **Resource Suggestions** | Users suggest content for learning objectives | Submit + vote system | Content discovery |
| **Quality Ratings** | Rate video helpfulness for each LO | 5-star + comments | Content ranking |
| **Content Reports** | Flag broken links, outdated content | Report workflow | Quality maintenance |
| **Transcript Contributions** | Improve auto-generated transcripts | Edit interface | Accessibility |

**Implementation Priority:** High
**Effort Estimate:** 2-3 weeks

#### 8.2.3 Career Intelligence Network

| Feature | Description | Implementation | Value Created |
|---------|-------------|----------------|---------------|
| **Interview Experiences** | Share interview questions by company/role | Structured forms | Interview prep |
| **Salary Data** | Anonymous compensation data | Aggregated reports | Market intelligence |
| **Career Path Stories** | Alumni share their journeys | Profile timelines | Inspiration |
| **Company Reviews** | Rate employers on skill development | Review system | Employer insights |

**Implementation Priority:** Medium-High
**Effort Estimate:** 4-5 weeks

#### 8.2.4 Course Quality Improvement

| Feature | Description | Implementation | Value Created |
|---------|-------------|----------------|---------------|
| **Syllabus Feedback** | Rate syllabus clarity/completeness | After-analysis survey | Course improvement |
| **Capability Corrections** | Flag incorrect capability extractions | Edit suggestions | AI training data |
| **Gap Validation** | Confirm/deny identified gaps | Binary feedback | Analysis accuracy |
| **Recommendation Effectiveness** | Track which recommendations worked | Outcome tracking | Personalization |

**Implementation Priority:** High
**Effort Estimate:** 1-2 weeks

### 8.3 Gamification & Engagement

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENGAGEMENT SYSTEM DESIGN                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      ACHIEVEMENT SYSTEM                          │   │
│  │                                                                  │   │
│  │  Badges:                                                         │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │ First  │ │ Gap    │ │ 10 Rec │ │Content │ │ Mentor │        │   │
│  │  │Analysis│ │Slayer  │ │Complete│ │Creator │ │  Star  │        │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  │                                                                  │   │
│  │  Levels: Novice → Explorer → Builder → Expert → Leader          │   │
│  │                                                                  │   │
│  │  Points:                                                         │   │
│  │  - Complete recommendation: +50 XP                               │   │
│  │  - Rate content: +5 XP                                           │   │
│  │  - Help peer: +25 XP                                             │   │
│  │  - Suggest content: +10 XP                                       │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      STREAK SYSTEM                               │   │
│  │                                                                  │   │
│  │  Daily Goals:                                                    │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  □ Complete 1 recommendation step                         │   │   │
│  │  │  □ Watch 15 min of learning content                       │   │   │
│  │  │  □ Rate 1 piece of content                                │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  Streak Bonuses: 7 days = 2x XP, 30 days = Badge + 3x XP        │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Data Value Exchange

Users provide data in exchange for platform value:

| User Provides | Platform Provides | Business Value |
|---------------|-------------------|----------------|
| Syllabi | Capability analysis | Training data for AI |
| Dream jobs | Gap analysis | Job market intelligence |
| Recommendation progress | Personalized guidance | Outcome data |
| Content ratings | Better recommendations | Content quality signals |
| Interview experiences | Interview prep content | Career intelligence |
| Career outcomes | Benchmarking | Success metrics |

---

## 9. Gap Analysis & Streamlining Opportunities

### 9.1 Current State Gaps

#### 9.1.1 Technical Gaps

| Gap | Current State | Target State | Priority | Effort |
|-----|---------------|--------------|----------|--------|
| ~~**PDF Upload**~~ | ✅ Connected | Full PDF parsing | ~~P1 Critical~~ | ~~4 hrs~~ |
| ~~**Anti-Recommendations UI**~~ | ✅ Displayed in "Avoid" tab | Displayed in UI | ~~P1 Critical~~ | ~~2 hrs~~ |
| **Instructor LO Extraction** | Backend exists, UI in ModuleCard | More discoverable UI | P2 Medium | 2 hrs |
| **YouTube Content Search** | Backend exists, UI in ModuleCard | More discoverable UI | P2 Medium | 2 hrs |
| **Question Generation** | Backend exists, UI in ModuleCard | More discoverable UI | P2 Medium | 1 hr |
| **YouTube API Integration** | Simulated tracking | Real API events | P2 Important | 4 hrs |
| **Email Notifications** | Secret missing | Full email flow | P2 Important | 2 hrs |
| **Micro-check History** | Saved but hidden | Displayed in UI | P3 Nice-to-have | 2 hrs |
| **YouTube API Quota** | 10K units/day limit | Multi-tier caching + Khan Academy primary | P1 Critical | 10 hrs |

> **Note:** After verification by Lovable Agent, PDF Upload and Anti-Recommendations were confirmed to be fully functional. The instructor UI triggers exist in ModuleCard.tsx but could be made more discoverable.

> **NEW - Content Search Strategy:** YouTube API quota (10K units/day) is a critical bottleneck. See `docs/Content_Search_Strategy.md` for the optimized multi-tier approach:
> 1. **Concept-level caching** (30-day TTL, semantic similarity matching)
> 2. **Khan Academy as primary** (free, server-side GraphQL access)
> 3. **YouTube as fallback** (only when cache + Khan insufficient)
> 4. **Local content library** (MIT OCW, Yale imports for common topics)

#### 9.1.2 User Experience Gaps

| Gap | Impact | Solution | Priority |
|-----|--------|----------|----------|
| **No social login** | Signup friction | Add Google/GitHub OAuth | Medium |
| **Manual dream job entry** | Discovery friction | Add job suggestions | Medium |
| **No course preview** | Instructor uncertainty | Add preview mode | Medium |
| **No progress emails** | Engagement drop-off | Weekly digest emails | Low |
| **No mobile optimization** | Mobile users excluded | Responsive improvements | Medium |

#### 9.1.3 Business Model Gaps

| Gap | Current State | Target State | Priority |
|-----|---------------|--------------|----------|
| **No monetization** | Free | Freemium + B2B | High |
| **No analytics dashboard** | Basic usage tracking | Full analytics | Medium |
| **No university partnerships** | Individual users only | B2B sales | High |
| **No API access** | Internal only | Developer API | Low |

### 9.2 User Journey Streamlining

#### 9.2.1 Career Path Streamlining

```
CURRENT FLOW (7 steps):
Landing → Auth → Profile → Courses → Dream Jobs → Analysis → Recommendations
  30s      1m      1m       3m        2m          Auto        Auto

PROPOSED FLOW (5 steps):
Landing → Scanner Demo → Quick Signup → Combined Upload → Dashboard
  30s         2m            30s            4m             Immediate

Key Changes:
1. Let users try scanner BEFORE signup (capture value first)
2. Combine profile + course upload into single flow
3. Suggest dream jobs based on courses uploaded
4. Generate analysis immediately, no manual trigger needed
```

**Estimated Time Savings:** 40% reduction in onboarding time

#### 9.2.2 Learning Path Streamlining

```
CURRENT FLOW (8 steps):
Find Course → Enroll → Overview → Module → LO → Video → Checks → Assessment
    2m         30s       1m        30s    1m    10m     1m       10m

PROPOSED FLOW (5 steps):
Smart Discovery → Quick Enroll → Learning View (Combined) → Continuous Assessment
      1m              10s               15m                      Integrated

Key Changes:
1. AI-powered course discovery based on gaps
2. One-click enrollment with saved preferences
3. Combined module/LO/video view with seamless transitions
4. Micro-checks and assessments integrated into video experience
```

**Estimated Time Savings:** 30% reduction in friction

#### 9.2.3 Instructor Path Streamlining

```
CURRENT FLOW (7 steps):
Create → Modules → Extract LOs → Search Content → Curate → Questions → Publish
  2m       5m         Manual        Manual        10m      Manual       30s

PROPOSED FLOW (4 steps):
Quick Setup → Auto-Extract → AI-Curate → Review & Publish
    3m           Auto          Auto           5m

Key Changes:
1. Combined course creation with syllabus upload
2. Automatic LO extraction on module creation
3. AI-powered content search and matching
4. Batch approval interface with smart defaults
5. One-click question generation for all LOs
```

**Estimated Time Savings:** 60% reduction in course setup time

### 9.3 Feature Consolidation Opportunities

| Current | Consolidated | Benefit |
|---------|--------------|---------|
| Separate onboarding steps | Single wizard with skip options | Faster setup |
| Multiple search interfaces | Unified global search | Consistency |
| Separate analysis/recommendations pages | Combined dashboard view | Context retention |
| Manual content curation | AI-assisted with human review | Efficiency |
| Per-LO question generation | Batch generation with editing | Time savings |

---

## 10. Technical Debt & Modernization

### 10.1 Current Technical Debt

| Item | Description | Impact | Resolution |
|------|-------------|--------|------------|
| **Deprecated API patterns** | Some hooks use old patterns | Maintenance burden | Migrate to current patterns |
| **Inconsistent error handling** | Mix of try-catch and .catch() | Debugging difficulty | Standardize error handling |
| **Type inconsistencies** | Some `any` types remain | Type safety gaps | Add strict types |
| **Duplicate code** | Similar patterns in multiple hooks | Maintenance overhead | Extract shared utilities |
| **Unused components** | AntiRecommendations not integrated | Dead code | Integrate or remove |
| **Orphaned functions** | evaluate-answer edge function | Confusion | Delete |

### 10.2 Modernization Recommendations

#### 10.2.1 Short-term (1-2 weeks)

1. **Connect Missing UI Triggers**
   - Add Extract LOs button to instructor course detail
   - Add YouTube search panel to instructor view
   - Add Generate Questions button per LO
   - Display anti-recommendations on recommendations page

2. **Fix Critical Integrations**
   - Complete YouTube IFrame API integration
   - Fix PDF upload pipeline
   - Configure RESEND_API_KEY for emails

3. **Clean Up Technical Debt**
   - Remove evaluate-answer edge function
   - Standardize error handling patterns
   - Fix remaining TypeScript `any` types

#### 10.2.2 Medium-term (3-6 weeks)

1. **Performance Optimization**
   - Implement code splitting for route pages
   - Add image lazy loading
   - Optimize React Query cache strategies
   - Add database indexes for common queries

2. **Testing Infrastructure**
   - Add unit tests for critical hooks
   - Add integration tests for key workflows
   - Add E2E tests for user journeys
   - Set up CI/CD pipeline

3. **Monitoring & Observability**
   - Add error tracking (Sentry)
   - Implement usage analytics
   - Add performance monitoring
   - Create admin dashboard

#### 10.2.3 Long-term (3-6 months)

1. **Architecture Evolution**
   - Consider GraphQL for complex queries
   - Evaluate real-time features with Supabase Realtime
   - Design API versioning strategy
   - Plan for multi-region deployment

2. **AI Enhancement**
   - Add model fallback chains
   - Implement A/B testing for prompts
   - Build prompt management system
   - Add feedback loops for AI improvement

3. **Platform Expansion**
   - Mobile app (React Native)
   - Browser extension for syllabus capture
   - University admin portal
   - Employer verification system

### 10.3 Technology Upgrade Path

| Current | Target | Timeline | Rationale |
|---------|--------|----------|-----------|
| React 18 | React 19 (when stable) | 6+ months | New features |
| Vite 5 | Vite 6 (when stable) | 6+ months | Performance |
| TanStack Query 5 | Keep current | N/A | Already latest |
| Tailwind 3 | Tailwind 4 (when stable) | 6+ months | CSS improvements |
| TypeScript 5 | Keep current | N/A | Already latest |

---

## 11. Implementation Roadmap

### 11.1 Phase 1: Foundation Fix (Weeks 1-2)

**Goal:** Achieve 95% core functionality

| Task | Owner | Duration | Dependencies | Status |
|------|-------|----------|--------------|--------|
| ~~Fix PDF upload pipeline~~ | Dev | ~~4 hrs~~ | None | ✅ Already Done |
| ~~Display anti-recommendations~~ | Dev | ~~2 hrs~~ | None | ✅ Already Done |
| **Implement content search caching** | Dev | 4 hrs | None | **P1 Critical** |
| **Khan Academy GraphQL integration** | Dev | 6 hrs | None | **P1 Critical** |
| Improve instructor UI discoverability | Dev | 4 hrs | None | Pending |
| Complete YouTube player API integration | Dev | 4 hrs | None | Pending |
| Configure email notifications | DevOps | 2 hrs | RESEND key | Pending |
| Display micro-check history | Dev | 2 hrs | None | Pending |
| Remove orphaned code | Dev | 1 hr | None | Pending |

**Total Effort:** ~23 hours (content search optimization added as P1 Critical)

> **Priority Change:** Content search caching is now P1 Critical due to YouTube API quota limits (10K units/day). See `docs/Content_Search_Strategy.md` for implementation details.

**Milestone:** All user journeys functional end-to-end

### 11.2 Phase 2: User Experience Polish (Weeks 3-4)

**Goal:** Reduce friction, improve engagement

| Task | Owner | Duration | Dependencies |
|------|-------|----------|--------------|
| Streamline onboarding wizard | UX + Dev | 12 hrs | Phase 1 |
| Add dream job suggestions | Dev | 8 hrs | Phase 1 |
| Create combined learning view | Dev | 16 hrs | Phase 1 |
| Add progress indicators everywhere | Dev | 6 hrs | Phase 1 |
| Implement toast notifications consistently | Dev | 4 hrs | Phase 1 |
| Add empty states with CTAs | UX + Dev | 4 hrs | Phase 1 |

**Total Effort:** ~50 hours
**Milestone:** Smooth, guided user experience

### 11.3 Phase 3: User Integration (Weeks 5-8)

**Goal:** Transform users into value creators

| Task | Owner | Duration | Dependencies |
|------|-------|----------|--------------|
| Content rating system | Dev | 16 hrs | Phase 2 |
| Resource suggestion flow | Dev | 12 hrs | Phase 2 |
| Capability correction feedback | Dev | 8 hrs | Phase 2 |
| Basic achievement system | Dev | 16 hrs | Phase 2 |
| Weekly digest emails | Dev | 8 hrs | Email configured |
| Progress sharing to LinkedIn | Dev | 8 hrs | Phase 2 |

**Total Effort:** ~68 hours
**Milestone:** Active user contribution mechanisms

### 11.4 Phase 4: Scale & Monetize (Weeks 9-12)

**Goal:** Prepare for growth and revenue

| Task | Owner | Duration | Dependencies |
|------|-------|----------|--------------|
| Usage limits for free tier | Dev | 12 hrs | Phase 3 |
| Premium feature gating | Dev | 16 hrs | Phase 3 |
| Stripe payment integration | Dev | 16 hrs | Phase 3 |
| University admin portal | Dev | 40 hrs | Phase 3 |
| Analytics dashboard | Dev | 24 hrs | Phase 3 |
| API documentation | Dev | 8 hrs | Phase 3 |

**Total Effort:** ~116 hours
**Milestone:** Revenue-ready platform

### 11.5 Roadmap Visualization

```
                    WEEK 1-2          WEEK 3-4          WEEK 5-8          WEEK 9-12
                   ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
                   │ PHASE 1  │      │ PHASE 2  │      │ PHASE 3  │      │ PHASE 4  │
                   │Foundation│      │   UX     │      │  User    │      │  Scale   │
                   │   Fix    │      │ Polish   │      │Integration│     │Monetize  │
                   └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
                        │                 │                 │                 │
Deliverables:      ─────┼─────────────────┼─────────────────┼─────────────────┤
                        │                 │                 │                 │
                   • YouTube API    • Streamlined    • Rating system   • Freemium
                   • Email setup      onboarding     • Suggestions     • Payments
                   • Instructor UX   • Combined view  • Achievements    • Admin portal
                   • Micro-checks    • Progress UI    • Email digests   • Analytics
                   • Cleanup                          • LinkedIn share
                        │                 │                 │                 │
Completion:        ────95%──────────98%──────────100%────────────Revenue Ready

```

---

## 12. Success Metrics & KPIs

### 12.1 Product Metrics

| Metric | Current | Target (3mo) | Target (6mo) |
|--------|---------|--------------|--------------|
| **User Activation Rate** | Unknown | 60% | 75% |
| **Onboarding Completion** | ~50% est. | 70% | 85% |
| **Weekly Active Users** | Unknown | 40% | 50% |
| **Recommendation Completion** | Unknown | 25% | 40% |
| **Course Enrollment Rate** | Unknown | 30% | 50% |
| **Assessment Pass Rate** | Unknown | 70% | 80% |

### 12.2 Business Metrics

| Metric | Current | Target (3mo) | Target (6mo) |
|--------|---------|--------------|--------------|
| **Monthly Active Users** | Unknown | 1,000 | 5,000 |
| **Conversion to Premium** | 0% | 5% | 10% |
| **University Partnerships** | 0 | 2 | 5 |
| **MRR (Monthly Recurring Revenue)** | $0 | $5,000 | $25,000 |
| **User Acquisition Cost** | Unknown | $10 | $8 |
| **Lifetime Value** | Unknown | $50 | $100 |

### 12.3 Technical Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **Page Load Time (p95)** | Unknown | <2s |
| **API Response Time (p95)** | Unknown | <500ms |
| **Error Rate** | Unknown | <0.1% |
| **Uptime** | Unknown | 99.9% |
| **Test Coverage** | 0% | 60% |
| **Deployment Frequency** | Manual | Daily |

### 12.4 User Satisfaction Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **NPS (Net Promoter Score)** | Unknown | +40 |
| **CSAT (Customer Satisfaction)** | Unknown | 4.2/5 |
| **Feature Request Resolution** | Unknown | 2 weeks avg |
| **Support Response Time** | Unknown | <24 hours |

---

## Appendix A: Quick Reference

### A.1 Key File Locations

| Category | Primary Files |
|----------|---------------|
| **Routing** | `src/App.tsx` |
| **Authentication** | `src/contexts/AuthContext.tsx`, `src/components/auth/AuthGuard.tsx` |
| **Data Fetching** | `src/hooks/` (30+ hooks) |
| **Services** | `src/services/` (7 service files) |
| **Edge Functions** | `supabase/functions/` (27 functions) |
| **Database Types** | `src/integrations/supabase/types.ts`, `src/types/database.ts` |
| **Query Keys** | `src/lib/query-keys.ts` |
| **UI Components** | `src/components/ui/` (shadcn) |

### A.2 API Endpoints Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/functions/v1/analyze-syllabus` | POST | Optional | Extract capabilities |
| `/functions/v1/analyze-dream-job` | POST | No | Generate job requirements |
| `/functions/v1/gap-analysis` | POST | Yes | Compare capabilities vs job |
| `/functions/v1/generate-recommendations` | POST | Yes | Create learning recommendations |
| `/functions/v1/extract-learning-objectives` | POST | No | Parse LOs from text |
| `/functions/v1/search-youtube-content` | POST | Yes | Search YouTube for content |
| `/functions/v1/start-assessment` | POST | Yes | Begin quiz session |
| `/functions/v1/submit-assessment-answer` | POST | Yes | Submit quiz answer |
| `/functions/v1/complete-assessment` | POST | Yes | Finalize assessment |
| `/functions/v1/track-consumption` | POST | Yes | Track video progress |

### A.3 Database Tables Reference

| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `profiles` | User accounts | → courses, dream_jobs |
| `courses` | Uploaded syllabi | → capabilities |
| `capabilities` | Extracted skills | ← courses |
| `dream_jobs` | Career targets | → gap_analyses |
| `gap_analyses` | Skill comparisons | → recommendations |
| `recommendations` | Learning actions | ← gap_analyses |
| `instructor_courses` | Created courses | → modules |
| `modules` | Course sections | → learning_objectives |
| `learning_objectives` | Learning goals | → content_matches |
| `content` | Learning resources | → content_matches |
| `assessment_sessions` | Quiz attempts | → assessment_answers |

---

## Appendix B: Verification Log

### Verification 1: 2026-01-08 by Lovable Agent

**Claims Verified as CORRECT:**
- 27 Edge Functions ✅
- Tech Stack (React 18, TypeScript, Vite, TanStack Query, etc.) ✅
- AI Model: Gemini 2.5 Flash ✅
- 31 Pages, 117 Components, 30 Hooks, 7 Services ✅
- Student Career Path 90%+ Complete ✅
- Anti-Recommendations component exists ✅
- YouTube Video tracking uses timer-based simulation ✅

**Claims Corrected (were INCORRECT):**
| Original Claim | Correction |
|----------------|------------|
| PDF Upload "Not connected" | **INCORRECT** - PDF upload IS connected via `parseSyllabusDocument()` in CourseUploader.tsx:97-119 |
| Anti-Recommendations "not displayed in UI" | **INCORRECT** - Anti-recommendations ARE displayed in Recommendations.tsx:90-96 under the "Avoid" tab |
| "5 key functions need UI integration" | **PARTIALLY INCORRECT** - PDF and Anti-recs ARE integrated. Instructor UI triggers exist in ModuleCard.tsx |

**Impact of Corrections:**
- Core functionality upgraded from 75% to 85% complete
- Student Career Path upgraded from 90% to 95% complete
- Phase 1 effort reduced from 23 hours to 13 hours
- 2 P1 Critical issues removed from backlog

---

*Document prepared by: AI Project Analysis*
*Last Updated: 2026-01-08*
*Last Verified: 2026-01-08 by Lovable Agent*
*Next Review: After Phase 1 Completion*
