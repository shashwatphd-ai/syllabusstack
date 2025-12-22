# EduThree Unified Implementation Proposal

> **Document Purpose**: Comprehensive proposal merging the Technical Specification, PRD v2, and Lovable Proposal with an audit of current codebase capabilities. This is the master plan for building the complete EduThree platform.

---

## Document Metadata

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Created** | 2025-12-22 |
| **Status** | Pending Approval |
| **Sources** | EduThree_Technical_Spec.docx, EduThree_PRD_v2.docx, EduThree_Lovable_Proposal.docx |

---

## Executive Summary

### What EduThree Is Today (Current Codebase)

EduThree currently operates as an **AI-native career navigation platform** that helps students understand their job-readiness through intelligent analysis of coursework against real job market requirements. The existing platform includes:

**✅ FULLY IMPLEMENTED:**
1. **Landing Page & Marketing** - Hero, features, testimonials, pricing sections
2. **Authentication System** - Email/password signup, login, password reset with Supabase Auth
3. **Onboarding Wizard** - Multi-step flow: Profile → Courses → Dream Jobs → Complete
4. **Syllabus Analysis** - AI-powered extraction of capabilities from course syllabi
5. **Dream Job Analysis** - AI-powered extraction of job requirements, differentiators, realistic bar
6. **Gap Analysis** - Compare student capabilities vs. job requirements with match scores
7. **Recommendations Engine** - AI-generated learning paths with status tracking
8. **Progress Loop** - Recommendation status controls, re-analysis prompts, progress widgets
9. **Data Export** - PDF and JSON export of capabilities and analysis
10. **Re-engagement System** - Email preferences, activity tracking, welcome back banners, digest emails
11. **Dashboard** - Overview stats, dream job cards, capability snapshots, next action banners

### What the New Documents Propose

The three uploaded documents propose transforming EduThree from a **career navigation platform** into a **verified learning platform** with three major feature extensions:

1. **Intelligent Content Curation Engine** — Auto-match free online resources (videos, readings) to learning objectives
2. **Verified Consumption Tracking** — Ensure students actually engage with content before assessment
3. **AI-Resistant Assessment Layer** — Time-bound, randomized evaluations that make AI assistance structurally impractical

### Core Product Thesis Shift

| Current Focus | Proposed Focus |
|---------------|----------------|
| Career gap analysis for students | Verified learning certification for institutions |
| User: Individual student | Users: Students + Instructors + Institutions |
| Revenue: Affiliate commissions | Revenue: University licenses + Employer sponsorships |
| Output: Career recommendations | Output: Verified completion certificates |

---

## Part 1: Architecture Integration

### Current Tech Stack (Implemented)

| Layer | Technology | Status |
|-------|------------|--------|
| Frontend | React 18 + TypeScript | ✅ Active |
| State Management | TanStack Query v5 | ✅ Active |
| Routing | React Router v6 | ✅ Active |
| Forms | React Hook Form + Zod | ✅ Active |
| Styling | Tailwind CSS + shadcn/ui | ✅ Active |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) | ✅ Active |
| AI | Lovable AI Gateway (Gemini 2.5 Flash) | ✅ Active |
| File Processing | Text input (syllabi) | ✅ Active |
| Deployment | Lovable Cloud | ✅ Active |

### Proposed Additions

| Component | Technology | Purpose |
|-----------|------------|---------|
| Video Player | Custom wrapper (Video.js or similar) | Track engagement |
| YouTube API | YouTube Data API v3 | Content curation |
| Vector Store | Supabase pgvector (already enabled) | Semantic matching |
| Embeddings | OpenAI text-embedding-3-small OR Lovable AI | Similarity search |
| Real-time | Supabase Realtime | Live tracking updates |

---

## Part 2: Database Schema Additions

### Current Tables (Implemented)

| Table | Purpose | Status |
|-------|---------|--------|
| `profiles` | User info, onboarding status | ✅ |
| `courses` | Student courses with AI analysis | ✅ |
| `capabilities` | Individual skills extracted | ✅ |
| `capability_profiles` | Aggregated user capabilities | ✅ |
| `dream_jobs` | Target job roles with requirements | ✅ |
| `job_requirements` | Skills needed per job | ✅ |
| `job_requirements_cache` | Cached job analysis | ✅ |
| `gap_analyses` | Comparison results | ✅ |
| `recommendations` | Learning path suggestions | ✅ |
| `anti_recommendations` | What NOT to do | ✅ |
| `ai_cache` | AI response caching | ✅ |
| `ai_usage` | Cost tracking | ✅ |

### New Tables Required

```sql
-- LEARNING OBJECTIVES (from syllabus parsing)
CREATE TABLE public.learning_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  core_concept TEXT,
  action_verb TEXT,
  bloom_level TEXT CHECK (bloom_level IN ('remember','understand','apply','analyze','evaluate','create')),
  domain TEXT,
  specificity TEXT CHECK (specificity IN ('introductory','intermediate','advanced')),
  search_keywords TEXT[],
  expected_duration_minutes INTEGER,
  embedding VECTOR(1536),
  verification_state TEXT DEFAULT 'unstarted' CHECK (verification_state IN ('unstarted','in_progress','verified','assessment_unlocked','passed','remediation_required')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONTENT LIBRARY (curated videos, readings)
CREATE TABLE public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT CHECK (source_type IN ('youtube','instructor_upload','article','textbook')),
  source_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  channel_name TEXT,
  view_count INTEGER,
  like_ratio DECIMAL,
  published_at TIMESTAMPTZ,
  embedding VECTOR(1536),
  quality_score DECIMAL,
  is_available BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONTENT MATCHES (LO to Content mapping)
CREATE TABLE public.content_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
  match_score DECIMAL NOT NULL,
  duration_fit_score DECIMAL,
  semantic_similarity_score DECIMAL,
  engagement_quality_score DECIMAL,
  channel_authority_score DECIMAL,
  recency_score DECIMAL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','auto_approved')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONSUMPTION RECORDS (tracking engagement)
CREATE TABLE public.consumption_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  watched_segments JSONB DEFAULT '[]',
  watch_percentage DECIMAL DEFAULT 0,
  tab_focus_losses JSONB DEFAULT '[]',
  rewind_events JSONB DEFAULT '[]',
  playback_speed_violations INTEGER DEFAULT 0,
  time_on_content_score DECIMAL,
  micro_check_accuracy_score DECIMAL,
  interaction_signals_score DECIMAL,
  engagement_score DECIMAL,
  is_verified BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MICRO-CHECKS (comprehension questions during content)
CREATE TABLE public.micro_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
  trigger_time_seconds INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('recall','mcq')),
  options JSONB, -- for MCQ
  correct_answer TEXT NOT NULL,
  rewind_target_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MICRO-CHECK RESULTS
CREATE TABLE public.micro_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumption_record_id UUID REFERENCES public.consumption_records(id) ON DELETE CASCADE,
  micro_check_id UUID REFERENCES public.micro_checks(id) ON DELETE CASCADE,
  user_answer TEXT,
  is_correct BOOLEAN,
  time_taken_seconds INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ASSESSMENT QUESTIONS
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('mcq','short_answer')),
  options JSONB, -- for MCQ: [{text, is_correct}]
  correct_answer TEXT,
  accepted_answers TEXT[], -- for short answer variations
  required_keywords TEXT[], -- for keyword matching
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  bloom_level TEXT,
  time_limit_seconds INTEGER DEFAULT 45,
  scenario_context TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ASSESSMENT SESSIONS
CREATE TABLE public.assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  learning_objective_id UUID REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  attempt_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','timed_out','abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  total_score DECIMAL,
  questions_answered INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0
);

-- ASSESSMENT ANSWERS
CREATE TABLE public.assessment_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  user_answer TEXT,
  is_correct BOOLEAN,
  time_taken_seconds INTEGER,
  server_received_at TIMESTAMPTZ,
  evaluation_method TEXT, -- 'exact', 'keyword', 'semantic', 'llm'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INSTRUCTOR COURSES (separate from student courses)
CREATE TABLE public.instructor_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL,
  title TEXT NOT NULL,
  code TEXT,
  description TEXT,
  curation_mode TEXT DEFAULT 'guided_auto' CHECK (curation_mode IN ('full_control','guided_auto','hands_off')),
  verification_threshold INTEGER DEFAULT 70,
  is_published BOOLEAN DEFAULT FALSE,
  access_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COURSE ENROLLMENTS
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  instructor_course_id UUID REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  overall_progress DECIMAL DEFAULT 0,
  UNIQUE(student_id, instructor_course_id)
);

-- MODULES (grouping of LOs within instructor course)
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_course_id UUID REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Part 3: Feature Implementation Phases

### Phase 0: Preserve Current Functionality (CRITICAL)
**Duration**: Ongoing throughout all phases

All existing features must remain fully functional:
- ✅ Student career navigation flow
- ✅ Syllabus → Capabilities → Dream Jobs → Gap Analysis → Recommendations
- ✅ Progress tracking and status updates
- ✅ PDF/JSON export
- ✅ Email preferences and digest system
- ✅ Dashboard with next action guidance

---

### Phase 1: Content Curation Engine (Weeks 1-3)

#### 1.1 Learning Objective Extraction Enhancement

**Edge Function**: `supabase/functions/extract-learning-objectives/index.ts`

```typescript
// Extract structured LOs from syllabus text
// Input: syllabus text
// Output: Array of LearningObjective objects with Bloom taxonomy, keywords, duration estimates
```

**LLM Prompt Structure**:
- Extract core_concept (2-4 words)
- Identify action_verb (Bloom's taxonomy)
- Classify bloom_level
- Determine domain (business/science/humanities/technical/arts)
- Assess specificity (introductory/intermediate/advanced)
- Generate 3 search keywords
- Calculate expected_duration_minutes using matrix

**Duration Matrix**:
| Bloom Level | Introductory | Intermediate | Advanced |
|-------------|--------------|--------------|----------|
| Remember | 5 min | 8 min | 12 min |
| Understand | 8 min | 12 min | 18 min |
| Apply | 12 min | 18 min | 25 min |
| Analyze | 15 min | 22 min | 30 min |
| Evaluate | 18 min | 25 min | 35 min |
| Create | 20 min | 30 min | 40 min |

#### 1.2 YouTube Content Search

**Edge Function**: `supabase/functions/search-youtube-content/index.ts`

**Required Secret**: `YOUTUBE_API_KEY`

**Query Construction**:
1. Primary: `[core_concept] + [domain] + "explained"`
2. Secondary: `[action_map[bloom_level]] + [core_concept]`
3. Tertiary: Top 3 search keywords combined

**Action Mapping**:
| Bloom Level | Search Modifier |
|-------------|-----------------|
| remember | "introduction to" |
| understand | "explained" |
| apply | "how to" |
| analyze | "analysis of" |
| evaluate | "comparing" |
| create | "tutorial" |

**API Parameters**:
- videoDuration: "medium" (4-20 minutes)
- videoEmbeddable: true
- videoSyndicated: true
- safeSearch: "strict"
- maxResults: 10 per query

#### 1.3 Content Scoring Algorithm

**5-Factor Weighted Scoring**:
| Factor | Weight | Calculation |
|--------|--------|-------------|
| Duration Fit | 25% | min(actual, expected) / max(actual, expected). Penalty: ×0.5 if <50% expected, ×0.7 if >200% |
| Semantic Similarity | 35% | Cosine similarity between LO embedding and video title+description embedding |
| Engagement Quality | 20% | like_ratio / 0.05 (capped at 1.0). Low confidence (0.3) for <1000 views |
| Channel Authority | 10% | 0.8 if channel contains edu indicators, else 0.5 |
| Recency | 10% | <30 days: 0.5, 30-365 days: 1.0, 1-3 years: 0.8, >3 years: 0.6 |

**Threshold Decisions**:
- ≥0.75: Auto-approve (Hands-Off mode) or pre-select (Guided Auto)
- 0.40-0.74: Present for instructor review
- <0.40: Auto-reject, never shown

#### 1.4 Instructor Control Interface

**New Pages**:
- `/instructor/courses` - List instructor's courses
- `/instructor/courses/[id]` - Course detail with modules
- `/instructor/courses/[id]/content` - Content curation dashboard
- `/instructor/courses/[id]/settings` - Curation mode, thresholds

**New Components**:
- `InstructorCourseCard.tsx`
- `ContentMatchCard.tsx` - Show video preview, scores, approve/reject buttons
- `ContentUploader.tsx` - Manual upload option
- `CurationModeSelector.tsx` - Full Control / Guided Auto / Hands-Off

---

### Phase 2: Verified Consumption Tracking (Weeks 4-6)

#### 2.1 Custom Video Player

**New Component**: `src/components/player/VerifiedVideoPlayer.tsx`

**Features**:
- Wrap YouTube embed in custom container
- Track play/pause events with timestamps
- Monitor playback speed (block >2x)
- Record watched segments as [start, end] pairs
- Detect tab focus changes (log, don't pause)
- Trigger micro-checks at predefined timestamps

**State Machine States**:
| State | Description |
|-------|-------------|
| LOADING | Video loading |
| READY | Waiting for start |
| PLAYING | Actively tracking |
| PAUSED | User or system paused |
| MICROCHECK_ACTIVE | Question displayed |
| MICROCHECK_FAILED | Wrong answer, preparing rewind |
| COMPLETED | Calculating engagement score |
| BLOCKED | Speed violation or rule break |

#### 2.2 Watch Percentage Calculation

```typescript
function calculateWatchPercentage(segments: [number, number][], totalDuration: number): number {
  // 1. Sort segments by start time
  // 2. Merge overlapping segments
  // 3. Sum duration of merged segments
  // 4. Divide by total video duration
}
```

#### 2.3 Micro-Check System

**Placement Algorithm**:
- Start buffer: 10% of video duration
- End buffer: 5% of video duration
- Distribution: 3 checkpoints evenly in usable duration
- Jitter: ±10% randomization
- Review point: 30 seconds before each checkpoint

**Micro-Check Constraints**:
| Constraint | Specification |
|------------|---------------|
| Time limit | 10 seconds |
| Question length | 150 characters max |
| Format | Single sentence or MCQ (4 options max) |
| Cognitive level | Simple recall only |
| Wrong answer | Rewind 30 seconds, replay |

**New Components**:
- `MicroCheckOverlay.tsx` - Question popup over video
- `MicroCheckQuestion.tsx` - Render question with countdown

#### 2.4 Engagement Score Calculation

**Component Weights**:
| Component | Weight | Details |
|-----------|--------|---------|
| Time on Content | 40% | Must watch ≥85% unique content |
| Micro-Check Accuracy | 40% | First attempts only count |
| Interaction Signals | 20% | Tab focus (10pts), Rewinds (5pts), Speed violations (5pts) |

**Tab Focus Scoring**:
- 0 losses: 10 points
- 1-2 losses: 7 points
- 3-5 losses: 4 points
- 6+ losses: 0 points

**Rewind Pattern Scoring**:
- 1-5 rewinds: 5 points (healthy)
- 0 rewinds: 3 points (too passive)
- 6+ rewinds: 2 points (struggling)

**Verification Thresholds**:
| Score | Status | Action |
|-------|--------|--------|
| ≥70 | Verified | Unlock assessment |
| 60-69 | Partial | Targeted review + extra check |
| <60 | Not Verified | Full rewatch required |

---

### Phase 3: AI-Resistant Assessment (Weeks 7-9)

#### 3.1 Question Pool & Selection

**Edge Function**: `supabase/functions/start-assessment/index.ts`

**Selection Algorithm**:
1. Verify prerequisites (content verified, attempts < 2)
2. Get questions for LO, excluding previous attempt questions
3. Difficulty distribution: 1 easy, 3 medium, 1 hard
4. Randomize question order
5. Randomize MCQ option order
6. Create session with 10-minute hard timeout

#### 3.2 Time Limits by Question Type

| Question Type | Remember | Apply | Analyze |
|---------------|----------|-------|---------|
| Multiple Choice | 20 sec | 45 sec | 60 sec |
| Short Answer | 30 sec | 60 sec | 75 sec |

**Adjustments**:
- Has scenario context: +15 seconds
- Question text >50 words: +10 seconds
- Has image: +10 seconds
- Maximum cap: 90 seconds

#### 3.3 Server-Side Timing Validation

```typescript
// Record server timestamp when question served
// Grace period: 2 seconds for network latency
// Flag suspicious if client elapsed < server - 5 seconds
// Auto-submit if server elapsed > limit + grace
```

#### 3.4 Short Answer Evaluation Cascade

1. **Exact Match**: Normalize, compare to accepted list
2. **Keyword Presence**: Check required keywords, answer ≥3 words
3. **Semantic Similarity**: Compare embeddings, threshold 0.85
4. **LLM Evaluation**: For complex responses, use AI as grader

#### 3.5 Remediation Flow

**First Failure (Attempt 1)**:
- Status: remediation_required
- Show specific content sections for incorrect answers
- 30-minute cooldown before retry

**Second Failure (Attempt 2)**:
- Status: instructor_review_required
- Notify instructor with weakness analysis
- Student options: Office hours, alternative assessment

**Weakness Analysis Patterns**:
- All failures same Bloom level → "Struggling with [level]-level questions"
- All failures same topic → "Struggling with topic: [topic]"
- >50% timed out → "Running out of time on questions"

#### 3.6 New Components

- `AssessmentContainer.tsx` - Full-screen assessment mode
- `TimedQuestion.tsx` - Question with countdown timer
- `QuestionProgress.tsx` - Show question X of Y
- `AssessmentResults.tsx` - Score display with feedback
- `RemediationGuide.tsx` - Targeted rewatch suggestions

---

## Part 4: User Role Separation

### Current: Single User Type (Student)

All users are students navigating their own careers.

### Proposed: Two User Types

#### Student Role (Enhanced)
- Everything current users can do PLUS:
- Enroll in instructor courses
- Complete verified content consumption
- Take timed assessments
- Track verified completion status
- Export verified credentials

#### Instructor Role (New)
- Create courses with learning objectives
- Configure content curation settings
- Review and approve content matches
- Create assessment question pools
- Monitor student progress dashboard
- Export gradebook data
- Handle remediation cases

### Implementation Approach

**Option A: Role Field in Profiles** (Recommended for MVP)
```sql
ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin'));
```

**Option B: Separate Instructor Table** (For future institution management)
```sql
CREATE TABLE instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  institution_id UUID,
  department TEXT,
  verified_at TIMESTAMPTZ,
  ...
);
```

---

## Part 5: API Endpoints Required

### New Edge Functions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/extract-learning-objectives` | POST | Parse syllabus into structured LOs |
| `/search-youtube-content` | POST | Find matching YouTube videos |
| `/score-content-match` | POST | Calculate 5-factor match scores |
| `/track-consumption` | POST | Log video watching events |
| `/submit-microcheck` | POST | Handle micro-check answers |
| `/start-assessment` | POST | Begin timed assessment session |
| `/submit-assessment-answer` | POST | Process answer under time constraint |
| `/complete-assessment` | POST | Finalize session, calculate score |
| `/get-instructor-dashboard` | GET | Analytics and student progress |
| `/get-lo-state` | GET | Verification state for learning objective |
| `/check-content-availability` | POST | Verify YouTube videos still exist |

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 access |
| `OPENAI_API_KEY` | Embeddings (if not using Lovable AI) |
| `RESEND_API_KEY` | Email notifications (already needed) |

---

## Part 6: Success Metrics

### Current Metrics (Career Navigation)

| Metric | Target |
|--------|--------|
| Onboarding completion | >80% |
| Courses added per user | ≥3 |
| Gap analysis generated | ≥1 per user |
| Recommendation status updates | >50% users |

### New Metrics (Verified Learning)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Content match accuracy | >80% instructor approval | Approved vs rejected |
| Verified consumption rate | >90% started → verified | Completions / starts |
| Assessment completion time | <5 min from content end | Timestamp delta |
| Assessment pass rate | 70-85% first attempt | Score distribution |
| Instructor time saved | >5 hours per course | Survey + tracking |
| Learning Integrity Index | >65% | First-attempt passes / total students |

**Learning Integrity Index** is the killer metric that proves content curation, verified consumption, and AI-resistant assessment work as an integrated system.

---

## Part 7: Implementation Timeline

### Total Duration: 9-12 Weeks

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 0 | Ongoing | Preserve all current functionality |
| Phase 1 | Weeks 1-3 | Content Curation Engine |
| Phase 2 | Weeks 4-6 | Verified Consumption Tracking |
| Phase 3 | Weeks 7-9 | AI-Resistant Assessment |
| Phase 4 | Weeks 10-12 | Polish, Testing, Pilot Launch |

### MVP Definition

MVP is successful if ONE course with 5-10 learning objectives can be fully verified using:
- YouTube-only content
- MCQ + short answer assessments
- One verification method per content type

### Explicitly Out of Scope (MVP)

- Discussion forums
- Student-to-student messaging
- Note-taking features
- Academic paper sources
- Audio response assessments
- Webcam proctoring
- LMS deep integration (LTI)
- AI-generated questions

---

## Part 8: Risk Assessment

### Technical Risks

| Risk | Mitigation |
|------|------------|
| YouTube API quota limits | Aggressive caching, rate limiting |
| YouTube content takedowns | Daily availability checks, instructor notifications |
| Browser restrictions on tracking | Log vs block approach, graceful degradation |
| Time sync manipulation | Server-side validation with grace periods |
| Tab focus false positives | Penalty system, not hard blocking |

### Product Risks

| Risk | Mitigation |
|------|------------|
| Instructor adoption | Default to Guided Auto, minimize friction |
| Student frustration | Transparent scoring, appeal process |
| Feature creep | Strict MVP boundaries, phase gates |
| Dual-purpose complexity | Clear UI separation between student/instructor modes |

---

## Part 9: Decision Points for Approval

### 1. Product Direction
**Question**: Should EduThree expand from career navigation to verified learning, or keep these as separate products?

**Options**:
- A) Unified platform with both capabilities
- B) Separate product for verified learning
- C) Focus only on career navigation (current)

### 2. User Roles
**Question**: How to handle instructor accounts?

**Options**:
- A) Add role field to profiles (simpler)
- B) Separate instructor tables (more complex, better for institutions)
- C) Self-service role switching

### 3. Content Sources
**Question**: MVP content sources?

**Options**:
- A) YouTube only (recommended for MVP)
- B) YouTube + instructor uploads
- C) Multiple sources from start

### 4. Assessment Generation
**Question**: How to create assessment questions?

**Options**:
- A) Manual creation only (MVP)
- B) AI-assisted with instructor review
- C) Fully automated (not recommended)

### 5. Timeline Priority
**Question**: What's the build order priority?

**Options**:
- A) Phase 1 → 2 → 3 (linear, lower risk)
- B) All phases parallel (faster, higher risk)
- C) Focus on one phase only for now

---

## Appendix A: Current Codebase File Structure

```
src/
├── components/
│   ├── analysis/           # Gap analysis views ✅
│   ├── auth/               # Login, signup, guards ✅
│   ├── common/             # Loading, error, export ✅
│   ├── dashboard/          # Overview, cards, widgets ✅
│   ├── forms/              # Add course, dream job ✅
│   ├── landing/            # Marketing pages ✅
│   ├── layout/             # Shell, sidebar, header ✅
│   ├── onboarding/         # Wizard, uploaders ✅
│   ├── recommendations/    # Cards, progress, anti-recs ✅
│   ├── settings/           # Email preferences ✅
│   └── ui/                 # shadcn components ✅
├── contexts/
│   └── AuthContext.tsx     # Auth state management ✅
├── hooks/
│   ├── useAnalysis.ts      # Gap analysis queries ✅
│   ├── useCapabilities.ts  # Capability queries ✅
│   ├── useCourses.ts       # Course CRUD ✅
│   ├── useDashboard.ts     # Dashboard data ✅
│   ├── useDreamJobs.ts     # Dream job CRUD ✅
│   ├── useProfile.ts       # Profile management ✅
│   └── useRecommendations.ts # Recommendation CRUD ✅
├── pages/
│   ├── Analysis.tsx        # Gap analysis page ✅
│   ├── Courses.tsx         # Course list ✅
│   ├── Dashboard.tsx       # Main dashboard ✅
│   ├── DreamJobs.tsx       # Dream job list ✅
│   ├── Onboarding.tsx      # Onboarding wizard ✅
│   ├── Recommendations.tsx # Learning paths ✅
│   └── ...                 # Other pages ✅
└── lib/
    ├── api.ts              # Edge function calls ✅
    ├── export-utils.ts     # PDF/JSON export ✅
    └── query-keys.ts       # TanStack Query keys ✅

supabase/
└── functions/
    ├── analyze-syllabus/   # Extract capabilities ✅
    ├── analyze-dream-job/  # Extract requirements ✅
    ├── gap-analysis/       # Compare gaps ✅
    ├── generate-recommendations/ # Create paths ✅
    ├── get-usage-stats/    # Usage tracking ✅
    └── send-digest-email/  # Email digests ✅
```

---

## Appendix B: Approval Checklist

Before proceeding with implementation, please confirm:

- [ ] Approved: Overall product direction expansion
- [ ] Approved: 9-12 week timeline
- [ ] Approved: YouTube-only MVP for content
- [ ] Approved: Role field approach for instructors
- [ ] Approved: Manual question creation for MVP
- [ ] Approved: Database schema additions
- [ ] Approved: New secrets requirements (YouTube API key)
- [ ] Approved: Phase 1-2-3 linear implementation order

---

**Document Status**: PENDING APPROVAL

Once approved, implementation will begin with Phase 1: Content Curation Engine.
