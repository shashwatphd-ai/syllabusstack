# Complete Migration Guide - Phases 1-3

This document outlines all database migrations and deployment steps required for the complete implementation.

## Migration Order

Run these migrations in sequence:

```
1. 20260109100000_add_content_ratings.sql     # Phase 2.1
2. 20260109110000_add_content_suggestions.sql # Phase 2.2
3. 20260109120000_add_achievements.sql        # Phase 2.3
4. 20260109130000_add_subscription_system.sql # Phase 3.1-3.2
```

## Quick Start

### Option 1: Supabase CLI
```bash
supabase db push
```

### Option 2: Manual SQL Execution
Run each file in order in the Supabase SQL Editor.

---

## Phase 2 Migrations

### 2.1 Content Ratings
**File:** `20260109100000_add_content_ratings.sql`

Tables:
- `content_ratings` - User ratings (1-5 stars) with difficulty and helpfulness feedback

Key columns:
- `rating INTEGER` - 1-5 stars
- `difficulty TEXT` - 'too_easy', 'just_right', 'too_hard'
- `helpful BOOLEAN`
- `watch_percentage INTEGER`

### 2.2 Resource Suggestions
**File:** `20260109110000_add_content_suggestions.sql`

Tables:
- `content_suggestions` - Community-submitted resources
- `suggestion_votes` - Upvotes/downvotes on suggestions

Key columns:
- `url TEXT` - Resource URL
- `status TEXT` - 'pending', 'approved', 'rejected'
- `votes INTEGER` - Net vote count

### 2.3 Achievement System
**File:** `20260109120000_add_achievements.sql`

Tables:
- `achievements` - Achievement definitions (17 initial)
- `user_achievements` - Earned achievements
- `user_xp` - XP and leveling

Functions:
- `calculate_level(xp)` - Returns level from XP
- `award_xp(user_id, amount)` - Awards XP and updates level
- `grant_achievement(user_id, key)` - Grants achievement by key
- `check_achievements(user_id)` - Checks and grants eligible achievements

---

## Phase 3 Migrations

### 3.1-3.2 Subscription System
**File:** `20260109130000_add_subscription_system.sql`

Tables:
- `tier_limits` - Feature limits per tier

New columns on `profiles`:
- `subscription_tier` - 'free', 'pro', 'university'
- `subscription_status` - 'active', 'canceled', 'past_due', 'trialing'
- `ai_calls_this_month INTEGER`
- `stripe_customer_id TEXT`
- `stripe_subscription_id TEXT`

Functions:
- `check_tier_limit(user_id, type)` - Check if action allowed
- `increment_ai_usage(user_id)` - Increment and check AI usage
- `get_subscription_details(user_id)` - Get full subscription info

---

## Edge Functions to Deploy

```bash
# Phase 2
supabase functions deploy send-digest-email

# Phase 3
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

---

## Environment Variables Required

### Phase 2
```env
RESEND_API_KEY=re_...  # For email notifications
```

### Phase 3 (Stripe)
```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
```

---

## Component Integration Points

### Phase 1 - UX Enhancement
| Component | Location | Purpose |
|-----------|----------|---------|
| ProgressRing | Dashboard cards | Visual progress indicators |
| EmptyState variants | Throughout app | Context-specific empty states |
| DreamJobSuggestions | Onboarding | AI career suggestions |

### Phase 2 - User Engagement
| Component | Location | Purpose |
|-----------|----------|---------|
| ContentRating | Video player | Rate content after watching |
| SuggestedResources | LO views | Show community resources |
| ReviewSuggestions | Instructor dashboard | Moderate suggestions |
| AchievementToastProvider | App.tsx root | Show unlock notifications |
| AchievementsList | User profile | Display achievements |
| XPProgress | Dashboard | Show level progress |

### Phase 3 - Scale & Monetize
| Component | Location | Purpose |
|-----------|----------|---------|
| UsageMeter | Dashboard/Settings | Show usage limits |
| UpgradePrompt | Feature gates | Prompt for upgrades |
| PricingTable | /billing | Show pricing tiers |
| SubscriptionManager | /billing | Manage subscription |
| BillingHistory | /billing | View invoices |

### Admin Portal (University Tier)
| Page | Route | Purpose |
|------|-------|---------|
| AdminDashboard | /admin | Overview and stats |
| UserManagement | /admin/users | Bulk user management |
| OutcomesReport | /admin/outcomes | Student analytics |
| CourseManagement | /admin/courses | Course overview |
| BrandingSettings | /admin/branding | White-label customization |

---

## Verification Queries

After running migrations, verify:

```sql
-- Check Phase 2 tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'content_ratings',
  'content_suggestions',
  'suggestion_votes',
  'achievements',
  'user_achievements',
  'user_xp'
);

-- Check achievements populated (should be 17)
SELECT COUNT(*) FROM achievements;

-- Check Phase 3 tables and columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN (
  'subscription_tier',
  'ai_calls_this_month',
  'stripe_customer_id'
);

-- Check tier limits configured
SELECT * FROM tier_limits;

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'calculate_level',
  'award_xp',
  'grant_achievement',
  'check_achievements',
  'check_tier_limit',
  'increment_ai_usage',
  'get_subscription_details'
);
```

---

## Rollback Instructions

If needed, rollback in reverse order:

```sql
-- Phase 3 rollback
DROP TABLE IF EXISTS tier_limits;
ALTER TABLE profiles
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS ai_calls_this_month,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

-- Phase 2.3 rollback
DROP TABLE IF EXISTS user_xp;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS achievements;

-- Phase 2.2 rollback
DROP TABLE IF EXISTS suggestion_votes;
DROP TABLE IF EXISTS content_suggestions;

-- Phase 2.1 rollback
DROP TABLE IF EXISTS content_ratings;
```

---

## Post-Migration Steps

1. **Run edge function deployments**
2. **Configure Stripe webhook endpoint** → `{SUPABASE_URL}/functions/v1/stripe-webhook`
3. **Add routes to App.tsx** for admin pages
4. **Integrate achievement toast provider** in app root
5. **Test subscription flow** with Stripe test mode
