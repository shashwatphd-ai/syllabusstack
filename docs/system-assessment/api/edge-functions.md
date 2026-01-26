# Edge Functions Inventory

**Assessment Date:** January 26, 2026
**Total Functions:** 77 (75 operational + 2 utility folders)

---

## Executive Summary

| Category | Count | JWT Required | Public |
|----------|-------|--------------|--------|
| AI/Content Generation | 14 | 8 | 6 |
| Search & Discovery | 8 | 6 | 2 |
| Assessment & Verification | 7 | 7 | 0 |
| Payments & Billing | 6 | 5 | 1 |
| User Management | 9 | 8 | 1 |
| Batch Processing | 8 | 3 | 5 |
| Utilities | 23 | 19 | 4 |
| **Total** | **75** | **56** | **19** |

---

## Category 1: AI/Content Generation (14 functions)

### Core Content Generation

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `generate-lecture-slides-v3` | No | Create lecture slides with research | OpenRouter, Google Search, Cloud TTS |
| `generate-lecture-audio` | Yes | TTS narration for slides | Google Cloud TTS, Gemini |
| `generate-curriculum` | Yes | Design structured curriculum | OpenRouter (gemini-2.5-flash) |
| `curriculum-reasoning-agent` | No | Advanced curriculum reasoning | OpenRouter |
| `content-assistant-chat` | Yes | Interactive content helper | OpenRouter |

### Assessment Generation

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `generate-assessment-questions` | Yes | MCQ/short-answer questions | OpenRouter (gpt-4o-mini) |
| `generate-micro-checks` | Yes | Video comprehension checks | OpenRouter |
| `generate-content-strategy` | Yes | YouTube search optimization | OpenRouter |

### Career & Skills

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `gap-analysis` | Yes | Skills gap assessment | OpenRouter |
| `generate-recommendations` | Yes | Personalized learning paths | OpenRouter |
| `discover-dream-jobs` | Yes | Career exploration | OpenRouter |
| `analyze-dream-job` | No | Job fit assessment | OpenRouter |

### Content Extraction

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `parse-syllabus-document` | No | PDF/DOCX/image parsing | Gemini 2.0, Google Vision |
| `extract-learning-objectives` | No | LO extraction | OpenRouter |
| `analyze-syllabus` | No | Capability extraction | OpenRouter |

---

## Category 2: Search & Discovery (8 functions)

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `global-search` | Yes | Platform-wide search | Supabase FTS |
| `firecrawl-search-courses` | Yes | Web course search | Firecrawl API |
| `search-educational-content` | Yes | Educational content | Various providers |
| `search-youtube-content` | Yes | YouTube videos | YouTube API |
| `search-youtube-manual` | No | Manual YouTube search | YouTube API |
| `search-khan-academy` | Yes | Khan Academy content | Khan Academy API |
| `search-jobs` | Yes | Job postings | Job APIs |
| `compare-web-providers` | Yes | Provider comparison | Firecrawl |

---

## Category 3: Assessment & Skills (7 functions)

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `start-assessment` | Yes | Begin assessment session | Database |
| `submit-assessment-answer` | Yes | Submit answer | Database |
| `complete-assessment` | Yes | Finish assessment | Database |
| `start-skills-assessment` | Yes | Begin skills test | Database |
| `submit-skills-response` | Yes | Submit skills answer | Database |
| `complete-skills-assessment` | Yes | Finish skills test | Database |
| `match-careers` | Yes | Career matching | O*NET, OpenRouter |

---

## Category 4: Payments & Billing (6 functions)

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `create-checkout-session` | Yes | Stripe checkout | Stripe |
| `create-course-payment` | Yes | Course payment | Stripe |
| `stripe-webhook` | No | Payment webhooks | Stripe signature |
| `create-portal-session` | Yes | Customer portal | Stripe |
| `cancel-subscription` | Yes | Cancel subscription | Stripe |
| `get-invoices` | Yes | Retrieve invoices | Stripe |

---

## Category 5: User Management (9 functions)

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `invite-users` | Yes | Bulk invitations | Supabase Auth |
| `remove-org-user` | Yes | Remove user from org | Supabase Auth |
| `verify-instructor-email` | Yes | Instructor verification | Email service |
| `review-instructor-verification` | Yes | Admin review | Database |
| `initiate-identity-verification` | Yes | Start IDV | Persona |
| `identity-verification-status` | Yes | Check IDV status | Persona |
| `idv-webhook` | No | IDV callbacks | Persona signature |
| `issue-certificate` | Yes | Generate certificate | Database, PDF |
| `verify-certificate` | No | Public cert check | Database |

---

## Category 6: Batch Processing (8 functions)

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `submit-batch-slides` | No | Submit to Vertex AI | Vertex AI Batch |
| `submit-batch-curriculum` | Yes | Submit curriculum batch | Vertex AI Batch |
| `submit-batch-evaluation` | Yes | Submit evaluation batch | Vertex AI Batch |
| `poll-batch-status` | Yes | Check batch status | Vertex AI |
| `poll-batch-curriculum` | Yes | Check curriculum status | Vertex AI |
| `poll-batch-evaluation` | Yes | Check eval status | Vertex AI |
| `process-batch-images` | No | Async image generation | OpenRouter, Storage |
| `process-batch-research` | No | Research processing | OpenRouter |
| `cancel-batch-job` | Yes | Cancel batch | Vertex AI |

---

## Category 7: Utilities (23 functions)

| Function | JWT | Purpose | External Services |
|----------|-----|---------|-------------------|
| `ai-gateway` | No | Central AI routing | OpenRouter |
| `add-instructor-content` | Yes | Add content | Database |
| `add-manual-content` | Yes | Manual content | Database |
| `auto-link-courses` | No | Link related courses | AI matching |
| `enroll-in-course` | Yes | Course enrollment | Database |
| `fetch-video-metadata` | No | Video info | YouTube API |
| `get-onet-occupation` | No | O*NET lookup | O*NET API |
| `get-usage-stats` | Yes | Usage analytics | Database |
| `process-syllabus` | Yes | Syllabus processing | OpenRouter |
| `process-lecture-queue` | Yes | Lecture queue | OpenRouter |
| `scrape-job-posting` | Yes | Job scraping | Firecrawl |
| `send-digest-email` | No | Email digest | Resend |
| `track-consumption` | Yes | Usage tracking | Database |
| `trigger-progressive-generation` | Yes | Progressive gen | Internal |
| `use-invite-code` | Yes | Redeem invite | Database |
| `purchase-certificate` | Yes | Cert purchase | Stripe |
| `configure-organization-sso` | Yes | SSO setup | Auth providers |
| `employer-verify-completion` | Yes | Employer check | Database |
| `record-proctor-event` | Yes | Proctoring events | Database |
| `evaluate-content-batch` | Yes | Content evaluation | OpenRouter |
| `generate-search-context` | Yes | Search context | OpenRouter |

---

## Shared Modules (`_shared/`)

| Module | Purpose |
|--------|---------|
| `unified-ai-client.ts` | OpenRouter client with fallbacks |
| `openrouter-client.ts` | Direct OpenRouter calls |
| `rate-limiter.ts` | User rate limiting |
| `schemas.ts` | Shared Zod schemas |
| `cors.ts` | CORS headers |
| `types.ts` | Shared types |
| `prompts/` | AI system prompts |

---

## Function Patterns

### Error Handling
```typescript
// Standard pattern across functions
try {
  // Validate input
  if (!requiredField) {
    return new Response(JSON.stringify({ error: 'Missing field' }), { status: 400 });
  }

  // Process
  const result = await process();

  return new Response(JSON.stringify(result), { status: 200 });
} catch (error) {
  console.error('[function-name] Error:', error);
  return new Response(JSON.stringify({ error: error.message }), { status: 500 });
}
```

### Authentication Check
```typescript
// For protected functions
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
```

### Rate Limiting (when implemented)
```typescript
// In gap-analysis, match-careers, etc.
import { checkRateLimit } from '../_shared/rate-limiter.ts';
const allowed = await checkRateLimit(userId, 'function-name', limit);
if (!allowed) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
}
```

---

## Issues Identified

### API-001: Inconsistent Response Formats
Some functions return `{ data: ... }`, others return data directly.

### API-002: Missing Input Validation
Many functions accept raw JSON without Zod validation.

### API-003: No API Versioning
No version prefix in function URLs.

### API-004: Inconsistent Error Codes
Some functions return 400 for auth errors, others 401.

### API-005: Missing Rate Limiting
Most AI functions lack rate limiting.

---

## Recommendations

1. **Create shared response utilities** for consistent formatting
2. **Add Zod validation** to all function inputs
3. **Implement rate limiting** on all AI endpoints
4. **Standardize error codes** across functions
5. **Add request logging** for observability
6. **Consider API versioning** for future changes
