# Phase 2: Frontend-Backend API Mapping

> **Report Date:** 2026-03-26
> **Scope:** Every frontend file -> edge function call AND direct DB table query in both repos

---

## 1. Edge Function Calls from Frontend

### 1A. `syllabusstack` Frontend -> Edge Function Mapping (68 calls)

| Frontend File | Edge Function Called | Purpose |
|---------------|---------------------|---------|
| **Capstone & Discovery** | | |
| `src/hooks/useCapstoneProjects.ts` | `discover-companies` | Find companies near course |
| `src/hooks/useCapstoneProjects.ts` | `generate-capstone-projects` | Generate project proposals |
| `src/hooks/useCapstoneProjects.ts` | `re-enrich-addresses` | Update company addresses |
| `src/hooks/useCapstoneProjects.ts` | `extract-capstone-competencies` | Extract skills from completed project |
| `src/hooks/useProjectMetadata.ts` | `generate-premium-insights` | Generate premium project insights |
| `src/hooks/useProjectMetadata.ts` | `generate-value-analysis` | Generate project value analysis |
| **Syllabus Processing** | | |
| `src/hooks/useProcessSyllabus.ts` | `process-syllabus` | Orchestrate full syllabus pipeline |
| `src/hooks/useAnalysis.ts` | `analyze-syllabus` | AI capability extraction |
| `src/services/syllabus-service.ts` | `parse-syllabus-document` | Extract text from PDF |
| `src/pages/SyllabusScanner.tsx` | `analyze-syllabus` | Scanner page AI analysis |
| `src/components/forms/AddCourseForm.tsx` | `parse-syllabus-document` | Upload & parse syllabus |
| `src/components/onboarding/BulkSyllabusUploader.tsx` | `process-syllabus` | Bulk upload syllabi |
| **Assessment** | | |
| `src/hooks/assessment/mutations.ts` | `start-assessment` | Start assessment session |
| `src/hooks/assessment/mutations.ts` | `submit-assessment-answer` | Submit answer |
| `src/hooks/assessment/mutations.ts` | `complete-assessment` | Complete assessment |
| `src/hooks/assessment/microChecks.ts` | `generate-micro-checks` | Generate quick checks |
| `src/services/assessment-service.ts` | `generate-assessment-questions` | Generate questions |
| `src/hooks/useSkillsAssessment.ts` | `start-skills-assessment` | Start skills assessment |
| `src/hooks/useSkillsAssessment.ts` | `complete-skills-assessment` | Complete skills assessment |
| `src/hooks/useSkillsAssessment.ts` | `submit-skills-response` | Submit skills response |
| **Career & Dream Jobs** | | |
| `src/hooks/useDiscoverDreamJobs.ts` | `discover-dream-jobs` | Suggest dream jobs |
| `src/components/dreamjobs/DreamJobDiscovery.tsx` | `discover-dream-jobs` | Dream job discovery UI |
| `src/services/dream-job-service.ts` | `analyze-dream-job` | Analyze target job |
| `src/hooks/useCareerMatches.ts` | `match-careers` | Career matching |
| `src/services/gap-analysis-service.ts` | `gap-analysis` | Skills gap analysis |
| `src/services/recommendations-service.ts` | `generate-recommendations` | Learning recommendations |
| `src/hooks/useJobMatches.ts` | `job-matcher` | Match students to jobs |
| `src/hooks/useJobs.ts` | `search-jobs` | Search job listings |
| `src/hooks/useJobs.ts` | `scrape-job-posting` | Scrape job details |
| **Lecture Slides & Content** | | |
| `src/hooks/useAIGeneration.ts` | `generate-lecture-slides-v3` | Generate slides |
| `src/hooks/useAIGeneration.ts` | `generate-lecture-audio` | Generate audio |
| `src/hooks/lectureSlides/mutations.ts` | `generate-lecture-slides-v3` | Slide generation |
| `src/hooks/lectureSlides/audio.ts` | `generate-batch-audio` | Batch audio generation |
| `src/hooks/lectureSlides/queue.ts` | `poll-batch-status` | Check batch status |
| `src/hooks/useBatchSlides.ts` | `submit-batch-slides` | Submit batch slides |
| `src/hooks/useBatchSlides.ts` | `process-batch-research` | Research for slides |
| `src/hooks/useBatchSlides.ts` | `process-batch-images` | Generate images for slides |
| `src/hooks/useContentAssistant.ts` | `content-assistant-chat` | AI chat assistant |
| `src/hooks/useTeachingUnits.ts` | `search-youtube-content` | Search YouTube |
| `src/hooks/useTeachingUnits.ts` | `search-youtube-manual` | Manual YouTube search |
| `src/services/content-service.ts` | `fetch-video-metadata` | Fetch video metadata |
| `src/hooks/useSingleCourseSearch.ts` | `firecrawl-search-courses` | Search courses |
| `src/hooks/useCourseSearch.ts` | `search-youtube-content` | YouTube search |
| **Curriculum** | | |
| `src/hooks/useGeneratedCurriculum.ts` | `generate-curriculum` | Generate learning path |
| `src/hooks/useGeneratedCurriculum.ts` | `curriculum-reasoning-agent` | AI curriculum reasoning |
| `src/hooks/useLearningObjectives.ts` | `extract-learning-objectives` | Extract LOs from syllabus |
| `src/hooks/useAutoLinkCourses.ts` | `auto-link-courses` | Auto-link related courses |
| **Billing** | | |
| `src/pages/Checkout.tsx` | `create-checkout-session` | Stripe checkout |
| `src/pages/Checkout.tsx` | `create-course-payment` | Course purchase |
| `src/components/billing/SubscriptionManager.tsx` | `create-portal-session` | Billing portal |
| `src/components/billing/SubscriptionManager.tsx` | `cancel-subscription` | Cancel subscription |
| `src/components/billing/BillingHistory.tsx` | `get-invoices` | Invoice history |
| `src/components/certificates/CertificateSelection.tsx` | `purchase-certificate` | Buy certificate |
| **Identity & Verification** | | |
| `src/hooks/useIdentityVerification.ts` | `initiate-identity-verification` | Start IDV |
| `src/hooks/useIdentityVerification.ts` | `identity-verification-status` | Check IDV status |
| `src/hooks/useInstructorVerification.ts` | `verify-instructor-email` | Verify instructor |
| `src/hooks/useAdminVerifications.ts` | `review-instructor-verification` | Admin review |
| `src/pages/verify/PublicCertificateVerify.tsx` | `verify-certificate` | Verify cert |
| `src/hooks/useInviteToken.ts` | `use-invite-code` | Redeem invite |
| **Other** | | |
| `src/hooks/useConsumptionTracking.ts` | `track-consumption` | Track AI usage |
| `src/hooks/useUsageStats.ts` | `get-usage-stats` | Usage statistics |
| `src/hooks/useGlobalSearch.ts` | `global-search` | Global search |
| `src/hooks/useEmployerAccount.ts` | `create-webhook` | Create webhook |
| `src/hooks/useEmployerAccount.ts` | `employer-verify-completion` | Verify completion |
| `src/hooks/useOrganization.ts` | `remove-org-user` | Remove org member |
| `src/hooks/useOrganization.ts` | `invite-users` | Invite users |
| `src/components/instructor/InviteColleagues.tsx` | `send-instructor-invite` | Invite instructor |
| `src/components/instructor/AddVideoByURL.tsx` | `fetch-video-metadata` | Fetch video info |
| `src/components/instructor/ManualContentSearch.tsx` | `add-manual-content` | Add content |
| `src/pages/student/StudentPortfolio.tsx` | `portfolio-export` | Export portfolio |
| `src/components/student/EnrollmentDialog.tsx` | `enroll-in-course` | Enroll |

### 1B. `projectify-syllabus` Frontend -> Edge Function Mapping (21 calls)

| Frontend File | Edge Function Called | Purpose |
|---------------|---------------------|---------|
| Upload.tsx / hooks | `parse-syllabus` | Upload & parse PDF syllabus |
| Dashboard/hooks | `discover-companies` | Find companies |
| Dashboard/hooks | `generate-projects` | Generate projects |
| Dashboard/hooks | `detect-location` | Auto-detect location |
| Dashboard/hooks | `admin-regenerate-projects` | Regenerate projects |
| ProjectDetail/hooks | `get-project-detail` | Fetch project detail |
| ProjectDetail/hooks | `analyze-project-value` | Value analysis |
| ProjectDetail/hooks | `salary-roi-calculator` | Salary ROI |
| ProjectDetail/hooks | `skill-gap-analyzer` | Skill gap analysis |
| Career/hooks | `career-pathway-mapper` | Career mapping |
| DemandBoard/hooks | `aggregate-demand-signals` | Demand data |
| DemandBoard/hooks | `get-live-demand` | Live demand |
| Portfolio/hooks | `portfolio-export` | Export portfolio |
| Admin/hooks | `import-university-data` | Import universities |
| Admin/hooks | `rate-student-performance` | Rate student |
| Employer/hooks | `send-faculty-approval-email` | Faculty email |
| Employer/hooks | `submit-employer-interest` | Employer interest |
| Student/hooks | `student-project-matcher` | Match to project |
| Student/hooks | `sync-project-match` | Sync match |
| Debug/hooks | `firecrawl-scrape` | Debug scraping |
| Debug/hooks | `firecrawl-career-pages` | Debug career pages |

---

## 2. Direct Supabase Table Queries from Frontend

### 2A. `syllabusstack` Tables Queried (65 tables/views)

| Table/View | Queried By | Operations |
|------------|-----------|------------|
| `courses` | useAnalysis, AddCourseForm, Learn, CourseDetail | SELECT, INSERT, UPDATE |
| `instructor_courses` | useInstructorCourses, QuickCourseSetup | SELECT, INSERT, UPDATE |
| `course_enrollments` | useEnrollments, EnrollmentDialog | SELECT, INSERT, DELETE |
| `learning_objectives` | useLearningObjectives, assessment hooks | SELECT, INSERT, UPDATE |
| `capabilities` | useAnalysis, useCapabilities | SELECT, INSERT |
| `capstone_projects` | useCapstoneProjects | SELECT, UPDATE |
| `company_profiles` | useCapstoneProjects | SELECT |
| `project_forms` | useCapstoneProjects | SELECT |
| `project_metadata` | useProjectMetadata | SELECT, INSERT, UPDATE |
| `dream_jobs` | useDiscoverDreamJobs, AddDreamJobForm | SELECT, INSERT, DELETE |
| `gap_analyses` | gap-analysis-service | SELECT |
| `career_matches` | useCareerMatches | SELECT |
| `recommendations` | recommendations-service | SELECT |
| `anti_recommendations` | useAntiRecommendations | SELECT |
| `discovered_careers` | useCareerMatches | SELECT |
| `assessment_sessions` | assessment hooks | SELECT, INSERT, UPDATE |
| `assessment_questions` | assessment hooks | SELECT |
| `micro_checks_student` | microChecks hook | SELECT, INSERT |
| `micro_check_results` | microChecks hook | SELECT |
| `skills_assessment_sessions` | useSkillsAssessment | SELECT, INSERT, UPDATE |
| `skill_profiles` | useSkillsAssessment | SELECT |
| `lecture_slides` | lectureSlides hooks | SELECT, INSERT, UPDATE |
| `image_generation_queue` | useBatchSlides | SELECT |
| `teaching_units` | useTeachingUnits | SELECT, INSERT, UPDATE, DELETE |
| `content_matches` | useTeachingUnits | SELECT, INSERT, DELETE |
| `content` | content-service | SELECT, INSERT |
| `content_ratings` | useContentRatings | SELECT, INSERT |
| `content_suggestions` | useContentSuggestions | SELECT, INSERT |
| `generated_curricula` | useGeneratedCurriculum | SELECT |
| `course_modules` / `modules` | useModules | SELECT, INSERT, UPDATE |
| `profiles` / `profiles_minimal` / `profiles_safe` | various | SELECT, UPDATE |
| `user_roles` | useUserRoles | SELECT |
| `certificates` | useCertificates | SELECT |
| `identity_verifications` | useIdentityVerification | SELECT |
| `instructor_verifications` | useInstructorVerification | SELECT |
| `employer_accounts` | useEmployerAccount | SELECT, INSERT |
| `employer_api_keys` | useEmployerAccount | SELECT, INSERT |
| `employer_api_requests` | useEmployerAccount | SELECT |
| `employer_webhooks` | useEmployerAccount | SELECT, INSERT |
| `demand_signals` | useDemandBoard | SELECT |
| `job_matches` | useJobMatches | SELECT |
| `consumption_records` | useConsumptionTracking | SELECT |
| `tier_limits` | useUsageStats | SELECT |
| `organizations` | useOrganization | SELECT, UPDATE |
| `organization_members` | useOrganization | SELECT |
| `organization_invitations` | useOrganization | SELECT |
| `placement_outcomes` | useOutcomes | SELECT |
| `verified_skills` | useVerifiedSkills | SELECT |
| `achievements` / `user_achievements` | useAchievements | SELECT |
| `user_xp` | useXP | SELECT |
| `quiz_challenges` | useSocialLearning | SELECT, INSERT, UPDATE |
| `community_explanations` | useSocialLearning | SELECT, INSERT |
| `explanation_votes` | useSocialLearning | SELECT, INSERT |
| `suggestion_votes` | useSuggestionVotes | SELECT, INSERT |
| `student_ratings` | useStudentRatings | SELECT, INSERT |
| `project_feedback` | useProjectFeedback | SELECT, INSERT |
| `partnership_proposals` | usePartnershipProposals | SELECT |
| `employer_interest_submissions` | useEmployerInterest | SELECT |
| `capstone_applications` | useCapstoneApplications | SELECT, INSERT |

### 2B. `projectify-syllabus` Tables Queried (19 tables/views)

| Table/View | Purpose |
|------------|---------|
| `course_profiles` | Course data (title, outcomes, location) |
| `projects` | Generated capstone projects |
| `company_profiles` | Discovered companies |
| `company_signals` | Signal scores for companies |
| `project_metadata` | Extended project data |
| `generation_runs` | Project generation history |
| `project_generation_queue` | Generation job queue |
| `syllabi` | Uploaded syllabus files |
| `profiles` | User profiles |
| `user_roles` | Role assignments |
| `demand_signals` | Employer demand data |
| `job_matches` | Job-student matches |
| `partnership_proposals` | Partnership data |
| `employer_interest_submissions` | Employer interest |
| `project_applications` | Student project applications |
| `project_feedback_analytics` | Feedback aggregation |
| `evaluations` | Project evaluations |
| `verified_competencies` | Verified student competencies |
| `dashboard_analytics` | Dashboard metrics |

---

## 3. Frontend-Backend Interaction Differences

### 3A. Capstone Projects Flow

**projectify-syllabus:**
```
Upload.tsx → parse-syllabus (edge fn) → course_profiles (DB)
Dashboard.tsx → discover-companies (edge fn) → company_profiles (DB)
Dashboard.tsx → generate-projects (edge fn) → projects (DB)
ProjectDetail.tsx → get-project-detail (edge fn) → projects (DB)
```

**syllabusstack:**
```
AddCourseForm.tsx → parse-syllabus-document (edge fn) → courses (DB)
                  → analyze-syllabus (edge fn) → capabilities (DB)
CapstoneProjectsTab.tsx → discover-companies (edge fn) → company_profiles (DB)
                        → generate-capstone-projects (edge fn) → capstone_projects (DB) + project_forms (DB)
ProjectDetailTabs.tsx → [direct DB query] → capstone_projects + project_forms (DB)
```

**Key difference:** syllabusstack queries project details directly from DB (via `useCapstoneProjects` hook) instead of through an edge function. projectify-syllabus uses `get-project-detail` edge function.

### 3B. Syllabus Processing Flow

**projectify-syllabus:**
```
1. Upload PDF → parse-syllabus (single edge fn)
   - Extracts PDF text (pdfjs-serverless)
   - Calls Lovable AI for extraction
   - Stores in course_profiles table
   - Returns parsed data + raw text
```

**syllabusstack:**
```
1. Upload PDF → parse-syllabus-document (edge fn) → extracts text only
2. Text → analyze-syllabus (edge fn) → AI capability extraction
   - Uses unified-ai-client (OpenRouter)
   - Rate limiting per user
   - Stores capabilities, keywords, course metadata
   - Updates capability_profiles aggregate
3. Orchestrated by → process-syllabus (edge fn) or useProcessSyllabus hook
```

### 3C. Assessment (syllabusstack only)

```
LearningObjectivePage.tsx
  → start-assessment (edge fn) → assessment_sessions (DB)
  → generate-assessment-questions (edge fn) → assessment_questions (DB)
  → submit-assessment-answer (edge fn) → assessment_sessions (DB)
  → complete-assessment (edge fn) → assessment_sessions (DB)
```

### 3D. Career Features (syllabusstack only)

```
CareerPath.tsx / DreamJobs.tsx
  → discover-dream-jobs (edge fn) → dream_jobs (DB)
  → analyze-dream-job (edge fn)
  → gap-analysis (edge fn) → gap_analyses (DB)
  → match-careers (edge fn) → career_matches (DB)
  → generate-recommendations (edge fn) → recommendations (DB)
```

---

## 4. Database Schema Differences (Key Tables)

| Concept | `projectify-syllabus` | `syllabusstack` |
|---------|----------------------|-----------------|
| Course data | `course_profiles` (title, level, weeks, outcomes, artifacts, city_zip, search_location) | `courses` (title, code, semester, credits, analysis_status) + `instructor_courses` (for instructor-owned courses) |
| Projects | `projects` (flat, all fields in one table) | `capstone_projects` + `project_forms` (6 normalized forms) + `capstone_milestones` |
| Companies | `company_profiles` + `company_signals` | `company_profiles` (signals embedded in same table) |
| Student skills | `verified_competencies` | `capabilities` + `skill_profiles` + `verified_skills` |
| Assessments | `evaluations` (simple) | `assessment_sessions` + `assessment_questions` + `skills_assessment_sessions` (rich) |
| Generation tracking | `generation_runs` + `project_generation_queue` | `process-generation-queue` edge fn + `image_generation_queue` table |

---

**Next: Phase 3 - AI Prompts, Models & Provider Comparison**
