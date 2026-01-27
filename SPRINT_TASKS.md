# Sprint Task Breakdown

## Quick Reference: What Gets Done When

### Sprint Status

| Sprint | Status | Completed Date |
|--------|--------|----------------|
| Sprint 1 | COMPLETED | 2026-01-27 |
| Sprint 2 | COMPLETED | 2026-01-27 |
| Sprint 3 | COMPLETED | 2026-01-27 |
| Sprint 4 | COMPLETED | 2026-01-27 |
| Sprint 5 | COMPLETED | 2026-01-27 |
| Sprint 6 | COMPLETED | 2026-01-27 |
| Sprint 7 | COMPLETED | 2026-01-27 |
| Sprint 8 | Pending | - |
| Sprint 9 | Pending | - |

---

## Sprint 1: Verified Skills Loop (Week 1) - COMPLETED

### Goal: When students pass assessments, skills get verified and feed into gap analysis

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Create skill-extractor helper | Backend | `_shared/skill-extractor.ts` | 4h | None |
| Modify complete-assessment to record skills | Backend | `complete-assessment/index.ts` | 4h | skill-extractor |
| Create useVerifiedSkills hook | Frontend | `hooks/useVerifiedSkills.ts` | 3h | None |
| Create VerifiedSkillsBadges component | Frontend | `components/profile/VerifiedSkillsBadges.tsx` | 4h | useVerifiedSkills |
| Update useSkillProfile to include verified | Frontend | `hooks/useSkillProfile.ts` | 2h | useVerifiedSkills |
| Modify gap-analysis to use verified skills | Backend | `gap-analysis/index.ts` | 4h | skill records exist |
| Write unit tests | Test | `useVerifiedSkills.test.ts` | 3h | All above |

**Sprint 1 Deliverable:** Student passes assessment → skill badge appears → gap analysis recognizes it

---

## Sprint 2: Career-Dream Job Connection (Week 2)

### Goal: Career matches can become dream jobs, unified skill view

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Add "Set as Dream Job" to CareerMatchCard | Frontend | `CareerMatchCard.tsx` | 2h | None |
| Create dream job from career match | Frontend | `useDreamJobs.ts` | 3h | None |
| Enhance analyze-dream-job for O*NET | Backend | `analyze-dream-job/index.ts` | 4h | None |
| Show match score on DreamJobCard | Frontend | `DreamJobCard.tsx` | 2h | None |
| Populate discovered_careers on discovery | Backend | `discover-dream-jobs/index.ts` | 3h | None |
| Show discovered careers on CareerPath | Frontend | `CareerPath.tsx` | 4h | discover-dream-jobs |
| Wire recommendation completion tracking | Backend | `track-consumption/index.ts` | 4h | None |
| Create recommendation completion trigger | DB | Migration file | 2h | track-consumption |
| Update RecommendationCard progress UI | Frontend | `RecommendationCard.tsx` | 3h | completion trigger |

**Sprint 2 Deliverable:** Unified career → dream job flow, recommendations update when courses complete

---

## Sprint 3: Student Journey Polish (Week 3)

### Goal: Complete onboarding, progress tracking, notifications

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Create useOnboardingProgress hook | Frontend | `hooks/useOnboardingProgress.ts` | 3h | None |
| Enhance Onboarding page with steps | Frontend | `pages/Onboarding.tsx` | 6h | useOnboardingProgress |
| Create LearningPathVisualization | Frontend | `components/student/LearningPathVisualization.tsx` | 8h | None |
| Create LearningPath page | Frontend | `pages/LearningPath.tsx` | 4h | LearningPathVisualization |
| Enhance Progress page with metrics | Frontend | `pages/Progress.tsx` | 6h | verified skills |
| Create useNotifications hook | Frontend | `hooks/useNotifications.ts` | 4h | None |
| Create NotificationBell component | Frontend | `components/common/NotificationBell.tsx` | 3h | useNotifications |
| Create NotificationDrawer component | Frontend | `components/common/NotificationDrawer.tsx` | 4h | useNotifications |
| Add notifications to Header | Frontend | `components/common/Header.tsx` | 1h | NotificationBell |

**Sprint 3 Deliverable:** Guided onboarding, visual learning path, progress dashboard, notification system

---

## Sprint 4: Instructor Analytics (Week 4)

### Goal: Instructors can track student progress, communicate with students

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Create useInstructorAnalytics hook | Frontend | `hooks/useInstructorAnalytics.ts` | 4h | None |
| Create CourseAnalytics page | Frontend | `pages/instructor/CourseAnalytics.tsx` | 8h | useInstructorAnalytics |
| Create useGradebook hook | Frontend | `hooks/useGradebook.ts` | 4h | None |
| Create GradebookTable component | Frontend | `components/instructor/GradebookTable.tsx` | 6h | useGradebook |
| Create Gradebook page | Frontend | `pages/instructor/Gradebook.tsx` | 4h | GradebookTable |
| Create send-student-message function | Backend | `send-student-message/index.ts` | 4h | None |
| Create StudentMessageDialog | Frontend | `components/instructor/StudentMessageDialog.tsx` | 4h | send-student-message |
| Create useInstructorNotifications | Frontend | `hooks/useInstructorNotifications.ts` | 3h | None |
| Update instructor routes | Frontend | `App.tsx` | 1h | All pages |

**Sprint 4 Deliverable:** Instructor analytics dashboard, gradebook, student messaging

---

## Sprint 5: Employer & Admin Completion (Week 5)

### Goal: Complete employer verification features, admin outcomes dashboard

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Enhance VerificationDashboard | Frontend | `employer/VerificationDashboard.tsx` | 4h | None |
| Create BatchVerificationUpload | Frontend | `components/employer/BatchVerificationUpload.tsx` | 6h | None |
| Create WebhookSettings page | Frontend | `pages/employer/WebhookSettings.tsx` | 6h | None |
| Create send-employer-webhook function | Backend | `send-employer-webhook/index.ts` | 4h | None |
| Create useAdminAnalytics hook | Frontend | `hooks/useAdminAnalytics.ts` | 4h | None |
| Enhance OutcomesReport | Frontend | `pages/admin/OutcomesReport.tsx` | 6h | useAdminAnalytics |
| Enhance UserManagement | Frontend | `pages/admin/UserManagement.tsx` | 4h | None |
| Create SystemHealth page | Frontend | `pages/admin/SystemHealth.tsx` | 6h | None |

**Sprint 5 Deliverable:** Complete employer verification suite, admin analytics and monitoring

---

## Sprint 6: Help & Support Systems (Week 6)

### Goal: In-app help, tooltips, error handling, feedback

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Create HelpTooltip component | Frontend | `components/common/HelpTooltip.tsx` | 3h | None |
| Add tooltips across app | Frontend | Multiple files | 4h | HelpTooltip |
| Create ProductTour component | Frontend | `components/common/ProductTour.tsx` | 6h | None |
| Add tours to key pages | Frontend | Multiple files | 4h | ProductTour |
| Create HelpCenter page | Frontend | `pages/HelpCenter.tsx` | 6h | None |
| Create HelpArticle page | Frontend | `pages/HelpArticle.tsx` | 3h | HelpCenter |
| Write help content | Content | Database/files | 8h | HelpArticle |
| Create api-error-handler | Frontend | `lib/api-error-handler.ts` | 4h | None |
| Enhance ErrorBoundary | Frontend | `components/common/ErrorBoundary.tsx` | 3h | None |
| Create FeedbackWidget | Frontend | `components/common/FeedbackWidget.tsx` | 4h | None |
| Create SatisfactionSurvey | Frontend | `components/common/SatisfactionSurvey.tsx` | 3h | None |

**Sprint 6 Deliverable:** Complete help system, product tours, feedback collection

---

## Sprint 7: Testing (Week 7)

### Goal: >80% test coverage on critical paths

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Unit tests: useVerifiedSkills | Test | `__tests__/useVerifiedSkills.test.ts` | 4h | Hook complete |
| Unit tests: useGapAnalysis | Test | `__tests__/useGapAnalysis.test.ts` | 4h | Hook complete |
| Unit tests: useRecommendations | Test | `__tests__/useRecommendations.test.ts` | 4h | Hook complete |
| Unit tests: useCareerMatches | Test | `__tests__/useCareerMatches.test.ts` | 4h | Hook complete |
| Unit tests: useAssessment | Test | `__tests__/useAssessment.test.ts` | 4h | Hook complete |
| Unit tests: useCourseProgress | Test | `__tests__/useCourseProgress.test.ts` | 4h | Hook complete |
| Integration: student-journey | Test | `integration/student-journey.test.ts` | 8h | All student features |
| Integration: instructor-journey | Test | `integration/instructor-journey.test.ts` | 6h | All instructor features |
| Integration: verification-flow | Test | `integration/verification-flow.test.ts` | 4h | Employer features |
| E2E setup and basic tests | Test | `e2e/*.spec.ts` | 8h | All features |

**Sprint 7 Deliverable:** Comprehensive test suite, >80% coverage

---

## Sprint 8: Security & Performance (Week 8)

### Goal: Production-ready security and performance

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Create rate-limiter shared module | Backend | `_shared/rate-limiter.ts` | 4h | None |
| Apply rate limiting to AI functions | Backend | Multiple functions | 4h | rate-limiter |
| Input validation audit | Backend | All functions | 8h | None |
| RLS policy audit | DB | Review all tables | 6h | None |
| Add missing database indexes | DB | Migration file | 3h | None |
| Query optimization audit | DB | Views and queries | 6h | None |
| Frontend bundle optimization | Frontend | Vite config | 4h | None |
| Create error-tracking integration | Frontend | `lib/error-tracking.ts` | 4h | None |
| Configure monitoring dashboards | Ops | Supabase/external | 4h | None |
| Set up alerting rules | Ops | Monitoring tool | 3h | Dashboards |

**Sprint 8 Deliverable:** Hardened security, optimized performance, monitoring active

---

## Sprint 9: Documentation & Launch (Week 9)

### Goal: Complete documentation, launch readiness

| Task | Type | File | Effort | Dependencies |
|------|------|------|--------|--------------|
| Update architecture documentation | Docs | `docs/architecture/*.md` | 8h | All features |
| Create API documentation | Docs | `docs/api/*.md` | 8h | All functions |
| Write user guides | Docs | Help center content | 8h | HelpCenter |
| Create video tutorial scripts | Docs | Scripts/outlines | 4h | None |
| Pre-launch checklist verification | QA | Manual testing | 8h | All features |
| Backup and recovery testing | Ops | Procedures | 4h | None |
| Launch day preparation | Ops | Runbook | 4h | All above |

**Sprint 9 Deliverable:** Complete documentation, launch-ready system

---

## Effort Summary

| Sprint | Focus | Total Hours | Key Deliverable |
|--------|-------|-------------|-----------------|
| 1 | Verified Skills | 24h | Skills verification loop |
| 2 | Career Connection | 27h | Unified career system |
| 3 | Student Journey | 39h | Onboarding + progress |
| 4 | Instructor Analytics | 38h | Gradebook + messaging |
| 5 | Employer + Admin | 40h | Complete all roles |
| 6 | Help Systems | 48h | In-app help + feedback |
| 7 | Testing | 50h | >80% coverage |
| 8 | Security + Perf | 46h | Production hardening |
| 9 | Docs + Launch | 44h | Launch ready |

**Total: ~356 hours across 9 weeks**

---

## Quick Start: Sprint 1, Task 1

```bash
# Create the skill extractor helper
mkdir -p supabase/functions/_shared

# File: supabase/functions/_shared/skill-extractor.ts
```

```typescript
// Skill extractor implementation
export interface ExtractedSkill {
  skill_name: string;
  skill_category: string;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export async function extractSkillsFromLearningObjective(
  objectiveText: string,
  objectiveBloomLevel?: string
): Promise<ExtractedSkill[]> {
  // Map Bloom levels to proficiency
  const bloomToProficiency: Record<string, ExtractedSkill['proficiency_level']> = {
    'remember': 'beginner',
    'understand': 'beginner',
    'apply': 'intermediate',
    'analyze': 'intermediate',
    'evaluate': 'advanced',
    'create': 'expert'
  };

  // Extract skill from objective (simple keyword extraction)
  // For production, use AI to extract more nuanced skills
  const skillKeywords = extractKeywords(objectiveText);

  return skillKeywords.map(keyword => ({
    skill_name: keyword,
    skill_category: 'technical', // Could be enhanced with AI classification
    proficiency_level: bloomToProficiency[objectiveBloomLevel?.toLowerCase() || 'apply'] || 'intermediate'
  }));
}

function extractKeywords(text: string): string[] {
  // Simple extraction - replace with AI for production
  const stopWords = new Set(['the', 'a', 'an', 'to', 'for', 'of', 'and', 'or', 'in', 'on', 'at', 'by']);
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5); // Top 5 keywords as skills
}
```

---

## Definition of Done Checklist

Copy this for each task:

```
[ ] Code complete and compiles
[ ] Unit tests written and passing
[ ] Error handling implemented
[ ] Loading states added
[ ] Success feedback shown to user
[ ] Edge cases handled
[ ] Code reviewed (self or peer)
[ ] Documentation updated if needed
[ ] Deployed to staging
[ ] Manual testing passed
```
