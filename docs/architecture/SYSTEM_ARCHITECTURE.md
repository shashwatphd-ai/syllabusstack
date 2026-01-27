# SyllabusStack System Architecture

## Overview

SyllabusStack is a comprehensive learning platform that connects students with their dream careers through intelligent skill tracking, gap analysis, and personalized recommendations.

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TanStack Query** for server state management
- **Tailwind CSS** + **shadcn/ui** for styling
- **React Router** for navigation

### Backend
- **Supabase** (PostgreSQL + Edge Functions)
- **Deno** runtime for edge functions
- **OpenAI** / **Anthropic** for AI features
- **Stripe** for payments

### Infrastructure
- **Vercel** / **Lovable** for frontend hosting
- **Supabase** for database & auth
- **Edge Functions** for serverless compute

## Core Architecture Patterns

### 1. Data Flow

```
User Action → React Component → TanStack Query → Supabase Client → Edge Function/Database
                                      ↓
                              Cache Management
                                      ↓
                              UI State Update
```

### 2. Authentication Flow

```
Login/Signup → Supabase Auth → JWT Token → AuthContext → Protected Routes
                    ↓
              User Profile Creation (trigger)
                    ↓
              Role Assignment (student default)
```

### 3. AI Processing Pipeline

```
User Request → Rate Limiter → Edge Function → AI Gateway → OpenAI/Anthropic
      ↓              ↓              ↓              ↓
   Validation   Usage Tracking  Response Cache  Token Counting
```

## Module Structure

### Frontend Modules

```
src/
├── components/         # Reusable UI components
│   ├── common/        # Shared components (HelpTooltip, ProductTour, etc.)
│   ├── assessment/    # Assessment-related components
│   ├── instructor/    # Instructor dashboard components
│   ├── student/       # Student dashboard components
│   ├── employer/      # Employer verification components
│   └── admin/         # Admin panel components
├── hooks/             # Custom React hooks
│   ├── useVerifiedSkills.ts    # Skill verification
│   ├── useCareerMatches.ts     # O*NET career matching
│   ├── useRecommendations.ts   # Learning recommendations
│   ├── useGapAnalysis.ts       # Skill gap analysis
│   └── ...
├── pages/             # Route pages
├── contexts/          # React contexts (Auth, etc.)
├── lib/               # Utilities and helpers
└── integrations/      # External integrations (Supabase)
```

### Backend Modules

```
supabase/
├── functions/         # Edge functions
│   ├── _shared/      # Shared utilities
│   │   ├── cors.ts
│   │   ├── rate-limiter.ts
│   │   ├── skill-extractor.ts
│   │   └── ai-gateway.ts
│   ├── complete-assessment/     # Assessment completion
│   ├── gap-analysis/           # Skill gap analysis
│   ├── generate-recommendations/  # AI recommendations
│   ├── discover-dream-jobs/    # Career discovery
│   └── ...
└── migrations/        # Database migrations
```

## Key Subsystems

### 1. Verified Skills Loop
Records verified skills when students pass assessments, feeding into gap analysis.

**Flow:**
```
Assessment Pass → Skill Extractor → Verified Skills Table → Gap Analysis Update
```

### 2. Career-Dream Job Connection
Matches user skills with O*NET occupations and enables dream job tracking.

**Flow:**
```
User Skills → O*NET API → Career Matches → Dream Job Selection → Gap Analysis
```

### 3. Recommendation Engine
Generates personalized learning recommendations based on skill gaps.

**Flow:**
```
Gap Analysis → AI Recommendation Generator → Course Linking → Progress Tracking
```

### 4. Instructor Analytics
Provides course creators with student progress insights.

**Components:**
- Course Analytics Dashboard
- Gradebook with detailed scores
- Student messaging system

### 5. Employer Verification
Enables employers to verify student credentials.

**Features:**
- Batch verification upload
- Webhook notifications
- API access for integrations

## Security Architecture

### Row Level Security (RLS)
All database tables implement RLS policies:
- Users can only access their own data
- Instructors can access their course data
- Admins have elevated access

### Rate Limiting
- Token bucket algorithm for burst handling
- Tier-based limits (free/pro/enterprise)
- Per-user and per-endpoint limits

### Input Validation
- Zod schemas for request validation
- SQL injection prevention via parameterized queries
- XSS prevention via React's default escaping

## Performance Optimizations

### Database Indexes
Key indexes for common queries:
- `idx_consumption_records_user_lo`
- `idx_recommendations_user_job`
- `idx_gap_analyses_job_created`

### Query Optimization
- TanStack Query caching with stale-while-revalidate
- Optimistic updates for mutations
- Pagination for large datasets

### Frontend Optimization
- Code splitting via React.lazy
- Image optimization
- Bundle size monitoring

## Monitoring & Observability

### Error Tracking
- Client-side error boundary
- Error categorization (API, auth, database, etc.)
- Breadcrumb trails for debugging

### Logging
- Structured logging in edge functions
- Request/response logging for debugging
- Performance timing metrics

## Deployment

### CI/CD Pipeline
```
Push → Build → Test → Deploy Preview → Merge → Production Deploy
```

### Environment Management
- Development: Local Supabase
- Staging: Preview deployments
- Production: Main branch auto-deploy
