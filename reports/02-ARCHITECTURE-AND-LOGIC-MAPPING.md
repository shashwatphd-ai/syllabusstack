# SyllabusStack — Architecture & Logic Mapping Report

> Generated from codebase analysis on 2026-02-16. Based solely on reading the actual source code.

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│                                                                      │
│  React 18 + TypeScript + Vite + Tailwind + shadcn/ui                │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  Pages   │→ │Components│→ │  Hooks   │→ │ TanStack Query   │    │
│  │  (36+)   │  │  (200+)  │  │  (80+)   │  │ (Cache + State)  │    │
│  └──────────┘  └──────────┘  └──────────┘  └────────┬─────────┘    │
│                                                       │              │
│  ┌──────────────────────┐  ┌───────────────────────┐  │              │
│  │ AuthContext (global) │  │ Services (7 files)    │  │              │
│  │ user, session, roles │  │ Business logic layer  │←─┘              │
│  └──────────────────────┘  └───────────┬───────────┘                │
└────────────────────────────────────────┼────────────────────────────┘
                                         │
                                    Supabase JS SDK
                                         │
┌────────────────────────────────────────┼────────────────────────────┐
│                      SUPABASE PLATFORM                              │
│                                                                      │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────────────┐ │
│  │   Auth      │  │  Edge Functions│  │   PostgreSQL Database    │ │
│  │ (Supabase)  │  │  (85 Deno fns) │  │   + Row Level Security  │ │
│  └─────────────┘  └───────┬────────┘  └──────────────────────────┘ │
│                           │                                          │
│  ┌─────────────┐  ┌──────┴────────┐  ┌──────────────────────────┐ │
│  │  Storage    │  │ _shared/      │  │  Realtime (subscriptions)│ │
│  │ (syllabi)   │  │ utilities     │  │                          │ │
│  └─────────────┘  └───────────────┘  └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                         │
                              External Services
                                         │
        ┌──────────┬──────────┬──────────┼──────────┬─────────┐
        ▼          ▼          ▼          ▼          ▼         ▼
   OpenRouter  Vertex AI  Firecrawl  YouTube   O*NET     Stripe
   (LLM API)  (Batch AI) (Scraping) (Videos)  (Careers)  (Pay)
```

---

## 2. Frontend Architecture

### 2.1 Application Wrapper Stack

```
QueryClientProvider          ← TanStack Query cache & state
  └─ AuthProvider            ← Global auth context (user, session, profile)
      └─ TooltipProvider     ← shadcn tooltip context
          └─ Toaster(s)      ← Toast notification providers (2: ui + sonner)
              └─ AchievementToastProvider  ← XP/achievement popups
                  └─ TourProvider          ← Product tour overlay
                      └─ BrowserRouter     ← React Router
                          └─ ErrorBoundary ← Global error catch
                              └─ Routes    ← Page routing
```

### 2.2 Component Organization

```
src/components/
├── ui/                    60+ shadcn/ui primitives (button, dialog, form, etc.)
├── layout/                AppShell, AppHeader, Sidebar, PageContainer
├── auth/                  LoginForm, SignupForm, AuthGuard, AdminGuard
├── common/                ErrorBoundary, LoadingState, EmptyState, ProductTour
│
├── dashboard/             DashboardOverview, ProgressWidget, DreamJobCards,
│                          CapabilitySnapshot, NextActionBanner, WelcomeBackBanner
├── onboarding/            OnboardingWizard, CourseUploader
├── landing/               HeroSection, FeaturesSection, PricingSection
│
├── forms/                 AddCourseForm, ProfileForm, AddDreamJobForm
├── search/                GlobalSearchResults
├── scanner/               ScannerDropzone, ScanResultDisplay
│
├── recommendations/       RecommendationsList, CourseDiscovery, ProgressTracker,
│                          AntiRecommendations, CurrentlyLearningPanel
├── analysis/              GapAnalysisView, GapsList, OverlapsList, HonestAssessment
├── career-exploration/    CareerMatchesGrid, MatchScoreBreakdown
├── dreamjobs/             DreamJobDiscovery, DreamJobSuggestions
├── skills-assessment/     SkillsAssessmentWizard, HollandRadarChart, LikertScale
│
├── student/               StudentCourseCard, IdentityVerificationFlow, EnrollmentDialog
├── instructor/            GradebookTable, InstructorVerificationFlow, ContentCurationPanel
├── employer/              BatchVerificationUpload, WebhookConfig
│
├── slides/                LectureSlideViewer, StudentSlideViewer, SlideRenderer
├── player/                VerifiedVideoPlayer, MicroCheckOverlay, ContentRating
├── assessment/            AssessmentSession, QuestionCard, AssessmentResults
│
├── certificates/          MyCertificatesList, CertificateSelection
├── achievements/          AchievementBadge, XPProgress, AchievementsList
├── billing/               SubscriptionManager, PricingTable, BillingHistory
├── analytics/             EngagementChart, RetentionCohort, ConversionFunnel
│
├── curriculum-generation/ CurriculumGeneratorWizard
├── progress/              CareerProgressTracker
├── learn/                 LearnSkeleton, SuggestedResources
├── profile/               VerifiedSkillsBadges
├── career/                CareerPathSkeleton
└── settings/              EmailPreferences
```

### 2.3 Data Flow Pattern

```
Page Component
  │
  ├─ useSomeHook()                    ← Custom hook (data fetching)
  │    │
  │    ├─ useQuery({ queryKey, queryFn })   ← TanStack Query
  │    │    │
  │    │    └─ supabase.from('table')       ← Direct DB query (RLS enforced)
  │    │       OR
  │    │    └─ supabase.functions.invoke()  ← Edge function call
  │    │
  │    └─ useMutation({ mutationFn, onSuccess })
  │         │
  │         ├─ supabase.from('table').insert/update/delete
  │         │
  │         └─ onSuccess: queryClient.invalidateQueries()  ← Cache bust
  │
  └─ Renders child components with props
```

### 2.4 Cache Key Hierarchy

```
Query Key Structure (from query-keys.ts):

['user', 'profile']
['user', 'roles']
['courses', 'list']
['courses', 'detail', courseId]
['capabilities', 'list']
['dream_jobs', 'list']
['dream_jobs', 'detail', jobId]
['analysis', 'gap', dreamJobId]
['analysis', 'capability-profile']
['recommendations', 'list']
['recommendations', 'with-links', dreamJobId]
['recommendations', 'anti', dreamJobId]
['dashboard', 'overview']
['dashboard', 'stats']
['instructor_courses', 'list']
['instructor_courses', 'detail', courseId]
['assessments', 'questions', loId]
['assessments', 'active-session', loId]
['assessments', 'session-history', loId]
['skills_assessment', 'active-session']
['skills_assessment', 'profile']
['career_matches', 'list']
['career_matches', 'saved']
['career_matches', 'onet', socCode]
['certificates', 'list']
['certificates', 'stats']
['subscriptions', 'current']
['organization', 'details']
['skill-profile']
```

---

## 3. Backend Architecture

### 3.1 Edge Functions by Domain (85 total)

#### Content Generation & AI (15 functions)
```
generate-lecture-slides-v3    ← Phase-based: context → research → professor AI → speaker notes → images
generate-curriculum           ← AI curriculum from occupation/dream-job context
generate-assessment-questions ← Assessment questions from learning objectives
generate-micro-checks         ← Quick knowledge checks for video content
generate-batch-audio          ← TTS audio for lecture content
generate-content-strategy     ← AI content strategy planning
generate-search-context       ← Search optimization context
generate-recommendations      ← AI learning recommendations from gap analysis
content-assistant-chat        ← Interactive AI chat for content creation
curriculum-reasoning-agent    ← Multi-step curriculum reasoning
student-search-agent          ← Intelligent student content search
ai-gateway                    ← Centralized AI service router
extract-learning-objectives   ← Parse module text into structured LOs
process-batch-images          ← Batch image generation queue
process-batch-research        ← Batch research processing
```

#### Content Discovery (6 functions)
```
search-educational-content    ← General educational content search
search-youtube-content        ← YouTube API video search + relevance scoring
search-khan-academy           ← Khan Academy content integration
firecrawl-search-courses      ← Web scraping for real courses
global-search                 ← Cross-platform search
compare-web-providers         ← Compare content from multiple providers
```

#### Career & Skills (6 functions)
```
discover-dream-jobs           ← AI-powered job title suggestions
match-careers                 ← O*NET matching with Iachan M Index
analyze-dream-job             ← Job analysis → requirements extraction
get-onet-occupation           ← O*NET occupation detail lookup
search-jobs                   ← Active Jobs DB API integration
scrape-job-posting            ← Extract data from job posting URLs
```

#### Assessment & Learning (7 functions)
```
start-assessment              ← Create assessment session, generate/fetch questions
submit-assessment-answer      ← Validate answer server-side, track timing
complete-assessment           ← Calculate final score, pass/fail determination
start-skills-assessment       ← Initialize Holland RIASEC assessment
complete-skills-assessment    ← Compute skill profile from responses
gap-analysis                  ← Core gap analysis with Weibull decay
analyze-syllabus              ← Extract capabilities from syllabus text
```

#### Batch Processing (9 functions)
```
submit-batch-curriculum       ← Submit curriculum generation to Vertex AI
submit-batch-evaluation       ← Submit content evaluation batch
submit-batch-slides           ← Submit slide generation batch
poll-batch-status             ← Check batch job completion
poll-batch-curriculum         ← Poll curriculum batch results
poll-batch-evaluation         ← Poll evaluation batch results
poll-active-batches           ← Monitor all active batch jobs
cancel-batch-job              ← Cancel running batch
trigger-progressive-generation← Progressive multi-phase generation
```

#### Instructor (6 functions)
```
add-instructor-content        ← Add curated content to course
add-manual-content            ← Manual content entry
review-instructor-verification← Process verification review
verify-instructor-email       ← Email-based verification
send-student-message          ← Instructor-to-student messaging
process-lecture-queue         ← Background lecture processing
```

#### Student (5 functions)
```
enroll-in-course              ← Course enrollment via access code
track-consumption             ← Learning content consumption tracking
identity-verification-status  ← Check IDV status
initiate-identity-verification← Start identity verification
idv-webhook                   ← IDV provider webhook handler
```

#### Certificates (4 functions)
```
issue-certificate             ← Generate and issue certificate
purchase-certificate          ← Process certificate purchase
verify-certificate            ← Public certificate verification
employer-verify-completion    ← Employer-specific verification
```

#### Billing (6 functions)
```
create-checkout-session       ← Stripe checkout initiation
create-portal-session         ← Customer billing portal
create-course-payment         ← Individual course payment
cancel-subscription           ← Subscription cancellation
get-invoices                  ← Retrieve invoice history
stripe-webhook                ← Stripe event handler
```

#### Employer (2 functions)
```
send-employer-webhook         ← Send events to employer endpoints
create-webhook                ← Register webhook configuration
```

#### Organization (3 functions)
```
configure-organization-sso    ← SSO setup for enterprises
invite-users                  ← User invitation system
remove-org-user               ← Remove users from organization
```

#### Utility (11 functions)
```
parse-syllabus-document       ← File upload parsing (PDF/DOCX/TXT)
process-syllabus              ← Syllabus text processing
auto-link-courses             ← Auto-link recommendations to courses
evaluate-content-batch        ← Batch content quality evaluation
fetch-video-metadata          ← YouTube video metadata
record-proctor-event          ← Proctoring event recording
trigger-pending-evaluations   ← Trigger queued evaluations
send-digest-email             ← Email digest notifications
generate-lecture-audio        ← TTS audio generation
```

### 3.2 Shared Backend Utilities (`_shared/`)

```
_shared/
├── query-intelligence/      ← Advanced query processing
│   ├── extractors/          ← Keyword/entity extraction from queries
│   ├── reasoners/           ← Query intent reasoning
│   ├── expanders/           ← Query expansion for better recall
│   └── builders/            ← Search query construction
├── openrouter-client.ts     ← LLM API wrapper (model routing, retries)
├── vertex-ai-auth.ts        ← Google Cloud authentication
├── ssml-transformer.ts      ← Text-to-SSML for audio generation
├── cors.ts                  ← CORS headers for edge functions
├── similarity.ts            ← Text similarity algorithms (Jaccard, cosine)
├── segment-mapper.ts        ← Content segment mapping
├── skill-decay.ts           ← Weibull skill decay model
├── schemas.ts               ← Zod validation schemas
└── web-provider.ts          ← Web content provider abstraction
```

---

## 4. Database Schema (Key Tables)

### 4.1 Entity Relationship Map

```
profiles ←──────── user_roles
   │
   ├──→ courses ──→ capabilities
   │
   ├──→ dream_jobs ──→ job_requirements
   │        │
   │        └──→ gap_analyses
   │                 │
   │                 └──→ recommendations ──→ recommendation_course_links
   │                      anti_recommendations
   │
   ├──→ instructor_courses ──→ modules ──→ learning_objectives
   │        │                                    │
   │        └──→ course_enrollments              ├──→ assessment_questions
   │                                             ├──→ assessment_sessions → assessment_answers
   │                                             ├──→ content (videos)
   │                                             ├──→ teaching_units → lecture_slides
   │                                             └──→ micro_checks → micro_check_results
   │
   ├──→ skills_assessment_sessions ──→ skill_profiles
   │
   ├──→ career_matches ──→ onet_occupations
   │
   ├──→ certificates
   │
   ├──→ verified_skills
   │
   ├──→ achievements
   │
   └──→ content_ratings
```

### 4.2 Core Tables

#### User & Auth
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `profiles` | user_id, full_name, email, onboarding_completed, is_instructor_verified, instructor_trust_score, stripe_customer_id | User profile |
| `profiles_safe` | (view) excludes stripe_customer_id, stripe_subscription_id | Safe profile view |
| `user_roles` | user_id, role | Role assignments |

#### Student Courses & Skills
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `courses` | user_id, title, code, semester, credits, grade, capability_text, analysis_status, analysis_error | Student transcript courses |
| `capabilities` | user_id, course_id, name, category, proficiency_level, source | Skills extracted from syllabi |
| `verified_skills` | user_id, skill_name, proficiency_level, verified_at, source_type | Assessment-backed skills |

#### Career Planning
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `dream_jobs` | user_id, title, company_type, location, salary_range, match_score, is_primary, requirements_keywords, day_one_capabilities, differentiators, realistic_bar | Target positions |
| `job_requirements` | dream_job_id, skill_name, importance (critical/important/nice_to_have), category | Individual job requirements |
| `gap_analyses` | user_id, dream_job_id, match_score, strong_overlaps, partial_overlaps, critical_gaps, priority_gaps, readiness_level, honest_assessment, interview_readiness, job_success_prediction | Gap analysis results |
| `recommendations` | user_id, dream_job_id, title, type, description, steps, evidence_created, how_to_demonstrate, gap_addressed, priority, status, price, url | Action items |
| `anti_recommendations` | dream_job_id, action, reason | Things NOT to do |
| `recommendation_course_links` | recommendation_id, course_enrollment_id, instructor_course_id | Link recs to enrolled courses |

#### Skills Assessment & Career Matching
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `skills_assessment_sessions` | user_id, session_type, status, total_questions, questions_answered, current_section | Assessment sessions |
| `skill_profiles` | user_id, holland_code, holland_scores (JSON), technical_skills (JSON), work_values (JSON), strong_skills, development_areas | Psychometric profile |
| `career_matches` | user_id, onet_soc_code, occupation_title, overall_match_score, skill_match_score, interest_match_score, values_match_score, skill_gaps, match_breakdown | O*NET matches |
| `onet_occupations` | soc_code, title, description, riasec_code, required_skills, required_knowledge, median_wage, job_outlook, education_level | Occupation reference |

#### Instructor Courses
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `instructor_courses` | instructor_id, title, code, description, curation_mode, verification_threshold, is_published, access_code, domain_config, syllabus_text | Courses taught |
| `modules` | instructor_course_id, title, description, sequence_order | Course modules |
| `learning_objectives` | module_id, text, bloom_level, action_verb, expected_duration_minutes | Bloom's taxonomy LOs |
| `teaching_units` | learning_objective_id, content | Teaching unit content |
| `lecture_slides` | teaching_unit_id, slides (JSON), generation_model, quality_score, generation_phases, is_research_grounded, citation_count | Generated slides |
| `content` | learning_objective_id, title, url, match_score, is_approved | Matched video content |
| `course_enrollments` | student_id, instructor_course_id, enrolled_at, overall_progress, completed_at | Student enrollments |

#### Assessment & Verification
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `assessment_sessions` | user_id, learning_objective_id, status, current_question_index, questions_answered, questions_correct, total_score, passed, attempt_number | Test sessions |
| `assessment_questions` | learning_objective_id, question_text, question_type, bloom_level, difficulty, time_limit_seconds, accepted_answers, required_keywords | Questions |
| `micro_checks` | content_id, question_text, trigger_time_seconds, rewind_target_seconds, time_limit_seconds | In-video checks |
| `certificates` | user_id, certificate_number, certificate_type, course_title, mastery_score, identity_verified, instructor_verified, share_token, skill_breakdown | Earned credentials |

#### Caching & Performance
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `ai_cache` | cache_key, cache_type, expires_at, data | AI response cache |
| `job_requirements_cache` | job_query_normalized, requirements_text, keywords, day_one_capabilities, query_count, last_queried_at | Job analysis cache |
| `generated_curricula` | user_id, curriculum_structure (JSON), source_type | Generated curricula |
| `image_generation_queue` | slide_id, prompt, status | Async image processing |

---

## 5. Core Algorithm Details

### 5.1 Gap Analysis Algorithm

```
Input: dreamJobId, userId
       ↓
┌─────────────────────────────────────┐
│ 1. GATHER USER CAPABILITIES         │
│    ├─ Fetch verified_skills          │
│    ├─ Apply Weibull decay model:     │
│    │   P(fresh) = exp(-(t/λ)^k)     │
│    │   where t = days since verify   │
│    │   λ = scale, k = shape          │
│    │   Mark DECAYED if P < threshold │
│    ├─ Fetch self-reported caps       │
│    └─ Build keyword vector           │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. GATHER JOB REQUIREMENTS          │
│    ├─ Fetch job_requirements         │
│    ├─ Fetch day_one_capabilities     │
│    └─ Build requirement keyword vec  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. PRE-ANALYSIS (Keyword Matching)  │
│    ├─ calculateSimilarity()          │
│    │   user keywords ↔ job keywords  │
│    ├─ Strong matches (>50% sim)      │
│    ├─ Partial matches (20-50%)       │
│    └─ Critical gaps (no match)       │
│    → keyword_score = sim * 100       │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 4. AI ANALYSIS (LLM)                │
│    ├─ Send context to Claude:        │
│    │   - User capabilities + decay   │
│    │   - Strong/partial matches      │
│    │   - Critical gaps               │
│    ├─ LLM returns:                   │
│    │   - match_score (AI estimate)   │
│    │   - strong_overlaps[]           │
│    │   - partial_overlaps[]          │
│    │   - critical_gaps[]             │
│    │   - priority_gaps[]             │
│    │   - readiness_level             │
│    │   - honest_assessment           │
│    │   - interview_readiness         │
│    │   - job_success_prediction      │
│    └─ AI_score returned              │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 5. SCORE BLENDING                    │
│    final_score = 0.3 * keyword_score │
│                + 0.7 * AI_score      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 6. STORE RESULTS                     │
│    ├─ Upsert gap_analyses table      │
│    └─ Update dream_jobs.match_score  │
└─────────────────────────────────────┘
```

### 5.2 Career Matching Algorithm (Iachan M Index)

```
Input: skill_profile (Holland code, technical_skills, work_values)
       onet_occupations[] (all occupations)
       ↓
For each occupation:
  ┌─────────────────────────────────────┐
  │ INTEREST MATCH (40% weight)          │
  │                                      │
  │ User Holland: e.g., "RIA"            │
  │ Job RIASEC:   e.g., "RIS"            │
  │                                      │
  │ Iachan M Index:                      │
  │   Position weights: [3, 2, 1]        │
  │   For each user position i:          │
  │     For each job position j:         │
  │       if exact match: +weight[i]     │
  │       if adjacent:    +weight[i]*0.5 │
  │   score = (sum / maxScore) * 100     │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ SKILLS MATCH (40% weight)            │
  │                                      │
  │ Importance weights:                  │
  │   essential=3, important=2, helpful=1│
  │                                      │
  │ For each required skill:             │
  │   match = min(100, user/required*100)│
  │   weighted_score += match * weight   │
  │   weighted_total += 100 * weight     │
  │                                      │
  │ score = (weighted_score/total) * 100 │
  │ gaps[] = sorted by importance, size  │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ VALUES MATCH (20% weight)            │
  │                                      │
  │ avg_diff = mean(|user - job| values) │
  │ score = max(0, 100 - avg_diff)       │
  └─────────────────────────────────────┘

  overall = interest*0.4 + skills*0.4 + values*0.2
       ↓
Sort by overall score, return top N
Upsert to career_matches table
```

### 5.3 Recommendation Generation

```
Input: dreamJobId, gap_analysis results
       ↓
┌─────────────────────────────────────┐
│ 1. GATHER CONTEXT                    │
│    ├─ dream_job details              │
│    ├─ priority_gaps (sorted)         │
│    ├─ critical_gaps                  │
│    ├─ honest_assessment              │
│    └─ user capabilities              │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. AI GENERATION (Claude)            │
│    Prompt requests 7-10 recs:        │
│    ├─ 2-3 projects                   │
│    ├─ 1-2 courses                    │
│    ├─ 1-2 skills to build            │
│    ├─ 1-2 actions to take            │
│    ├─ 1 experience to seek           │
│    │                                 │
│    │ Each rec includes:              │
│    │ ├─ title, type                  │
│    │ ├─ steps[] with time estimates  │
│    │ ├─ evidence_created             │
│    │ ├─ how_to_demonstrate           │
│    │ └─ gap_addressed                │
│    │                                 │
│    └─ 3-5 anti_recommendations       │
│        (action + reason)             │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. PERSIST                           │
│    ├─ Soft-delete old AI recs        │
│    │   (keep Firecrawl-discovered)   │
│    ├─ Insert new recommendations     │
│    └─ Insert anti_recommendations    │
└─────────────────────────────────────┘
```

### 5.4 Lecture Slide Generation (v3)

```
Input: teaching_unit_id
       ↓
┌─── PHASE 1: Context Gathering ───┐
│ Fetch: teaching unit, LO, domain,│
│ course, instructor context        │
└──────────────┬───────────────────┘
               ↓
┌─── PHASE 2: Research Agent ──────┐
│ Provider: Perplexity Sonar Pro    │
│ Returns: verified sources,        │
│          grounded content          │
│ Fallback: empty context if fails  │
└──────────────┬───────────────────┘
               ↓
┌─── PHASE 2C: Professor AI ──────┐
│ Provider: Claude 3.5 / Gemini    │
│ Input: LO + research findings    │
│ Output: 6-8 slides with:         │
│  ├─ order, type (title/content)  │
│  ├─ main_text + layout hints     │
│  ├─ key_points + emphasis_words  │
│  ├─ visual_directive (AI image)  │
│  ├─ speaker_notes (200-300 words)│
│  ├─ pedagogy (purpose, bloom)    │
│  └─ estimated_seconds            │
└──────────────┬───────────────────┘
               ↓
┌─── PHASE 2D: Speaker Notes ─────┐
│ CMM (Conversational Mastery)      │
│ Upgrade notes for natural delivery│
└──────────────┬───────────────────┘
               ↓
┌─── PHASE 3: Save & Quality ─────┐
│ Calculate quality metrics         │
│ Save slides immediately           │
│ Store: quality_score, citations,  │
│        is_research_grounded       │
└──────────────┬───────────────────┘
               ↓
┌─── PHASE 4: Async Image Queue ──┐
│ For each slide with visual:       │
│  ├─ Build optimized image prompt  │
│  ├─ Insert to image_gen_queue     │
│  └─ Trigger process-batch-images  │
│ (Non-blocking: doesn't wait)      │
└──────────────────────────────────┘
```

### 5.5 Verification State Machine

```
                    start_content
    ┌──────────┐ ──────────────→ ┌─────────────┐
    │ unstarted│                  │ in_progress │
    └──────────┘                  └──────┬──────┘
                                         │ complete_content
                                         ▼
                                  ┌─────────────┐
                                  │  verified    │
                                  └──────┬──────┘
                                         │ unlock_assessment
                                         ▼
                                  ┌──────────────────┐
                              ┌── │assessment_unlocked│
                              │   └──────┬───────────┘
                              │          │
                 fail_assessment         │ pass_assessment
                              │          │
                              ▼          ▼
                 ┌───────────────────┐  ┌────────┐
                 │remediation_required│  │ passed │ (terminal)
                 └────────┬──────────┘  └────────┘
                          │
                          │ retry_content
                          │
                          └──→ in_progress (loops back)

State Permissions:
┌─────────────────────┬──────────┬──────────┬──────────┐
│ State               │ Can Test │ Can Watch│ Complete │
├─────────────────────┼──────────┼──────────┼──────────┤
│ unstarted           │    No    │   Yes    │    No    │
│ in_progress         │    No    │   Yes    │    No    │
│ verified            │   Yes    │   Yes    │    No    │
│ assessment_unlocked │   Yes    │   Yes    │    No    │
│ passed              │    No    │   Yes    │   Yes    │
│ remediation_required│   Yes    │   Yes    │    No    │
└─────────────────────┴──────────┴──────────┴──────────┘
```

### 5.6 Gap Normalization & Deduplication

```
Input: criticalGaps[], priorityGaps[]
       ↓
┌─────────────────────────────────────┐
│ 1. NORMALIZE each gap               │
│    ├─ extractGapText(): try fields:  │
│    │   gap → job_requirement →       │
│    │   requirement → skill → text    │
│    ├─ normalizeSeverity():           │
│    │   critical/important/nice_to_have│
│    └─ normalizeCategory():           │
│        technical/soft_skill/         │
│        experience/certification/other│
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. COMBINE & DEDUPLICATE            │
│    ├─ Merge critical + priority      │
│    ├─ For each pair:                 │
│    │   textSimilarity() > 0.8?       │
│    │   (Jaccard coefficient)         │
│    │   → skip duplicate              │
│    └─ Sort: critical first,          │
│            then by priority number   │
└──────────────┬──────────────────────┘
               ↓
Output: NormalizedGap[] (text, priority, severity, category, etc.)
```

---

## 6. Integration Architecture

### 6.1 AI Model Routing

```
Edge Function → ai-gateway / openrouter-client.ts
                    │
                    ├─ FAST model (default): Claude 3.5 Sonnet / Gemini Flash
                    │   Used for: gap analysis, recommendations, job analysis
                    │
                    ├─ PROFESSOR model: Claude 3.5 / Gemini 3 Flash
                    │   Used for: lecture slide generation
                    │
                    ├─ RESEARCH model: Perplexity Sonar Pro
                    │   Used for: research grounding, citation verification
                    │
                    └─ BATCH model: Vertex AI
                        Used for: batch curriculum, evaluation, slides

Fallback chain: Primary model → Secondary model → Error
Rate limiting: checked per-function via checkRateLimit()
Caching: ai_cache table with TTL
```

### 6.2 Firecrawl Integration (Course Discovery)

```
User clicks "Find Real Courses"
       ↓
Frontend: useCourseSearch()
       ↓
Edge Function: firecrawl-search-courses
       ↓
┌─────────────────────────────────────┐
│ For each gap:                        │
│   1. extractSearchKeywords(gapText)  │
│      Remove 100+ stop words          │
│      Return 4 key terms              │
│   2. Build search query              │
│   3. Firecrawl API scrape            │
│   4. Parse results → course format   │
│   5. Score relevance to gap          │
└──────────────┬──────────────────────┘
               ↓
Insert as recommendations (type: 'course')
with real URLs, prices, providers
```

### 6.3 Stripe Integration

```
Checkout Flow:
  /billing → create-checkout-session → Stripe Checkout
  → /payment-success (redirect) OR /payment-cancel

Subscription Management:
  /billing → create-portal-session → Stripe Customer Portal

Webhook Flow:
  Stripe → stripe-webhook edge function
  → Process events (subscription.created, payment.succeeded, etc.)
  → Update profiles table (stripe_customer_id, subscription status)

Course Payments:
  Certificate purchase → create-course-payment → one-time Stripe charge
```

---

## 7. Performance Patterns

### 7.1 N+1 Prevention
- **Recommendations**: Single query + 2 parallel batch fetches + lookup maps (not N individual queries)
- **Access codes**: Generate 10 candidates, single query checks all uniqueness
- **Course duplication**: Batch insert all modules and LOs in 2 queries (not loops)
- **Skill counts**: Pre-compute Map<courseId, count> once, O(1) per lookup

### 7.2 Caching Strategy
- **TanStack Query**: Client-side cache with configurable stale time
- **ai_cache table**: Server-side AI response cache with TTL
- **job_requirements_cache**: Reuse job analysis across users (normalized query key)
- **Gap analysis freshness**: 24-hour window — skip re-analysis if fresh
- **O*NET data**: Cached reference data with long TTL

### 7.3 Async Non-Blocking Operations
- **Dream job creation**: Returns immediately, analysis runs in background
- **Course addition**: Background gap analysis refresh with Promise.allSettled
- **Image generation**: Queued via image_generation_queue, processed by separate function
- **Lecture processing**: Queue-based via process-lecture-queue

### 7.4 Frontend Optimizations
- **useMemo**: Dashboard stats, skill counts, filtered/sorted course lists
- **useCallback**: Stable function references for child components
- **Skeleton loading**: Shows UI structure during data fetch
- **Progressive tabs**: Only loads active tab content

---

## 8. Security Architecture

### 8.1 Authentication
- Supabase Auth with JWT tokens
- Email/password authentication
- Session persistence via Supabase SDK
- Profile data loaded from `profiles_safe` view (strips Stripe fields)

### 8.2 Authorization
- **Row Level Security (RLS)**: All tables have policies enforcing `auth.uid() = user_id`
- **Route guards**: AuthGuard (authenticated), AdminGuard (admin role), GuestGuard (not logged in)
- **Role-based navigation**: UI adapts based on user_roles
- **Edge function auth**: Each function validates JWT token

### 8.3 Data Protection
- Stripe fields excluded from frontend via DB view
- Signed URLs for syllabus storage (1-hour expiry)
- Server-side answer validation (no client-side grading)
- Timing anomaly detection for assessment integrity
- Content moderation queue for instructor content
