# API Reference - SyllabusStack Edge Functions

This document describes all Supabase Edge Functions (Deno) available in SyllabusStack.

## Table of Contents

1. [Overview](#overview)
2. [Core Analysis Functions](#core-analysis-functions)
3. [Content Discovery Functions](#content-discovery-functions)
4. [Assessment Functions](#assessment-functions)
5. [Recommendation Functions](#recommendation-functions)
6. [Billing Functions](#billing-functions)
7. [Utility Functions](#utility-functions)
8. [Shared Utilities](#shared-utilities)

---

## Overview

### Base URL

```
https://fapxxswgdfomqtugibgf.supabase.co/functions/v1/
```

### Authentication

Most functions require a valid JWT token in the Authorization header:

```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { /* request body */ }
});
// JWT is automatically included by Supabase client
```

### Response Format

All functions return JSON with this structure:

```typescript
// Success
{
  "data": { /* response data */ },
  "error": null
}

// Error
{
  "data": null,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

### CORS Headers

All functions include CORS headers:

```typescript
{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
```

---

## Core Analysis Functions

### `analyze-syllabus`

Parses syllabus text and extracts capabilities using AI.

**Method:** POST

**Authentication:** Not required (public)

**Request:**
```typescript
{
  syllabusText: string;  // Raw syllabus text
  courseId: string;      // UUID of the course
}
```

**Response:**
```typescript
{
  capabilities: Array<{
    name: string;
    category: string;
    proficiency_level: 'beginner' | 'intermediate' | 'advanced';
  }>;
  analysis: {
    key_capabilities: string[];
    tools_methods: string[];
    evidence_types: string[];
  };
  ai_model_used: string;
  ai_cost_usd: number;
}
```

**Usage:**
```typescript
const { data } = await supabase.functions.invoke('analyze-syllabus', {
  body: { syllabusText: text, courseId: course.id }
});
```

---

### `parse-syllabus-document`

Parses PDF/Word documents and extracts text.

**Method:** POST

**Authentication:** Not required

**Request:**
```typescript
{
  document_url: string;  // Signed URL from Supabase Storage
  file_name: string;     // Original filename
}
```

**Response:**
```typescript
{
  text: string;          // Extracted text content
  extracted_text: string;
  metadata: {
    page_count: number;
    file_type: string;
  };
  analysis: object;      // Parsed structure
}
```

---

### `analyze-dream-job`

Analyzes job requirements using AI.

**Method:** POST

**Authentication:** Not required

**Request:**
```typescript
{
  jobTitle: string;           // e.g., "Software Engineer"
  companyType?: string;       // e.g., "FAANG", "Startup"
  location?: string;          // e.g., "San Francisco"
  dreamJobId: string;         // UUID of dream_job record
}
```

**Response:**
```typescript
{
  requirements: Array<{
    name: string;
    importance: 'critical' | 'important' | 'nice_to_have';
    category: string;
  }>;
  description: string;
  salary_range: {
    min: number;
    max: number;
    currency: string;
  };
  day_one_capabilities: string[];
  differentiators: string[];
  misconceptions: string[];
  realistic_bar: string;
  ai_model_used: string;
  ai_cost_usd: number;
}
```

---

### `gap-analysis`

Compares user capabilities against job requirements.

**Method:** POST

**Authentication:** Required (JWT)

**Request:**
```typescript
{
  dreamJobId: string;    // UUID of dream job
  userId?: string;       // Optional, defaults to authenticated user
}
```

**Response:**
```typescript
{
  match_score: number;           // 0-100 percentage
  strong_overlaps: Array<{
    capability: string;
    requirement: string;
    evidence: string;
  }>;
  critical_gaps: Array<{
    requirement: string;
    importance: string;
    why_critical: string;
  }>;
  partial_overlaps: Array<{
    capability: string;
    requirement: string;
    gap_description: string;
  }>;
  honest_assessment: string;     // Paragraph of honest feedback
  readiness_level: 1 | 2 | 3 | 4 | 5;
  interview_readiness: string;
  job_success_prediction: string;
  priority_gaps: Array<{
    gap: string;
    priority: number;
    reason: string;
  }>;
  ai_model_used: string;
  ai_cost_usd: number;
}
```

**Usage:**
```typescript
const { data } = await supabase.functions.invoke('gap-analysis', {
  body: { dreamJobId: job.id }
});
```

---

## Content Discovery Functions

### `search-youtube-manual`

Searches YouTube for educational videos with fallback support.

**Method:** POST

**Authentication:** Not required

**Request:**
```typescript
{
  query: string;              // Search query
  limit?: number;             // Max results (default: 10)
  useAlternatives?: boolean;  // Enable fallbacks (default: true)
}
```

**Response:**
```typescript
{
  videos: Array<{
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    channel: string;
    duration: string;
    url: string;
    source: 'youtube' | 'invidious' | 'piped' | 'khan';
  }>;
  metadata: {
    total_results: number;
    source_used: string;
    quota_remaining: number;
  };
}
```

**Fallback Chain:**
1. YouTube API (primary)
2. Invidious API (if quota exceeded)
3. Piped API (if Invidious fails)
4. Khan Academy (final fallback)

---

### `search-khan-academy`

Searches Khan Academy for educational content.

**Method:** POST

**Authentication:** Not required

**Request:**
```typescript
{
  query: string;
}
```

**Response:**
```typescript
{
  videos: Array<{
    id: string;
    title: string;
    description: string;
    url: string;
    duration: string;
    topic: string;
  }>;
}
```

---

### `firecrawl-search-courses`

Web scraping for course discovery.

**Method:** POST

**Authentication:** Not required

**Request:**
```typescript
{
  query: string;        // Search term
  courseTitle?: string; // Context for better results
}
```

**Response:**
```typescript
{
  courses: Array<{
    title: string;
    provider: string;       // "Coursera", "edX", etc.
    url: string;
    description: string;
    price: 'free' | 'paid';
    duration: string;
  }>;
}
```

---

### `global-search`

Cross-content search across all sources.

**Method:** POST

**Authentication:** Not required

**Request:**
```typescript
{
  query: string;
  types?: ('video' | 'course' | 'article')[];
}
```

**Response:**
```typescript
{
  results: {
    videos: Video[];
    courses: Course[];
    articles: Article[];
  };
  total: number;
}
```

---

## Assessment Functions

### `extract-learning-objectives`

Generates learning objectives from course content.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  moduleId: string;
  moduleTitle: string;
  moduleDescription: string;
  userId: string;
}
```

**Response:**
```typescript
{
  learningObjectives: Array<{
    text: string;
    bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
    core_concept: string;
  }>;
  ai_model_used: string;
  ai_cost_usd: number;
}
```

---

### `generate-assessment-questions`

Creates quiz questions for a learning objective.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  learningObjectiveId: string;
  questionCount?: number;     // Default: 5
}
```

**Response:**
```typescript
{
  questions: Array<{
    question_text: string;
    question_type: 'multiple_choice' | 'true_false' | 'short_answer';
    options?: string[];       // For multiple choice
    correct_answer: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  ai_model_used: string;
  ai_cost_usd: number;
}
```

---

### `submit-assessment-answer`

Validates a submitted quiz answer.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  questionId: string;
  answer: string;
  attemptId: string;
}
```

**Response:**
```typescript
{
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}
```

---

### `complete-assessment`

Marks an assessment as completed.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  assessmentId: string;
  attemptId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  score: number;          // Percentage
  passed: boolean;
  feedback: string;
}
```

---

## Recommendation Functions

### `generate-recommendations`

Creates personalized learning recommendations based on gap analysis.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  dreamJobId: string;
}
```

**Response:**
```typescript
{
  recommendations: Array<{
    priority: number;
    gap_addressed: string;
    action_title: string;
    action_description: string;
    why_this_matters: string;
    steps: Array<{
      order: number;
      description: string;
      estimated_time: string;
    }>;
    type: 'project' | 'course' | 'certification' | 'action' | 'reading';
    effort_hours: number;
    cost: number;
    evidence_created: string;
    how_to_demonstrate: string;
    resource_url?: string;
    resource_provider?: string;
  }>;
  anti_recommendations: Array<{
    action: string;
    reason: string;
  }>;
  ai_model_used: string;
  ai_cost_usd: number;
}
```

---

### `discover-dream-jobs`

Suggests dream jobs based on user skills and interests.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  skills: string[];
  interests: string[];
}
```

**Response:**
```typescript
{
  jobs: Array<{
    title: string;
    description: string;
    match_score: number;
    why_good_fit: string;
  }>;
}
```

---

## Billing Functions

### `create-checkout-session`

Creates a Stripe checkout session for subscription.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  priceId: string;           // Stripe price ID
  successUrl?: string;
  cancelUrl?: string;
}
```

**Response:**
```typescript
{
  sessionId: string;
  url: string;               // Redirect URL
}
```

---

### `create-portal-session`

Creates a Stripe billing portal session.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  portalUrl: string;
}
```

---

### `cancel-subscription`

Cancels the user's subscription.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

### `stripe-webhook`

Handles Stripe webhook events.

**Method:** POST

**Authentication:** Stripe signature verification

**Events Handled:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## Utility Functions

### `get-usage-stats`

Returns user's API usage statistics.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  current_period: {
    ai_calls: number;
    content_searches: number;
    assessments: number;
  };
  limits: {
    ai_calls: number;
    content_searches: number;
    assessments: number;
  };
  cost_usd: number;
  period_start: string;
  period_end: string;
}
```

---

### `generate-lecture-slides-v2`

Generates presentation slides for a topic.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  title: string;
  content: string;
  learningObjectives?: string[];
  slideCount?: number;
}
```

**Response:**
```typescript
{
  slides: Array<{
    title: string;
    content: string;
    notes: string;
    type: 'title' | 'content' | 'summary';
  }>;
  ai_model_used: string;
  ai_cost_usd: number;
}
```

---

### `add-manual-content`

Allows instructors to add custom content.

**Method:** POST

**Authentication:** Required

**Request:**
```typescript
{
  courseId: string;
  learningObjectiveId?: string;
  content: {
    title: string;
    url: string;
    type: 'video' | 'article' | 'code';
    description?: string;
  };
}
```

**Response:**
```typescript
{
  contentId: string;
  success: boolean;
}
```

---

### `invite-users`

Invites users to an organization.

**Method:** POST

**Authentication:** Required (admin only)

**Request:**
```typescript
{
  emails: string[];
  role: 'student' | 'instructor';
  organizationId: string;
}
```

**Response:**
```typescript
{
  invited: string[];
  failed: Array<{
    email: string;
    reason: string;
  }>;
}
```

---

## Shared Utilities

Located in `supabase/functions/_shared/`:

### `prompts.ts`

System prompts for AI interactions.

```typescript
export const SYLLABUS_ANALYSIS_PROMPT = "...";
export const GAP_ANALYSIS_PROMPT = "...";
export const RECOMMENDATION_PROMPT = "...";
```

### `schemas.ts`

Zod validation schemas.

```typescript
export const syllabusRequestSchema = z.object({
  syllabusText: z.string().min(1),
  courseId: z.string().uuid()
});
```

### `ai-cache.ts`

AI response caching and cost tracking.

```typescript
export async function getCachedOrFetch(
  key: string,
  fetchFn: () => Promise<any>
): Promise<any>;

export async function trackAICost(
  userId: string,
  cost: number,
  model: string
): Promise<void>;
```

### `rate-limiter.ts`

Per-user rate limiting.

```typescript
export async function checkRateLimit(
  userId: string,
  action: string
): Promise<{ allowed: boolean; remaining: number }>;
```

### `error-handler.ts`

Standardized error responses.

```typescript
export function handleError(error: Error): Response;
export function createErrorResponse(message: string, code: string): Response;
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | JWT token missing or invalid |
| `RATE_LIMITED` | Rate limit exceeded |
| `INVALID_REQUEST` | Request validation failed |
| `AI_ERROR` | AI service error |
| `NOT_FOUND` | Resource not found |
| `FORBIDDEN` | Permission denied |
| `QUOTA_EXCEEDED` | API quota exceeded |
| `INTERNAL_ERROR` | Server error |

---

## Rate Limits

| Tier | AI Calls/Month | Content Searches/Month |
|------|----------------|------------------------|
| Free | 50 | 100 |
| Standard | 500 | 1000 |
| Premium | 2000 | 5000 |
| Enterprise | Custom | Custom |

---

## Service Layer Usage (Frontend)

All edge functions are accessed via the service layer in `src/services/`:

```typescript
// src/services/syllabus-service.ts
import { supabase } from '@/integrations/supabase/client';

export async function analyzeSyllabus(syllabusText: string, courseId: string) {
  return supabase.functions.invoke('analyze-syllabus', {
    body: { syllabusText, courseId }
  });
}
```

Then used in hooks:

```typescript
// src/hooks/useAnalyzeSyllabus.ts
import { useMutation } from '@tanstack/react-query';
import { analyzeSyllabus } from '@/services/syllabus-service';

export function useAnalyzeSyllabus() {
  return useMutation({
    mutationFn: ({ text, courseId }) => analyzeSyllabus(text, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    }
  });
}
```
