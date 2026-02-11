# Product Requirements Document: Stripe Integration Review & Hardening

**Product**: SyllabusStack
**Document Version**: 1.0
**Date**: February 11, 2026
**Author**: Engineering
**Status**: Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Current State Assessment](#3-current-state-assessment)
4. [Architecture & System Design](#4-architecture--system-design)
5. [Payment Flows (Detailed)](#5-payment-flows-detailed)
6. [Database Schema](#6-database-schema)
7. [Frontend Components](#7-frontend-components)
8. [Gap Analysis & Issues](#8-gap-analysis--issues)
9. [Requirements: Phase 1 — Critical Fixes](#9-requirements-phase-1--critical-fixes)
10. [Requirements: Phase 2 — Feature Completion](#10-requirements-phase-2--feature-completion)
11. [Requirements: Phase 3 — Operational Maturity](#11-requirements-phase-3--operational-maturity)
12. [Security & Compliance](#12-security--compliance)
13. [Testing Strategy](#13-testing-strategy)
14. [Success Metrics](#14-success-metrics)
15. [Appendix](#15-appendix)

---

## 1. Executive Summary

SyllabusStack uses Stripe to power a **freemium monetization model** with three subscription tiers (Free, Pro, University) and two one-time payment gates ($1 course creation, $1 course enrollment). The integration spans 7 Supabase Edge Functions, 5 frontend billing components, 1 React hook library, and 1 database migration.

This PRD documents the complete current state of the Stripe integration, identifies **13 critical or high-priority issues**, and defines phased requirements for hardening the system to production-grade reliability.

**Overall Assessment**: The integration is architecturally sound — webhook signature verification is in place, tier-based feature gating works correctly, and error handling follows sensible retry patterns. However, it has **inconsistent Stripe API versions across functions**, **incomplete annual billing** (UI exists, backend doesn't), **no refund/dispute handling**, and **zero test coverage** for payment flows.

---

## 2. Product Overview

### 2.1 Business Model

SyllabusStack operates a three-tier freemium model designed around an EdTech SaaS for course syllabus management, career gap analysis, and learning recommendations.

| Dimension | Free Tier | Pro Tier | University Tier |
|-----------|-----------|----------|-----------------|
| **Pricing** | $0 (+ $1 per-action fees) | $9.99/month | Custom (sales-led) |
| **Target User** | Individual students | Career-focused learners | Institutions |
| **Course Syllabi** | 3 max | Unlimited | Unlimited |
| **Dream Job Profiles** | 1 | 5 | Unlimited |
| **AI Analyses/month** | 20 | 200 | Unlimited |
| **PDF Export** | No | Yes | Yes |
| **All Recommendations** | No (top 5 only) | Yes | Yes + Custom |
| **Advanced Analytics** | No | Yes | Yes + Custom |
| **Support** | Community | Email | Dedicated |
| **Course Creation Fee** | $1 per course | Included | Included |
| **Course Enrollment Fee** | $1 per enrollment | Included | Included |

### 2.2 Revenue Streams

1. **Recurring subscriptions** — Pro tier at $9.99/month (primary revenue driver)
2. **Transactional payments** — $1 course creation and $1 enrollment fees from Free-tier users
3. **Certificate purchases** — Paid certificates upon course completion (partially implemented)
4. **Enterprise contracts** — University tier, handled off-platform via sales

### 2.3 Key Stakeholders

- **Students/Learners** — Primary users, Free or Pro subscribers
- **Instructors** — Course creators, typically Pro or University
- **Institutions** — University-tier organizations
- **Engineering** — Owns the technical integration
- **Finance** — Needs reliable billing data, invoice access, and reconciliation

---

## 3. Current State Assessment

### 3.1 Component Inventory

| Component | File | Purpose | Stripe API Version |
|-----------|------|---------|-------------------|
| `create-checkout-session` | `supabase/functions/create-checkout-session/index.ts` | Initiates Pro subscription checkout | `2025-08-27.basil` (stripe@18.5.0) |
| `cancel-subscription` | `supabase/functions/cancel-subscription/index.ts` | Cancels subscription at period end | `2023-10-16` (stripe@14.14.0) |
| `create-portal-session` | `supabase/functions/create-portal-session/index.ts` | Opens Stripe billing portal | `2023-10-16` (stripe@14.14.0) |
| `get-invoices` | `supabase/functions/get-invoices/index.ts` | Fetches user's Stripe invoices | `2023-10-16` (stripe@14.14.0) |
| `create-course-payment` | `supabase/functions/create-course-payment/index.ts` | $1 course creation payment | `2025-08-27.basil` (stripe@18.5.0) |
| `enroll-in-course` | `supabase/functions/enroll-in-course/index.ts` | $1 enrollment payment or free enroll | `2025-08-27.basil` (stripe@18.5.0) |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` | Processes Stripe webhook events | `2023-10-16` (stripe@14.14.0) |

| Frontend Component | File | Purpose |
|--------------------|------|---------|
| `SubscriptionManager` | `src/components/billing/SubscriptionManager.tsx` | Current plan display, upgrade/cancel actions |
| `PricingTable` | `src/components/billing/PricingTable.tsx` | Three-tier pricing cards with annual toggle |
| `BillingHistory` | `src/components/billing/BillingHistory.tsx` | Invoice list with PDF download |
| `UsageMeter` | `src/components/billing/UsageMeter.tsx` | AI calls, courses, dream jobs usage bars |
| `UpgradePrompt` | `src/components/billing/UpgradePrompt.tsx` | Feature-gated upgrade CTAs |

| Hook | File | Purpose |
|------|------|---------|
| `useSubscription` | `src/hooks/useSubscription.ts` | Subscription state, tier checks, usage limits |

| Database | File | Purpose |
|----------|------|---------|
| Subscription migration | `supabase/migrations/20260109130000_add_subscription_system.sql` | Tier enum, `tier_limits` table, usage functions |

### 3.2 Stripe SDK Version Matrix

| Function Group | Deno Std | Supabase JS | Stripe SDK |
|----------------|----------|-------------|------------|
| checkout, course-payment, enroll | `0.190.0` | `2.47.12–2.57.2` | `18.5.0` |
| webhook, cancel, portal, invoices | `0.168.0` | `2.89.0` | `14.14.0` |

**Risk**: Two different Stripe SDK major versions (14.x vs 18.x) and two different API versions (`2023-10-16` vs `2025-08-27.basil`) are in active use. This creates a surface for type mismatches, divergent behavior on the same Stripe object, and makes debugging significantly harder.

### 3.3 Environment Variables Required

| Variable | Used By | Required |
|----------|---------|----------|
| `STRIPE_SECRET_KEY` | All 7 edge functions | Yes |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Yes |
| `SUPABASE_URL` | All 7 edge functions | Yes |
| `SUPABASE_ANON_KEY` | Functions needing user-scoped auth | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions needing admin writes | Yes |
| `RESEND_API_KEY` | `stripe-webhook` (payment failed emails) | Optional |
| `APP_URL` / `PUBLIC_APP_URL` | Redirect URL fallbacks | Optional |

---

## 4. Architecture & System Design

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│                                                         │
│  PricingTable ─→ Checkout Page ─→ create-checkout-session│
│  SubscriptionManager ─→ cancel-subscription              │
│                       ─→ create-portal-session           │
│  BillingHistory ─→ get-invoices                         │
│  EnrollmentDialog ─→ enroll-in-course                   │
│  CourseCreation ─→ create-course-payment                │
│  useSubscription() ─→ get_subscription_details (RPC)    │
│                                                         │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS (Bearer token auth)
                        ▼
┌─────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Deno)              │
│                                                         │
│  Checkout ──┐                                           │
│  Enroll ────┤── Stripe API ──→ Stripe Dashboard         │
│  Cancel ────┤                                           │
│  Portal ────┤                                           │
│  Invoices ──┘                                           │
│                                                         │
│  stripe-webhook ◄── Stripe Webhooks                     │
│       │                                                 │
│       ├── checkout.session.completed                    │
│       ├── customer.subscription.created/updated         │
│       ├── customer.subscription.deleted                 │
│       ├── invoice.payment_failed                        │
│       └── invoice.payment_succeeded                     │
│                                                         │
└───────────────────────┬─────────────────────────────────┘
                        │ Service Role Key
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE DATABASE                        │
│                                                         │
│  profiles (subscription_tier, stripe_customer_id, ...)  │
│  tier_limits (max_courses, max_ai_calls_per_month, ...) │
│  course_enrollments (student_id, instructor_course_id)  │
│  certificates (stripe_payment_intent_id, amount_paid)   │
│                                                         │
│  RPC: get_subscription_details()                        │
│  RPC: increment_ai_usage()                              │
│  RPC: check_tier_limit()                                │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Authentication Flow

All edge functions (except `stripe-webhook`) follow the same auth pattern:

1. Extract `Authorization: Bearer <token>` header from request
2. Create a user-scoped Supabase client with that header
3. Call `supabase.auth.getUser()` to validate the token
4. Reject with 401 if invalid

The `stripe-webhook` function uses Stripe signature verification (`stripe.webhooks.constructEvent`) instead, which is correct.

### 4.3 Customer ID Lifecycle

```
User signs up ──→ No stripe_customer_id
       │
       ▼
First payment action ──→ Check profiles.stripe_customer_id
       │                          │
       ├── exists ────────────────┘
       │
       └── null ──→ stripe.customers.create()
                         │
                         ├── Save to profiles.stripe_customer_id
                         └── Use for checkout session
```

**Issue**: `create-checkout-session` and `enroll-in-course` / `create-course-payment` use different customer creation strategies. The checkout function uses the admin client to save the customer ID, while enrollment/course-payment functions use the user-scoped client. This could fail silently if RLS policies block the user from updating their own profile's `stripe_customer_id` field.

---

## 5. Payment Flows (Detailed)

### 5.1 Subscription Upgrade (Pro Plan)

**Trigger**: User clicks "Upgrade to Pro" from `PricingTable` or `SubscriptionManager`

```
1. Frontend navigates to /checkout?tier=pro&isAnnual=0
2. Checkout.tsx calls create-checkout-session edge function
3. Edge function:
   a. Authenticates user via Bearer token
   b. Validates tier === "pro"
   c. Gets/creates Stripe customer
   d. Creates Stripe Checkout Session with:
      - Price: price_1SnXUZRsfnRI3vWDGdLskq3C ($9.99/mo)
      - Mode: subscription
      - Metadata: { supabase_user_id, tier }
      - allow_promotion_codes: true
      - billing_address_collection: required
   e. Returns checkout URL
4. User redirected to Stripe-hosted checkout
5. User completes payment
6. Stripe fires webhook: checkout.session.completed
7. Webhook handler:
   a. Retrieves subscription from Stripe
   b. Updates profiles: subscription_tier=pro, status=active, stripe_subscription_id, dates
8. Stripe also fires: customer.subscription.created
9. Webhook handler updates profiles again (idempotent)
10. User returns to /billing?success=true
```

**Known Issues**:
- `isAnnual` parameter is accepted but never used — only monthly price ID exists
- Hardcoded price ID `price_1SnXUZRsfnRI3vWDGdLskq3C` — no way to change without code deploy
- Double profile update from steps 7 and 9 (not harmful but wasteful)

### 5.2 Subscription Cancellation

**Trigger**: User clicks "Cancel Subscription" in `SubscriptionManager`

```
1. Frontend shows confirmation dialog
2. On confirm, calls cancel-subscription edge function
3. Edge function:
   a. Authenticates user
   b. Fetches stripe_subscription_id from profiles
   c. Calls stripe.subscriptions.update({ cancel_at_period_end: true })
   d. Updates profiles: subscription_status="canceling", subscription_ends_at=period_end
4. Frontend reloads page
5. At period end, Stripe fires: customer.subscription.deleted
6. Webhook handler:
   a. Downgrades to free: subscription_tier=free, status=canceled
   b. Clears stripe_subscription_id and subscription_ends_at
```

**Known Issues**:
- `subscription_status="canceling"` is set locally but the DB CHECK constraint only allows `('active', 'canceled', 'past_due', 'trialing')`. The value "canceling" will be rejected at the database level. This is a **bug**.

### 5.3 Course Creation Payment ($1)

**Trigger**: Free-tier user creates a new course

```
1. Frontend calls create-course-payment edge function
2. Edge function:
   a. Checks subscription_tier
   b. Pro/University → returns { requires_payment: false } immediately
   c. Free → creates $1 Stripe Checkout Session (mode: payment)
   d. Metadata: { user_id, product_type: "course_creation", course_title, ... }
3. User completes $1 payment
4. Stripe fires: checkout.session.completed
5. Webhook handler: logs "course creation payment completed" — no DB action
6. Frontend handles post-payment course creation on redirect
```

**Known Issues**:
- Course creation after payment is handled entirely on the frontend redirect. If the user closes the tab before the frontend completes, the course is never created despite payment.
- No reconciliation mechanism to detect paid-but-uncreated courses.

### 5.4 Course Enrollment Payment ($1)

**Trigger**: Free-tier user enrolls via access code

```
1. Frontend calls enroll-in-course edge function with access_code
2. Edge function:
   a. Validates access code against instructor_courses
   b. Checks for existing enrollment (dedup)
   c. Checks subscription_tier
   d. If Pro, University, OR ENROLLMENT_FREE=true → immediate free enrollment
   e. Otherwise → creates $1 Stripe Checkout Session
3. On payment completion, webhook creates course_enrollments record
4. Handles duplicate enrollment gracefully (code 23505)
```

**Known Issues**:
- `ENROLLMENT_FREE = true` is hardcoded — all enrollments are currently free regardless of tier. The $1 enrollment payment path is effectively dead code.
- No admin toggle or environment variable to control this; requires code change.

### 5.5 Certificate Purchase

**Trigger**: User purchases a certificate after completing a course

```
1. checkout.session.completed webhook with product_type="certificate"
2. Webhook calls issue-certificate edge function internally
3. Certificate record created with stripe_payment_intent_id and amount_paid_cents
```

**Known Issues**:
- The `purchase-certificate` edge function that initiates the checkout session was not found in the codebase. The webhook handler exists but the triggering function appears missing or incomplete.

### 5.6 Billing Portal

**Trigger**: Pro user clicks "Manage Billing"

```
1. Frontend calls create-portal-session edge function
2. Edge function creates Stripe billing portal session
3. User redirected to Stripe-hosted portal
4. User can: update payment method, view invoices, manage subscription
5. User returns to /billing on exit
```

### 5.7 Invoice Retrieval

**Trigger**: BillingHistory component mounts

```
1. Frontend calls get-invoices edge function
2. Edge function fetches from Stripe (default 10, max 100)
3. Returns formatted invoices with PDF/hosted URLs
4. Frontend displays with status badges and download links
```

---

## 6. Database Schema

### 6.1 Profiles Table (Subscription Columns)

```sql
subscription_tier       subscription_tier  DEFAULT 'free'
subscription_status     TEXT               DEFAULT 'active'
                        CHECK (subscription_status IN ('active','canceled','past_due','trialing'))
subscription_started_at TIMESTAMPTZ
subscription_ends_at    TIMESTAMPTZ
stripe_customer_id      TEXT
stripe_subscription_id  TEXT
ai_calls_this_month     INTEGER            DEFAULT 0
ai_calls_reset_at       TIMESTAMPTZ        DEFAULT now()
```

### 6.2 Tier Limits Table

```sql
CREATE TABLE tier_limits (
  tier                          subscription_tier PRIMARY KEY,
  max_courses                   INTEGER NOT NULL,
  max_dream_jobs                INTEGER NOT NULL,
  max_ai_calls_per_month        INTEGER NOT NULL,
  can_export_pdf                BOOLEAN DEFAULT false,
  can_see_all_recommendations   BOOLEAN DEFAULT false,
  can_access_advanced_analytics BOOLEAN DEFAULT false,
  can_access_premium_content    BOOLEAN DEFAULT false,
  priority_support              BOOLEAN DEFAULT false,
  created_at                    TIMESTAMPTZ DEFAULT now()
);
```

**Seed Data**:

| Tier | Courses | Dream Jobs | AI Calls | PDF | Recommendations | Analytics | Premium | Support |
|------|---------|------------|----------|-----|-----------------|-----------|---------|---------|
| free | 3 | 1 | 20 | No | No | No | No | No |
| pro | 999999 | 5 | 200 | Yes | Yes | Yes | Yes | No |
| university | 999999 | 999999 | 999999 | Yes | Yes | Yes | Yes | Yes |

### 6.3 Database Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `check_tier_limit(user_id, limit_type)` | Validates if user can perform action | Boolean |
| `increment_ai_usage(user_id)` | Tracks AI calls with monthly auto-reset | `{allowed, current_usage, max_usage, tier}` |
| `get_subscription_details(user_id)` | Comprehensive subscription state | Full subscription details row |

### 6.4 Indexes

```sql
idx_profiles_subscription_tier ON profiles(subscription_tier)
idx_profiles_stripe_customer   ON profiles(stripe_customer_id)
```

---

## 7. Frontend Components

### 7.1 useSubscription Hook (`src/hooks/useSubscription.ts`)

The central hook for all subscription state management.

**Exports**:
- `useSubscription()` — Returns full subscription details, tier info, boolean helpers (`isPro`, `isFree`, `isUniversity`). Cached for 1 minute via React Query.
- `useCanAccess(feature)` — Checks if a specific premium feature is available.
- `useUsageLimits()` — Returns usage percentages with 80% warning and 100% exhaustion thresholds.
- `useIncrementAIUsage()` — Mutation that calls `increment_ai_usage` RPC and invalidates subscription cache.
- `useTierLimits()` — Fetches all tier configurations. Cached for 1 hour.
- `TIER_INFO` — Static display configuration (names, prices, colors, feature lists).
- `PREMIUM_FEATURES` — Type-safe list of premium feature identifiers.

### 7.2 PricingTable (`src/components/billing/PricingTable.tsx`)

Three-column pricing comparison with:
- Monthly/Annual toggle (17% annual discount calculated in UI)
- Feature checkmarks per tier
- CTA buttons: "Current Plan" (disabled), "Upgrade to Pro", "Contact Sales"
- Full feature comparison table at bottom

### 7.3 SubscriptionManager (`src/components/billing/SubscriptionManager.tsx`)

Displays current plan status with contextual actions:
- Free tier: "Upgrade to Pro" button
- Pro tier: "Manage Billing" (opens Stripe portal), "Cancel Subscription" (with confirmation dialog)
- Canceled: Shows end date, "Reactivate Subscription" button
- Past due: Warning banner with payment update prompt
- Usage stats: AI calls, courses, dream jobs for current billing period

### 7.4 BillingHistory

Invoice list fetched from Stripe with:
- Status badges (Paid, Pending, Void, Failed)
- PDF download links
- Hosted invoice URLs

### 7.5 UsageMeter

Real-time usage displays with multiple variants (full, compact, inline):
- Progress bars for AI calls, courses, dream jobs
- Warning state at 80% usage
- Exhausted state at 100% with upgrade prompt

### 7.6 UpgradePrompt

Feature-locked upgrade CTAs with variants:
- Inline, card, dialog, overlay
- Per-feature descriptions
- HOC wrapper: `withPremium<T>(Component, feature)` for wrapping any component
- Limit-reached prompts for exhausted quotas

---

## 8. Gap Analysis & Issues

### 8.1 Critical Issues (Must Fix Before Production)

#### CRIT-1: Inconsistent Stripe API Versions

**Severity**: Critical
**Impact**: Potential type mismatches, unpredictable behavior, debugging difficulty

Three edge functions use `stripe@18.5.0` with API version `2025-08-27.basil`. Four use `stripe@14.14.0` with `2023-10-16`. The webhook handler (most critical function) is on the older version while the checkout function that creates sessions is on the newer one. A Stripe object created by one version may have different field shapes when received by the webhook on another version.

**Recommendation**: Standardize all functions to `stripe@18.5.0` with `2025-08-27.basil`.

#### CRIT-2: "canceling" Status Rejected by Database

**Severity**: Critical
**Impact**: Subscription cancellation silently fails at the database layer

The `cancel-subscription` function sets `subscription_status = "canceling"`, but the database CHECK constraint only allows `('active', 'canceled', 'past_due', 'trialing')`. The update will be rejected, and the function will return success to the user while the status was never actually changed.

**Recommendation**: Either add `'canceling'` to the CHECK constraint or use an allowed value like `'canceled'` with a separate `cancel_at_period_end` boolean.

#### CRIT-3: No Refund or Dispute Handling

**Severity**: Critical
**Impact**: Refunded payments leave users with active subscriptions; disputes go unhandled

The webhook handler does not listen for `charge.refunded`, `charge.dispute.created`, or `customer.subscription.paused`. A refunded subscription payment would not trigger a tier downgrade.

**Recommendation**: Add handlers for `charge.refunded` (downgrade tier), `charge.dispute.created` (flag account, notify admin), and `invoice.payment_action_required`.

#### CRIT-4: Course Creation Post-Payment Race Condition

**Severity**: Critical
**Impact**: Users pay $1 but course is never created if they close the browser

After completing the $1 course creation payment, the actual course creation is handled entirely by the frontend on the redirect URL. If the user's browser crashes, closes, or loses connection, the course is never created despite successful payment.

**Recommendation**: Move course creation to the webhook handler, storing the intent metadata (course title, code, file) and creating the course server-side upon `checkout.session.completed`.

### 8.2 High-Priority Issues

#### HIGH-1: Annual Billing Not Implemented

**Severity**: High
**Impact**: UI promises 17% annual discount but backend only supports monthly billing

The `PricingTable` component has a fully functional annual/monthly toggle that calculates a 17% discount ($8.29/mo billed annually). The `isAnnual` parameter is passed through the checkout URL. However, `create-checkout-session` ignores this parameter entirely — it always uses the monthly price ID `price_1SnXUZRsfnRI3vWDGdLskq3C`.

**Recommendation**: Create an annual price in Stripe Dashboard, add `pro_annual` to `STRIPE_PRICES`, and route based on the `isAnnual` parameter.

#### HIGH-2: Hardcoded Stripe Price ID

**Severity**: High
**Impact**: Price changes require code deployment

The Pro monthly price ID `price_1SnXUZRsfnRI3vWDGdLskq3C` is hardcoded at the top of `create-checkout-session`. There is no environment variable, database configuration, or Stripe product catalog lookup.

**Recommendation**: Move price IDs to environment variables (`STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`) or fetch from a `pricing_config` database table.

#### HIGH-3: Enrollment Payment Toggle is Hardcoded

**Severity**: High
**Impact**: Cannot enable/disable enrollment fees without code deployment

`ENROLLMENT_FREE = true` is hardcoded in `enroll-in-course/index.ts`. The entire $1 enrollment payment flow is dead code. There's no way to activate it without modifying and redeploying the function.

**Recommendation**: Move to an environment variable `ENROLLMENT_FREE` or a database flag in an `app_config` table.

#### HIGH-4: Missing Idempotency in Webhook Handlers

**Severity**: High
**Impact**: Duplicate webhook deliveries could cause inconsistent state

Stripe may deliver the same webhook event multiple times. The `checkout.session.completed` handler for subscriptions does not check if the subscription has already been processed. While the enrollment handler has dedup via the 23505 constraint, subscription updates lack similar protection.

**Recommendation**: Add idempotency checks — e.g., check if `stripe_subscription_id` already matches before updating, or maintain a `processed_webhook_events` table.

#### HIGH-5: No Failed Payment Recovery Flow

**Severity**: High
**Impact**: Users with failed payments get an email but no in-app recovery path

When `invoice.payment_failed` fires, the handler updates status to `past_due` and sends an email with a hardcoded link to `https://syllabusstack.com/billing`. There is no automated retry schedule, no in-app banner for past-due users, and no grace period logic.

**Recommendation**:
1. Add an in-app banner for `past_due` status (the `SubscriptionManager` already shows this but could be more prominent).
2. Configure Stripe's built-in Smart Retries in the Dashboard.
3. Add a dunning email sequence (3 days, 7 days, 14 days).

### 8.3 Medium-Priority Issues

#### MED-1: Inconsistent Customer ID Storage

The `create-checkout-session` function uses the **admin** Supabase client to save `stripe_customer_id`. The `enroll-in-course` and `create-course-payment` functions use the **user-scoped** client. If RLS policies prevent users from updating their own `stripe_customer_id`, the latter will fail silently.

**Recommendation**: Standardize on using the admin client for all `stripe_customer_id` writes.

#### MED-2: Certificate Purchase Flow Incomplete

The webhook handler processes `product_type="certificate"` and calls `issue-certificate`, but no `purchase-certificate` edge function was found that initiates the checkout. The certificate purchase flow is half-built.

**Recommendation**: Either complete the `purchase-certificate` function or remove the dead webhook code to avoid confusion.

#### MED-3: No Webhook Event Monitoring

There is no logging infrastructure beyond `console.log`. No webhook event dedup table, no monitoring dashboard, no alerting on failed webhook processing.

**Recommendation**: Add a `stripe_webhook_events` table logging event ID, type, status, and processing time. Alert on repeated failures.

#### MED-4: Deno Standard Library Version Mismatch

Functions use either `deno-std@0.190.0` or `deno-std@0.168.0`, and Supabase JS versions range from `2.47.12` to `2.89.0`. While not directly causing bugs, this makes maintenance harder.

**Recommendation**: Standardize all functions to the same versions in a single pass.

### 8.4 Low-Priority Issues

#### LOW-1: No Promo Code / Coupon Management

`allow_promotion_codes: true` is set on checkout sessions, but there's no admin UI to create or manage Stripe coupons. All coupon management must happen in the Stripe Dashboard.

#### LOW-2: No Billing Admin Dashboard

No internal admin view exists for: viewing all subscribers, MRR tracking, churn analysis, or manual subscription adjustments.

#### LOW-3: `window.location.reload()` After Cancellation

The `SubscriptionManager` calls `window.location.reload()` after cancellation succeeds instead of invalidating the React Query cache. This causes a full page reload and poor UX.

#### LOW-4: No Invoice Search/Filtering

The `BillingHistory` component shows a flat list of recent invoices with no search, date filtering, or pagination beyond the initial limit.

---

## 9. Requirements: Phase 1 — Critical Fixes

**Timeline**: Sprint 1 (1-2 weeks)
**Goal**: Eliminate data integrity risks and prevent revenue loss

### REQ-1.1: Standardize Stripe SDK and API Versions

**Priority**: P0
**Acceptance Criteria**:
- All 7 edge functions use `stripe@18.5.0` with API version `2025-08-27.basil`
- All functions use `deno-std@0.190.0` and `@supabase/supabase-js@2.89.0`
- All existing payment flows tested and verified post-upgrade
- Webhook signature verification confirmed working with unified version

### REQ-1.2: Fix "canceling" Status Database Constraint

**Priority**: P0
**Acceptance Criteria**:
- Database migration adds `'canceling'` to the `subscription_status` CHECK constraint
- OR: Replace `"canceling"` with a composite state using existing allowed values plus a boolean
- Subscription cancellation flow tested end-to-end: cancel → verify status stored → period ends → downgrade fires

### REQ-1.3: Add Refund and Dispute Webhook Handlers

**Priority**: P0
**Acceptance Criteria**:
- `charge.refunded` handler: if subscription-related, downgrades user to free tier
- `charge.dispute.created` handler: flags account, sends admin notification
- `invoice.payment_action_required` handler: sends user notification with action link
- All handlers are idempotent and log events
- Stripe webhook endpoint configured to send these event types

### REQ-1.4: Server-Side Course Creation on Payment

**Priority**: P0
**Acceptance Criteria**:
- `checkout.session.completed` handler for `product_type="course_creation"` creates the course record server-side
- Required metadata (course_title, course_code, file reference) stored in Stripe session metadata
- Frontend redirect becomes a confirmation/status page, not the creation trigger
- Reconciliation: admin can query for paid sessions without corresponding course records

---

## 10. Requirements: Phase 2 — Feature Completion

**Timeline**: Sprint 2-3 (2-4 weeks)
**Goal**: Complete partially-built features and improve operational reliability

### REQ-2.1: Implement Annual Billing

**Priority**: P1
**Acceptance Criteria**:
- Annual Stripe Price created in Dashboard (Pro annual at ~$99.90/year, i.e., $8.33/mo)
- `create-checkout-session` accepts `isAnnual` and routes to correct price ID
- Price IDs stored in environment variables, not hardcoded
- `PricingTable` annual toggle accurately reflects real prices
- Webhook correctly handles annual subscription events
- Users can switch between monthly and annual via billing portal

### REQ-2.2: Externalize Configuration

**Priority**: P1
**Acceptance Criteria**:
- Price IDs moved to environment variables: `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`
- `ENROLLMENT_FREE` toggle moved to environment variable
- `APP_URL` consistently used across all functions (not split between `APP_URL` and `PUBLIC_APP_URL`)
- Changes documented in a `.env.example` file

### REQ-2.3: Add Webhook Idempotency

**Priority**: P1
**Acceptance Criteria**:
- New `stripe_webhook_events` table: `event_id TEXT PRIMARY KEY, event_type TEXT, processed_at TIMESTAMPTZ, status TEXT`
- Webhook handler checks if `event.id` already exists before processing
- Duplicate events logged and skipped gracefully
- Table auto-cleaned after 30 days

### REQ-2.4: Standardize Customer ID Writes

**Priority**: P1
**Acceptance Criteria**:
- All functions that save `stripe_customer_id` use the admin Supabase client
- Customer creation logic extracted to a shared utility (`_shared/stripe-customer.ts`)
- Single source of truth for "get or create Stripe customer" logic

### REQ-2.5: Complete or Remove Certificate Purchase Flow

**Priority**: P2
**Acceptance Criteria**:
- EITHER: `purchase-certificate` edge function implemented with checkout session, properly tested
- OR: Certificate webhook code removed and certificates made free or handled differently
- Decision documented in this PRD's appendix

### REQ-2.6: Failed Payment Recovery UX

**Priority**: P2
**Acceptance Criteria**:
- Global banner displayed to users with `past_due` status across all pages
- Banner links to Stripe billing portal for payment update
- Stripe Smart Retries enabled in Dashboard
- Email sequence: Day 1 (immediate, already exists), Day 3, Day 7 (final warning before downgrade)

---

## 11. Requirements: Phase 3 — Operational Maturity

**Timeline**: Sprint 4-6 (4-8 weeks)
**Goal**: Monitoring, testing, and admin tooling for long-term reliability

### REQ-3.1: Webhook Monitoring and Alerting

**Priority**: P2
**Acceptance Criteria**:
- `stripe_webhook_events` table tracks all events with processing status and duration
- Admin endpoint or dashboard to view recent events, failures, and retry status
- Alerting (email or Slack) on: 3+ consecutive failures, events older than 5 minutes unprocessed
- Stripe Dashboard webhook health monitored

### REQ-3.2: Admin Billing Dashboard

**Priority**: P3
**Acceptance Criteria**:
- Admin page showing: total active subscribers by tier, MRR, recent signups/cancellations
- Ability to search users by email and view their subscription status
- Manual override capability (with audit log) for subscription tier adjustments
- Revenue chart showing monthly trends

### REQ-3.3: Billing Event Audit Log

**Priority**: P3
**Acceptance Criteria**:
- All subscription state changes logged to a `billing_audit_log` table
- Fields: `user_id, event_type, old_state, new_state, stripe_event_id, timestamp`
- Queryable by user ID for customer support
- Retained for 2 years minimum

### REQ-3.4: Promo Code Management

**Priority**: P3
**Acceptance Criteria**:
- Admin UI for creating time-limited Stripe coupons
- Support for: percentage off, fixed amount, duration (once, repeating, forever)
- Usage tracking visible in admin dashboard
- Promo codes can be pre-applied via URL parameter

---

## 12. Security & Compliance

### 12.1 Current Security Posture

| Area | Status | Notes |
|------|--------|-------|
| Webhook signature verification | Implemented | Uses `stripe.webhooks.constructEvent` |
| Bearer token auth on all functions | Implemented | Except webhook (uses Stripe signature) |
| Service role key isolation | Implemented | Only used server-side in edge functions |
| Stripe secret key exposure | Secure | Only in Deno.env, never client-side |
| PII in Stripe metadata | Acceptable | User IDs and course IDs (not PII) |
| Certificate financial data | Protected | Hidden from public verification views |
| RLS on tier_limits | Implemented | Read-only for authenticated users |

### 12.2 Security Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SEC-1 | Never log full Stripe API keys or webhook secrets | P0 |
| SEC-2 | Validate all webhook payloads via signature before processing | P0 (already done) |
| SEC-3 | Use service role key only in edge functions, never expose to client | P0 (already done) |
| SEC-4 | Rate limit checkout session creation (prevent abuse) | P1 |
| SEC-5 | Validate that the user requesting cancellation owns the subscription | P0 (already done) |
| SEC-6 | Ensure `stripe_customer_id` cannot be modified by users via RLS | P1 |
| SEC-7 | Add CSRF protection on payment-initiating endpoints | P2 |

### 12.3 PCI Compliance

SyllabusStack uses Stripe Checkout (hosted payment page) and Stripe Billing Portal, which means the application **never handles raw card data**. This places the application in **PCI SAQ-A** scope — the simplest compliance level. No additional PCI controls are required beyond what Stripe provides, as long as:

- Card numbers are never logged, stored, or transmitted through SyllabusStack servers
- Stripe.js or Checkout is always used for payment collection
- No custom payment forms are introduced that handle card data

---

## 13. Testing Strategy

### 13.1 Current Test Coverage

**Zero** — There are no existing tests for any Stripe-related functionality. The project uses Vitest (`vitest.config.ts` exists) but no billing tests have been written.

### 13.2 Required Test Coverage

#### Unit Tests (Vitest)

| Test Area | Coverage Target | Priority |
|-----------|----------------|----------|
| `useSubscription` hook — tier detection, feature gating | 100% | P0 |
| `useCanAccess` — all premium features | 100% | P0 |
| `useUsageLimits` — warning/exhaustion thresholds | 100% | P1 |
| `PricingTable` — price calculations (monthly/annual) | 100% | P1 |
| `SubscriptionManager` — renders correct state per tier/status | 90% | P1 |

#### Integration Tests (Stripe Test Mode)

| Test Area | Coverage Target | Priority |
|-----------|----------------|----------|
| Checkout session creation (mock Stripe) | Happy path + errors | P0 |
| Webhook signature verification | Valid + invalid signatures | P0 |
| Subscription lifecycle: create → update → cancel → delete | Full cycle | P0 |
| $1 payment flow: course creation | Happy path | P1 |
| $1 payment flow: enrollment | Happy path | P1 |
| Invoice retrieval | With/without invoices | P2 |
| Portal session creation | Happy path | P2 |

#### End-to-End Tests

| Test Area | Priority |
|-----------|----------|
| Free user → upgrade to Pro → verify feature access | P1 |
| Pro user → cancel → verify access until period end → verify downgrade | P1 |
| Free user → $1 course creation → verify course exists | P1 |
| Failed payment → verify past_due status → payment update → verify active | P2 |

### 13.3 Stripe Test Mode Configuration

All testing should use Stripe test mode with:
- Test API keys (`sk_test_...`, `pk_test_...`)
- Test webhook signing secret
- Stripe CLI for local webhook forwarding: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
- Test card numbers: `4242424242424242` (success), `4000000000000002` (decline)

---

## 14. Success Metrics

### 14.1 Technical Health Metrics

| Metric | Current | Target (Phase 1) | Target (Phase 3) |
|--------|---------|-------------------|-------------------|
| Stripe API version consistency | 2 versions | 1 version | 1 version |
| Stripe SDK version consistency | 2 versions | 1 version | 1 version |
| Webhook event handling coverage | 5 events | 8 events | 12+ events |
| Test coverage (billing code) | 0% | 60% | 90% |
| Webhook processing success rate | Unknown | >99% | >99.9% |
| Median webhook processing time | Unknown | <2s | <500ms |

### 14.2 Business Metrics (Post-Launch Tracking)

| Metric | Description |
|--------|-------------|
| Conversion rate | Free → Pro upgrades / total free users |
| Churn rate | Monthly subscription cancellations / total subscribers |
| ARPU | Average revenue per user (MRR / total active users) |
| Failed payment recovery rate | Recovered payments / total failed payments |
| Time to first payment | Days from signup to first payment |
| Annual vs monthly split | % of subscribers on annual plan (post REQ-2.1) |

---

## 15. Appendix

### A. Stripe Webhook Events — Current vs Required

| Event | Currently Handled | Required |
|-------|-------------------|----------|
| `checkout.session.completed` | Yes | Yes |
| `customer.subscription.created` | Yes | Yes |
| `customer.subscription.updated` | Yes | Yes |
| `customer.subscription.deleted` | Yes | Yes |
| `invoice.payment_failed` | Yes | Yes |
| `invoice.payment_succeeded` | Yes | Yes |
| `charge.refunded` | **No** | Yes (Phase 1) |
| `charge.dispute.created` | **No** | Yes (Phase 1) |
| `invoice.payment_action_required` | **No** | Yes (Phase 1) |
| `customer.subscription.paused` | **No** | Nice to have |
| `customer.subscription.resumed` | **No** | Nice to have |
| `billing_portal.session.created` | **No** | Nice to have |

### B. Edge Function Dependency Matrix

```
create-checkout-session
├── stripe@18.5.0
├── @supabase/supabase-js@2.57.2
├── _shared/cors.ts
└── _shared/error-handler.ts

cancel-subscription
├── stripe@14.14.0       ← NEEDS UPDATE
├── @supabase/supabase-js@2.89.0
├── _shared/cors.ts
└── _shared/error-handler.ts

create-portal-session
├── stripe@14.14.0       ← NEEDS UPDATE
├── @supabase/supabase-js@2.89.0
├── _shared/cors.ts
└── _shared/error-handler.ts

get-invoices
├── stripe@14.14.0       ← NEEDS UPDATE
├── @supabase/supabase-js@2.89.0
├── _shared/cors.ts
└── _shared/error-handler.ts

create-course-payment
├── stripe@18.5.0
├── @supabase/supabase-js@2.47.12
├── _shared/cors.ts
└── _shared/error-handler.ts

enroll-in-course
├── stripe@18.5.0
├── @supabase/supabase-js@2.47.12
├── _shared/cors.ts
├── _shared/error-handler.ts
└── _shared/validators/index.ts

stripe-webhook
├── stripe@14.14.0       ← NEEDS UPDATE
├── @supabase/supabase-js@2.89.0
├── _shared/cors.ts
└── _shared/error-handler.ts
```

### C. File Reference Index

| Category | File Path |
|----------|-----------|
| Edge Functions | `supabase/functions/create-checkout-session/index.ts` |
| | `supabase/functions/cancel-subscription/index.ts` |
| | `supabase/functions/create-portal-session/index.ts` |
| | `supabase/functions/get-invoices/index.ts` |
| | `supabase/functions/create-course-payment/index.ts` |
| | `supabase/functions/enroll-in-course/index.ts` |
| | `supabase/functions/stripe-webhook/index.ts` |
| Shared Utilities | `supabase/functions/_shared/cors.ts` |
| | `supabase/functions/_shared/error-handler.ts` |
| | `supabase/functions/_shared/validators/index.ts` |
| Frontend Components | `src/components/billing/SubscriptionManager.tsx` |
| | `src/components/billing/PricingTable.tsx` |
| | `src/components/billing/BillingHistory.tsx` |
| | `src/components/billing/UsageMeter.tsx` |
| | `src/components/billing/UpgradePrompt.tsx` |
| Hooks | `src/hooks/useSubscription.ts` |
| Pages | `src/pages/Checkout.tsx` |
| | `src/pages/PaymentSuccess.tsx` |
| | `src/pages/PaymentCancel.tsx` |
| Database | `supabase/migrations/20260109130000_add_subscription_system.sql` |
| Config | `.env` (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) |

### D. Decision Log

| Decision | Date | Rationale |
|----------|------|-----------|
| Freemium with $1 gates | Pre-Jan 2026 | Low barrier entry while ensuring payment method on file |
| Stripe Checkout (hosted) over Elements | Pre-Jan 2026 | Simplicity, PCI SAQ-A compliance, faster time to market |
| Usage tracking in profiles table | Jan 9, 2026 | Avoid additional table joins for most common query |
| `ENROLLMENT_FREE = true` | Unknown | Likely a temporary promotional decision; needs product clarification |
| 999999 as "unlimited" | Jan 9, 2026 | Postgres integer used instead of null to simplify comparison logic |

---

*End of Document*
