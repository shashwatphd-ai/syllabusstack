# SyllabusStack Architecture Overview

**Assessment Date:** January 26, 2026

---

## 1. System Architecture Summary

SyllabusStack is a full-stack SaaS platform for educational content and career development. The architecture follows a modern serverless pattern with clear separation between frontend and backend.

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18.3 + TypeScript + Vite |
| UI Framework | shadcn/ui (Radix primitives) + Tailwind CSS |
| State Management | TanStack Query (server state) + React Context (auth) |
| Routing | React Router 7.12 |
| Backend | Supabase Edge Functions (Deno runtime) |
| Database | PostgreSQL (via Supabase) |
| Authentication | Supabase Auth (JWT-based) |
| Payments | Stripe |
| AI Services | Vertex AI Batch API, Claude API |
| External APIs | Firecrawl, YouTube API, O*NET API, Khan Academy |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React/Vite)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Pages     │  │ Components  │  │   Hooks     │  │  Services   │    │
│  │   (28+)     │  │   (30+)     │  │   (55+)     │  │    (7)      │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                                   │                                      │
│                    ┌──────────────┴──────────────┐                      │
│                    │   TanStack Query Client     │                      │
│                    └──────────────┬──────────────┘                      │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Edge Functions (77)                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │    │
│  │  │ AI/Gen   │ │ Search   │ │ Payments │ │ Auth/IDV │           │    │
│  │  │  (18)    │ │  (8)     │ │   (6)    │ │   (9)    │           │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │    │
│  │  │Assessment│ │ Batch    │ │ Utility  │                        │    │
│  │  │  (7)     │ │  (8)     │ │  (21)    │                        │    │
│  │  └──────────┘ └──────────┘ └──────────┘                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                   │                                      │
│  ┌────────────────────┐    ┌─────┴─────┐    ┌──────────────────┐        │
│  │   Supabase Auth    │    │ PostgreSQL │    │  Realtime Subs   │        │
│  │   (JWT tokens)     │    │  (30+ tbl) │    │   (available)    │        │
│  └────────────────────┘    └───────────┘    └──────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Stripe  │  │ Vertex   │  │  Claude  │  │Firecrawl │  │  O*NET   │  │
│  │ Payments │  │ AI Batch │  │   API    │  │  Scrape  │  │   API    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐                                             │
│  │ YouTube  │  │  Khan    │                                             │
│  │   API    │  │ Academy  │                                             │
│  └──────────┘  └──────────┘                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

### 3.1 Provider Hierarchy

```
QueryClientProvider (TanStack Query)
  └── AuthProvider (Supabase Auth context)
       └── TooltipProvider (UI)
            └── Toaster + Sonner (Notifications)
                 └── AchievementToastProvider
                      └── BrowserRouter
                           └── Routes
```

**Location:** `src/App.tsx:54-141`

### 3.2 Route Structure

| Category | Routes | Guard |
|----------|--------|-------|
| Public | `/`, `/scanner`, `/resources`, `/legal`, `/how-it-works`, `/universities`, `/verify/:shareToken` | None |
| Guest Only | `/auth`, `/forgot-password` | GuestGuard |
| Protected | `/dashboard`, `/learn`, `/career`, `/profile`, `/settings`, `/billing` | AuthGuard |
| Student | `/learn/course/:id`, `/learn/objective/:loId`, `/learn/slides/:slideId` | AuthGuard |
| Instructor | `/instructor/courses`, `/instructor/courses/:id`, `/instructor/quick-setup` | AuthGuard |
| Admin | `/admin`, `/admin/users`, `/admin/courses`, `/admin/branding` | AdminGuard |
| Employer | `/employer` | AuthGuard |

### 3.3 Service Layer

The service layer abstracts Supabase Edge Function calls:

| Service | Purpose | Functions Called |
|---------|---------|------------------|
| `syllabus-service` | Syllabus analysis | `analyze-syllabus`, `parse-syllabus-document` |
| `dream-job-service` | Job analysis | `analyze-dream-job` |
| `gap-analysis-service` | Skills gap calculation | `gap-analysis` |
| `recommendations-service` | Learning recommendations | `generate-recommendations` |
| `content-service` | YouTube content search | `search-youtube-content` |
| `assessment-service` | Learning objectives & questions | `extract-learning-objectives`, `generate-assessment-questions` |

**Location:** `src/services/`

### 3.4 Custom Hooks (55 hooks)

Hooks provide React Query wrappers for data fetching:

| Category | Hooks | Purpose |
|----------|-------|---------|
| **Auth/User** | `useProfile`, `useUserRoles`, `useUserPreferences` | User data management |
| **Courses** | `useCourses`, `useStudentCourses`, `useInstructorCourses` | Course management |
| **Learning** | `useLearningObjectives`, `useTeachingUnits`, `useLectureSlides` | Learning content |
| **Assessment** | `useAssessment`, `useSkillsAssessment` | Testing & evaluation |
| **Career** | `useDreamJobs`, `useCareerMatches`, `useDiscoverDreamJobs` | Career planning |
| **Content** | `useRecommendations`, `useContentRating`, `useContentSuggestions` | Content discovery |
| **AI Generation** | `useAIGeneration`, `useBatchSlides`, `useProgressiveGeneration` | AI content creation |
| **Billing** | `useSubscription`, `useUsageStats` | Subscription management |

**Location:** `src/hooks/`

---

## 4. Backend Architecture (Edge Functions)

### 4.1 Function Categories

| Category | Count | JWT Required | Examples |
|----------|-------|--------------|----------|
| AI/Content Generation | 18 | Mixed | `generate-curriculum`, `generate-lecture-slides-v3` |
| Search & Discovery | 8 | Mostly Yes | `global-search`, `firecrawl-search-courses` |
| Assessment | 7 | Yes | `start-skills-assessment`, `complete-assessment` |
| Payments | 6 | Mixed | `create-checkout-session`, `stripe-webhook` |
| User/Auth | 9 | Yes | `invite-users`, `verify-instructor-email` |
| Batch Processing | 8 | Mixed | `submit-batch-slides`, `poll-batch-status` |
| Utilities | 21 | Mixed | `fetch-video-metadata`, `process-syllabus` |

### 4.2 JWT Configuration Summary

From `supabase/config.toml`:

- **JWT Required (56 functions):** Protected endpoints requiring authentication
- **No JWT (21 functions):** Public endpoints or service-to-service calls

**Public Functions (no JWT):**
- `ai-gateway`, `analyze-syllabus`, `analyze-dream-job`
- `parse-syllabus-document`, `extract-learning-objectives`
- `stripe-webhook`, `verify-certificate`
- `auto-link-courses`, `curriculum-reasoning-agent`
- `submit-batch-slides`, `process-batch-research`
- `get-onet-occupation`, `fetch-video-metadata`
- `search-youtube-manual`, `generate-lecture-slides-v3`

### 4.3 External Service Integrations

| Service | Purpose | Functions Using It |
|---------|---------|-------------------|
| **Stripe** | Payments & subscriptions | `create-checkout-session`, `stripe-webhook`, `create-portal-session` |
| **Vertex AI** | Batch AI predictions | `submit-batch-slides`, `submit-batch-evaluation`, `submit-batch-curriculum` |
| **Claude API** | AI content generation | `generate-curriculum`, `content-assistant-chat`, `curriculum-reasoning-agent` |
| **Firecrawl** | Web scraping | `firecrawl-search-courses`, `scrape-job-posting` |
| **YouTube API** | Video search | `search-youtube-content`, `search-youtube-manual`, `fetch-video-metadata` |
| **O*NET API** | Occupation data | `get-onet-occupation`, `match-careers` |
| **Khan Academy** | Course search | `search-khan-academy` |

---

## 5. Data Flow Patterns

### 5.1 Standard Data Fetch Pattern

```
Component → useQuery Hook → Service Function → Supabase Edge Function → Database
                                                        │
                                                        ▼
                                               External API (if needed)
```

### 5.2 AI Generation Pattern (Batch Processing)

```
User Request
     │
     ▼
submit-batch-slides ─────► Vertex AI Batch API
     │                            │
     ▼                            │
Create batch_jobs record          │
     │                            │
     ▼                            ▼
poll-batch-status ◄──────── Batch Complete
     │
     ▼
Update teaching_units with generated content
```

### 5.3 Authentication Flow

```
User Login
     │
     ▼
Supabase Auth (signInWithPassword)
     │
     ▼
JWT Token Generated
     │
     ├──► Stored in localStorage
     │
     └──► Sent with API requests
              │
              ▼
         Edge Function validates JWT
              │
              ▼
         Access granted / denied
```

---

## 6. Key Architectural Decisions

### 6.1 Strengths

1. **Type Safety:** Full TypeScript with generated database types
2. **Serverless Backend:** Edge Functions scale automatically
3. **Cost Optimization:** Vertex AI Batch API for 50% AI cost savings
4. **Separation of Concerns:** Clear service/hook/component layers
5. **Modern Stack:** Latest React 18, TanStack Query v5

### 6.2 Concerns Identified

1. **Dual Routing:** Both React Router and TanStack Router present (potential confusion)
2. **Large Hook Count:** 55+ hooks may indicate some duplication
3. **Public Functions:** 21 functions without JWT need security review
4. **No API Gateway:** Each function independently handles auth/rate-limiting
5. **Missing Observability:** No centralized logging/monitoring visible

---

## 7. Component Dependency Summary

### Pages → Hooks → Services → Edge Functions

```
LearnPage
  └── useStudentCourses
  └── useLearningObjectives
  └── useTeachingUnits
       └── supabase.functions.invoke('generate-curriculum')

CareerPathPage
  └── useDreamJobs
  └── useCareerMatches
       └── gap-analysis-service
            └── supabase.functions.invoke('gap-analysis')
```

---

## 8. Files Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app with routes and providers |
| `src/contexts/AuthContext.tsx` | Authentication state management |
| `src/services/index.ts` | Service layer exports |
| `src/hooks/*.ts` | 55 custom React hooks |
| `supabase/config.toml` | Edge function configuration |
| `supabase/functions/` | 77 Edge Functions |
| `src/integrations/supabase/client.ts` | Supabase client setup |
| `src/integrations/supabase/types.ts` | Generated database types |
