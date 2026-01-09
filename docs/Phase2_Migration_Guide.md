# Phase 2 Migration Guide

This document outlines the database migrations and deployment steps required for Phase 2 (User Engagement) features.

## Database Migrations

Run these migrations in order against your Supabase database:

### 1. Content Ratings System
**File:** `supabase/migrations/20260109100000_add_content_ratings.sql`

Creates:
- `content_ratings` table - User ratings for learning content
- Trigger to auto-update `content.average_rating`
- RLS policies for user access

```sql
-- Key table structure
CREATE TABLE content_ratings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  content_id UUID REFERENCES content(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  difficulty TEXT CHECK (difficulty IN ('too_easy', 'just_right', 'too_hard')),
  helpful BOOLEAN,
  comment TEXT,
  watch_percentage INTEGER,
  UNIQUE (user_id, content_id)
);
```

### 2. Resource Suggestion System
**File:** `supabase/migrations/20260109110000_add_content_suggestions.sql`

Creates:
- `content_suggestions` table - Community-submitted resources
- `suggestion_votes` table - Voting on suggestions
- Trigger to auto-update vote counts
- RLS policies

```sql
-- Key table structures
CREATE TABLE content_suggestions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  learning_objective_id UUID REFERENCES learning_objectives(id),
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  source_type TEXT DEFAULT 'youtube',
  votes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  reviewer_id UUID REFERENCES auth.users(id)
);

CREATE TABLE suggestion_votes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  suggestion_id UUID REFERENCES content_suggestions(id),
  vote INTEGER CHECK (vote IN (-1, 1)),
  UNIQUE (user_id, suggestion_id)
);
```

### 3. Achievement & Gamification System
**File:** `supabase/migrations/20260109120000_add_achievements.sql`

Creates:
- `achievements` table - Achievement definitions (17 initial achievements)
- `user_achievements` table - Earned achievements
- `user_xp` table - XP and leveling
- Functions: `calculate_level`, `award_xp`, `grant_achievement`, `check_achievements`
- RLS policies

```sql
-- Key table structures
CREATE TABLE achievements (
  id UUID PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  requirement_type TEXT NOT NULL,
  requirement_count INTEGER DEFAULT 1,
  tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'))
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  achievement_id UUID REFERENCES achievements(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
  notified BOOLEAN DEFAULT false,
  UNIQUE (user_id, achievement_id)
);

CREATE TABLE user_xp (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1
);
```

## How to Apply Migrations

### Option 1: Supabase CLI (Recommended)
```bash
# From project root
supabase db push
```

### Option 2: Manual SQL Execution
Run each migration file in the Supabase SQL Editor in order:
1. `20260109100000_add_content_ratings.sql`
2. `20260109110000_add_content_suggestions.sql`
3. `20260109120000_add_achievements.sql`

### Option 3: Supabase Dashboard
1. Go to Database > Migrations
2. Upload/paste each migration SQL
3. Execute in order

## Edge Function Deployment

The `send-digest-email` function was enhanced and needs redeployment:

```bash
supabase functions deploy send-digest-email
```

## Component Integration Points

After migrations, integrate these components into the UI:

| Component | Integration Location | Purpose |
|-----------|---------------------|---------|
| `ContentRating` | Video player UI | Rate content after watching |
| `SuggestedResources` | Learning objective view | Show community resources |
| `SuggestResource` | Learning objective view | Submit new resources |
| `ReviewSuggestions` | Instructor dashboard | Moderate suggestions |
| `AchievementToastProvider` | App.tsx root | Show unlock notifications |
| `AchievementsList` | User profile/dashboard | Display achievements |
| `XPProgress` | Dashboard sidebar | Show level progress |

## Verification

After applying migrations, verify with:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('content_ratings', 'content_suggestions', 'suggestion_votes', 'achievements', 'user_achievements', 'user_xp');

-- Check achievements populated
SELECT COUNT(*) FROM achievements; -- Should be 17

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('calculate_level', 'award_xp', 'grant_achievement', 'check_achievements');
```
