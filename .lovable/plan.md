
# System Assessment & Documentation Framework

## Current System Snapshot

### Scale Metrics (Verified from Codebase)
| Category | Count | Details |
|----------|-------|---------|
| **Edge Functions** | 76 | Core + batch + webhooks + payment |
| **Database Tables** | 50+ | As defined in types.ts (4,400 lines) |
| **Frontend Pages** | 34 | Across 6 route groups |
| **React Hooks** | 57 | Custom business logic hooks |
| **Components** | 28+ | Component directories |
| **Shared Modules** | 22 | `_shared/` utilities |
| **Test Files** | 6 | Frontend + edge function tests |
| **Documentation** | 11 | Technical specifications |

---

## Assessment Methodology

### 1. Full Architecture Review

**Objective**: Map all system components, data flows, and integration points

**Scope**:
```text
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE LAYERS                           │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND                                                        │
│  ├── Pages (34): Auth, Dashboard, Learn, Instructor, Admin      │
│  ├── Hooks (57): Query, mutation, state management              │
│  ├── Components (28+ dirs): UI, forms, visualizations           │
│  └── Services: Proctoring, storage, AI generation               │
├─────────────────────────────────────────────────────────────────┤
│  BACKEND (Edge Functions)                                        │
│  ├── AI Pipeline (18): Syllabus, curriculum, slides, assessment │
│  ├── Content Discovery (8): YouTube, Khan, Firecrawl            │
│  ├── Payments (7): Stripe checkout, webhook, portal             │
│  ├── Auth/Trust (8): IDV, instructor verification, SSO          │
│  ├── Batch Processing (10): Submit, poll, process               │
│  └── Shared (_shared/22): AI clients, caching, rate limiting    │
├─────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                      │
│  ├── Tables (50+): Core entities, analytics, certificates       │
│  ├── Functions (35): RPC, triggers, security definer            │
│  ├── RLS Policies: Per-table access control                     │
│  └── Storage Buckets (3): syllabi, lecture-visuals, lecture-audio│
├─────────────────────────────────────────────────────────────────┤
│  EXTERNAL INTEGRATIONS                                           │
│  ├── AI: OpenRouter (Gemini, GPT, DeepSeek), Vertex AI Batch    │
│  ├── Payments: Stripe (checkout, subscriptions, webhooks)       │
│  ├── Content: YouTube API, Invidious, Piped, Khan Academy       │
│  ├── Identity: Persona (IDV), WorkOS (SSO/SAML)                 │
│  └── Web Scraping: Firecrawl, Jina                              │
└─────────────────────────────────────────────────────────────────┘
```

**Deliverable**: `ARCHITECTURE_AUDIT.md`
- System context diagram
- Component dependency graph
- Data flow diagrams per feature
- Integration point inventory

---

### 2. Performance Audit

**Objective**: Identify bottlenecks, optimize response times, reduce costs

**Areas to Assess**:

| Area | Metrics | Tools/Methods |
|------|---------|---------------|
| **Database Queries** | Response time, row counts | `EXPLAIN ANALYZE`, slow query logs |
| **Edge Function Latency** | P50/P95/P99, cold starts | Supabase analytics, custom timing |
| **AI Pipeline Throughput** | Tokens/sec, batch completion | ai_usage table, batch_jobs table |
| **Frontend Bundle** | Initial load, chunk sizes | Vite build analysis, Lighthouse |
| **API Rate Limits** | YouTube quota, OpenRouter limits | api_quota_tracking table |

**Key Queries to Run**:
```sql
-- Slowest edge functions (last 24h)
SELECT function_id, AVG(execution_time_ms) as avg_ms
FROM function_edge_logs
WHERE timestamp > now() - interval '24 hours'
GROUP BY function_id ORDER BY avg_ms DESC;

-- AI cost by function
SELECT function_name, SUM(cost_usd) as total_cost
FROM ai_usage
WHERE created_at > now() - interval '30 days'
GROUP BY function_name ORDER BY total_cost DESC;
```

**Deliverable**: `PERFORMANCE_AUDIT.md`
- Latency baseline measurements
- Cost analysis by feature
- Optimization recommendations with priority
- Bundle size optimization plan

---

### 3. Security Assessment

**Objective**: Identify vulnerabilities, validate access controls, ensure data protection

**Checklist**:

| Category | Items to Verify |
|----------|----------------|
| **Authentication** | Email confirmation, password policies, session management |
| **Authorization** | RLS policies per table, role-based access (`user_roles` table) |
| **API Security** | JWT validation, CORS config, rate limiting |
| **Data Protection** | PII handling, Stripe ID exclusion, signed URLs |
| **Edge Function Security** | Input validation, SQL injection prevention, secret management |
| **Third-party** | API key rotation, webhook signature verification |

**Current Security Measures (Verified)**:
- `verify_jwt = true/false` per edge function in config.toml
- `user_roles` table with `has_role()` security definer function
- Profile excludes `stripe_customer_id` and `stripe_subscription_id` from client
- Private storage buckets with signed URL access
- Proctoring service for assessment integrity

**Deliverable**: `SECURITY_ASSESSMENT.md`
- RLS policy matrix (table × operation × role)
- Vulnerability findings with severity
- Remediation plan with timeline
- Penetration test recommendations

---

### 4. Test Coverage Analysis

**Objective**: Quantify existing coverage, identify gaps, establish testing strategy

**Current Test Inventory**:
```text
Frontend Tests:
├── src/test/setup.ts (test infrastructure)
├── src/test/factories/ (test data factories)
├── src/test/mocks/ (Supabase mocks)
├── src/hooks/useLinkCourseToRecommendation.test.ts
├── src/hooks/useTeachingUnits.test.ts
└── vitest.config.ts

Edge Function Tests:
├── supabase/functions/tests/ai-models-unit.test.ts
├── supabase/functions/tests/ai-pipeline-e2e.test.ts
├── supabase/functions/tests/course-lifecycle.test.ts
└── supabase/functions/_shared/openrouter-client.test.ts
```

**Coverage Gaps (Estimated)**:
| Category | Files | Tested | Coverage |
|----------|-------|--------|----------|
| Frontend Hooks | 57 | 2 | ~3% |
| Frontend Components | 100+ | 0 | 0% |
| Edge Functions | 76 | 4 | ~5% |
| Database Functions | 35 | 0 | 0% |

**Deliverable**: `TEST_COVERAGE_REPORT.md`
- Current coverage metrics
- Critical path testing gaps
- Test strategy (unit, integration, E2E)
- Test file templates for each category

---

### 5. Dependency Audit

**Objective**: Identify outdated, vulnerable, or unused dependencies

**Current Dependencies** (from package.json):
- **React Ecosystem**: react@18.3.1, react-router-dom@7.12.0, react-query@5.83.0
- **UI**: Radix UI (17 packages), Tailwind CSS, lucide-react
- **Forms**: react-hook-form, @hookform/resolvers, zod
- **Testing**: vitest@4.0.16, @testing-library/react@16.3.1
- **Build**: vite@5.4.19, typescript@5.8.3

**Audit Areas**:
| Check | Tool/Method |
|-------|-------------|
| Security vulnerabilities | `npm audit`, Snyk |
| Outdated packages | `npm outdated` |
| Unused dependencies | `depcheck` |
| Bundle impact | `vite-bundle-analyzer` |
| License compliance | `license-checker` |

**Deliverable**: `DEPENDENCY_AUDIT.md`
- Vulnerability report with severity
- Upgrade recommendations
- Unused package removal list
- Bundle size impact analysis

---

### 6. API/Edge Function Review (76 Functions)

**Objective**: Catalog, categorize, and assess all edge functions

**Categorization**:
```text
AI Pipeline (18 functions):
├── analyze-syllabus, process-syllabus, parse-syllabus-document
├── curriculum-reasoning-agent, generate-curriculum
├── generate-lecture-slides-v3, generate-lecture-audio
├── generate-assessment-questions, generate-micro-checks
├── gap-analysis, generate-recommendations
├── content-assistant-chat, ai-gateway
└── extract-learning-objectives, evaluate-content-batch

Content Discovery (8 functions):
├── search-youtube-content, search-youtube-manual
├── search-khan-academy, search-educational-content
├── firecrawl-search-courses, fetch-video-metadata
├── add-manual-content, add-instructor-content
└── global-search, generate-search-context

Batch Processing (10 functions):
├── submit-batch-slides, submit-batch-curriculum, submit-batch-evaluation
├── poll-batch-status, poll-batch-curriculum, poll-batch-evaluation
├── process-batch-research, process-batch-images
├── process-lecture-queue, cancel-batch-job
└── trigger-progressive-generation

Payment & Billing (7 functions):
├── create-checkout-session, create-portal-session
├── stripe-webhook, get-invoices
├── purchase-certificate, cancel-subscription
└── create-course-payment, enroll-in-course

Trust & Identity (8 functions):
├── verify-instructor-email, review-instructor-verification
├── use-invite-code, invite-users
├── initiate-identity-verification, identity-verification-status
├── idv-webhook, configure-organization-sso
└── employer-verify-completion

Assessments (6 functions):
├── start-assessment, submit-assessment-answer, complete-assessment
├── start-skills-assessment, submit-skills-response, complete-skills-assessment
└── record-proctor-event

Certificates (3 functions):
├── issue-certificate, verify-certificate
└── (generate-certificate-pdf - may be inline)

Career/Jobs (6 functions):
├── analyze-dream-job, discover-dream-jobs
├── match-careers, get-onet-occupation
├── scrape-job-posting, search-jobs

Utility (10+ functions):
├── get-usage-stats, track-consumption
├── send-digest-email, auto-link-courses
├── compare-web-providers, remove-org-user
└── generate-content-strategy
```

**Assessment per Function**:
- [ ] JWT verification status
- [ ] Input validation
- [ ] Error handling patterns
- [ ] Response time benchmarks
- [ ] Cost attribution

**Deliverable**: `EDGE_FUNCTION_CATALOG.md`
- Function inventory with categories
- Authentication requirements matrix
- Performance baselines
- Dependency mapping (shared modules)
- Deprecation candidates

---

### 7. Database Schema Analysis

**Objective**: Document schema, relationships, indexes, and optimization opportunities

**Schema Groups** (50+ tables):
```text
Core Entities:
├── profiles, user_roles, user_progress, user_achievements
├── courses, instructor_courses, modules, learning_objectives
├── teaching_units, lecture_slides, content, content_matches

Assessments:
├── assessment_questions, assessment_sessions, assessment_answers
├── micro_checks, micro_check_results
├── assessment_item_bank, skill_assessment_responses

Certificates & Trust:
├── certificates, certificate_verifications
├── instructor_verifications, instructor_invite_codes
├── identity_verifications

Organizations:
├── organizations, organization_members, organization_invitations
├── employer_accounts, employer_api_keys

AI & Batch:
├── ai_usage, ai_cache, batch_jobs
├── generation_triggers, research_cache

Content Discovery:
├── content_search_cache, content_ratings, content_suggestions
├── consumption_records, verified_skills

Career:
├── dream_jobs, gap_analyses, recommendations
├── recommendation_course_links, capabilities
├── career_matches, anti_recommendations

Tracking:
├── api_quota_tracking, api_usage_tracking
├── tier_limits, proctoring_events
```

**Analysis Areas**:
| Area | Method |
|------|--------|
| Relationship integrity | FK constraint review |
| Index optimization | `pg_stat_user_indexes` |
| Table bloat | `pg_stat_user_tables` |
| RLS policy coverage | Per-table policy audit |
| Data volume projections | Row count analysis |

**Deliverable**: `DATABASE_SCHEMA_ANALYSIS.md`
- Entity-relationship diagram (ERD)
- Table-by-table documentation
- Index recommendations
- RLS policy matrix
- Migration history summary

---

## Deliverables Summary

### Primary Documents (7)

| Document | Purpose | Est. Pages |
|----------|---------|------------|
| `ARCHITECTURE_AUDIT.md` | System structure & data flows | 15-20 |
| `PERFORMANCE_AUDIT.md` | Latency, costs, optimizations | 10-15 |
| `SECURITY_ASSESSMENT.md` | Vulnerabilities & RLS review | 10-15 |
| `TEST_COVERAGE_REPORT.md` | Current coverage & test plan | 8-10 |
| `DEPENDENCY_AUDIT.md` | Package health & upgrades | 5-8 |
| `EDGE_FUNCTION_CATALOG.md` | 76 functions documented | 20-25 |
| `DATABASE_SCHEMA_ANALYSIS.md` | 50+ tables with ERD | 15-20 |

### Supporting Artifacts

| Artifact | Format | Description |
|----------|--------|-------------|
| System Context Diagram | Mermaid/PNG | High-level architecture |
| Data Flow Diagrams | Mermaid | Per-feature flows (10-12) |
| ERD | Mermaid/dbdiagram.io | Full database relationships |
| RLS Policy Matrix | Table/CSV | Table × Operation × Role |
| Function Authentication Matrix | Table | JWT requirements per function |
| Test Coverage Dashboard | JSON/HTML | vitest coverage output |
| Dependency Graph | HTML | vite-bundle-analyzer output |

---

## Execution Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | Architecture + Database | ARCHITECTURE_AUDIT.md, DATABASE_SCHEMA_ANALYSIS.md |
| **Week 2** | Edge Functions + Security | EDGE_FUNCTION_CATALOG.md, SECURITY_ASSESSMENT.md |
| **Week 3** | Performance + Dependencies | PERFORMANCE_AUDIT.md, DEPENDENCY_AUDIT.md |
| **Week 4** | Testing + Synthesis | TEST_COVERAGE_REPORT.md, Executive Summary |

---

## Immediate Priority: Build Error Resolution

Before comprehensive assessment, these 3 build errors must be fixed:

### Error 1: CareerPath.tsx (Lines 221-222)
```typescript
// Current (broken):
requirement: gap.gap || gap.requirement || gap.job_requirement

// Fix (use only defined property):
requirement: gap.gap
```

### Error 2: Learn.tsx (Line 352)
```typescript
// Current (ES2021 required):
.replaceAll('"', '""')

// Fix (ES5 compatible):
.replace(/"/g, '""')
```

### Error 3: TestResults.tsx (7 locations)
```typescript
// Current (Json type incompatible):
(latestCourse.tools_methods || []).map(...)

// Fix (safe cast via unknown):
((latestCourse.tools_methods as unknown as string[]) || []).map(...)
```

---

## Technical Notes

### Assessment Agent Capabilities Required

1. **Code Analysis**: Traverse file system, parse TypeScript/SQL
2. **Database Access**: Query analytics, run EXPLAIN, count rows
3. **Edge Function Access**: Invoke functions, read logs
4. **Documentation Generation**: Markdown output, diagram rendering
5. **Comparison Logic**: Compare code vs. spec (WIREFRAME_SPECIFICATION.md)

### Data Sources for Assessment

| Source | Access Method | Data Type |
|--------|---------------|-----------|
| Codebase | lov-view, lov-list-dir | Static analysis |
| Database | supabase--read-query | Schema, data samples |
| Logs | supabase--analytics-query | Runtime behavior |
| Edge Functions | supabase--edge-function-logs | Execution traces |
| Spec Docs | docs/*.md files | Requirements baseline |
