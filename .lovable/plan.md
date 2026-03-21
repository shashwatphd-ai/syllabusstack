

# Plan: Auto-Detect Location from Instructor Email + Enhance Capstone Pipeline

## What This Solves

Currently, SyllabusStack requires instructors to manually type city/state/zip before discovering companies. EduThree1 has a sophisticated 3-phase auto-detection system that resolves location from the instructor's email domain (e.g., `user@umkc.edu` → "Kansas City, Missouri"). We'll port this capability and enhance it using Google's Geocoding API (which SyllabusStack already has via `GOOGLE_CLOUD_API_KEY`).

---

## EduThree1's Pipeline (What We're Porting)

EduThree1's `detect-location` edge function uses a 3-phase fallback chain:

```text
Phase 1: Local DB lookup (university_domains table)
  └─ domain → cached city/state/zip (fastest, ~10ms)
  └─ If incomplete → fall through

Phase 2: GitHub University Domains API (Hipo open-source list)
  └─ domain → university name + country code
  └─ Then geocode university name → city/state via Nominatim
  └─ Cache result back to university_domains table

Phase 3: Nominatim fallback (domain prefix + "university")
  └─ Reverse geocode → city/state/zip
```

**Our enhancement**: Replace Nominatim (rate-limited, unreliable) with Google Geocoding API, which SyllabusStack already pays for.

---

## Implementation Steps

### Step 1: Database — Add `university_domains` table

New table for caching email domain → location mappings:

```sql
CREATE TABLE university_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  formatted_location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: read-only for authenticated, writes via service role
ALTER TABLE university_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read" ON university_domains
  FOR SELECT TO authenticated USING (true);
```

### Step 2: Edge Function — Create `detect-location`

New edge function: `supabase/functions/detect-location/index.ts`

**Input**: `{ email: string }` (instructor's email)
**Output**: `{ success, city, state, zip, country, searchLocation, source }`

3-phase detection chain:
1. **DB lookup**: Query `university_domains` by email domain
2. **University Domains API**: Fetch from Hipo's GitHub JSON list → get university name + country → geocode with Google Geocoding API (`GOOGLE_CLOUD_API_KEY` already exists) → cache result
3. **Google Geocoding fallback**: Search domain prefix + "university" → reverse geocode

Uses SyllabusStack conventions: `Deno.serve()`, `getCorsHeaders()`, `withErrorHandling()`, auth via `getUser()`.

### Step 3: Frontend — Enhance `LocationSetup.tsx`

Add an "Auto-Detect" button that:
1. Gets the logged-in user's email from Supabase auth
2. Calls `detect-location` edge function
3. Pre-fills city/state/zip fields with the result
4. Shows a toast with the detected institution name
5. Falls back gracefully to manual entry if detection fails

The component keeps its existing manual entry fields — auto-detect is additive.

### Step 4: Auto-detect on Course Creation

When the instructor first opens the Capstone tab and location is not yet set:
- Automatically trigger detection using their email
- Pre-fill and show the Location Setup card with detected values
- Instructor confirms or edits before saving

---

## Technical Details

### Google Geocoding API vs Nominatim

| Feature | Nominatim (EduThree1) | Google Geocoding (SyllabusStack) |
|---|---|---|
| Rate limit | 1 req/sec, no key | 50 req/sec with key |
| Accuracy | Good for major cities | Superior globally |
| Reliability | Volunteer-run, can be slow | 99.9% uptime SLA |
| Cost | Free | ~$5/1000 requests |
| Secret needed | None | `GOOGLE_CLOUD_API_KEY` (already exists) |

### Files Created/Modified

| File | Action |
|---|---|
| SQL migration (university_domains) | Create |
| `supabase/functions/detect-location/index.ts` | Create (~150 lines) |
| `src/components/capstone/LocationSetup.tsx` | Modify — add auto-detect button |
| `src/hooks/useCapstoneProjects.ts` | Modify — add `useDetectLocation` mutation hook |

### No Breaking Changes

- `university_domains` is a new table with no foreign keys to existing tables
- `detect-location` is a new edge function
- `LocationSetup.tsx` gains a button — existing manual fields unchanged
- No existing edge functions or tables are modified

