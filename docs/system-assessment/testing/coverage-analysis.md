# Test Coverage Analysis

**Assessment Date:** January 26, 2026

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Test Files | 16 |
| Frontend Test Files | 11 |
| Backend Test Files | 5 |
| Estimated Coverage | < 5% |
| Test Framework | Vitest 4.0.16 |
| Environment | jsdom |

**Overall Assessment:** Testing infrastructure exists but coverage is minimal. Critical paths are largely untested.

---

## Test Infrastructure

### Configuration
- **Framework:** Vitest with jsdom environment
- **Setup File:** `src/test/setup.ts`
- **Coverage Provider:** v8
- **Reporters:** text, json, html

### Configuration Issue Found
**Issue:** `vitest.config.ts` imports `@vitejs/plugin-react` but only `@vitejs/plugin-react-swc` is installed.

```typescript
// vitest.config.ts - ISSUE
import react from '@vitejs/plugin-react';  // Not installed
// Should be:
import react from '@vitejs/plugin-react-swc';
```

**Impact:** Tests cannot be run until this is fixed.

---

## Test File Inventory

### Frontend Tests (11 files)

| File | Type | Coverage Area |
|------|------|---------------|
| `src/components/recommendations/CurrentlyLearningPanel.test.tsx` | Component | Recommendations UI |
| `src/components/recommendations/RecommendationCard.test.tsx` | Component | Recommendations UI |
| `src/components/recommendations/RecommendationsList.test.tsx` | Component | Recommendations UI |
| `src/hooks/useLinkCourseToRecommendation.test.ts` | Hook | Course-Recommendation linking |
| `src/hooks/useTeachingUnits.test.ts` | Hook | Teaching units data |
| `src/lib/actionability-utils.test.ts` | Utility | Actionability calculations |
| `src/lib/gap-utils.test.ts` | Utility | Gap analysis utilities |
| `src/lib/price-utils.test.ts` | Utility | Price formatting |
| `src/test/factories/gap-analysis.test.ts` | Factory | Test data generation |
| `src/test/factories/recommendation.test.ts` | Factory | Test data generation |
| `src/test/factories/teaching-unit.test.ts` | Factory | Test data generation |

### Backend Tests (5 files)

| File | Type | Coverage Area |
|------|------|---------------|
| `supabase/functions/_shared/openrouter-client.test.ts` | Unit | AI client |
| `supabase/functions/process-batch-images/index.test.ts` | Unit | Batch image processing |
| `supabase/functions/tests/ai-models-unit.test.ts` | Unit | AI model utilities |
| `supabase/functions/tests/course-lifecycle.test.ts` | Integration | Course workflows |
| `supabase/functions/tests/ai-pipeline-e2e.test.ts` | E2E | AI generation pipeline |

---

## Coverage Gaps (Critical)

### 1. Authentication & Authorization
**Coverage:** None

**Missing Tests:**
- `AuthContext.tsx` - Login, logout, session management
- `AuthGuard.tsx`, `AdminGuard.tsx` - Route protection
- Password reset flow
- Onboarding flow

**Risk:** High - Authentication bugs could cause security issues or broken user experience.

---

### 2. Payment Processing
**Coverage:** None

**Missing Tests:**
- `create-checkout-session` - Stripe checkout creation
- `stripe-webhook` - Webhook handling
- `create-portal-session` - Billing portal
- Subscription lifecycle (upgrade, downgrade, cancel)

**Risk:** Critical - Payment bugs could cause revenue loss or customer disputes.

---

### 3. Edge Functions (77 total)
**Coverage:** ~3% (2 functions with tests)

**Functions with tests:**
- `process-batch-images`
- Shared `openrouter-client`

**Functions without tests (75):**
- All payment functions
- All assessment functions
- All content generation functions
- All search functions
- All user management functions

**Risk:** High - Backend logic is largely untested.

---

### 4. Core User Flows
**Coverage:** None

**Missing Tests:**
- Course creation and enrollment
- Syllabus upload and analysis
- Dream job creation and matching
- Assessment completion
- Certificate issuance
- Skills assessment flow

---

### 5. UI Components (30+ directories)
**Coverage:** ~3% (3 components tested)

**Tested:**
- `recommendations/CurrentlyLearningPanel`
- `recommendations/RecommendationCard`
- `recommendations/RecommendationsList`

**Not Tested:**
- All authentication components
- All assessment components
- All course components
- Dashboard components
- Navigation components
- Form components

---

## Testing Strategy Recommendations

### Immediate (P0)

1. **Fix vitest.config.ts**
   ```typescript
   // Change from:
   import react from '@vitejs/plugin-react';
   // To:
   import react from '@vitejs/plugin-react-swc';
   ```

2. **Add test scripts to package.json**
   ```json
   "scripts": {
     "test": "vitest",
     "test:ui": "vitest --ui",
     "test:coverage": "vitest run --coverage"
   }
   ```

---

### High Priority (P1)

3. **Payment Flow Tests**
   - Test `stripe-webhook` with mocked Stripe events
   - Test subscription state transitions
   - Test checkout session creation

4. **Authentication Tests**
   - Test AuthContext provider
   - Test login/logout flows
   - Test session persistence
   - Test route guards

---

### Medium Priority (P2)

5. **Edge Function Integration Tests**
   - Create test harness for edge functions
   - Mock Supabase client
   - Test AI generation functions with mocked AI responses

6. **Core User Flow Tests**
   - Course creation flow
   - Assessment completion flow
   - Recommendation generation flow

---

### Low Priority (P3)

7. **UI Component Tests**
   - Expand component test coverage
   - Test complex form interactions
   - Test accessibility

8. **E2E Tests**
   - Add Playwright or Cypress
   - Test complete user journeys

---

## Test File Structure Recommendations

```
src/
├── test/
│   ├── setup.ts              # Global test setup
│   ├── utils.tsx             # Test utilities
│   ├── factories/            # Test data factories
│   │   ├── user.factory.ts
│   │   ├── course.factory.ts
│   │   └── ...
│   └── mocks/                # Mock implementations
│       ├── supabase.mock.ts
│       ├── stripe.mock.ts
│       └── ...
├── components/
│   └── [component]/
│       ├── Component.tsx
│       └── Component.test.tsx  # Co-located tests
├── hooks/
│   ├── useHook.ts
│   └── useHook.test.ts
└── lib/
    ├── util.ts
    └── util.test.ts

supabase/functions/
├── [function]/
│   ├── index.ts
│   └── index.test.ts          # Co-located function tests
└── tests/
    ├── integration/           # Integration tests
    └── e2e/                   # End-to-end tests
```

---

## Coverage Targets

| Timeframe | Target | Focus Areas |
|-----------|--------|-------------|
| Week 1 | 10% | Fix config, payments, auth |
| Week 2 | 20% | Edge functions, core flows |
| Month 1 | 40% | Components, hooks |
| Month 2 | 60% | Full coverage expansion |
| Ongoing | 80% | Maintain high coverage |

---

## Appendix: Test Utilities Present

### Test Setup (`src/test/setup.ts`)
- Configures jsdom environment
- Sets up global test utilities

### Test Factories
- `gap-analysis.test.ts` - Gap analysis test data
- `recommendation.test.ts` - Recommendation test data
- `teaching-unit.test.ts` - Teaching unit test data

### Mocks (to be created)
- Supabase client mock
- React Query mock utilities
- Router mock utilities
