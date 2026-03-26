# Phase 1: Edge Function Inventory & Architecture Map

> **Report Date:** 2026-03-26
> **Scope:** `syllabusstack` vs `projectify-syllabus` (aka EduThree1)
> **Purpose:** Document every edge function, which repo owns it, and the architectural differences

---

## 1. Scale Summary

| Metric | `projectify-syllabus` | `syllabusstack` |
|--------|----------------------|-----------------|
| Edge Functions | 39 | 113 |
| Shared Library Files | ~13,800 LoC | ~21,000 LoC |
| Frontend LoC (approx) | ~25,000 | ~106,000 |
| AI Provider | Lovable AI Gateway (single) | OpenRouter + Vertex AI + Google + EvoLink (multi) |
| DB Table: `course_profiles` | Yes | No (uses `courses` + `instructor_courses`) |
| DB Table: `capstone_projects` | Yes | Yes (+ `capstone_project_forms`, `capstone_milestones`) |

---

## 2. Edge Functions: Complete Inventory

### 2A. SHARED Functions (exist in both repos - 21 total)

These functions exist in **both** codebases but may have different implementations:

| Function | Purpose | Key Difference |
|----------|---------|----------------|
| `_shared/` | Shared utilities | projectify: flat structure. syllabusstack: `capstone/` subdirectory + `unified-ai-client.ts` |
| `admin-regenerate-projects` | Re-run project generation for a course | Similar logic |
| `aggregate-demand-signals` | Aggregate employer demand data | Similar |
| `analyze-project-value` | Score project business value | Similar |
| `apollo-webhook-listener` | Receive Apollo.io webhooks | Similar |
| `career-pathway-mapper` | Map career progression paths | Similar |
| `cleanup-orphaned-data` | DB maintenance/cleanup | Similar |
| `detect-location` | Auto-detect university location | Similar |
| `discover-companies` | **CORE**: Find companies near course location | **projectify: 1,727 lines, syllabusstack: 673 lines** (syllabusstack delegates more to `_shared/capstone/`) |
| `get-live-demand` | Real-time skill demand data | Similar |
| `job-matcher` | Match students to jobs | Similar |
| `portfolio-export` | Export student portfolio | Similar |
| `process-generation-queue` | Background job processor | Similar |
| `project-suitability-scorer` | Score project fit | Similar |
| `refresh-company-jobs` | Refresh company job postings | Similar |
| `run-single-project-generation` | Generate one project | Similar |
| `salary-roi-calculator` | Calculate salary ROI | Similar |
| `send-faculty-approval-email` | Email faculty for approval | Similar |
| `skill-gap-analyzer` | Analyze skill gaps | Similar |
| `student-project-matcher` | Match students to projects | Similar |
| `submit-employer-interest` | Employer interest form | Similar |
| `sync-project-match` | Sync project updates | Similar |

### 2B. ONLY in `projectify-syllabus` (17 functions)

These exist in projectify-syllabus but **NOT** in syllabusstack:

| Function | Purpose | Why Missing from SyllabusStack |
|----------|---------|-------------------------------|
| `parse-syllabus` | Parse PDF syllabus + AI extraction | **Replaced** by `analyze-syllabus` + `parse-syllabus-document` + `process-syllabus` (split into 3) |
| `generate-projects` | Generate capstone projects | **Replaced** by `generate-capstone-projects` (renamed + enhanced with 6-form structure) |
| `competency-extractor` | Extract competencies from projects | **Replaced** by `extract-capstone-competencies` |
| `get-project-detail` | Fetch single project detail | Handled via direct Supabase queries in frontend hooks |
| `data-enrichment-pipeline` | Enrich company data | Functionality merged into `discover-companies` shared pipeline |
| `firecrawl-scrape` | Generic web scraping | **Not ported** - replaced by `firecrawl-search-courses` (course-specific) |
| `firecrawl-career-pages` | Scrape company career pages | **Not ported** - job data comes from Apollo directly |
| `get-apollo-org-id` | Apollo company ID lookup | Merged into `_shared/capstone/` discovery pipeline |
| `investigate-apollo-jobs` | Debug Apollo job data | **Debug tool** - not needed in production |
| `import-university-data` | Import university data | **Not ported** - universities managed differently |
| `migrate-technology-format` | One-time data migration | **Not ported** - migration complete |
| `rate-student-performance` | Rate student work | **Not ported** - assessments handled differently |
| `admin-reset-password` | Admin password reset | Handled by Supabase Auth directly |
| `TEST-real-email` | Test email integration | **Test utility** - not needed |
| `TEST-talent-alert` | Test talent alerts | **Test utility** - not needed |
| `test-apollo-news` | Test Apollo news API | **Test utility** - not needed |
| `PROXIMITY_SORTING_TROUBLESHOOTING.md` | Debug doc (not a function) | N/A |

### 2C. ONLY in `syllabusstack` (92 functions)

These exist in syllabusstack but **NOT** in projectify-syllabus:

#### Curriculum & Content Generation (17)
| Function | Purpose |
|----------|---------|
| `generate-curriculum` | AI-generated personalized learning paths |
| `generate-lecture-slides-v3` | AI lecture slide creation |
| `generate-lecture-audio` | AI audio narration for slides |
| `generate-batch-audio` | Batch audio generation |
| `process-lecture-queue` | Background lecture processing |
| `submit-batch-slides` | Submit slides for batch generation |
| `submit-batch-curriculum` | Submit curriculum for batch generation |
| `process-batch-research` | Background research for content |
| `process-batch-images` | Batch image generation |
| `generate-search-context` | Contextualize search results |
| `generate-content-strategy` | AI content strategy |
| `content-assistant-chat` | AI chat assistant for content |
| `search-youtube-content` | YouTube course search |
| `search-youtube-manual` | Manual YouTube search |
| `search-khan-academy` | Khan Academy content search |
| `search-educational-content` | Multi-source educational search |
| `firecrawl-search-courses` | Firecrawl course search |

#### Assessment & Evaluation (12)
| Function | Purpose |
|----------|---------|
| `start-assessment` | Initialize assessment session |
| `complete-assessment` | Finalize assessment |
| `submit-assessment-answer` | Submit individual answer |
| `generate-assessment-questions` | AI-generate test questions |
| `generate-micro-checks` | Quick comprehension checks |
| `start-skills-assessment` | Begin skills evaluation |
| `complete-skills-assessment` | Complete skills test |
| `submit-skills-response` | Record skill response |
| `evaluate-content-batch` | Batch content evaluation |
| `submit-batch-evaluation` | Submit batch for evaluation |
| `poll-batch-evaluation` | Check batch evaluation status |
| `trigger-pending-evaluations` | Trigger queued evaluations |

#### Billing & Subscription (6)
| Function | Purpose |
|----------|---------|
| `create-checkout-session` | Stripe checkout |
| `create-course-payment` | Course purchase |
| `create-portal-session` | Stripe billing portal |
| `cancel-subscription` | Cancel subscription |
| `get-invoices` | Fetch invoice history |
| `purchase-certificate` | Buy completion certificate |
| `stripe-webhook` | Stripe webhook handler |

#### Student Career Features (8)
| Function | Purpose |
|----------|---------|
| `analyze-dream-job` | AI analysis of target job |
| `discover-dream-jobs` | Suggest dream jobs based on skills |
| `match-careers` | Career matching algorithm |
| `gap-analysis` | Skills gap identification |
| `generate-recommendations` | Learning recommendations |
| `generate-premium-insights` | Premium career insights |
| `generate-value-analysis` | Value analysis for career paths |
| `student-search-agent` | AI search agent for students |

#### User Management (10)
| Function | Purpose |
|----------|---------|
| `accept-instructor-invite` | Accept teaching invitation |
| `send-instructor-invite` | Send teaching invitation |
| `invite-users` | Bulk user invitations |
| `use-invite-code` | Redeem invite code |
| `remove-org-user` | Remove user from organization |
| `configure-organization-sso` | SSO configuration |
| `verify-instructor-email` | Verify instructor email |
| `review-instructor-verification` | Admin review of instructor |
| `send-digest-email` | Email notifications |
| `send-student-message` | Student messaging |

#### Identity & Certificates (6)
| Function | Purpose |
|----------|---------|
| `initiate-identity-verification` | Start IDV process |
| `identity-verification-status` | Check IDV status |
| `idv-webhook` | IDV webhook handler |
| `issue-certificate` | Issue completion certificate |
| `verify-certificate` | Verify certificate authenticity |
| `record-proctor-event` | Record proctoring events |

#### Employer Portal (4)
| Function | Purpose |
|----------|---------|
| `employer-verify-completion` | Verify student completion |
| `send-employer-webhook` | Send events to employers |
| `create-webhook` | Create employer webhook |
| `scrape-job-posting` | Scrape job posting data |

#### Syllabus Processing (split from projectify's single function) (4)
| Function | Purpose |
|----------|---------|
| `analyze-syllabus` | AI capability extraction from syllabus text |
| `parse-syllabus-document` | Extract text from PDF/doc files |
| `process-syllabus` | Orchestrate full syllabus pipeline |
| `extract-learning-objectives` | Extract LOs from syllabus |

#### Other Platform Features (18)
| Function | Purpose |
|----------|---------|
| `generate-capstone-projects` | Enhanced project generation (6-form) |
| `extract-capstone-competencies` | Extract skills from completed project |
| `re-enrich-addresses` | Update company addresses |
| `ai-gateway` | Central AI routing gateway |
| `auto-link-courses` | Auto-link related courses |
| `compare-web-providers` | Compare service providers |
| `curriculum-reasoning-agent` | AI curriculum reasoning |
| `enroll-in-course` | Course enrollment |
| `fetch-video-metadata` | Video metadata enrichment |
| `global-search` | Cross-platform search |
| `get-onet-occupation` | O*NET occupation data |
| `get-usage-stats` | Platform usage statistics |
| `track-consumption` | Track AI consumption |
| `poll-active-batches` | Check active batch jobs |
| `poll-batch-status` | Check batch job status |
| `poll-batch-curriculum` | Check curriculum batch |
| `cancel-batch-job` | Cancel batch job |
| `trigger-progressive-generation` | Progressive content generation |
| `search-jobs` | Job search |
| `add-instructor-content` | Add instructor content |
| `add-manual-content` | Add manual content |

---

## 3. Shared Library (`_shared/`) Architecture Comparison

### projectify-syllabus `_shared/` (flat structure)
```
_shared/
├── alignment-service.ts          # LO alignment scoring
├── apollo-precise-discovery.ts   # Apollo API search
├── company-discovery-pipeline.ts # 5-phase discovery orchestrator
├── company-ranking-service.ts    # Company selection & ranking
├── company-validation-service.ts # AI validation of company fit
├── context-aware-industry-filter.ts
├── embedding-service.ts          # Gemini embeddings
├── generation-service.ts         # PROJECT GENERATION (Lovable AI)
├── occupation-coordinator.ts     # O*NET occupation mapping
├── onet-structured-service.ts    # O*NET data service
├── semantic-matching-service.ts  # Semantic validation
├── semantic-validation-v2-service.ts
├── skill-extraction-service.ts   # Skill extraction
├── pricing-service.ts            # Pricing calculations
├── circuit-breaker.ts            # Circuit breaker pattern
├── timeout-config.ts             # Timeout configuration
├── retry-utils.ts                # Retry logic
├── cors.ts                       # CORS headers
├── auth-middleware.ts             # Auth verification
├── input-validation.ts           # Input validation
├── rate-limit-headers.ts         # Rate limit headers
├── lightcast-*.ts                # Lightcast API clients
├── onet-*.ts                     # O*NET API clients
├── apollo-provider.ts            # Apollo provider
├── adzuna-provider.ts            # Adzuna job API
├── provider-factory.ts           # Discovery provider factory
├── signals/                      # Signal calculation system
│   ├── signal-orchestrator.ts    # Orchestrates 4 signals
│   ├── contact-quality-signal.ts
│   ├── department-fit-signal.ts
│   ├── hiring-signal.ts
│   ├── job-skills-signal.ts
│   └── market-intel-signal.ts
└── signal-types.ts               # Signal type definitions
```

### syllabusstack `_shared/` (organized subdirectories)
```
_shared/
├── capstone/                     # Capstone-specific (ported from projectify)
│   ├── alignment-service.ts
│   ├── company-discovery-pipeline.ts
│   ├── company-ranking-service.ts
│   ├── company-validation-service.ts
│   ├── generation-service.ts     # Uses unified-ai-client (NOT Lovable)
│   ├── pricing-service.ts
│   ├── skill-extraction-service.ts
│   ├── types.ts                  # Shared capstone types
│   └── signals/                  # Same 4-signal system
├── unified-ai-client.ts          # UNIFIED AI ROUTING (1,391 LoC)
├── openrouter-client.ts          # OpenRouter API wrapper
├── vertex-ai-auth.ts             # Google Vertex AI auth
├── vertex-ai-batch.ts            # Vertex AI batch operations
├── prompts.ts                    # Centralized prompts (9,396 LoC)
├── slide-prompts.ts              # Slide generation prompts (27,753 LoC)
├── image-prompt-builder.ts       # Image generation prompts
├── tts-client.ts                 # Text-to-speech client
├── ai-cache.ts                   # AI response caching
├── ai-orchestrator.ts            # AI task orchestration
├── cors.ts                       # CORS (origin-validated, not wildcard)
├── error-handler.ts              # Standardized error handling
├── rate-limiter.ts               # User-level rate limiting
├── monitoring.ts                 # Performance monitoring
├── schemas.ts                    # JSON schemas for AI extraction
├── similarity.ts                 # Keyword/vector similarity
└── [other shared utilities]
```

---

## 4. Key Architectural Differences

| Aspect | `projectify-syllabus` | `syllabusstack` |
|--------|----------------------|-----------------|
| **AI Gateway** | Lovable AI (`ai.gateway.lovable.dev`) | OpenRouter + multi-provider routing |
| **AI Model** | `google/gemini-2.5-flash` | Multiple: `gemini-3-flash-preview`, `gemini-2.5-flash`, `deepseek-r1`, `perplexity/sonar-pro` |
| **Error Handling** | Custom error classification per function | Centralized `error-handler.ts` with `withErrorHandling()` wrapper |
| **Rate Limiting** | HTTP headers only (`rate-limit-headers.ts`) | DB-backed user-level rate limiting (`rate-limiter.ts`) |
| **Circuit Breaker** | Yes (`circuit-breaker.ts`) | No (relies on provider fallbacks in `unified-ai-client.ts`) |
| **Timeout Protection** | `timeout-config.ts` with `fetchWithTimeout()` | Provider-level timeouts in OpenRouter client |
| **Auth** | Manual JWT extraction per function | Mix of manual and middleware patterns |
| **CORS** | Wildcard `'*'` | Origin-validated via `getCorsHeaders(req)` |
| **Prompt Storage** | Inline in edge functions | Centralized in `prompts.ts` (9,396 LoC) |
| **Syllabus Parsing** | Single function (`parse-syllabus`) handles PDF + AI | Split: `parse-syllabus-document` (PDF) + `analyze-syllabus` (AI) + `process-syllabus` (orchestrator) |
| **Project Generation** | `generate-projects` (single function) | `generate-capstone-projects` (enhanced with 6-form structure + milestones) |
| **DB Schema** | `course_profiles` table | `courses` + `instructor_courses` + `course_enrollments` |
| **Project Storage** | `capstone_projects` (flat) | `capstone_projects` + `capstone_project_forms` (6 forms) + `capstone_milestones` |

---

**Next: Phase 2 - Frontend-Backend API Mapping**
