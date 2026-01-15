# SyllabusStack Architecture Documentation

## Executive Summary

**SyllabusStack** is a comprehensive career development platform that uses AI to analyze college coursework, identify skill gaps, and recommend actionable learning paths. The application serves **Students**, **Instructors**, and **University Admins** with role-specific features.

| Aspect | Technology |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| AI | Google Gemini 2.5 Flash (via Lovable API Gateway) |
| State Management | React Query (TanStack) + Context |
| Styling | Tailwind CSS + shadcn-ui |
| Payment | Stripe |

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Technology Stack](#2-technology-stack)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Key Files Reference](#4-key-files-reference)
5. [Database Schema](#5-database-schema)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Third-Party Integrations](#7-third-party-integrations)
8. [Architectural Patterns](#8-architectural-patterns)
9. [Development Workflow](#9-development-workflow)

---

## 1. Project Structure

```
syllabusstack/
├── src/                           # Frontend application
│   ├── App.tsx                   # Main app router & providers
│   ├── main.tsx                  # React entry point
│   ├── index.css                 # Global styles (Tailwind)
│   │
│   ├── pages/                    # Route components
│   │   ├── Index.tsx            # Landing page
│   │   ├── Auth.tsx             # Login/Signup
│   │   ├── Onboarding.tsx       # User onboarding flow
│   │   ├── Dashboard.tsx        # User dashboard
│   │   ├── Learn.tsx            # Course management (unified)
│   │   ├── CareerPath.tsx       # Career goals & gap analysis (unified)
│   │   ├── student/             # Student-specific pages
│   │   ├── instructor/          # Instructor pages
│   │   └── admin/               # Admin pages
│   │
│   ├── components/              # React components (26 categories)
│   │   ├── ui/                 # shadcn-ui primitives
│   │   ├── layout/             # App shell, header, sidebar
│   │   ├── dashboard/          # Dashboard widgets
│   │   ├── learn/              # Learning interface
│   │   ├── recommendations/    # Recommendation displays
│   │   ├── analysis/           # Gap analysis components
│   │   ├── assessment/         # Quiz components
│   │   └── ...                 # 18 more categories
│   │
│   ├── hooks/                   # Custom React hooks (40+)
│   │   ├── useCourses.ts       # Course data fetching
│   │   ├── useDreamJobs.ts     # Dream job management
│   │   ├── useAnalysis.ts      # Gap analysis workflow
│   │   └── workflows/          # Complex multi-step hooks
│   │
│   ├── services/               # API service layer
│   │   ├── syllabus-service.ts
│   │   ├── assessment-service.ts
│   │   ├── gap-analysis-service.ts
│   │   ├── dream-job-service.ts
│   │   ├── recommendations-service.ts
│   │   └── content-service.ts
│   │
│   ├── contexts/               # React Context providers
│   │   └── AuthContext.tsx     # Authentication state
│   │
│   ├── integrations/           # External integrations
│   │   └── supabase/
│   │       ├── client.ts       # Supabase client
│   │       └── types.ts        # Auto-generated DB types
│   │
│   ├── lib/                    # Utility libraries
│   │   ├── query-keys.ts       # React Query cache keys
│   │   ├── gap-utils.ts        # Gap analysis helpers
│   │   └── ...
│   │
│   └── types/                  # TypeScript definitions
│
├── supabase/                    # Backend
│   ├── config.toml             # Edge function config
│   ├── functions/              # 45 Deno edge functions
│   │   ├── _shared/            # Shared utilities
│   │   ├── analyze-syllabus/
│   │   ├── analyze-dream-job/
│   │   ├── gap-analysis/
│   │   └── ...
│   └── migrations/             # SQL migrations
│
└── Configuration Files
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    └── vitest.config.ts
```

---

## 2. Technology Stack

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.8.3 | Type safety |
| Vite | 5.4.19 | Build tool |
| React Router | 6.30.1 | Client-side routing |
| TanStack Query | 5.83.0 | Server state management |
| React Hook Form | 7.61.1 | Form handling |
| Zod | 3.x | Schema validation |
| Tailwind CSS | 3.4.17 | Styling |
| shadcn-ui | - | Component library |
| Radix UI | - | Accessible primitives |
| Lucide React | 0.462.0 | Icons |
| Recharts | 2.15.4 | Data visualization |

### Backend Stack

| Technology | Purpose |
|------------|---------|
| Supabase | Backend-as-a-Service |
| PostgreSQL | Database |
| Deno | Edge function runtime |
| Row-Level Security | Data access control |
| Supabase Auth | JWT authentication |
| Supabase Storage | File storage (syllabi) |

### External Services

| Service | Purpose |
|---------|---------|
| Lovable API Gateway | AI (Gemini 2.5 Flash) |
| Stripe | Payment processing |
| YouTube API | Video content discovery |
| Khan Academy | Educational content |
| Firecrawl | Web course discovery |

---

## 3. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [UI Components]                                                │
│       ↓                                                         │
│  [Custom Hooks] (useQuery, useMutation)                        │
│       ↓                                                         │
│  [Service Layer] (API calls)                                   │
│       ↓                                                         │
│  [Supabase Client] (authenticated requests)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND (Supabase)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [JWT Verification]                                             │
│       ↓                                                         │
│  [Edge Functions] (Deno)                                        │
│  ├─ Request validation                                          │
│  ├─ AI API calls                                                │
│  ├─ External service calls                                      │
│  └─ Database operations                                         │
│       ↓                                                         │
│  [PostgreSQL] (RLS-protected)                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          EXTERNAL SERVICES                                       │
├─────────────────────────────────────────────────────────────────┤
│  AI: Lovable Gateway → Gemini 2.5 Flash                         │
│  Content: YouTube, Khan Academy, Firecrawl                      │
│  Payment: Stripe                                                │
└─────────────────────────────────────────────────────────────────┘
```

### State Management Strategy

| State Type | Solution | Example |
|------------|----------|---------|
| Server State | React Query | Courses, jobs, recommendations |
| Auth State | React Context | User session, profile |
| URL State | React Router | Current tab, filters |
| Form State | React Hook Form | Input values, validation |
| UI State | useState/useReducer | Modals, dropdowns |

---

## 4. Key Files Reference

### Entry Points

| File | Purpose |
|------|---------|
| `src/main.tsx` | React DOM render, providers setup |
| `src/App.tsx` | Route definitions, auth guards |
| `index.html` | HTML template |

### Core Context

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | User, session, profile state |

### Service Layer

| File | Purpose |
|------|---------|
| `src/services/syllabus-service.ts` | Syllabus parsing & analysis |
| `src/services/assessment-service.ts` | Quiz generation & submission |
| `src/services/gap-analysis-service.ts` | Skill gap calculation |
| `src/services/dream-job-service.ts` | Job analysis |
| `src/services/recommendations-service.ts` | Learning path generation |
| `src/services/content-service.ts` | Content discovery |

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useCourses()` | Fetch user courses |
| `useDreamJobs()` | Fetch dream jobs |
| `useAnalysis(jobId)` | Fetch gap analysis |
| `useRecommendations(jobId)` | Fetch learning recommendations |
| `useCapabilities()` | Fetch user skills |

### Configuration

| File | Purpose |
|------|---------|
| `vite.config.ts` | Build settings, path aliases |
| `tailwind.config.ts` | Theme, colors, plugins |
| `tsconfig.json` | TypeScript compiler options |
| `supabase/config.toml` | Edge function settings |

---

## 5. Database Schema

### Core Tables

```
profiles
├── user_id (FK → auth.users)
├── full_name, university, major
├── graduation_year, student_level
├── onboarding_completed
├── subscription_tier
└── api_quota_monthly

courses
├── id, user_id
├── title, code, university
├── semester, credits, instructor
├── syllabus_url
├── capability_text (AI-generated)
├── key_capabilities[] (array)
├── tools_methods[] (array)
├── analysis_status
└── ai_cost_usd

capabilities
├── id, user_id, course_id
├── name, category
├── proficiency_level
└── verified (boolean)

dream_jobs
├── id, user_id
├── job_query (search text)
├── target_company_type
├── target_location
├── requirements_text (AI-generated)
├── day_one_capabilities[]
├── differentiators[]
├── misconceptions[]
├── realistic_bar
└── ai_cost_usd

gap_analyses
├── id, user_id, dream_job_id
├── analysis_text
├── strong_overlaps[]
├── critical_gaps[]
├── partial_overlaps[]
├── honest_assessment
├── readiness_level
├── priority_gaps[]
└── ai_cost_usd

recommendations
├── id, user_id, dream_job_id
├── gap_analysis_id
├── priority
├── gap_addressed
├── action_title
├── action_description
├── why_this_matters
├── steps[] (JSON array)
├── type (project|course|certification)
├── effort_hours, cost
├── evidence_created
├── resource_url
├── status (not_started|in_progress|completed)
└── ai_cost_usd
```

### Instructor Tables

```
instructor_courses
├── id, instructor_id
├── title, code, description
├── curation_mode
├── access_code
└── is_published

course_modules
├── id, course_id
├── title, description, order
└── is_published

learning_objectives
├── id, module_id
├── text, bloom_level
└── core_concept

student_enrollments
├── id, student_id, course_id
├── joined_at
└── progress_percentage
```

---

## 6. Authentication & Authorization

### Auth Flow

```
Sign Up/Login (Auth.tsx)
       ↓
Supabase Auth (JWT generation)
       ↓
Profile Creation (database trigger)
       ↓
AuthContext (state management)
       ↓
Route Protection (AuthGuard)
```

### Role-Based Access

| Role | Permissions |
|------|-------------|
| `student` | Own courses, capabilities, dream jobs, recommendations |
| `instructor` | Create courses, manage content, view enrolled students |
| `admin` | All users, courses, organization settings, analytics |

### Row-Level Security (RLS)

All tables have RLS policies that automatically filter data:

```sql
-- Users see only their own courses
CREATE POLICY "Users view own courses"
ON courses FOR SELECT
USING (user_id = auth.uid());
```

### Route Guards

```tsx
// Protected route (requires authentication)
<Route path="/dashboard" element={
  <AuthGuard>
    <Dashboard />
  </AuthGuard>
} />

// Guest route (redirects if authenticated)
<Route path="/auth" element={
  <GuestGuard>
    <Auth />
  </GuestGuard>
} />
```

---

## 7. Third-Party Integrations

### AI Integration (Lovable Gateway)

```typescript
// Edge function pattern
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content: prompt }]
  })
});
```

**Used For:**
- Syllabus analysis
- Job requirement extraction
- Gap analysis
- Recommendation generation
- Assessment questions
- Lecture slides

### Content Discovery

| Service | Endpoint | Fallback |
|---------|----------|----------|
| YouTube | Official API | Invidious → Piped |
| Khan Academy | Public API | - |
| Firecrawl | Web scraping | Alternative search |

### Payment (Stripe)

- **Checkout**: `create-checkout-session` edge function
- **Portal**: `create-portal-session` edge function
- **Webhooks**: `stripe-webhook` edge function

---

## 8. Architectural Patterns

### Pattern 1: Service Layer Abstraction

```typescript
// src/services/syllabus-service.ts
export async function analyzeSyllabus(text: string, courseId: string) {
  return supabase.functions.invoke('analyze-syllabus', {
    body: { syllabusText: text, courseId }
  });
}

// src/hooks/useAnalyzeSyllabus.ts
export function useAnalyzeSyllabus() {
  return useMutation({
    mutationFn: analyzeSyllabus,
    onSuccess: () => queryClient.invalidateQueries(['courses'])
  });
}

// Component usage
const { mutateAsync } = useAnalyzeSyllabus();
await mutateAsync({ text, courseId });
```

### Pattern 2: React Query for Server State

```typescript
// Query key organization (src/lib/query-keys.ts)
export const queryKeys = {
  courses: {
    list: () => ['courses'],
    detail: (id: string) => ['courses', id]
  },
  dreamJobs: {
    list: () => ['dreamJobs'],
    analysis: (id: string) => ['dreamJobs', id, 'analysis']
  }
};

// Usage
const { data, isLoading } = useQuery({
  queryKey: queryKeys.courses.list(),
  queryFn: fetchCourses
});
```

### Pattern 3: Shared Edge Function Code

```
supabase/functions/
├── _shared/
│   ├── prompts.ts      # AI system prompts
│   ├── schemas.ts      # Validation schemas
│   ├── ai-cache.ts     # Response caching
│   └── rate-limiter.ts # Rate limiting
└── analyze-syllabus/
    └── index.ts        # Imports from _shared
```

### Pattern 4: Unified Pages

Two main pages handle most user needs:

- **`/learn`** - All course management (active, transcript, search)
- **`/career`** - All career planning (jobs, gaps, actions)

This reduces route complexity while maintaining comprehensive functionality.

---

## 9. Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:8080

# Run linting
npm run lint

# Run tests
npm test
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
```

### Code Organization Rules

1. **One component per file** - Named exports preferred
2. **Hooks start with `use`** - One hook per file
3. **Services abstract API calls** - No direct Supabase in components
4. **Types are auto-generated** - Don't manually edit `supabase/types.ts`

### Testing Strategy

- **Unit Tests**: Custom hooks with Vitest
- **Integration**: React Testing Library
- **Location**: `src/test/` for mocks/factories

---

## Quick Reference

### Common Tasks

| Task | Location |
|------|----------|
| Add a new page | `src/pages/` + update `App.tsx` routes |
| Add a component | `src/components/[category]/` |
| Add a hook | `src/hooks/use[Name].ts` |
| Add an edge function | `supabase/functions/[name]/index.ts` |
| Add a database table | `supabase/migrations/` |

### Debugging Tips

1. **React Query DevTools** - Built-in cache inspection
2. **Supabase Dashboard** - Database queries, function logs
3. **Network Tab** - API request/response inspection
4. **TypeScript Errors** - Usually indicate missing types in `supabase/types.ts`

---

## Related Documentation

- [User Journeys](./USER_JOURNEYS.md) - Detailed user flows
- [API Reference](./API_REFERENCE.md) - Edge function documentation
- [Component Guide](./COMPONENTS.md) - Component hierarchy and usage
