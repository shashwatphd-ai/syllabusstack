# SyllabusStack Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  React SPA (Vite + TypeScript)                                   │
│  ├── TanStack Query (Server State)                               │
│  ├── Zustand (Client State)                                      │
│  ├── shadcn/ui + Tailwind CSS                                    │
│  └── React Router v6                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  Supabase Edge Functions (Deno)                                  │
│  ├── 78 Edge Functions                                           │
│  ├── Shared Utilities (_shared/)                                 │
│  │   ├── CORS Handler                                            │
│  │   ├── Error Handler                                           │
│  │   ├── Rate Limiter                                            │
│  │   ├── Zod Validators                                          │
│  │   └── AI Client (Unified)                                     │
│  └── Skills Assessment Pipeline                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL + Auth + Storage)                          │
│  ├── Row Level Security (RLS)                                    │
│  ├── Database Functions (PL/pgSQL)                               │
│  ├── Realtime Subscriptions                                      │
│  └── Storage Buckets                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
├─────────────────────────────────────────────────────────────────┤
│  AI: OpenRouter (Claude, GPT-4, Gemini)                          │
│  Video: YouTube Data API, Invidious, Piped                       │
│  Payments: Stripe                                                │
│  Identity: Persona / Onfido                                      │
│  Jobs: RapidAPI Active Jobs DB                                   │
│  Email: Resend                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI Framework |
| **TypeScript** | Type Safety |
| **Vite** | Build Tool |
| **TanStack Query** | Server State Management |
| **Zustand** | Client State |
| **shadcn/ui** | Component Library |
| **Tailwind CSS** | Styling |
| **React Router v6** | Routing |

### Backend
| Technology | Purpose |
|------------|---------|
| **Supabase** | BaaS Platform |
| **PostgreSQL** | Database |
| **Deno** | Edge Function Runtime |
| **Zod** | Input Validation |

### AI/ML
| Technology | Purpose |
|------------|---------|
| **OpenRouter** | AI Gateway |
| **Claude 3.5** | Primary LLM |
| **GPT-4** | Fallback LLM |
| **Gemini** | Batch Processing |

### External Services
| Service | Purpose |
|---------|---------|
| **Stripe** | Payments |
| **Persona** | Identity Verification |
| **YouTube API** | Video Metadata |
| **RapidAPI** | Job Search |

## Key Design Patterns

### 1. Edge Function Pattern
All edge functions follow a consistent pattern:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, withErrorHandling } from "../_shared/error-handler.ts";
import { checkRateLimit, getUserLimits } from "../_shared/rate-limiter.ts";
import { validateRequest, schema } from "../_shared/validators/index.ts";

const handler = async (req: Request): Promise<Response> => {
  // 1. CORS
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const corsHeaders = getCorsHeaders(req);

  // 2. Auth
  const authHeader = req.headers.get('Authorization');
  // ... authenticate user

  // 3. Rate Limit
  const rateLimitResult = await checkRateLimit(supabase, user.id, 'function-name', limits);
  if (!rateLimitResult.allowed) return createRateLimitResponse(...);

  // 4. Validation
  const validation = validateRequest(schema, await req.json());
  if (!validation.success) return createErrorResponse('VALIDATION_ERROR', ...);

  // 5. Business Logic
  // ...

  // 6. Response
  return createSuccessResponse(data, corsHeaders);
};

serve(withErrorHandling(handler, getCorsHeaders));
```

### 2. Hook Modularization
Large hooks are split into focused modules:

```
src/hooks/assessment/
├── types.ts        # Type definitions
├── queries.ts      # useQuery hooks
├── mutations.ts    # useMutation hooks
├── microChecks.ts  # Specific feature
├── legacy.ts       # Backward compat
└── index.ts        # Barrel exports
```

### 3. Row Level Security
All tables use RLS policies:

```sql
-- Users can only read their own data
CREATE POLICY "Users read own data"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Instructors can read their course students
CREATE POLICY "Instructors read course students"
  ON course_enrollments FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM instructor_courses
      WHERE instructor_id = auth.uid()
    )
  );
```

## Security Model

### Authentication Flow
```
User → Supabase Auth → JWT Token → Edge Function → Validate → Execute
```

### Authorization Layers
1. **JWT Validation** - Token authenticity
2. **Rate Limiting** - Abuse prevention
3. **Input Validation** - Zod schemas
4. **RLS Policies** - Data access control
5. **SSRF Protection** - URL whitelisting

## Scalability Considerations

### Current Architecture (MVP)
- Single Supabase project
- Serverless edge functions
- Shared database

### Future Scaling Path
1. Database read replicas
2. Edge function caching
3. CDN for static assets
4. Multi-region deployment
5. Event-driven architecture (ScholarChain)
