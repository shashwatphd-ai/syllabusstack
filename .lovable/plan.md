
# PRD: Merge EduThree1 into SyllabusStack — Implementation Progress

## Completed (Phases 1-4, 6)

### Phase 1: Notification System ✅
- `src/contexts/NotificationContext.tsx` — In-memory notification state with add/read/clear
- `src/hooks/useRealtimeNotifications.ts` — Realtime Postgres subscriptions for student apps + instructor generation
- `src/components/common/RealtimeNotificationListener.tsx` — Invisible component to wire subscriptions

### Phase 2: Signal Visualization ✅
- `src/components/capstone/signals/types.ts` — Signal types + mappers
- `src/components/capstone/signals/SignalScoreCard.tsx` — Single signal score display
- `src/components/capstone/signals/EvidenceBasedSignalCard.tsx` — Evidence-based signal with methodology
- `src/components/capstone/signals/SignalBreakdownGrid.tsx` — 4-signal grid layout
- `src/components/capstone/signals/CompactSignalIndicator.tsx` — Badge-style composite score
- `src/components/capstone/signals/MatchInsightsCard.tsx` — Student-facing "Why This Match?"
- `src/components/capstone/signals/ProfessionalSignalDashboard.tsx` — Full partnership analysis
- `src/components/capstone/signals/index.ts` — Barrel exports
- `src/components/capstone/LiveDemandBadge.tsx` — Real-time Lightcast demand indicator

### Phase 3: Student Experience ✅
- `src/hooks/useStudentDashboard.ts` — Student metrics (applications, skills, projects)
- `src/hooks/useStudentRealtime.ts` — Realtime for student data changes
- `src/hooks/useNewJobMatchCount.ts` — Badge count for job matches

### Phase 4: Employer Dashboard ✅
- `src/hooks/useEmployerDashboard.ts` — Employer projects + applications
- `src/hooks/useEmployerRealtime.ts` — Realtime for employer data
- `src/hooks/useInstructorRealtime.ts` — Realtime for instructor generation runs

### Phase 6: Pagination + Performance ✅
- `src/hooks/usePaginatedProjects.ts` — Cursor-based capstone project pagination
- `src/hooks/usePaginatedCourses.ts` — Cursor-based instructor course pagination
- `src/hooks/useDemandSignals.ts` — Enhanced demand signal hooks
- `src/hooks/useProjectAnalytics.ts` — Project view analytics tracking

## Remaining (Phase 5: Backend Utilities)
- [ ] Port `data-enrichment-pipeline` edge function
- [ ] Port `firecrawl-career-pages` edge function
- [ ] Port `rate-student-performance` edge function
- [ ] Port `admin-reset-password` edge function
- [ ] Port `import-university-data` edge function

## Integration TODOs
- [ ] Wrap App.tsx with `<NotificationProvider>` + `<RealtimeNotificationListener />`
- [ ] Import signal components into existing ProjectReportView tabs
- [ ] Wire `useStudentDashboard` into student dashboard page
- [ ] Wire `useEmployerDashboard` into employer dashboard page
