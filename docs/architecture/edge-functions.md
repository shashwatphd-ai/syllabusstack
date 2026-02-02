# Edge Functions Catalog

## Overview

SyllabusStack has **78 edge functions** organized by domain. All functions follow the standardized CORS/Error handling pattern.

## Function Categories

### Assessment Functions (7)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `start-assessment` | Begin assessment session | Yes | Yes |
| `submit-assessment-answer` | Submit answer | Yes | Yes |
| `complete-assessment` | Finish assessment | Yes | Yes |
| `start-skills-assessment` | Begin skills assessment | Yes | Yes |
| `submit-skills-response` | Submit skills response | Yes | Yes |
| `complete-skills-assessment` | Finish skills assessment | Yes | Yes |
| `generate-assessment-questions` | AI question generation | Yes | Yes |

### Career/Dream Job Functions (5)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `discover-dream-jobs` | AI job recommendations | Yes | Yes |
| `analyze-dream-job` | Analyze job requirements | Yes | Yes |
| `gap-analysis` | Skill gap analysis | Yes | Yes |
| `match-careers` | Career matching | Yes | Yes |
| `generate-recommendations` | Content recommendations | Yes | Yes |

### Content Functions (12)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `search-youtube-content` | Video search | No | Yes |
| `search-youtube-manual` | Manual video search | No | Yes |
| `add-manual-content` | Add content manually | No | Yes |
| `add-instructor-content` | Add via URL | No | Yes |
| `fetch-video-metadata` | Get video details | No | Yes |
| `evaluate-content-batch` | AI content evaluation | Yes | No |
| `search-educational-content` | Multi-source search | No | Yes |
| `search-khan-academy` | Khan Academy search | No | No |
| `firecrawl-search-courses` | Course discovery | No | No |
| `compare-web-providers` | Provider comparison | No | No |
| `generate-content-strategy` | Content curation AI | Yes | Yes |
| `generate-search-context` | Search query AI | Yes | Yes |

### Lecture/Slide Functions (6)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `generate-lecture-slides-v3` | AI slide generation | Yes | Yes |
| `generate-lecture-audio` | TTS for slides | Yes | Yes |
| `generate-micro-checks` | In-video questions | Yes | Yes |
| `process-lecture-queue` | Queue processing | No | No |
| `submit-batch-slides` | Batch slide jobs | No | No |
| `trigger-progressive-generation` | Progressive gen | No | No |

### Syllabus Processing (5)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `analyze-syllabus` | AI syllabus analysis | Yes | No |
| `process-syllabus` | Structure extraction | Yes | No |
| `extract-learning-objectives` | LO extraction | Yes | No |
| `parse-syllabus-document` | Document parsing | No | No |
| `curriculum-reasoning-agent` | Curriculum AI | Yes | No |

### Curriculum Functions (6)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `generate-curriculum` | AI curriculum gen | Yes | Yes |
| `submit-batch-curriculum` | Batch curriculum | No | Yes |
| `poll-batch-curriculum` | Batch status | No | Yes |
| `poll-batch-evaluation` | Evaluation status | No | Yes |
| `poll-batch-status` | Generic batch status | No | Yes |
| `cancel-batch-job` | Cancel batch | No | Yes |

### Enrollment Functions (3)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `enroll-in-course` | Student enrollment | No | Yes |
| `create-course-payment` | Payment intent | No | No |
| `track-consumption` | Content tracking | No | Yes |

### Certification Functions (4)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `issue-certificate` | Issue credential | No | Yes |
| `verify-certificate` | Verify credential | No | Yes |
| `purchase-certificate` | Buy certificate | No | No |
| `employer-verify-completion` | Employer verify | No | No |

### Identity Verification (3)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `initiate-identity-verification` | Start IDV | No | Yes |
| `identity-verification-status` | IDV status | No | No |
| `idv-webhook` | Persona webhook | No | No |

### Instructor Functions (5)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `verify-instructor-email` | Instructor verify | No | Yes |
| `review-instructor-verification` | Admin review | No | Yes |
| `send-student-message` | Message students | No | Yes |
| `use-invite-code` | Accept invite | No | Yes |
| `auto-link-courses` | Course linking | No | No |

### Employer/Webhook Functions (3)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `create-webhook` | Register webhook | No | Yes |
| `send-employer-webhook` | Send webhook | No | No |
| `send-digest-email` | Digest emails | No | No |

### Payment Functions (4)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `create-checkout-session` | Stripe checkout | No | No |
| `create-portal-session` | Billing portal | No | No |
| `cancel-subscription` | Cancel sub | No | No |
| `stripe-webhook` | Stripe events | No | No |
| `get-invoices` | List invoices | No | No |

### Organization Functions (4)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `invite-users` | Invite to org | No | Yes |
| `remove-org-user` | Remove from org | No | Yes |
| `configure-organization-sso` | SSO setup | No | No |
| `get-usage-stats` | Usage analytics | No | No |

### Job Search Functions (3)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `search-jobs` | Job search | Yes | Yes |
| `scrape-job-posting` | Scrape job URL | Yes | Yes |
| `get-onet-occupation` | O*NET data | No | No |

### Utility Functions (5)
| Function | Purpose | Rate Limited | Validated |
|----------|---------|--------------|-----------|
| `global-search` | Platform search | No | Yes |
| `ai-gateway` | AI routing | Yes | No |
| `content-assistant-chat` | AI chat | Yes | No |
| `record-proctor-event` | Proctoring | No | Yes |
| `process-batch-images` | Image processing | No | No |
| `process-batch-research` | Research batch | No | No |

## Shared Utilities

### _shared/cors.ts
- `getCorsHeaders(req)` - Get CORS headers for origin
- `handleCorsPreFlight(req)` - Handle OPTIONS requests

### _shared/error-handler.ts
- `createErrorResponse(code, headers, message)` - Standardized errors
- `createSuccessResponse(data, headers)` - Standardized success
- `withErrorHandling(handler, getCorsHeaders)` - Error wrapper
- `logInfo(function, action, data)` - Structured logging
- `logError(function, error)` - Error logging

### _shared/rate-limiter.ts
- `checkRateLimit(supabase, userId, function, limits)` - Check limits
- `getUserLimits(supabase, userId)` - Get user tier limits
- `createRateLimitResponse(result, headers)` - 429 response

### _shared/validators/index.ts
- 50+ Zod schemas for input validation
- `validateRequest(schema, data)` - Validate and return typed data

### _shared/unified-ai-client.ts
- `generateText(options)` - Text generation
- `generateStructured(options)` - JSON generation
- `MODELS` - Available model configurations
