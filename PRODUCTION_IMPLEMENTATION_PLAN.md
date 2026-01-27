# SyllabusStack Production Implementation Plan

## Vision Statement

Transform SyllabusStack from a feature-rich prototype into a **complete, production-ready educational platform** where:
- Students can discover their career path, identify skill gaps, learn strategically, verify competencies, and prove qualifications to employers
- Instructors can create AI-enhanced courses, track student progress, and issue verified credentials
- Employers can verify candidate qualifications with confidence
- Administrators can manage users, moderate content, and track outcomes

---

## Implementation Philosophy

### Guiding Principles
1. **Complete, Don't Delete** - Integrate orphaned features, don't remove them
2. **Close the Loops** - Every user action should have a measurable outcome
3. **Production-First** - Error handling, edge cases, and user feedback on every feature
4. **Test as We Go** - Unit tests for each completed feature
5. **Document for Users** - In-app help, tooltips, and guides

### Definition of Done (per feature)
- [ ] Feature functions end-to-end
- [ ] Error states handled gracefully
- [ ] Loading states shown appropriately
- [ ] Success feedback provided to user
- [ ] Edge cases covered
- [ ] Unit test coverage >80%
- [ ] In-app help/tooltip added
- [ ] Mobile responsive (where applicable)

---

## Phase 1: Core Pipeline Integration
**Goal:** Wire the feedback loops that make the platform valuable
**Timeline:** Sprint 1-2 (2 weeks)

### 1.1 Verified Skills Integration (Critical Path)

**Current State:** `verified_skills` table exists but is never populated or queried

**Implementation Tasks:**

#### 1.1.1 Backend: Populate verified_skills on assessment completion
```
File: supabase/functions/complete-assessment/index.ts
Changes:
- After calculating pass/fail, if passed:
  - Query learning objectives for the assessment
  - Extract skills from learning objectives
  - Insert into verified_skills with:
    - skill_name: extracted skill
    - skill_category: from learning objective category
    - proficiency_level: based on assessment score
    - verification_type: 'assessment'
    - verification_source: assessment_session_id
    - verified_at: now()
    - evidence: { assessment_id, score, passed_at }
```

#### 1.1.2 Backend: Create skill extraction helper
```
File: supabase/functions/_shared/skill-extractor.ts (NEW)
Purpose: Extract discrete skills from learning objectives
Input: learning_objective text
Output: Array of { skill_name, category, proficiency_level }
Method: Use Gemini to parse OR use keyword matching for efficiency
```

#### 1.1.3 Frontend: Display verified skills on profile
```
File: src/hooks/useVerifiedSkills.ts (NEW)
Purpose: Query verified_skills for current user
Features:
- List all verified skills with badges
- Group by category
- Show verification date and source
- Calculate total skill count for progress

File: src/components/profile/VerifiedSkillsBadges.tsx (NEW)
Purpose: Visual skill badges with verification status
```

#### 1.1.4 Frontend: Show verified skills in skill profile
```
File: src/hooks/useSkillProfile.ts
Changes:
- Query verified_skills alongside skill_profiles
- Merge assessed skills (from skills assessment) with verified skills (from courses)
- Distinguish between "assessed" and "verified" skills visually
```

#### 1.1.5 Integration: Use verified skills in gap analysis
```
File: supabase/functions/gap-analysis/index.ts
Changes:
- Query verified_skills for user before calling AI
- Include in prompt: "The user has verified these skills: [list]"
- AI should recognize verified skills and exclude from gaps
- Update gap scores based on verified competencies
```

**Acceptance Criteria:**
- [ ] Student passes assessment → skill added to verified_skills
- [ ] Verified skills appear on profile with badges
- [ ] Gap analysis recognizes and uses verified skills
- [ ] Previously "critical gap" becomes "partial overlap" when skill verified

---

### 1.2 Career Matches → Dream Jobs Connection

**Current State:** Career matches and dream jobs are parallel, disconnected systems

**Implementation Tasks:**

#### 1.2.1 Frontend: Add "Set as Dream Job" button
```
File: src/components/career-exploration/CareerMatchCard.tsx
Changes:
- Add "Add as Dream Job" button to each matched career
- On click, create dream_job with:
  - title: O*NET occupation title
  - source: 'career_match'
  - onet_code: from career match
  - match_data: full career match object
```

#### 1.2.2 Backend: Enhance analyze-dream-job for O*NET jobs
```
File: supabase/functions/analyze-dream-job/index.ts
Changes:
- Check if dream_job has onet_code
- If yes, fetch requirements from onet_occupations (already cached)
- Skip expensive AI analysis, use structured O*NET data
- Map O*NET skills/knowledge/abilities to job_requirements
```

#### 1.2.3 Frontend: Show career match score on dream jobs
```
File: src/components/dreamjobs/DreamJobCard.tsx
Changes:
- If dream_job came from career_match, show match score
- Show O*NET categories (knowledge, skills, abilities)
- Link back to full career match details
```

**Acceptance Criteria:**
- [ ] Can add career match as dream job with one click
- [ ] Dream job inherits O*NET data without AI re-analysis
- [ ] Career match score visible on dream job card

---

### 1.3 Recommendations → Courses → Completion Loop

**Current State:** Can link courses to recommendations, but completion doesn't update recommendation status

**Implementation Tasks:**

#### 1.3.1 Backend: Track course completion for recommendations
```
File: supabase/functions/track-consumption/index.ts
Changes:
- After recording consumption, check if content belongs to a linked recommendation
- If all content for a recommendation's linked course is consumed (>90%):
  - Update recommendation_course_links.completion_status = 'completed'
  - Trigger recommendation status recalculation
```

#### 1.3.2 Backend: Auto-complete recommendations when courses done
```
File: supabase/migrations/XXXXXX_recommendation_completion_trigger.sql (NEW)
Purpose: Trigger function to update recommendation status
Logic:
- When recommendation_course_links updated with completion_status = 'completed'
- Check if ALL linked courses are completed
- If yes, update recommendation.status = 'completed'
- If ANY linked course completed, update to 'in_progress'
```

#### 1.3.3 Frontend: Visual progress on recommendations
```
File: src/components/recommendations/RecommendationCard.tsx
Changes:
- Show progress bar: X of Y linked courses completed
- Show individual course completion status
- Auto-refresh when returning from course page
```

#### 1.3.4 Integration: Recommendation completion → Skill verification
```
File: supabase/functions/complete-recommendation/index.ts (NEW)
Purpose: When recommendation marked complete:
- Extract skills from recommendation text
- Add to verified_skills with verification_type = 'recommendation'
- Recalculate gap analysis for affected dream job
```

**Acceptance Criteria:**
- [ ] Watching linked course content updates recommendation progress
- [ ] Completing all linked courses auto-completes recommendation
- [ ] Completing recommendation creates verified skills
- [ ] Dream job gap analysis automatically updates

---

### 1.4 Discovered Careers Integration

**Current State:** `discovered_careers` table exists but is never queried

**Implementation Tasks:**

#### 1.4.1 Backend: Populate discovered_careers
```
File: supabase/functions/discover-dream-jobs/index.ts
Changes:
- After AI suggests careers, cache results in discovered_careers
- Store: career_title, source, match_score, requirements_summary, suggested_at
```

#### 1.4.2 Frontend: Show discovered careers on career page
```
File: src/pages/CareerPath.tsx
Changes:
- Add "AI-Discovered Careers" section
- Query discovered_careers for user
- Show as cards with "Explore" and "Add as Dream Job" buttons
- Allow dismissing suggestions (update discovered_careers.dismissed = true)
```

**Acceptance Criteria:**
- [ ] AI career suggestions cached in discovered_careers
- [ ] Discovered careers visible on career page
- [ ] Can add discovered career as dream job
- [ ] Can dismiss unwanted suggestions

---

## Phase 2: User Journey Completion
**Goal:** Complete every user journey from onboarding to deliverables
**Timeline:** Sprint 3-5 (3 weeks)

### 2.1 Student Journey Completion

#### 2.1.1 Onboarding Flow Enhancement

**Current State:** Basic signup, no guided onboarding

**Implementation:**
```
File: src/pages/Onboarding.tsx (ENHANCE)
Features:
- Step 1: Welcome + role selection (student/instructor)
- Step 2: For students - "What's your goal?"
  - [ ] Get a job
  - [ ] Change careers
  - [ ] Learn for growth
  - [ ] Explore options
- Step 3: Quick skills assessment (10 questions, not full 54/103)
- Step 4: Add your courses OR upload transcript
- Step 5: Set your first dream job (or skip)
- Step 6: Dashboard tour with tooltips

File: src/hooks/useOnboardingProgress.ts (NEW)
Purpose: Track onboarding completion, show prompts for incomplete steps
```

#### 2.1.2 Learning Path Visualization

**Current State:** Course list exists, but no visual path

**Implementation:**
```
File: src/components/student/LearningPathVisualization.tsx (NEW)
Features:
- Visual flowchart showing:
  - Completed courses (green)
  - Current courses (blue, with progress)
  - Recommended courses (gray, dashed)
- Connections showing prerequisites
- Dream job at the end as "destination"
- Clickable nodes navigate to course/recommendation

File: src/pages/LearningPath.tsx (NEW)
Route: /learning-path
Purpose: Full-page interactive learning path view
```

#### 2.1.3 Progress Dashboard Completion

**Current State:** Progress page exists but sparse

**Implementation:**
```
File: src/pages/Progress.tsx (ENHANCE)
Additions:
- Career Readiness Score (% of dream job requirements met)
- Skills Progress:
  - Total skills verified
  - Skills gained this month
  - Skills needed for dream job
- Course Progress:
  - Courses completed
  - Hours learned
  - Assessments passed
- Recommendations Progress:
  - Total recommendations
  - Completed / In Progress / Not Started
- Certificates earned
- Streak/consistency tracking (gamification)
```

#### 2.1.4 Notification System for Students

**Implementation:**
```
File: src/hooks/useNotifications.ts (NEW)
File: src/components/common/NotificationBell.tsx (NEW)
File: src/components/common/NotificationDrawer.tsx (NEW)

Notification Types:
- "Your gap analysis is ready"
- "New recommendation: [skill]"
- "You're 80% ready for [dream job]!"
- "Complete [course] to earn [skill] badge"
- "New content added to [enrolled course]"
- "[X] employers viewed your profile" (if public)
```

---

### 2.2 Instructor Journey Completion

#### 2.2.1 Student Analytics Dashboard

**Current State:** Can see enrollments but no analytics

**Implementation:**
```
File: src/pages/instructor/CourseAnalytics.tsx (NEW)
Route: /instructor/courses/:id/analytics
Features:
- Total enrolled students
- Active students (accessed in last 7 days)
- Completion rate by module
- Average assessment scores
- Time spent per learning objective
- Drop-off points (where students stop)
- Content engagement (which videos watched most)

File: src/hooks/useInstructorAnalytics.ts (NEW)
Purpose: Aggregate analytics from consumption_records, assessment_sessions
```

#### 2.2.2 Gradebook

**Current State:** No gradebook functionality

**Implementation:**
```
File: src/pages/instructor/Gradebook.tsx (NEW)
Route: /instructor/courses/:id/gradebook
Features:
- Table: Student | Progress | Assessment Scores | Last Active | Actions
- Sort by any column
- Filter by: all / struggling / on-track / completed
- Export to CSV
- Bulk actions: send reminder, mark complete, issue certificate

File: src/components/instructor/GradebookTable.tsx (NEW)
File: src/hooks/useGradebook.ts (NEW)
```

#### 2.2.3 Student Communication

**Implementation:**
```
File: src/components/instructor/StudentMessageDialog.tsx (NEW)
Features:
- Send message to individual student
- Send bulk message to all enrolled
- Templates for common messages:
  - "Welcome to the course"
  - "Reminder: Assessment due"
  - "Congratulations on completion"
- Message history

File: supabase/functions/send-student-message/index.ts (NEW)
Purpose: Send email to enrolled students
```

#### 2.2.4 Content Moderation Notifications

**Implementation:**
```
File: src/hooks/useInstructorNotifications.ts (NEW)
Notifications:
- "Your content was flagged for review: [reason]"
- "Content review completed: [approved/action needed]"
- "New student enrolled in [course]"
- "Student completed [course]"
```

---

### 2.3 Employer Journey Completion

#### 2.3.1 Verification Dashboard Enhancement

**Current State:** Basic verification exists

**Implementation:**
```
File: src/pages/employer/VerificationDashboard.tsx (ENHANCE)
Features:
- Verification search (by certificate number, student email, skill)
- Recent verifications list
- Verification statistics:
  - Total verifications this month
  - Unique candidates verified
  - Most common skills verified
- Batch verification upload (CSV)
- API documentation link

File: src/components/employer/BatchVerificationUpload.tsx (NEW)
Purpose: Upload CSV of certificate numbers for bulk verification
```

#### 2.3.2 Candidate Discovery (Optional Premium Feature)

**Implementation:**
```
File: src/pages/employer/CandidateSearch.tsx (NEW)
Route: /employer/candidates
Features:
- Search by skills
- Filter by: verified skills, location, availability
- View candidate skill profiles (if public)
- Contact request (sends notification to student)
- Note: Requires student opt-in for visibility
```

#### 2.3.3 Webhooks for Real-Time Verification

**Implementation:**
```
File: src/pages/employer/WebhookSettings.tsx (NEW)
Features:
- Configure webhook URL
- Select events: certificate_issued, skill_verified, course_completed
- Webhook secret for validation
- Test webhook button
- Delivery logs

File: supabase/functions/send-employer-webhook/index.ts (NEW)
Purpose: Send webhook payloads to employer endpoints
```

---

### 2.4 Admin Journey Completion

#### 2.4.1 Outcomes Dashboard

**Current State:** OutcomesReport.tsx exists but minimal

**Implementation:**
```
File: src/pages/admin/OutcomesReport.tsx (ENHANCE)
Metrics:
- Platform Health:
  - Total users (students/instructors/employers)
  - Active users (7-day, 30-day)
  - New signups trend
- Learning Outcomes:
  - Courses completed
  - Skills verified
  - Certificates issued
  - Average completion rate
- Career Outcomes:
  - Dream jobs set
  - Gap analyses completed
  - Career matches found
- Instructor Metrics:
  - Courses published
  - Total enrollments
  - Content generated (slides, assessments)
- Revenue (if applicable):
  - Subscriptions
  - Certificate purchases

File: src/hooks/useAdminAnalytics.ts (NEW)
Purpose: Aggregate platform-wide analytics
```

#### 2.4.2 User Management Enhancement

**Implementation:**
```
File: src/pages/admin/UserManagement.tsx (ENHANCE)
Features:
- Advanced search (name, email, role, status)
- Bulk role assignment
- Bulk status change (active/suspended)
- User activity log
- Impersonation for support (careful: audit logged)
- Export users to CSV
```

#### 2.4.3 System Health Monitoring

**Implementation:**
```
File: src/pages/admin/SystemHealth.tsx (NEW)
Features:
- Edge function status (success rate, latency)
- Database connection health
- AI API usage and costs
- Error log summary
- Batch job status
- Storage usage
```

---

## Phase 3: Support & Help Systems
**Goal:** Make the platform self-service friendly with comprehensive help
**Timeline:** Sprint 6 (1 week)

### 3.1 In-App Help System

#### 3.1.1 Contextual Tooltips

**Implementation:**
```
File: src/components/common/HelpTooltip.tsx (NEW)
Usage: <HelpTooltip topic="skills-assessment">What's this?</HelpTooltip>
Features:
- Icon trigger (? or info icon)
- Contextual help text
- Link to full documentation
- "Don't show again" option

Help Topics to Create:
- Skills Assessment: What it measures, why it matters
- Gap Analysis: How gaps are calculated
- Recommendations: How they're generated
- Verified Skills: What counts as verified
- Dream Jobs: How matching works
- Certificates: How verification works
```

#### 3.1.2 Interactive Tours

**Implementation:**
```
File: src/components/common/ProductTour.tsx (NEW)
Library: Use react-joyride or shepherd.js
Tours:
- First-time student tour (dashboard, courses, career)
- First-time instructor tour (course creation, content)
- Feature discovery tours (triggered on new features)
```

#### 3.1.3 Help Center

**Implementation:**
```
File: src/pages/HelpCenter.tsx (NEW)
Route: /help
Features:
- Searchable FAQ
- Video tutorials (embedded)
- Step-by-step guides
- Contact support form
- Feedback submission

File: src/pages/HelpArticle.tsx (NEW)
Route: /help/:article-slug
Purpose: Individual help article display
```

### 3.2 Error Handling & User Feedback

#### 3.2.1 Global Error Boundary Enhancement

**Implementation:**
```
File: src/components/common/ErrorBoundary.tsx (ENHANCE)
Features:
- Friendly error message
- "Report this issue" button
- Retry action
- Return to dashboard link
- Error details (collapsible for power users)
```

#### 3.2.2 API Error Handling Standardization

**Implementation:**
```
File: src/lib/api-error-handler.ts (NEW)
Purpose: Standardized error handling for all API calls
Features:
- Categorize errors (auth, validation, server, network)
- User-friendly messages for each category
- Auto-retry for transient failures
- Toast notifications with action buttons

Standard Messages:
- Network: "Connection lost. Retrying..."
- Auth: "Session expired. Please log in again."
- Validation: "[Specific field error]"
- Server: "Something went wrong. We've been notified."
- Rate limit: "Too many requests. Please wait."
```

#### 3.2.3 Loading States Audit

**Implementation:**
- Audit all pages for loading states
- Replace "Loading..." text with skeletons
- Add progress indicators for long operations
- Ensure every async action has visual feedback

### 3.3 Feedback & Support

#### 3.3.1 In-App Feedback Widget

**Implementation:**
```
File: src/components/common/FeedbackWidget.tsx (NEW)
Features:
- Floating button (bottom-right)
- Quick feedback types: Bug, Suggestion, Question
- Optional screenshot capture
- Automatic context (current page, user info)
- Submit to support system (or email)
```

#### 3.3.2 NPS/Satisfaction Surveys

**Implementation:**
```
File: src/components/common/SatisfactionSurvey.tsx (NEW)
Triggers:
- After completing first course
- After passing assessment
- After 30 days of usage
Features:
- NPS question (0-10 scale)
- Optional follow-up
- Dismiss/remind later
```

---

## Phase 4: Production Hardening
**Goal:** Ensure reliability, security, and scalability
**Timeline:** Sprint 7-8 (2 weeks)

### 4.1 Testing Implementation

#### 4.1.1 Unit Test Coverage (Target: 80%)

**Priority Test Files:**
```
src/hooks/useVerifiedSkills.test.ts
src/hooks/useGapAnalysis.test.ts
src/hooks/useRecommendations.test.ts
src/hooks/useCareerMatches.test.ts
src/hooks/useAssessment.test.ts
src/hooks/useCourseProgress.test.ts
src/components/student/*.test.tsx
src/components/instructor/*.test.tsx
supabase/functions/*/index.test.ts
```

#### 4.1.2 Integration Tests

**Test Scenarios:**
```
tests/integration/student-journey.test.ts
- Signup → Onboarding → Add Course → Complete Assessment → Verify Skill → Update Gap

tests/integration/instructor-journey.test.ts
- Create Course → Add Content → Publish → Student Enrolls → View Analytics

tests/integration/verification-flow.test.ts
- Student Earns Certificate → Employer Verifies → Webhook Sent
```

#### 4.1.3 E2E Tests

**Implementation:**
```
Use: Playwright or Cypress
tests/e2e/
- student-complete-course.spec.ts
- instructor-create-course.spec.ts
- employer-verify-certificate.spec.ts
- admin-moderate-content.spec.ts
```

### 4.2 Security Hardening

#### 4.2.1 Rate Limiting

**Implementation:**
```
File: supabase/functions/_shared/rate-limiter.ts (NEW)
Limits:
- AI functions: 10 requests/minute per user
- Search functions: 30 requests/minute per user
- Auth functions: 5 attempts/minute per IP
- Employer API: Based on tier (100-10000/day)
```

#### 4.2.2 Input Validation Audit

**Implementation:**
- Audit all edge functions for input validation
- Use Zod schemas for all inputs
- Sanitize all user-provided text before AI prompts
- Validate file uploads (size, type, content)

#### 4.2.3 RLS Policy Audit

**Implementation:**
- Review all 73 tables for RLS policies
- Ensure no data leakage between users
- Test with different user roles
- Document any intentional public access

### 4.3 Performance Optimization

#### 4.3.1 Database Indexes

**Implementation:**
```sql
-- Audit and add missing indexes for common queries
CREATE INDEX IF NOT EXISTS idx_verified_skills_user ON verified_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_consumption_records_user_content ON consumption_records(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_dreamjob ON recommendations(dream_job_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user ON assessment_sessions(user_id, status);
```

#### 4.3.2 Query Optimization

**Implementation:**
- Add database views for complex queries
- Implement cursor-based pagination
- Add result caching for expensive queries
- Use materialized views for analytics

#### 4.3.3 Frontend Performance

**Implementation:**
- Audit bundle size (target: <500KB initial)
- Implement code splitting for routes
- Lazy load heavy components
- Optimize images (WebP, lazy loading)
- Add service worker for offline support

### 4.4 Monitoring & Alerting

#### 4.4.1 Error Tracking

**Implementation:**
```
Integrate: Sentry or similar
File: src/lib/error-tracking.ts (NEW)
Features:
- Automatic error capture
- User context attachment
- Performance monitoring
- Release tracking
```

#### 4.4.2 Application Monitoring

**Implementation:**
```
Metrics to track:
- Page load times
- API response times
- Error rates by function
- User session duration
- Feature usage (analytics events)
```

#### 4.4.3 Alerting Rules

**Implementation:**
```
Alerts:
- Error rate > 5% for 5 minutes
- API latency > 3s for 5 minutes
- Database connection failures
- AI API quota exhaustion (warning at 80%)
- Failed payment webhooks
```

---

## Phase 5: Documentation & Launch Prep
**Goal:** Ensure maintainability and successful launch
**Timeline:** Sprint 9 (1 week)

### 5.1 Technical Documentation

#### 5.1.1 Architecture Documentation

**Files to Create/Update:**
```
docs/architecture/
  - overview.md (system diagram, tech stack)
  - database-schema.md (ERD, key relationships)
  - api-reference.md (all edge functions)
  - frontend-structure.md (component hierarchy)
  - deployment.md (CI/CD, environments)
```

#### 5.1.2 API Documentation

**Implementation:**
```
docs/api/
  - authentication.md
  - student-api.md
  - instructor-api.md
  - employer-api.md
  - webhooks.md

Consider: Generate OpenAPI spec from edge functions
```

### 5.2 User Documentation

#### 5.2.1 User Guides

**Files to Create:**
```
Help Center Content:
- Getting Started (Student)
- Getting Started (Instructor)
- Getting Started (Employer)
- Skills Assessment Guide
- Career Planning Guide
- Course Creation Guide
- Certificate Verification Guide
- FAQ
```

#### 5.2.2 Video Tutorials

**Videos to Create:**
```
- Welcome to SyllabusStack (2 min)
- Taking the Skills Assessment (3 min)
- Setting Your Dream Job (2 min)
- Understanding Gap Analysis (3 min)
- Creating Your First Course (5 min)
- Verifying Certificates (2 min)
```

### 5.3 Launch Checklist

#### 5.3.1 Pre-Launch

```
[ ] All Phase 1-4 features complete
[ ] Test coverage >80%
[ ] Security audit passed
[ ] Performance benchmarks met
[ ] Error tracking configured
[ ] Backup/restore tested
[ ] Terms of Service updated
[ ] Privacy Policy updated
[ ] Support email configured
[ ] Feedback system active
```

#### 5.3.2 Launch Day

```
[ ] Database backed up
[ ] Monitoring dashboards ready
[ ] Support team briefed
[ ] Social media announcements queued
[ ] Email campaign ready
[ ] Rollback plan documented
```

#### 5.3.3 Post-Launch

```
[ ] Monitor error rates (first 24 hours)
[ ] Review user feedback
[ ] Check performance under load
[ ] Address critical bugs immediately
[ ] Daily standup for first week
```

---

## Implementation Timeline Summary

| Sprint | Phase | Focus | Duration |
|--------|-------|-------|----------|
| 1-2 | Phase 1 | Core Pipeline Integration | 2 weeks |
| 3-5 | Phase 2 | User Journey Completion | 3 weeks |
| 6 | Phase 3 | Support & Help Systems | 1 week |
| 7-8 | Phase 4 | Production Hardening | 2 weeks |
| 9 | Phase 5 | Documentation & Launch | 1 week |

**Total Timeline: 9 weeks**

---

## Resource Requirements

### Development
- 1-2 Full-stack developers (primary)
- 1 QA engineer (part-time, sprints 7-8)
- 1 Technical writer (sprint 9)

### Infrastructure
- Current Supabase plan adequate
- Consider: Sentry for error tracking ($26/mo)
- Consider: Analytics service (Mixpanel/Amplitude)

### External Services
- Gemini AI API (existing)
- Stripe (existing)
- Persona/Onfido IDV (existing)
- Email service (existing)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI API costs increase | Implement caching, use batch processing |
| User data privacy concerns | Regular security audits, clear privacy policy |
| Feature creep delays launch | Strict scope control, MVP first |
| Performance issues at scale | Load testing before launch |
| Integration bugs | Comprehensive testing, staged rollout |

---

## Success Metrics

### Launch Criteria (Must Have)
- [ ] Student can complete full journey (onboard → learn → verify → certificate)
- [ ] Instructor can create and publish course
- [ ] Employer can verify certificate
- [ ] Admin can manage users and content
- [ ] Test coverage >80%
- [ ] No P0/P1 bugs

### Success Metrics (Track Post-Launch)
- Student activation: % completing onboarding
- Course completion rate
- Skills verified per student
- Employer verifications per month
- NPS score
- Time to first dream job match

---

## Appendix A: Database Changes Required

### New Tables
None required - using existing tables

### Table Modifications
```sql
-- Add completion tracking to recommendations
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS completion_progress DECIMAL(5,2) DEFAULT 0;

-- Add onboarding tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
```

### New Views
```sql
-- Student progress summary view
CREATE VIEW student_progress_summary AS
SELECT
  p.id as user_id,
  COUNT(DISTINCT vs.id) as verified_skills_count,
  COUNT(DISTINCT cr.id) FILTER (WHERE cr.is_verified) as completed_content,
  COUNT(DISTINCT c.id) as certificates_earned,
  COUNT(DISTINCT dj.id) as dream_jobs_set,
  MAX(ga.readiness_level) as best_readiness
FROM profiles p
LEFT JOIN verified_skills vs ON vs.user_id = p.id
LEFT JOIN consumption_records cr ON cr.user_id = p.id
LEFT JOIN certificates c ON c.user_id = p.id
LEFT JOIN dream_jobs dj ON dj.user_id = p.id
LEFT JOIN gap_analyses ga ON ga.dream_job_id = dj.id
GROUP BY p.id;
```

---

## Appendix B: Files to Create Summary

### New Files (29 total)
```
# Phase 1 (7 files)
supabase/functions/_shared/skill-extractor.ts
src/hooks/useVerifiedSkills.ts
src/components/profile/VerifiedSkillsBadges.tsx
supabase/functions/complete-recommendation/index.ts
supabase/migrations/XXXXXX_recommendation_completion_trigger.sql

# Phase 2 (14 files)
src/hooks/useOnboardingProgress.ts
src/components/student/LearningPathVisualization.tsx
src/pages/LearningPath.tsx
src/hooks/useNotifications.ts
src/components/common/NotificationBell.tsx
src/components/common/NotificationDrawer.tsx
src/pages/instructor/CourseAnalytics.tsx
src/hooks/useInstructorAnalytics.ts
src/pages/instructor/Gradebook.tsx
src/components/instructor/GradebookTable.tsx
src/hooks/useGradebook.ts
src/components/instructor/StudentMessageDialog.tsx
supabase/functions/send-student-message/index.ts
src/hooks/useInstructorNotifications.ts
src/components/employer/BatchVerificationUpload.tsx
src/pages/employer/CandidateSearch.tsx
src/pages/employer/WebhookSettings.tsx
supabase/functions/send-employer-webhook/index.ts
src/hooks/useAdminAnalytics.ts
src/pages/admin/SystemHealth.tsx

# Phase 3 (5 files)
src/components/common/HelpTooltip.tsx
src/components/common/ProductTour.tsx
src/pages/HelpCenter.tsx
src/pages/HelpArticle.tsx
src/lib/api-error-handler.ts
src/components/common/FeedbackWidget.tsx
src/components/common/SatisfactionSurvey.tsx

# Phase 4 (3 files)
supabase/functions/_shared/rate-limiter.ts
src/lib/error-tracking.ts
```

### Files to Enhance (15 total)
```
supabase/functions/complete-assessment/index.ts
src/hooks/useSkillProfile.ts
supabase/functions/gap-analysis/index.ts
src/components/career-exploration/CareerMatchCard.tsx
supabase/functions/analyze-dream-job/index.ts
src/components/dreamjobs/DreamJobCard.tsx
supabase/functions/track-consumption/index.ts
src/components/recommendations/RecommendationCard.tsx
supabase/functions/discover-dream-jobs/index.ts
src/pages/CareerPath.tsx
src/pages/Onboarding.tsx
src/pages/Progress.tsx
src/pages/admin/OutcomesReport.tsx
src/pages/admin/UserManagement.tsx
src/components/common/ErrorBoundary.tsx
```

---

## Appendix C: Test Files to Create

```
# Unit Tests
src/hooks/__tests__/useVerifiedSkills.test.ts
src/hooks/__tests__/useGapAnalysis.test.ts
src/hooks/__tests__/useRecommendations.test.ts
src/hooks/__tests__/useCareerMatches.test.ts
src/hooks/__tests__/useAssessment.test.ts
src/hooks/__tests__/useCourseProgress.test.ts

# Integration Tests
tests/integration/student-journey.test.ts
tests/integration/instructor-journey.test.ts
tests/integration/verification-flow.test.ts

# E2E Tests
tests/e2e/student-complete-course.spec.ts
tests/e2e/instructor-create-course.spec.ts
tests/e2e/employer-verify-certificate.spec.ts
tests/e2e/admin-moderate-content.spec.ts
```

---

*This document serves as the complete implementation roadmap for SyllabusStack production release.*
