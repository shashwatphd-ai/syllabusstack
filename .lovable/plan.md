

# Fix Capstone Ranking Algorithm — Development Plan

## Problem Summary

The ranking service (`company-ranking-service.ts`) scores companies on 5 factors but only meaningfully uses 2 of the 10+ enrichment signals Apollo provides. Revenue, funding, buying intent, tech overlap, contact quality, and data completeness are all fetched and stored but never influence which companies surface to the top. Location scoring uses naive substring matching. Hiring scoring counts jobs but ignores relevance.

---

## Implementation Steps

### Step 1: Expand the Scoring Model (ranking service)

**File:** `supabase/functions/_shared/capstone/company-ranking-service.ts`

Rewrite the scoring engine with 9 factors instead of 5:

```text
NEW WEIGHTS:
  semantic:       0.25   (was 0.40)
  hiring:         0.15   (was 0.25) — now quality-aware
  location:       0.12   (was 0.15) — now metro-aware
  size:           0.08   (was 0.10)
  diversity:      0.05   (was 0.10)
  buyingIntent:   0.12   (NEW — uses stored composite score)
  techOverlap:    0.10   (NEW — course tech vs company tech)
  contactQuality: 0.05   (NEW — prefer companies with verified contacts)
  completeness:   0.08   (NEW — uses stored data_completeness_score)
```

New scoring functions:

- **`calculateBuyingIntentScore(company)`** — Read `buying_intent_signals.compositeScore` directly from the stored company profile. Already calculated by enrichment service; just needs to be consumed.

- **`calculateTechOverlapScore(company, courseSkills)`** — Compare `technologies_used` array against course skill keywords. Jaccard-style overlap ratio (intersection / union). Requires passing `courseSkills` into the ranking function signature.

- **`calculateContactQualityScore(company)`** — Score based on presence of contact fields: email (+0.4), name (+0.2), title (+0.2), phone (+0.2). A company with a real decision-maker contact is more actionable for capstone partnerships.

- **`calculateCompletenessScore(company)`** — Read `data_completeness_score` directly from stored profile.

- **Upgrade `calculateHiringScore(company, courseSkills)`** — In addition to counting job postings, scan job titles for keyword overlap with `courseSkills`. A company hiring for roles matching the course gets a relevance bonus (+0.3 max).

- **Upgrade `calculateLocationScore(company, targetLocation)`** — Add a metro area lookup table (~30 entries: NYC boroughs, SF Bay Area cities, DFW metroplex, etc.). If company city is in the same metro as target city, score 0.9 instead of 0.3.

Update `CompanyScores` interface to include the 4 new fields. Update `rankAndSelectCompanies()` signature to accept `courseSkills: string[]`.

### Step 2: Pass Course Skills to Ranking

**File:** `supabase/functions/discover-companies/index.ts`

The ranking call currently passes only `(companies, targetLocation, maxResults)`. Add the extracted course skill keywords as a 4th parameter so tech overlap and hiring relevance can be evaluated.

### Step 3: Add Metro Area Lookup

**File:** `supabase/functions/_shared/capstone/location-utils.ts`

Add a `METRO_AREAS` constant mapping ~30 US metro groups (e.g., `"new york": ["manhattan", "brooklyn", "queens", "jersey city", "hoboken", "newark"]`). Export a `isSameMetroArea(city1, city2)` helper. This is a static lookup — no API needed.

### Step 4: Enrich CompanyCard UI

**File:** `src/components/capstone/CompanyCard.tsx`

Add display rows for:
- Revenue range (from `organization_revenue_range`)
- Buying intent badge (from `buying_intent_signals.compositeScore` — show as "High/Medium/Low Intent")
- LinkedIn link (from `linkedin_profile`)
- Contact summary (from `contact_first_name`, `contact_title` — e.g., "Jane Doe, VP Engineering")

### Step 5: Update CompanyProfile Type

**File:** `src/hooks/useCapstoneProjects.ts`

The `CompanyProfile` interface already has all the fields. The `CompanyScores` interface in `pipeline-types.ts` needs the 4 new score fields added.

---

## Testing Strategy

All changes are in one edge function (`discover-companies`) and one shared service (`company-ranking-service.ts`), so they can be tested with a single discovery run:

1. Deploy updated edge functions
2. Trigger discovery on a test course
3. Verify in the UI that companies now show revenue, intent, and contact info
4. Check that the top-ranked companies differ from before (buying intent and tech overlap should reshuffle order)
5. Verify edge function logs show the new scoring factors in the ranking output

---

## Files Changed

| File | Change |
|---|---|
| `_shared/capstone/company-ranking-service.ts` | 4 new scoring functions, updated weights, expanded interface |
| `_shared/capstone/location-utils.ts` | Metro area lookup table + `isSameMetroArea()` |
| `_shared/capstone/pipeline-types.ts` | Add 4 new fields to `CompanyScores` |
| `discover-companies/index.ts` | Pass `courseSkills` to ranking function |
| `src/components/capstone/CompanyCard.tsx` | Display revenue, intent, LinkedIn, contact |
| `src/hooks/useCapstoneProjects.ts` | No changes needed (types already present) |

